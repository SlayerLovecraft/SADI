import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.86.0";
import {
  corsHeaders,
  jsonResponse,
  normalizePhoneE164Co,
} from "../_shared/voicemailClassifier.ts";

interface AntiVoicemailOptions {
  antiVoicemail?: boolean;
  earlyMediaPreAnswer?: boolean;
  preAnswerRingTimeoutSec?: number;
  sipCancelOn183Voicemail?: boolean;
  voicemailProvider?: "vapi" | "google" | "openai";
  backoffStartAtSeconds?: number;
  backoffFrequencySeconds?: number;
  backoffMaxRetries?: number;
  beepMaxAwaitSeconds?: number;
  voicemailAction?: "hangup_silent" | "drop_message_last_try";
}

interface CampaignCallContext {
  campaignId?: string | null;
  nombre?: string | null;
  proposito?: string | null;
  sede?: string | null;
  fecha?: string | null;
  paqueteTipo?: string | null;
  smsTexto?: string | null;
  emailAsunto?: string | null;
  emailTexto?: string | null;
  canalesActivos?: string[] | null;
}

interface OutboundCallBody {
  action?: "call" | "status" | null;
  callId?: string | null;
  phoneNumber?: string;
  phoneNumberId?: string | null;
  gsmPort?: number | null;
  callerNumber?: string | null;
  routeMode?: "auto" | "vapi_issabel_port13" | "asterisk_preanswer" | null;
  patientId?: string | null;
  hospitalId?: string | null;
  doctorId?: string | null;
  slotTanda?: string | null;
  motivoLlamada?: string | null;
  campaignContext?: CampaignCallContext | null;
  patientData?: Record<string, unknown>;
  assistantOverrides?: Record<string, unknown>;
  antiVoicemailConfig?: AntiVoicemailOptions;
}

const DEFAULT_PORT13_PHONE_NUMBER_ID = "3e836f48-6110-410d-a340-fd625598b324";
const DEFAULT_PORT13_CALLER_NUMBER = "+573106783338";

const UNANSWERED_OR_FAILED_REASONS = new Set([
  "customer-did-not-answer",
  "customer-busy",
  "voicemail",
  "voicemail-reached",
  "machine_start",
  "machine_end_beep",
  "machine_end_silence",
  "twilio-failed-to-connect-call",
  "vonage-rejected",
  "assistant-error",
  "phone-call-provider-closed-websocket",
  "sip-183-voicemail-cancel",
  "ring-timeout-before-200ok",
  "early-media-voicemail-cutoff",
  "pipeline-error-openai-llm-failed",
  "pipeline-error-eleven-labs-voice-failed",
  "call.start.error-get-transport",
  "call.start.error-sip-register",
]);

