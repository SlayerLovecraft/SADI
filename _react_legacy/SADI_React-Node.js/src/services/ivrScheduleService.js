// ==============================================================================
// IVR SCHEDULE SERVICE - MOTOR AUTOMÁTICO DE TANDAS SADI 3280
// Programación de llamadas salientes automáticas por tandas de 32 pacientes cada 30 minutos
// Horario operativo: 08:30 AM a 08:00 PM (24 Intervalos de 30 minutos)
// Reglas:
// 1. Asignación automática por programa de Resolución 3280 y hospital.
// 2. Opción "Reintentar hasta que conteste": si no contesta, se reasigna a la tanda siguiente por tandas sucesivas.
// 3. Si no contesta en ninguna tanda de la jornada, se envía a "Casos Aislados / Gestión Humana".
// 4. Modo de emisión: Standby (seguro) o Automático Activo.
// ==============================================================================

import { supabase } from '@/lib/supabase';
import { telemonitoringService } from './telemonitoringService';
import { getCursoVida3280, getRequiredRIASAppointments } from './rias3280Engine';
import {
  classifyPatientCursoVidaKey,
  CURSO_KEY_TO_CODE,
  CURSO_VIDA_CONFIG,
} from './cursoVidaConfig';

// Slots oficiales de tandas: 24 intervalos de 30 min desde las 08:30 AM hasta las 08:00 PM
export const IVR_TIME_SLOTS = [
  { id: 't1',  hora: '08:30 AM', label: 'Tanda 1 (08:30 AM)', horaNum: 8.5 },
  { id: 't2',  hora: '09:00 AM', label: 'Tanda 2 (09:00 AM)', horaNum: 9.0 },
  { id: 't3',  hora: '09:30 AM', label: 'Tanda 3 (09:30 AM)', horaNum: 9.5 },
  { id: 't4',  hora: '10:00 AM', label: 'Tanda 4 (10:00 AM)', horaNum: 10.0 },
  { id: 't5',  hora: '10:30 AM', label: 'Tanda 5 (10:30 AM)', horaNum: 10.5 },
  { id: 't6',  hora: '11:00 AM', label: 'Tanda 6 (11:00 AM)', horaNum: 11.0 },
  { id: 't7',  hora: '11:30 AM', label: 'Tanda 7 (11:30 AM)', horaNum: 11.5 },
  { id: 't8',  hora: '12:00 M',  label: 'Tanda 8 (12:00 M)',  horaNum: 12.0 },
  { id: 't9',  hora: '12:30 PM', label: 'Tanda 9 (12:30 PM)', horaNum: 12.5 },
  { id: 't10', hora: '01:00 PM', label: 'Tanda 10 (01:00 PM)', horaNum: 13.0 },
  { id: 't11', hora: '01:30 PM', label: 'Tanda 11 (01:30 PM)', horaNum: 13.5 },
  { id: 't12', hora: '02:00 PM', label: 'Tanda 12 (02:00 PM)', horaNum: 14.0 },
  { id: 't13', hora: '02:30 PM', label: 'Tanda 13 (02:30 PM)', horaNum: 14.5 },
  { id: 't14', hora: '03:00 PM', label: 'Tanda 14 (03:00 PM)', horaNum: 15.0 },
  { id: 't15', hora: '03:30 PM', label: 'Tanda 15 (03:30 PM)', horaNum: 15.5 },
  { id: 't16', hora: '04:00 PM', label: 'Tanda 16 (04:00 PM)', horaNum: 16.0 },
  { id: 't17', hora: '04:30 PM', label: 'Tanda 17 (04:30 PM)', horaNum: 16.5 },
  { id: 't18', hora: '05:00 PM', label: 'Tanda 18 (05:00 PM)', horaNum: 17.0 },
  { id: 't19', hora: '05:30 PM', label: 'Tanda 19 (05:30 PM)', horaNum: 17.5 },
  { id: 't20', hora: '06:00 PM', label: 'Tanda 20 (06:00 PM)', horaNum: 18.0 },
  { id: 't21', hora: '06:30 PM', label: 'Tanda 21 (06:30 PM)', horaNum: 18.5 },
  { id: 't22', hora: '07:00 PM', label: 'Tanda 22 (07:00 PM)', horaNum: 19.0 },
  { id: 't23', hora: '07:30 PM', label: 'Tanda 23 (07:30 PM)', horaNum: 19.5 },
  { id: 't24', hora: '08:00 PM', label: 'Tanda 24 (08:00 PM)', horaNum: 20.0 }
];

