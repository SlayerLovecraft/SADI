// ==============================================================================
// callCapacityService.js - MOTOR DE CAPACIDAD GSM (500 LLAMADAS/DÍA), PRIORIDADES
// P1-P5 (TABLERO_SADI_CAMPANAS.XLSX), FESTIVOS COLOMBIA Y GUIONES RES. 3280
// - Capacidad operativa diaria: 500 llamadas IA/día (08:00 AM - 06:00 PM · 50/h)
// - Días operativos: Lunes a Sábado excluyendo Domingos y Festivos de Colombia
// - Prioridad de cola de voz: P1 (Materno) -> P2 (Cáncer) -> P3 (Inasist./Pediát. Riesgo)
//   -> P4 (Grupos de Riesgo Crónicos) -> P5 (Valoración Preventiva Res. 3280)
// - Excedente > 500/día: derivado automáticamente a SMS Respaldo (R1-04)
// - CERO grupos de riesgo inventados: solo riesgos clínicos reales de la BD
// ==============================================================================

import {
  CURSOS_VIDA_PALETTE,
  GRUPOS_RIESGO_PALETTE,
  getGrupoRiesgoPalette,
} from './clinicalPalettes';
import { GRUPOS_RIESGO_CATALOG } from './gruposRiesgoCatalog';
import {
  classifyPatientCursoVidaKey,
  CURSO_KEY_TO_CODE,
  isMinorCursoVidaABC,
  getTimeOfDayGreeting,
  buildMinorAcudienteOpening,
} from './cursoVidaConfig';
import { CALI_IPS_SEDES } from './caliDivipola';
import { NOSHOW_POLICY } from './noShowFollowupService';

export const OPERATING_HOURS_START = 8; // 08:00 AM
export const OPERATING_HOURS_END = 18;  // 06:00 PM
export const OPERATING_TOTAL_HOURS = 10;
export const CALLS_PER_HOUR = 50;
export const DAILY_CALL_CAPACITY = 500; // 50 llamadas/hora × 10 horas = 500 llamadas IA/día

// Festivos oficiales de Colombia 2025-2027 (alineados con Tablero_SADI_Campanas.xlsx hoja Festivos)
export const COLOMBIA_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-06', '2025-03-24', '2025-04-17', '2025-04-18',
  '2025-05-01', '2025-06-02', '2025-06-23', '2025-06-30', '2025-07-20',
  '2025-08-07', '2025-08-18', '2025-10-13', '2025-11-03', '2025-11-17',
  '2025-12-08', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29',
  '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02',
  '2026-11-16', '2026-12-08', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-11', '2027-03-22', '2027-03-25', '2027-03-26',
  '2027-05-01', '2027-05-10', '2027-05-31', '2027-06-07', '2027-07-05',
  '2027-07-20', '2027-08-07', '2027-08-16', '2027-10-18', '2027-11-01',
  '2027-11-15', '2027-12-08', '2027-12-25',
]);

export function isColombiaHoliday(isoDate) {
  return COLOMBIA_HOLIDAYS.has(String(isoDate || '').slice(0, 10));
}

export function isOperationalWorkday(isoOrDate) {
  let dObj;
  let iso;
  if (isoOrDate instanceof Date) {
    dObj = isoOrDate;
    iso = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
  } else {
    iso = String(isoOrDate || '').slice(0, 10);
    dObj = new Date(`${iso}T12:00:00`);
  }
  if (isNaN(dObj.getTime())) return false;
  if (dObj.getDay() === 0) return false; // Domingo
  if (COLOMBIA_HOLIDAYS.has(iso)) return false; // Festivo Colombia
  return true;
}

