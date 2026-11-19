import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import {
  Users,
  Send,
  TrendingUp,
  Loader2,
  Activity,
  MessageCircle,
  Smartphone,
  Mail,
  PhoneCall,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout } from '@/lib/utils';
import { reportsAnalysisService } from '@/services/reportsAnalysisService';

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
  });

  const [channelTotals, setChannelTotals] = useState({
    whatsapp: 0,
    sms: 0,
    email: 0,
    call: 0,
  });

  const [campaignStats, setCampaignStats] = useState({
    enProgreso: 0,
    completadas: 0,
    programadas: 0,
    hombres: 0,
    mujeres: 0,
    ninos: 0,
    ninas: 0,
  });

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
      const { data: rpcRows, error: rpcErr } = await withTimeout(
        supabase.rpc('get_dashboard_patient_demography', {
          p_hospital_id: hospital_id || null,
        }),
        15000
      );

      if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
        const row = rpcRows[0];
        return {
          count: Number(row.total_patients || 0),
          demography: {
            hombres: Number(row.hombres || 0),
            mujeres: Number(row.mujeres || 0),
            ninos: Number(row.ninos || 0),
            ninas: Number(row.ninas || 0),
          },
          patients: [],
        };
      }

      let query = supabase
        .from('patients')
        .select('patient_id, sex, birthdate', { count: 'exact' });

      if (hospital_id) query = query.eq('hospital_id', hospital_id);

      const { data, count, error } = await withTimeout(query, 12000);
      if (error) throw error;
      const list = data || [];
      return {
        count: typeof count === 'number' ? count : list.length,
        demography: null,
        patients: list,
      };
    } catch {
      return { count: 0, demography: null, patients: [] };
    }
  }, []);

  const fetchCampaigns = useCallback(async (hospital_id) => {
    try {
      let query = supabase.from('campaigns').select('*');
      if (hospital_id) query = query.eq('hospital_id', hospital_id);

      const { data, error } = await withTimeout(query, 12000);
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  }, []);

  const fetchChannelSummary = useCallback(async (hospital_id) => {
    try {
      const matrix = await withTimeout(
        reportsAnalysisService.getChannelMatrixHeader(hospital_id),
        15000
      );
      const totales = matrix?.totales || {};
      return {
        whatsapp: Number(totales.whatsapp || 0),
        sms: Number(totales.sms || 0),
        email: Number(totales.email || 0),
        call: Number(totales.call || 0),
      };
    } catch {
      return { whatsapp: 0, sms: 0, email: 0, call: 0 };
    }
  }, []);

  const fetchDeliveryEffectiveness = useCallback(async (hospital_id) => {
    try {
      let vapiQuery = supabase
        .from('vapi_agent_sessions')
        .select('estado_llamada, deteccion_buzon, duracion_segundos')
        .limit(500);
      let smsQuery = supabase
        .from('openvox_sms_dispatches')
        .select('status')
        .limit(500);

      if (hospital_id) {
        vapiQuery = vapiQuery.eq('hospital_id', hospital_id);
        smsQuery = smsQuery.eq('hospital_id', hospital_id);
      }

      const [vapiRes, smsRes] = await Promise.all([
        withTimeout(vapiQuery, 10000).catch(() => ({ data: [] })),
        withTimeout(smsQuery, 10000).catch(() => ({ data: [] })),
      ]);

      const vapiRows = vapiRes?.data || [];
      const smsRows = smsRes?.data || [];
      const attempts = vapiRows.length + smsRows.length;
      const successes =
        vapiRows.filter(
          (s) => !s.deteccion_buzon && (s.estado_llamada === 'completada' || Number(s.duracion_segundos) > 0)
        ).length +
        smsRows.filter((s) => s.status === 'sent').length;

      return { attempts, successes };
    } catch {
      return { attempts: 0, successes: 0 };
    }
  }, []);

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

  const calculateCampaignStats = useCallback((campaigns = [], realPatients = [], serverDemography = null) => {
    const statuses = campaigns.map(getEffectiveCampaignStatus);
    const enProgreso = statuses.filter((s) => s === 'Activa').length;
    const completadas = statuses.filter((s) => s === 'Completada').length;
    const programadas = statuses.filter((s) => s === 'Programada' || s === 'No Enviada').length;

    let hombres = 0;
    let mujeres = 0;
    let ninos = 0;
    let ninas = 0;

    if (serverDemography) {
      hombres = Number(serverDemography.hombres || 0);
      mujeres = Number(serverDemography.mujeres || 0);
      ninos = Number(serverDemography.ninos || 0);
      ninas = Number(serverDemography.ninas || 0);
    } else {
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
    }

    setCampaignStats({
      enProgreso,
      completadas,
      programadas,
      hombres,
      mujeres,
      ninos,
      ninas,
    });
  }, []);

  const loadDashboardData = useCallback(async (hospital_id) => {
    try {
      setLoading(true);
      setError(null);

      const [patientsSummary, campaignsData, channels, delivery] = await Promise.all([
        fetchPatientsSummary(hospital_id),
        fetchCampaigns(hospital_id),
        fetchChannelSummary(hospital_id),
        fetchDeliveryEffectiveness(hospital_id),
      ]);

      const statuses = campaignsData.map(getEffectiveCampaignStatus);
      const pendingCampaigns = statuses.filter((s) => s !== 'Completada').length;

      const totalDestinatarios = campaignsData.reduce((acc, curr) => acc + (Number(curr.destinatarios) || 0), 0);
      const totalEntregados = campaignsData.reduce((acc, curr) => acc + (Number(curr.entregados) || 0), 0);

      const combinedAttempts = totalDestinatarios + delivery.attempts;
      const combinedSuccess = totalEntregados + delivery.successes;
      const totalChannelsSent = channels.whatsapp + channels.sms + channels.email + channels.call;

      const deliveryRate =
        combinedAttempts > 0
          ? ((combinedSuccess / combinedAttempts) * 100).toFixed(1)
          : totalChannelsSent > 0
          ? '100.0'
          : '0';

      setStats({
        totalPatients: patientsSummary.count,
        activeCampaigns: pendingCampaigns,
        deliveryRate,
      });

      setChannelTotals(channels);
      calculateCampaignStats(campaignsData, patientsSummary.patients, patientsSummary.demography);
    } catch (err) {
      setError(err?.message || 'Error cargando dashboard');
    } finally {
      setLoading(false);
    }
  }, [calculateCampaignStats, fetchCampaigns, fetchChannelSummary, fetchDeliveryEffectiveness, fetchPatientsSummary]);

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

  const kpiCards = [
    {
      title: 'Total Pacientes',
      value: typeof stats.totalPatients === 'number' ? stats.totalPatients.toLocaleString('es-CO') : stats.totalPatients,
      icon: Users,
      color: 'bg-blue-500',
      subtitle: 'Pacientes reales en Supabase',
    },
    {
      title: 'Campañas Pendientes',
      value: stats.activeCampaigns,
      icon: Send,
      color: 'bg-green-500',
      subtitle: 'Por enviar o en proceso',
    },
    {
      title: 'Tasa de Entrega',
      value: `${stats.deliveryRate}%`,
      icon: TrendingUp,
      color: 'bg-purple-500',
      subtitle: 'Contactos y envíos exitosos',
    },
  ];

  const channelCards = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      value: channelTotals.whatsapp,
      caption: 'Mensajes enviados',
      icon: MessageCircle,
      iconBg: 'bg-emerald-500',
      cardBg: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60',
      valueColor: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      key: 'sms',
      label: 'SMS',
      value: channelTotals.sms,
      caption: 'Mensajes de texto enviados',
      icon: Smartphone,
      iconBg: 'bg-sky-500',
      cardBg: 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200/80 dark:border-sky-800/60',
      valueColor: 'text-sky-700 dark:text-sky-300',
    },
    {
      key: 'email',
      label: 'E-Mails',
      value: channelTotals.email,
      caption: 'Correos enviados',
      icon: Mail,
      iconBg: 'bg-indigo-500',
      cardBg: 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-800/60',
      valueColor: 'text-indigo-700 dark:text-indigo-300',
    },
    {
      key: 'call',
      label: 'Llamadas',
      value: channelTotals.call,
      caption: 'Llamadas realizadas',
      icon: PhoneCall,
      iconBg: 'bg-teal-600',
      cardBg: 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200/80 dark:border-teal-800/60',
      valueColor: 'text-teal-700 dark:text-teal-300',
    },
  ];

  const totalCommunications =
    channelTotals.whatsapp + channelTotals.sms + channelTotals.email + channelTotals.call;

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
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            Vista general del sistema - Datos en tiempo real desde Supabase
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          {/* Recuadro de Comunicaciones del Hospital (4 cuadros: WhatsApp, SMS, E-Mails y Llamadas) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-md p-6 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Comunicaciones Realizadas
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Acumulado hasta la fecha por este hospital
                  </p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  Total: {totalCommunications.toLocaleString('es-CO')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {channelCards.map((channel) => {
                  const Icon = channel.icon;
                  return (
                    <div
                      key={channel.key}
                      className={`rounded-xl border p-5 transition-all hover:shadow-sm ${channel.cardBg}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                          {channel.label}
                        </span>
                        <div className={`${channel.iconBg} p-2.5 rounded-lg shadow-xs`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <p className={`text-3xl font-bold tracking-tight ${channel.valueColor}`}>
                        {channel.value.toLocaleString('es-CO')}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                        {channel.caption}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Estadísticas de Campañas */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-md p-6 transition-colors">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Estadísticas de Campañas
            </h2>

            <div className="space-y-4">
              {/* Estado de Campañas */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
                  Estado de Campañas
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'En Progreso', value: campaignStats.enProgreso, textClass: 'text-blue-600 dark:text-blue-400', barClass: 'bg-blue-500' },
                    { label: 'Completadas', value: campaignStats.completadas, textClass: 'text-green-600 dark:text-green-400', barClass: 'bg-green-500' },
                    { label: 'Programadas', value: campaignStats.programadas, textClass: 'text-yellow-600 dark:text-yellow-400', barClass: 'bg-yellow-500' },
                  ].map((st) => {
                    const total = Math.max(
                      campaignStats.enProgreso + campaignStats.completadas + campaignStats.programadas,
                      1
                    );
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
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
                  Demografía de Pacientes en BD
                </h3>
                <div className="space-y-3">
                  {[
                    { label: '👨 Hombres', value: campaignStats.hombres, color: 'bg-indigo-500' },
                    { label: '👩 Mujeres', value: campaignStats.mujeres, color: 'bg-pink-500' },
                    { label: '👦 Niños', value: campaignStats.ninos, color: 'bg-cyan-500' },
                    { label: '👧 Niñas', value: campaignStats.ninas, color: 'bg-purple-500' },
                  ].map((demo, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-slate-300">{demo.label}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {demo.value.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-3">
                        <div
                          className={`${demo.color} h-3 rounded-full transition-all duration-500`}
                          style={{
                            width: `${
                              (demo.value /
                                Math.max(
                                  campaignStats.hombres +
                                    campaignStats.mujeres +
                                    campaignStats.ninos +
                                    campaignStats.ninas,
                                  1
                                )) *
                              100
                            }%`,
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
