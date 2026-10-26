import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.86.0";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (status: number, body: Json) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders,
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

const getNestedString = (obj: unknown, path: string[]) => {
  let cur: any = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = cur[key];
  }
  return typeof cur === "string" ? cur : null;
};

const randomPassword = (length = 14) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};

const normalizePhoneE164 = (raw: string) => {
  const cleaned = String(raw || "").trim().replaceAll(/\s+/g, "").replaceAll(/[-().]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  const digits = cleaned.replaceAll(/\D+/g, "");
  if (digits.length === 10) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
};

const sendTwilioSms = async (params: { to: string; body: string }) => {
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
  const authToken = requireEnv("TWILIO_AUTH_TOKEN");
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
  const fromPhone = Deno.env.get("TWILIO_FROM_PHONE");

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const payload = new URLSearchParams();
  payload.set("To", params.to);
  payload.set("Body", params.body);

  const mss = messagingServiceSid?.trim();
  const fp = fromPhone?.trim();
  if (mss) payload.set("MessagingServiceSid", mss);
  else if (fp) payload.set("From", fp);
  else throw new Error("Missing Twilio sender configuration");

  const basic = btoa(`${accountSid}:${authToken}`);
  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, Math.min(60_000, Number(Deno.env.get("TWILIO_HTTP_TIMEOUT_MS") || "20000")));
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.message || parsed?.detail || message;
    } catch {
    }
    const err = new Error(message);
    (err as any).status = res.status;
    throw err;
  }

  try {
    return JSON.parse(text) as { sid: string; status: string; to: string; from: string };
  } catch {
    throw new Error("Unexpected Twilio response");
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    const claims = token ? decodeJwtPayload(token) : null;
    const callerId = (claims?.sub as string | undefined) || null;
    if (!callerId) return jsonResponse(401, { error: "Unauthorized" });
    const callerEmail = getNestedString(claims, ["email"])?.trim().toLowerCase() || null;
    const callerRole =
      getNestedString(claims, ["role"]) ||
      getNestedString(claims, ["user_metadata", "role"]) ||
      getNestedString(claims, ["app_metadata", "role"]) ||
      null;
    const callerHospitalId =
      getNestedString(claims, ["hospitalId"]) ||
      getNestedString(claims, ["hospital_id"]) ||
      getNestedString(claims, ["user_metadata", "hospitalId"]) ||
      getNestedString(claims, ["user_metadata", "hospital_id"]) ||
      null;

    const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const email = String(payload.email || "").trim().toLowerCase();
    const nombre = String(payload.nombre || "").trim();
    const apellido = String(payload.apellido || "").trim();
    const cedula = String(payload.cedula || "").trim();
    const telefonoRaw = payload.telefono ? String(payload.telefono) : "";
    const telefono = telefonoRaw ? normalizePhoneE164(telefonoRaw) : null;
    const fecha_nacimiento = payload.fecha_nacimiento ? String(payload.fecha_nacimiento) : null;
    const genero = payload.genero ? String(payload.genero) : null;
    const direccion = payload.direccion ? String(payload.direccion) : null;
    const ciudad = payload.ciudad ? String(payload.ciudad) : null;
    const programa = payload.programa ? String(payload.programa) : null;
    const hospital_id = String(payload.hospital_id || "").trim();
    const sms_opt_in = typeof payload.sms_opt_in === "boolean" ? (payload.sms_opt_in as boolean) : true;

    if (!email || !nombre || !apellido || !cedula || !hospital_id) {
      return jsonResponse(400, { error: "email, nombre, apellido, cedula, hospital_id son requeridos" });
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let authorized = false;
    if (callerRole === "super_admin") {
      authorized = true;
    } else if (callerId === hospital_id) {
      authorized = true;
    } else if (callerHospitalId && callerHospitalId === hospital_id) {
      authorized = true;
    } else if (callerEmail) {
      const { data: hospitalRow } = await supabaseAdmin
        .from("hospitals")
        .select("hospital_id")
        .eq("email", callerEmail)
        .maybeSingle();
      const resolved = (hospitalRow as any)?.hospital_id ? String((hospitalRow as any).hospital_id) : null;
      if (resolved && resolved === hospital_id) authorized = true;
    }

    if (!authorized) {
      return jsonResponse(403, { error: "No autorizado para crear pacientes en este hospital" });
    }

    const temporary_password = randomPassword(14);

    const { data, error } = await supabaseAdmin.rpc("create_patient_secure", {
      p_hospital_id: hospital_id,
      p_email: email,
      p_name: `${nombre} ${apellido}`.trim(),
      p_document: cedula,
      p_phone: telefono,
      p_birthdate: fecha_nacimiento,
      p_sex: genero,
      p_city: ciudad,
      p_address: direccion,
      p_program: programa,
      p_plain_password: temporary_password,
      p_sms_opt_in: sms_opt_in,
    });

    if (error) {
      const msg = error.message || "";
      const isMissingFn =
        msg.toLowerCase().includes("function") &&
        msg.toLowerCase().includes("create_patient_secure") &&
        msg.toLowerCase().includes("does not exist");

      if (isMissingFn) {
        return jsonResponse(500, { error: "Falta crear la función SQL create_patient_secure en Supabase" });
      }

      return jsonResponse(500, { error: error.message });
    }

    const portalUrl = Deno.env.get("PATIENT_PORTAL_URL");
    const smsTo = telefono && sms_opt_in ? telefono : null;
    let smsSent = false;
    let smsSid: string | null = null;
    let smsError: string | null = null;

    if (smsTo) {
      const bodyParts = [
        `Bienvenido(a) a SADI Salud.`,
        `Usuario: ${email}`,
        `Contraseña temporal: ${temporary_password}`,
        `Cámbiala al ingresar.`,
        portalUrl ? `Ingresa: ${portalUrl}` : null,
      ].filter(Boolean);

      try {
        const twilio = await sendTwilioSms({ to: smsTo, body: bodyParts.join(" ") });
        smsSent = true;
        smsSid = twilio.sid || null;
      } catch (e) {
        smsError = e instanceof Error ? e.message : "Error enviando SMS";
      }
    }

    return jsonResponse(200, {
      success: true,
      patient: data,
      temporary_password,
      sms: {
        attempted: Boolean(smsTo),
        sent: smsSent,
        to: smsTo,
        sid: smsSid,
        error: smsError,
      },
    });
  } catch (e) {
    return jsonResponse(500, { success: false, error: e instanceof Error ? e.message : "Error inesperado" });
  }
});
