// ==============================================================================
// IVR SCHEDULE SERVICE - MOTOR AUTOMÁTICO DE TANDAS SADI 3280 (P1 -> P5)
// Programación de llamadas salientes automáticas por tandas de 25 pacientes cada 30 minutos
// Horario operativo oficial: 08:00 AM a 06:00 PM (20 Intervalos de 30 min = 500 llamadas/día)
// Reglas:
// 1. Ordenamiento estricto por prioridad clínica: P1 -> P2 -> P3 -> P4 -> P5
//    (los pacientes de mayor riesgo van en las primeras tandas; P5 sin riesgo al final del día).
// 2. Excedente sobre el tope diario de 500 llamadas (P4/P5) pasa automáticamente a
//    SMS y E-Mail de Respaldo (Reglas R1 / R2) para no dejar a ningún paciente por fuera.
// 3. Activación continua de la Resolución (solo Hospital): arranca desde la siguiente
//    tanda hábil según la hora de activación (ej. 10:20 -> arranca en 10:30) hasta apagarse.
// ==============================================================================

import { supabase } from '@/lib/supabase';
import { runWithSupabaseAuthRecovery } from '@/lib/utils';
import {
  classifyPatientCursoVidaKey,
  CURSO_KEY_TO_CODE,
  CURSO_VIDA_CONFIG,
  isMinorCursoVidaABC,
  buildMinorAcudienteOpening,
} from './cursoVidaConfig';
import { DEFAULT_ANTI_VOICEMAIL_CONFIG } from './antiVoicemailConfig';
import {
  DAILY_CALL_CAPACITY,
  getPriorityMeta,
  getPatientGruposRiesgo,
  isOperationalWorkday,
} from './callCapacityService';

// 20 Intervalos de 30 min: 08:00 AM a 05:30 PM (cubre 08:00 AM - 06:00 PM · 50 llam/h = 500/día)
export const IVR_TIME_SLOTS = [
  { id: 't1', hora: '08:00 AM', label: 'Tanda 1 (08:00 AM)', horaNum: 8.0, minutesFromMidnight: 480 },
  { id: 't2', hora: '08:30 AM', label: 'Tanda 2 (08:30 AM)', horaNum: 8.5, minutesFromMidnight: 510 },
  { id: 't3', hora: '09:00 AM', label: 'Tanda 3 (09:00 AM)', horaNum: 9.0, minutesFromMidnight: 540 },
  { id: 't4', hora: '09:30 AM', label: 'Tanda 4 (09:30 AM)', horaNum: 9.5, minutesFromMidnight: 570 },
  { id: 't5', hora: '10:00 AM', label: 'Tanda 5 (10:00 AM)', horaNum: 10.0, minutesFromMidnight: 600 },
  { id: 't6', hora: '10:30 AM', label: 'Tanda 6 (10:30 AM)', horaNum: 10.5, minutesFromMidnight: 630 },
  { id: 't7', hora: '11:00 AM', label: 'Tanda 7 (11:00 AM)', horaNum: 11.0, minutesFromMidnight: 660 },
  { id: 't8', hora: '11:30 AM', label: 'Tanda 8 (11:30 AM)', horaNum: 11.5, minutesFromMidnight: 690 },
  { id: 't9', hora: '12:00 M', label: 'Tanda 9 (12:00 M)', horaNum: 12.0, minutesFromMidnight: 720 },
  { id: 't10', hora: '12:30 PM', label: 'Tanda 10 (12:30 PM)', horaNum: 12.5, minutesFromMidnight: 750 },
  { id: 't11', hora: '01:00 PM', label: 'Tanda 11 (01:00 PM)', horaNum: 13.0, minutesFromMidnight: 780 },
  { id: 't12', hora: '01:30 PM', label: 'Tanda 12 (01:30 PM)', horaNum: 13.5, minutesFromMidnight: 810 },
  { id: 't13', hora: '02:00 PM', label: 'Tanda 13 (02:00 PM)', horaNum: 14.0, minutesFromMidnight: 840 },
  { id: 't14', hora: '02:30 PM', label: 'Tanda 14 (02:30 PM)', horaNum: 14.5, minutesFromMidnight: 870 },
  { id: 't15', hora: '03:00 PM', label: 'Tanda 15 (03:00 PM)', horaNum: 15.0, minutesFromMidnight: 900 },
  { id: 't16', hora: '03:30 PM', label: 'Tanda 16 (03:30 PM)', horaNum: 15.5, minutesFromMidnight: 930 },
  { id: 't17', hora: '04:00 PM', label: 'Tanda 17 (04:00 PM)', horaNum: 16.0, minutesFromMidnight: 960 },
  { id: 't18', hora: '04:30 PM', label: 'Tanda 18 (04:30 PM)', horaNum: 16.5, minutesFromMidnight: 990 },
  { id: 't19', hora: '05:00 PM', label: 'Tanda 19 (05:00 PM)', horaNum: 17.0, minutesFromMidnight: 1020 },
  { id: 't20', hora: '05:30 PM', label: 'Tanda 20 (05:30 PM)', horaNum: 17.5, minutesFromMidnight: 1050 },
];