export const MAX_PATIENTS_PER_BATCH = 32;

const STORAGE_KEY_SCHEDULE = 'sadi_ivr_daily_schedule';
const STORAGE_KEY_CONFIG = 'sadi_ivr_config';

/**
 * Genera el guion personalizado para el agente de llamadas de la Resolución 3280
 * adaptado según el curso de vida y el hito clínico obligatorio.
 */
export const generateCallScript3280 = (patient) => {
  const cVida = (patient.cursoVida || '').toLowerCase();
  const firstName = (patient.nombre || patient.name || 'Paciente').split(' ')[0];
  const hito = patient.accion3280 || patient.programa3280 || 'valoración integral de salud';
  const hospital = 'Hospital Central SADI';

  if (cVida.includes('primera') || cVida.includes('infancia')) {
    return {
      motivo: 'Control de Crecimiento, Desarrollo y Vacunación PAI',
      saludo: `Hola, le hablamos del ${hospital}. Nos comunicamos con el acudiente de ${firstName}.`,
      mensaje: `Le recordamos que según la Ruta de Promoción y Mantenimiento de la Salud (Resolución 3280), le corresponde su cita de: ${hito}.`,
      instruccion: 'Para confirmar su asistencia a la cita programada presione 1. Para reagendar una nueva fecha presione 2.',
      textoCompleto: `Hola, le hablamos del ${hospital}. Nos comunicamos con el acudiente de ${firstName}. Le recordamos que según la Ruta de Promoción y Mantenimiento de la Salud (Resolución 3280), le corresponde su cita de: ${hito}. Para confirmar su asistencia presione 1, para reagendar presione 2.`
    };
  } else if (cVida.includes('adolescencia')) {
    return {
      motivo: 'Atención Integral del Adolescente y Salud Visual',
      saludo: `Hola ${firstName}, te saludamos del ${hospital}.`,
      mensaje: `Te contactamos para coordinar tu cita de valoración integral de la adolescencia: ${hito}.`,
      instruccion: 'Para confirmar tu asistencia presiona 1. Para reagendar presiona 2.',
      textoCompleto: `Hola ${firstName}, te saludamos del ${hospital}. Te contactamos para coordinar tu cita de valoración integral de la adolescencia: ${hito}. Para confirmar tu asistencia presiona 1, para reagendar presiona 2.`
    };
  } else if (cVida.includes('juventud')) {
    return {
      motivo: 'Salud Integral de la Juventud y Tamizaje Preventivo',
      saludo: `Hola ${firstName}, te saludamos del ${hospital}.`,
      mensaje: `Por la Ruta de Salud de la Juventud (Resolución 3280), te corresponde tu cita de: ${hito}.`,
      instruccion: 'Para confirmar tu cita presiona 1. Para reagendar presiona 2.',
      textoCompleto: `Hola ${firstName}, te saludamos del ${hospital}. Por la Ruta de Salud de la Juventud (Resolución 3280), te corresponde tu cita de: ${hito}. Para confirmar tu cita presiona 1, para reagendar presiona 2.`
    };
  } else if (cVida.includes('adultez')) {
    return {
      motivo: 'Tamizaje de Riesgo Cardiovascular y Prevención Oncológica',
      saludo: `Estimado(a) ${firstName}, le saludamos del ${hospital}.`,
      mensaje: `Nos comunicamos para su control preventivo obligatorio bajo Resolución 3280: ${hito}.`,
      instruccion: 'Para confirmar su asistencia presione 1. Para solicitar reagendamiento presione 2.',
      textoCompleto: `Estimado(a) ${firstName}, le saludamos del ${hospital}. Nos comunicamos para su control preventivo obligatorio bajo Resolución 3280: ${hito}. Para confirmar su asistencia presione 1, para solicitar reagendamiento presione 2.`
    };
  } else if (cVida.includes('vejez')) {
    return {
      motivo: 'Valoración Geriátrica Integral del Adulto Mayor',
      saludo: `Apreciado(a) ${firstName}, le saludamos con especial atención del ${hospital}.`,
      mensaje: `Le recordamos su control médico preventivo de la Ruta de la Vejez: ${hito}.`,
      instruccion: 'Para confirmar su cita presione 1. Para reagendar presiona 2.',
      textoCompleto: `Apreciado(a) ${firstName}, le saludamos con especial atención del ${hospital}. Le recordamos su control médico preventivo de la Ruta de la Vejez: ${hito}. Para confirmar su cita presione 1, para reagendar presione 2.`
    };
  } else {
    return {
      motivo: 'Ruta Materno-Perinatal y Control Prenatal',
      saludo: `Hola ${firstName}, le saludamos del ${hospital}.`,
      mensaje: `Nos comunicamos para confirmar su cita prioritaria de la Ruta Materno-Perinatal: ${hito}.`,
      instruccion: 'Para confirmar su cita presione 1. Para reagendar presiona 2.',
      textoCompleto: `Hola ${firstName}, le saludamos del ${hospital}. Nos comunicamos para confirmar su cita prioritaria de la Ruta Materno-Perinatal: ${hito}. Para confirmar su cita presione 1, para reagendar presione 2.`
    };
  }
};

