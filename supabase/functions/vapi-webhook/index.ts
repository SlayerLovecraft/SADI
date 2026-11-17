import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.86.0";
import {
  classifyCallVoicemail,
  corsHeaders,
  jsonResponse,
  matchColombianVoicemailPhrase,
} from "../_shared/voicemailClassifier.ts";
import { dispatchOpenVoxSmsWithFailover } from "../_shared/openvoxSms.ts";

const requireEnv = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
};

async function terminateVapiCallImmediately(controlUrl: string) {
  try {
    const res = await fetch(controlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "end-call" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendOpenVoxFallbackSms(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  callId: string;
  patientId?: string | null;
  hospitalId?: string | null;
  phoneNumber?: string | null;
  motivo?: string | null;
}): Promise<boolean> {
  if (!params.patientId || !params.phoneNumber || params.phoneNumber === "desconocido") return false;

  const { data: pat } = await params.supabaseAdmin
    .from("patients")
    .select("name, sms_opt_in")
    .eq("patient_id", params.patientId)
    .maybeSingle();

  if (pat?.sms_opt_in === false) return false;
  const firstName = String(pat?.name || "Paciente").split(" ")[0];
  const body = `Hola ${firstName}, intentamos comunicarnos desde tu IPS SADI para tu cita de ${params.motivo || "Resolución 3280"}. Comunícate con nuestra sede para confirmar.`;

  const gw = await dispatchOpenVoxSmsWithFailover({
    supabaseAdmin: params.supabaseAdmin,
    phoneNumber: params.phoneNumber,
    message: body,
    idempotencyKey: `vapi-fallback-${params.callId}-${params.patientId}`,
    patientId: params.patientId,
    hospitalId: params.hospitalId || null,
  });
  return gw.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, 405, { error: "Method not allowed" });

  try {
    const expectedSecret = Deno.env.get("VAPI_WEBHOOK_SECRET") || "";
    if (expectedSecret) {
      const provided =
        req.headers.get("x-vapi-secret") ||
        req.headers.get("x-sadi-webhook-secret") ||
        "";
      if (provided !== expectedSecret) {
        return jsonResponse(req, 401, { ok: false, error: "Invalid webhook secret" });
      }
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const rawBody = (await req.json().catch(() => ({}))) as Record<string, any>;
    const msg = rawBody?.message ? rawBody.message : rawBody;
    const msgType = String(msg?.type || rawBody?.phase || "unknown");

    // -------------------------------------------------------------------------
    // CASO A: Evento Pre-Answer SIP 183 / Ring Timeout enviado por Asterisk ARI + OpenVox
    // Ocurre ANTES del SIP 200 OK -> Cero cobro del carrier y cero cobro a la IPS
    // -------------------------------------------------------------------------
    if (rawBody?.phase === "pre_answer_sip_183" || rawBody?.phase === "ring_timeout_before_200ok") {
      const phase = String(rawBody.phase);
      const classification = classifyCallVoicemail({
        phase,
        endedReason: rawBody.reason || phase,
        transcript: rawBody.transcript || "",
      });

      const sessionPayload = {
        vapi_call_id: rawBody.callId || `ari-${Date.now()}`,
        patient_id: rawBody.patientId || null,
        doctor_id: rawBody.doctorId || null,
        hospital_id: rawBody.hospitalId || null,
        telefono_llamado: String(rawBody.phoneNumber || "desconocido"),
        motivo_llamada: String(rawBody.motivoLlamada || "Demanda Inducida Res. 3280"),
        estado_llamada: "cancelada_pre_cobro",
        duracion_segundos: 0,
        deteccion_buzon: true,
        capa_deteccion: classification.capa,
        cobro_carrier_evitado: true,
        sip_codigo_respuesta: Number(rawBody.sipCode || 183),
        motivo_corte: String(rawBody.reason || classification.reason || phase),
        confianza_amd: rawBody.confidence != null ? Number(rawBody.confidence) : 0.96,
        facturable_ips: false,
        costo_sadi_cop: 0,
        slot_tanda: rawBody.slotTanda || null,
        transcripcion_completa: rawBody.transcript || null,
        resumen_ia: `Llamada cancelada antes de 200 OK (${classification.capa}). Cobro del carrier evitado ($0 COP).`,
        updated_at: new Date().toISOString(),
      };

      let fallbackSmsSent = false;
      if (rawBody.exhaustedTandas === true && sessionPayload.patient_id) {
        fallbackSmsSent = await sendOpenVoxFallbackSms({
          supabaseAdmin,
          callId: String(sessionPayload.vapi_call_id),
          patientId: sessionPayload.patient_id,
          hospitalId: sessionPayload.hospital_id,
          phoneNumber: sessionPayload.telefono_llamado,
          motivo: sessionPayload.motivo_llamada,
        });
      }

      const finalSessionPayload = {
        ...sessionPayload,
        fallback_sms_enviado: fallbackSmsSent,
      };

      if (finalSessionPayload.patient_id) {
        await Promise.resolve(
          supabaseAdmin
            .from("vapi_agent_sessions")
            .upsert(finalSessionPayload as any, { onConflict: "vapi_call_id" }),
        ).catch(() => null);

        await Promise.resolve(
          supabaseAdmin
            .from("ai_contact_evidence")
            .insert({
              patient_id: finalSessionPayload.patient_id,
              canal: "call_ia",
              motivo_contacto: "recordatorio_demanda_3280",
              telefono_destino: finalSessionPayload.telefono_llamado,
              duracion_segundos: 0,
              transcripcion_dialogo: rawBody.transcript ? [{ role: "carrier_early_media", text: rawBody.transcript }] : [],
              resumen_clinico_ia: finalSessionPayload.resumen_ia,
              resultado_contacto: "cancelada_pre_cobro",
              deteccion_buzon: true,
              capa_deteccion: classification.capa,
              cobro_carrier_evitado: true,
              sip_codigo_respuesta: finalSessionPayload.sip_codigo_respuesta,
              facturable_ips: false,
            } as any),
        ).catch(() => null);
      }

      return jsonResponse(req, 200, {
        ok: true,
        handled: phase,
        carrierBilled: false,
        facturableIps: false,
        fallbackSmsSent,
        action: rawBody.exhaustedTandas ? "caso_aislado_humano" : "requeue_next_tanda",
      });
    }

    // -------------------------------------------------------------------------
    // CASO B: Transcripción en vivo de Vapi (corte preventivo por controlUrl)
    // -------------------------------------------------------------------------
    if (msgType === "transcript" || msgType === "conversation-update") {
      const transcriptText = String(msg?.transcript || "");
      const role = String(msg?.role || "").toLowerCase();
      const matched = role === "user" ? matchColombianVoicemailPhrase(transcriptText) : null;
      const controlUrl = msg?.call?.monitor?.controlUrl || rawBody?.call?.monitor?.controlUrl;

      if (matched && controlUrl) {
        const terminated = await terminateVapiCallImmediately(String(controlUrl));
        return jsonResponse(req, 200, {
          ok: true,
          action: "live_voicemail_hangup",
          matchedPhrase: matched,
          terminated,
        });
      }
      return jsonResponse(req, 200, { ok: true, ignored: true });
    }

    // -------------------------------------------------------------------------
    // CASO C: Reporte definitivo de Vapi (end-of-call-report)
    // -------------------------------------------------------------------------
    if (msgType === "end-of-call-report") {
      const callObj = msg?.call || rawBody?.call || {};
      const callId = callObj?.id || null;
      const metadata = callObj?.metadata || msg?.metadata || {};
      const endedReason = String(msg?.endedReason || callObj?.endedReason || "");
      const transcript = String(msg?.transcript || msg?.artifact?.transcript || "");
      const summary = String(msg?.summary || msg?.analysis?.summary || "");
      const rawDuration = Math.max(0, Math.round(Number(msg?.durationSeconds || callObj?.durationSeconds || 0)));

      const classification = classifyCallVoicemail({
        endedReason,
        transcript,
      });

      const billableDuration = classification.isVoicemail ? 0 : rawDuration;
      const costoCalculado = classification.isVoicemail ? 0 : billableDuration * 12;

      const updateFields: Record<string, unknown> = {
        estado_llamada: classification.isVoicemail ? "buzon_cortado" : "completada",
        duracion_segundos: billableDuration,
        transcripcion_completa: transcript || null,
        resumen_ia: summary || (classification.isVoicemail ? "Contestador/buzón de voz detectado y cortado sin facturación." : null),
        deteccion_buzon: classification.isVoicemail,
        capa_deteccion: classification.isVoicemail ? classification.capa : "dtmf_human",
        cobro_carrier_evitado: false,
        sip_codigo_respuesta: 200,
        motivo_corte: classification.isVoicemail ? (classification.reason || endedReason) : endedReason || "completed",
        facturable_ips: !classification.isVoicemail && billableDuration > 0,
        costo_sadi_cop: costoCalculado,
        updated_at: new Date().toISOString(),
      };

      let fallbackSmsSent = false;
      if (
        classification.isVoicemail &&
        (metadata?.exhaustedTandas === true || rawBody?.exhaustedTandas === true) &&
        metadata?.patientId
      ) {
        fallbackSmsSent = await sendOpenVoxFallbackSms({
          supabaseAdmin,
          callId: String(callId || `vapi-${Date.now()}`),
          patientId: metadata.patientId,
          hospitalId: metadata.hospitalId || null,
          phoneNumber: String(callObj?.customer?.number || ""),
          motivo: String(metadata.motivoLlamada || "Demanda Inducida Res. 3280"),
        });
      }

      updateFields.fallback_sms_enviado = fallbackSmsSent;

      if (callId) {
        const { data: existing } = await supabaseAdmin
          .from("vapi_agent_sessions")
          .select("id, patient_id")
          .eq("vapi_call_id", callId)
          .maybeSingle();

        if (existing?.id) {
          await supabaseAdmin
            .from("vapi_agent_sessions")
            .update(updateFields)
            .eq("id", existing.id);
        } else if (metadata?.patientId) {
          await Promise.resolve(
            supabaseAdmin
              .from("vapi_agent_sessions")
              .insert({
                ...updateFields,
                vapi_call_id: callId,
                patient_id: metadata.patientId,
                doctor_id: metadata.doctorId || null,
                hospital_id: metadata.hospitalId || null,
                telefono_llamado: String(callObj?.customer?.number || "desconocido"),
                motivo_llamada: String(metadata.motivoLlamada || "Demanda Inducida Res. 3280"),
                slot_tanda: metadata.slotTanda || null,
              } as any),
          ).catch(() => null);
        }
      }

      if (metadata?.patientId) {
        await Promise.resolve(
          supabaseAdmin
            .from("ai_contact_evidence")
            .insert({
              patient_id: metadata.patientId,
              canal: "call_ia",
              motivo_contacto: "recordatorio_demanda_3280",
              telefono_destino: String(callObj?.customer?.number || "desconocido"),
              duracion_segundos: billableDuration,
              transcripcion_dialogo: transcript ? [{ role: "transcript", text: transcript }] : [],
              resumen_clinico_ia: String(updateFields.resumen_ia || "Contacto telefónico procesado"),
              resultado_contacto: classification.isVoicemail ? "buzon_cortado_sin_cobro" : "contactado_exitoso",
              deteccion_buzon: classification.isVoicemail,
              capa_deteccion: updateFields.capa_deteccion,
              cobro_carrier_evitado: false,
              sip_codigo_respuesta: 200,
              facturable_ips: Boolean(updateFields.facturable_ips),
            } as any),
        ).catch(() => null);
      }

      return jsonResponse(req, 200, {
        ok: true,
        callId,
        isVoicemail: classification.isVoicemail,
        capa: updateFields.capa_deteccion,
        facturableIps: updateFields.facturable_ips,
        costoSadiCop: costoCalculado,
      });
    }

    return jsonResponse(req, 200, { ok: true, receivedType: msgType });
  } catch (e) {
    return jsonResponse(req, 500, {
      ok: false,
      error: e instanceof Error ? e.message : "Error inesperado en vapi-webhook",
    });
  }
});
