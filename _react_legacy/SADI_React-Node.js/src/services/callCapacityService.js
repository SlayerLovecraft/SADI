// ==============================================================================
// callCapacityService.js - MOTOR DE CAPACIDAD DIARIA Y REPARTO ANUAL RES. 3280
// - Capacidad: 8:00 AM a 6:00 PM (10 Horas) = 350 llamadas/hora = 3.500 llamadas/día
// - Control estricto de aforo: Resolución 3280 + Campañas acumuladas <= 3.500
// - Reparto de 365 días por ventana de oportunidad clínica
// - Generador de prompts clínicos individualizados
// ==============================================================================

import { CURSOS_VIDA_PALETTE, GRUPOS_RIESGO_PALETTE } from './clinicalPalettes';
import { GRUPOS_RIESGO_10 } from './gruposRiesgoCatalog';
import { PROGRAMAS_3280 } from './census400kService';

export const DAILY_CALL_CAPACITY = 3500; // 350 llamadas/hora x 10 horas
export const HOURLY_CALL_CAPACITY = 350;
export const OPERATING_HOURS_START = '08:00 AM';
export const OPERATING_HOURS_END = '06:00 PM';
export const TOTAL_OPERATING_HOURS = 10;

// Helper: Formato de fecha YYYY-MM-DD
export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: Saber si es domingo (0 = Domingo)
export function isSundayDate(date) {
  return date.getDay() === 0;
}

/**
 * Calcula la urgencia de ventana clínica de un paciente para la Resolución 3280.
 * Menor puntaje = Menos días para salir de la ventana = MAYOR PRIORIDAD.
 */
export function calculateWindowUrgency(patient) {
  const edad = Number(patient.edad) || 0;
  const curso = (patient.curso_vida || patient.ciclo_vida || '').toLowerCase();
  const riesgo = (patient.grupo_riesgo || '').toLowerCase();

  // 1. Materno-Perinatal / Gestantes: Urgencia crítica semanal
  if (riesgo.includes('materno') || riesgo.includes('gestan')) {
    // Si está en último trimestre o cercana al parto
    return 3; // Muy urgente
  }

  // 2. Primera Infancia al límite de salir del rango (4.8 - 5.9 años)
  if (curso.includes('primera infancia') || edad <= 5) {
    if (edad >= 5) return 5; // Cerca de cumplir 6 años (sale de primera infancia)
    if (edad === 0) return 7; // Neonato / lactante menor
    return 12;
  }

  // 3. Infancia límite (11 años a punto de pasar a adolescencia)
  if (curso.includes('infancia') || (edad >= 6 && edad <= 11)) {
    if (edad === 11) return 8;
    return 15;
  }

  // 4. Adolescencia límite (17 años a punto de adultez)
  if (curso.includes('adolescen') || (edad >= 12 && edad <= 17)) {
    if (edad === 17) return 10;
    return 18;
  }

  // 5. Riesgo Cardiovascular descompensado o Cáncer
  if (riesgo.includes('cardio') || riesgo.includes('cáncer') || riesgo.includes('cancer')) {
    return 10;
  }

  // 6. Adultos y Vejez general
  return 20 + ((patient.id || 1) % 10);
}

/**
 * Genera el plan de llamadas anual de la Resolución 3280 repartiendo los pacientes
 * en los 365 días del año según prioridad de ventana clínica.
 */