export const ivrScheduleService = {
  /**
   * Obtiene la configuración del motor IVR
   */
  getConfig() {
    const defaultCfg = {
      isLiveEnabled: false, // Por defecto en Standby seguro
      batchSize: 32,
      maxRetriesPerDay: 24, // Cubre las 24 tandas del día
      retryUntilAnswered: true, // "Reintentar hasta que conteste": reintento automático por tandas sucesivas
      startSlot: '08:30 AM',
      endSlot: '08:00 PM',
      voiceId: 'pFZP5JQG7iQjIQuC4Bku',
      antiVoicemail: true,
      dtmfConfirmation: true
    };
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      return stored ? { ...defaultCfg, ...JSON.parse(stored) } : defaultCfg;
    } catch {
      return defaultCfg;
    }
  },

  /**
   * Guarda la configuración del motor
   */
  saveConfig(newConfig) {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
    return newConfig;
  },

  /**
   * Obtiene o genera el cronograma de llamadas del día actual
   */
  async getDailySchedule(hospitalId = null, forceRefresh = false) {
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(STORAGE_KEY_SCHEDULE);
        if (cached) {
          const parsed = JSON.parse(cached);
          const todayStr = new Date().toISOString().split('T')[0];
          const hasTransversalMeta =
            Array.isArray(parsed.items) &&
            (parsed.items.length === 0 || parsed.items.every(it => 'curso_vida_key' in it));
          if (parsed.fecha === todayStr && hasTransversalMeta) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Error leyendo caché de cronograma:', e);
      }
    }

    // Cargar pacientes de la base de datos
    let patients = [];
    try {
      const { data: dbPatients } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbPatients && dbPatients.length > 0) {
        patients = dbPatients;
      }
    } catch (e) {
      console.error('Error cargando pacientes de BD:', e);
    }

    if (patients.length === 0) {
      // Fallback a servicio de telemonitoreo
      patients = await telemonitoringService.getPatients();
    }

    // Distribución oficial de la Resolución 3280 a lo largo del mes
    // Regla de Oro Res. 3280: Los pacientes NO se llaman todos el mismo día, sino que
    // se distribuyen ordenadamente por días hábiles según sus hitos de control de ruta.
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const todayStr = today.toISOString().split('T')[0];

    const daysInMonth = new Date(year, month, 0).getDate();
    const workdays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      if (date.getDay() !== 0) { // Lunes a sábado
        workdays.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    }

    // Filtrar los pacientes que corresponden a la cohorte de la fecha de hoy
    let scheduledForToday = patients.filter((p, idx) => {
      const assignedDate = workdays[idx % workdays.length];
      return assignedDate === todayStr;
    });

    // Si hoy es domingo o fecha especial, asegurar una cohorte diaria de 2 a 3 pacientes
    if (scheduledForToday.length === 0) {
      const dayIdx = (today.getDate() - 1) % workdays.length;
      scheduledForToday = patients.slice(dayIdx * 2, (dayIdx * 2) + 3);
      if (scheduledForToday.length === 0) {
        scheduledForToday = patients.slice(0, 3);
      }
    }

    const scheduleItems = [];
    let currentSlotIndex = 0;
    let slotCount = 0;

    scheduledForToday.forEach((p, idx) => {
      const curso = getCursoVida3280(p.birthdate || p.fecha_nacimiento);
      const cursoKey = classifyPatientCursoVidaKey(p);
      const cursoCfg = CURSO_VIDA_CONFIG[cursoKey];
      const cursoCode = CURSO_KEY_TO_CODE[cursoKey] || 'E';
      const resolvedCursoLabel = cursoCfg?.nombre || curso.label;
      const appts = getRequiredRIASAppointments(
        p.birthdate || p.fecha_nacimiento,
        p.sex || p.sexo,
        p.program === 'Maternidad' || p.es_gestante,
        p.semana_gestacional || 0
      );

      const targetAppt = appts[0] || {
        nombre: 'Valoración Integral de Salud y Prevención 3280',
        accion: 'Consulta médica preventiva anual'
      };

      const slot = IVR_TIME_SLOTS[currentSlotIndex] || IVR_TIME_SLOTS[0];
      const callScript = generateCallScript3280({
        nombre: p.name || p.nombre,
        cursoVida: resolvedCursoLabel,
        accion3280: targetAppt.accion,
        programa3280: targetAppt.nombre
      });

      // Estados posibles: 'programada', 'confirmada', 'reagendada', 'no_contesta', 'en_reintento', 'caso_aislado_humano'
      scheduleItems.push({
        id: `ivr-item-${p.patient_id || p.id || idx}`,
        patientId: p.patient_id || p.id,
        nombre: p.name || p.nombre,
        documento: p.document || p.documento,
        telefono: p.phone || p.telefono || '3001234567',
        direccion: p.address || p.direccion || 'Calle 15 #14-112',
        ciudad: p.city || p.ciudad || 'Palmira',
        email: p.email || '',
        cursoVida: resolvedCursoLabel,
        curso_vida_key: cursoKey,
        cursoVidaId: cursoCode,
        program: p.program || p.programa || '',
        birthdate: p.birthdate || p.fecha_nacimiento || null,
        fecha_nacimiento: p.fecha_nacimiento || p.birthdate || null,
        es_gestante: Boolean(p.es_gestante),
        curso_vida: p.curso_vida || '',
        edad: curso.edad,
        programa3280: targetAppt.nombre,
        accion3280: targetAppt.accion,
        script: callScript,
        hospitalId: p.hospital_id || hospitalId,
        slotId: slot.id,
        slotHora: slot.hora,
        slotIndex: currentSlotIndex,
        estado: 'programada', // 'programada' | 'confirmada' | 'reagendada' | 'en_reintento' | 'caso_aislado_humano'
        intentos: 0,
        historialIntentos: [],
        ultimaInteraccion: null,
        resultadoDTMF: null, // '1_confirmo' | '2_reagendo' | 'no_contesto' | 'buzon'
        gestionHumana: {
          requerida: false,
          atendido: false,
          fechaGestion: null,
          responsable: null,
          notas: ''
        }
      });

      slotCount++;
      if (slotCount >= MAX_PATIENTS_PER_BATCH) {
        slotCount = 0;
        if (currentSlotIndex < IVR_TIME_SLOTS.length - 1) {
          currentSlotIndex++;
        }
      }
    });

    const scheduleData = {
      fecha: todayStr,
      hospitalId: hospitalId || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8',
      totalPacientes: scheduleItems.length,
      items: scheduleItems,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(scheduleData));
    return scheduleData;
  },

  /**
   * Simula la ejecución de una tanda específica.
   * Aplica las reglas:
   * 1. 75% contesta (marca 1 para confirmar o 2 para reagendar).
   * 2. 25% no contesta o da buzón:
   *    - Si hay tanda siguiente en el día -> SE REASIGNA A LA TANDA SIGUIENTE.
   *    - Si es la última tanda -> PASA A "CASOS AISLADOS / GESTIÓN HUMANA".
   */
  async simulateBatchExecution(slotId, itemPredicate = null) {
    const currentSchedule = await this.getDailySchedule();
    const slotIdx = IVR_TIME_SLOTS.findIndex(s => s.id === slotId);
    if (slotIdx === -1) return currentSchedule;

    const currentSlot = IVR_TIME_SLOTS[slotIdx];
    const nextSlot = IVR_TIME_SLOTS[slotIdx + 1] || null;

    let updatedCount = 0;
    let reassignedCount = 0;
    let failedToHumanCount = 0;

    currentSchedule.items = currentSchedule.items.map(item => {
      if (
        item.slotId === slotId &&
        (item.estado === 'programada' || item.estado === 'en_reintento') &&
        (!itemPredicate || itemPredicate(item))
      ) {
        updatedCount++;
        item.intentos = (item.intentos || 0) + 1;
        const nowStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        // Simulación determinista basada en el ID
        const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + item.intentos;
        const randomRoll = hash % 10;

        if (randomRoll <= 5) {
          // 60% Confirma asistencia presionando tecla 1
          item.estado = 'confirmada';
          item.resultadoDTMF = '1_confirmo';
          item.ultimaInteraccion = `${nowStr} - Confirmó asistencia pulsando tecla 1`;
          item.historialIntentos.push({
            tanda: currentSlot.hora,
            hora: nowStr,
            resultado: 'Llamada exitosa: Marcó 1 (Confirma asistencia)'
          });
        } else if (randomRoll <= 7) {
          // 20% Reagenda presionando tecla 2
          item.estado = 'reagendada';
          item.resultadoDTMF = '2_reagendo';
          item.ultimaInteraccion = `${nowStr} - Solicitó reagendamiento pulsando tecla 2`;
          item.historialIntentos.push({
            tanda: currentSlot.hora,
            hora: nowStr,
            resultado: 'Llamada exitosa: Marcó 2 (Reagenda)'
          });
        } else {
          // 20% No contesta o detecta buzón (Anti-voicemail)
          const esBuzon = randomRoll === 8;
          const causaFallo = esBuzon ? 'Detección de buzón de voz (Llamada colgada)' : 'No contesta / Línea ocupada';

          item.historialIntentos.push({
            tanda: currentSlot.hora,
            hora: nowStr,
            resultado: `Intento ${item.intentos} fallido: ${causaFallo}`
          });

          const cfg = this.getConfig();
          const shouldRetry = cfg.retryUntilAnswered ? Boolean(nextSlot) : (Boolean(nextSlot) && item.intentos < (cfg.maxRetriesPerDay || 3));

          if (shouldRetry) {
            // REASIGNAR AUTOMÁTICAMENTE A LA TANDA SIGUIENTE (POLÍTICA: REINTENTAR HASTA QUE CONTESTE)
            item.estado = 'en_reintento';
            item.slotId = nextSlot.id;
            item.slotHora = nextSlot.hora;
            item.slotIndex = slotIdx + 1;
            item.ultimaInteraccion = `${nowStr} - ${causaFallo}. Reasignado a tanda ${nextSlot.hora} (Reintento sucesivo por tanda)`;
            reassignedCount++;
          } else {
            // NO CONTESTÓ EN NINGUNA DE LAS 24 TANDAS DE LA JORNADA -> CASO AISLADO / GESTIÓN HUMANA
            item.estado = 'caso_aislado_humano';
            item.gestionHumana.requerida = true;
            item.gestionHumana.atendido = false;
            item.ultimaInteraccion = `${nowStr} - Agotó todas las tandas operativas sin contestar. Derivado a Gestión Humana`;
            failedToHumanCount++;
          }
        }
      }
      return item;
    });

    currentSchedule.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(currentSchedule));

    return {
      schedule: currentSchedule,
      stats: {
        processed: updatedCount,
        reassigned: reassignedCount,
        sentToHuman: failedToHumanCount
      }
    };
  },

  /**
   * Registra una gestión manual humana sobre un caso aislado
   */
  async recordHumanIntervention(itemId, { responsable, notas, resultado }) {
    const currentSchedule = await this.getDailySchedule();
    const item = currentSchedule.items.find(i => i.id === itemId);

    if (item) {
      item.gestionHumana.atendido = true;
      item.gestionHumana.fechaGestion = new Date().toISOString();
      item.gestionHumana.responsable = responsable || 'Personal de Enfermería / Trabajo Social';
      item.gestionHumana.notas = notas;
      item.gestionHumana.resultado = resultado;
      item.estado = resultado === 'contactado_exitoso' ? 'confirmada' : 'gestion_manual_completada';
      item.ultimaInteraccion = `Gestión Humana: ${notas} (${resultado})`;

      localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(currentSchedule));
    }

    return currentSchedule;
  },

  /**
   * Resetea el cronograma de prueba
   */
  async resetSchedule() {
    localStorage.removeItem(STORAGE_KEY_SCHEDULE);
    return await this.getDailySchedule(null, true);
  }
};