function classifyVapiLiveCall(vapiCall: Record<string, unknown>) {
  const rawStatus = String(vapiCall?.status || "queued").toLowerCase();
  const endedReason = String(vapiCall?.endedReason || "").toLowerCase();
  const endedMessage = String(vapiCall?.endedMessage || vapiCall?.error || "").trim();
  const createdAt = vapiCall?.createdAt ? String(vapiCall.createdAt) : null;
  const updatedAt = vapiCall?.updatedAt ? String(vapiCall.updatedAt) : null;
  const startedAtIso = vapiCall?.startedAt ? String(vapiCall.startedAt) : null;
  const endedAtIso = vapiCall?.endedAt ? String(vapiCall.endedAt) : null;
  const startedAt = startedAtIso ? Date.parse(startedAtIso) : NaN;
  const endedAt = endedAtIso ? Date.parse(endedAtIso) : NaN;
  let durationSeconds = Number(vapiCall?.durationSeconds ?? 0);
  if ((!Number.isFinite(durationSeconds) || durationSeconds <= 0) && Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt > startedAt) {
    durationSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  }
  const artifact = (vapiCall?.artifact || {}) as Record<string, unknown>;
  const analysis = (vapiCall?.analysis || {}) as Record<string, unknown>;
  const transport = (vapiCall?.transport || {}) as Record<string, unknown>;
  const transcript = String(vapiCall?.transcript || artifact?.transcript || "");
  const summary = String(vapiCall?.summary || analysis?.summary || "");

  const diagnostics = {
    createdAt,
    updatedAt,
    startedAt: startedAtIso,
    endedAt: endedAtIso,
    endedReasonRaw: vapiCall?.endedReason || null,
    endedMessage: endedMessage || null,
    phoneCallProvider: vapiCall?.phoneCallProvider || null,
    phoneCallProviderId: vapiCall?.phoneCallProviderId || null,
    phoneCallTransport: vapiCall?.phoneCallTransport || null,
    sipCallId: transport?.sipCallId || transport?.callSid || vapiCall?.phoneCallProviderId || null,
    phoneNumberId: vapiCall?.phoneNumberId || null,
    assistantId: vapiCall?.assistantId || null,
    customerNumber: (vapiCall?.customer as Record<string, unknown> | undefined)?.number || null,
    cost: typeof vapiCall?.cost === "number" ? vapiCall.cost : null,
    costBreakdown: vapiCall?.costBreakdown || null,
    messagesCount: Array.isArray(vapiCall?.messages)
      ? vapiCall.messages.length
      : Array.isArray(artifact?.messages)
        ? artifact.messages.length
        : null,
  };

  if (rawStatus === "queued" || rawStatus === "ringing") {
    return {
      phase: "calling" as const,
      vapiStatus: rawStatus,
      answered: false,
      isSuccess: false,
      endedReason,
      endedMessage,
      durationSeconds: 0,
      transcript,
      summary,
      diagnostics,
    };
  }

  if (rawStatus === "in-progress" || rawStatus === "forwarding") {
    return {
      phase: "in_call" as const,
      vapiStatus: rawStatus,
      answered: true,
      isSuccess: false,
      endedReason,
      endedMessage,
      durationSeconds,
      transcript,
      summary,
      diagnostics,
    };
  }

  // rawStatus === 'ended'
  const failedByReason =
    UNANSWERED_OR_FAILED_REASONS.has(endedReason) ||
    endedReason.includes("error") ||
    endedReason.includes("failed") ||
    endedReason.includes("voicemail") ||
    endedReason.includes("did-not-answer") ||
    endedReason.includes("busy") ||
    endedReason.includes("rejected");

  const wasAnswered = (Number.isFinite(startedAt) || durationSeconds > 0) && !failedByReason;

  return {
    phase: "ended" as const,
    vapiStatus: rawStatus,
    answered: wasAnswered,
    isSuccess: wasAnswered && !failedByReason,
    endedReason,
    endedMessage,
    durationSeconds: wasAnswered ? Math.max(1, durationSeconds) : 0,
    transcript,
    summary,
    diagnostics,
  };
}

const requireEnv = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeEs(val: unknown): string {
  return String(val ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getColombiaTimeOfDayGreeting(nowDate = new Date()): string {
  let hour = nowDate.getUTCHours() - 5;
  if (hour < 0) hour += 24;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      hour: "numeric",
      hour12: false,
    }).formatToParts(nowDate);
    const parsed = Number(parts.find((p) => p.type === "hour")?.value);
    if (Number.isFinite(parsed)) {
      hour = parsed === 24 ? 0 : parsed;
    }
  } catch {
    // Fallback a UTC-5 (Colombia)
  }
  if (hour < 12) return "Buenos Días";
  if (hour < 18) return "Buenas Tardes";
  return "Buena Noche";
}

