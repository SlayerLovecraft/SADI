// ==============================================================================
// campaignTraceabilityService.js - SERVICIO DE TRAZABILIDAD OMNICANAL & EXCEL
// ==============================================================================
// Consulta y sincroniza respuestas reales de SMS (OpenVox Puerto 13), Llamadas IA
// (Vapi), Correos E-mail y WhatsApp desde `public.campaign_channel_traceability`
// y la Edge Function `sync-campaign-responses`, clasifica estados y genera Excel.
// ==============================================================================

import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { getLocalSinglePatientDoc } from '@/lib/localSinglePatientSandbox';

export const CHANNEL_META = {
  sms: {
    key: 'sms',
    label: 'SMS (OpenVox Puerto 13)',
    shortLabel: 'SMS',
    excelFilePrefix: 'Trazabilidad_SMS_Campanas',
  },
  call: {
    key: 'call',
    label: 'Llamadas IA (Vapi · Puerto 13)',
    shortLabel: 'Llamada IA',
    excelFilePrefix: 'Trazabilidad_Llamadas_Campanas',
  },
  email: {
    key: 'email',
    label: 'Correos Electrónicos (E-mail)',
    shortLabel: 'Correo E-mail',
    excelFilePrefix: 'Trazabilidad_Correos_Campanas',
  },
  whatsapp: {
    key: 'whatsapp',
    label: 'WhatsApp',
    shortLabel: 'WhatsApp',
    excelFilePrefix: 'Trazabilidad_WhatsApp_Campanas',
  },
};

export const RESPONSE_STATUS_LABELS = {
  confirma_asistencia: 'Confirma Asistencia',
  no_puede_asistir: 'No Puede Asistir',
  pendiente: 'Pendiente por Confirmación',
};

export function normalizeSpanishText(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NEGATIVE_RX = [
  /\bno\s+puedo(\s+ir|\s+asistir)?\b/,
  /\bno\s+voy\b/,
  /\bno\s+asisto\b/,
  /\bno\s+asistire\b/,
  /\bno\s+ire\b/,
  /\bno\s+estare\b/,
  /\bno\s+acepto\b/,
  /\bno\s+confirmo\b/,
  /\bno\s+me\s+sirve\b/,
  /\bno\s+gracias\b/,
  /\bcancel[oa]r?\b/,
  /\breprogram\w*\b/,
  /\breagend\w*\b/,
  /\botro\s+dia\b/,
  /\bimposible\b/,
  /\bocupad[oa]\b/,
  /\bnegativo\b/,
  /\brechaz[oa]\b/,
  /\bdeclin[oa]\b/,
  /^2$/,
  /^dos$/,
  /^no$/,
];

const POSITIVE_RX = [
  /\bconfirmo(\s+asistencia|\s+mi\s+asistencia)?\b/,
  /\bconfirmad[oa]\b/,
  /\bacepto\b/,
  /\bpuedo\s+ir\b/,
  /\bsi\s+puedo\b/,
  /\bsi\s+voy\b/,
  /\bsi\s+asisto\b/,
  /\bsi\s+asistire\b/,
  /\basisto\b/,
  /\basistire\b/,
  /\balli\s+estare\b/,
  /\bahi\s+estare\b/,
  /\bclaro(\s+que\s+si)?\b/,
  /\bpor\s+supuesto\b/,
  /\bcon\s+gusto\b/,
  /\bde\s+acuerdo\b/,
  /\bcuenten\s+conmigo\b/,
  /\bafirmativo\b/,
  /\bpositivo\b/,
  /\bperfecto\b/,
  /\blisto\b/,
  /\bvale\b/,
  /\bok\b/,
  /\byes\b/,
  /^1$/,
  /^uno$/,
  /^si$/,
  /\bsi\b/,
  /\bvoy\b/,
];

export function classifyAttendanceText(rawText) {
  const norm = normalizeSpanishText(rawText);
  if (!norm) return 'pendiente';
  for (const rx of NEGATIVE_RX) {
    if (rx.test(norm)) return 'no_puede_asistir';
  }
  for (const rx of POSITIVE_RX) {
    if (rx.test(norm)) return 'confirma_asistencia';
  }
  return 'pendiente';
}

export function formatColombiaDateTime(isoString) {
  if (!isoString) return 'Sin registro';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return String(isoString);
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(isoString);
  }
}

export function summarizeTraceabilityByChannel(records = []) {
  const initBucket = () => ({
    total: 0,
    confirma_asistencia: 0,
    no_puede_asistir: 0,
    pendiente: 0,
    records: [],
  });

  const summary = {
    sms: initBucket(),
    call: initBucket(),
    email: initBucket(),
    whatsapp: initBucket(),
  };

  for (const row of records || []) {
    const ch = String(row?.channel || '').toLowerCase();
    if (!summary[ch]) continue;
    const status = ['confirma_asistencia', 'no_puede_asistir', 'pendiente'].includes(row.response_status)
      ? row.response_status
      : 'pendiente';
    summary[ch].total += 1;
    summary[ch][status] += 1;
    summary[ch].records.push(row);
  }

  return summary;
}

function resolveCampaignDisplayName(row, campaignsById = new Map()) {
  const camp = campaignsById.get(String(row.campaign_id || ''));
  if (camp?.nombre) return camp.nombre;
  const raw = String(row.campaign_name || '').trim();
  if (raw && !raw.startsWith('Campaña camp_')) return raw;
  return raw || row.campaign_id || 'Campaña SADI';
}

