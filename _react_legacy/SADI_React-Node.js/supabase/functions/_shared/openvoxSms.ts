import { createClient } from "npm:@supabase/supabase-js@2.86.0";

export interface OpenVoxSmsRequest {
  supabaseAdmin: ReturnType<typeof createClient>;
  phoneNumber: string;
  message: string;
  idempotencyKey: string;
  patientId?: string | null;
  campaignId?: string | null;
  hospitalId?: string | null;
  preferredPorts?: number[] | null;
}

export interface OpenVoxSmsResponse {
  ok: boolean;
  status: "sent" | "duplicate_blocked" | "failed_all_ports" | "gateway_unconfigured";
  winningPort: number | null;
  portsAttempted: number[];
  purgedPorts: number[];
  messageEliminated: boolean;
  gatewayMessageId: string | null;
  errorReason: string | null;
}

const safeDb = async <T>(query: PromiseLike<T>): Promise<T | null> => {
  try {
    return await query;
  } catch {
    return null;
  }
};

export async function dispatchOpenVoxSmsWithFailover(
  params: OpenVoxSmsRequest,
): Promise<OpenVoxSmsResponse> {
  const bridgeBase = (
    Deno.env.get("OPENVOX_BRIDGE_URL") ||
    Deno.env.get("ASTERISK_ARI_URL") ||
    ""
  ).trim().replace(/\/$/, "");

  const bridgeSecret = Deno.env.get("ASTERISK_BRIDGE_SECRET") || "";

  if (!bridgeBase) {
    return {
      ok: false,
      status: "gateway_unconfigured",
      winningPort: null,
      portsAttempted: [],
      purgedPorts: [],
      messageEliminated: true,
      gatewayMessageId: null,
      errorReason: "OPENVOX_BRIDGE_URL no configurado en Supabase Edge Function Secrets.",
    };
  }

  // 1. Verificar idempotencia en BD para impedir reenvío duplicado ante recuperaciones de señal
  const existingRes = await safeDb(
    params.supabaseAdmin
      .from("openvox_sms_dispatches")
      .select("id, status, winning_port, gateway_message_id")
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle(),
  );
  const existing = existingRes?.data;

  if (existing && (existing as any).status === "sent") {
    return {
      ok: true,
      status: "duplicate_blocked",
      winningPort: (existing as any).winning_port ?? null,
      portsAttempted: [],
      purgedPorts: [],
      messageEliminated: false,
      gatewayMessageId: (existing as any).gateway_message_id ?? null,
      errorReason: "Duplicado bloqueado por idempotency_key.",
    };
  }

  // 2. Consultar puertos habilitados no bloqueados en BD si existen
  let preferredPorts = params.preferredPorts || null;
  if (!preferredPorts && params.hospitalId) {
    const portRes = await safeDb(
      params.supabaseAdmin
        .from("openvox_gsm_ports")
        .select("port_number, cooldown_until")
        .eq("hospital_id", params.hospitalId)
        .eq("is_active", true)
        .eq("is_blocked", false)
        .order("consecutive_failures", { ascending: true })
        .order("port_number", { ascending: true }),
    );
    const portRows = portRes?.data;

    if (Array.isArray(portRows) && portRows.length > 0) {
      const nowMs = Date.now();
      preferredPorts = (portRows as any[])
        .filter((r) => !r.cooldown_until || new Date(r.cooldown_until).getTime() <= nowMs)
        .map((r) => Number(r.port_number))
        .filter((n) => n >= 1 && n <= 32);
    }
  }

  // Registrar estado inicial 'sending' antes de disparar
  const dispatchRes = await safeDb(
    params.supabaseAdmin
      .from("openvox_sms_dispatches")
      .upsert(
        {
          idempotency_key: params.idempotencyKey,
          campaign_id: params.campaignId || null,
          patient_id: params.patientId || null,
          hospital_id: params.hospitalId || null,
          to_phone: params.phoneNumber,
          message_body: params.message,
          status: "sending",
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "idempotency_key" },
      )
      .select("id")
      .maybeSingle(),
  );
  const dispatchRow = dispatchRes?.data;

  const dispatchId = (dispatchRow as any)?.id || null;

  // 3. Ejecutar failover secuencial Puerto X -> Y -> Z + Purga obligatoria en el puente OpenVox VPS
  try {
    const res = await fetch(`${bridgeBase}/sadi/openvox-sms-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bridgeSecret ? { "x-sadi-bridge-secret": bridgeSecret } : {}),
      },
      body: JSON.stringify({
        phoneNumber: params.phoneNumber,
        message: params.message,
        idempotencyKey: params.idempotencyKey,
        preferredPorts,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    const ok = Boolean(data.ok);
    const finalStatus: "sent" | "duplicate_blocked" | "failed_all_ports" = ok
      ? (data.status === "duplicate_blocked" ? "duplicate_blocked" : "sent")
      : "failed_all_ports";

    const portsAttempted: number[] = Array.isArray(data.portsAttempted) ? data.portsAttempted : [];
    const purgedPorts: number[] = Array.isArray(data.purgedPorts) ? data.purgedPorts : [];
    const attempts: any[] = Array.isArray(data.attempts) ? data.attempts : [];

    if (dispatchId) {
      await safeDb(
        params.supabaseAdmin
          .from("openvox_sms_dispatches")
          .update({
            status: finalStatus === "duplicate_blocked" ? "sent" : finalStatus,
            winning_port: data.winningPort ?? null,
            ports_attempted: portsAttempted,
            purged_ports: purgedPorts,
            gateway_message_id: data.gatewayMessageId ?? null,
            error_reason: data.errorReason ?? null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", dispatchId),
      );

      if (attempts.length > 0) {
        const logRows = attempts.map((a) => ({
          dispatch_id: dispatchId,
          port_number: Number(a.port),
          attempt_order: Number(a.order || 1),
          outcome: String(a.outcome || "modem_error"),
          queue_purged: Boolean(a.queue_purged),
          raw_gateway_response: String(a.raw || ""),
        }));
        await safeDb(
          params.supabaseAdmin
            .from("openvox_sms_attempt_logs")
            .insert(logRows as any),
        );
      }
    }

    return {
      ok,
      status: finalStatus,
      winningPort: data.winningPort ?? null,
      portsAttempted,
      purgedPorts,
      messageEliminated: Boolean(data.messageEliminated ?? !ok),
      gatewayMessageId: data.gatewayMessageId ?? null,
      errorReason: data.errorReason ?? null,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Error conectando al puente OpenVox SMS";
    if (dispatchId) {
      await safeDb(
        params.supabaseAdmin
          .from("openvox_sms_dispatches")
          .update({
            status: "failed_all_ports",
            error_reason: errMsg,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", dispatchId),
      );
    }

    return {
      ok: false,
      status: "failed_all_ports",
      winningPort: null,
      portsAttempted: [],
      purgedPorts: [],
      messageEliminated: true,
      gatewayMessageId: null,
      errorReason: errMsg,
    };
  }
}