function isMinorCursoABC(patientInfo: Record<string, unknown>): boolean {
  const normCurso = normalizeEs(
    patientInfo.curso_vida_key ||
      patientInfo.cursoVidaId ||
      patientInfo.curso_vida ||
      patientInfo.cursoVida ||
      patientInfo.grupo_vida ||
      "",
  );
  if (
    patientInfo.es_gestante === true ||
    normCurso === "g" ||
    normCurso.includes("materno") ||
    normCurso.includes("preventivo_mujer") ||
    normCurso.includes("preventivo de la mujer") ||
    normCurso.includes("gestan")
  ) {
    return false;
  }
  if (
    normCurso === "a" ||
    normCurso === "b" ||
    normCurso === "c" ||
    normCurso.includes("primera") ||
    normCurso.includes("infancia") ||
    normCurso.includes("adolesc")
  ) {
    return true;
  }
  const birthRaw = patientInfo.birthdate || patientInfo.fecha_nacimiento || patientInfo.birth_date;
  if (birthRaw) {
    const b = new Date(String(birthRaw));
    if (!Number.isNaN(b.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - b.getFullYear();
      const m = now.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
      if (age >= 0 && age <= 17) return true;
    }
  }
  const numEdad = Number(patientInfo.edad);
  if (patientInfo.edad !== undefined && patientInfo.edad !== null && patientInfo.edad !== "" && Number.isFinite(numEdad)) {
    return numEdad >= 0 && numEdad <= 17;
  }
  return false;
}

function buildMinorAcudienteOpening(nombrePaciente: string, tiempoSaludo: string): string {
  const cleanName = String(nombrePaciente || "el paciente").trim() || "el paciente";
  return `Hola! ${tiempoSaludo}, me comunico con la persona o acudiente responsable de ${cleanName}.`;
}

function buildVoicemailDetectionBlock(cfg: AntiVoicemailOptions) {
  if (cfg.antiVoicemail === false) {
    return { voicemailDetection: { enabled: false }, voicemailMessage: "" };
  }
  const provider = ["vapi", "google", "openai"].includes(String(cfg.voicemailProvider || "vapi"))
    ? (cfg.voicemailProvider as "vapi" | "google" | "openai")
    : "vapi";

  return {
    voicemailDetection: {
      provider,
      backoffPlan: {
        startAtSeconds: Math.max(0.5, Number(cfg.backoffStartAtSeconds) || 1.5),
        frequencySeconds: Math.max(2.5, Number(cfg.backoffFrequencySeconds) || 2.5),
        maxRetries: Math.max(1, Math.min(6, Math.round(Number(cfg.backoffMaxRetries) || 3))),
      },
      beepMaxAwaitSeconds: cfg.voicemailAction === "drop_message_last_try" ? Math.max(0, Number(cfg.beepMaxAwaitSeconds) || 5) : 0,
    },
    voicemailMessage: "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, 405, { error: "Method not allowed" });

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json().catch(() => null)) as OutboundCallBody | null;

    // -------------------------------------------------------------------------
    // ACCIÓN 'status': Polling en tiempo real del ciclo de vida de la llamada Vapi
    // (queued/ringing -> 'calling' | in-progress -> 'in_call' | ended -> 'ended')
    // -------------------------------------------------------------------------
    if (body?.action === "status") {
      const callId = String(body.callId || "").trim();
      if (!callId) {
        return jsonResponse(req, 400, { ok: false, error: "callId es obligatorio para consultar estado" });
      }
      const vapiKey = Deno.env.get("VAPI_PRIVATE_KEY") || Deno.env.get("VAPI_API_KEY");
      if (!vapiKey) {
        return jsonResponse(req, 500, { ok: false, error: "Falta VAPI_PRIVATE_KEY en Edge Functions." });
      }

      const pollStartedAt = Date.now();
      const stRes = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${vapiKey}`,
          Accept: "application/json",
        },
      });
      const vapiLatencyMs = Date.now() - pollStartedAt;
      const stData = (await stRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!stRes.ok) {
        return jsonResponse(req, stRes.status, {
          ok: false,
          status: stRes.status,
          vapiLatencyMs,
          phase: "ended",
          isSuccess: false,
          error: stData?.message || "No se pudo consultar el estado de la llamada en Vapi",
          data: stData,
        });
      }

      const classified = classifyVapiLiveCall(stData);
      return jsonResponse(req, 200, {
        ok: true,
        callId,
        status: stRes.status,
        vapiLatencyMs,
        ...classified,
      });
    }

    if (!body?.phoneNumber) {
      return jsonResponse(req, 400, { ok: false, error: "phoneNumber es obligatorio" });
    }

    const formattedPhone = normalizePhoneE164Co(body.phoneNumber);
    if (!formattedPhone) {
      return jsonResponse(req, 400, { ok: false, error: "Formato telefónico inválido (use E.164 o 10 dígitos Colombia)" });
    }

    // Verificación de permisos cuando hay doctorId indicado
    if (body.doctorId) {
      const { data: staffRow } = await supabaseAdmin
        .from("staff")
        .select("doctor_id, solo_lectura, puede_lanzar_llamadas")
        .eq("doctor_id", body.doctorId)
        .maybeSingle();

      if (staffRow && (staffRow.solo_lectura === true || staffRow.puede_lanzar_llamadas === false)) {
        return jsonResponse(req, 403, {
          ok: false,
          error: "El profesional no tiene permiso operativo para lanzar llamadas salientes.",
        });
      }
    }

    // Cargar configuración anti-buzón persistente del hospital si existe
    let dbCfg: Record<string, unknown> | null = null;
    if (body.hospitalId) {
      const { data } = await supabaseAdmin
        .from("ivr_anti_voicemail_config")
        .select("*")
        .eq("hospital_id", body.hospitalId)
        .maybeSingle();
      dbCfg = data as Record<string, unknown> | null;
    }

    const effectiveCfg: AntiVoicemailOptions = {
      antiVoicemail: body.antiVoicemailConfig?.antiVoicemail ?? (dbCfg?.anti_voicemail_enabled as boolean | undefined) ?? true,
      earlyMediaPreAnswer: body.antiVoicemailConfig?.earlyMediaPreAnswer ?? (dbCfg?.early_media_pre_answer as boolean | undefined) ?? false,
      preAnswerRingTimeoutSec: body.antiVoicemailConfig?.preAnswerRingTimeoutSec ?? (dbCfg?.pre_answer_ring_timeout_sec as number | undefined) ?? 19,
      sipCancelOn183Voicemail: body.antiVoicemailConfig?.sipCancelOn183Voicemail ?? (dbCfg?.sip_cancel_on_183_voicemail as boolean | undefined) ?? true,
      voicemailProvider: (body.antiVoicemailConfig?.voicemailProvider ?? dbCfg?.voicemail_provider ?? "vapi") as any,
      backoffStartAtSeconds: body.antiVoicemailConfig?.backoffStartAtSeconds ?? Number(dbCfg?.backoff_start_seconds || 1.5),
      backoffFrequencySeconds: body.antiVoicemailConfig?.backoffFrequencySeconds ?? Number(dbCfg?.backoff_frequency_seconds || 2.5),
      backoffMaxRetries: body.antiVoicemailConfig?.backoffMaxRetries ?? Number(dbCfg?.backoff_max_retries || 3),
      beepMaxAwaitSeconds: body.antiVoicemailConfig?.beepMaxAwaitSeconds ?? Number(dbCfg?.beep_max_await_seconds || 0),
      voicemailAction: (body.antiVoicemailConfig?.voicemailAction ?? dbCfg?.voicemail_action ?? "hangup_silent") as any,
    };

    const { voicemailDetection, voicemailMessage } = buildVoicemailDetectionBlock(effectiveCfg);
    const webhookUrl = `${supabaseUrl}/functions/v1/vapi-webhook`;
    const webhookSecret = Deno.env.get("VAPI_WEBHOOK_SECRET") || "";

    // Resolver datos clínicos del paciente desde BD (para garantizar saludo obligatorio en Cursos A, B y C)
    let dbPatient: Record<string, unknown> | null = null;
    if (body.patientId && UUID_REGEX.test(String(body.patientId))) {
      const { data: pRow } = await supabaseAdmin
        .from("patients")
        .select("name, curso_vida, birthdate, grupos_riesgo")
        .eq("patient_id", body.patientId)
        .maybeSingle();
      dbPatient = (pRow as Record<string, unknown> | null) || null;
    }

    const dbIsGestante =
      Array.isArray(dbPatient?.grupos_riesgo) &&
      dbPatient.grupos_riesgo.some((g: unknown) => String(g || "").toLowerCase().includes("materno"));

    const mergedPatientData: Record<string, unknown> = {
      ...(dbPatient || {}),
      ...(body.patientData || {}),
      nombre: String(body.patientData?.nombre || body.patientData?.name || dbPatient?.name || "Paciente SADI").trim(),
      curso_vida: body.patientData?.curso_vida || body.patientData?.cursoVida || dbPatient?.curso_vida || "",
      birthdate: body.patientData?.birthdate || body.patientData?.fecha_nacimiento || dbPatient?.birthdate || null,
      es_gestante: body.patientData?.es_gestante ?? dbIsGestante,
    };

    const tiempoSaludo = getColombiaTimeOfDayGreeting();
    const patientFullName = String(mergedPatientData.nombre || "Paciente SADI");
    const isMinorABC = isMinorCursoABC(mergedPatientData);
    const minorOpening = isMinorABC ? buildMinorAcudienteOpening(patientFullName, tiempoSaludo) : null;

    const baseOverrides = (body.assistantOverrides || {}) as Record<string, unknown>;
    const existingFirstMsg = typeof baseOverrides.firstMessage === "string" ? baseOverrides.firstMessage.trim() : "";
    const resolvedFirstMessage = isMinorABC
      ? existingFirstMsg.startsWith(minorOpening!)
        ? existingFirstMsg
        : `${minorOpening} Le habla el asistente clínico del ${String((baseOverrides.variableValues as Record<string, unknown>)?.hospital_nombre || "Hospital Central SADI")} para coordinar la atención preventiva de ${patientFullName} bajo la Resolución 3280. Por favor marque 1 si confirma la asistencia o 2 si desea reagendar.`
      : existingFirstMsg || undefined;

    const campaignCtx = body.campaignContext && typeof body.campaignContext === "object"
      ? body.campaignContext
      : null;
    const campNombre = String(campaignCtx?.nombre || "").trim();
    const campProposito = String(campaignCtx?.proposito || "").trim();
    const campSede = String(campaignCtx?.sede || "").trim();
    const campFecha = String(campaignCtx?.fecha || "").trim();
    const campSmsTexto = String(campaignCtx?.smsTexto || "").trim();
    const campEmailAsunto = String(campaignCtx?.emailAsunto || "").trim();
    const campEmailTexto = String(campaignCtx?.emailTexto || "").trim();
    const campCanales = Array.isArray(campaignCtx?.canalesActivos)
      ? campaignCtx!.canalesActivos.map((c) => String(c || "").trim()).filter(Boolean)
      : [];

    const hasCampaignDialogue = Boolean(campNombre || campProposito || campSmsTexto || campEmailTexto);
    const phoneticSafe = (txt: string) =>
      String(txt || "").replace(/Resoluci[oó]n\s*3280|Res\.?\s*3280|\b3280\b/gi, "resolución treintaidos ochenta, del dos mil dieciocho");

    const mergedVariableValues: Record<string, unknown> = {
      ...((baseOverrides.variableValues as Record<string, unknown>) || {}),
      patient_id: body.patientId || "",
      hospital_id: body.hospitalId || "",
      nombre_completo: patientFullName,
      curso_vida: String(mergedPatientData.curso_vida || ""),
      es_menor_abc: isMinorABC ? "true" : "false",
      saludo_hora: tiempoSaludo,
      saludo_inicial: minorOpening || `Hola! ${tiempoSaludo}, me comunico con ${patientFullName}.`,
      anti_voicemail: effectiveCfg.antiVoicemail ? "true" : "false",
      ring_timeout_sec: String(effectiveCfg.preAnswerRingTimeoutSec || 19),
      ...(hasCampaignDialogue
        ? {
          campana_id: String(campaignCtx?.campaignId || ""),
          campana_nombre: phoneticSafe(campNombre || body.motivoLlamada || "Campaña Preventiva SADI"),
          campana_proposito: phoneticSafe(campProposito || campSmsTexto || campEmailTexto || campNombre),
          campana_sede: campSede || String((baseOverrides.variableValues as Record<string, unknown>)?.hospital_nombre || "Hospital Central SADI"),
          campana_fecha: campFecha || new Date().toISOString().slice(0, 10),
          programa_3280: phoneticSafe(campNombre || String((baseOverrides.variableValues as Record<string, unknown>)?.programa_3280 || "Valoración Preventiva")),
        }
        : {}),
    };

    const targetPhoneNumberId =
      body.phoneNumberId ||
      Deno.env.get("VAPI_PHONE_NUMBER_ID") ||
      DEFAULT_PORT13_PHONE_NUMBER_ID;
    const targetGsmPort = Number(body.gsmPort || 13);
    const targetCallerNumber = body.callerNumber || DEFAULT_PORT13_CALLER_NUMBER;

    // Opción A: Puerta de Enlace Asterisk ARI externa (Early Media SIP 183)
    // SOLO se activa si el llamador solicita explícitamente routeMode === "asterisk_preanswer".
    // En modo normal ("vapi_issabel_port13", "auto" o por defecto) TODAS las llamadas salen directo
    // vía API de Vapi -> Issabel PBX (69.30.247.178) -> OpenVox Puerto 13 (+573106783338) con Vapi AMD nativo.
    const ariUrl = Deno.env.get("OPENVOX_BRIDGE_URL") || Deno.env.get("ASTERISK_ARI_URL") || (dbCfg?.ari_gateway_host ? String(dbCfg.ari_gateway_host) : "");
    const useAsteriskPreAnswer =
      body.routeMode === "asterisk_preanswer" &&
      Boolean(ariUrl);

    if (useAsteriskPreAnswer) {
      const ariSecret = Deno.env.get("ASTERISK_BRIDGE_SECRET") || "";
      const bridgeRes = await fetch(`${ariUrl.replace(/\/$/, "")}/sadi/preanswer-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ariSecret ? { "x-sadi-bridge-secret": ariSecret } : {}),
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          gsmPort: targetGsmPort,
          callerNumber: targetCallerNumber,
          patientId: body.patientId || null,
          hospitalId: body.hospitalId || null,
          doctorId: body.doctorId || null,
          slotTanda: body.slotTanda || null,
          ringTimeoutSeconds: effectiveCfg.preAnswerRingTimeoutSec || 19,
          cancelOn183Voicemail: effectiveCfg.sipCancelOn183Voicemail !== false,
          webhookUrl,
          webhookSecret,
          patientData: mergedPatientData,
          vapiConfig: {
            assistantId: Deno.env.get("VAPI_ASSISTANT_ID") || null,
            phoneNumberId: targetPhoneNumberId,
            ...(resolvedFirstMessage ? { firstMessage: resolvedFirstMessage } : {}),
            variableValues: mergedVariableValues,
            voicemailDetection,
            voicemailMessage,
          },
        }),
      });
      const bridgeData = await bridgeRes.json().catch(() => ({}));
      return jsonResponse(req, bridgeRes.ok ? 200 : bridgeRes.status, {
        ok: bridgeRes.ok,
        mode: "asterisk_preanswer_sip_183",
        gsmPort: targetGsmPort,
        callerNumber: targetCallerNumber,
        data: bridgeData,
        voicemailProtection: { preAnswerSip183: true, postAnswerVapi: voicemailDetection },
      });
    }

    // Opción B: Despacho directo vía API de Vapi -> Issabel PBX (OpenVox Puerto 13: +573106783338) con Voicemail Detection nativo + Webhook SADI
    const vapiKey = Deno.env.get("VAPI_PRIVATE_KEY") || Deno.env.get("VAPI_API_KEY");
    const assistantId = Deno.env.get("VAPI_ASSISTANT_ID");
    const phoneNumberId = targetPhoneNumberId;

    if (!vapiKey || !assistantId || !phoneNumberId) {
      return jsonResponse(req, 500, {
        ok: false,
        error: "Faltan secretos VAPI_PRIVATE_KEY / VAPI_ASSISTANT_ID / VAPI_PHONE_NUMBER_ID en Edge Functions.",
      });
    }

    const serverBlock: Record<string, unknown> = { url: webhookUrl };
    if (webhookSecret) serverBlock.secret = webhookSecret;

    // Si la llamada proviene de una Campaña Activa, heredamos el modelo y herramientas reales
    // del asistente en Vapi e inyectamos los detalles y propósito exactos de la campaña en el
    // system prompt para que el diálogo gire específicamente sobre esa campaña.
    let campaignModelOverride: Record<string, unknown> | undefined = undefined;
    if (hasCampaignDialogue) {
      try {
        const asstCtrl = new AbortController();
        const asstTimer = setTimeout(() => asstCtrl.abort(), 4500);
        const asstRes = await fetch(`https://api.vapi.ai/assistant/${encodeURIComponent(assistantId)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${vapiKey}`, Accept: "application/json" },
          signal: asstCtrl.signal,
        });
        clearTimeout(asstTimer);
        if (asstRes.ok) {
          const liveAssistant = (await asstRes.json().catch(() => null)) as Record<string, any> | null;
          const liveModel = liveAssistant?.model && typeof liveAssistant.model === "object"
            ? liveAssistant.model
            : null;
          const existingMessages = Array.isArray(liveModel?.messages) ? liveModel.messages : [];
          const baseSystemPrompt = String(
            existingMessages.find((m: any) => m?.role === "system")?.content || "",
          ).trim();

          const canalesTexto = campCanales.length > 0 ? campCanales.join(", ") : "Llamada telefónica, SMS y Correo electrónico";
          const campaignDirectiveBlock = [
            "==============================================================================",
            "# CAMPAÑA ACTIVA EN CURSO (PRIORIDAD MÁXIMA PARA EL DIÁLOGO DE ESTA LLAMADA)",
            "==============================================================================",
            "Esta llamada corresponde a una campaña específica lanzada para el paciente.",
            "DEBES construir el diálogo del PASO 2 y responder cualquier pregunta usando EXACTAMENTE los detalles de esta campaña:",
            `- Nombre de la Campaña: ${phoneticSafe(campNombre || "Campaña Preventiva SADI")}`,
            `- Propósito y Directriz de la Campaña: ${phoneticSafe(campProposito || "Comunicar la jornada preventiva programada y confirmar la asistencia del paciente.")}`,
            `- Sede / Lugar de Atención: ${campSede || "Hospital Central SADI"}`,
            `- Fecha Programada: ${campFecha || "Hoy"}`,
            `- Canales activos en esta campaña: ${canalesTexto}`,
            campSmsTexto ? `- Mensaje SMS exacto enviado al paciente: "${phoneticSafe(campSmsTexto)}"` : "",
            campEmailAsunto ? `- Asunto del Correo enviado al paciente: "${phoneticSafe(campEmailAsunto)}"` : "",
            campEmailTexto ? `- Detalle del Correo enviado al paciente: "${phoneticSafe(campEmailTexto)}"` : "",
            "",
            "INSTRUCCIONES OBLIGATORIAS PARA EL DIÁLOGO DE CAMPAÑA:",
            "1. Mantén el PASO 1 (saludo cordial, validación de identidad del paciente y autorización de datos con marcación 1 o 2).",
            "2. En el PASO 2, explica de forma clara, natural y concisa el PROPÓSITO EXACTO de esta campaña, mencionando el nombre de la campaña, los detalles principales descritos arriba, la sede y la fecha programada. Si también se enviaron SMS o correo electrónico, indícale brevemente que ya le llegó o le estará llegando esa misma información por mensaje de texto y correo.",
            "3. Pídele confirmar su participación/asistencia marcando 1 (o diciendo sí) o marcando 2 si requiere reprogramar.",
            "4. Si el paciente hace preguntas sobre la campaña (de qué trata, dónde es, cuándo es, qué debe hacer), respóndele usando los detalles exactos de esta campaña arriba listados, sin inventar información clínica ni diagnósticos.",
            "5. Conserva el PASO 3 (confirmación de dirección) y el PASO 4 (despedida institucional ejecutando endCall).",
            "==============================================================================",
          ].filter(Boolean).join("\n");

          const mergedSystemContent = baseSystemPrompt
            ? `${baseSystemPrompt}\n\n${campaignDirectiveBlock}`
            : campaignDirectiveBlock;

          if (liveModel?.provider && liveModel?.model) {
            campaignModelOverride = {
              ...liveModel,
              messages: [
                { role: "system", content: mergedSystemContent },
                ...existingMessages.filter((m: any) => m?.role !== "system"),
              ],
            };
          }
        }
      } catch (asstErr) {
        console.warn("No se pudo enriquecer system prompt con campaña en Vapi:", asstErr);
      }
    }

    const effectiveMotivo = hasCampaignDialogue
      ? `Campaña: ${campNombre || body.motivoLlamada || "Demanda Inducida Res. 3280"}`
      : (body.motivoLlamada || "Demanda Inducida Res. 3280");

    const vapiPayload = {
      assistantId,
      phoneNumberId,
      customer: {
        number: formattedPhone,
        name: patientFullName,
      },
      assistantOverrides: {
        ...baseOverrides,
        ...(campaignModelOverride ? { model: campaignModelOverride } : {}),
        ...(resolvedFirstMessage ? { firstMessage: resolvedFirstMessage } : {}),
        voicemailDetection,
        voicemailMessage,
        silenceTimeoutSeconds: 18,
        server: serverBlock,
        serverMessages: ["status-update", "transcript", "end-of-call-report"],
        variableValues: mergedVariableValues,
      },
      metadata: {
        patientId: body.patientId || null,
        hospitalId: body.hospitalId || null,
        doctorId: body.doctorId || null,
        slotTanda: body.slotTanda || null,
        campaignId: campaignCtx?.campaignId || null,
        campaignName: campNombre || null,
        motivoLlamada: effectiveMotivo,
      },
    };

    const vapiStartedAt = Date.now();
    const vapiRes = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vapiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vapiPayload),
    });
    const vapiLatencyMs = Date.now() - vapiStartedAt;

    const vapiRawText = await vapiRes.text().catch(() => "");
    let vapiData: Record<string, unknown> = {};
    try {
      vapiData = vapiRawText ? JSON.parse(vapiRawText) : {};
    } catch {
      vapiData = { rawText: vapiRawText.slice(0, 1000) };
    }

    // Registrar sesión inicial si tenemos patient_id válido
    let sessionInsertError: string | null = null;
    if (vapiRes.ok && body.patientId) {
      const ins = await Promise.resolve(
        supabaseAdmin
          .from("vapi_agent_sessions")
          .insert({
            vapi_call_id: (vapiData as Record<string, unknown>)?.id || null,
            patient_id: body.patientId,
            doctor_id: body.doctorId || null,
            hospital_id: body.hospitalId || null,
            telefono_llamado: formattedPhone,
            motivo_llamada: effectiveMotivo,
            estado_llamada: "en_curso",
            capa_deteccion: "none",
            cobro_carrier_evitado: false,
            facturable_ips: true,
            slot_tanda: body.slotTanda || null,
            contexto_inyectado: {
              voicemailDetection,
              preAnswerRingTimeoutSec: effectiveCfg.preAnswerRingTimeoutSec,
              ...(hasCampaignDialogue
                ? {
                  campaignId: campaignCtx?.campaignId || null,
                  campaignName: campNombre || null,
                  campaignPurpose: campProposito || null,
                  campaignSede: campSede || null,
                  campaignFecha: campFecha || null,
                  campaignDialogueInjected: Boolean(campaignModelOverride),
                }
                : {}),
            },
          } as any),
      ).catch((e) => ({ error: { message: e?.message || "insert exception" } }));
      if ((ins as { error?: { message?: string } } | null)?.error?.message) {
        sessionInsertError = (ins as { error: { message: string } }).error.message;
      }
    }

    return jsonResponse(req, vapiRes.ok ? 200 : vapiRes.status, {
      ok: vapiRes.ok,
      mode: "vapi_direct_with_amd",
      status: vapiRes.status,
      data: vapiData,
      diagnostics: {
        vapiHttpStatus: vapiRes.status,
        vapiLatencyMs,
        formattedPhone,
        phoneNumberId,
        assistantId,
        gsmPort: targetGsmPort,
        callerNumber: targetCallerNumber,
        routeMode: body.routeMode || "vapi_issabel_port13",
        isMinorABC,
        tiempoSaludo,
        webhookUrl,
        sessionInsertError,
        vapiCallId: vapiData?.id || null,
        vapiInitialStatus: vapiData?.status || null,
        phoneCallProvider: vapiData?.phoneCallProvider || null,
        phoneCallProviderId: vapiData?.phoneCallProviderId || null,
        phoneCallTransport: vapiData?.phoneCallTransport || null,
      },
      voicemailProtection: {
        preAnswerSip183: false,
        postAnswerVapi: voicemailDetection,
      },
    });
  } catch (e) {
    return jsonResponse(req, 500, {
      ok: false,
      error: e instanceof Error ? e.message : "Error inesperado en vapi-outbound-call",
    });
  }
});