export const MAX_PATIENTS_PER_BATCH = 25; // 20 tandas × 25 llamadas = 500 llamadas IA/día

const STORAGE_KEY_SCHEDULE = 'sadi_ivr_daily_schedule';
const STORAGE_KEY_CONFIG = 'sadi_ivr_config';
const SCHEDULE_SCHEMA_VERSION = 'res3280_prio_v5';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sanitizeHospitalUuid = (rawId) => {
  const s = String(rawId || '').trim();
  if (!s || s === 'hosp-001' || !UUID_REGEX.test(s)) return null;
  return s;
};

/**
 * Calcula la siguiente tanda disponible a partir de una hora dada.
 * Ejemplo: si son las 10:20 AM -> devuelve Tanda 6 (10:30 AM) y minutesUntil = 10.
 * Si ya pasó la última tanda del día (17:30) -> devuelve Tanda 1 (08:00 AM) del siguiente día hábil.
 */
export function getNextTandaSlotForTime(nowDate = new Date()) {
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const next = IVR_TIME_SLOTS.find((s) => s.minutesFromMidnight >= nowMinutes);
  if (next) {
    return {
      slot: next,
      isNextWorkday: false,
      minutesUntil: Math.max(0, next.minutesFromMidnight - nowMinutes),
    };
  }
  return {
    slot: IVR_TIME_SLOTS[0],
    isNextWorkday: true,
    minutesUntil: 24 * 60 - nowMinutes + IVR_TIME_SLOTS[0].minutesFromMidnight,
  };
}

/**
 * Resuelve la fecha operativa (YYYY-MM-DD local). Si hoy es domingo o festivo,
 * avanza al siguiente día hábil para mostrar la cola operativa real de la Res. 3280.
 */
