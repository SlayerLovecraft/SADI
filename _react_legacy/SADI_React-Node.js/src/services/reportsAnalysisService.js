// ==============================================================================
// reportsAnalysisService.js - SERVICIO DE MÉTRICAS MULTICANAL Y ANÁLISIS SADI
// Conectado exclusivamente a datos REALES de Supabase (patients, interactions,
// vapi_agent_sessions, openvox_sms_dispatches, ai_contact_evidence, campaigns).
// Sin conteos simulados del censo de 400.000.
// ==============================================================================

import { supabase } from '@/lib/supabase';
import {
  PROGRAMAS_3280,
  GRUPOS_RIESGO_PRIORIZADOS,
} from '@/services/census400kService';
import { getPatientCursoVida } from '@/services/callCapacityService';
import * as XLSX from 'xlsx';

export const ZONAS_LIST = ['Todas', 'Urbana', 'Rural'];

export const COMUNAS_LIST = ['Todas las Comunas'];
export const BARRIOS_LIST = ['Todos los Barrios'];

export const CANALES_CONFIG = [
  { id: 'call', key: 'call', label: 'Llamadas Realizadas (Puerto 1)', color: '#059669', lightBg: 'bg-emerald-50', textColor: 'text-emerald-800' },
  { id: 'whatsapp', key: 'whatsapp', label: 'Interacciones por WhatsApp', color: '#25D366', lightBg: 'bg-green-50', textColor: 'text-green-800' },
  { id: 'email', key: 'email', label: 'E-mails Enviados', color: '#4F46E5', lightBg: 'bg-indigo-50', textColor: 'text-indigo-800' },
  { id: 'sms', key: 'sms', label: 'SMS Enviados', color: '#0284C7', lightBg: 'bg-sky-50', textColor: 'text-sky-800' },
];

const EMPTY_COUNTS = () => ({ sms: 0, email: 0, call: 0, whatsapp: 0 });

const normalizeChannelKey = (rawChannel) => {
  const c = String(rawChannel || '').trim().toLowerCase();
  if (!c) return null;
  if (c.includes('sms')) return 'sms';
  if (c.includes('email') || c.includes('mail') || c.includes('correo')) return 'email';
  if (c.includes('call') || c.includes('llamada') || c.includes('voz') || c.includes('vapi') || c.includes('tel')) return 'call';
  if (c.includes('what') || c.includes('wpp')) return 'whatsapp';
  return null;
};

const normalizeZona = (rawZona) => {
  const z = String(rawZona || '').trim().toLowerCase();
  if (z.startsWith('rural')) return 'Rural';
  if (z.startsWith('urban')) return 'Urbana';
  return '';
};