export function exportChannelTraceabilityExcel({
  records = [],
  channel = 'all',
  campaignsList = [],
}) {
  const campaignsById = new Map((campaignsList || []).map((c) => [String(c.id), c]));
  const filtered = channel === 'all'
    ? records
    : (records || []).filter((r) => String(r.channel || '').toLowerCase() === channel);

  const rows = filtered.map((r, idx) => {
    const chKey = String(r.channel || '').toLowerCase();
    const chLabel = CHANNEL_META[chKey]?.shortLabel || chKey.toUpperCase();
    const statusLabel = RESPONSE_STATUS_LABELS[r.response_status] || 'Pendiente por Confirmación';
    const horaRecibido = r.responded_at || r.received_at || r.sent_at || null;
    return {
      '#': idx + 1,
      Paciente: r.patient_name || 'Paciente',
      Documento: r.patient_document || '',
      Campaña: resolveCampaignDisplayName(r, campaignsById),
      'Medio de Contacto': chLabel,
      'Destino (Teléfono / Correo)': r.contact_destination || '',
      'Estado de Respuesta': statusLabel,
      'Detalle / Respuesta Recibida': r.response_raw || (r.response_status === 'pendiente' ? 'Sin respuesta aún' : statusLabel),
      'Hora de Envío (CO)': formatColombiaDateTime(r.sent_at),
      'Hora de Recibido (CO)': formatColombiaDateTime(horaRecibido),
    };
  });

  const exportRows = rows.length > 0
    ? rows
    : [{
      '#': 1,
      Paciente: 'Sin registros aún en este canal',
      Documento: '',
      Campaña: '',
      'Medio de Contacto': CHANNEL_META[channel]?.shortLabel || 'Todos',
      'Destino (Teléfono / Correo)': '',
      'Estado de Respuesta': 'Pendiente por Confirmación',
      'Detalle / Respuesta Recibida': '',
      'Hora de Envío (CO)': '',
      'Hora de Recibido (CO)': '',
    }];

  const ws = XLSX.utils.json_to_sheet(exportRows);
  ws['!cols'] = [
    { wch: 5 },
    { wch: 30 },
    { wch: 15 },
    { wch: 34 },
    { wch: 18 },
    { wch: 28 },
    { wch: 26 },
    { wch: 36 },
    { wch: 24 },
    { wch: 24 },
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = channel === 'all'
    ? 'Trazabilidad_4_Canales'
    : `Trazabilidad_${(CHANNEL_META[channel]?.shortLabel || channel).replace(/[^a-zA-Z0-9]/g, '_')}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const today = new Date().toISOString().slice(0, 10);
  const prefix = channel === 'all'
    ? 'SADI_Trazabilidad_Omnicanal'
    : (CHANNEL_META[channel]?.excelFilePrefix || `SADI_Trazabilidad_${channel}`);
  const filename = `${prefix}_${today}.xlsx`;
  XLSX.writeFile(wb, filename);
  return { filename, count: filtered.length };
}

export const campaignTraceabilityService = {
  /**
   * Sincroniza en vivo respuestas reales de OpenVox Puerto 13 (SMS entrantes)
   * y transcripciones de Vapi (Llamadas), y retorna todos los registros consolidados.
   */
  async syncAndFetch({ hospitalId = null, campaignId = 'todas' } = {}) {
    const onlyDoc = getLocalSinglePatientDoc();
    try {
      const { data, error } = await supabase.functions.invoke('sync-campaign-responses', {
        body: {
          action: 'sync',
          hospitalId: hospitalId || undefined,
          campaignId: campaignId && campaignId !== 'todas' ? campaignId : undefined,
          onlyDocument: onlyDoc || undefined,
        },
      });
      if (!error && data?.ok && Array.isArray(data.records)) {
        return {
          success: true,
          syncedSmsReplies: Number(data.syncedSmsReplies || 0),
          syncedCalls: Number(data.syncedCalls || 0),
          inboundSmsScanned: Number(data.inboundSmsScanned || 0),
          records: data.records,
        };
      }
    } catch (e) {
      console.warn('Fallback a lectura directa de campaign_channel_traceability:', e?.message);
    }

    // Fallback directo a tabla Supabase si el invoke falla momentáneamente
    let q = supabase
      .from('campaign_channel_traceability')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(500);
    if (onlyDoc) q = q.eq('patient_document', onlyDoc);
    if (campaignId && campaignId !== 'todas') q = q.eq('campaign_id', campaignId);
    const { data: rows, error: dbErr } = await q;
    return {
      success: !dbErr,
      syncedSmsReplies: 0,
      syncedCalls: 0,
      inboundSmsScanned: 0,
      records: Array.isArray(rows) ? rows : [],
      error: dbErr?.message || null,
    };
  },

  /**
   * Registra en BD un envío efectuado por relay local (ej. SMTP local Vite)
   * para que también quede reflejado en los paneles de trazabilidad.
   */
  async recordLocalDispatchRow({
    hospitalId = null,
    campaignId,
    campaignName,
    patientId = null,
    patientName = 'Paciente',
    patientDocument = '',
    contactDestination = '',
    channel,
    externalRefId = null,
  }) {
    const nowIso = new Date().toISOString();
    try {
      await supabase.from('campaign_channel_traceability').insert({
        hospital_id: hospitalId || null,
        campaign_id: String(campaignId || `local_${Date.now()}`),
        campaign_name: String(campaignName || 'Campaña SADI'),
        patient_id: patientId || null,
        patient_name: patientName,
        patient_document: String(patientDocument || ''),
        contact_destination: String(contactDestination || ''),
        channel,
        delivery_status: 'delivered',
        response_status: 'pendiente',
        external_ref_id: externalRefId || `${channel}-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sent_at: nowIso,
        received_at: nowIso,
      });
    } catch { /* best-effort */ }
  },

  summarizeTraceabilityByChannel,
  exportChannelTraceabilityExcel,
};