export function resolveOperationalDateISO(baseDate = new Date()) {
  const dt = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 12, 0, 0);
  for (let i = 0; i < 10; i++) {
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (isOperationalWorkday(iso)) return iso;
    dt.setDate(dt.getDate() + 1);
  }
  return `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
}

/**
 * Genera el guion personalizado para el agente de llamadas de la Resolución 3280.
 */
export const generateCallScript3280 = (patient) => {
  const cVida = (patient.cursoVida || patient.curso_vida || '').toLowerCase();
  const fullName = String(patient.nombre || patient.name || 'Paciente').trim() || 'Paciente';
  const firstName = fullName.split(' ')[0];
  const hito = patient.accion3280 || patient.programa3280 || 'valoración integral de salud';
  const hospital = 'EPS SADI Salud';

  // Regla obligatoria Cursos de Vida A (Primera Infancia), B (Infancia) y C (Adolescencia):
  // SIEMPRE comenzar con: "Hola! <tiempo>, me comunico con la persona o acudiente responsable de <nombre_paciente>."
  if (isMinorCursoVidaABC(patient)) {
    const saludoAcudiente = buildMinorAcudienteOpening(fullName);
    const isAdolescencia = cVida.includes('adolesc') || String(patient.cursoVidaId || '').toUpperCase() === 'C' || patient.curso_vida_key === 'adolescencia';
    const motivo = isAdolescencia
      ? 'Atención Integral del Adolescente y Salud Visual'
      : 'Control de Crecimiento, Desarrollo y Vacunación PAI';
    const mensaje = `Le hablamos de ${hospital}. Le recordamos que según la Ruta de Promoción y Mantenimiento de la Salud (Resolución 3280), a ${fullName} le corresponde su cita de: ${hito}.`;
    const instruccion = 'Para confirmar su asistencia a la cita programada presione 1. Para reagendar una nueva fecha presione 2.';
    return {
      motivo,
      saludo: saludoAcudiente,
      mensaje,
      instruccion,
      textoCompleto: `${saludoAcudiente} ${mensaje} ${instruccion}`,
    };
  }
  if (cVida.includes('juventud')) {
    return {
      motivo: 'Salud Integral de la Juventud y Tamizaje Preventivo',
      saludo: `Hola ${firstName}, te saludamos de ${hospital}.`,
      mensaje: `Por la Ruta de Salud de la Juventud (Resolución 3280), te corresponde tu cita de: ${hito}.`,
      instruccion: 'Para confirmar tu cita presiona 1. Para reagendar presiona 2.',
      textoCompleto: `Hola ${firstName}, te saludamos de ${hospital}. Por la Ruta de Salud de la Juventud (Resolución 3280), te corresponde tu cita de: ${hito}. Para confirmar tu cita presiona 1, para reagendar presiona 2.`,
    };
  }
  if (cVida.includes('adultez')) {
    return {
      motivo: 'Tamizaje de Riesgo Cardiovascular y Prevención Oncológica',
      saludo: `Estimado(a) ${firstName}, le saludamos de ${hospital}.`,
      mensaje: `Nos comunicamos para su control preventivo obligatorio bajo Resolución 3280: ${hito}.`,
      instruccion: 'Para confirmar su asistencia presione 1. Para solicitar reagendamiento presione 2.',
      textoCompleto: `Estimado(a) ${firstName}, le saludamos de ${hospital}. Nos comunicamos para su control preventivo obligatorio bajo Resolución 3280: ${hito}. Para confirmar su asistencia presione 1, para solicitar reagendamiento presione 2.`,
    };
  }
  if (cVida.includes('vejez')) {
    return {
      motivo: 'Valoración Geriátrica Integral del Adulto Mayor',
      saludo: `Apreciado(a) ${firstName}, le saludamos con especial atención de ${hospital}.`,
      mensaje: `Le recordamos su control médico preventivo de la Ruta de la Vejez: ${hito}.`,
      instruccion: 'Para confirmar su cita presione 1. Para reagendar presione 2.',
      textoCompleto: `Apreciado(a) ${firstName}, le saludamos con especial atención de ${hospital}. Le recordamos su control médico preventivo de la Ruta de la Vejez: ${hito}. Para confirmar su cita presione 1, para reagendar presione 2.`,
    };
  }
  return {
    motivo: 'Ruta Materno-Perinatal y Control Prenatal',
    saludo: `Hola ${firstName}, le saludamos de ${hospital}.`,
    mensaje: `Nos comunicamos para confirmar su cita prioritaria de la Ruta Materno-Perinatal: ${hito}.`,
    instruccion: 'Para confirmar su cita presione 1. Para reagendar presione 2.',
    textoCompleto: `Hola ${firstName}, le saludamos de ${hospital}. Nos comunicamos para confirmar su cita prioritaria de la Ruta Materno-Perinatal: ${hito}. Para confirmar su cita presione 1, para reagendar presione 2.`,
  };
};

const computePatientPriorityLocal = (p) => {
  if (Number(p.prioridad_llamada) >= 1 && Number(p.prioridad_llamada) <= 5) {
    return Number(p.prioridad_llamada);
  }
  const cursoKey = classifyPatientCursoVidaKey(p);
  const riesgos = getPatientGruposRiesgo(p);
  const riesgoIds = new Set(riesgos.map((r) => Number(r.id)));
  if (cursoKey === 'preventivo_mujer' || cursoKey === 'materno_perinatal' || riesgoIds.has(1)) return 1;
  if (riesgoIds.has(3)) return 2;
  if (cursoKey === 'primera_infancia' && riesgoIds.size > 0) return 3;
  if (riesgoIds.size > 0) return 4;
  return 5;
};

const hasValidEmail = (email) => {
  const e = String(email || '').trim();
  return e.includes('@') && e.includes('.') && !e.toLowerCase().startsWith('sin');
};

export const ivrScheduleService = {
  /**
   * Obtiene la configuración del motor IVR y estado de activación de la Resolución 3280
   */
  getConfig() {
    const defaultCfg = {
      isLiveEnabled: false,
      resolutionActive: false,
      resolutionActivatedAt: null,
      resolutionStartSlotId: null,
      resolutionDispatchedByDate: {},
      batchSize: MAX_PATIENTS_PER_BATCH,
      maxRetriesPerDay: IVR_TIME_SLOTS.length,
      retryUntilAnswered: true,
      startSlot: '08:00 AM',
      endSlot: '06:00 PM',
      voiceId: 'pFZP5JQG7iQjIQuC4Bku',
      dtmfConfirmation: true,
      ...DEFAULT_ANTI_VOICEMAIL_CONFIG,
    };
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      return stored ? { ...defaultCfg, ...JSON.parse(stored) } : defaultCfg;
    } catch {
      return defaultCfg;
    }
  },

  /**
   * Guarda la configuración del motor en localStorage y persiste parámetros anti-buzón en Supabase.
   */
  saveConfig(newConfig, hospitalId = null) {
    const merged = { ...this.getConfig(), ...newConfig };
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(merged));
    if (hospitalId) {
      supabase
        .from('ivr_anti_voicemail_config')
        .upsert(
          {
            hospital_id: hospitalId,
            anti_voicemail_enabled: Boolean(merged.antiVoicemail),
            early_media_pre_answer: Boolean(merged.earlyMediaPreAnswer),
            pre_answer_ring_timeout_sec: Math.round(Number(merged.preAnswerRingTimeoutSec) || 19),
            sip_cancel_on_183_voicemail: Boolean(merged.sipCancelOn183Voicemail),
            voicemail_provider: merged.voicemailProvider || 'vapi',
            backoff_start_seconds: Number(merged.backoffStartAtSeconds) || 1.5,
            backoff_frequency_seconds: Math.max(2.5, Number(merged.backoffFrequencySeconds) || 2.5),
            backoff_max_retries: Math.round(Number(merged.backoffMaxRetries) || 3),
            beep_max_await_seconds: Math.round(Number(merged.beepMaxAwaitSeconds) || 0),
            voicemail_action: merged.voicemailAction || 'hangup_silent',
            auto_requeue_next_tanda: Boolean(merged.autoRequeueNextTanda),
            auto_sms_fallback_exhausted: Boolean(merged.autoSmsFallbackOnExhausted),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'hospital_id' }
        )
        .then(() => null)
        .catch(() => null);
    }
    return merged;
  },

  /**
   * Activa la ejecución automática continua de la Resolución 3280 desde la tanda indicada
   * (o desde la próxima tanda disponible según la hora actual, ej. 10:20 -> 10:30).
   */
  activateResolution(startSlotId = null, hospitalId = null) {
    const now = new Date();
    const nextInfo = getNextTandaSlotForTime(now);
    const resolvedSlotId = startSlotId || nextInfo.slot.id;
    return this.saveConfig(
      {
        resolutionActive: true,
        isLiveEnabled: true,
        resolutionActivatedAt: now.toISOString(),
        resolutionStartSlotId: resolvedSlotId,
      },
      hospitalId
    );
  },

  /**
   * Detiene la ejecución continua de la Resolución 3280 hasta que vuelva a activarse.
   */
  deactivateResolution(hospitalId = null) {
    return this.saveConfig(
      {
        resolutionActive: false,
        isLiveEnabled: false,
      },
      hospitalId
    );
  },

  /**
   * Marca una tanda como despachada en una fecha específica para evitar duplicados.
   */
  markSlotDispatched(dateISO, slotId) {
    const cfg = this.getConfig();
    const byDate = { ...(cfg.resolutionDispatchedByDate || {}) };
    const existing = Array.isArray(byDate[dateISO]) ? byDate[dateISO] : [];
    if (!existing.includes(slotId)) {
      byDate[dateISO] = [...existing, slotId];
    }
    return this.saveConfig({ resolutionDispatchedByDate: byDate });
  },

  /**
   * Obtiene el cronograma diario REAL de la Resolución 3280 desde Postgres
   * estrictamente ordenado por prioridad clínica (P1 -> P2 -> P3 -> P4 -> P5).
   * - Top 500 -> Cola de voz en 20 tandas de 25 pacientes (08:00 AM - 05:30 PM).
   * - Excedente > 500 (P4/P5) -> Derivación automática a SMS/E-Mail Respaldo (R1-04).
   * - Candidatos R1/R2 -> Pacientes de baja prioridad (P5 sin riesgo y P4) listos para SMS/E-Mail.
   */
  async getDailySchedule(hospitalId = null, forceRefresh = false, requestedDateISO = null) {
    const opDateISO = requestedDateISO || resolveOperationalDateISO(new Date());

    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(STORAGE_KEY_SCHEDULE);
        if (cached) {
          const parsed = JSON.parse(cached);
          // NUNCA devolver caché vacía (0 pacientes) para evitar cache poisoning ante fallos transitorios o JWT expirado
          if (
            parsed.schemaVersion === SCHEDULE_SCHEMA_VERSION &&
            parsed.fecha === opDateISO &&
            parsed.dailyCap === DAILY_CALL_CAPACITY &&
            Array.isArray(parsed.items) &&
            parsed.items.length > 0 &&
            Number(parsed.totalUniversoBD || 0) > 0 &&
            Array.isArray(parsed.alternateChannelItems)
          ) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Error leyendo caché de cronograma diario:', e);
      }
    }

    let targetHospId = sanitizeHospitalUuid(hospitalId);
    let totalUniversoBD = 0;
    let allDayRows = [];
    let dayTotalAll = 0;
    let llamadasIaCount = 0;
    let smsRespaldoCount = 0;
    let priorityCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    const fetchDayFromPostgres = async (hospUuid) => {
      const [demoRes, firstPageRes] = await Promise.all([
        runWithSupabaseAuthRecovery(
          supabase,
          () => supabase.rpc('get_dashboard_patient_demography', { p_hospital_id: hospUuid }),
          20000,
          'Timeout consultando censo BD'
        ).catch((err) => ({ data: null, error: err })),
        runWithSupabaseAuthRecovery(
          supabase,
          () =>
            supabase.rpc('get_cronograma_day_patients_paginated', {
              p_hospital_id: hospUuid,
              p_date: opDateISO,
              p_filter_type: 'all',
              p_item_key: null,
              p_doctor_cursos: null,
              p_search: null,
              p_page: 1,
              p_page_size: 200,
            }),
          25000,
          'Timeout consultando cola diaria Res. 3280'
        ),
      ]);

      let universo = 0;
      if (Array.isArray(demoRes?.data) && demoRes.data[0]?.total_patients) {
        universo = Number(demoRes.data[0].total_patients);
      }

      const d1 = firstPageRes?.data;
      if (firstPageRes?.error) {
        console.warn('Error RPC get_cronograma_day_patients_paginated:', firstPageRes.error);
      }

      let rows = [];
      let totalDay = 0;
      let llamIa = 0;
      let smsResp = 0;
      let prioMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      if (!firstPageRes?.error && d1) {
        totalDay = Number(d1.day_total_all || d1.total_count || 0);
        llamIa = Number(d1.llamadas_ia || Math.min(totalDay, DAILY_CALL_CAPACITY));
        smsResp = Number(d1.sms_respaldo || Math.max(0, totalDay - DAILY_CALL_CAPACITY));
        if (d1.priority_counts) {
          prioMap = {
            1: Number(d1.priority_counts['1'] || 0),
            2: Number(d1.priority_counts['2'] || 0),
            3: Number(d1.priority_counts['3'] || 0),
            4: Number(d1.priority_counts['4'] || 0),
            5: Number(d1.priority_counts['5'] || 0),
          };
        }
        rows = Array.isArray(d1.rows) ? [...d1.rows] : [];

        const totalPages = Math.min(4, Math.ceil(totalDay / 200));
        if (totalPages > 1) {
          const restPromises = [];
          for (let pg = 2; pg <= totalPages; pg++) {
            restPromises.push(
              runWithSupabaseAuthRecovery(
                supabase,
                () =>
                  supabase.rpc('get_cronograma_day_patients_paginated', {
                    p_hospital_id: hospUuid,
                    p_date: opDateISO,
                    p_filter_type: 'all',
                    p_item_key: null,
                    p_doctor_cursos: null,
                    p_search: null,
                    p_page: pg,
                    p_page_size: 200,
                  }),
                25000,
                `Timeout página ${pg} cola diaria`
              )
            );
          }
          const restResults = await Promise.all(restPromises);
          restResults.forEach((r) => {
            if (!r?.error && Array.isArray(r?.data?.rows)) {
              rows.push(...r.data.rows);
            }
          });
        }
      }

      return { universo, rows, totalDay, llamIa, smsResp, prioMap };
    };

    try {
      let fetched = await fetchDayFromPostgres(targetHospId);
      // Si el hospital_id de sesión vino sin pacientes (ej. alias de hospital de prueba) o falló el primer intento, reintentar con censo global (NULL)
      if (fetched.rows.length === 0 && targetHospId !== null) {
        const globalRetry = await fetchDayFromPostgres(null);
        if (globalRetry.rows.length > 0) {
          fetched = globalRetry;
          targetHospId = null;
        }
      } else if (fetched.rows.length === 0) {
        // Reintento limpio por si hubo fallo transitorio de red/JWT en arranque
        const cleanRetry = await fetchDayFromPostgres(null);
        if (cleanRetry.rows.length > 0) {
          fetched = cleanRetry;
        }
      }

      totalUniversoBD = fetched.universo;
      allDayRows = fetched.rows;
      dayTotalAll = fetched.totalDay;
      llamadasIaCount = fetched.llamIa;
      smsRespaldoCount = fetched.smsResp;
      priorityCounts = fetched.prioMap;
    } catch (e) {
      console.error('Error cargando cohorte diaria priorizada Res. 3280:', e);
    }

    // Normalizar y garantizar orden ESTRICTO por prioridad: P1 -> P2 -> P3 -> P4 -> P5
    const normalizedAll = allDayRows
      .map((p, idx) => {
        const cursoKey = classifyPatientCursoVidaKey(p);
        const cursoCfg = CURSO_VIDA_CONFIG[cursoKey];
        const cursoCode = p.curso_code || CURSO_KEY_TO_CODE[cursoKey] || 'E';
        const resolvedCursoLabel = cursoCfg?.nombre || p.curso_vida || 'Adultez';
        const prioridad = computePatientPriorityLocal(p);
        const prioMeta = getPriorityMeta(prioridad);
        const riesgosArr = Array.isArray(p.grupos_riesgo) ? p.grupos_riesgo.filter(Boolean) : [];
        const accion3280 = p.accion_3280 || 'Valoración Integral Res. 3280';
        const cups3280 = p.cups_3280 || '890201';
        const emailVal = String(p.email || '').trim();
        const emailValid = hasValidEmail(emailVal);

        const callScript = generateCallScript3280({
          nombre: p.name || p.nombre,
          cursoVida: resolvedCursoLabel,
          curso_vida: p.curso_vida || cursoKey,
          curso_vida_key: cursoKey,
          cursoVidaId: cursoCode,
          birthdate: p.birthdate || null,
          edad: p.edad ?? null,
          accion3280,
          programa3280: accion3280,
        });

        return {
          id: `ivr-item-${p.patient_id || p.id || idx}`,
          patientId: p.patient_id || p.id,
          nombre: p.name || p.nombre || 'Paciente sin nombre',
          documento: p.document || p.documento || 'N/A',
          tipo_documento: p.tipo_documento || 'CC',
          telefono: p.phone || p.telefono || 'Sin teléfono',
          email: emailVal,
          hasValidEmail: emailValid,
          direccion: p.address || p.direccion || 'Santiago de Cali',
          ciudad: p.city || p.ciudad || 'Santiago de Cali',
          zona: p.zona || 'Urbana',
          comuna: p.comuna || '',
          barrio: p.barrio || '',
          cursoVida: resolvedCursoLabel,
          curso_vida_key: cursoKey,
          cursoVidaId: cursoCode,
          curso_vida: p.curso_vida || cursoKey,
          grupo_riesgo: p.grupo_riesgo || null,
          grupos_riesgo: riesgosArr,
          program: p.program || p.programa || '',
          birthdate: p.birthdate || null,
          fecha_nacimiento: p.birthdate || null,
          edad: Number(p.edad ?? 0),
          programa3280: accion3280,
          accion3280,
          cups: cups3280,
          prioridad,
          prioridadLabel: prioMeta.shortLabel,
          prioridadCode: prioMeta.code,
          canalAsignado: p.canal_asignado || 'Llamada IA (Voz)',
          globalRank: Number(p.global_rank || idx + 1),
          script: callScript,
          hospitalId: p.hospital_id || targetHospId || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8',
          estado: 'programada',
          intentos: 0,
          historialIntentos: [],
          ultimaInteraccion: null,
          resultadoDTMF: null,
          gestionHumana: {
            requerida: false,
            atendido: false,
            fechaGestion: null,
            responsable: null,
            notas: '',
          },
        };
      })
      .sort((a, b) => {
        if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
        if (a.globalRank !== b.globalRank) return a.globalRank - b.globalRank;
        return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
      });

    // Top 500 entran a las 20 Tandas de Voz (25 por tanda, en orden estricto P1 -> P5)
    const voiceQueue = normalizedAll.slice(0, DAILY_CALL_CAPACITY);
    const overflowQueue = normalizedAll.slice(DAILY_CALL_CAPACITY);

    const scheduleItems = voiceQueue.map((item, idx) => {
      const slotIdx = Math.min(Math.floor(idx / MAX_PATIENTS_PER_BATCH), IVR_TIME_SLOTS.length - 1);
      const slot = IVR_TIME_SLOTS[slotIdx] || IVR_TIME_SLOTS[0];
      return {
        ...item,
        ordenCola: idx + 1,
        canalAsignado: 'Llamada IA (Voz)',
        slotId: slot.id,
        slotHora: slot.hora,
        slotIndex: slotIdx,
      };
    });

    // Lista R1 / R2: Desborde (>500) primero, luego todos los candidatos de baja prioridad (P5 primero, luego P4)
    const buildAltRecord = (item, isOverflow) => {
      const canalAlterno = item.hasValidEmail ? 'SMS (R1) + E-Mail (R2)' : 'SMS (R1)';
      const regla = isOverflow
        ? 'R1-04 · Desborde > 500 llamadas'
        : item.prioridad === 5
        ? 'R1 / R2 · Baja Prioridad (P5 Sin Riesgo)'
        : 'R1 / R2 · Respaldo Secundario (P4 Crónicos)';
      const estadoAlterno = isOverflow ? 'desborde_activo' : 'respaldo_disponible';
      return {
        ...item,
        isOverflow,
        canalAlterno,
        reglaAlterna: regla,
        estadoAlterno,
      };
    };

    const overflowAlt = overflowQueue.map((it) => buildAltRecord(it, true));
    const lowPrioInVoice = scheduleItems
      .filter((it) => it.prioridad >= 4)
      .sort((a, b) => b.prioridad - a.prioridad || b.ordenCola - a.ordenCola) // P5 primero (los últimos de la cola de voz son los primeros en pasar a SMS/E-Mail si falta cupo)
      .map((it) => buildAltRecord(it, false));

    const alternateChannelItems = [...overflowAlt, ...lowPrioInVoice];

    // Recalcular priorityCounts si vino vacío
    if (Object.values(priorityCounts).every((v) => v === 0) && normalizedAll.length > 0) {
      normalizedAll.forEach((it) => {
        priorityCounts[it.prioridad] = (priorityCounts[it.prioridad] || 0) + 1;
      });
    }

    const scheduleData = {
      schemaVersion: SCHEDULE_SCHEMA_VERSION,
      fecha: opDateISO,
      dailyCap: DAILY_CALL_CAPACITY,
      hospitalId: targetHospId || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8',
      totalUniversoBD: totalUniversoBD || normalizedAll.length,
      dayTotalAll: dayTotalAll || normalizedAll.length,
      llamadasIaCount: llamadasIaCount || scheduleItems.length,
      smsRespaldoCount: smsRespaldoCount || overflowAlt.length,
      totalPacientes: scheduleItems.length,
      priorityCounts,
      items: scheduleItems,
      overflowItems: overflowAlt,
      alternateChannelItems,
      updatedAt: new Date().toISOString(),
    };

    // Solo cachear en localStorage cuando hay datos reales válidos (evita envenenamiento de caché con 0 pacientes)
    if (scheduleItems.length > 0 && totalUniversoBD > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(scheduleData));
      } catch (e) {
        console.warn('No se pudo cachear agenda diaria en localStorage:', e);
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY_SCHEDULE);
      } catch {}
    }
    return scheduleData;
  },

  /**
   * Ejecuta una tanda específica en orden P1 -> P5 (invocado automáticamente por el
   * motor continuo de la Resolución cuando llega la hora de la tanda).
   */
  async simulateBatchExecution(slotId, itemPredicate = null) {
    const currentSchedule = await this.getDailySchedule();
    const slotIdx = IVR_TIME_SLOTS.findIndex((s) => s.id === slotId);
    if (slotIdx === -1) return { schedule: currentSchedule, stats: { processed: 0, reassigned: 0, sentToHuman: 0, voicemailCuts: 0, preAnswerSaved: 0 } };

    const currentSlot = IVR_TIME_SLOTS[slotIdx];
    const nextSlot = IVR_TIME_SLOTS[slotIdx + 1] || null;

    let updatedCount = 0;
    let reassignedCount = 0;
    let failedToHumanCount = 0;
    let voicemailCutCount = 0;
    let preAnswerSavedCount = 0;
    const cfg = this.getConfig();

    currentSchedule.items = currentSchedule.items.map((item) => {
      if (
        item.slotId === slotId &&
        (item.estado === 'programada' || item.estado === 'en_reintento') &&
        (!itemPredicate || itemPredicate(item))
      ) {
        updatedCount++;
        item.intentos = (item.intentos || 0) + 1;
        const nowStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + item.intentos;
        const randomRoll = hash % 10;

        if (randomRoll <= 5) {
          item.estado = 'confirmada';
          item.resultadoDTMF = '1_confirmo';
          item.cobroEvitado = false;
          item.capaDeteccion = 'dtmf_human';
          item.costoFacturaCop = null;
          item.ultimaInteraccion = `${nowStr} - Confirmó asistencia pulsando tecla 1`;
          item.historialIntentos.push({
            tanda: currentSlot.hora,
            hora: nowStr,
            resultado: 'Llamada exitosa: Marcó 1 (Confirma asistencia)',
          });
        } else if (randomRoll <= 7) {
          item.estado = 'reagendada';
          item.resultadoDTMF = '2_reagendo';
          item.cobroEvitado = false;
          item.capaDeteccion = 'dtmf_human';
          item.costoFacturaCop = null;
          item.ultimaInteraccion = `${nowStr} - Solicitó reagendamiento pulsando tecla 2`;
          item.historialIntentos.push({
            tanda: currentSlot.hora,
            hora: nowStr,
            resultado: 'Llamada exitosa: Marcó 2 (Reagenda)',
          });
        } else {
          const esBuzon = randomRoll === 8;
          const esPreAnswer183 = esBuzon && Boolean(cfg.earlyMediaPreAnswer);
          const capa = esPreAnswer183
            ? 'pre_answer_sip_183'
            : esBuzon
            ? 'vapi_amd_post_answer'
            : 'ring_timeout_pre_answer';
          if (esBuzon) {
            voicemailCutCount++;
            if (esPreAnswer183) preAnswerSavedCount++;
          } else if (cfg.earlyMediaPreAnswer) {
            preAnswerSavedCount++;
          }

          const causaFallo = esPreAnswer183
            ? 'Corte SIP 183 Early Media previo a 200 OK ($0 carrier)'
            : esBuzon
            ? 'Corte Vapi AMD al detectar buzón ($0 factura)'
            : `Timeout previo a buzón (${cfg.preAnswerRingTimeoutSec || 19}s · SIP CANCEL)`;

          item.resultadoDTMF = 'buzon';
          item.deteccionBuzon = esBuzon;
          item.cobroEvitado = Boolean(esPreAnswer183 || cfg.earlyMediaPreAnswer);
          item.capaDeteccion = capa;
          item.costoFacturaCop = 0;

          item.historialIntentos.push({
            tanda: currentSlot.hora,
            hora: nowStr,
            capa,
            costoCop: 0,
            resultado: `Intento ${item.intentos}: ${causaFallo}`,
          });

          const autoRetryEnabled = cfg.retryUntilAnswered || cfg.autoRequeueNextTanda;
          const shouldRetry = autoRetryEnabled
            ? Boolean(nextSlot)
            : Boolean(nextSlot) && item.intentos < (cfg.maxRetriesPerDay || 3);

          if (shouldRetry) {
            item.estado = 'en_reintento';
            item.slotId = nextSlot.id;
            item.slotHora = nextSlot.hora;
            item.slotIndex = slotIdx + 1;
            item.ultimaInteraccion = `${nowStr} - ${causaFallo}. Reasignado a tanda ${nextSlot.hora} ($0 COP)`;
            reassignedCount++;
          } else {
            item.estado = 'caso_aislado_humano';
            item.gestionHumana.requerida = true;
            item.gestionHumana.atendido = false;
            item.fallbackSmsPendiente = Boolean(cfg.autoSmsFallbackOnExhausted);
            item.ultimaInteraccion = `${nowStr} - Agotó tandas (${causaFallo}). Derivado a Gestión Humana${cfg.autoSmsFallbackOnExhausted ? ' + Respaldo SMS/WA' : ''}`;
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
        sentToHuman: failedToHumanCount,
        voicemailCuts: voicemailCutCount,
        preAnswerSaved: preAnswerSavedCount,
      },
    };
  },

  /**
   * Registra un evento en vivo de corte por buzón de voz (Pre-Answer SIP 183 o Vapi AMD)
   */
  async applyVoicemailCutoffToSchedule(patientIdOrPhone, { capaDeteccion = 'pre_answer_sip_183', reason = 'voicemail-cutoff' } = {}) {
    const currentSchedule = await this.getDailySchedule();
    const cfg = this.getConfig();
    const cleanPhone = String(patientIdOrPhone || '').replace(/\D/g, '').slice(-10);
    const nowStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    let matchedItem = null;

    currentSchedule.items = currentSchedule.items.map((item) => {
      const itemPhone = String(item.telefono || '').replace(/\D/g, '').slice(-10);
      const isMatch =
        String(item.patientId) === String(patientIdOrPhone) ||
        (cleanPhone && itemPhone === cleanPhone);
      if (!isMatch) return item;

      const curSlotIdx = IVR_TIME_SLOTS.findIndex((s) => s.id === item.slotId);
      const nextSlot = curSlotIdx >= 0 ? IVR_TIME_SLOTS[curSlotIdx + 1] || null : null;
      item.intentos = (item.intentos || 0) + 1;
      item.deteccionBuzon = true;
      item.resultadoDTMF = 'buzon';
      item.capaDeteccion = capaDeteccion;
      item.cobroEvitado = capaDeteccion !== 'vapi_amd_post_answer';
      item.costoFacturaCop = 0;

      item.historialIntentos = [
        ...(item.historialIntentos || []),
        {
          tanda: item.slotHora || 'En vivo',
          hora: nowStr,
          capa: capaDeteccion,
          costoCop: 0,
          resultado: `Corte anti-buzón (${capaDeteccion}): ${reason} · $0 COP`,
        },
      ];

      if (nextSlot && (cfg.retryUntilAnswered || cfg.autoRequeueNextTanda)) {
        item.estado = 'en_reintento';
        item.slotId = nextSlot.id;
        item.slotHora = nextSlot.hora;
        item.slotIndex = curSlotIdx + 1;
        item.ultimaInteraccion = `${nowStr} - Buzón cortado sin cobro (${capaDeteccion}). Reasignado a ${nextSlot.hora}`;
      } else {
        item.estado = 'caso_aislado_humano';
        item.gestionHumana.requerida = true;
        item.gestionHumana.atendido = false;
        item.fallbackSmsPendiente = Boolean(cfg.autoSmsFallbackOnExhausted);
        item.ultimaInteraccion = `${nowStr} - Buzón cortado sin cobro; agotó tandas -> Gestión Humana`;
      }
      matchedItem = item;
      return item;
    });

    currentSchedule.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(currentSchedule));
    return { schedule: currentSchedule, updatedItem: matchedItem };
  },

  /**
   * Registra una gestión manual humana sobre un caso aislado
   */
  async recordHumanIntervention(itemId, { responsable, notas, resultado }) {
    const currentSchedule = await this.getDailySchedule();
    const item = currentSchedule.items.find((i) => i.id === itemId);

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
   * Resetea el cronograma diario cacheado y recarga desde Postgres
   */
  async resetSchedule(hospitalId = null) {
    localStorage.removeItem(STORAGE_KEY_SCHEDULE);
    return await this.getDailySchedule(hospitalId, true);
  },
};