export function generateAnnualResolutionRoadmap(patients, year = 2026) {
  const roadmap365 = {};

  // Inicializar los 365 días del año
  const startDate = new Date(year, 0, 1, 12, 0, 0);
  for (let dayIdx = 0; dayIdx < 365; dayIdx++) {
    const curDate = new Date(startDate);
    curDate.setDate(startDate.getDate() + dayIdx);
    const iso = toISODate(curDate);
    const isSun = curDate.getDay() === 0;

    roadmap365[iso] = {
      dayIndex: dayIdx + 1,
      date: curDate,
      isoDate: iso,
      dayOfWeek: curDate.getDay(), // 0 = Dom, 1 = Lun...
      isSunday: isSun,
      isOperative: !isSun,
      callsResolucion: [],
      cursosVidaPresentes: new Set(),
      gruposRiesgoPresentes: new Set(),
      totalLlamadasResolucion: 0,
      totalLlamadasCampanas: 0,
      cupoDisponible: isSun ? 0 : DAILY_CALL_CAPACITY
    };
  }

  // Agrupar pacientes por mes objetivo (según fecha de nacimiento o ID)
  const pacientesPorMes = Array.from({ length: 12 }, () => []);
  patients.forEach(pat => {
    let birthMonth = 0;
    if (pat.fechaNacimiento || pat.fecha_nacimiento) {
      const fn = pat.fechaNacimiento || pat.fecha_nacimiento;
      const parts = fn.split('-');
      if (parts.length >= 2) {
        const m = parseInt(parts[1], 10);
        if (m >= 1 && m <= 12) birthMonth = m - 1;
      }
    } else {
      birthMonth = (pat.id || 1) % 12;
    }
    pacientesPorMes[birthMonth].push(pat);
  });

  // Para cada mes, ordenar pacientes por urgencia de ventana y repartirlos en días hábiles
  for (let m = 0; m < 12; m++) {
    const pacientesDelMes = [...pacientesPorMes[m]];
    // Ordenar: menor urgencia = más urgente
    pacientesDelMes.sort((a, b) => calculateWindowUrgency(a) - calculateWindowUrgency(b));

    // Obtener días hábiles del mes
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const diasHabilesDelMes = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, m, d, 12, 0, 0);
      if (!isSundayDate(dt)) {
        diasHabilesDelMes.push(toISODate(dt));
      }
    }

    if (diasHabilesDelMes.length === 0) continue;

    // Repartir los pacientes del mes entre los días hábiles
    pacientesDelMes.forEach((pat, pIdx) => {
      const targetDayISO = diasHabilesDelMes[pIdx % diasHabilesDelMes.length];
      if (roadmap365[targetDayISO]) {
        const cvProg = getCursoVidaProg(pat);
        const grProg = getGrupoRiesgoProg(pat);
        const hito = getHitoClinico3280(pat, m);

        const callItem = {
          patientId: pat.id,
          nombre: pat.nombre,
          documento: pat.cc || pat.numero_documento,
          telefono: pat.telefono,
          cursoVidaId: cvProg.id,
          cursoVidaNombre: cvProg.nombre,
          cursoVidaColorHex: cvProg.colorHex,
          grupoRiesgoId: grProg.id,
          grupoRiesgoNombre: grProg.nombre,
          grupoRiesgoColorHex: grProg.colorHex,
          accion3280: hito.titulo,
          cups: hito.cups,
          indicaciones: hito.indicaciones,
          urgenciaScore: calculateWindowUrgency(pat),
          estado: 'programada'
        };

        roadmap365[targetDayISO].callsResolucion.push(callItem);
        roadmap365[targetDayISO].cursosVidaPresentes.add(cvProg.id);
        roadmap365[targetDayISO].gruposRiesgoPresentes.add(grProg.id);
        roadmap365[targetDayISO].totalLlamadasResolucion += 1;
        roadmap365[targetDayISO].cupoDisponible = Math.max(0, DAILY_CALL_CAPACITY - roadmap365[targetDayISO].totalLlamadasResolucion);
      }
    });
  }

  return roadmap365;
}

/**
 * Valida si una campaña puede programarse en las fechas seleccionadas
 * comprobando que no supere el saldo disponible de 3.500 llamadas diarias.
 * 
 * @param {Array<string>} selectedDates - Arreglo de fechas ISO ['YYYY-MM-DD']
 * @param {number} totalDestinatarios - Total de llamadas que requiere la campaña
 * @param {Object} roadmap365 - El estado del roadmap anual
 * @param {Array<Object>} existingCampaigns - Campañas activas ya programadas
 * @returns {Object} { allowed: boolean, message?: string, balanceDetails?: Array }
 */
