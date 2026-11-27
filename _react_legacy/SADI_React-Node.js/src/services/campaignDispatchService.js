// ==============================================================================
// campaignDispatchService.js - MOTOR OMNICANAL DE LANZAMIENTO AUTOMÁTICO
// (LLAMADA IA VAPI PUERTO 13 + SMS OPENVOX PUERTO 13 + CORREO E-MAIL)
// ==============================================================================
// SEGURIDAD ESTRICTA DE ENTORNO:
//   - El lanzamiento AUTOMÁTICO (`runDueCampaignsForToday`) SOLO se ejecuta en
//     entorno de PRUEBAS EN LOCAL (`localhost` / `127.0.0.1` +
//     `VITE_LOCAL_SINGLE_PATIENT_DOC` configurado en `.env.local`, p. ej. 1006010518).
//   - NUNCA dispara campañas automáticas en producción ni sobre la base de 142k pacientes.
//   - WhatsApp se omite deliberadamente en esta fase (solo Llamada IA, SMS y E-mail).
//   - Idempotencia por canal y fecha: si un canal ya fue entregado hoy (ej. SMS),
//     no se duplica automáticamente, pero sí dispara los canales pendientes
//     (ej. Llamada IA o Correo recién habilitado).
// ==============================================================================

import { supabase } from '@/lib/supabase';
import { getLocalSinglePatientDoc } from '@/lib/localSinglePatientSandbox';
import { vapiIntegrationService } from '@/services/vapiIntegrationService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_HOSPITAL_ID = 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8';
const DISPATCH_LEDGER_KEY = 'sadi_campaign_auto_dispatch_ledger_v2';

// Bloqueo en memoria contra lanzamientos concurrentes duplicados
const inFlightDispatches = new Map();

