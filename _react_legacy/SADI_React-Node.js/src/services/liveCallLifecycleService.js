// ==============================================================================
// liveCallLifecycleService.js - MOTOR UNIFICADO DE CICLO DE VIDA DE LLAMADAS
// Y CUPO DIARIO DE 500 LLAMADAS EXITOSAS (PUERTO 1 · +573106783338)
//
// Estados exactos del botón para TODOS los botones de llamar del aplicativo:
//   1. 'idle'    -> Etiqueta normal ("Llamar" / "Llamar (P. 1)")
//   2. 'calling' -> Spinner de carga + "Llamando" (permanece hasta que contesten)
//   3. 'in_call' -> "En Llamada..." (cuando el paciente contesta, hasta que cuelguen)
//   4. 'ending'  -> "Finalizando Llamada" (exactamente 3 segundos al colgar con éxito;
//                   registra la llamada en BD y resta 1 al cupo diario de 500)
//   5. 'failed'  -> "Fallo al Contactar" (exactamente 3 segundos si no contesta,
//                   buzón o error de conexión; no resta del cupo diario exitoso)
// ==============================================================================

import { supabase } from '@/lib/supabase';
import { runWithSupabaseAuthRecovery } from '@/lib/utils';
import { vapiIntegrationService, OPENVOX_INDIVIDUAL_PORT_CONFIG } from './vapiIntegrationService';
import { ivrScheduleService } from './ivrScheduleService';
import { DAILY_CALL_CAPACITY } from './callCapacityService';
import { callTraceLoggerService } from './callTraceLoggerService';

export const TERMINAL_HOLD_MS = 3000;
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_DURATION_MS = 15 * 60 * 1000; // 15 min máx de seguridad
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeUuid(raw) {
  const s = String(raw || '').trim();
  return UUID_REGEX.test(s) ? s : null;
}

function getStoredHospitalUuid() {
  try {
    const u = JSON.parse(localStorage.getItem('sadi_user') || '{}');
    return sanitizeUuid(u?.hospitalId || u?.hospital_id) || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8';
  } catch {
    return 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8';
  }
}

// Estado global reactivo de llamadas activas por clave de paciente/fila
const callStates = new Map(); // key -> { phase, callId, startedAt, error, patientName }
const callListeners = new Set();

// Estado global reactivo del cupo diario (500 llamadas/día)
// Descuenta en tiempo real: Prioridad Res. 3280 + Campañas activas hoy + Llamadas exitosas hoy
function getColombiaTodayIso() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch { }
  return new Date().toISOString().slice(0, 10);
}

export function computeLocalCampaignCallsForDate(dateIso) {
  const target = String(dateIso || getColombiaTodayIso()).slice(0, 10);
  try {
    const raw = localStorage.getItem('sadi_campaigns_v2');
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list) || list.length === 0) return 0;

    let total = 0;
    for (const camp of list) {
      if (!camp) continue;
      const st = String(camp.estado || '').toLowerCase();
      if (st === 'completada' || st === 'cancelada' || st === 'eliminada') continue;

      const dates = [];
      if (Array.isArray(camp.fechas_ejecucion) && camp.fechas_ejecucion.length > 0) {
        dates.push(...camp.fechas_ejecucion.map((d) => String(d || '').slice(0, 10)));
      } else if (Array.isArray(camp.config_frecuencia?.selectedDates) && camp.config_frecuencia.selectedDates.length > 0) {
        dates.push(...camp.config_frecuencia.selectedDates.map((d) => String(d || '').slice(0, 10)));
      } else if (camp.fecha_programada) {
        dates.push(String(camp.fecha_programada).slice(0, 10));
      }

      if (!dates.includes(target)) continue;

      // Si la campaña deshabilitó explícitamente llamadas de voz (ej. llamadas_ia_asignadas === 0 y sin canal de voz)
      if (camp.llamadas_ia_asignadas !== undefined && camp.llamadas_ia_asignadas !== null) {
        const assignedVoice = Math.max(0, Number(camp.llamadas_ia_asignadas) || 0);
        if (assignedVoice > 0) {
          total += Math.ceil(assignedVoice / Math.max(1, dates.length));
        }
        continue;
      }

      const canalStr = String(camp.canal || 'llamada').toLowerCase();
      if (canalStr && !/(llamada|voz|vapi|call|ivr)/i.test(canalStr)) continue;

      const vol = Math.max(0, Number(camp.pacientes_asignados || camp.destinatarios || 0) || 0);
      if (vol > 0) {
        total += Math.ceil(vol / Math.max(1, dates.length));
      }
    }
    return total;
  } catch {
    return 0;
  }
}

