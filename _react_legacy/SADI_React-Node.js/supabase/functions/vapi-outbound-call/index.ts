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

interface OutboundCallBody {
  phoneNumber: string;
  phoneNumberId?: string | null;
  gsmPort?: number | null;
  callerNumber?: string | null;
  routeMode?: "auto" | "vapi_issabel_port1" | "asterisk_preanswer" | null;
  patientId?: string | null;
  hospitalId?: string | null;
  doctorId?: string | null;
  slotTanda?: string | null;
  motivoLlamada?: string | null;
  patientData?: Record<string, unknown>;
  assistantOverrides?: Record<string, unknown>;
  antiVoicemailConfig?: AntiVoicemailOptions;
}

const DEFAULT_PORT1_PHONE_NUMBER_ID = "3e836f48-6110-410d-a340-fd625598b324";
const DEFAULT_PORT1_CALLER_NUMBER = "+573106783338";

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
        .select("name, curso_vida, birthdate, es_gestante")
        .eq("id", body.patientId)
        .maybeSingle();
      dbPatient = (pRow as Record<string, unknown> | null) || null;
    }

    const mergedPatientData: Record<string, unknown> = {
      ...(dbPatient || {}),
      ...(body.patientData || {}),
      nombre: String(body.patientData?.nombre || body.patientData?.name || dbPatient?.name || "Paciente SADI").trim(),
      curso_vida: body.patientData?.curso_vida || body.patientData?.cursoVida || dbPatient?.curso_vida || "",
      birthdate: body.patientData?.birthdate || body.patientData?.fecha_nacimiento || dbPatient?.birthdate || null,
      es_gestante: body.patientData?.es_gestante ?? dbPatient?.es_gestante ?? false,
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
    };

    const targetPhoneNumberId =
      body.phoneNumberId ||
      Deno.env.get("VAPI_PHONE_NUMBER_ID") ||
      DEFAULT_PORT1_PHONE_NUMBER_ID;
    const targetGsmPort = Number(body.gsmPort || 1);
    const targetCallerNumber = body.callerNumber || DEFAULT_PORT1_CALLER_NUMBER;

    // Opción A: Puerta de Enlace Asterisk + OpenVox directo (Early Media SIP 183 Pre-Answer antes de 200 OK -> $0 carrier)
    // Solo se usa cuando NO se solicita ruta Vapi+Issabel Puerto 1 y earlyMediaPreAnswer está habilitado.
    const ariUrl = Deno.env.get("OPENVOX_BRIDGE_URL") || Deno.env.get("ASTERISK_ARI_URL") || (dbCfg?.ari_gateway_host ? String(dbCfg.ari_gateway_host) : "");
    const useAsteriskPreAnswer =
      body.routeMode !== "vapi_issabel_port1" &&
      Boolean(ariUrl && effectiveCfg.earlyMediaPreAnswer);

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

    // Opción B: Despacho directo vía API de Vapi -> Issabel PBX (OpenVox Puerto 1: +573106783338) con Voicemail Detection nativo + Webhook SADI
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

    const vapiPayload = {
      assistantId,
      phoneNumberId,
      customer: {
        number: formattedPhone,
        name: patientFullName,
      },
      assistantOverrides: {
        ...baseOverrides,
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
        motivoLlamada: body.motivoLlamada || "Demanda Inducida Res. 3280",
      },
    };

    const vapiRes = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vapiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vapiPayload),
    });

    const vapiData = await vapiRes.json().catch(() => ({}));

    // Registrar sesión inicial si tenemos patient_id válido
    if (vapiRes.ok && body.patientId) {
      await Promise.resolve(
        supabaseAdmin
          .from("vapi_agent_sessions")
          .insert({
            vapi_call_id: vapiData?.id || null,
            patient_id: body.patientId,
            doctor_id: body.doctorId || null,
            hospital_id: body.hospitalId || null,
            telefono_llamado: formattedPhone,
            motivo_llamada: body.motivoLlamada || "Demanda Inducida Res. 3280",
            estado_llamada: "en_curso",
            capa_deteccion: "none",
            cobro_carrier_evitado: false,
            facturable_ips: true,
            slot_tanda: body.slotTanda || null,
            contexto_inyectado: {
              voicemailDetection,
              preAnswerRingTimeoutSec: effectiveCfg.preAnswerRingTimeoutSec,
            },
          } as any),
      ).catch(() => null);
    }

    return jsonResponse(req, vapiRes.ok ? 200 : vapiRes.status, {
      ok: vapiRes.ok,
      mode: "vapi_direct_with_amd",
      status: vapiRes.status,
      data: vapiData,
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