export const CALL_PRIORITY_META = {
  1: {
    id: 1,
    code: 'P1',
    label: 'P1 · Materno-Perinatal',
    shortLabel: 'P1 Materno',
    rule: 'R3-04/05/06',
    colorHex: '#E11D48',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800',
  },
  2: {
    id: 2,
    code: 'P2',
    label: 'P2 · Cáncer / Tamizajes',
    shortLabel: 'P2 Cáncer',
    rule: 'R3-03',
    colorHex: '#9333EA',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-800',
  },
  3: {
    id: 3,
    code: 'P3',
    label: 'P3 · Inasistentes / Ped. Riesgo',
    shortLabel: 'P3 Prioritaria',
    rule: 'R3-01 / +3d SMS',
    colorHex: '#EA580C',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-800',
  },
  4: {
    id: 4,
    code: 'P4',
    label: 'P4 · Grupos de Riesgo Crónicos',
    shortLabel: 'P4 Crónicos',
    rule: 'R3-07/08/09',
    colorHex: '#2563EB',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800',
  },
  5: {
    id: 5,
    code: 'P5',
    label: 'P5 · Preventiva Res. 3280',
    shortLabel: 'P5 Preventiva',
    rule: 'Res. 3280 Base',
    colorHex: '#059669',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800',
  },
};

export function getPriorityMeta(prioNum) {
  return CALL_PRIORITY_META[Number(prioNum)] || CALL_PRIORITY_META[5];
}

/**
 * Clasifica el Curso de Vida real del paciente (7 Cursos oficiales A-G).
 */
export function getPatientCursoVida(patient) {
  const cursoKey = classifyPatientCursoVidaKey(patient);
  const code = CURSO_KEY_TO_CODE[cursoKey] || 'E';
  const pal = CURSOS_VIDA_PALETTE[code] || CURSOS_VIDA_PALETTE.E;
  return {
    id: pal.id,
    key: pal.key,
    nombre: pal.nombre,
    rango: pal.rango,
    colorHex: pal.colorHex,
    bgClass: pal.bgClass,
    badgeClass: pal.badgeClass,
  };
}

/**
 * Extrae TODOS los Grupos de Riesgo clínicos REALES del paciente (NUNCA inventa riesgos).
 * Retorna [] cuando el paciente no pertenece a ningún grupo de riesgo clínico.
 */
export function getPatientGruposRiesgo(patient) {
  if (!patient) return [];

  const rawList = [];
  if (Array.isArray(patient.grupos_riesgo)) {
    rawList.push(...patient.grupos_riesgo);
  } else if (typeof patient.grupos_riesgo === 'string' && patient.grupos_riesgo.trim()) {
    const trimmed = patient.grupos_riesgo.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) rawList.push(...parsed);
      } catch {
        rawList.push(trimmed);
      }
    } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      trimmed
        .slice(1, -1)
        .split(',')
        .map((s) => s.replace(/^"|"$/g, '').trim())
        .filter(Boolean)
        .forEach((s) => rawList.push(s));
    } else {
      rawList.push(trimmed);
    }
  }

  if (Array.isArray(patient.patient_grupos_riesgo)) {
    rawList.push(...patient.patient_grupos_riesgo);
  }

  if (rawList.length === 0) {
    const single = patient.grupo_riesgo || patient.grupoRiesgo || patient.patient_grupo_riesgo || '';
    if (single) rawList.push(single);
  }

  const seenIds = new Set();
  const resolved = [];
  for (const raw of rawList) {
    const pal = getGrupoRiesgoPalette(raw);
    if (pal && !seenIds.has(pal.id)) {
      seenIds.add(pal.id);
      resolved.push({
        id: pal.id,
        codigo: pal.codigo,
        nombre: pal.nombre,
        prioridad: pal.prioridad,
        colorHex: pal.colorHex,
        bgClass: pal.bgClass,
        badgeClass: pal.badgeClass,
      });
    }
  }

  return resolved.sort((a, b) => a.prioridad - b.prioridad || a.id - b.id);
}

