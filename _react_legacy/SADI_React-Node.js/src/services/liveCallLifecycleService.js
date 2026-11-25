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
  } catch {}
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
    } catch {}
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
    } catch {}
  });
  try {
    window.dispatchEvent(new CustomEvent('sadi:daily-quota-updated', { detail: snap }));
  } catch {}
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
    } catch (e) {
      console.warn('Error registrando outcome de llamada en Supabase:', e?.message);
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
    return { ok: false, quota: { ...quotaState } };
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
        } catch {}
      }
      return st;
    };

    const cleanPhone = String(phoneNumber || '').trim();
    if (!cleanPhone || cleanPhone.toLowerCase().includes('sin tel')) {
      emitState('failed', { error: 'Paciente sin teléfono registrado' });
      await sleep(TERMINAL_HOLD_MS);
      emitState('idle');
      const failRes = { ok: false, outcome: 'failed', reason: 'no_phone', message: 'El paciente no tiene teléfono registrado.' };
      if (onFailure) onFailure(failRes);
      return failRes;
    }

    // 1. Iniciar en estado de carga "Llamando" (permanece hasta que contesten o falle)
    emitState('calling', { callId: null, startedAt: Date.now() });

    const effectiveAntiVmCfg = antiVoicemailConfig || ivrScheduleService.getConfig();
    const callPayload = {
      ...patientData,
      patientId: patientData.patientId || patientData.id || null,
      hospitalId: patientData.hospitalId || patientData.hospital_id || getStoredHospitalUuid(),
      gsmPort: patientData.gsmPort || OPENVOX_INDIVIDUAL_PORT_CONFIG.port,
      callerNumber: patientData.callerNumber || OPENVOX_INDIVIDUAL_PORT_CONFIG.callerNumber,
      phoneNumberId: patientData.phoneNumberId || OPENVOX_INDIVIDUAL_PORT_CONFIG.vapiPhoneNumberId,
    };

    let triggerRes = null;
    try {
      triggerRes = await vapiIntegrationService.triggerLiveCall(cleanPhone, callPayload, effectiveAntiVmCfg);
    } catch (err) {
      triggerRes = { ok: false, status: 500, data: { message: err?.message || 'Error de red' } };
    }

    const vapiCallId = triggerRes?.data?.id || triggerRes?.data?.callId || null;
    if (!triggerRes?.ok || !vapiCallId) {
      const errMsg =
        triggerRes?.data?.message ||
        triggerRes?.data?.error ||
        (triggerRes?.status === 401
          ? 'Llave VAPI_PRIVATE_KEY no autorizada (401) en Supabase.'
          : 'No se pudo conectar la llamada por Puerto 1.');

      await this.recordOutcomeInDb({
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

      emitState('failed', { error: errMsg });
      await sleep(TERMINAL_HOLD_MS);
      emitState('idle');
      const failRes = { ok: false, outcome: 'failed', status: triggerRes?.status || 500, reason: errMsg, message: errMsg, data: triggerRes?.data };
      if (onFailure) onFailure(failRes);
      return failRes;
    }

    // 2. Llamada creada en Vapi -> mantener "Llamando" hasta que contesten ("En Llamada...") o cuelguen
    emitState('calling', { callId: vapiCallId });

    const pollStart = Date.now();
    let wasAnswered = false;
    let consecutivePollErrors = 0;
    let finalStatusRes = null;

    while (Date.now() - pollStart < MAX_POLL_DURATION_MS) {
      await sleep(POLL_INTERVAL_MS);
      const st = await vapiIntegrationService.getLiveCallStatus(vapiCallId);

      if (!st || st.ok === false) {
        consecutivePollErrors += 1;
        if (consecutivePollErrors >= 3) {
          finalStatusRes = {
            phase: 'ended',
            isSuccess: wasAnswered,
            endedReason: st?.endedReason || 'poll-failed',
            durationSeconds: wasAnswered ? Math.max(1, Math.round((Date.now() - pollStart) / 1000)) : 0,
          };
          break;
        }
        continue;
      }

      consecutivePollErrors = 0;

      if (st.phase === 'in_call' || st.answered === true && st.phase !== 'ended') {
        if (!wasAnswered) {
          wasAnswered = true;
          emitState('in_call', { callId: vapiCallId, answeredAt: Date.now() });
        }
        continue;
      }

      if (st.phase === 'calling') {
        continue;
      }

      if (st.phase === 'ended') {
        finalStatusRes = st;
        break;
      }
    }

    if (!finalStatusRes) {
      finalStatusRes = {
        phase: 'ended',
        isSuccess: wasAnswered,
        endedReason: wasAnswered ? 'max-duration-reached' : 'timeout-no-answer',
        durationSeconds: wasAnswered ? Math.max(1, Math.round((Date.now() - pollStart) / 1000)) : 0,
      };
    }

    const succeeded = Boolean(finalStatusRes.isSuccess);

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
      emitState('idle');
      const okRes = {
        ok: true,
        outcome: 'success',
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
    await Promise.all([
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
    emitState('idle');
    const failRes = {
      ok: false,
      outcome: 'failed',
      callId: vapiCallId,
      reason: finalStatusRes.endedReason || 'customer-did-not-answer',
      message: 'No se logró contactar al paciente (sin respuesta o buzón de voz).',
      quota: this.getQuotaSnapshot(),
    };
    if (onFailure) onFailure(failRes);
    return failRes;
  },
};
