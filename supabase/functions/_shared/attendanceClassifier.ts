// ==============================================================================
// attendanceClassifier.ts - CLASIFICADOR DE RESPUESTAS DE ASISTENCIA A CAMPAÑAS
// ==============================================================================
// Clasifica respuestas en español provenientes de SMS, Llamadas IA (transcripción
// o DTMF), Correos E-mail y WhatsApp en:
//   - 'confirma_asistencia'
//   - 'no_puede_asistir'
//   - 'pendiente'
// ==============================================================================

export type AttendanceResponseStatus =
  | "confirma_asistencia"
  | "no_puede_asistir"
  | "pendiente";

export function normalizeSpanishText(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STRONG_NEGATIVE_PATTERNS: RegExp[] = [
  /\bno\s+puedo(\s+ir|\s+asistir)?\b/,
  /\bno\s+voy\b/,
  /\bno\s+asisto\b/,
  /\bno\s+asistire\b/,
  /\bno\s+ire\b/,
  /\bno\s+estare\b/,
  /\bno\s+acepto\b/,
  /\bno\s+confirmo\b/,
  /\bno\s+me\s+sirve\b/,
  /\bno\s+me\s+queda\b/,
  /\bno\s+gracias\b/,
  /\bno\s+deseo\b/,
  /\bno\s+quiero\b/,
  /\bcancel[oa]r?\b/,
  /\breprogram\w*\b/,
  /\breagend\w*\b/,
  /\bcambiar\s+(la\s+)?(fecha|cita|dia|hora)\b/,
  /\botro\s+dia\b/,
  /\bimposible\b/,
  /\bocupad[oa]\b/,
  /\bnegativo\b/,
  /\brechaz[oa]\b/,
  /\bdeclin[oa]\b/,
  /^2$/,
  /^dos$/,
  /^no$/,
  /\bmarco\s*2\b/,
  /\bopcion\s*2\b/,
  /\bkeypad\s*entry\s*2\b/,
];

const STRONG_POSITIVE_PATTERNS: RegExp[] = [
  /\bconfirmo(\s+asistencia|\s+mi\s+asistencia)?\b/,
  /\bconfirmad[oa]\b/,
  /\bacepto\b/,
  /\bpuedo\s+ir\b/,
  /\bsi\s+puedo\b/,
  /\bsi\s+voy\b/,
  /\bsi\s+asisto\b/,
  /\bsi\s+asistire\b/,
  /\basisto\b/,
  /\basistire\b/,
  /\balli\s+estare\b/,
  /\bahi\s+estare\b/,
  /\bclaro(\s+que\s+si)?\b/,
  /\bpor\s+supuesto\b/,
  /\bcon\s+gusto\b/,
  /\bde\s+acuerdo\b/,
  /\bcuenten\s+conmigo\b/,
  /\bafirmativo\b/,
  /\bpositivo\b/,
  /\bperfecto\b/,
  /\blisto\b/,
  /\bvale\b/,
  /\bok\b/,
  /\boki\b/,
  /\bexcelente\b/,
  /\bgenial\b/,
  /\byes\b/,
  /^1$/,
  /^uno$/,
  /^si$/,
  /\bsi\b/,
  /\bvoy\b/,
  /\bmarco\s*1\b/,
  /\bopcion\s*1\b/,
  /\bkeypad\s*entry\s*1\b/,
];

/**
 * Clasifica una respuesta corta (SMS, WhatsApp, Correo o turno de voz del paciente).
 * Evalúa patrones negativos ANTES que positivos para que frases como "No puedo ir"
 * o "No acepto" jamás se clasifiquen como confirmación.
 */
export function classifySingleUtterance(rawText: string): AttendanceResponseStatus {
  const norm = normalizeSpanishText(rawText);
  if (!norm) return "pendiente";

  for (const rx of STRONG_NEGATIVE_PATTERNS) {
    if (rx.test(norm)) return "no_puede_asistir";
  }
  for (const rx of STRONG_POSITIVE_PATTERNS) {
    if (rx.test(norm)) return "confirma_asistencia";
  }
  return "pendiente";
}

/**
 * Extrae las respuestas reales del paciente desde una transcripción de Vapi (`AI: ... User: ...`)
 * evitando falsos positivos del guion del agente y priorizando la respuesta de asistencia
 * (normalmente el último turno significativo del usuario tras validar identidad).
 */
export function classifyAttendanceResponse(
  rawText: string,
  options: { isTranscript?: boolean } = {},
): { status: AttendanceResponseStatus; matchedExcerpt: string } {
  const text = String(rawText || "").trim();
  if (!text) return { status: "pendiente", matchedExcerpt: "" };

  if (!options.isTranscript) {
    return {
      status: classifySingleUtterance(text),
      matchedExcerpt: text.slice(0, 280),
    };
  }

  // Separar turnos en transcripciones estilo "AI: ...\nUser: ..."
  const userTurns: string[] = [];
  const regex = /(?:^|\n)\s*(?:User|Usuario|Paciente)\s*:\s*([^\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const turn = String(m[1] || "").trim();
    if (turn) userTurns.push(turn);
  }

  if (userTurns.length === 0) {
    // Fallback si la transcripción no trae prefijo User:
    return {
      status: classifySingleUtterance(text),
      matchedExcerpt: text.slice(0, 280),
    };
  }

  // Revisar del último turno hacia atrás (la confirmación de asistencia ocurre después del saludo/identidad).
  // Si solo hubo 1 turno tipo "Hola", permanece 'pendiente'.
  const meaningfulTurns = userTurns.filter((t) => {
    const n = normalizeSpanishText(t);
    return n && !/^(hola|alo|bueno|buenas|buenos dias|buenas tardes|buenas noches|diga|si diga)$/.test(n);
  });

  if (meaningfulTurns.length === 0) {
    return { status: "pendiente", matchedExcerpt: userTurns.join(" | ").slice(0, 280) };
  }

  // Si hay >=2 turnos significativos, el primero suele ser validación de identidad ("Sí soy yo" / "1")
  // y los siguientes corresponden a la confirmación de asistencia de la campaña.
  const attendanceCandidates = meaningfulTurns.length >= 2
    ? meaningfulTurns.slice(1).reverse()
    : meaningfulTurns.slice().reverse();

  for (const turn of attendanceCandidates) {
    const st = classifySingleUtterance(turn);
    if (st !== "pendiente") {
      return { status: st, matchedExcerpt: turn.slice(0, 280) };
    }
  }

  return {
    status: "pendiente",
    matchedExcerpt: meaningfulTurns[meaningfulTurns.length - 1].slice(0, 280),
  };
}