/**
 * Retorna el Grupo de Riesgo principal REAL del paciente, o un descriptor neutro "Sin grupo de riesgo"
 * (id: null) cuando el paciente no tiene ningún riesgo clínico registrado.
 */
export function getPatientGrupoRiesgo(patient) {
  const list = getPatientGruposRiesgo(patient);
  if (list.length > 0) return list[0];
  return {
    id: null,
    codigo: 'sin_grupo_riesgo',
    nombre: 'Sin grupo de riesgo',
    prioridad: 5,
    colorHex: '#64748B',
    bgClass: 'bg-slate-500',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  };
}

/**
 * Calcula la prioridad real (1..5) de un paciente para la cola de voz de 500 llamadas/día.
 */
export function getPatientCallPriority(patient) {
  if (patient?.prioridad_llamada) return Number(patient.prioridad_llamada);
  const cv = getPatientCursoVida(patient);
  const risks = getPatientGruposRiesgo(patient);
  const rids = new Set(risks.map((r) => r.id));
  if (cv.id === 'G' || rids.has(1)) return 1;
  if (rids.has(3)) return 2;
  if (cv.id === 'A' && rids.size > 0) return 3;
  if (rids.size > 0) return 4;
  return 5;
}

/**
 * Valida la capacidad de una campaña contra el límite real de 500 llamadas IA/día
 * (excluyendo domingos y festivos de Colombia) y calcula derivación automática a SMS Respaldo (R1-04)
 * en caso de excedente para que ningún paciente quede sin contacto.
 */
export function validateCampaignCallCapacity(
  selectedDates,
  patientCount,
  roadmap365 = {},
  existingCampaigns = [],
  { allowSmsOverflow = true } = {}
) {
  if (!selectedDates || selectedDates.length === 0) {
    return {
      allowed: false,
      hasOverflow: false,
      callsPerDay: 0,
      voiceAssignedTotal: 0,
      smsOverflowTotal: 0,
      conflicts: ['No se han seleccionado fechas hábiles en el calendario.'],
      message: 'Debes seleccionar al menos una fecha hábil (Lunes a Sábado, sin festivos) para programar la campaña.',
    };
  }

  const validDates = selectedDates.filter((iso) => isOperationalWorkday(iso));
  if (validDates.length === 0) {
    return {
      allowed: false,
      hasOverflow: false,
      callsPerDay: 0,
      voiceAssignedTotal: 0,
      smsOverflowTotal: 0,
      conflicts: ['Las fechas seleccionadas corresponden a domingos o festivos de Colombia.'],
      message: 'No es posible emitir llamadas IA en domingos ni festivos oficiales de Colombia.',
    };
  }

  const totalPatients = Math.max(1, Number(patientCount || 0));
  const callsPerDay = Math.ceil(totalPatients / validDates.length);
  const conflicts = [];
  const dailyDetails = [];
  let voiceAssignedTotal = 0;
  let smsOverflowTotal = 0;
  let remaining = totalPatients;

  for (const dateISO of validDates) {
    const dayDemand = Math.min(callsPerDay, remaining);
    remaining = Math.max(0, remaining - dayDemand);

    const resolucionCalls = Number(roadmap365?.[dateISO]?.llamadasAsignadas ?? roadmap365?.[dateISO]?.totalLlamadasResolucion ?? 0);

    let otherCampaignsCalls = 0;
    (existingCampaigns || []).forEach((camp) => {
      if (camp && camp.estado !== 'completada' && camp.estado !== 'cancelada') {
        const dates = camp.fechas_ejecucion || camp.config_frecuencia?.selectedDates || [];
        if (dates.includes(dateISO)) {
          const vol = Number(camp.pacientes_asignados || camp.destinatarios || 0);
          otherCampaignsCalls += Math.ceil(vol / Math.max(1, dates.length));
        }
      }
    });

    const saldoDisponible = Math.max(0, DAILY_CALL_CAPACITY - resolucionCalls - otherCampaignsCalls);
    const voiceForDay = Math.min(dayDemand, saldoDisponible);
    const smsForDay = Math.max(0, dayDemand - voiceForDay);

    voiceAssignedTotal += voiceForDay;
    smsOverflowTotal += smsForDay;

    dailyDetails.push({
      dateISO,
      resolucionCalls,
      otherCampaignsCalls,
      saldoDisponible,
      dayDemand,
      voiceForDay,
      smsForDay,
    });

    if (smsForDay > 0) {
      conflicts.push(
        `Día ${dateISO}: Demanda ${dayDemand} · Cupo voz restante ${saldoDisponible}/${DAILY_CALL_CAPACITY} (${resolucionCalls} Res. 3280 + ${otherCampaignsCalls} campañas) → ${voiceForDay} Llamadas IA + ${smsForDay} SMS Respaldo (R1-04).`
      );
    }
  }

  const hasOverflow = smsOverflowTotal > 0;
  if (hasOverflow && !allowSmsOverflow) {
    return {
      allowed: false,
      hasOverflow: true,
      callsPerDay,
      voiceAssignedTotal,
      smsOverflowTotal,
      dailyDetails,
      conflicts,
      message: `Se supera el límite diario de ${DAILY_CALL_CAPACITY} llamadas IA/día:\n• ${conflicts.slice(0, 3).join('\n• ')}`,
    };
  }

  return {
    allowed: true,
    hasOverflow,
    callsPerDay,
    voiceAssignedTotal,
    smsOverflowTotal,
    dailyDetails,
    conflicts,
    message: hasOverflow
      ? `Cupo de ${DAILY_CALL_CAPACITY} llamadas/día aplicado con derivación inteligente: ${voiceAssignedTotal.toLocaleString('es-CO')} llamadas IA + ${smsOverflowTotal.toLocaleString('es-CO')} respaldos SMS (R1-04) en ${validDates.length} día(s) hábil(es).`
      : `Capacidad validada al 100%: ${voiceAssignedTotal.toLocaleString('es-CO')} llamadas IA (~${callsPerDay}/día) dentro del tope operativo de ${DAILY_CALL_CAPACITY} llamadas/día.`,
  };
}

