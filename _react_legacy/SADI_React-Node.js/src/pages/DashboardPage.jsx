import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Users, Send, TrendingUp, MessageSquare, Loader2, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout } from '@/lib/utils';

const normalizeStatus = (status) => (status || '').toLowerCase().trim();

const getEffectiveCampaignStatus = (campaign) => {
  const destinatarios = Number(campaign?.destinatarios) || 0;
  const enviados = Number(campaign?.enviados) || 0;
  const entregados = Number(campaign?.entregados) || 0;
  const fallidos = Number(campaign?.fallidos) || 0;

  const processed = entregados + fallidos;
  const raw = normalizeStatus(campaign?.estado || campaign?.status);

  if (destinatarios > 0 && processed >= destinatarios) return 'Completada';
  if (raw === 'activa' || raw === 'active' || raw === 'enviando') return 'Activa';
  if (enviados > 0 || entregados > 0 || fallidos > 0) return 'Activa';
  if (raw === 'programada' || raw === 'scheduled') return 'Programada';
  if (raw === 'completada' || raw === 'completed') return 'No Enviada';

  return 'Programada';
};

const DashboardPage = () => {
  const { user, reload, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeCampaigns: 0,
    deliveryRate: 0,
    totalInteractions: 0
  });

  const [campaignStats, setCampaignStats] = useState({
    enProgreso: 0,
    completadas: 0,
    programadas: 0,
    hombres: 0,
    mujeres: 0,
    ninos: 0,
    ninas: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hospitalId, setHospitalId] = useState(null);
  const attemptedReloadRef = useRef(false);

  const hospitalIdForQueries = useMemo(() => {
    if (!user) return null;
    if (user.role === 'super_admin') return null;
    const rawId = user.hospitalId || user.hospital_id || user.Hospital_ID;
    if (!rawId || rawId === 'hosp-001') {
      return 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8';
    }
    return rawId;
  }, [user]);

  const fetchPatientsSummary = useCallback(async (hospital_id) => {
    try {
      let query = supabase
        .from('patients')
        .select('patient_id, name, sex, birthdate, program, zona, grupo_riesgo, created_at', { count: 'exact' });

      if (hospital_id) query = query.eq('hospital_id', hospital_id);

      const { data, count, error } = await withTimeout(query, 12000);
      if (error) throw error;
      const list = data || [];
      return {
        count: typeof count === 'number' ? count : list.length,
        patients: list,
      };
    } catch {
      return { count: 0, patients: [] };
    }
  }, []);

  const fetchCampaigns = useCallback(async (hospital_id) => {
    try {
      let query = supabase
        .from('campaigns')
        .select('*');

      if (hospital_id) query = query.eq('hospital_id', hospital_id);

      const { data, error } = await withTimeout(query, 12000);
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  }, []);

  const fetchInteractionsSummary = useCallback(async (hospital_id, patientIds = []) => {
    try {
      let countQuery = supabase
        .from('interactions')
        .select('*', { count: 'exact', head: true });

      let recentQuery = supabase
        .from('interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      let vapiQuery = supabase
        .from('vapi_agent_sessions')
        .select('id, patient_id, estado_llamada, deteccion_buzon, duracion_segundos, facturable_ips, motivo_llamada, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      let smsQuery = supabase
        .from('openvox_sms_dispatches')
        .select('id, patient_id, status, winning_port, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      let evidenceQuery = supabase
        .from('ai_contact_evidence')
        .select('id, patient_id, canal, motivo_contacto, resultado_contacto, deteccion_buzon, duracion_segundos, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (hospital_id) {
        countQuery = countQuery.eq('hospital_id', hospital_id);
        recentQuery = recentQuery.eq('hospital_id', hospital_id);
        vapiQuery = vapiQuery.eq('hospital_id', hospital_id);
        smsQuery = smsQuery.eq('hospital_id', hospital_id);
      }

      const [
        { count, error: countError },
        { data: recent, error: recentError },
        vapiRes,
        smsRes,
        evidenceRes,
      ] = await Promise.all([
        withTimeout(countQuery, 12000),
        withTimeout(recentQuery, 12000),
        withTimeout(vapiQuery, 12000).catch(() => ({ data: [] })),
        withTimeout(smsQuery, 12000).catch(() => ({ data: [] })),
        withTimeout(evidenceQuery, 12000).catch(() => ({ data: [] })),
      ]);

      if (countError) throw countError;
      if (recentError) throw recentError;

      const allowedPatientIds = new Set((patientIds || []).map((id) => String(id)));
      const vapiSessions = vapiRes?.data || [];
      const smsDispatches = smsRes?.data || [];
      const rawEvidence = evidenceRes?.data || [];
      const hospitalEvidence = hospital_id
        ? rawEvidence.filter((ev) => ev?.patient_id && allowedPatientIds.has(String(ev.patient_id)))
        : rawEvidence;

      // Evitar doble conteo cuando vapi-webhook inserta en ambas tablas para la misma llamada
      const nonDuplicateEvidence = hospitalEvidence.filter((ev) => {
        const canal = String(ev?.canal || '').toLowerCase();
        if (!canal.includes('call') && !canal.includes('llamada')) return true;
        const evTime = new Date(ev.created_at || 0).getTime();
        return !vapiSessions.some((vs) => {
          if (String(vs.patient_id) !== String(ev.patient_id)) return false;
          const vsTime = new Date(vs.created_at || 0).getTime();
          return Math.abs(vsTime - evTime) <= 120000;
        });
      });

      const realDispatchesTotal = vapiSessions.length + smsDispatches.length + nonDuplicateEvidence.length;
      const realDispatchesSuccess =
        vapiSessions.filter((s) => !s.deteccion_buzon && (s.estado_llamada === 'completada' || Number(s.duracion_segundos) > 0)).length +
        smsDispatches.filter((s) => s.status === 'sent').length +
        nonDuplicateEvidence.filter((ev) => !ev.deteccion_buzon && ev.resultado_contacto === 'contactado_exitoso').length;

      return {
        count: (Number(count) || 0) + realDispatchesTotal,
        recent: recent || [],
        vapiSessions,
        smsDispatches,
        evidence: nonDuplicateEvidence,
        dispatchesTotal: realDispatchesTotal,
        dispatchesSuccess: realDispatchesSuccess,
      };
    } catch {
      return {
        count: 0,
        recent: [],
        vapiSessions: [],
        smsDispatches: [],
        evidence: [],
        dispatchesTotal: 0,
        dispatchesSuccess: 0,
      };
    }
  }, []);

  const loadDashboardData = useCallback(async (hospital_id) => {
    try {
      setLoading(true);
      setError(null);

      const [patientsSummary, campaignsData] = await Promise.all([
        fetchPatientsSummary(hospital_id),
        fetchCampaigns(hospital_id),
      ]);

      const patientIds = (patientsSummary.patients || []).map((p) => p.patient_id).filter(Boolean);
      const interactionsSummary = await fetchInteractionsSummary(hospital_id, patientIds);

      const statuses = campaignsData.map(getEffectiveCampaignStatus);
      const pendingCampaigns = statuses.filter((s) => s !== 'Completada').length;

      const totalDestinatarios = campaignsData.reduce((acc, curr) => acc + (Number(curr.destinatarios) || 0), 0);
      const totalEntregados = campaignsData.reduce((acc, curr) => acc + (Number(curr.entregados) || 0), 0);

      const combinedAttempts = totalDestinatarios + (interactionsSummary.dispatchesTotal || 0);
      const combinedSuccess = totalEntregados + (interactionsSummary.dispatchesSuccess || 0);

      const deliveryRate = combinedAttempts > 0
        ? ((combinedSuccess / combinedAttempts) * 100).toFixed(1)
        : 0;

      setStats({
        totalPatients: patientsSummary.count,
        activeCampaigns: pendingCampaigns,
        deliveryRate: deliveryRate,
        totalInteractions: interactionsSummary.count || 0,
      });

      calculateCampaignStats(campaignsData, patientsSummary.patients);
      generateRecentActivity(campaignsData, interactionsSummary);
    } catch (err) {
      setError(err?.message || 'Error cargando dashboard');
    } finally {
      setLoading(false);
    }
  }, [fetchCampaigns, fetchInteractionsSummary, fetchPatientsSummary]);

  useEffect(() => {
    if (!user) return;
    attemptedReloadRef.current = false;
  }, [user?.id, user?.email, user?.role]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (user.role !== 'super_admin' && !hospitalIdForQueries) {
      if (!attemptedReloadRef.current) {
        attemptedReloadRef.current = true;
        setError(null);
        setLoading(true);
        Promise.resolve(reload?.()).finally(() => {});
        return;
      }
      setError('No se pudo identificar el hospital del usuario.');
      setLoading(false);
      return;
    }

    setHospitalId(hospitalIdForQueries);
    loadDashboardData(hospitalIdForQueries);
  }, [authLoading, hospitalIdForQueries, loadDashboardData, reload, user]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'super_admin' && !hospitalIdForQueries) return;

    const intervalId = setInterval(() => {
      loadDashboardData(hospitalIdForQueries);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [hospitalIdForQueries, loadDashboardData, user]);

  const calculateAgeFromBirthdate = (birthdate) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const calculateCampaignStats = (campaigns = [], realPatients = []) => {
    const statuses = campaigns.map(getEffectiveCampaignStatus);
    const enProgreso = statuses.filter((s) => s === 'Activa').length;
    const completadas = statuses.filter((s) => s === 'Completada').length;
    const programadas = statuses.filter((s) => s === 'Programada' || s === 'No Enviada').length;

    // Calcular demografía real a partir de los pacientes registrados en Supabase
    let hombres = 0, mujeres = 0, ninos = 0, ninas = 0;
    (realPatients || []).forEach((p) => {
      const sexNorm = String(p?.sex || p?.sexo || '').trim().toLowerCase();
      const isFemale = sexNorm === 'f' || sexNorm === 'femenino' || sexNorm === 'mujer' || sexNorm === 'female';
      const age = calculateAgeFromBirthdate(p?.birthdate || p?.fecha_nacimiento);
      if (age !== null && age < 18) {
        if (isFemale) ninas++;
        else ninos++;
      } else {
        if (isFemale) mujeres++;
        else hombres++;
      }
    });

    setCampaignStats({
      enProgreso,
      completadas,
      programadas,
      hombres,
      mujeres,
      ninos,
      ninas
    });
  };

  const generateRecentActivity = (campaigns = [], interactionsSummary = {}) => {
    const events = [];

    (campaigns || []).forEach((campaign) => {
      const status = getEffectiveCampaignStatus(campaign);
      const ts = campaign.created_at || campaign.fecha_creacion;
      events.push({
        type: 'campaign',
        message: `Campaña "${campaign.nombre || campaign.name || 'Prevención 3280'}" ${status.toLowerCase()}`,
        createdAt: ts ? new Date(ts).getTime() : 0,
        time: ts ? getTimeAgo(new Date(ts)) : 'Reciente',
        color: 'bg-blue-500'
      });
    });

    (interactionsSummary.recent || []).forEach((inter) => {
      events.push({
        type: 'interaction',
        message: `Interacción ${inter.tipo || inter.type || 'asistencial'} registrada`,
        createdAt: inter.created_at ? new Date(inter.created_at).getTime() : 0,
        time: inter.created_at ? getTimeAgo(new Date(inter.created_at)) : 'Reciente',
        color: 'bg-emerald-500'
      });
    });

    (interactionsSummary.vapiSessions || []).slice(0, 5).forEach((sess) => {
      events.push({
        type: 'call',
        message: sess.deteccion_buzon
          ? 'Llamada cortada por Anti-Buzón ($0 COP)'
          : `Llamada IA ${sess.estado_llamada || 'registrada'} (${sess.duracion_segundos || 0}s)`,
        createdAt: sess.created_at ? new Date(sess.created_at).getTime() : 0,
        time: sess.created_at ? getTimeAgo(new Date(sess.created_at)) : 'Reciente',
        color: sess.deteccion_buzon ? 'bg-amber-500' : 'bg-teal-500'
      });
    });

    (interactionsSummary.smsDispatches || []).slice(0, 5).forEach((sms) => {
      events.push({
        type: 'sms',
        message: sms.status === 'sent'
          ? `SMS enviado por OpenVox (SIM Puerto ${sms.winning_port || '?'})`
          : 'Intento SMS purgado (sin señal)',
        createdAt: sms.created_at ? new Date(sms.created_at).getTime() : 0,
        time: sms.created_at ? getTimeAgo(new Date(sms.created_at)) : 'Reciente',
        color: 'bg-sky-500'
      });
    });

    (interactionsSummary.evidence || []).slice(0, 5).forEach((ev) => {
      events.push({
        type: 'evidence',
        message: `Contacto IA (${ev.canal || 'call_ia'}): ${ev.resultado_contacto || 'registrado'}`,
        createdAt: ev.created_at ? new Date(ev.created_at).getTime() : 0,
        time: ev.created_at ? getTimeAgo(new Date(ev.created_at)) : 'Reciente',
        color: 'bg-purple-500'
      });
    });

    events.sort((a, b) => b.createdAt - a.createdAt);
    setRecentActivity(events.slice(0, 6));
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Hace menos de 1 minuto';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} minuto(s)`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} hora(s)`;
    return `Hace ${Math.floor(seconds / 86400)} día(s)`;
  };

  const kpiCards = [
    {
      title: 'Total Pacientes',
      value: typeof stats.totalPatients === 'number' ? stats.totalPatients.toLocaleString('es-CO') : stats.totalPatients,
      icon: Users,
      color: 'bg-blue-500',
      subtitle: 'Pacientes reales en Supabase'
    },
    {
      title: 'Campañas Pendientes',
      value: stats.activeCampaigns,
      icon: Send,
      color: 'bg-green-500',
      subtitle: 'Por enviar o en proceso'
    },
    {
      title: 'Tasa de Entrega',
      value: `${stats.deliveryRate}%`,
      icon: TrendingUp,
      color: 'bg-purple-500',
      subtitle: 'Contactos y envíos exitosos'
    },
    {
      title: 'Interacciones',
      value: stats.totalInteractions,
      icon: MessageSquare,
      color: 'bg-orange-500',
      subtitle: 'Registros reales en Supabase'
    }
  ];

  if (loading) {
    return (
      <Layout>
        <Helmet>
          <title>Dashboard - SADI</title>
          <meta name="description" content="Panel de control y estadísticas del sistema" />
        </Helmet>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-slate-400">Cargando estadísticas desde Supabase...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Helmet>
          <title>Dashboard - SADI</title>
          <meta name="description" content="Panel de control y estadísticas del sistema" />
        </Helmet>
        <div className="flex items-center justify-center h-96">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-md p-8 max-w-md">
            <div className="text-center">
              <Activity className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error al cargar datos</h3>
              <p className="text-gray-600 dark:text-slate-400 mb-4">{error}</p>
              <button
                onClick={() => loadDashboardData(hospitalId)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Dashboard - SADI</title>
        <meta name="description" content="Panel de control y estadísticas del sistema" />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">Vista general del sistema - Datos en tiempo real desde Supabase</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiCards.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <div
                key={index}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-md p-6 hover:shadow-lg transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">{kpi.title}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">{kpi.subtitle}</p>
                  </div>
                  <div className={`${kpi.color} p-4 rounded-lg`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Actividad Reciente */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-md p-6 transition-colors">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Actividad Reciente</h2>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((item, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-slate-800/70 border border-transparent dark:border-slate-700/60 rounded-lg">
                    <div className={`w-2 h-2 ${item.color} rounded-full`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{item.message}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{item.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400 dark:text-slate-500">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay actividad reciente</p>
                </div>
              )}
            </div>
          </div>

          {/* Estadísticas de Campañas */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-md p-6 transition-colors">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Estadísticas de Campañas</h2>
            
            <div className="space-y-4">
              {/* Estado de Campañas */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Estado de Campañas</h3>
                <div className="space-y-3">
                  {[
                    { label: 'En Progreso', value: campaignStats.enProgreso, textClass: 'text-blue-600 dark:text-blue-400', barClass: 'bg-blue-500' },
                    { label: 'Completadas', value: campaignStats.completadas, textClass: 'text-green-600 dark:text-green-400', barClass: 'bg-green-500' },
                    { label: 'Programadas', value: campaignStats.programadas, textClass: 'text-yellow-600 dark:text-yellow-400', barClass: 'bg-yellow-500' },
                  ].map((st) => {
                    const total = Math.max(campaignStats.enProgreso + campaignStats.completadas + campaignStats.programadas, 1);
                    return (
                      <div key={st.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600 dark:text-slate-300">{st.label}</span>
                          <span className={`text-sm font-bold ${st.textClass}`}>{st.value}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-3">
                          <div
                            className={`${st.barClass} h-3 rounded-full transition-all duration-500`}
                            style={{ width: `${(st.value / total) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Demographics */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Demografía de Pacientes en BD</h3>
                <div className="space-y-3">
                  {[
                    { label: '👨 Hombres', value: campaignStats.hombres, color: 'bg-indigo-500' },
                    { label: '👩 Mujeres', value: campaignStats.mujeres, color: 'bg-pink-500' },
                    { label: '👦 Niños', value: campaignStats.ninos, color: 'bg-cyan-500' },
                    { label: '👧 Niñas', value: campaignStats.ninas, color: 'bg-purple-500' }
                  ].map((demo, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-slate-300">{demo.label}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{demo.value}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-3">
                        <div 
                          className={`${demo.color} h-3 rounded-full transition-all duration-500`}
                          style={{ 
                            width: `${(demo.value / Math.max(campaignStats.hombres + campaignStats.mujeres + campaignStats.ninos + campaignStats.ninas, 1)) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-sm text-gray-500 dark:text-slate-400">
          <p>Última actualización: {new Date().toLocaleTimeString('es-CO')}</p>
          <p className="mt-1">Hospital ID: {hospitalId || 'No identificado'} | Conectado a Supabase</p>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
