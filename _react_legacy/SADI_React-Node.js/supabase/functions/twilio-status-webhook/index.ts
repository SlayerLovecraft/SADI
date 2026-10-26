import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.86.0";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

const jsonResponse = (status: number, body: Json) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const requireEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
};

const base64FromBytes = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
};

const validateTwilioSignature = async (req: Request, params: URLSearchParams) => {
  const authToken = requireEnv("TWILIO_AUTH_TOKEN");
  const signature = req.headers.get("X-Twilio-Signature") || "";
  if (!signature) return false;

  const url = req.url;
  const keys = Array.from(params.keys()).sort();
  let data = url;
  for (const key of keys) {
    const values = params.getAll(key);
    for (const value of values) data += key + value;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const expected = base64FromBytes(new Uint8Array(mac));
  return timingSafeEqual(expected, signature);
};

const mapTwilioStatus = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "delivered") return "entregado";
  if (s === "failed" || s === "undelivered") return "fallido";
  if (s === "sent") return "enviado";
  if (s === "queued" || s === "accepted" || s === "sending") return "pendiente";
  return "pendiente";
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const contentType = req.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
      return jsonResponse(400, { error: "Unsupported content-type" });
    }

    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);

    const signatureOk = await validateTwilioSignature(req, params);
    if (!signatureOk) return jsonResponse(401, { error: "Invalid signature" });

    const messageSid = params.get("MessageSid") || "";
    const messageStatus = params.get("MessageStatus") || "";
    const errorCode = params.get("ErrorCode");
    const errorMessage = params.get("ErrorMessage");

    if (!messageSid) return jsonResponse(200, { ok: true });

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: msgRow, error: msgFetchErr } = await supabaseAdmin
      .from("campaign_messages")
      .select("message_id, campaign_id")
      .eq("twilio_sid", messageSid)
      .maybeSingle();

    if (msgFetchErr) return jsonResponse(500, { error: msgFetchErr.message });
    if (!msgRow) return jsonResponse(200, { ok: true });

    const mapped = mapTwilioStatus(messageStatus);
    const delivered_at = mapped === "entregado" ? new Date().toISOString() : null;

    const { error: updateErr } = await supabaseAdmin
      .from("campaign_messages")
      .update({
        status: mapped,
        twilio_status: messageStatus || null,
        error_code: errorCode ? String(errorCode) : null,
        error_message: errorMessage ? String(errorMessage) : null,
        delivered_at,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("message_id", msgRow.message_id);

    if (updateErr) return jsonResponse(500, { error: updateErr.message });

    await supabaseAdmin.rpc("recompute_campaign_counts", { p_campaign_id: msgRow.campaign_id }).catch(() => null);

    return jsonResponse(200, { ok: true });
  } catch (e) {
    return jsonResponse(500, { error: e instanceof Error ? e.message : "Error inesperado" });
  }
});