export function isLocalCampaignAutoLaunchAllowed() {
  const onlyDoc = getLocalSinglePatientDoc();
  if (!onlyDoc) return false;
  if (typeof window === 'undefined') return false;
  const host = String(window.location?.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

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
  // WhatsApp se omite deliberadamente en esta etapa
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

export function getCampaignDispatchLedgerEntry(campaignId, todayIso = getColombiaTodayIso()) {
  if (!campaignId) return null;
  const ledger = readLedger();
  return ledger[`${campaignId}::${todayIso}`] || null;
}

export function getPendingAutoChannelsForToday(campaign, todayIso = getColombiaTodayIso()) {
  const ch = extractCampaignChannels(campaign);
  const entry = getCampaignDispatchLedgerEntry(campaign?.id, todayIso);
  return {
    call: Boolean(ch.call && !(Number(entry?.callSent || 0) > 0)),
    sms: Boolean(ch.sms && !(Number(entry?.smsSent || 0) > 0)),
    email: Boolean(ch.email && !(Number(entry?.emailSent || 0) > 0)),
  };
}

export function wasCampaignAutoDispatchedToday(campaignId, todayIso = getColombiaTodayIso(), campaign = null) {
  if (!campaignId) return false;
  const entry = getCampaignDispatchLedgerEntry(campaignId, todayIso);
  if (!entry) return false;
  if (!campaign) {
    return Boolean(entry.callSent > 0 || entry.smsSent > 0 || entry.emailSent > 0);
  }
  const pending = getPendingAutoChannelsForToday(campaign, todayIso);
  return !pending.call && !pending.sms && !pending.email;
}

function mergeCampaignAutoDispatchLedger(campaignId, todayIso, report) {
  if (!campaignId) return;
  const ledger = readLedger();
  const key = `${campaignId}::${todayIso}`;
  const prev = ledger[key] || { callSent: 0, smsSent: 0, emailSent: 0 };
  ledger[key] = {
    dispatchedAt: new Date().toISOString(),
    callSent: Math.max(Number(prev.callSent || 0), Number(report?.call?.enviados || 0)),
    smsSent: Math.max(Number(prev.smsSent || 0), Number(report?.sms?.enviados || 0)),
    emailSent: Math.max(Number(prev.emailSent || 0), Number(report?.email?.enviados || 0)),
    callIds: report?.call?.callIds?.length ? report.call.callIds : (prev.callIds || []),
  };
  writeLedger(ledger);
}

/**
 * Resuelve y enriquece la lista de destinatarios (con phone, email, dirección y curso de vida
 * reales desde public.patients).
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
      .select('patient_id, name, document, phone, email, address, birthdate, curso_vida, grupo_riesgo, grupos_riesgo, sms_opt_in')
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
        address: pat.address || '',
        direccion: pat.address || '',
        birthdate: pat.birthdate || null,
        curso_vida: pat.curso_vida || '',
        grupos_riesgo: Array.isArray(pat.grupos_riesgo) ? pat.grupos_riesgo : [],
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
      .select('patient_id, name, document, phone, email, address, birthdate, curso_vida, sms_opt_in')
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
        address: dbP?.address || p.direccion || p.address || '',
        birthdate: dbP?.birthdate || p.birthdate || null,
        curso_vida: dbP?.curso_vida || p.curso_vida || '',
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
      address: p.address || '',
      birthdate: p.birthdate || null,
      curso_vida: p.curso_vida || '',
    }));
  }

  const { data: fallbackRows } = await supabase
    .from('patients')
    .select('patient_id, name, document, phone, email, address, birthdate, curso_vida, sms_opt_in')
    .eq('hospital_id', hospitalId)
    .limit(50);

  return (fallbackRows || []).map((p) => ({
    patient_id: p.patient_id,
    name: p.name,
    document: p.document,
    phone: p.phone,
    email: p.email,
    address: p.address || '',
    birthdate: p.birthdate || null,
    curso_vida: p.curso_vida || '',
  }));
}

function buildCampaignSmsText(campaign, todayIso) {
  const nombre = String(campaign?.nombre || 'Jornada Preventiva Res. 3280').trim();
  const sede = String(campaign?.lugar || 'Hospital Central SADI').split('·')[0].trim();
  const custom = String(campaign?.mensaje_sms || '').trim();
  const base = custom || `SADI Res. 3280: Hola {nombre}, te invitamos a "${nombre}" (${todayIso}) en ${sede}. Responde SI para confirmar tu asistencia.`;
  return base
    .replaceAll('{campana}', nombre)
    .replaceAll('{sede}', sede)
    .replaceAll('{fecha}', todayIso);
}

function buildCampaignEmailPayload(campaign, todayIso) {
  const nombre = String(campaign?.nombre || 'Jornada Preventiva Res. 3280').trim();
  const sede = String(campaign?.lugar || 'Hospital Central SADI · Santiago de Cali').trim();
  const directriz = String(campaign?.directriz_ia || campaign?.contexto_agente || '').trim();
  const rawSubject = String(campaign?.asunto_email || `Invitación Atención Preventiva SADI · ${nombre}`).trim();
  const rawBody = String(campaign?.mensaje_email || '').trim() || [
    `Hola {paciente},`,
    `Desde el Hospital Central SADI te recordamos tu programación prioritaria en la campaña "${nombre}" bajo la Resolución 3280 de 2018.`,
    directriz ? `Detalle clínico: ${directriz}` : '',
    `Sede: ${sede}\nFecha: ${todayIso}`,
  ].filter(Boolean).join('\n\n');

  const subject = rawSubject
    .replaceAll('{campana}', nombre)
    .replaceAll('{sede}', sede)
    .replaceAll('{fecha}', todayIso);
  const textBody = rawBody
    .replaceAll('{campana}', nombre)
    .replaceAll('{sede}', sede)
    .replaceAll('{fecha}', todayIso);

  return { subject, textBody, sede, fecha: todayIso, exactBody: true };
}

function buildCampaignCallContext(campaign, todayIso, channels) {
  const nombre = String(campaign?.nombre || 'Campaña Preventiva SADI').trim();
  const sede = String(campaign?.lugar || 'Hospital Central SADI').trim();
  const smsTexto = buildCampaignSmsText(campaign, todayIso);
  const emailCfg = buildCampaignEmailPayload(campaign, todayIso);
  const proposito = String(
    campaign?.directriz_ia ||
    campaign?.contexto_agente ||
    campaign?.mensaje_email ||
    campaign?.mensaje_sms ||
    `Informar al paciente sobre la campaña "${nombre}" programada en ${sede} para el ${todayIso} y confirmar su asistencia.`
  ).trim();

  const canalesActivos = [];
  if (channels.call) canalesActivos.push('Llamada telefónica IA');
  if (channels.sms) canalesActivos.push('SMS');
  if (channels.email) canalesActivos.push('Correo electrónico');

  return {
    campaignId: campaign?.id || null,
    nombre,
    proposito,
    sede,
    fecha: todayIso,
    paqueteTipo: campaign?.tipo_origen || 'curso_vida',
    smsTexto: channels.sms ? smsTexto : '',
    emailAsunto: channels.email ? emailCfg.subject : '',
    emailTexto: channels.email ? emailCfg.textBody : '',
    canalesActivos,
  };
}

function persistLocalCampaignDispatchUpdate(campaignId, todayIso, report) {
  try {
    const raw = localStorage.getItem('sadi_campaigns_v2');
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    let changed = false;
    const prevCamp = list.find((c) => c.id === campaignId);
    const prevDateEntry = prevCamp?.auto_dispatched_dates?.[todayIso] || {};

    const mergedCall = report.call || prevDateEntry.call || null;
    const mergedSms = report.sms || prevDateEntry.sms || null;
    const mergedEmail = report.email || prevDateEntry.email || null;

    const totalSent =
      Number(mergedCall?.enviados || 0) +
      Number(mergedSms?.enviados || 0) +
      Number(mergedEmail?.enviados || 0);
    const totalFailed =
      Number(mergedCall?.fallidos || 0) +
      Number(mergedSms?.fallidos || 0) +
      Number(mergedEmail?.fallidos || 0);

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
            call: mergedCall,
            sms: mergedSms,
            email: mergedEmail,
          },
        },
        last_dispatch_report: {
          ...report,
          call: mergedCall,
          sms: mergedSms,
          email: mergedEmail,
        },
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

  // Respaldo local (solo cuando corre `npm run dev` con SMTP/Resend en .env.local)
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

/**
 * Dispara llamadas IA reales de campaña vía Vapi -> Issabel PBX -> OpenVox Puerto 13
 * inyectando el propósito y detalles completos de la campaña al diálogo del agente.
 */
async function dispatchCampaignCalls({ campaign, recipients, hospitalId, todayIso, channels }) {
  const onlyDoc = getLocalSinglePatientDoc();
  const campaignContext = buildCampaignCallContext(campaign, todayIso, channels);
  // En modo prueba local siempre es 1 paciente; en modo normal acota a máx 5 en disparo directo sincrónico
  const callTargets = onlyDoc ? recipients.slice(0, 1) : recipients.slice(0, 5);

  let enviados = 0;
  let fallidos = 0;
  let omitidos = 0;
  const callIds = [];
  const results = [];

  for (const rec of callTargets) {
    const phone = String(rec?.phone || rec?.telefono || '').trim();
    const name = String(rec?.name || rec?.nombre || 'Paciente').trim();
    if (!phone) {
      omitidos += 1;
      results.push({ patientId: rec.patient_id, name, ok: false, status: 'skipped_no_phone' });
      continue;
    }

    try {
      const res = await vapiIntegrationService.triggerLiveCall(phone, {
        patientId: rec.patient_id || null,
        hospitalId,
        nombre: name,
        documento: rec.document || rec.documento || '',
        direccion: rec.address || rec.direccion || '',
        curso_vida: rec.curso_vida || '',
        birthdate: rec.birthdate || null,
        motivoLlamada: `Campaña: ${campaignContext.nombre}`,
        programa3280: campaignContext.nombre,
        routeMode: 'vapi_issabel_port13',
        campaignContext,
      });

      const vapiCallId = res?.data?.id || res?.data?.call?.id || null;
      if (res?.ok && vapiCallId) {
        enviados += 1;
        callIds.push(vapiCallId);
        results.push({
          patientId: rec.patient_id,
          name,
          phone,
          ok: true,
          status: 'initiated',
          vapiCallId,
          gsmPort: 13,
        });
      } else {
        fallidos += 1;
        results.push({
          patientId: rec.patient_id,
          name,
          phone,
          ok: false,
          status: 'failed',
          error: res?.data?.message || res?.error || 'Error iniciando llamada Vapi',
        });
      }
    } catch (e) {
      fallidos += 1;
      results.push({
        patientId: rec.patient_id,
        name,
        phone,
        ok: false,
        status: 'failed',
        error: e?.message || 'Excepción iniciando llamada Vapi',
      });
    }
  }

  return {
    success: enviados > 0,
    enviados,
    fallidos,
    omitidos,
    callIds,
    results,
  };
}

export function formatDispatchSummary(report) {
  if (!report) return 'Sin resultado de despacho.';
  const ch = report.channels || {};
  const parts = [];
  if (ch.call || report.call) {
    const cSent = Number(report?.call?.enviados || 0);
    const cFail = Number(report?.call?.fallidos || 0);
    parts.push(
      cSent > 0
        ? `Llamada IA (P. 13): ${cSent} iniciada(s)`
        : cFail > 0
        ? `Llamada IA: ${cFail} fallida(s)`
        : 'Llamada IA: ya enviada hoy'
    );
  }
  if (ch.sms || report.sms) {
    const sSent = Number(report?.sms?.enviados || 0);
    const sFail = Number(report?.sms?.fallidos || 0);
    parts.push(
      sSent > 0
        ? `SMS (P. 13): ${sSent} enviado(s)`
        : sFail > 0
        ? `SMS (P. 13): ${sFail} fallido(s)`
        : 'SMS (P. 13): ya enviado hoy'
    );
  }
  if (ch.email || report.email) {
    const eSent = Number(report?.email?.enviados || 0);
    const eFail = Number(report?.email?.fallidos || 0);
    if (report?.email?.missingConfig) {
      parts.push('Correo: falta configurar SMTP/Resend');
    } else if (eSent > 0) {
      parts.push(`Correo: ${eSent} enviado(s)`);
    } else if (eFail > 0) {
      parts.push(`Correo: ${eFail} fallido(s)`);
    } else {
      parts.push('Correo: ya enviado hoy');
    }
  }
  return parts.join(' | ') || report.error || 'Sin canales activos.';
}

export const campaignDispatchService = {
  isLocalCampaignAutoLaunchAllowed,
  getColombiaTodayIso,
  isCampaignStartingToday,
  extractCampaignChannels,
  getPendingAutoChannelsForToday,
  wasCampaignAutoDispatchedToday,
  formatDispatchSummary,

  /**
   * Consulta si el correo (Edge Function o relay local Vite) está configurado.
   */
  async checkEmailProviderStatus() {
    if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      try {
        const r = await fetch('/api/local-email-status');
        if (r.ok) {
          const d = await r.json();
          if (d?.configured) return { configured: true, provider: d.provider || 'smtp_local' };
        }
      } catch { /* ignore */ }
    }
    try {
      const r = await fetch('https://openvox.apropiatic.com.co/sadi/email-status');
      if (r.ok) {
        const d = await r.json();
        return { configured: Boolean(d?.configured), provider: d?.provider || null };
      }
    } catch { /* ignore */ }
    return { configured: false, provider: null };
  },

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
      exactBody: true,
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
   * Ejecuta el despacho REAL de los 3 canales (Llamada IA + SMS + Correo) de una campaña.
   * - Si `force === false` (modo automático): exige `isLocalCampaignAutoLaunchAllowed()` y
   *   dispara únicamente los canales habilitados que aún NO hayan tenido éxito hoy.
   * - Si `force === true` (botón manual "Emitir Ahora"): dispara todos los canales habilitados.
   */
  async dispatchCampaignChannelsNow(campaign, { hospitalId = null, force = false } = {}) {
    const todayIso = getColombiaTodayIso();
    const allChannels = extractCampaignChannels(campaign);
    const startsToday = isCampaignStartingToday(campaign, todayIso);

    if (!force && !isLocalCampaignAutoLaunchAllowed()) {
      return {
        skipped: true,
        reason: 'auto_launch_restricted_to_local_sandbox',
        todayIso,
        channels: allChannels,
      };
    }

    if (!force && !startsToday) {
      return {
        skipped: true,
        reason: 'not_today',
        todayIso,
        channels: allChannels,
      };
    }

    if (!allChannels.call && !allChannels.sms && !allChannels.email) {
      return {
        skipped: true,
        reason: 'no_dispatchable_channels',
        todayIso,
        channels: allChannels,
      };
    }

    // Determinar exactamente qué canales ejecutar en esta pasada
    const targetChannels = force
      ? { call: allChannels.call, sms: allChannels.sms, email: allChannels.email }
      : getPendingAutoChannelsForToday(campaign, todayIso);

    if (!targetChannels.call && !targetChannels.sms && !targetChannels.email) {
      return {
        skipped: true,
        reason: 'already_dispatched_today',
        todayIso,
        channels: allChannels,
      };
    }

    const flightKey = `${campaign?.id || 'anon'}::${todayIso}`;
    if (inFlightDispatches.has(flightKey)) {
      return inFlightDispatches.get(flightKey);
    }

    const execPromise = (async () => {
      const hospUuid = getStoredHospitalUuid(hospitalId || campaign?.hospital_id);
      const onlyDoc = getLocalSinglePatientDoc();
      const recipients = await resolveRecipientsForCampaign(campaign, hospUuid);

      if (recipients.length === 0) {
        return {
          success: false,
          skipped: false,
          todayIso,
          channels: targetChannels,
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
        channels: targetChannels,
        recipientsCount: recipients.length,
        onlyDocument: onlyDoc || null,
        call: null,
        sms: null,
        email: null,
      };

      const tasks = [];

      // 1. SMS REAL (OpenVox Puerto 13) con el texto exacto de la campaña
      if (targetChannels.sms) {
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

      // 2. CORREO E-MAIL REAL con el asunto y cuerpo exactos de la campaña
      if (targetChannels.email) {
        const emailCfg = buildCampaignEmailPayload(campaign, todayIso);
        tasks.push(
          invokeEmailDispatch({
            campaignId: campaign.id,
            campaignName: campaign.nombre,
            hospitalId: hospUuid,
            subject: emailCfg.subject,
            textBody: emailCfg.textBody,
            exactBody: true,
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

      // 3. LLAMADA IA REAL (Vapi -> Issabel -> OpenVox Puerto 13) con el propósito y detalles de la campaña
      if (targetChannels.call) {
        tasks.push(
          dispatchCampaignCalls({
            campaign,
            recipients,
            hospitalId: hospUuid,
            todayIso,
            channels: allChannels,
          })
            .then((res) => {
              report.call = res;
            })
            .catch((e) => {
              report.call = { success: false, enviados: 0, fallidos: recipients.length, callIds: [], error: e?.message || 'Error Llamada IA' };
            })
        );
      }

      await Promise.all(tasks);

      const callOk = !targetChannels.call || Number(report.call?.enviados || 0) > 0;
      const smsOk = !targetChannels.sms || Number(report.sms?.enviados || 0) > 0;
      const emailOk = !targetChannels.email || Number(report.email?.enviados || 0) > 0;
      report.success = Boolean(
        (targetChannels.call && Number(report.call?.enviados || 0) > 0) ||
        (targetChannels.sms && Number(report.sms?.enviados || 0) > 0) ||
        (targetChannels.email && Number(report.email?.enviados || 0) > 0)
      );
      report.allChannelsSucceeded = callOk && smsOk && emailOk;

      // Persistir siempre el resultado por canal (solo marca como "ya enviado" los canales que tuvieron enviados > 0)
      mergeCampaignAutoDispatchLedger(campaign.id, todayIso, report);
      persistLocalCampaignDispatchUpdate(campaign.id, todayIso, report);

      return report;
    })();

    inFlightDispatches.set(flightKey, execPromise);
    try {
      return await execPromise;
    } finally {
      inFlightDispatches.delete(flightKey);
    }
  },

  /**
   * Revisa campañas locales programadas para HOY y dispara automáticamente
   * los canales pendientes (Llamada IA + SMS + Correo).
   * BLOQUEO ESTRICTO: SOLO opera en entorno de Pruebas en Local (localhost + 1 paciente).
   * NUNCA dispara campañas de producción.
   */
  async runDueCampaignsForToday(campaignsList = [], { hospitalId = null } = {}) {
    if (!isLocalCampaignAutoLaunchAllowed()) {
      return [];
    }
    const todayIso = getColombiaTodayIso();
    const dispatched = [];
    for (const camp of campaignsList || []) {
      if (!camp) continue;
      // Seguridad extra: en pruebas en local solo auto-disparamos campañas locales (`camp_*`)
      if (!String(camp.id || '').startsWith('camp_')) continue;
      const st = String(camp.estado || '').toLowerCase();
      if (st === 'completada' || st === 'cancelada' || st === 'eliminada') continue;
      if (!isCampaignStartingToday(camp, todayIso)) continue;
      const pending = getPendingAutoChannelsForToday(camp, todayIso);
      if (!pending.call && !pending.sms && !pending.email) continue;

      const res = await this.dispatchCampaignChannelsNow(camp, { hospitalId, force: false });
      if (!res.skipped) {
        dispatched.push(res);
      }
    }
    return dispatched;
  },
};