/**
 * Genera el guion/prompt clínico individualizado del Agente IA para Santiago de Cali (Res. 3280)
 */
export function generateIndividualClinicalPrompt(patient, contextItem, contextType, customDirective = '') {
  const nombre = patient.nombre || patient.name || 'Paciente';
  const doc = patient.documento || patient.document || patient.cc || 'No registrado';
  const tel = patient.telefono || patient.phone || 'Sin teléfono';
  const cv = getPatientCursoVida(patient);
  const riesgos = getPatientGruposRiesgo(patient);
  const riesgosTxt = riesgos.length > 0 ? riesgos.map((r) => r.nombre).join(', ') : 'Sin grupo de riesgo clínico registrado (Atención Preventiva Res. 3280)';
  const prio = getPriorityMeta(getPatientCallPriority(patient));
  const edad = patient.edad !== undefined && patient.edad !== null ? `${patient.edad} años` : 'Edad registrada en HC';
  const hito = patient.accion_3280 || patient.accion3280 || contextItem?.hito || contextItem?.nombre || 'Valoración Integral Resolución 3280';
  const cups = patient.cups_3280 || patient.cups || contextItem?.cups || '890201';
  const sede = patient.ips_asignada || CALI_IPS_SEDES[0];
  const ubicacion =
    patient.zona === 'Rural'
      ? `Rural · ${patient.corregimiento || 'Santiago de Cali'}${patient.vereda ? ` (${patient.vereda})` : ''}`
      : `Urbana · ${patient.comuna || 'Santiago de Cali'}${patient.barrio ? ` - ${patient.barrio}` : ''}`;

  const directrizFinal =
    customDirective ||
    `Confirmar asistencia a ${hito} (CUPS ${cups}) en ${sede}, validando signos de alarma y continuidad clínica.`;

  const isMinorABC = ['A', 'B', 'C'].includes(String(cv?.id || '').toUpperCase()) || isMinorCursoVidaABC(patient);
  const tiempoSaludo = getTimeOfDayGreeting();
  const saludoConversacional = isMinorABC
    ? `${buildMinorAcudienteOpening(nombre)} Le habla SADI, el asistente clínico de su IPS en Santiago de Cali.`
    : `Hola! ${tiempoSaludo}, ¿me comunico con ${nombre}? Le habla SADI, el asistente clínico de su IPS en Santiago de Cali.`;

  return {
    asunto: `Guion Clínico IA · ${prio.shortLabel} · ${cv.nombre}`,
    sede,
    promptCompleto: `=== CONFIGURACIÓN DE AGENTE IA SADI (SANTIAGO DE CALI · RES. 3280) ===
• PACIENTE: ${nombre} (${patient.tipo_documento || 'CC'}: ${doc} · ${edad})
• TELÉFONO: ${tel} | UBICACIÓN: ${ubicacion}
• CURSO DE VIDA (A-G): ${cv.id}. ${cv.nombre} (${cv.rango})
• GRUPOS DE RIESGO REALES: ${riesgosTxt}
• PRIORIDAD DE COLA (TOPE 500/DÍA): ${prio.label} (${prio.rule})
• HITO CLÍNICO & CUPS: ${hito} | CUPS: ${cups}
• SEDE / IPS ASIGNADA: ${sede}
• POLÍTICA INASISTENCIA: ${NOSHOW_POLICY.resumenCorto}

--- DIRECTRIZ CLÍNICA ---
${directrizFinal}

--- GUION CONVERSACIONAL SUGERIDO ---
1. SALUDO: "${saludoConversacional}"
2. MOTIVO: "Le llamamos en el marco de la Resolución 3280 (${cv.nombre}) para agendar su ${hito} (CUPS ${cups}) en ${sede}."
3. CIERRE: "¿Desea confirmar su cita para esta semana? Presione 1 para confirmar o 2 para reprogramar."`,
  };
}

