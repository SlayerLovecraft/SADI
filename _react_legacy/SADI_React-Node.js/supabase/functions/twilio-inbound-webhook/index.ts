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

const twimlResponse = () =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
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

const normalizePhoneCandidates = (raw: string) => {
  const trimmed = String(raw || "").trim();
  const digitsOnly = trimmed.replaceAll(/\D+/g, "");

  const out = new Set<string>();
  if (trimmed.startsWith("+") && digitsOnly) out.add(`+${digitsOnly}`);
  if (digitsOnly) out.add(digitsOnly);

  if (digitsOnly.length === 10) {
    out.add(`+57${digitsOnly}`);
    out.add(`57${digitsOnly}`);
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith("57")) {
    out.add(`+${digitsOnly}`);
  }

  return Array.from(out);
};

const parseOptCommand = (body: string) => {
  const normalized = String(body || "").trim().toUpperCase();
  if (!normalized) return null;

  const stop = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
  const start = new Set(["START", "YES", "UNSTOP"]);

  if (stop.has(normalized)) return { sms_opt_in: false, sms_opt_out_at: new Date().toISOString() };
  if (start.has(normalized)) return { sms_opt_in: true, sms_opt_out_at: null };
  return null;
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

    const from = params.get("From") || "";
    const body = params.get("Body") || "";

    const command = parseOptCommand(body);
    if (!command) return twimlResponse();

    const candidates = normalizePhoneCandidates(from);
    if (candidates.length === 0) return twimlResponse();

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await supabaseAdmin
      .from("patients")
      .update({
        sms_opt_in: command.sms_opt_in,
        sms_opt_out_at: command.sms_opt_out_at,
      } as any)
      .in("phone", candidates);

    return twimlResponse();
  } catch (e) {
    return jsonResponse(500, { error: e instanceof Error ? e.message : "Error inesperado" });
  }
});

