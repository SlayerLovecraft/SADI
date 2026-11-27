// ==============================================================================
// campaignDispatchService.js - MOTOR DE LANZAMIENTO AUTOMÁTICO DE SMS Y CORREOS
// ==============================================================================
// Cuando una campaña arranca HOY (fecha_programada === hoy o fechas_ejecucion
// incluye hoy) o el usuario pulsa "Emitir Ahora" / "Relanzar", este servicio:
//   1. Resuelve los destinatarios reales (en modo prueba local restringe 100%
//      al documento VITE_LOCAL_SINGLE_PATIENT_DOC, p. ej. 1006010518).
//   2. Si la campaña incluye SMS -> envía SMS REALES por OpenVox Puerto 13
//      vía Edge Function `send-sms` (mode: 'direct').
//   3. Si la campaña incluye Correo E-mail -> envía Correos REALES vía Edge
//      Function `send-campaign-email` (con respaldo opcional local `/api/local-send-email`
//      si hay SMTP local en .env.local).
//   4. Persiste el reporte de despacho por fecha (`auto_dispatched_dates[hoy]`)
//      para garantizar idempotencia y actualizar los contadores en pantalla.
// ==============================================================================

import { supabase } from '@/lib/supabase';
import { getLocalSinglePatientDoc } from '@/lib/localSinglePatientSandbox';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_HOSPITAL_ID = 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8';
const DISPATCH_LEDGER_KEY = 'sadi_campaign_auto_dispatch_ledger_v1';

export function getColombiaTodayIso(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch { /* fallback */ }
  return now.toISOString().slice(0, 10);
}

export function getCampaignDatesList(campaign) {
  if (!campaign) return [];
  const raw = [];
  if (Array.isArray(campaign.fechas_ejecucion) && campaign.fechas_ejecucion.length > 0) {
    raw.push(...campaign.fechas_ejecucion);
  }
  if (Array.isArray(campaign.config_frecuencia?.selectedDates) && campaign.config_frecuencia.selectedDates.length > 0) {
    raw.push(...campaign.config_frecuencia.selectedDates);
  }
  if (campaign.fecha_programada) {
    raw.push(campaign.fecha_programada);
  }
  return [...new Set(raw.map((d) => String(d || '').slice(0, 10)).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)))];
}

export function isCampaignStartingToday(campaign, todayIso = getColombiaTodayIso()) {
  const dates = getCampaignDatesList(campaign);
  return dates.includes(todayIso);
}

export function extractCampaignChannels(campaign) {
  const det = campaign?.canales_detalle && typeof campaign.canales_detalle === 'object'
    ? campaign.canales_detalle
    : null;
  const canalStr = String(campaign?.canal || '').toLowerCase();

  const hasSms = Boolean(
    det?.sms === true ||
    /\bsms\b/.test(canalStr) ||
    Number(campaign?.sms_respaldo_asignados || 0) > 0
  );
  const hasEmail = Boolean(
    det?.email === true ||
    /(email|e-mail|correo|mail)/.test(canalStr)
  );
  const hasCall = Boolean(
    det?.call === true ||
    /(call|llamada|voz|ivr)/.test(canalStr) ||
    Number(campaign?.llamadas_ia_asignadas || 0) > 0
  );

  // Si es una campaña legacy sin metadatos de canales pero tiene template_id (campañas SMS clásicas)
  if (!hasSms && !hasEmail && !hasCall && campaign?.template_id) {
    return { sms: true, email: false, call: false };
  }
  return { sms: hasSms, email: hasEmail, call: hasCall };
}

function getStoredHospitalUuid(overrideId = null) {
  if (overrideId && UUID_REGEX.test(String(overrideId))) return String(overrideId);
  try {
    const u = JSON.parse(localStorage.getItem('sadi_user') || '{}');
    const cand = String(u?.hospitalId || u?.hospital_id || '').trim();
    if (UUID_REGEX.test(cand)) return cand;
  } catch { /* ignore */ }
  return DEFAULT_HOSPITAL_ID;
}

