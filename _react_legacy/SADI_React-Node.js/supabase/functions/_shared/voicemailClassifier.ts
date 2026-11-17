// ==============================================================================
// SHARED VOICEMAIL & COLOMBIAN CARRIER EARLY-MEDIA CLASSIFIER (DENO)
// ==============================================================================

export const COLOMBIAN_VOICEMAIL_PATTERNS = [
  "buzon de voz",
  "buzon de mensajes",
  "correo de voz",
  "deje su mensaje",
  "despues del tono",
  "despues de la senal",
  "luego del tono",
  "no esta disponible",
  "fuera del area",
  "fuera de cobertura",
  "su llamada esta siendo transferida",
  "transferida al correo",
  "el usuario no puede contestar",
  "el abonado no contesta",
  "en este momento no se puede comunicar",
  "numero que usted marco",
  "claro te informa",
  "movistar te informa",
  "tigo te informa",
  "wom te informa",
  "casilla de voz",
  "contestador automatico",
  "grabara su mensaje",
];

export const VOICEMAIL_ENDED_REASONS = [
  "voicemail",
  "voicemail-reached",
  "machine_start",
  "machine_end_beep",
  "machine_end_silence",
  "sip-183-voicemail-cancel",
  "ring-timeout-before-200ok",
  "early-media-voicemail-cutoff",
];

export function normalizeTextEs(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchColombianVoicemailPhrase(transcript: string): string | null {
  const norm = normalizeTextEs(transcript);
  if (!norm) return null;
  for (const pat of COLOMBIAN_VOICEMAIL_PATTERNS) {
    if (norm.includes(pat)) return pat;
  }
  return null;
}

export function classifyCallVoicemail(params: {
  endedReason?: string | null;
  transcript?: string | null;
  phase?: string | null;
}): { isVoicemail: boolean; capa: string; reason: string | null } {
  const phase = String(params.phase || "").toLowerCase();
  const ended = String(params.endedReason || "").toLowerCase();

  if (phase === "pre_answer_sip_183" || ended.includes("sip-183") || ended.includes("early-media")) {
    return {
      isVoicemail: true,
      capa: "pre_answer_sip_183",
      reason: params.endedReason || "sip-183-early-media-voicemail",
    };
  }

  if (phase === "ring_timeout_before_200ok" || ended.includes("ring-timeout-before-200ok")) {
    return {
      isVoicemail: true,
      capa: "ring_timeout_pre_answer",
      reason: params.endedReason || "ring-timeout-before-200ok",
    };
  }

  if (VOICEMAIL_ENDED_REASONS.some((r) => ended.includes(r))) {
    return {
      isVoicemail: true,
      capa: "vapi_amd_post_answer",
      reason: params.endedReason || "voicemail-reached",
    };
  }

  const phrase = matchColombianVoicemailPhrase(params.transcript || "");
  if (phrase) {
    return {
      isVoicemail: true,
      capa: "vapi_amd_post_answer",
      reason: `transcript:${phrase}`,
    };
  }

  return { isVoicemail: false, capa: "none", reason: null };
}

export function normalizePhoneE164Co(raw: string): string | null {
  const cleaned = String(raw || "").trim().replaceAll(/\s+/g, "").replaceAll(/[-().]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  const digits = cleaned.replaceAll(/\D+/g, "");
  if (digits.length === 10) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sadi-webhook-secret",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonResponse(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(req),
    },
  });
}