// Compatibilidad para llamadas heredadas (no inventa riesgos ni excede 500/día)
export function generateAnnualResolutionRoadmap(patients = [], year = 2026) {
  const map = {};
  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dt = new Date(year, m, d, 12, 0, 0);
      map[iso] = {
        isoDate: iso,
        dayOfMonth: d,
        isSunday: dt.getDay() === 0,
        isHoliday: COLOMBIA_HOLIDAYS.has(iso),
        callsResolucion: [],
        cursosVidaPresentes: new Set(),
        gruposRiesgoPresentes: new Set(),
        cursoCounts: {},
        riesgoCounts: {},
        priorityCounts: {},
        totalLlamadasResolucion: 0,
        llamadasAsignadas: 0,
        smsRespaldo: 0,
        cupoDisponible: DAILY_CALL_CAPACITY,
      };
    }
  }
  return map;
}

export function getCampaignFilteredPatients(patients = [], contextType, contextItem, crossItems = []) {
  return (patients || []).filter((p) => {
    const cv = getPatientCursoVida(p);
    const riesgos = getPatientGruposRiesgo(p);
    const riesgoNames = riesgos.map((r) => r.nombre);
    if (contextType === 'curso_vida') {
      if (cv.id !== contextItem?.id && cv.nombre !== contextItem?.nombre) return false;
      if (crossItems.length > 0 && !riesgoNames.some((n) => crossItems.includes(n))) return false;
      return true;
    }
    if (!riesgoNames.includes(contextItem?.nombre)) return false;
    if (crossItems.length > 0 && !crossItems.includes(cv.nombre) && !crossItems.includes(cv.id)) return false;
    return true;
  });
}

export { GRUPOS_RIESGO_CATALOG };
