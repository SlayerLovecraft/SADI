import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from "npm:@supabase/supabase-js@2.86.0";
import { dispatchOpenVoxSmsWithFailover } from "../_shared/openvoxSms.ts";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

const corsHeaders = (req: Request) => {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

const jsonResponse = (req: Request, status: number, body: Json) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(req),
    },
  });

const requireEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const base64 = parts[1].replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const getCallerFromRequest = (req: Request) => {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  const claims = token ? decodeJwtPayload(token) : null;
  const callerId = (claims?.sub as string | undefined) || null;
  const email = typeof claims?.email === "string" ? String(claims.email).trim().toLowerCase() : null;
  if (!callerId) return null;
  return { callerId, email };
};

const normalizePhoneE164 = (raw: string) => {
  const cleaned = String(raw || "").trim().replaceAll(/\s+/g, "").replaceAll(/[-().]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  const digits = cleaned.replaceAll(/\D+/g, "");
  if (digits.length === 10) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return `+${digits}`;
  if (digits.length >= 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
};

const nowIso = () => new Date().toISOString();

const scheduleBackground = (promise: Promise<unknown>) => {
  const edgeRuntime = (globalThis as any).EdgeRuntime as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(promise);
    return true;
  }
  return false;
};

type CampaignRow = {
  id: string;
  hospital_id: string | null;
  template_id: string | null;
  segment_id: string | null;
  enviados: number | null;
  entregados: number | null;
  fallidos: number | null;
  pendientes?: number | null;
};

type SegmentRow = {
  id: string;
  hospital_id: string;
  edad_min: number | null;
  edad_max: number | null;
  sexo: string | null;
  ciudad: string | null;
  programa: string | null;
};

type TemplateRow = {
  id: string;
  hospital_id?: string | null;
  mensaje: string;
};

type PatientRow = {
  patient_id: string;
  name: string | null;
  phone: string | null;
  birthdate: string | null;
  sex: string | null;
  city: string | null;
  program: string | null;
  sms_opt_in?: boolean | null;
};

const calcAge = (birthdate: string | null) => {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const matchesSegment = (patient: PatientRow, segment: SegmentRow) => {
  if (patient.sms_opt_in === false) return false;
  if (!patient.phone) return false;

  if (segment.edad_min !== null || segment.edad_max !== null) {
    const age = calcAge(patient.birthdate);
    if (age === null) return false;
    if (segment.edad_min !== null && age < segment.edad_min) return false;
    if (segment.edad_max !== null && age > segment.edad_max) return false;
  }

  const segmentSexo = (segment.sexo || "").trim().toLowerCase();
  if (segmentSexo && segmentSexo !== "todos") {
    const patientSexo = (patient.sex || "").trim().toLowerCase();
    if (!patientSexo) return false;
    if (patientSexo !== segmentSexo) return false;
  }

  if (segment.ciudad) {
    const s = segment.ciudad.trim().toLowerCase();
    const c = (patient.city || "").trim().toLowerCase();
    if (!c || c !== s) return false;
  }

  if (segment.programa) {
    const s = segment.programa.trim().toLowerCase();
    const p = (patient.program || "").trim().toLowerCase();
    if (!p || p !== s) return false;
  }

  return true;
};

export const handleSendSms = async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, 405, { error: "Method not allowed" });

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const reqBody = (await req.json().catch(() => ({}))) as Record<string, any>;

    // -------------------------------------------------------------------------
    // MODO DIRECTO / CAMPAÑA LOCAL O INDIVIDUAL (OpenVox Puerto 13 con failover)
    // Permite disparar SMS reales al arrancar campañas creadas en Cronograma (camp_*)
    // o envíos individuales desde Demanda Res. 3280 / Inasistentes.
    // -------------------------------------------------------------------------
    if (reqBody?.mode === "direct" || Array.isArray(reqBody?.recipients)) {
      const bridgeConfigured = Boolean(
        (Deno.env.get("OPENVOX_BRIDGE_URL") || Deno.env.get("ASTERISK_ARI_URL") || "").trim(),
      );
      if (!bridgeConfigured) {
        return jsonResponse(req, 503, {
          success: false,
          error: "OPENVOX_BRIDGE_URL no configurado en Supabase Edge Function Secrets.",
        });
      }

      const rawRecipients = Array.isArray(reqBody.recipients) ? reqBody.recipients : [];
      const onlyDoc = String(reqBody.onlyDocument || "").trim();
      const baseMessage = String(reqBody.message || "").trim();
      const campaignName = String(reqBody.campaignName || "Campaña SADI Res. 3280").trim();
      const campaignIdRaw = String(reqBody.campaignId || "").trim();
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const safeCampaignUuid = uuidRe.test(campaignIdRaw) ? campaignIdRaw : null;
      const hospitalId = uuidRe.test(String(reqBody.hospitalId || "")) ? String(reqBody.hospitalId) : null;
      const preferredPorts = Array.isArray(reqBody.preferredPorts) && reqBody.preferredPorts.length > 0
        ? reqBody.preferredPorts.map((p: unknown) => Number(p)).filter((n: number) => n >= 1 && n <= 32)
        : [13];
      const forceResend = Boolean(reqBody.forceResend);
      const dateTag = String(reqBody.dateTag || new Date().toISOString().slice(0, 10));

      if (!baseMessage) {
        return jsonResponse(req, 400, { success: false, error: "message es requerido" });
      }
      if (rawRecipients.length === 0) {
        return jsonResponse(req, 400, { success: false, error: "recipients es requerido (al menos 1 destinatario)" });
      }

      const maxDirect = Math.max(1, Math.min(200, Number(Deno.env.get("CAMPAIGN_SEND_MAX") || "200")));
      const scopedRecipients = onlyDoc
        ? rawRecipients.filter((r: any) => String(r?.document || r?.documento || r?.cc || "").trim() === onlyDoc)
        : rawRecipients;
      const targetList = scopedRecipients.slice(0, maxDirect);

      let enviados = 0;
      let entregados = 0;
      let fallidos = 0;
      let omitidos = 0;
      const results: Record<string, unknown>[] = [];

      for (const rec of targetList) {
        const patId = uuidRe.test(String(rec?.patient_id || rec?.patientId || rec?.id || ""))
          ? String(rec?.patient_id || rec?.patientId || rec?.id)
          : null;
        const patName = String(rec?.name || rec?.nombre || "Paciente").trim();
        const firstName = patName.split(/\s+/)[0] || "Paciente";
        const toPhone = normalizePhoneE164(String(rec?.phone || rec?.telefono || ""));

        if (!toPhone) {
          omitidos += 1;
          results.push({ patientId: patId, name: patName, ok: false, status: "skipped_no_phone", error: "Sin teléfono válido" });
          continue;
        }

        const personalizedBody = String(rec?.message || baseMessage)
          .replaceAll("{paciente}", patName)
          .replaceAll("{nombre}", firstName)
          .replaceAll("{campana}", campaignName);

        const idemKey = forceResend
          ? `direct-${campaignIdRaw || "indiv"}-${patId || toPhone}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          : `camp-auto-${campaignIdRaw || "direct"}-${dateTag}-${patId || toPhone}`;

        const gw = await dispatchOpenVoxSmsWithFailover({
          supabaseAdmin,
          phoneNumber: toPhone,
          message: personalizedBody,
          idempotencyKey: idemKey,
          patientId: patId,
          campaignId: safeCampaignUuid,
          hospitalId,
          preferredPorts,
        });

        if (gw.ok) {
          enviados += 1;
          entregados += 1;

          // Trazabilidad en interactions + incremento conteo_canales.sms (best-effort)
          if (patId) {
            await Promise.resolve(
              supabaseAdmin.from("interactions").insert({
                hospital_id: hospitalId,
                patient_id: patId,
                tipo: "sms",
                estado: "enviado",
                mensaje: personalizedBody,
              } as any),
            ).catch(() => null);

            await Promise.resolve(
              supabaseAdmin
                .from("patients")
                .select("conteo_canales")
                .eq("patient_id", patId)
                .maybeSingle()
                .then(async ({ data: pRow }) => {
                  const prev = (pRow as any)?.conteo_canales && typeof (pRow as any).conteo_canales === "object"
                    ? (pRow as any).conteo_canales
                    : { sms: 0, call: 0, email: 0, whatsapp: 0 };
                  const next = { ...prev, sms: Number(prev.sms || 0) + 1 };
                  await supabaseAdmin.from("patients").update({ conteo_canales: next } as any).eq("patient_id", patId);
                }),
            ).catch(() => null);
          }

          // Registrar en trazabilidad omnicanal de campañas (estado inicial: pendiente)
          const nowIso = new Date().toISOString();
          await Promise.resolve(
            supabaseAdmin
              .from("campaign_channel_traceability")
              .insert({
                hospital_id: hospitalId,
                campaign_id: campaignIdRaw || `sms_direct_${dateTag}`,
                campaign_name: campaignName,
                patient_id: patId,
                patient_name: patName,
                patient_document: String(rec?.document || rec?.documento || rec?.cc || ""),
                contact_destination: toPhone,
                channel: "sms",
                delivery_status: "delivered",
                response_status: "pendiente",
                external_ref_id: gw.gatewayMessageId || idemKey,
                sent_at: nowIso,
                received_at: nowIso,
              } as any),
          ).catch(() => null);

          results.push({
            patientId: patId,
            name: patName,
            phone: toPhone,
            ok: true,
            status: gw.status,
            winningPort: gw.winningPort,
            gatewayMessageId: gw.gatewayMessageId,
          });
        } else {
          fallidos += 1;
          results.push({
            patientId: patId,
            name: patName,
            phone: toPhone,
            ok: false,
            status: gw.status,
            portsAttempted: gw.portsAttempted,
            purgedPorts: gw.purgedPorts,
            error: gw.errorReason || "Error enviando SMS por OpenVox",
          });
        }
      }

      return jsonResponse(req, 200, {
        success: enviados > 0 || (fallidos === 0 && targetList.length === 0),
        mode: "direct",
        campaignId: campaignIdRaw || null,
        destinatarios: targetList.length,
        procesados: targetList.length,
        enviados,
        entregados,
        fallidos,
        omitidos,
        results,
      });
    }

    const caller = getCallerFromRequest(req);
    if (!caller?.callerId) return jsonResponse(req, 401, { error: "Unauthorized" });
    const callerId = caller.callerId;

    const { campaignId, onlyDocument } = reqBody as { campaignId?: string; onlyDocument?: string };
    if (!campaignId) return jsonResponse(req, 400, { error: "campaignId es requerido" });

    const resolveHospitalIdForCaller = async () => {
      const email = caller.email;
      if (email) {
        const { data } = await supabaseAdmin
          .from("hospitals")
          .select("hospital_id")
          .eq("email", email)
          .maybeSingle();
        const hospitalId = (data as any)?.hospital_id ? String((data as any).hospital_id) : null;
        if (hospitalId) return hospitalId;
      }
      return callerId;
    };

    const isMissingColumn = (err: unknown, column: string) => {
      const message = typeof (err as any)?.message === "string" ? (err as any).message.toLowerCase() : "";
      return message.includes(column.toLowerCase()) && message.includes("does not exist");
    };

    const campaignSelectWithPendientes = "id, hospital_id, template_id, segment_id, enviados, entregados, fallidos, pendientes";
    const campaignSelect = "id, hospital_id, template_id, segment_id, enviados, entregados, fallidos";

    let campaignRes = await supabaseAdmin
      .from("campaigns")
      .select(campaignSelectWithPendientes)
      .eq("id", campaignId)
      .maybeSingle();

    if (campaignRes.error && isMissingColumn(campaignRes.error, "pendientes")) {
      campaignRes = await supabaseAdmin.from("campaigns").select(campaignSelect).eq("id", campaignId).maybeSingle();
    }

    if (campaignRes.error) return jsonResponse(req, 500, { error: campaignRes.error.message });
    if (!campaignRes.data) return jsonResponse(req, 404, { error: "Campaña no encontrada" });
    const campaignRow = campaignRes.data as unknown as CampaignRow;

    const effectiveHospitalId = await resolveHospitalIdForCaller();

    if (campaignRow.hospital_id && campaignRow.hospital_id !== callerId && campaignRow.hospital_id !== effectiveHospitalId) {
      return jsonResponse(req, 403, { error: "No autorizado para esta campaña" });
    }

    if (!campaignRow.template_id || !campaignRow.segment_id) {
      return jsonResponse(req, 400, { error: "La campaña no tiene template o segmento" });
    }

    const [{ data: template, error: templateError }, { data: segment, error: segmentError }] = await Promise.all([
      supabaseAdmin.from("templates").select("id, hospital_id, mensaje").eq("id", campaignRow.template_id).maybeSingle(),
      supabaseAdmin
        .from("segments")
        .select("id, hospital_id, edad_min, edad_max, sexo, ciudad, programa")
        .eq("id", campaignRow.segment_id)
        .maybeSingle(),
    ]);

    if (templateError) return jsonResponse(req, 500, { error: templateError.message });
    if (!template) return jsonResponse(req, 404, { error: "Plantilla no encontrada" });
    if (segmentError) return jsonResponse(req, 500, { error: segmentError.message });
    if (!segment) return jsonResponse(req, 404, { error: "Segmento no encontrado" });
    const templateRow = template as unknown as TemplateRow;
    const segmentRow = segment as unknown as SegmentRow;

    if (campaignRow.hospital_id) {
      if (segmentRow.hospital_id && segmentRow.hospital_id !== campaignRow.hospital_id) {
        return jsonResponse(req, 400, { error: "Segmento no pertenece al hospital de la campaña" });
      }
      if (templateRow.hospital_id && templateRow.hospital_id !== campaignRow.hospital_id) {
        return jsonResponse(req, 400, { error: "Plantilla no pertenece al hospital de la campaña" });
      }
    }

    let patientsQuery = supabaseAdmin
      .from("patients")
      .select("patient_id, name, phone, document, birthdate, sex, city, program, sms_opt_in")
      .eq("hospital_id", segmentRow.hospital_id);

    if (onlyDocument && String(onlyDocument).trim()) {
      patientsQuery = patientsQuery.eq("document", String(onlyDocument).trim());
    }

    const { data: patients, error: patientsError } = await patientsQuery;

    if (patientsError) return jsonResponse(req, 500, { error: patientsError.message });

    const filtered = ((patients || []) as unknown as PatientRow[]).filter((p) => matchesSegment(p, segmentRow));

    const bridgeConfigured = Boolean(
      (Deno.env.get("OPENVOX_BRIDGE_URL") || Deno.env.get("ASTERISK_ARI_URL") || "").trim(),
    );
    if (!bridgeConfigured) {
      return jsonResponse(req, 503, {
        success: false,
        error: "OPENVOX_BRIDGE_URL no configurado. Los SMS de SADI se envían exclusivamente mediante SIM Cards del Gateway OpenVox (cero Twilio).",
      });
    }

    const maxToSend = Number(Deno.env.get("CAMPAIGN_SEND_MAX") || "200");
    const batchSize = Math.max(1, Math.min(10, Number(Deno.env.get("CAMPAIGN_SEND_BATCH") || "4")));

    const toSend = filtered.slice(0, maxToSend);

    const createdAt = nowIso();
    const messageRows = toSend.map((p) => ({
      message_id: crypto.randomUUID(),
      campaign_id: campaignRow.id,
      patient_id: p.patient_id,
      to_phone: normalizePhoneE164(p.phone || ""),
      body: templateRow.mensaje,
      status: "pendiente",
      created_at: createdAt,
      updated_at: createdAt,
    }));

    let trackingEnabled = true;
    const { error: insertErr } = await supabaseAdmin.from("campaign_messages").insert(messageRows as any);
    if (insertErr) {
      const msg = (insertErr as any)?.message ? String((insertErr as any).message).toLowerCase() : "";
      const missingTrackingTable = msg.includes("campaign_messages") && msg.includes("does not exist");
      if (!missingTrackingTable) {
        return jsonResponse(req, 500, {
          error:
            "No se pudo registrar trazabilidad por mensaje. Ejecuta el SQL de tracking (campaign_messages) en Supabase.",
          detail: (insertErr as any)?.message || "Insert error",
        });
      }
      trackingEnabled = false;
    }

    const safeUpdateCampaign = async (fields: Record<string, unknown>) => {
      const res = await supabaseAdmin.from("campaigns").update(fields as any).eq("id", campaignRow.id);
      if (!res.error) return;
      if (isMissingColumn(res.error, "pendientes")) {
        const { pendientes: _p, ...rest } = fields;
        await supabaseAdmin.from("campaigns").update(rest as any).eq("id", campaignRow.id);
        return;
      }
      throw res.error;
    };

    await safeUpdateCampaign({
      estado: "Activa",
      fecha_envio: nowIso(),
      pendientes: (campaignRow.pendientes ?? 0) + toSend.length,
      updated_at: nowIso(),
    });

    const sendJob = async () => {
      let enviados = 0;
      let fallidos = 0;
      let entregados = 0;

      type SendEntry = {
        message_id?: string;
        patient_id: string;
        to_phone: string | null;
        body: string;
      };

      const sendEntries: SendEntry[] = trackingEnabled
        ? (messageRows as unknown as SendEntry[])
        : toSend.map((p) => ({
          patient_id: p.patient_id,
          to_phone: normalizePhoneE164(p.phone || ""),
          body: templateRow.mensaje,
        }));

      const sendOne = async (row: SendEntry) => {
        const to = row.to_phone;
        if (!to) {
          fallidos += 1;
          if (trackingEnabled && row.message_id) {
            await supabaseAdmin
              .from("campaign_messages")
              .update({
                status: "fallido",
                error_message: "Número inválido",
                updated_at: nowIso(),
              } as any)
              .eq("message_id", row.message_id);
          }
          return;
        }

        try {
          const idemKey = `camp-${campaignRow.id}-pat-${row.patient_id}-${row.message_id || "raw"}`;
          const gw = await dispatchOpenVoxSmsWithFailover({
            supabaseAdmin,
            phoneNumber: to,
            message: row.body,
            idempotencyKey: idemKey,
            patientId: row.patient_id,
            campaignId: campaignRow.id,
            hospitalId: campaignRow.hospital_id || segmentRow.hospital_id,
          });

          if (gw.ok) {
            enviados += 1;
            entregados += 1;
            if (trackingEnabled && row.message_id) {
              await supabaseAdmin
                .from("campaign_messages")
                .update({
                  status: "entregado",
                  from_phone: gw.winningPort ? `SIM-Port-${gw.winningPort}` : null,
                  openvox_port: gw.winningPort,
                  purged_ports: gw.purgedPorts,
                  gateway_message_id: gw.gatewayMessageId,
                  sent_at: nowIso(),
                  delivered_at: nowIso(),
                  updated_at: nowIso(),
                } as any)
                .eq("message_id", row.message_id);
            }
          } else {
            fallidos += 1;
            if (trackingEnabled && row.message_id) {
              await supabaseAdmin
                .from("campaign_messages")
                .update({
                  status: "fallido",
                  purged_ports: gw.purgedPorts,
                  error_message: gw.errorReason || "Puertos OpenVox sin señal (intentos purgados)",
                  updated_at: nowIso(),
                } as any)
                .eq("message_id", row.message_id);
            }
          }
        } catch (e) {
          fallidos += 1;
          if (trackingEnabled && row.message_id) {
            await supabaseAdmin
              .from("campaign_messages")
              .update({
                status: "fallido",
                error_message: e instanceof Error ? e.message : "Error enviando SMS por OpenVox",
                updated_at: nowIso(),
              } as any)
              .eq("message_id", row.message_id);
          }
        }
      };

      for (let i = 0; i < sendEntries.length; i += batchSize) {
        const batch = sendEntries.slice(i, i + batchSize);
        await Promise.all(batch.map(sendOne));
      }

      await safeUpdateCampaign({
        enviados: (campaignRow.enviados ?? 0) + enviados,
        entregados: (campaignRow.entregados ?? 0) + entregados,
        fallidos: (campaignRow.fallidos ?? 0) + fallidos,
        pendientes: Math.max(0, (campaignRow.pendientes ?? 0) + toSend.length - fallidos),
        updated_at: nowIso(),
      });

      await Promise.resolve(
        supabaseAdmin.rpc("recompute_campaign_counts", { p_campaign_id: campaignRow.id }),
      ).catch(() => null);

      return { enviados, entregados, fallidos };
    };

    const canBackground = scheduleBackground(sendJob().catch(() => null));
    if (canBackground) {
      return jsonResponse(req, 202, {
        success: true,
        queued: true,
        campaignId: campaignRow.id,
        destinatarios: filtered.length,
        procesados: toSend.length,
      });
    }

    const result = await sendJob();
    return jsonResponse(req, 200, {
      success: true,
      queued: false,
      campaignId: campaignRow.id,
      destinatarios: filtered.length,
      procesados: toSend.length,
      enviados: result.enviados,
      entregados: result.entregados,
      fallidos: result.fallidos,
    });
  } catch (e) {
    return jsonResponse(req, 500, {
      success: false,
      error: e instanceof Error ? e.message : "Error inesperado",
    });
  }
};

Deno.serve(handleSendSms);