export function validateCampaignCallCapacity(selectedDates, totalDestinatarios, roadmap365, existingCampaigns = []) {
  if (!selectedDates || selectedDates.length === 0) {
    return {
      allowed: false,
      message: 'Debes seleccionar al menos una fecha hábil para el lanzamiento de la campaña.'
    };
  }

  // Dividir equitativamente el volumen entre los días seleccionados
  const callsPerDay = Math.ceil(totalDestinatarios / selectedDates.length);
  const conflicts = [];
  const balanceSummary = [];

  for (const dateISO of selectedDates) {
    const dayData = roadmap365[dateISO];
    if (!dayData) {
      // Si la fecha no está pre-mapeada (ej. fechas de meses siguientes o año siguiente), validar que no sea domingo
      const parsedDate = new Date(dateISO + 'T12:00:00');
      if (parsedDate.getDay() === 0) {
        conflicts.push(`El día ${dateISO} es domingo. La operación del Gateway GSM solo opera de Lunes a Sábado.`);
        continue;
      }
      balanceSummary.push({
        dateISO,
        resolucionCalls: 0,
        otherCampaignsCalls: 0,
        solicitadas: callsPerDay,
        saldoDisponible: DAILY_CALL_CAPACITY,
        restanteFinal: DAILY_CALL_CAPACITY - callsPerDay
      });
      continue;
    }

    if (dayData.isSunday) {
      conflicts.push(`El día ${dateISO} es domingo. La operación del Gateway GSM solo opera de Lunes a Sábado.`);
      continue;
    }

    // Calcular llamadas de resolución
    const resolucionCalls = dayData.totalLlamadasResolucion || 0;

    // Calcular llamadas de otras campañas en ese mismo día
    let otherCampaignsCalls = 0;
    existingCampaigns.forEach(camp => {
      if (camp.fechas_ejecucion && camp.fechas_ejecucion.includes(dateISO)) {
        const campPerDay = Math.ceil((camp.pacientes_asignados || camp.destinatarios || 0) / camp.fechas_ejecucion.length);
        otherCampaignsCalls += campPerDay;
      }
    });

    const ocupadasActuales = resolucionCalls + otherCampaignsCalls;
    const saldoDisponible = Math.max(0, DAILY_CALL_CAPACITY - ocupadasActuales);

    balanceSummary.push({
      dateISO,
      resolucionCalls,
      otherCampaignsCalls,
      solicitadas: callsPerDay,
      saldoDisponible,
      restanteFinal: saldoDisponible - callsPerDay
    });

    if (callsPerDay > saldoDisponible) {
      conflicts.push(
        `Día ${dateISO}: Se requieren ${callsPerDay} llamadas, pero solo quedan ${saldoDisponible} disponibles de las 3.500 máximas (${resolucionCalls} reservadas por Res. 3280 y ${otherCampaignsCalls} por otras campañas).`
      );
    }
  }

  if (conflicts.length > 0) {
    return {
      allowed: false,
      message: `No es posible agendar la campaña: Se superaría la capacidad máxima del Gateway GSM (3.500 llamadas/día):\n• ${conflicts.slice(0, 3).join('\n• ')}${conflicts.length > 3 ? `\n...y ${conflicts.length - 3} días más.` : ''}\n\nPor favor distribuye la campaña en más días hábiles o selecciona otra fecha con saldo.`,
      balanceSummary
    };
  }

  return {
    allowed: true,
    callsPerDay,
    balanceSummary,
    message: `Capacidad validada con éxito: Se programarán ${callsPerDay} llamadas/día dentro del límite autorizado de 3.500 diarias.`
  };
}

/**
 * Generador de Prompt Clínico Particular e Individualizado por Paciente.
 * Personalizado por:
 * - Paciente (Nombre, edad, documento, sede)
 * - Resolución 3280 (Hito preventivo, código CUPS 890201)
 * - Grupo de Riesgo Priorizado
 * - Directriz de Campaña
 */
