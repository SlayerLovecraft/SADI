import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.86.0";

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidEmail(raw: string): boolean {
  const s = String(raw || "").trim().toLowerCase();
  if (!s || s.startsWith("sin") || s.includes("no registrado")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function escapeHtml(raw: string): string {
  return String(raw || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildClinicalEmailHtml(params: {
  patientName: string;
  campaignName: string;
  subject: string;
  bodyText: string;
  sede: string;
  fecha: string;
  exactBody?: boolean;
}) {
  const normalizedBody = String(params.bodyText || "").trim();
  const paragraphs = normalizedBody
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const htmlLines = block
        .split(/\n/)
        .map((line) => escapeHtml(line.trim()))
        .join("<br />");
      return `<p style="margin:0 0 12px;color:#1e293b;font-size:14px;line-height:1.6;">${htmlLines}</p>`;
    })
    .join("");

  const hasGreetingAlready = /^(hola|buen[oa]s|estimad[oa]|cordial|querid[oa]|se[ñn]or)/i.test(normalizedBody);
  const greetingHtml = params.exactBody || hasGreetingAlready
    ? ""
    : `<p style="margin:0 0 14px;color:#0f172a;font-size:15px;font-weight:700;">Hola ${escapeHtml(params.patientName)},</p>`;

  const showMetaCard = !params.exactBody && Boolean(params.sede || params.fecha);
  const metaCardHtml = showMetaCard
    ? `<div style="margin-top:18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;font-size:13px;color:#334155;">
        <div><strong>Sede de atención:</strong> ${escapeHtml(params.sede)}</div>
        <div style="margin-top:4px;"><strong>Fecha programada:</strong> ${escapeHtml(params.fecha)}</div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#0f172a,#1e3a8a);padding:24px;color:#ffffff;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#93c5fd;">
        SADI · Resolución 3280 de 2018 · Demanda Inducida
      </div>
      <h1 style="margin:8px 0 0;font-size:20px;font-weight:800;color:#ffffff;">
        ${escapeHtml(params.campaignName)}
      </h1>
    </div>
    <div style="padding:24px;">
      ${greetingHtml}
      ${paragraphs}
      ${metaCardHtml}
    </div>
    <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">
      Hospital Central SADI · Notificación automática de Salud Preventiva (Res. 3280).
    </div>
  </div>
</body>
</html>`;
}

async function sendSingleEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
  smtpOverride?: Record<string, unknown> | null;
}): Promise<{ ok: boolean; provider: string | null; messageId?: string | null; missingConfig?: boolean; error?: string }> {
  const resendKey = String(
    (params.smtpOverride as any)?.resendApiKey || Deno.env.get("RESEND_API_KEY") || "",
  ).trim();

  if (resendKey) {
    const fromAddr = String(
      params.fromEmail ||
        (params.smtpOverride as any)?.fromEmail ||
        Deno.env.get("EMAIL_FROM") ||
        "SADI Salud <onboarding@resend.dev>",
    ).trim();

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, any>;
      if (res.ok) {
        return { ok: true, provider: "resend", messageId: data.id || null };
      }
      return { ok: false, provider: "resend", error: data?.message || data?.error || `Resend HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, provider: "resend", error: e instanceof Error ? e.message : "Error conectando con Resend" };
    }
  }

  // Fallback: Puente SMTP autenticado en OPENVOX_BRIDGE_URL (/sadi/send-email)
  const bridgeBase = (Deno.env.get("OPENVOX_BRIDGE_URL") || Deno.env.get("ASTERISK_ARI_URL") || "")
    .trim()
    .replace(/\/$/, "");
  const bridgeSecret = Deno.env.get("ASTERISK_BRIDGE_SECRET") || "";

  if (!bridgeBase) {
    return {
      ok: false,
      provider: null,
      missingConfig: true,
      error: "No hay proveedor de correo configurado (define RESEND_API_KEY o SMTP_HOST/SMTP_USER/SMTP_PASS).",
    };
  }

  const envSmtpOverride = Deno.env.get("SMTP_HOST") && Deno.env.get("SMTP_USER") && Deno.env.get("SMTP_PASS")
    ? {
      host: Deno.env.get("SMTP_HOST"),
      port: Number(Deno.env.get("SMTP_PORT") || "587"),
      user: Deno.env.get("SMTP_USER"),
      pass: Deno.env.get("SMTP_PASS"),
      fromEmail: Deno.env.get("SMTP_FROM") || Deno.env.get("EMAIL_FROM") || Deno.env.get("SMTP_USER"),
    }
    : null;

  try {
    const res = await fetch(`${bridgeBase}/sadi/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bridgeSecret ? { "x-sadi-bridge-secret": bridgeSecret } : {}),
      },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        fromEmail: params.fromEmail || undefined,
        fromName: params.fromName || "SADI · Demanda Inducida Res. 3280",
        smtpOverride: params.smtpOverride || envSmtpOverride || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (res.ok && data.ok) {
      return { ok: true, provider: data.provider || "smtp", messageId: data.messageId || null };
    }
    return {
      ok: false,
      provider: data.provider || "smtp",
      missingConfig: Boolean(data.missingConfig || res.status === 503),
      error: data.error || `Bridge email HTTP ${res.status}`,
    };
  } catch (e) {
    return { ok: false, provider: "smtp", error: e instanceof Error ? e.message : "Error conectando al puente de correo" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, 405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAdmin = supabaseUrl && serviceRole
      ? createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
    const onlyDoc = String(body.onlyDocument || "").trim();
    const campaignName = String(body.campaignName || "Campaña Preventiva SADI Res. 3280").trim();
    const subjectTpl = String(body.subject || `Recordatorio de Atención Preventiva · ${campaignName}`).trim();
    const textTpl = String(
      body.textBody ||
        body.message ||
        `Le recordamos su cita preventiva del programa ${campaignName} bajo la Resolución 3280 de 2018.`,
    ).trim();
    const sede = String(body.sede || body.lugar || "Hospital Central SADI · Santiago de Cali").trim();
    const fecha = String(body.fecha || new Date().toISOString().slice(0, 10)).trim();
    const hospitalId = UUID_REGEX.test(String(body.hospitalId || "")) ? String(body.hospitalId) : null;
    const smtpOverride = body.smtpOverride && typeof body.smtpOverride === "object" ? body.smtpOverride : null;

    if (rawRecipients.length === 0) {
      return jsonResponse(req, 400, { success: false, error: "recipients es requerido" });
    }

    const scoped = onlyDoc
      ? rawRecipients.filter((r: any) => String(r?.document || r?.documento || r?.cc || "").trim() === onlyDoc)
      : rawRecipients;
    const maxEmails = Math.max(1, Math.min(200, Number(Deno.env.get("CAMPAIGN_SEND_MAX") || "200")));
    const targetList = scoped.slice(0, maxEmails);

    let enviados = 0;
    let fallidos = 0;
    let omitidos = 0;
    let missingConfig = false;
    const results: Record<string, unknown>[] = [];

    for (const rec of targetList) {
      const patId = UUID_REGEX.test(String(rec?.patient_id || rec?.patientId || rec?.id || ""))
        ? String(rec?.patient_id || rec?.patientId || rec?.id)
        : null;
      const patName = String(rec?.name || rec?.nombre || "Paciente").trim();
      const firstName = patName.split(/\s+/)[0] || "Paciente";
      let toEmail = String(rec?.email || "").trim();

      // Si el frontend no tenía el email en memoria, buscarlo en public.patients
      if (!isValidEmail(toEmail) && patId && supabaseAdmin) {
        const { data: pRow } = await supabaseAdmin
          .from("patients")
          .select("email")
          .eq("patient_id", patId)
          .maybeSingle();
        if (pRow?.email) toEmail = String(pRow.email).trim();
      }

      if (!isValidEmail(toEmail)) {
        omitidos += 1;
        results.push({ patientId: patId, name: patName, ok: false, status: "skipped_no_email", error: "Paciente sin correo válido" });
        continue;
      }

      const personalizedSubject = subjectTpl
        .replaceAll("{paciente}", patName)
        .replaceAll("{nombre}", firstName)
        .replaceAll("{campana}", campaignName)
        .replaceAll("{sede}", sede)
        .replaceAll("{fecha}", fecha);

      const personalizedText = String(rec?.textBody || textTpl)
        .replaceAll("{paciente}", patName)
        .replaceAll("{nombre}", firstName)
        .replaceAll("{campana}", campaignName)
        .replaceAll("{sede}", sede)
        .replaceAll("{fecha}", fecha);

      const traceId = crypto.randomUUID();
      const confirmBaseUrl = supabaseUrl
        ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/sync-campaign-responses`
        : "";
      const confirmButtonsHtml = confirmBaseUrl
        ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
            <div style="font-size:12px;color:#475569;margin-bottom:10px;font-weight:600;">Confirme su asistencia con un clic:</div>
            <a href="${confirmBaseUrl}?action=confirm&traceId=${traceId}" style="display:inline-block;margin:4px 6px;padding:10px 18px;background:#059669;color:#ffffff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">✓ Confirmo Asistencia</a>
            <a href="${confirmBaseUrl}?action=decline&traceId=${traceId}" style="display:inline-block;margin:4px 6px;padding:10px 18px;background:#e11d48;color:#ffffff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">✕ No Puedo Asistir</a>
          </div>`
        : "";

      const htmlBody = buildClinicalEmailHtml({
        patientName: patName,
        campaignName,
        subject: personalizedSubject,
        bodyText: personalizedText,
        sede,
        fecha,
        exactBody: Boolean(body.exactBody ?? true),
      }).replace("</div>\n    <div style=\"padding:14px 24px;", `${confirmButtonsHtml}\n    </div>\n    <div style="padding:14px 24px;`);

      const sendRes = await sendSingleEmail({
        to: toEmail,
        subject: personalizedSubject,
        text: personalizedText,
        html: htmlBody,
        smtpOverride,
      });

      if (sendRes.missingConfig) missingConfig = true;

      if (sendRes.ok) {
        enviados += 1;
        const nowIso = new Date().toISOString();
        if (supabaseAdmin) {
          await Promise.resolve(
            supabaseAdmin.from("campaign_channel_traceability").insert({
              id: traceId,
              hospital_id: hospitalId,
              campaign_id: String(body.campaignId || `email_${fecha}`),
              campaign_name: campaignName,
              patient_id: patId,
              patient_name: patName,
              patient_document: String(rec?.document || rec?.documento || rec?.cc || ""),
              contact_destination: toEmail,
              channel: "email",
              delivery_status: "delivered",
              response_status: "pendiente",
              external_ref_id: sendRes.messageId || traceId,
              sent_at: nowIso,
              received_at: nowIso,
            } as any),
          ).catch(() => null);
        }
        if (patId && supabaseAdmin) {
          await Promise.resolve(
            supabaseAdmin.from("interactions").insert({
              hospital_id: hospitalId,
              patient_id: patId,
              tipo: "email",
              estado: "enviado",
              mensaje: `${personalizedSubject} — ${personalizedText}`,
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
                const next = { ...prev, email: Number(prev.email || 0) + 1 };
                await supabaseAdmin.from("patients").update({ conteo_canales: next } as any).eq("patient_id", patId);
              }),
          ).catch(() => null);
        }

        results.push({
          patientId: patId,
          name: patName,
          email: toEmail,
          ok: true,
          status: "sent",
          provider: sendRes.provider,
          messageId: sendRes.messageId || null,
        });
      } else {
        fallidos += 1;
        results.push({
          patientId: patId,
          name: patName,
          email: toEmail,
          ok: false,
          status: sendRes.missingConfig ? "provider_unconfigured" : "failed",
          provider: sendRes.provider,
          error: sendRes.error || "Error enviando correo",
        });
      }
    }

    return jsonResponse(req, 200, {
      success: enviados > 0 || (fallidos === 0 && !missingConfig),
      missingConfig,
      destinatarios: targetList.length,
      enviados,
      fallidos,
      omitidos,
      results,
    });
  } catch (e) {
    return jsonResponse(req, 500, {
      success: false,
      error: e instanceof Error ? e.message : "Error inesperado en send-campaign-email",
    });
  }
});
