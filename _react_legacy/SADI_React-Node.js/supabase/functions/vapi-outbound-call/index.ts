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
  patientId?: string | null;
  hospitalId?: string | null;
  doctorId?: string | null;
  slotTanda?: string | null;
  motivoLlamada?: string | null;
  patientData?: Record<string, unknown>;
  assistantOverrides?: Record<string, unknown>;
  antiVoicemailConfig?: AntiVoicemailOptions;
}

const requireEnv = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
};

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
      earlyMediaPreAnswer: body.antiVoicemailConfig?.earlyMediaPreAnswer ?? (dbCfg?.early_media_pre_answer as boolean | undefined) ?? true,
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

    // Opción A: Puerta de Enlace Asterisk + OpenVox (Early Media SIP 183 Pre-Answer antes de 200 OK -> $0 carrier)
    const ariUrl = Deno.env.get("OPENVOX_BRIDGE_URL") || Deno.env.get("ASTERISK_ARI_URL") || (dbCfg?.ari_gateway_host ? String(dbCfg.ari_gateway_host) : "");
    const useAsteriskPreAnswer = Boolean(ariUrl && effectiveCfg.earlyMediaPreAnswer);

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
          patientId: body.patientId || null,
          hospitalId: body.hospitalId || null,
          doctorId: body.doctorId || null,
          slotTanda: body.slotTanda || null,
          ringTimeoutSeconds: effectiveCfg.preAnswerRingTimeoutSec || 19,
          cancelOn183Voicemail: effectiveCfg.sipCancelOn183Voicemail !== false,
          webhookUrl,
          webhookSecret,
          patientData: body.patientData || {},
          vapiConfig: {
            assistantId: Deno.env.get("VAPI_ASSISTANT_ID") || null,
            phoneNumberId: Deno.env.get("VAPI_PHONE_NUMBER_ID") || null,
            voicemailDetection,
            voicemailMessage,
          },
        }),
      });
      const bridgeData = await bridgeRes.json().catch(() => ({}));
      return jsonResponse(req, bridgeRes.ok ? 200 : bridgeRes.status, {
        ok: bridgeRes.ok,
        mode: "asterisk_preanswer_sip_183",
        data: bridgeData,
        voicemailProtection: { preAnswerSip183: true, postAnswerVapi: voicemailDetection },
      });
    }

    // Opción B: Despacho directo vía API de Vapi con Voicemail Detection nativo + Webhook SADI
    const vapiKey = Deno.env.get("VAPI_PRIVATE_KEY") || Deno.env.get("VAPI_API_KEY");
    const assistantId = Deno.env.get("VAPI_ASSISTANT_ID");
    const phoneNumberId = Deno.env.get("VAPI_PHONE_NUMBER_ID");

    if (!vapiKey || !assistantId || !phoneNumberId) {
      return jsonResponse(req, 500, {
        ok: false,
        error: "Faltan secretos VAPI_PRIVATE_KEY / VAPI_ASSISTANT_ID / VAPI_PHONE_NUMBER_ID en Edge Functions.",
      });
    }

    const baseOverrides = (body.assistantOverrides || {}) as Record<string, unknown>;
    const serverBlock: Record<string, unknown> = { url: webhookUrl };
    if (webhookSecret) serverBlock.secret = webhookSecret;

    const vapiPayload = {
      assistantId,
      phoneNumberId,
      customer: {
        number: formattedPhone,
        name: String(body.patientData?.nombre || body.patientData?.name || "Paciente SADI"),
      },
      assistantOverrides: {
        ...baseOverrides,
        voicemailDetection,
        voicemailMessage,
        silenceTimeoutSeconds: 18,
        server: serverBlock,
        serverMessages: ["status-update", "transcript", "end-of-call-report"],
        variableValues: {
          ...((baseOverrides.variableValues as Record<string, unknown>) || {}),
          patient_id: body.patientId || "",
          hospital_id: body.hospitalId || "",
          anti_voicemail: effectiveCfg.antiVoicemail ? "true" : "false",
          ring_timeout_sec: String(effectiveCfg.preAnswerRingTimeoutSec || 19),
        },
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
