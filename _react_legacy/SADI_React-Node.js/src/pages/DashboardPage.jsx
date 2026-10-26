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
    return (
      user.hospitalId ||
      user.hospital_id ||
      user.Hospital_ID ||
      null
    );
  }, [user]);

  const fetchPatientsCount = useCallback(async (hospital_id) => {
    try {
      let query = supabase
        .from('patients')
        .select('patient_id', { count: 'exact', head: true });

      if (hospital_id) query = query.eq('hospital_id', hospital_id);

      const { count, error } = await withTimeout(query, 12000);
      if (error) throw error;
      return Number(count) || 0;
    } catch {
      return 0;
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

  const fetchInteractionsSummary = useCallback(async (hospital_id) => {
    try {
      let countQuery = supabase
        .from('interactions')
        .select('*', { count: 'exact', head: true });

      let recentQuery = supabase
        .from('interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (hospital_id) {
        countQuery = countQuery.eq('hospital_id', hospital_id);
        recentQuery = recentQuery.eq('hospital_id', hospital_id);
      }

      const [{ count, error: countError }, { data: recent, error: recentError }] = await Promise.all([
        withTimeout(countQuery, 12000),
        withTimeout(recentQuery, 12000),
      ]);

      if (countError) throw countError;
      if (recentError) throw recentError;

      return { count: Number(count) || 0, recent: recent || [] };
    } catch {
      return { count: 0, recent: [] };
    }
  }, []);

  const loadDashboardData = useCallback(async (hospital_id) => {
    try {
      setLoading(true);
      setError(null);

      const [patientsCount, campaignsData, interactionsSummary] = await Promise.all([
        fetchPatientsCount(hospital_id),
        fetchCampaigns(hospital_id),
        fetchInteractionsSummary(hospital_id),
      ]);

      const statuses = campaignsData.map(getEffectiveCampaignStatus);
      const pendingCampaigns = statuses.filter((s) => s !== 'Completada').length;

      const totalDestinatarios = campaignsData.reduce((acc, curr) => acc + (Number(curr.destinatarios) || 0), 0);
      const totalEntregados = campaignsData.reduce((acc, curr) => acc + (Number(curr.entregados) || 0), 0);

      const deliveryRate = totalDestinatarios > 0
        ? ((totalEntregados / totalDestinatarios) * 100).toFixed(1)
        : 0;

      setStats({
        totalPatients: patientsCount,
        activeCampaigns: pendingCampaigns,
        deliveryRate: deliveryRate,
        totalInteractions: interactionsSummary.count,
      });

      calculateCampaignStats(campaignsData);
      generateRecentActivity(campaignsData, interactionsSummary.recent);
    } catch (err) {
      setError(err?.message || 'Error cargando dashboard');
    } finally {
      setLoading(false);
    }
  }, [fetchCampaigns, fetchInteractionsSummary, fetchPatientsCount]);

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

  const calculateCampaignStats = (campaigns) => {
    const statuses = campaigns.map(getEffectiveCampaignStatus);
    const enProgreso = statuses.filter((s) => s === 'Activa').length;
    const completadas = statuses.filter((s) => s === 'Completada').length;
    const programadas = statuses.filter((s) => s === 'Programada' || s === 'No Enviada').length;

    // Calcular participantes por demografía
    let hombres = 0, mujeres = 0, ninos = 0, ninas = 0;
    campaigns.forEach(campaign => {
      if (campaign.participantes) {
        const participantes = typeof campaign.participantes === 'string' 
          ? JSON.parse(campaign.participantes) 
          : campaign.participantes;
        
        hombres += participantes.hombres || 0;
        mujeres += participantes.mujeres || 0;
        ninos += participantes.ninos || 0;
        ninas += participantes.ninas || 0;
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

  const generateRecentActivity = (campaigns, interactions) => {
    const activities = [];
    
    // Agregar campañas recientes
    const recentCampaigns = campaigns
      .sort((a, b) => new Date(b.created_at || b.fecha_creacion) - new Date(a.created_at || a.fecha_creacion))
      .slice(0, 2);
    
    recentCampaigns.forEach(campaign => {
      const timeAgo = getTimeAgo(new Date(campaign.created_at || campaign.fecha_creacion));
      const status = getEffectiveCampaignStatus(campaign);
      activities.push({
        type: 'campaign',
        message: `Campaña "${campaign.nombre || campaign.name}" ${status.toLowerCase()}`,
        time: timeAgo,
        color: 'bg-blue-500'
      });
    });

    const recentInteractions = (interactions || []).slice(0, 2);
    
    recentInteractions.forEach(interaction => {
      const estado = interaction.estado || interaction.status;
      const timeAgo = getTimeAgo(new Date(interaction.created_at || interaction.fecha_creacion));
      activities.push({
        type: 'interaction',
        message: `Mensaje ${(estado || '').toLowerCase()}`,
        time: timeAgo,
        color: (estado === 'Entregado' || estado === 'delivered') ? 'bg-green-500' : 'bg-yellow-500'
      });
    });

    setRecentActivity(activities.slice(0, 4));
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
      value: stats.totalPatients,
      icon: Users,
      color: 'bg-blue-500',
      subtitle: 'Registrados en el sistema'
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
      subtitle: 'Mensajes entregados'
    },
    {
      title: 'Interacciones',
      value: stats.totalInteractions,
      icon: MessageSquare,
      color: 'bg-orange-500',
      subtitle: 'Total de mensajes'
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
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Cargando estadísticas desde Supabase...</p>
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
          <div className="bg-white rounded-xl shadow-md p-8 max-w-md">
            <div className="text-center">
              <Activity className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar datos</h3>
              <p className="text-gray-600 mb-4">{error}</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Vista general del sistema - Datos en tiempo real desde Supabase</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiCards.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{kpi.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
                    <p className="text-xs text-gray-500 mt-2">{kpi.subtitle}</p>
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
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Actividad Reciente</h2>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((item, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 ${item.color} rounded-full`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.message}</p>
                      <p className="text-xs text-gray-500">{item.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay actividad reciente</p>
                </div>
              )}
            </div>
          </div>

          {/* Estadísticas de Campañas */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Estadísticas de Campañas</h2>
            
            <div className="space-y-4">
              {/* Estado de Campañas */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Estado de Campañas</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">En Progreso</span>
                      <span className="text-sm font-bold text-blue-600">{campaignStats.enProgreso}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(campaignStats.enProgreso / Math.max(campaignStats.enProgreso + campaignStats.completadas + campaignStats.programadas, 1)) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Completadas</span>
                      <span className="text-sm font-bold text-green-600">{campaignStats.completadas}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-green-500 h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(campaignStats.completadas / Math.max(campaignStats.enProgreso + campaignStats.completadas + campaignStats.programadas, 1)) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Programadas</span>
                      <span className="text-sm font-bold text-yellow-600">{campaignStats.programadas}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(campaignStats.programadas / Math.max(campaignStats.enProgreso + campaignStats.completadas + campaignStats.programadas, 1)) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Demographics */}
              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Participantes por Demografía</h3>
                <div className="space-y-3">
                  {[
                    { label: '👨 Hombres', value: campaignStats.hombres, color: 'bg-indigo-500' },
                    { label: '👩 Mujeres', value: campaignStats.mujeres, color: 'bg-pink-500' },
                    { label: '👦 Niños', value: campaignStats.ninos, color: 'bg-cyan-500' },
                    { label: '👧 Niñas', value: campaignStats.ninas, color: 'bg-purple-500' }
                  ].map((demo, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">{demo.label}</span>
                        <span className="text-sm font-bold text-gray-900">{demo.value}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
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
        <div className="text-center text-sm text-gray-500">
          <p>Última actualización: {new Date().toLocaleTimeString('es-CO')}</p>
          <p className="mt-1">Hospital ID: {hospitalId || 'No identificado'} | Conectado a Supabase</p>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
