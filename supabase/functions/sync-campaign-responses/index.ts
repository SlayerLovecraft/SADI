import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.86.0";
import {
  classifyAttendanceResponse,
  type AttendanceResponseStatus,
} from "../_shared/attendanceClassifier.ts";

const corsHeaders = (req: Request) => {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

const jsonResponse = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(req),
    },
  });

const redirectResponse = (location: string) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });

function normalizePhone10(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length >= 10) return d.slice(-10);
  return d;
}

function normalizePhoneE164Co(raw: string): string {
  const last10 = normalizePhone10(raw);
  if (last10.length === 10 && last10.startsWith("3")) return `+57${last10}`;
  const clean = String(raw || "").trim();
  return clean.startsWith("+") ? clean : (last10 ? `+57${last10}` : "");
}

function parseOpenVoxTimeToIso(rawTime: string): string {
  // OpenVox guarda hora local Colombia (UTC-5) en formato "YYYY/MM/DD HH:MM:SS"
  const m = String(rawTime || "").trim().match(/^(\d{4})[\/-](\d{2})[\/-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}-05:00`;
  }
  const parsed = Date.parse(String(rawTime || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(req) });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse(req, 500, { ok: false, error: "Faltan credenciales de Supabase en Edge Function" });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------------------------------------------------------------------------
  // 1. REDIRECCIÓN LEGACY (GET) PARA CORREOS YA ENVIADOS -> REDIRIGE A PORTAL OFICIAL SADI
  //    (Supabase Edge Functions convierte text/html en text/plain por seguridad,
  //     por eso redirigimos con HTTP 302 a https://sadi.apropiatic.com.co/confirmar-asistencia)
  // ---------------------------------------------------------------------------
  if (req.method === "GET") {
    const publicAppUrl = (Deno.env.get("SADI_PUBLIC_APP_URL") || "https://sadi.apropiatic.com.co")
      .trim()
      .replace(/\/$/, "");
    const url = new URL(req.url);
    const action = String(url.searchParams.get("action") || "").toLowerCase();
    const traceId = String(url.searchParams.get("traceId") || "").trim();

    if (!traceId || !["confirm", "decline"].includes(action)) {
      return redirectResponse(`${publicAppUrl}/confirmar-asistencia?result=invalid`);
    }

    const nextStatus: AttendanceResponseStatus = action === "confirm" ? "confirma_asistencia" : "no_puede_asistir";
    const nowIso = new Date().toISOString();
    const { data: updatedRow, error } = await supabaseAdmin
      .from("campaign_channel_traceability")
      .update({
        response_status: nextStatus,
        response_raw: action === "confirm" ? "Confirma asistencia (clic en correo)" : "No puede asistir (clic en correo)",
        responded_at: nowIso,
        received_at: nowIso,
        updated_at: nowIso,
      } as any)
      .eq("id", traceId)
      .select("campaign_name")
      .maybeSingle();

    if (error) {
      return redirectResponse(`${publicAppUrl}/confirmar-asistencia?result=error`);
    }

    const qs = new URLSearchParams({
      result: action === "confirm" ? "confirmed" : "declined",
      traceId,
    });
    return redirectResponse(`${publicAppUrl}/confirmar-asistencia?${qs.toString()}`);
  }

  if (req.method !== "POST") return jsonResponse(req, 405, { error: "Method not allowed" });

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const action = String(body.action || "sync").toLowerCase();
    const onlyDocument = String(body.onlyDocument || "").trim();
    const campaignIdFilter = String(body.campaignId || "").trim();
    const hospitalId = String(body.hospitalId || "").trim() || null;

    // -------------------------------------------------------------------------
    // 1B. CONFIRMACIÓN / RECHAZO DESDE PORTAL OFICIAL (/confirmar-asistencia)
    // -------------------------------------------------------------------------
    if (action === "email_click") {
      const decision = String(body.decision || "").toLowerCase();
      const traceId = String(body.traceId || "").trim();
      if (!traceId || !["confirm", "decline"].includes(decision)) {
        return jsonResponse(req, 400, { ok: false, error: "Parámetros de confirmación inválidos." });
      }
      const nextStatus: AttendanceResponseStatus = decision === "confirm" ? "confirma_asistencia" : "no_puede_asistir";
      const nowIso = new Date().toISOString();
      const { data: updatedRow, error } = await supabaseAdmin
        .from("campaign_channel_traceability")
        .update({
          response_status: nextStatus,
          response_raw: decision === "confirm" ? "Confirma asistencia (botón en correo)" : "No puede asistir (botón en correo)",
          responded_at: nowIso,
          received_at: nowIso,
          updated_at: nowIso,
        } as any)
        .eq("id", traceId)
        .select("id, campaign_name, response_status, responded_at")
        .maybeSingle();

      if (error || !updatedRow) {
        return jsonResponse(req, error ? 500 : 404, {
          ok: false,
          error: error?.message || "No encontramos el registro de esta invitación.",
        });
      }

      return jsonResponse(req, 200, {
        ok: true,
        status: updatedRow.response_status,
        campaignName: updatedRow.campaign_name || "",
        respondedAt: updatedRow.responded_at,
      });
    }

    // -------------------------------------------------------------------------
    // 2. INGESTA DIRECTA DE WEBHOOK (WhatsApp, Correo entrante o SMS)
    // -------------------------------------------------------------------------
    if (action === "inbound_webhook") {
      const channel = String(body.channel || "sms").toLowerCase();
      if (!["sms", "whatsapp", "email", "call"].includes(channel)) {
        return jsonResponse(req, 400, { ok: false, error: "Canal inválido" });
      }
      const rawDest = String(body.from || body.contactDestination || "").trim();
      const rawText = String(body.text || body.message || "").trim();
      const cls = classifyAttendanceResponse(rawText, { isTranscript: channel === "call" });
      const nowIso = new Date().toISOString();
      const receivedIso = body.receivedAt ? String(body.receivedAt) : nowIso;

      let query = supabaseAdmin
        .from("campaign_channel_traceability")
        .select("*")
        .eq("channel", channel)
        .order("sent_at", { ascending: false })
        .limit(20);

      if (body.campaignId) query = query.eq("campaign_id", String(body.campaignId));

      const { data: candidates } = await query;
      const destKey = channel === "email" ? rawDest.toLowerCase() : normalizePhone10(rawDest);
      const matched = (candidates || []).find((row: any) => {
        const rowDest = channel === "email"
          ? String(row.contact_destination || "").trim().toLowerCase()
          : normalizePhone10(String(row.contact_destination || ""));
        return destKey && rowDest === destKey;
      });

      if (matched) {
        await supabaseAdmin
          .from("campaign_channel_traceability")
          .update({
            response_status: cls.status,
            response_raw: rawText,
            received_at: receivedIso,
            responded_at: cls.status !== "pendiente" ? receivedIso : matched.responded_at,
            updated_at: nowIso,
          } as any)
          .eq("id", matched.id);

        return jsonResponse(req, 200, { ok: true, updatedId: matched.id, classification: cls });
      }
      return jsonResponse(req, 200, { ok: true, updatedId: null, classification: cls, note: "Sin envío previo coincidente" });
    }

    // -------------------------------------------------------------------------
    // 3. SINCRONIZACIÓN ACTIVA:
    //    (A) Backfill SMS enviados hoy desde openvox_sms_dispatches si faltaban
    //    (B) Leer SMS entrantes REALES del Gateway OpenVox Puerto 13 (/data/log/smsinbox.db)
    //        y clasificar las respuestas ("1", "Sí", "Acepto", "No puedo ir", etc.)
    //    (C) Sincronizar llamadas de campaña desde vapi_agent_sessions (transcripciones)
    // -------------------------------------------------------------------------
    const nowIso = new Date().toISOString();
    const lookbackIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // (A) Asegurar que los SMS recientes de openvox_sms_dispatches estén en campaign_channel_traceability
    const { data: recentSmsDispatches } = await supabaseAdmin
      .from("openvox_sms_dispatches")
      .select("id, idempotency_key, campaign_id, patient_id, hospital_id, to_phone, message_body, status, gateway_message_id, created_at")
      .eq("status", "sent")
      .gte("created_at", lookbackIso)
      .order("created_at", { ascending: false })
      .limit(100);

    const smsPatIds = [...new Set((recentSmsDispatches || []).map((r: any) => r.patient_id).filter(Boolean))];
    const patMap = new Map<string, any>();
    if (smsPatIds.length > 0) {
      const { data: pRows } = await supabaseAdmin
        .from("patients")
        .select("patient_id, name, document, phone, email")
        .in("patient_id", smsPatIds);
      for (const p of pRows || []) patMap.set(String(p.patient_id), p);
    }

    for (const d of recentSmsDispatches || []) {
      const extRef = String(d.gateway_message_id || d.idempotency_key || d.id);
      const pat = d.patient_id ? patMap.get(String(d.patient_id)) : null;
      if (onlyDocument && pat && String(pat.document || "") !== onlyDocument) continue;

      // Extraer campaign_id si venia en idempotency_key: camp-auto-<camp_id>-YYYY-MM-DD-... o direct-<camp_id>-...
      let campId = d.campaign_id ? String(d.campaign_id) : "";
      if (!campId) {
        const mKey = String(d.idempotency_key || "").match(/(?:camp-auto|direct)-(camp_[a-zA-Z0-9_]+)-/);
        if (mKey) campId = mKey[1];
      }
      if (!campId) campId = `sms_${String(d.created_at || "").slice(0, 10)}`;

      const { data: existingSmsRow } = await supabaseAdmin
        .from("campaign_channel_traceability")
        .select("id")
        .eq("channel", "sms")
        .eq("external_ref_id", extRef)
        .maybeSingle();

      if (!existingSmsRow) {
        await Promise.resolve(
          supabaseAdmin
            .from("campaign_channel_traceability")
            .insert({
              hospital_id: d.hospital_id || hospitalId,
              campaign_id: campId,
              campaign_name: campId.startsWith("camp_") ? `Campaña ${campId}` : "Campaña SMS OpenVox P.13",
              patient_id: d.patient_id || null,
              patient_name: pat?.name || "Paciente",
              patient_document: pat?.document || "",
              contact_destination: normalizePhoneE164Co(String(d.to_phone || "")),
              channel: "sms",
              delivery_status: "delivered",
              response_status: "pendiente",
              external_ref_id: extRef,
              sent_at: d.created_at || nowIso,
              received_at: d.created_at || nowIso,
            } as any),
        ).catch(() => null);
      }
    }

    // (B) Leer SMS entrantes REALES desde OpenVox Puerto 13 vía puente
    let inboundSmsList: any[] = [];
    let syncedSmsReplies = 0;
    const bridgeBase = (Deno.env.get("OPENVOX_BRIDGE_URL") || Deno.env.get("ASTERISK_ARI_URL") || "")
      .trim()
      .replace(/\/$/, "");
    const bridgeSecret = Deno.env.get("ASTERISK_BRIDGE_SECRET") || "";

    if (bridgeBase) {
      try {
        const inboxRes = await fetch(`${bridgeBase}/sadi/openvox-sms-inbox`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(bridgeSecret ? { "x-sadi-bridge-secret": bridgeSecret } : {}),
          },
          body: JSON.stringify({ limit: 120, port: 13 }),
        });
        const inboxJson = (await inboxRes.json().catch(() => ({}))) as Record<string, any>;
        if (inboxRes.ok && Array.isArray(inboxJson.messages)) {
          inboundSmsList = inboxJson.messages;
        }
      } catch (e) {
        console.warn("No se pudo consultar inbox SMS de OpenVox:", e);
      }
    }

    if (inboundSmsList.length > 0) {
      const { data: smsTraceRows } = await supabaseAdmin
        .from("campaign_channel_traceability")
        .select("*")
        .eq("channel", "sms")
        .gte("sent_at", lookbackIso)
        .order("sent_at", { ascending: false })
        .limit(250);

      // Ordenar entrantes del más antiguo al más reciente para que la respuesta más reciente prevalezca
      const chronologicalInbound = [...inboundSmsList].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

      for (const inMsg of chronologicalInbound) {
        const sender10 = normalizePhone10(String(inMsg.phonenumber || inMsg.from || ""));
        if (sender10.length !== 10 || !sender10.startsWith("3")) continue; // Ignorar shortcodes de operadora (87821, 890103)

        const msgText = String(inMsg.message || "").trim();
        if (!msgText) continue;

        const msgIso = inMsg.receivedAtIso || parseOpenVoxTimeToIso(String(inMsg.time || ""));
        const msgTs = Date.parse(msgIso);
        const inboundId = `ov-in-${inMsg.id}`;

        // Buscar el envío SMS más reciente a ese teléfono que sea anterior (o con tolerancia de 5 min por desfase de reloj)
        const matchingSms = (smsTraceRows || []).find((row: any) => {
          const row10 = normalizePhone10(String(row.contact_destination || ""));
          if (row10 !== sender10) return false;
          const sentTs = Date.parse(String(row.sent_at || ""));
          return !Number.isFinite(sentTs) || !Number.isFinite(msgTs) || msgTs >= sentTs - 5 * 60 * 1000;
        });

        if (!matchingSms) continue;

        const cls = classifyAttendanceResponse(msgText, { isTranscript: false });
        // Solo sobrescribir si es un mensaje nuevo (mayor id) o si el registro seguía pendiente
        const alreadySameInbound = matchingSms.inbound_msg_id === inboundId;
        if (!alreadySameInbound) {
          await supabaseAdmin
            .from("campaign_channel_traceability")
            .update({
              response_status: cls.status,
              response_raw: msgText,
              inbound_msg_id: inboundId,
              received_at: msgIso,
              responded_at: cls.status !== "pendiente" ? msgIso : matchingSms.responded_at,
              updated_at: nowIso,
            } as any)
            .eq("id", matchingSms.id);

          matchingSms.inbound_msg_id = inboundId;
          matchingSms.response_status = cls.status;
          matchingSms.response_raw = msgText;
          matchingSms.received_at = msgIso;
          syncedSmsReplies += 1;
        }
      }
    }

    // (C) Sincronizar transcripciones de llamadas de campaña desde vapi_agent_sessions
    let syncedCalls = 0;
    const { data: recentCalls } = await supabaseAdmin
      .from("vapi_agent_sessions")
      .select("vapi_call_id, patient_id, hospital_id, telefono_llamado, motivo_llamada, estado_llamada, duracion_segundos, transcripcion_completa, resumen_ia, contexto_inyectado, created_at, updated_at")
      .gte("created_at", lookbackIso)
      .order("created_at", { ascending: false })
      .limit(100);

    const callPatIds = [...new Set((recentCalls || []).map((r: any) => r.patient_id).filter(Boolean))];
    if (callPatIds.length > 0) {
      const { data: cpRows } = await supabaseAdmin
        .from("patients")
        .select("patient_id, name, document, phone")
        .in("patient_id", callPatIds);
      for (const p of cpRows || []) patMap.set(String(p.patient_id), p);
    }

    for (const c of recentCalls || []) {
      const ctx = c.contexto_inyectado && typeof c.contexto_inyectado === "object" ? c.contexto_inyectado : {};
      const isCampaignCall = Boolean(ctx.campaignId || String(c.motivo_llamada || "").startsWith("Campaña:"));
      if (!isCampaignCall || !c.vapi_call_id) continue;

      const pat = c.patient_id ? patMap.get(String(c.patient_id)) : null;
      if (onlyDocument && pat && String(pat.document || "") !== onlyDocument) continue;

      const campId = String(ctx.campaignId || `camp_call_${String(c.created_at || "").slice(0, 10)}`);
      const campName = String(ctx.campaignName || String(c.motivo_llamada || "").replace(/^Campaña:\s*/i, "") || "Campaña Llamada IA");
      const transcript = String(c.transcripcion_completa || "").trim();
      const cls = transcript
        ? classifyAttendanceResponse(transcript, { isTranscript: true })
        : { status: "pendiente" as AttendanceResponseStatus, matchedExcerpt: "" };
      const isDone = String(c.estado_llamada || "").toLowerCase() === "completada" && Number(c.duracion_segundos || 0) > 0;

      const { data: existingRow } = await supabaseAdmin
        .from("campaign_channel_traceability")
        .select("id, response_status, response_raw")
        .eq("channel", "call")
        .eq("external_ref_id", String(c.vapi_call_id))
        .maybeSingle();

      if (!existingRow) {
        await supabaseAdmin
          .from("campaign_channel_traceability")
          .insert({
            hospital_id: c.hospital_id || hospitalId,
            campaign_id: campId,
            campaign_name: campName,
            patient_id: c.patient_id || null,
            patient_name: pat?.name || "Paciente",
            patient_document: pat?.document || "",
            contact_destination: normalizePhoneE164Co(String(c.telefono_llamado || pat?.phone || "")),
            channel: "call",
            delivery_status: isDone ? "delivered" : String(c.estado_llamada || "initiated"),
            response_status: cls.status,
            response_raw: cls.matchedExcerpt || c.resumen_ia || null,
            external_ref_id: String(c.vapi_call_id),
            sent_at: c.created_at || nowIso,
            received_at: isDone ? (c.updated_at || c.created_at || nowIso) : null,
            responded_at: cls.status !== "pendiente" ? (c.updated_at || nowIso) : null,
          } as any);
        syncedCalls += 1;
      } else if (existingRow.response_status === "pendiente" && cls.status !== "pendiente") {
        await supabaseAdmin
          .from("campaign_channel_traceability")
          .update({
            delivery_status: isDone ? "delivered" : String(c.estado_llamada || "initiated"),
            response_status: cls.status,
            response_raw: cls.matchedExcerpt || c.resumen_ia || null,
            received_at: c.updated_at || nowIso,
            responded_at: c.updated_at || nowIso,
            updated_at: nowIso,
          } as any)
          .eq("id", existingRow.id);
        syncedCalls += 1;
      }
    }

    // (D) Leer respuestas reales por correo electrónico vía IMAP (sadi@apropiatic.com.co)
    let syncedEmailReplies = 0;
    let inboundEmailScanned = 0;
    if (bridgeBase) {
      try {
        const mailRes = await fetch(`${bridgeBase}/sadi/email-inbox`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(bridgeSecret ? { "x-sadi-bridge-secret": bridgeSecret } : {}),
          },
          body: JSON.stringify({ limit: 50 }),
        });
        const mailJson = (await mailRes.json().catch(() => ({}))) as Record<string, any>;
        const mailMsgs = mailRes.ok && Array.isArray(mailJson.messages) ? mailJson.messages : [];
        inboundEmailScanned = mailMsgs.length;

        if (mailMsgs.length > 0) {
          const { data: emailTraceRows } = await supabaseAdmin
            .from("campaign_channel_traceability")
            .select("*")
            .eq("channel", "email")
            .gte("sent_at", lookbackIso)
            .order("sent_at", { ascending: false })
            .limit(250);

          const chronologicalEmails = [...mailMsgs].reverse();
          for (const inMail of chronologicalEmails) {
            const senderEmail = String(inMail.fromEmail || "").trim().toLowerCase();
            const replyText = String(inMail.message || "").trim();
            if (!senderEmail || !replyText) continue;

            const mailIso = String(inMail.receivedAtIso || nowIso);
            const mailTs = Date.parse(mailIso);
            const inboundUid = `imap-${inMail.uid}`;

            const matchingEmail = (emailTraceRows || []).find((row: any) => {
              const rowEmail = String(row.contact_destination || "").trim().toLowerCase();
              if (rowEmail !== senderEmail) return false;
              const sentTs = Date.parse(String(row.sent_at || ""));
              return !Number.isFinite(sentTs) || !Number.isFinite(mailTs) || mailTs >= sentTs - 5 * 60 * 1000;
            });

            if (!matchingEmail || matchingEmail.inbound_msg_id === inboundUid) continue;

            const cls = classifyAttendanceResponse(replyText, { isTranscript: false });
            await supabaseAdmin
              .from("campaign_channel_traceability")
              .update({
                response_status: cls.status,
                response_raw: replyText.slice(0, 280),
                inbound_msg_id: inboundUid,
                received_at: mailIso,
                responded_at: cls.status !== "pendiente" ? mailIso : matchingEmail.responded_at,
                updated_at: nowIso,
              } as any)
              .eq("id", matchingEmail.id);

            matchingEmail.inbound_msg_id = inboundUid;
            matchingEmail.response_status = cls.status;
            syncedEmailReplies += 1;
          }
        }
      } catch (e) {
        console.warn("No se pudo consultar inbox IMAP:", e);
      }
    }

    // Retornar registros consolidados (filtrados por documento si estamos en Pruebas en Local)
    let outQuery = supabaseAdmin
      .from("campaign_channel_traceability")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(500);

    if (onlyDocument) {
      outQuery = outQuery.eq("patient_document", onlyDocument);
    }
    if (campaignIdFilter && campaignIdFilter !== "todas") {
      outQuery = outQuery.eq("campaign_id", campaignIdFilter);
    }

    const { data: records, error: readErr } = await outQuery;
    if (readErr) {
      return jsonResponse(req, 500, { ok: false, error: readErr.message });
    }

    return jsonResponse(req, 200, {
      ok: true,
      syncedSmsReplies,
      syncedCalls,
      syncedEmailReplies,
      inboundSmsScanned: inboundSmsList.length,
      inboundEmailScanned,
      totalRecords: (records || []).length,
      records: records || [],
    });
  } catch (e) {
    return jsonResponse(req, 500, {
      ok: false,
      error: e instanceof Error ? e.message : "Error inesperado en sync-campaign-responses",
    });
  }
});