let quotaState = {
  date: getColombiaTodayIso(),
  dailyCap: DAILY_CALL_CAPACITY,
  reservedResolucion: 0,
  reservedCampaignsDb: 0,
  reservedCampaignsLocal: 0,
  reservedCampaigns: 0,
  usedToday: 0,
  committedToday: 0,
  remainingToday: DAILY_CALL_CAPACITY,
  loaded: false,
};
const quotaListeners = new Set();

function notifyCallListeners() {
  const snapshot = new Map(callStates);
  callListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch { }
  });
}

function setCallPhase(key, patch) {
  const prev = callStates.get(key) || { phase: 'idle' };
  const next = { ...prev, ...patch };
  if (next.phase === 'idle') {
    callStates.delete(key);
  } else {
    callStates.set(key, next);
  }
  notifyCallListeners();
  return next;
}

function notifyQuotaListeners() {
  const snap = { ...quotaState };
  quotaListeners.forEach((cb) => {
    try {
      cb(snap);
    } catch { }
  });
  try {
    window.dispatchEvent(new CustomEvent('sadi:daily-quota-updated', { detail: snap }));
  } catch { }
}

function applyQuotaPayload(raw) {
  if (!raw || typeof raw !== 'object') return quotaState;
  const dateIso = String(raw.date || quotaState.date || getColombiaTodayIso()).slice(0, 10);
  const dailyCap = Number(raw.daily_cap ?? raw.dailyCap ?? DAILY_CALL_CAPACITY) || DAILY_CALL_CAPACITY;
  const reservedResolucion = Math.min(
    dailyCap,
    Math.max(0, Number(raw.reserved_resolucion ?? raw.reservedResolucion ?? quotaState.reservedResolucion ?? 0) || 0)
  );
  const reservedCampaignsDb = Math.max(
    0,
    Number(raw.reserved_campaigns_db ?? raw.reservedCampaignsDb ?? quotaState.reservedCampaignsDb ?? 0) || 0
  );
  const reservedCampaignsLocal = computeLocalCampaignCallsForDate(dateIso);
  const reservedCampaigns = Math.min(
    Math.max(0, dailyCap - reservedResolucion),
    reservedCampaignsDb + reservedCampaignsLocal
  );
  const usedToday = Math.max(0, Number(raw.used_today ?? raw.usedToday ?? 0) || 0);
  const committedToday = Math.min(dailyCap, reservedResolucion + reservedCampaigns + usedToday);
  const remainingToday = Math.max(0, dailyCap - committedToday);

  quotaState = {
    date: dateIso,
    dailyCap,
    reservedResolucion,
    reservedCampaignsDb,
    reservedCampaignsLocal,
    reservedCampaigns,
    usedToday,
    committedToday,
    remainingToday,
    loaded: true,
  };
  notifyQuotaListeners();
  return quotaState;
}

