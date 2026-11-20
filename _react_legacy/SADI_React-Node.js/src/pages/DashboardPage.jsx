import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import {
  Users,
  TrendingUp,
  Loader2,
  Activity,
  MessageCircle,
  Smartphone,
  Mail,
  PhoneCall,
  CheckCircle2,
  XCircle,
  BarChart3,
  Eye,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout } from '@/lib/utils';
import { reportsAnalysisService } from '@/services/reportsAnalysisService';
import { CursoVidaBadge, GruposRiesgoBadges } from '@/components/PatientClinicalBadges';

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

const CANAL_META = {
  whatsapp: {
    label: 'WhatsApp',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
  },
  sms: {
    label: 'SMS',
    badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60',
  },
  email: {
    label: 'E-Mail',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60',
  },
  call: {
    label: 'Llamada',
    badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800/60',
  },
};

const DashboardPage = () => {
  const { user, reload, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalPatients: 0,
    deliveryRate: '0.0',
  });

  const [effectiveness, setEffectiveness] = useState({
    total: 0,
    efectivas: 0,
    fallidas: 0,
    pctEfectivas: '0.0',
    pctFallidas: '0.0',
  });

  const [channelTotals, setChannelTotals] = useState({
    whatsapp: 0,
    sms: 0,
    email: 0,
    call: 0,
  });

  const [recentCommunications, setRecentCommunications] = useState([]);
  const [traceChannelFilter, setTraceChannelFilter] = useState(null); // null = closed, 'all' | 'whatsapp' | 'sms' | 'email' | 'call'

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

  const fetchHospitalCommunications = useCallback(async (hospital_id) => {
    try {
      const matrix = await withTimeout(
        reportsAnalysisService.getChannelMatrixHeader(hospital_id),
        15000
      );
      const totales = matrix?.totales || {};
      const eff = matrix?.effectiveness || {};
      return {
        channels: {
          whatsapp: Number(totales.whatsapp || 0),
          sms: Number(totales.sms || 0),
          email: Number(totales.email || 0),
          call: Number(totales.call || 0),
        },
        effectiveness: {
          total: Number(eff.total || 0),
          efectivas: Number(eff.efectivas || 0),
          fallidas: Number(eff.fallidas || 0),
          pctEfectivas: Number(eff.pct_efectivas || 0).toFixed(1),
          pctFallidas: Number(eff.pct_fallidas || 0).toFixed(1),
        },
        recentCommunications: Array.isArray(matrix?.recentCommunications)
          ? matrix.recentCommunications
          : [],
      };
    } catch {
      return {
        channels: { whatsapp: 0, sms: 0, email: 0, call: 0 },
        effectiveness: {
          total: 0,
          efectivas: 0,
          fallidas: 0,
          pctEfectivas: '0.0',
          pctFallidas: '0.0',
        },
        recentCommunications: [],
      };
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

      const [patientsSummary, campaignsData, commData] = await Promise.all([
        fetchPatientsSummary(hospital_id),
        fetchCampaigns(hospital_id),
        fetchHospitalCommunications(hospital_id),
      ]);

      setStats({
        totalPatients: patientsSummary.count,
        deliveryRate: commData.effectiveness.pctEfectivas,
      });

      setEffectiveness(commData.effectiveness);
      setChannelTotals(commData.channels);
      setRecentCommunications(commData.recentCommunications);
      calculateCampaignStats(campaignsData, patientsSummary.patients, patientsSummary.demography);
    } catch (err) {
      setError(err?.message || 'Error cargando dashboard');
    } finally {
      setLoading(false);
    }
  }, [calculateCampaignStats, fetchCampaigns, fetchHospitalCommunications, fetchPatientsSummary]);

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

  const filteredTraceList = useMemo(() => {
    if (!traceChannelFilter || traceChannelFilter === 'all') return recentCommunications;
    return recentCommunications.filter((ev) => ev.canal === traceChannelFilter);
  }, [recentCommunications, traceChannelFilter]);

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
          {/* KPI 1: Total Pacientes */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-md p-6 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Total Pacientes</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {typeof stats.totalPatients === 'number'
                    ? stats.totalPatients.toLocaleString('es-CO')
                    : stats.totalPatients}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                  Pacientes reales en Supabase
                </p>
              </div>
              <div className="bg-blue-500 p-4 rounded-lg">
                <Users className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>

          {/* KPI 2: Efectividad de Campañas (% Intervenciones Efectivas y % Intervenciones Fallidas) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-md p-6 hover:shadow-lg transition-all">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
                  Efectividad de Campañas
                </p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                  {effectiveness.total > 0
                    ? `${effectiveness.total.toLocaleString('es-CO')} intervención(es) evaluada(s)`
                    : 'Sin intervenciones evaluadas aún'}
                </p>
              </div>
              <div className="bg-emerald-500 p-3 rounded-lg flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg px-3 py-2 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Efectivas</span>
                </div>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {effectiveness.pctEfectivas}%
                </p>
                <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                  Intervenciones Efectivas ({effectiveness.efectivas.toLocaleString('es-CO')})
                </p>
              </div>

              <div className="rounded-lg px-3 py-2 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                  <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Fallidas</span>
                </div>
                <p className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                  {effectiveness.pctFallidas}%
                </p>
                <p className="text-[10px] text-rose-700/80 dark:text-rose-400/80">
                  Intervenciones Fallidas ({effectiveness.fallidas.toLocaleString('es-CO')})
                </p>
              </div>
            </div>
          </div>

          {/* KPI 3: Tasa de Entrega */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-md p-6 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Tasa de Entrega</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.deliveryRate}%</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                  Contactos y envíos exitosos
                </p>
              </div>
              <div className="bg-purple-500 p-4 rounded-lg">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
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
                    Acumulado hasta la fecha por este hospital · Haz clic en un canal para ver detalle
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTraceChannelFilter('all')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Total: {totalCommunications.toLocaleString('es-CO')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {channelCards.map((channel) => {
                  const Icon = channel.icon;
                  return (
                    <button
                      type="button"
                      key={channel.key}
                      onClick={() => setTraceChannelFilter(channel.key)}
                      className={`text-left rounded-xl border p-5 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${channel.cardBg}`}
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
                    </button>
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

      {/* Modal de Trazabilidad por Canal (Muestra exactamente a quién y de dónde salió cada comunicación) */}
      {traceChannelFilter && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setTraceChannelFilter(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Detalle de Comunicaciones —{' '}
                  {traceChannelFilter === 'all'
                    ? 'Todos los Canales'
                    : CANAL_META[traceChannelFilter]?.label || traceChannelFilter}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Trazabilidad verificada por paciente, curso de vida, grupo de riesgo y origen en Supabase
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTraceChannelFilter(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Cerrar detalle"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              {[
                { key: 'all', label: `Todos (${totalCommunications})` },
                { key: 'whatsapp', label: `WhatsApp (${channelTotals.whatsapp})` },
                { key: 'sms', label: `SMS (${channelTotals.sms})` },
                { key: 'email', label: `E-Mails (${channelTotals.email})` },
                { key: 'call', label: `Llamadas (${channelTotals.call})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTraceChannelFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    traceChannelFilter === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {filteredTraceList.length > 0 ? (
                <div className="space-y-3">
                  {filteredTraceList.map((ev) => {
                    const meta = CANAL_META[ev.canal] || CANAL_META.call;
                    const fechaStr = ev.created_at
                      ? new Date(ev.created_at).toLocaleString('es-CO', {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';
                    return (
                      <div
                        key={`${ev.source_table}-${ev.id}`}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {ev.patient_name || 'Sin nombre'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {ev.tipo_documento || 'CC'}: {ev.patient_document || '—'}
                              {ev.ubicacion ? ` · ${ev.ubicacion}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.badge}`}>
                              {meta.label}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                ev.efectiva
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60'
                              }`}
                            >
                              {ev.efectiva ? 'Efectiva' : 'Fallida'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <CursoVidaBadge patient={ev} />
                          <GruposRiesgoBadges patient={ev} />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/70 dark:border-slate-700/60">
                          <span>
                            Motivo: <strong className="text-slate-700 dark:text-slate-200">{ev.motivo || '—'}</strong> · Origen:{' '}
                            <code className="font-mono text-[10px]">{ev.source_table}</code>
                            {Number(ev.duracion_segundos) > 0 ? ` · ${ev.duracion_segundos}s` : ''}
                          </span>
                          <span>{fechaStr}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-sm text-slate-500 dark:text-slate-400">
                  No hay registros para este canal todavía.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DashboardPage;