function readLedger() {
  try {
    const raw = localStorage.getItem(DISPATCH_LEDGER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLedger(ledger) {
  try {
    localStorage.setItem(DISPATCH_LEDGER_KEY, JSON.stringify(ledger));
  } catch { /* ignore */ }
}

export function wasCampaignAutoDispatchedToday(campaignId, todayIso = getColombiaTodayIso()) {
  if (!campaignId) return false;
  const ledger = readLedger();
  return Boolean(ledger[`${campaignId}::${todayIso}`]);
}

function markCampaignAutoDispatchedToday(campaignId, todayIso, report) {
  if (!campaignId) return;
  const ledger = readLedger();
  ledger[`${campaignId}::${todayIso}`] = {
    dispatchedAt: new Date().toISOString(),
    smsSent: report?.sms?.enviados || 0,
    emailSent: report?.email?.enviados || 0,
  };
  writeLedger(ledger);
}

/**
 * Resuelve y enriquece la lista de destinatarios (con phone + email reales desde public.patients).
 * En modo prueba local (VITE_LOCAL_SINGLE_PATIENT_DOC), garantiza que SOLO el paciente configurado
 * (ej. 1006010518) sea retornado.
 */
async function resolveRecipientsForCampaign(campaign, hospitalId) {
  const onlyDoc = getLocalSinglePatientDoc();
  const rawList = Array.isArray(campaign?.pacientes_detalle) ? campaign.pacientes_detalle : [];

  // En modo prueba local 1-paciente: traer SIEMPRE el registro fresco real de ese único paciente
  if (onlyDoc) {
    const { data: patRows } = await supabase
      .from('patients')
      .select('patient_id, name, document, phone, email, curso_vida, grupo_riesgo, grupos_riesgo, sms_opt_in')
      .eq('document', onlyDoc)
      .limit(1);

    const pat = Array.isArray(patRows) && patRows.length > 0 ? patRows[0] : null;
    if (pat) {
      return [{
        patient_id: pat.patient_id,
        id: pat.patient_id,
        name: pat.name,
        nombre: pat.name,
        document: pat.document,
        documento: pat.document,
        phone: pat.phone,
        telefono: pat.phone,
        email: pat.email,
      }];
    }
    return rawList.filter((p) => String(p.documento || p.document || p.cc || '').trim() === onlyDoc);
  }

  // Modo normal: usar pacientes_detalle y enriquecer emails/teléfonos faltantes desde Supabase
  const baseIds = [...new Set([
    ...rawList.map((p) => p.patient_id || p.patientId || p.id),
    ...(Array.isArray(campaign?.pacientes_ids) ? campaign.pacientes_ids : []),
  ].filter((id) => UUID_REGEX.test(String(id || ''))))];

  const byId = new Map();
  if (baseIds.length > 0) {
    const { data: patRows } = await supabase
      .from('patients')
      .select('patient_id, name, document, phone, email, sms_opt_in')
      .in('patient_id', baseIds.slice(0, 200));
    for (const p of patRows || []) {
      byId.set(String(p.patient_id), p);
    }
  }

  if (rawList.length > 0) {
    return rawList.map((p) => {
      const pid = String(p.patient_id || p.patientId || p.id || '');
      const dbP = byId.get(pid);
      return {
        patient_id: dbP?.patient_id || (UUID_REGEX.test(pid) ? pid : null),
        name: dbP?.name || p.nombre || p.name || 'Paciente',
        document: dbP?.document || p.documento || p.document || p.cc || '',
        phone: dbP?.phone || p.telefono || p.phone || '',
        email: dbP?.email || p.email || '',
      };
    });
  }

  if (byId.size > 0) {
    return Array.from(byId.values()).map((p) => ({
      patient_id: p.patient_id,
      name: p.name,
      document: p.document,
      phone: p.phone,
      email: p.email,
    }));
  }

  // Fallback si la campaña no guardó lista explícita: consultar los primeros pacientes del hospital
  const { data: fallbackRows } = await supabase
    .from('patients')
    .select('patient_id, name, document, phone, email, sms_opt_in')
    .eq('hospital_id', hospitalId)
    .limit(50);

  return (fallbackRows || []).map((p) => ({
    patient_id: p.patient_id,
    name: p.name,
    document: p.document,
    phone: p.phone,
    email: p.email,
  }));
}

function buildCampaignSmsText(campaign, todayIso) {
  const nombre = String(campaign?.nombre || 'Jornada Preventiva Res. 3280').trim();
  const sede = String(campaign?.lugar || 'Hospital Central SADI').split('·')[0].trim();
  const custom = String(campaign?.mensaje_sms || '').trim();
  if (custom) return custom;
  return `SADI Res. 3280: Hola {nombre}, te invitamos a "${nombre}" (${todayIso}) en ${sede}. Responde SI para confirmar tu asistencia.`;
}

function buildCampaignEmailPayload(campaign, todayIso) {
  const nombre = String(campaign?.nombre || 'Jornada Preventiva Res. 3280').trim();
  const sede = String(campaign?.lugar || 'Hospital Central SADI · Santiago de Cali').trim();
  const directriz = String(campaign?.directriz_ia || campaign?.contexto_agente || '').trim();
  const subject = String(campaign?.asunto_email || `Invitación Atención Preventiva SADI · ${nombre}`).trim();
  const textBody = String(campaign?.mensaje_email || '').trim() || [
    `Desde el Hospital Central SADI te recordamos tu programación prioritaria en la campaña "${nombre}" bajo la Resolución 3280 de 2018.`,
    directriz ? `Detalle clínico: ${directriz}` : '',
    `Te esperamos en ${sede}. Si deseas confirmar o reprogramar tu atención preventiva, responde a este correo o al SMS enviado.`,
  ].filter(Boolean).join('\n\n');

  return { subject, textBody, sede, fecha: todayIso };
}

function persistLocalCampaignDispatchUpdate(campaignId, todayIso, report) {
  try {
    const raw = localStorage.getItem('sadi_campaigns_v2');
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    let changed = false;
    const totalSent = (report?.sms?.enviados || 0) + (report?.email?.enviados || 0);
    const totalFailed = (report?.sms?.fallidos || 0) + (report?.email?.fallidos || 0);

    const updated = list.map((c) => {
      if (c.id !== campaignId) return c;
      changed = true;
      return {
        ...c,
        estado: totalSent > 0 ? 'activa' : (c.estado || 'programada'),
        enviados: Math.max(Number(c.enviados || 0), totalSent),
        entregados: Math.max(Number(c.entregados || 0), totalSent),
        fallidos: totalFailed,
        auto_dispatched_dates: {
          ...(c.auto_dispatched_dates || {}),
          [todayIso]: {
            dispatchedAt: new Date().toISOString(),
            sms: report.sms || null,
            email: report.email || null,
          },
        },
        last_dispatch_report: report,
      };
    });

    if (changed) {
      localStorage.setItem('sadi_campaigns_v2', JSON.stringify(updated));
      window.dispatchEvent(new Event('sadi:campaigns-updated'));
    }
  } catch { /* ignore */ }
}

/**
 * Envío de correo real: primero intenta Edge Function `send-campaign-email`,
 * y si en entorno local el backend reporta `missingConfig` intenta el relay local Vite `/api/local-send-email`.
 */
async function invokeEmailDispatch(payload) {
  let edgeRes = null;
  let edgeErr = null;
  try {
    const { data, error } = await supabase.functions.invoke('send-campaign-email', {
      body: payload,
    });
    edgeRes = data;
    edgeErr = error;
  } catch (e) {
    edgeErr = e;
  }

  // Si funcionó en Edge Function, devolver directo
  if (!edgeErr && edgeRes && !edgeRes.missingConfig && (edgeRes.enviados > 0 || edgeRes.omitidos > 0)) {
    return edgeRes;
  }

  // Respaldo local (solo cuando corre `npm run dev` con SMTP en .env.local)
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    try {
      const localResp = await fetch('/api/local-send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (localResp.ok) {
        const localData = await localResp.json();
        if (localData && (localData.enviados > 0 || !localData.missingConfig)) {
          return localData;
        }
      }
    } catch { /* sin middleware local */ }
  }

  if (edgeRes) return edgeRes;
  return {
    success: false,
    missingConfig: false,
    enviados: 0,
    fallidos: payload.recipients?.length || 0,
    omitidos: 0,
    error: edgeErr?.message || 'Error invocando send-campaign-email',
    results: [],
  };
}

export const campaignDispatchService = {
  getColombiaTodayIso,
  isCampaignStartingToday,
  extractCampaignChannels,
  wasCampaignAutoDispatchedToday,

  /**
   * Envío individual directo de SMS (Puerto 13 OpenVox) — usado desde Demanda Res. 3280 / Inasistentes.
   */
  async sendIndividualSms({ patientId = null, name = 'Paciente', document = '', phone, message, hospitalId = null, forceResend = true }) {
    const hospUuid = getStoredHospitalUuid(hospitalId);
    const onlyDoc = getLocalSinglePatientDoc();
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: {
        mode: 'direct',
        hospitalId: hospUuid,
        campaignName: 'Demanda Inducida Individual Res. 3280',
        message,
        preferredPorts: [13],
        forceResend,
        onlyDocument: onlyDoc || undefined,
        recipients: [{ patient_id: patientId, name, document, phone }],
      },
    });
    if (error) {
      return { success: false, error: error.message || 'Error invocando send-sms' };
    }
    const first = Array.isArray(data?.results) ? data.results[0] : null;
    return {
      success: Boolean(data?.enviados > 0 || first?.ok),
      winningPort: first?.winningPort ?? 13,
      gatewayMessageId: first?.gatewayMessageId || null,
      status: first?.status || (data?.enviados > 0 ? 'sent' : 'failed'),
      error: first?.error || data?.error || null,
      data,
    };
  },

  /**
   * Envío individual directo de Correo E-mail — usado desde Inasistentes / pruebas directas.
   */
  async sendIndividualEmail({ patientId = null, name = 'Paciente', document = '', email, subject, textBody, sede = 'Hospital Central SADI', hospitalId = null }) {
    const hospUuid = getStoredHospitalUuid(hospitalId);
    const onlyDoc = getLocalSinglePatientDoc();
    const res = await invokeEmailDispatch({
      hospitalId: hospUuid,
      campaignName: subject || 'Seguimiento Clínico SADI Res. 3280',
      subject,
      textBody,
      sede,
      fecha: getColombiaTodayIso(),
      onlyDocument: onlyDoc || undefined,
      recipients: [{ patient_id: patientId, name, document, email }],
    });
    const first = Array.isArray(res?.results) ? res.results[0] : null;
    return {
      success: Boolean(res?.enviados > 0 || first?.ok),
      missingConfig: Boolean(res?.missingConfig),
      provider: first?.provider || null,
      messageId: first?.messageId || null,
      error: first?.error || res?.error || null,
      data: res,
    };
  },

  /**
   * Ejecuta el despacho REAL de SMS y Correos de una campaña (si corresponde hoy o si force=true).
   */
  async dispatchCampaignChannelsNow(campaign, { hospitalId = null, force = false } = {}) {
    const todayIso = getColombiaTodayIso();
    const channels = extractCampaignChannels(campaign);
    const startsToday = isCampaignStartingToday(campaign, todayIso);

    if (!force && !startsToday) {
      return {
        skipped: true,
        reason: 'not_today',
        todayIso,
        channels,
      };
    }

    if (!channels.sms && !channels.email) {
      return {
        skipped: true,
        reason: 'no_sms_or_email_channels',
        todayIso,
        channels,
      };
    }

    if (!force && wasCampaignAutoDispatchedToday(campaign.id, todayIso)) {
      return {
        skipped: true,
        reason: 'already_dispatched_today',
        todayIso,
        channels,
      };
    }

    const hospUuid = getStoredHospitalUuid(hospitalId || campaign?.hospital_id);
    const onlyDoc = getLocalSinglePatientDoc();
    const recipients = await resolveRecipientsForCampaign(campaign, hospUuid);

    if (recipients.length === 0) {
      return {
        success: false,
        skipped: false,
        todayIso,
        channels,
        recipientsCount: 0,
        error: onlyDoc
          ? `No se encontró el paciente de prueba local (CC ${onlyDoc}) para despachar.`
          : 'La campaña no tiene destinatarios válidos.',
      };
    }

    const report = {
      success: false,
      todayIso,
      campaignId: campaign.id,
      campaignName: campaign.nombre,
      channels,
      recipientsCount: recipients.length,
      onlyDocument: onlyDoc || null,
      sms: null,
      email: null,
    };

    const tasks = [];

    if (channels.sms) {
      const smsText = buildCampaignSmsText(campaign, todayIso);
      tasks.push(
        supabase.functions
          .invoke('send-sms', {
            body: {
              mode: 'direct',
              campaignId: campaign.id,
              campaignName: campaign.nombre,
              hospitalId: hospUuid,
              message: smsText,
              preferredPorts: [13],
              dateTag: todayIso,
              forceResend: Boolean(force),
              onlyDocument: onlyDoc || undefined,
              recipients,
            },
          })
          .then(({ data, error }) => {
            report.sms = error
              ? { success: false, enviados: 0, fallidos: recipients.length, error: error.message }
              : data;
          })
          .catch((e) => {
            report.sms = { success: false, enviados: 0, fallidos: recipients.length, error: e?.message || 'Error SMS' };
          })
      );
    }

    if (channels.email) {
      const emailCfg = buildCampaignEmailPayload(campaign, todayIso);
      tasks.push(
        invokeEmailDispatch({
          campaignId: campaign.id,
          campaignName: campaign.nombre,
          hospitalId: hospUuid,
          subject: emailCfg.subject,
          textBody: emailCfg.textBody,
          sede: emailCfg.sede,
          fecha: emailCfg.fecha,
          onlyDocument: onlyDoc || undefined,
          recipients,
        })
          .then((res) => {
            report.email = res;
          })
          .catch((e) => {
            report.email = { success: false, enviados: 0, fallidos: recipients.length, error: e?.message || 'Error Email' };
          })
      );
    }

    await Promise.all(tasks);

    const smsOk = !channels.sms || Number(report.sms?.enviados || 0) > 0;
    const emailOk = !channels.email || Number(report.email?.enviados || 0) > 0;
    report.success = Boolean(
      (channels.sms && Number(report.sms?.enviados || 0) > 0) ||
      (channels.email && Number(report.email?.enviados || 0) > 0)
    );
    report.allChannelsSucceeded = smsOk && emailOk;

    if (report.success) {
      markCampaignAutoDispatchedToday(campaign.id, todayIso, report);
      persistLocalCampaignDispatchUpdate(campaign.id, todayIso, report);
    }

    return report;
  },

  /**
   * Revisa todas las campañas programadas (localStorage + BD) y dispara automáticamente
   * las que arranquen HOY y aún no hayan sido enviadas hoy.
   */
  async runDueCampaignsForToday(campaignsList = [], { hospitalId = null } = {}) {
    const todayIso = getColombiaTodayIso();
    const dispatched = [];
    for (const camp of campaignsList || []) {
      if (!camp) continue;
      const st = String(camp.estado || '').toLowerCase();
      if (st === 'completada' || st === 'cancelada' || st === 'eliminada') continue;
      if (!isCampaignStartingToday(camp, todayIso)) continue;
      const ch = extractCampaignChannels(camp);
      if (!ch.sms && !ch.email) continue;
      if (wasCampaignAutoDispatchedToday(camp.id, todayIso)) continue;

      const res = await this.dispatchCampaignChannelsNow(camp, { hospitalId, force: false });
      if (!res.skipped) {
        dispatched.push(res);
      }
    }
    return dispatched;
  },
};