// Reaccionar en tiempo real cuando el usuario crea, relanza o elimina una campaña local
if (typeof window !== 'undefined') {
  const recomputeOnCampaignChange = () => {
    if (quotaState.loaded) {
      applyQuotaPayload({
        date: quotaState.date,
        daily_cap: quotaState.dailyCap,
        reserved_resolucion: quotaState.reservedResolucion,
        reserved_campaigns_db: quotaState.reservedCampaignsDb,
        used_today: quotaState.usedToday,
      });
    }
  };
  window.addEventListener('sadi:campaigns-updated', recomputeOnCampaignChange);
  window.addEventListener('storage', (ev) => {
    if (!ev || ev.key === 'sadi_campaigns_v2') {
      recomputeOnCampaignChange();
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const liveCallLifecycleService = {
  getSnapshot() {
    return new Map(callStates);
  },

  getCallState(key) {
    return callStates.get(String(key || '')) || { phase: 'idle' };
  },

  subscribeCalls(listener) {
    callListeners.add(listener);
    listener(new Map(callStates));
    return () => callListeners.delete(listener);
  },

  getQuotaSnapshot() {
    return { ...quotaState };
  },

  subscribeQuota(listener) {
    quotaListeners.add(listener);
    listener({ ...quotaState });
    return () => quotaListeners.delete(listener);
  },

  async refreshDailyQuota(hospitalId = null) {
    const hospUuid = sanitizeUuid(hospitalId) || getStoredHospitalUuid();
    try {
      const { data, error } = await runWithSupabaseAuthRecovery(
        supabase,
        () =>
          supabase.rpc('get_daily_call_quota_status', {
            p_hospital_id: hospUuid,
          }),
        12000,
        'Timeout consultando cupo diario de llamadas'
      );
      if (!error && data) {
        return applyQuotaPayload(data);
      }
    } catch (e) {
      console.warn('No se pudo refrescar cupo diario de 500 llamadas:', e?.message);
    }
    return { ...quotaState };
  },

  async recordOutcomeInDb({
    hospitalId = null,
    patientId = null,
    doctorId = null,
    vapiCallId = null,
    phone = null,
    motivo = 'Demanda Inducida Res. 3280',
    durationSeconds = 0,
    outcome = 'failed',
    endedReason = null,
    transcript = null,
    summary = null,
    slotTanda = null,
  }) {
    const hospUuid = sanitizeUuid(hospitalId) || getStoredHospitalUuid();
    const patUuid = sanitizeUuid(patientId);
    const docUuid = sanitizeUuid(doctorId);

    let rpcErrorMsg = null;
    try {
      const { data, error } = await runWithSupabaseAuthRecovery(
        supabase,
        () =>
          supabase.rpc('record_call_lifecycle_outcome', {
            p_hospital_id: hospUuid,
            p_patient_id: patUuid,
            p_doctor_id: docUuid,
            p_vapi_call_id: vapiCallId || null,
            p_phone: phone || null,
            p_motivo: motivo || 'Demanda Inducida Res. 3280',
            p_duracion_segundos: Math.max(0, Math.round(Number(durationSeconds || 0))),
            p_outcome: outcome,
            p_ended_reason: endedReason || null,
            p_transcript: transcript || null,
            p_summary: summary || null,
            p_slot_tanda: slotTanda || null,
          }),
        12000,
        'Timeout registrando resultado de llamada'
      );
      if (!error && data?.quota) {
        applyQuotaPayload(data.quota);
        return data;
      }
      if (error) {
        rpcErrorMsg = error.message || JSON.stringify(error);
      }
    } catch (e) {
      rpcErrorMsg = e?.message || String(e);
      console.warn('Error registrando outcome de llamada en Supabase:', rpcErrorMsg);
    }

    // Actualización optimista si la llamada fue exitosa aunque haya fallado el RPC
    if (outcome === 'success') {
      const nextUsed = quotaState.usedToday + 1;
      applyQuotaPayload({
        date: quotaState.date,
        daily_cap: quotaState.dailyCap,
        reserved_resolucion: quotaState.reservedResolucion,
        reserved_campaigns_db: quotaState.reservedCampaignsDb,
        used_today: nextUsed,
      });
    }
    return { ok: false, error: rpcErrorMsg, quota: { ...quotaState } };
  },

  /**
   * Ejecuta una llamada REAL de principio a fin manejando TODA la máquina de estados:
   *   idle -> calling ("Llamando") -> in_call ("En Llamada...") ->
   *   ending ("Finalizando Llamada" 3s + resta 1 al cupo de 500)
   *   o failed ("Fallo al Contactar" 3s) -> idle.
   */
  async executeLiveCall({
    targetKey,
    phoneNumber,
    patientData = {},
    antiVoicemailConfig = null,
    onStateChange = null,
    onSuccess = null,
    onFailure = null,
  }) {
    const key = String(targetKey || patientData.patientId || patientData.id || phoneNumber || Date.now());
    const existing = callStates.get(key);
    if (existing && existing.phase !== 'idle') {
      return { ok: false, skipped: true, reason: 'already_in_progress' };
    }

    const emitState = (phase, extra = {}) => {
      const st = setCallPhase(key, {
        phase,
        patientName: patientData.nombre || patientData.name || 'Paciente',
        ...extra,
      });
      if (onStateChange) {
        try {
          onStateChange(st);
        } catch { }
      }
      return st;
    };

    const cleanPhone = String(phoneNumber || '').trim();
    const effectiveAntiVmCfg = antiVoicemailConfig || ivrScheduleService.getConfig();
    const resolvedHospitalId = patientData.hospitalId || patientData.hospital_id || getStoredHospitalUuid();
    const resolvedGsmPort = patientData.gsmPort || OPENVOX_INDIVIDUAL_PORT_CONFIG.port;
    const resolvedCallerNumber = patientData.callerNumber || OPENVOX_INDIVIDUAL_PORT_CONFIG.callerNumber;
    const resolvedPhoneNumberId = patientData.phoneNumberId || OPENVOX_INDIVIDUAL_PORT_CONFIG.vapiPhoneNumberId;
    const resolvedRouteMode = patientData.routeMode || 'vapi_issabel_port1';

    // Abrir / iniciar traza en la ventana independiente de Log y copiar snapshot inicial
    const traceId = callTraceLoggerService.startTrace({
      patientData: { ...patientData, hospitalId: resolvedHospitalId },
      rawPhone: cleanPhone,
      gsmPort: resolvedGsmPort,
      callerNumber: resolvedCallerNumber,
      phoneNumberId: resolvedPhoneNumberId,
      routeMode: resolvedRouteMode,
      antiVoicemailConfig: effectiveAntiVmCfg,
      quotaSnapshot: this.getQuotaSnapshot(),
    });

    if (!cleanPhone || cleanPhone.toLowerCase().includes('sin tel')) {
      callTraceLoggerService.logEvent(traceId, {
        level: 'ERROR',
        stage: '2_VALIDATION',
        message: 'Validación fallida: el paciente no tiene teléfono válido registrado en BD.',
        data: { rawPhone: cleanPhone || '(vacío)' },
      });
      await callTraceLoggerService.finishTrace(traceId, {
        outcome: 'failed',
        summaryMessage: 'Llamada cancelada antes de salir: paciente sin número de teléfono registrado.',
        extraPatch: {
          endedReason: 'no_phone',
          endedMessage: 'El paciente no tiene teléfono registrado.',
          lastError: 'Paciente sin teléfono registrado',
          dbRecordStatus: 'No aplica (sin teléfono)',
        },
      });
      emitState('failed', { error: 'Paciente sin teléfono registrado' });
      await sleep(TERMINAL_HOLD_MS);
      emitState('idle');
      const failRes = { ok: false, outcome: 'failed', traceId, reason: 'no_phone', message: 'El paciente no tiene teléfono registrado.' };
      if (onFailure) onFailure(failRes);
      return failRes;
    }

    const previewE164 = cleanPhone.startsWith('+')
      ? cleanPhone
      : cleanPhone.startsWith('57')
      ? `+${cleanPhone}`
      : `+57${cleanPhone}`;

    callTraceLoggerService.updateTrace(traceId, { formattedPhone: previewE164 });
    callTraceLoggerService.logEvent(traceId, {
      level: 'STEP',
      stage: '2_VALIDATION',
      message: `Teléfono normalizado (${cleanPhone} -> ${previewE164}). Verificando cupo diario actual.`,
      data: {
        disponiblesHoy: quotaState.remainingToday,
        topeDiario: quotaState.dailyCap,
        res3280Hoy: quotaState.reservedResolucion,
        campanasHoy: quotaState.reservedCampaigns,
        exitosasHoy: quotaState.usedToday,
      },
    });

    // 1. Iniciar en estado de carga "Llamando" (permanece hasta que contesten o falle)
    emitState('calling', { callId: null, startedAt: Date.now() });

    const callPayload = {
      ...patientData,
      patientId: patientData.patientId || patientData.id || null,
      hospitalId: resolvedHospitalId,
      gsmPort: resolvedGsmPort,
      callerNumber: resolvedCallerNumber,
      phoneNumberId: resolvedPhoneNumberId,
      routeMode: resolvedRouteMode,
    };

    callTraceLoggerService.logEvent(traceId, {
      level: 'STEP',
      stage: '3_EDGE_REQUEST',
      message: `Enviando POST a Supabase Edge Function (vapi-outbound-call) hacia ${previewE164} por Puerto ${resolvedGsmPort}.`,
      data: {
        routeMode: resolvedRouteMode,
        phoneNumberId: resolvedPhoneNumberId,
        callerNumber: resolvedCallerNumber,
        patientId: callPayload.patientId,
        motivo: callPayload.motivoLlamada || callPayload.programa3280 || 'Demanda Inducida Res. 3280',
      },
    });

    let triggerRes = null;
    try {
      triggerRes = await vapiIntegrationService.triggerLiveCall(cleanPhone, callPayload, effectiveAntiVmCfg);
    } catch (err) {
      triggerRes = {
        ok: false,
        status: 500,
        edgeLatencyMs: 0,
        data: { message: err?.message || 'Error de red' },
        diagnostics: { clientException: err?.message || String(err) },
      };
    }

    const vapiCallId = triggerRes?.data?.id || triggerRes?.data?.callId || triggerRes?.diagnostics?.vapiCallId || null;
    const edgeDiag = triggerRes?.diagnostics || {};

    callTraceLoggerService.updateTrace(traceId, {
      formattedPhone: triggerRes?.formattedPhone || edgeDiag.formattedPhone || previewE164,
      dispatchMode: triggerRes?.mode || null,
      edgeHttpStatus: triggerRes?.status ?? null,
      edgeLatencyMs: triggerRes?.edgeLatencyMs ?? null,
      vapiLatencyMs: edgeDiag.vapiLatencyMs ?? null,
      assistantId: edgeDiag.assistantId || triggerRes?.data?.assistantId || null,
      vapiCallId,
      vapiStatus: triggerRes?.data?.status || edgeDiag.vapiInitialStatus || null,
      vapiCreatedAt: triggerRes?.data?.createdAt || null,
      phoneCallProvider: edgeDiag.phoneCallProvider || triggerRes?.data?.phoneCallProvider || null,
      phoneCallProviderId: edgeDiag.phoneCallProviderId || triggerRes?.data?.phoneCallProviderId || null,
      phoneCallTransport: edgeDiag.phoneCallTransport || triggerRes?.data?.phoneCallTransport || null,
    });

    if (!triggerRes?.ok || !vapiCallId) {
      const errMsg =
        triggerRes?.data?.message ||
        triggerRes?.data?.error ||
        (triggerRes?.status === 401
          ? 'Llave VAPI_PRIVATE_KEY no autorizada (401) en Supabase.'
          : 'No se pudo conectar la llamada por Puerto 1.');

      callTraceLoggerService.logEvent(traceId, {
        level: 'ERROR',
        stage: '3_EDGE_REQUEST',
        message: `Edge Function / Vapi rechazó el despacho (HTTP ${triggerRes?.status || 500}): ${errMsg}`,
        data: {
          httpStatus: triggerRes?.status || 500,
          edgeLatencyMs: triggerRes?.edgeLatencyMs ?? null,
          mode: triggerRes?.mode || null,
          diagnostics: edgeDiag,
          responseData: triggerRes?.data || null,
        },
      });

      const dbRes = await this.recordOutcomeInDb({
        hospitalId: callPayload.hospitalId,
        patientId: callPayload.patientId,
        doctorId: callPayload.doctorId || null,
        vapiCallId: vapiCallId || `err-${Date.now()}`,
        phone: cleanPhone,
        motivo: callPayload.motivoLlamada || callPayload.programa3280 || 'Demanda Inducida Res. 3280',
        durationSeconds: 0,
        outcome: 'failed',
        endedReason: errMsg,
        slotTanda: callPayload.slotTanda || null,
      });

      await callTraceLoggerService.finishTrace(traceId, {
        outcome: 'failed',
        summaryMessage: `Fallo en despacho inicial (HTTP ${triggerRes?.status || 500}): ${errMsg}`,
        extraPatch: {
          endedReason: `dispatch-http-${triggerRes?.status || 500}`,
          endedMessage: errMsg,
          lastError: errMsg,
          rawErrorPayload: { status: triggerRes?.status, diagnostics: edgeDiag, data: triggerRes?.data },
          dbRecordStatus: dbRes?.ok === false
            ? `Error al registrar en BD${dbRes?.error ? `: ${dbRes.error}` : ''}`
            : 'Registrado como fallo (no descuenta cupo)',
          quotaSnapshot: this.getQuotaSnapshot(),
        },
      });

      emitState('failed', { error: errMsg });
      await sleep(TERMINAL_HOLD_MS);
      emitState('idle');
      const failRes = { ok: false, outcome: 'failed', traceId, status: triggerRes?.status || 500, reason: errMsg, message: errMsg, data: triggerRes?.data };
      if (onFailure) onFailure(failRes);
      return failRes;
    }

    callTraceLoggerService.logEvent(traceId, {
      level: 'OK',
      stage: '4_VAPI_ACCEPTED',
      message: `Vapi aceptó la llamada (HTTP ${triggerRes.status || 200} en ${triggerRes.edgeLatencyMs ?? '?'}ms). Call ID: ${vapiCallId}`,
      data: {
        vapiCallId,
        initialStatus: triggerRes?.data?.status || 'queued',
        vapiLatencyMs: edgeDiag.vapiLatencyMs ?? null,
        provider: edgeDiag.phoneCallProvider || triggerRes?.data?.phoneCallProvider || null,
        transport: edgeDiag.phoneCallTransport || triggerRes?.data?.phoneCallTransport || null,
        sessionInsertError: edgeDiag.sessionInsertError || null,
      },
    });
    // Actualizar portapapeles con el callId real de Vapi apenas llegue
    callTraceLoggerService.copyTraceToClipboard(traceId);

    // 2. Llamada creada en Vapi -> mantener "Llamando" hasta que contesten ("En Llamada...") o cuelguen
    emitState('calling', { callId: vapiCallId });

    const pollStart = Date.now();
    let wasAnswered = false;
    let consecutivePollErrors = 0;
    let pollCount = 0;
    let lastLoggedVapiStatus = triggerRes?.data?.status || 'queued';
    let finalStatusRes = null;

    while (Date.now() - pollStart < MAX_POLL_DURATION_MS) {
      await sleep(POLL_INTERVAL_MS);
      pollCount += 1;
      const st = await vapiIntegrationService.getLiveCallStatus(vapiCallId);
      const stDiag = st?.diagnostics || {};

      callTraceLoggerService.updateTrace(traceId, {
        pollCount,
        vapiStatus: st?.vapiStatus || lastLoggedVapiStatus,
        vapiCreatedAt: stDiag.createdAt || undefined,
        vapiStartedAt: stDiag.startedAt || undefined,
        vapiEndedAt: stDiag.endedAt || undefined,
        phoneCallProvider: stDiag.phoneCallProvider || undefined,
        phoneCallProviderId: stDiag.phoneCallProviderId || undefined,
        phoneCallTransport: stDiag.phoneCallTransport || undefined,
        sipCallId: stDiag.sipCallId || undefined,
      });

      if (!st || st.ok === false) {
        consecutivePollErrors += 1;
        callTraceLoggerService.logEvent(traceId, {
          level: 'WARN',
          stage: '5_SIP_RINGING',
          message: `Poll #${pollCount} con error (${consecutivePollErrors}/3): ${st?.endedReason || 'sin respuesta'}`,
          data: { source: st?.source, pollLatencyMs: st?.pollLatencyMs, endedMessage: st?.endedMessage },
        });
        if (consecutivePollErrors >= 3) {
          finalStatusRes = {
            phase: 'ended',
            vapiStatus: 'poll-error',
            isSuccess: wasAnswered,
            endedReason: st?.endedReason || 'poll-failed',
            endedMessage: st?.endedMessage || '3 errores consecutivos consultando estado en Vapi',
            durationSeconds: wasAnswered ? Math.max(1, Math.round((Date.now() - pollStart) / 1000)) : 0,
            diagnostics: stDiag,
          };
          break;
        }
        continue;
      }

      consecutivePollErrors = 0;

      if (st.phase === 'in_call' || (st.answered === true && st.phase !== 'ended')) {
        if (!wasAnswered) {
          wasAnswered = true;
          lastLoggedVapiStatus = st.vapiStatus || 'in-progress';
          emitState('in_call', { callId: vapiCallId, answeredAt: Date.now() });
          callTraceLoggerService.updateTrace(traceId, { currentPhase: 'in_call' });
          callTraceLoggerService.logEvent(traceId, {
            level: 'OK',
            stage: '6_IN_CALL',
            message: `¡Paciente contestó! Estado Vapi: ${st.vapiStatus || 'in-progress'} (Poll #${pollCount}).`,
            data: {
              startedAt: stDiag.startedAt || null,
              provider: stDiag.phoneCallProvider || null,
              sipCallId: stDiag.sipCallId || null,
              vapiLatencyMs: st.vapiLatencyMs ?? null,
            },
          });
          callTraceLoggerService.copyTraceToClipboard(traceId);
        } else if (pollCount % 4 === 0) {
          callTraceLoggerService.logEvent(traceId, {
            level: 'POLL',
            stage: '6_IN_CALL',
            message: `En llamada activa (Poll #${pollCount} · status=${st.vapiStatus} · ${Math.round((Date.now() - pollStart) / 1000)}s transcurridos).`,
            data: { pollLatencyMs: st.pollLatencyMs, messagesCount: stDiag.messagesCount },
          });
        }
        continue;
      }

      if (st.phase === 'calling') {
        const curSt = st.vapiStatus || 'queued';
        const statusChanged = curSt !== lastLoggedVapiStatus;
        if (statusChanged || pollCount === 1 || pollCount % 3 === 0) {
          lastLoggedVapiStatus = curSt;
          callTraceLoggerService.logEvent(traceId, {
            level: statusChanged ? 'STEP' : 'POLL',
            stage: '5_SIP_RINGING',
            message: statusChanged
              ? `Cambio de estado Vapi -> "${curSt}" (Poll #${pollCount}, troncal SIP Issabel -> OpenVox P.1).`
              : `Esperando contestación... Vapi="${curSt}" (Poll #${pollCount} · +${Math.round((Date.now() - pollStart) / 1000)}s).`,
            data: {
              vapiStatus: curSt,
              provider: stDiag.phoneCallProvider || null,
              sipCallId: stDiag.sipCallId || null,
              vapiLatencyMs: st.vapiLatencyMs ?? null,
            },
          });
        }
        continue;
      }

      if (st.phase === 'ended') {
        finalStatusRes = st;
        callTraceLoggerService.logEvent(traceId, {
          level: st.isSuccess ? 'OK' : 'WARN',
          stage: st.isSuccess ? '7_DB_RECORD' : '9_FAILED',
          message: `Vapi reportó fin de llamada (Poll #${pollCount}): endedReason="${st.endedReason || 'N/A'}" | duration=${st.durationSeconds || 0}s.`,
          data: {
            vapiStatus: st.vapiStatus,
            answered: st.answered,
            isSuccess: st.isSuccess,
            endedReason: st.endedReason || null,
            endedMessage: st.endedMessage || stDiag.endedMessage || null,
            cost: stDiag.cost ?? null,
            sipCallId: stDiag.sipCallId || null,
            startedAt: stDiag.startedAt || null,
            endedAt: stDiag.endedAt || null,
          },
        });
        break;
      }
    }

    if (!finalStatusRes) {
      finalStatusRes = {
        phase: 'ended',
        vapiStatus: 'timeout',
        isSuccess: wasAnswered,
        endedReason: wasAnswered ? 'max-duration-reached' : 'timeout-no-answer',
        endedMessage: 'Se alcanzó el tiempo máximo de monitoreo en el cliente.',
        durationSeconds: wasAnswered ? Math.max(1, Math.round((Date.now() - pollStart) / 1000)) : 0,
      };
    }

    const succeeded = Boolean(finalStatusRes.isSuccess);
    const finalDiag = finalStatusRes.diagnostics || {};
    const transcriptPreview = finalStatusRes.transcript
      ? String(finalStatusRes.transcript).replace(/\s+/g, ' ').slice(0, 260)
      : null;

    if (succeeded) {
      // 3A. Contestaron y colgaron -> 3 segundos "Finalizando Llamada" + contabiliza y resta 1 a los 500/día
      emitState('ending', { callId: vapiCallId, durationSeconds: finalStatusRes.durationSeconds || 1 });
      const [dbOutcome] = await Promise.all([
        this.recordOutcomeInDb({
          hospitalId: callPayload.hospitalId,
          patientId: callPayload.patientId,
          doctorId: callPayload.doctorId || null,
          vapiCallId,
          phone: cleanPhone,
          motivo: callPayload.motivoLlamada || callPayload.programa3280 || 'Demanda Inducida Res. 3280',
          durationSeconds: finalStatusRes.durationSeconds || 1,
          outcome: 'success',
          endedReason: finalStatusRes.endedReason || 'completed',
          transcript: finalStatusRes.transcript || null,
          summary: finalStatusRes.summary || null,
          slotTanda: callPayload.slotTanda || null,
        }),
        sleep(TERMINAL_HOLD_MS),
      ]);

      await callTraceLoggerService.finishTrace(traceId, {
        outcome: 'success',
        summaryMessage: `Llamada completada con éxito (${finalStatusRes.durationSeconds || 1}s). Cupo actualizado: ${this.getQuotaSnapshot().remainingToday}/${this.getQuotaSnapshot().dailyCap} disponibles.`,
        extraPatch: {
          vapiStatus: finalStatusRes.vapiStatus || 'ended',
          endedReason: finalStatusRes.endedReason || 'completed',
          endedMessage: finalStatusRes.endedMessage || finalDiag.endedMessage || null,
          durationSeconds: finalStatusRes.durationSeconds || 1,
          transcriptPreview,
          dbRecordStatus: dbOutcome?.ok === false ? 'Optimista local (RPC falló)' : 'OK en Supabase (-1 al cupo diario)',
          quotaSnapshot: this.getQuotaSnapshot(),
        },
      });

      emitState('idle');
      const okRes = {
        ok: true,
        outcome: 'success',
        traceId,
        callId: vapiCallId,
        durationSeconds: finalStatusRes.durationSeconds || 1,
        transcript: finalStatusRes.transcript || '',
        summary: finalStatusRes.summary || '',
        quota: this.getQuotaSnapshot(),
      };
      if (onSuccess) onSuccess(okRes);
      return okRes;
    }

    // 3B. No contestó / buzón / ocupado / error -> 3 segundos "Fallo al Contactar" (NO resta de 500 exitosas)
    emitState('failed', { callId: vapiCallId, error: finalStatusRes.endedReason || 'no-answer' });
    const [dbFailOutcome] = await Promise.all([
      this.recordOutcomeInDb({
        hospitalId: callPayload.hospitalId,
        patientId: callPayload.patientId,
        doctorId: callPayload.doctorId || null,
        vapiCallId,
        phone: cleanPhone,
        motivo: callPayload.motivoLlamada || callPayload.programa3280 || 'Demanda Inducida Res. 3280',
        durationSeconds: 0,
        outcome: 'failed',
        endedReason: finalStatusRes.endedReason || 'customer-did-not-answer',
        transcript: finalStatusRes.transcript || null,
        summary: finalStatusRes.summary || null,
        slotTanda: callPayload.slotTanda || null,
      }),
      sleep(TERMINAL_HOLD_MS),
    ]);

    await callTraceLoggerService.finishTrace(traceId, {
      outcome: 'failed',
      extraPatch: {
        vapiStatus: finalStatusRes.vapiStatus || 'ended',
        endedReason: finalStatusRes.endedReason || 'customer-did-not-answer',
        endedMessage: finalStatusRes.endedMessage || finalDiag.endedMessage || null,
        durationSeconds: 0,
        transcriptPreview,
        rawErrorPayload: finalDiag && Object.keys(finalDiag).length > 0 ? finalDiag : null,
        dbRecordStatus: dbFailOutcome?.ok === false
          ? `Error registrando fallo en BD${dbFailOutcome?.error ? `: ${dbFailOutcome.error}` : ''}`
          : 'Registrado como fallo (no resta cupo)',
        quotaSnapshot: this.getQuotaSnapshot(),
      },
    });

    emitState('idle');
    const failRes = {
      ok: false,
      outcome: 'failed',
      traceId,
      callId: vapiCallId,
      reason: finalStatusRes.endedReason || 'customer-did-not-answer',
      message: 'No se logró contactar al paciente (sin respuesta o buzón de voz).',
      quota: this.getQuotaSnapshot(),
    };
    if (onFailure) onFailure(failRes);
    return failRes;
  },
};