export function generateIndividualClinicalPrompt({
  patient,
  cursoVida,
  grupoRiesgo,
  hitoClinico,
  campaignName = '',
  campaignDirectriz = '',
  sede = 'Sede Principal - Manizales (Caldas)'
}) {
  const nombre = patient.nombre || 'Paciente';
  const doc = patient.cc || patient.numero_documento || 'Sin documento';
  const edad = patient.edad || 'Edad no registrada';
  const cvNombre = cursoVida?.nombre || 'General';
  const grNombre = grupoRiesgo?.nombre || 'General';
  const cups = hitoClinico?.cups || '890201';
  const accion = hitoClinico?.titulo || hitoClinico?.hito || 'Consulta Médica Preventiva';
  const indicaciones = hitoClinico?.indicaciones || 'Asistir puntual con documento de identidad.';

  return `
[DIRECTRIZ CLÍNICA DEL AGENTE SADI - RESOLUCIÓN 3280 DE 2018]
- Paciente: ${nombre} | Documento: ${doc} | Edad: ${edad} años.
- Sede de Atención: ${sede}.
- Curso de Vida 3280: ${cvNombre}.
- Grupo de Riesgo Priorizado: ${grNombre}.
- Intervención Obligatoria: ${accion} (Código CUPS: ${cups} - Medicina General / Demanda Inducida).
${campaignName ? `- Campaña Activa: "${campaignName}"` : ''}
${campaignDirectriz ? `- Instrucción Especial de Campaña: "${campaignDirectriz}"` : ''}

[GUION CONVERSACIONAL Y PROTOCOLO DE VOZ IA]
1. Saludo Institucional y Verificación de Identidad:
   "Buenos días/tardes, ¿me comunico con ${nombre}? Le habla SADI, el asistente clínico del Hospital Central de Caldas."
2. Propósito Clínico Preventivo:
   "Por normativa de la Resolución 3280 y para cuidar su salud en el programa de ${grNombre}, le informamos que tiene programado su control de ${accion}."
3. Instrucciones Clínicas Pre-Consulta:
   "${indicaciones}"
4. Confirmación de Cita (Captura DTMF o Voz):
   "Presione la tecla 1 para confirmar su asistencia en ${sede}, o la tecla 2 si requiere reagendar una nueva fecha."
5. Cierre:
   "Su salud es nuestra prioridad. Que tenga un excelente día."
`.trim();
}

// Helpers internos para obtener metadatos de Curso y Riesgo
function getCursoVidaProg(pat) {
  const cvText = (pat.curso_vida || pat.ciclo_vida || '').toLowerCase();
  const edad = Number(pat.edad) || 0;
  let code = 'E';
  if (cvText.includes('primera') || edad <= 5) code = 'A';
  else if (cvText.includes('infancia') || (edad >= 6 && edad <= 11)) code = 'B';
  else if (cvText.includes('adolescen') || (edad >= 12 && edad <= 17)) code = 'C';
  else if (cvText.includes('juventud') || (edad >= 18 && edad <= 28)) code = 'D';
  else if (cvText.includes('adultez') || (edad >= 29 && edad <= 59)) code = 'E';
  else if (cvText.includes('vejez') || edad >= 60) code = 'F';

  const pal = CURSOS_VIDA_PALETTE[code] || CURSOS_VIDA_PALETTE['E'];
  return { id: code, nombre: pal.nombre, colorHex: pal.colorHex };
}

function getGrupoRiesgoProg(pat) {
  const gr = (pat.grupo_riesgo || '').toLowerCase();
  let id = 2; // Cardiovascular default
  if (gr.includes('materno')) id = 1;
  else if (gr.includes('cardio')) id = 2;
  else if (gr.includes('respira')) id = 3;
  else if (gr.includes('cáncer') || gr.includes('cancer')) id = 4;
  else if (gr.includes('mental')) id = 5;
  else if (gr.includes('infec')) id = 6;
  else if (gr.includes('huerfa') || gr.includes('rara')) id = 7;
  else if (gr.includes('nutric')) id = 8;
  else if (gr.includes('musculo') || gr.includes('esquelet')) id = 9;
  else if (gr.includes('oral') || gr.includes('bucal')) id = 10;

  const pal = GRUPOS_RIESGO_PALETTE[id] || GRUPOS_RIESGO_PALETTE[2];
  return { id, nombre: pal.nombre, colorHex: pal.colorHex };
}

function getHitoClinico3280(pat, monthIndex) {
  const grProg = getGrupoRiesgoProg(pat);
  const rgCatalog = GRUPOS_RIESGO_10.find(g => g.id === grProg.id);
  const milestone = rgCatalog?.milestones?.[monthIndex];

  return {
    titulo: milestone?.hito || 'Tamizaje y Consulta Preventiva Res. 3280',
    cups: milestone?.cups || '890201',
    indicaciones: milestone?.indicaciones || 'Presentarse 15 minutos antes con documento original en la sede asignada.'
  };
}