const classifyGrupoRiesgoPriorizado = (rawGroup, rawProgram) => {
  const txt = `${rawGroup || ''} ${rawProgram || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!txt.trim() || txt.includes('preventiva general') || txt.includes('sin grupo')) return null;
  if (txt.includes('materno') || txt.includes('gestan') || txt.includes('prenatal') || txt.includes('riamp') || txt.includes('puerper')) return 1;
  if (txt.includes('cardio') || txt.includes('hipertens') || txt.includes('diabet') || txt.includes('metab') || txt.includes('renal') || /\bhta\b/.test(txt)) return 2;
  if (txt.includes('cancer') || txt.includes('oncol')) return 3;
  if (txt.includes('respira') || txt.includes('asma') || txt.includes('epoc') || txt.includes('bronqu')) return 4;
  if (txt.includes('mental') || txt.includes('sustanc') || txt.includes('psico') || txt.includes('depres') || txt.includes('ansied') || txt.includes('violen') || /\bspa\b/.test(txt)) return 5;
  if (txt.includes('infec') || txt.includes('zoonot') || /\bvih\b/.test(txt) || txt.includes('tubercul') || txt.includes('dengue')) return 6;
  if (txt.includes('nutric') || txt.includes('desnutr') || txt.includes('crecimiento')) return 7;
  if (txt.includes('huerfan') || txt.includes('neurol') || txt.includes('epilep')) return 8;
  if (txt.includes('planific') || txt.includes('anticoncep') || txt.includes('reproductiv')) return 9;
  if (txt.includes('vacun') || txt.includes('esquema pai') || /\bpai\b/.test(txt)) return 10;
  if (txt.includes('salud oral') || txt.includes('salud_oral') || txt.includes('bucal') || txt.includes('odont') || txt.includes('fluor')) return 11;
  return null;
};

const parseChannelCounts = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const reportsAnalysisService = {
  async getPatientsFromDB(hospitalId) {
    try {
      const allRows = [];
      let cursor = null;
      let hasMore = true;
      while (hasMore) {
        const { data: batchRes, error } = await supabase.rpc('get_patients_compact_batch', {
          p_hospital_id: hospitalId || null,
          p_last_id: cursor,
          p_batch_size: 5000,
        });
        if (error || !batchRes) {
          console.warn('Error consultando pacientes de Supabase:', error);
          break;
        }
        const rows = Array.isArray(batchRes.rows) ? batchRes.rows : [];
        for (let i = 0; i < rows.length; i++) {
          allRows.push(rows[i]);
        }
        hasMore = Boolean(batchRes.has_more && batchRes.next_cursor);
        cursor = batchRes.next_cursor || null;
        if (rows.length === 0) break;
      }
      return allRows;
    } catch (e) {
      console.warn('Excepción consultando pacientes:', e);
      return [];
    }
  },

  async getInteractionsFromDB(hospitalId) {
    try {
      let query = supabase
        .from('interactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (hospitalId) {
        query = query.eq('hospital_id', hospitalId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error consultando interacciones de Supabase:', error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('Excepción consultando interacciones:', e);
      return [];
    }
  },

  async getChannelMatrixHeader(hospitalId) {
    try {
      const { data: rpcSummary, error: rpcErr } = await supabase.rpc('get_reports_demanda_summary', {
        p_hospital_id: hospitalId || null,
        p_curso_vida: 'todos',
        p_grupo_riesgo: 'todos',
        p_zona: 'todos',
        p_comuna: 'todos',
        p_barrio: 'todos',
      });

      if (!rpcErr && rpcSummary && typeof rpcSummary === 'object') {
        const cursoMap = new Map((rpcSummary.por_curso || []).map((c) => [String(c.id), c]));
        const riesgoMap = new Map((rpcSummary.por_riesgo || []).map((r) => [Number(r.id), r]));
        const unlinked = rpcSummary.event_totals || EMPTY_COUNTS();

        const porCursoVida = PROGRAMAS_3280.map((prog) => {
          const hit = cursoMap.get(String(prog.id)) || {};
          return {
            id: prog.id,
            nombre: prog.nombre,
            color: prog.color,
            totalCenso: Number(hit.total_censo || 0),
            sms: Number(hit.sms || 0),
            email: Number(hit.email || 0),
            call: Number(hit.call || 0),
            whatsapp: Number(hit.whatsapp || 0),
          };
        });

        const porGrupoRiesgo = GRUPOS_RIESGO_PRIORIZADOS.map((rg) => {
          const hit = riesgoMap.get(Number(rg.id)) || {};
          return {
            id: rg.id,
            titulo: rg.titulo,
            codigo: rg.codigo,
            totalCenso: Number(hit.total_censo || 0),
            sms: Number(hit.sms || 0),
            email: Number(hit.email || 0),
            call: Number(hit.call || 0),
            whatsapp: Number(hit.whatsapp || 0),
          };
        });

        const chSum = (key) => porCursoVida.reduce((acc, c) => acc + Number(c[key] || 0), 0) + Number(unlinked[key] || 0);
        const totalSms = chSum('sms');
        const totalEmail = chSum('email');
        const totalCall = chSum('call');
        const totalWhatsapp = chSum('whatsapp');

        const totales = {
          sms: totalSms,
          email: totalEmail,
          call: totalCall,
          whatsapp: totalWhatsapp,
          general: totalSms + totalEmail + totalCall + totalWhatsapp,
        };

        const sortedComunas = Array.isArray(rpcSummary.comunas) ? [...rpcSummary.comunas] : [];
        const sortedBarrios = Array.isArray(rpcSummary.barrios) ? [...rpcSummary.barrios] : [];

        return {
          totales,
          porCursoVida,
          porGrupoRiesgo,
          patients: [],
          fromServerRpc: true,
          hospitalId: hospitalId || null,
          unlinkedCounts: {
            sms: Number(unlinked.sms || 0),
            email: Number(unlinked.email || 0),
            call: Number(unlinked.call || 0),
            whatsapp: Number(unlinked.whatsapp || 0),
          },
          filteredChannelsBase: rpcSummary.filtered_channels || EMPTY_COUNTS(),
          filterOptions: {
            comunas: sortedComunas,
            barrios: sortedBarrios,
          },
          realPatientsCount: Number(rpcSummary.total_patients || 0),
          realInteractionsCount: totales.general,
          effectiveness: rpcSummary.effectiveness || {
            total: 0,
            efectivas: 0,
            fallidas: 0,
            pct_efectivas: 0,
            pct_fallidas: 0,
          },
          recentCommunications: Array.isArray(rpcSummary.recent_communications)
            ? rpcSummary.recent_communications
            : [],
        };
      }
    } catch (rpcException) {
      console.warn('Fallback getChannelMatrixHeader (RPC no disponible):', rpcException);
    }

    const safeQuery = async (promise) => {
      try {
        const { data, error } = await promise;
        if (error) return [];
        return data || [];
      } catch {
        return [];
      }
    };

    let vapiQuery = supabase
      .from('vapi_agent_sessions')
      .select('id, patient_id, hospital_id, estado_llamada, deteccion_buzon, duracion_segundos, created_at');
    let smsQuery = supabase
      .from('openvox_sms_dispatches')
      .select('id, patient_id, hospital_id, status, created_at');
    let campaignsQuery = supabase
      .from('campaigns')
      .select('id, hospital_id');

    if (hospitalId) {
      vapiQuery = vapiQuery.eq('hospital_id', hospitalId);
      smsQuery = smsQuery.eq('hospital_id', hospitalId);
      campaignsQuery = campaignsQuery.eq('hospital_id', hospitalId);
    }

    const [patients, interactions, vapiSessions, smsDispatches, rawEvidence, campaigns] = await Promise.all([
      this.getPatientsFromDB(hospitalId),
      this.getInteractionsFromDB(hospitalId),
      safeQuery(vapiQuery),
      safeQuery(smsQuery),
      safeQuery(supabase.from('ai_contact_evidence').select('id, patient_id, canal, resultado_contacto, created_at')),
      safeQuery(campaignsQuery),
    ]);

    let campaignMessages = [];
    if (campaigns.length > 0) {
      const campIds = campaigns.map((c) => c.id).filter(Boolean);
      if (campIds.length > 0) {
        campaignMessages = await safeQuery(
          supabase
            .from('campaign_messages')
            .select('*')
            .in('campaign_id', campIds)
        );
      }
    }

    const countsByPatient = new Map();
    const unlinkedCounts = EMPTY_COUNTS();

    const ensurePatientBucket = (pid) => {
      const key = String(pid);
      if (!countsByPatient.has(key)) countsByPatient.set(key, EMPTY_COUNTS());
      return countsByPatient.get(key);
    };

    const patientIdSet = new Set(patients.map((p) => String(p.patient_id || p.id)).filter(Boolean));

    const recordChannelEvent = (patientId, channelKey) => {
      if (!channelKey) return;
      if (patientId && patientIdSet.has(String(patientId))) {
        ensurePatientBucket(patientId)[channelKey] += 1;
      } else {
        unlinkedCounts[channelKey] += 1;
      }
    };

    // 1. Llamadas reales de Vapi / Asterisk SIP
    vapiSessions.forEach((sess) => {
      recordChannelEvent(sess.patient_id, 'call');
    });

    // 2. SMS reales enviados por OpenVox GSM (ignora fallidos purgados sin costo)
    smsDispatches.forEach((sms) => {
      if (sms.status === 'sent') {
        recordChannelEvent(sms.patient_id, 'sms');
      }
    });

    // 3. Evidencias de contacto IA (deduplicando llamadas ya contabilizadas en vapi_agent_sessions)
    const scopedEvidence = hospitalId
      ? rawEvidence.filter((ev) => ev?.patient_id && patientIdSet.has(String(ev.patient_id)))
      : rawEvidence;

    scopedEvidence.forEach((ev) => {
      const channelKey = normalizeChannelKey(ev.canal);
      if (!channelKey) return;
      if (channelKey === 'call') {
        const evTime = new Date(ev.created_at || 0).getTime();
        const alreadyInVapi = vapiSessions.some((vs) => {
          if (String(vs.patient_id) !== String(ev.patient_id)) return false;
          const vsTime = new Date(vs.created_at || 0).getTime();
          return Math.abs(vsTime - evTime) <= 120000;
        });
        if (alreadyInVapi) return;
      }
      recordChannelEvent(ev.patient_id, channelKey);
    });

    // 4. Interacciones multicanal reales registradas en la tabla interactions
    interactions.forEach((inter) => {
      const channelKey = normalizeChannelKey(inter.tipo_canal || inter.canal || inter.tipo);
      if (!channelKey) return;
      recordChannelEvent(inter.patient_id, channelKey);
    });

    // 5. Mensajes de campaña enviados/entregados
    campaignMessages.forEach((msg) => {
      const status = String(msg.estado || msg.status || '').toLowerCase();
      if (status && ['failed', 'fallido', 'cancelled', 'cancelado', 'pending', 'pendiente'].includes(status)) return;
      const channelKey = normalizeChannelKey(msg.canal || msg.channel);
      if (!channelKey) return;
      recordChannelEvent(msg.patient_id, channelKey);
    });

    // Enriquecer cada paciente real con su clasificación clínica y conteo real por canal
    const comunasSet = new Set();
    const barriosSet = new Set();

    const enrichedPatients = patients.map((p) => {
      const pid = String(p.patient_id || p.id || '');
      const logged = countsByPatient.get(pid) || EMPTY_COUNTS();
      const stored = parseChannelCounts(p.conteo_canales) || {};

      // Reconciliar logs detallados con conteo_canales del paciente sin inventar valores base
      const channels = {
        sms: Math.max(logged.sms, Number(stored.sms) || 0),
        email: Math.max(logged.email, Number(stored.email) || 0),
        call: Math.max(logged.call, Number(stored.call) || 0),
        whatsapp: Math.max(logged.whatsapp, Number(stored.whatsapp) || 0),
      };

      const cv = getPatientCursoVida(p);
      const grupoRiesgoId = classifyGrupoRiesgoPriorizado(p.grupo_riesgo, p.program);
      const zonaNormalized = normalizeZona(p.zona);
      const comunaLabel = String(p.comuna || p.corregimiento || '').trim();
      const barrioLabel = String(p.barrio || p.vereda || '').trim();

      if (comunaLabel) comunasSet.add(comunaLabel);
      if (barrioLabel) barriosSet.add(barrioLabel);

      return {
        id: pid,
        cursoVidaId: cv.id,
        cursoVidaNombre: cv.nombre,
        grupoRiesgoId,
        zonaNormalized,
        comunaLabel,
        barrioLabel,
        channels,
      };
    });

    // 1. Matriz real por Cursos de Vida (A - J)
    const porCursoVida = PROGRAMAS_3280.map((prog) => {
      const matching = enrichedPatients.filter((p) => p.cursoVidaId === prog.id);
      return {
        id: prog.id,
        nombre: prog.nombre,
        color: prog.color,
        totalCenso: matching.length,
        sms: matching.reduce((acc, p) => acc + p.channels.sms, 0),
        email: matching.reduce((acc, p) => acc + p.channels.email, 0),
        call: matching.reduce((acc, p) => acc + p.channels.call, 0),
        whatsapp: matching.reduce((acc, p) => acc + p.channels.whatsapp, 0),
      };
    });

    // 2. Matriz real por Grupos de Riesgo Priorizados (1 - 7)
    const porGrupoRiesgo = GRUPOS_RIESGO_PRIORIZADOS.map((rg) => {
      const matching = enrichedPatients.filter((p) => p.grupoRiesgoId === rg.id);
      return {
        id: rg.id,
        titulo: rg.titulo,
        codigo: rg.codigo,
        totalCenso: matching.length,
        sms: matching.reduce((acc, p) => acc + p.channels.sms, 0),
        email: matching.reduce((acc, p) => acc + p.channels.email, 0),
        call: matching.reduce((acc, p) => acc + p.channels.call, 0),
        whatsapp: matching.reduce((acc, p) => acc + p.channels.whatsapp, 0),
      };
    });

    // Totales reales consolidados por canal (pacientes reales + eventos globales sin paciente asociado)
    const totalSms = enrichedPatients.reduce((acc, p) => acc + p.channels.sms, 0) + unlinkedCounts.sms;
    const totalEmail = enrichedPatients.reduce((acc, p) => acc + p.channels.email, 0) + unlinkedCounts.email;
    const totalCall = enrichedPatients.reduce((acc, p) => acc + p.channels.call, 0) + unlinkedCounts.call;
    const totalWhatsapp = enrichedPatients.reduce((acc, p) => acc + p.channels.whatsapp, 0) + unlinkedCounts.whatsapp;

    const totales = {
      sms: totalSms,
      email: totalEmail,
      call: totalCall,
      whatsapp: totalWhatsapp,
      general: totalSms + totalEmail + totalCall + totalWhatsapp,
    };

    const sortedComunas = Array.from(comunasSet).sort((a, b) => a.localeCompare(b, 'es'));
    const sortedBarrios = Array.from(barriosSet).sort((a, b) => a.localeCompare(b, 'es'));

    return {
      totales,
      porCursoVida,
      porGrupoRiesgo,
      patients: enrichedPatients,
      unlinkedCounts,
      filterOptions: {
        comunas: sortedComunas,
        barrios: sortedBarrios,
      },
      realPatientsCount: patients.length,
      realInteractionsCount: totales.general,
    };
  },

  async fetchFilteredPieStats({
    hospitalId = null,
    cursoVida = 'todos',
    grupoRiesgo = 'todos',
    barrio = 'todos',
    comuna = 'todos',
    zona = 'todos',
  }) {
    const { data, error } = await supabase.rpc('get_reports_demanda_summary', {
      p_hospital_id: hospitalId || null,
      p_curso_vida: cursoVida || 'todos',
      p_grupo_riesgo: grupoRiesgo || 'todos',
      p_zona: zona || 'todos',
      p_comuna: comuna || 'todos',
      p_barrio: barrio || 'todos',
    });
    if (error || !data) return null;
    return data;
  },

  computePieChartData({
    cursoVida = 'todos',
    grupoRiesgo = 'todos',
    barrio = 'todos',
    comuna = 'todos',
    zona = 'todos',
    matrixData = null,
    serverFilteredRpc = null,
  }) {
    const patients = matrixData?.patients || [];
    const hasFilter =
      (cursoVida && cursoVida !== 'todos') ||
      (grupoRiesgo && grupoRiesgo !== 'todos') ||
      (zona && zona !== 'todos') ||
      (comuna && comuna !== 'todos' && !comuna.startsWith('Todas')) ||
      (barrio && barrio !== 'todos' && !barrio.startsWith('Todos'));

    if (matrixData?.fromServerRpc) {
      const rpcChannels = serverFilteredRpc?.filtered_channels || matrixData?.filteredChannelsBase || EMPTY_COUNTS();
      const matchingCount = Number(
        serverFilteredRpc?.filtered_patients ?? (hasFilter ? 0 : matrixData?.realPatientsCount ?? 0)
      );
      const unlinked = !hasFilter ? (matrixData?.unlinkedCounts || EMPTY_COUNTS()) : EMPTY_COUNTS();
      const countCall = Number(rpcChannels.call || 0) + Number(unlinked.call || 0);
      const countWhatsapp = Number(rpcChannels.whatsapp || 0) + Number(unlinked.whatsapp || 0);
      const countEmail = Number(rpcChannels.email || 0) + Number(unlinked.email || 0);
      const countSms = Number(rpcChannels.sms || 0) + Number(unlinked.sms || 0);
      const totalFiltered = countCall + countWhatsapp + countEmail + countSms;
      const pct = (val) => (totalFiltered > 0 ? Number(((val / totalFiltered) * 100).toFixed(1)) : 0);
      const pctCall = pct(countCall);
      const pctWhatsapp = pct(countWhatsapp);
      const pctEmail = pct(countEmail);
      const pctSms = totalFiltered > 0 ? Number(Math.max(0, 100 - pctCall - pctWhatsapp - pctEmail).toFixed(1)) : 0;

      const slices = [
        { id: 'call', label: 'Llamada (Puerto 1)', canal: 'Llamada', count: countCall, percentage: pctCall, color: '#059669', icon: 'Phone' },
        { id: 'whatsapp', label: 'WhatsApp', canal: 'WhatsApp', count: countWhatsapp, percentage: pctWhatsapp, color: '#25D366', icon: 'Send' },
        { id: 'email', label: 'E-mail', canal: 'E-mail', count: countEmail, percentage: pctEmail, color: '#4F46E5', icon: 'Mail' },
        { id: 'sms', label: 'SMS', canal: 'SMS', count: countSms, percentage: pctSms, color: '#0284C7', icon: 'MessageSquare' },
      ].sort((a, b) => b.count - a.count);

      return {
        totalContacts: totalFiltered,
        matchingPatientsCount: matchingCount,
        slices,
        appliedFilters: { cursoVida, grupoRiesgo, barrio, comuna, zona },
      };
    }

    const filteredPatients = patients.filter((p) => {
      if (cursoVida && cursoVida !== 'todos' && p.cursoVidaId !== cursoVida) return false;
      if (grupoRiesgo && grupoRiesgo !== 'todos' && Number(grupoRiesgo) !== p.grupoRiesgoId) return false;
      if (zona && zona !== 'todos' && p.zonaNormalized.toLowerCase() !== zona.toLowerCase()) return false;
      if (comuna && comuna !== 'todos' && !comuna.startsWith('Todas') && p.comunaLabel !== comuna) return false;
      if (barrio && barrio !== 'todos' && !barrio.startsWith('Todos') && p.barrioLabel !== barrio) return false;
      return true;
    });

    const unlinked = !hasFilter ? (matrixData?.unlinkedCounts || EMPTY_COUNTS()) : EMPTY_COUNTS();

    const countCall = filteredPatients.reduce((acc, p) => acc + p.channels.call, 0) + unlinked.call;
    const countWhatsapp = filteredPatients.reduce((acc, p) => acc + p.channels.whatsapp, 0) + unlinked.whatsapp;
    const countEmail = filteredPatients.reduce((acc, p) => acc + p.channels.email, 0) + unlinked.email;
    const countSms = filteredPatients.reduce((acc, p) => acc + p.channels.sms, 0) + unlinked.sms;

    const totalFiltered = countCall + countWhatsapp + countEmail + countSms;

    const pct = (val) => (totalFiltered > 0 ? Number(((val / totalFiltered) * 100).toFixed(1)) : 0);
    const pctCall = pct(countCall);
    const pctWhatsapp = pct(countWhatsapp);
    const pctEmail = pct(countEmail);
    const pctSms = totalFiltered > 0
      ? Number(Math.max(0, 100 - pctCall - pctWhatsapp - pctEmail).toFixed(1))
      : 0;

    const slices = [
      {
        id: 'call',
        label: 'Llamada (Puerto 1)',
        canal: 'Llamada',
        count: countCall,
        percentage: pctCall,
        color: '#059669',
        icon: 'Phone',
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        canal: 'WhatsApp',
        count: countWhatsapp,
        percentage: pctWhatsapp,
        color: '#25D366',
        icon: 'Send',
      },
      {
        id: 'email',
        label: 'E-mail',
        canal: 'E-mail',
        count: countEmail,
        percentage: pctEmail,
        color: '#4F46E5',
        icon: 'Mail',
      },
      {
        id: 'sms',
        label: 'SMS',
        canal: 'SMS',
        count: countSms,
        percentage: pctSms,
        color: '#0284C7',
        icon: 'MessageSquare',
      },
    ];

    slices.sort((a, b) => b.count - a.count);

    return {
      totalContacts: totalFiltered,
      matchingPatientsCount: filteredPatients.length,
      slices,
      appliedFilters: {
        cursoVida,
        grupoRiesgo,
        barrio,
        comuna,
        zona,
      },
    };
  },

  exportPieChartToExcel({ chartData, filterLabels }) {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['REPORTE DE DEMANDA INDUCIDA - DISTRIBUCIÓN POR CANALES (DATOS REALES SUPABASE)'],
      ['Fecha de Generación', new Date().toLocaleString('es-CO')],
      ['Pacientes Coincidentes con el Filtro', chartData.matchingPatientsCount ?? 0],
      ['Total Contactos Filtrados', chartData.totalContacts],
      [],
      ['CRITERIOS DE FILTRO APLICADOS:'],
      ['Curso de Vida', filterLabels.cursoVida || 'Todos'],
      ['Grupo de Riesgo Priorizado', filterLabels.grupoRiesgo || 'Todos'],
      ['Zona', filterLabels.zona || 'Todas'],
      ['Comuna', filterLabels.comuna || 'Todas'],
      ['Barrio', filterLabels.barrio || 'Todos'],
      [],
      ['CANAL', 'CANTIDAD (CONTACTOS)', 'PORCENTAJE (%)'],
      ...chartData.slices.map((s) => [s.label, s.count, `${s.percentage}%`]),
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Distribución de Canales');

    const fileName = `Reporte_Canales_SADI_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    return fileName;
  },
};
