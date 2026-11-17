// ==============================================================================
// ANTI-VOICEMAIL & ZERO CARRIER BILLING CONFIGURATION / CLASSIFIER
// Fuente única compartida por VapiService, IvrScheduleService, BillingService y UI
// Soporta Capa 1 (Pre-Answer SIP 183 / OpenVox + Asterisk) y Capa 2 (Vapi AMD)
// ==============================================================================

export const COLOMBIAN_CARRIER_VOICEMAIL_PATTERNS = [
  'buzon de voz',
  'buzón de voz',
  'buzon de mensajes',
  'buzón de mensajes',
  'correo de voz',
  'deje su mensaje',
  'despues del tono',
  'después del tono',
  'despues de la senal',
  'después de la señal',
  'luego del tono',
  'no esta disponible',
  'no está disponible',
  'fuera del area',
  'fuera del área',
  'fuera de cobertura',
  'su llamada esta siendo transferida',
  'su llamada está siendo transferida',
  'transferida al correo',
  'el usuario no puede contestar',
  'el abonado no contesta',
  'en este momento no se puede comunicar',
  'numero que usted marco',
  'número que usted marcó',
  'claro te informa',
  'movistar te informa',
  'tigo te informa',
  'wom te informa',
  'casilla de voz',
  'contestador automatico',
  'contestador automático',
  'grabara su mensaje',
  'grabará su mensaje'
];

export const VAPI_VOICEMAIL_ENDED_REASONS = [
  'voicemail',
  'voicemail-reached',
  'machine_start',
  'machine_end_beep',
  'machine_end_silence',
  'sip-183-voicemail-cancel',
  'ring-timeout-before-200ok',
  'early-media-voicemail-cutoff'
];

export const DEFAULT_ANTI_VOICEMAIL_CONFIG = {
  antiVoicemail: true,
  earlyMediaPreAnswer: true,
  preAnswerRingTimeoutSec: 19,
  sipCancelOn183Voicemail: true,
  voicemailProvider: 'vapi', // 'vapi' | 'google' | 'openai' (sin Twilio)
  backoffStartAtSeconds: 1.5,
  backoffFrequencySeconds: 2.5, // Vapi exige mínimo 2.5s
  backoffMaxRetries: 3,
  beepMaxAwaitSeconds: 0, // Corte silencioso inmediato en 0s al confirmar contestador
  voicemailAction: 'hangup_silent', // 'hangup_silent' => voicemailMessage vacío ("")
  autoRequeueNextTanda: true,
  autoSmsFallbackOnExhausted: true
};

/**
 * Normaliza texto en español removiendo tildes para matching rápido en tiempo real.
 */
export function normalizeTranscriptText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta si una frase o transcripción parcial corresponde a buzón o contestador colombiano.
 */
export function matchColombianVoicemailPhrase(text) {
  const norm = normalizeTranscriptText(text);
  if (!norm) return null;
  for (const rawPattern of COLOMBIAN_CARRIER_VOICEMAIL_PATTERNS) {
    const pattern = normalizeTranscriptText(rawPattern);
    if (norm.includes(pattern)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Evalúa si un reporte de llamada (endedReason + transcripción) corresponde a buzón de voz.
 */
export function isVoicemailOutcome({ endedReason = '', transcript = '', estadoLlamada = '' } = {}) {
  const estado = String(estadoLlamada || '').toLowerCase();
  if (estado === 'buzon_cortado' || estado === 'cancelada_pre_cobro') {
    return { isVoicemail: true, reason: estado };
  }

  const ended = String(endedReason || '').toLowerCase();
  if (VAPI_VOICEMAIL_ENDED_REASONS.some(r => ended.includes(r))) {
    return { isVoicemail: true, reason: ended };
  }

  const matchedPhrase = matchColombianVoicemailPhrase(transcript);
  if (matchedPhrase) {
    return { isVoicemail: true, reason: `transcript:${matchedPhrase}` };
  }

  return { isVoicemail: false, reason: null };
}

/**
 * Construye el bloque oficial `voicemailDetection` de la API de Vapi.
 * Cumple la "One-Approach Rule": si antiVoicemail está activo, el corte lo ejecuta
 * el motor acústico nativo con `voicemailMessage: ""` sin colisiones con tools de prompt.
 */
export function buildVapiVoicemailDetectionConfig(cfg = {}) {
  const merged = { ...DEFAULT_ANTI_VOICEMAIL_CONFIG, ...cfg };
  if (!merged.antiVoicemail) {
    return {
      voicemailDetection: { enabled: false },
      voicemailMessage: ''
    };
  }

  const provider = ['vapi', 'google', 'openai'].includes(merged.voicemailProvider)
    ? merged.voicemailProvider
    : 'vapi';

  const freq = Math.max(2.5, Number(merged.backoffFrequencySeconds) || 2.5);
  const startAt = Math.max(0.5, Number(merged.backoffStartAtSeconds) || 1.5);
  const retries = Math.max(1, Math.min(6, Math.round(Number(merged.backoffMaxRetries) || 3)));
  const beepWait = merged.voicemailAction === 'hangup_silent'
    ? 0
    : Math.max(0, Math.min(30, Math.round(Number(merged.beepMaxAwaitSeconds) || 0)));

  return {
    voicemailDetection: {
      provider,
      backoffPlan: {
        startAtSeconds: startAt,
        frequencySeconds: freq,
        maxRetries: retries
      },
      beepMaxAwaitSeconds: beepWait
    },
    voicemailMessage: ''
  };
}

/**
 * Regla contable estricta de SADI: una sesión cortada por buzón o cancelada en pre-answer
 * NUNCA genera cobro facturable ni segundos cobrados al hospital.
 */
export function isSessionBillable(sessionRow = {}) {
  if (!sessionRow) return false;
  if (sessionRow.facturable_ips === false) return false;
  if (sessionRow.deteccion_buzon === true) return false;
  if (sessionRow.cobro_carrier_evitado === true) return false;
  const st = String(sessionRow.estado_llamada || '').toLowerCase();
  if (st === 'buzon_cortado' || st === 'cancelada_pre_cobro' || st === 'fallida' || st === 'no_contesta') {
    return false;
  }
  return st === 'completada' && Number(sessionRow.duracion_segundos || 0) > 0;
}

