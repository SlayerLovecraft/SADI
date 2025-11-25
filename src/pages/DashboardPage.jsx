import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Users, Send, TrendingUp, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeCampaigns: 0,
    deliveryRate: 0,
    totalInteractions: 0
  });

  useEffect(() => {
    // Load stats from localStorage
    const patients = JSON.parse(localStorage.getItem('sadi_patients') || '[]');
    const campaigns = JSON.parse(localStorage.getItem('sadi_campaigns') || '[]');
    const interactions = JSON.parse(localStorage.getItem('sadi_interactions') || '[]');
    
    const activeCampaigns = campaigns.filter(c => c.estado === 'Activa').length;
    const deliveredInteractions = interactions.filter(i => i.estado === 'Entregado').length;
    const deliveryRate = interactions.length > 0 ? (deliveredInteractions / interactions.length * 100).toFixed(1) : 0;

    setStats({
      totalPatients: patients.length,
      activeCampaigns: activeCampaigns,
      deliveryRate: deliveryRate,
      totalInteractions: interactions.length
    });
  }, []);

  const kpiCards = [
    {
      title: 'Total Pacientes',
      value: stats.totalPatients,
      icon: Users,
      color: 'bg-blue-500',
      change: '+12%'
    },
    {
      title: 'Campañas Activas',
      value: stats.activeCampaigns,
      icon: Send,
      color: 'bg-green-500',
      change: '+5%'
    },
    {
      title: 'Tasa de Entrega',
      value: `${stats.deliveryRate}%`,
      icon: TrendingUp,
      color: 'bg-purple-500',
      change: '+2.3%'
    },
    {
      title: 'Interacciones',
      value: stats.totalInteractions,
      icon: MessageSquare,
      color: 'bg-orange-500',
      change: '+18%'
    }
  ];

  return (
    <Layout>
      <Helmet>
        <title>Dashboard - SADI</title>
        <meta name="description" content="Panel de control principal del sistema SADI" />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Vista general del sistema</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiCards.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{kpi.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
                    <p className="text-sm text-green-600 mt-2">{kpi.change} vs mes anterior</p>
                  </div>
                  <div className={`${kpi.color} p-4 rounded-lg`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Actividad Reciente</h2>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Campaña enviada</p>
                    <p className="text-xs text-gray-500">Hace {item} hora(s)</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Estado de Campañas</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">En Progreso</span>
                <span className="text-sm font-semibold text-gray-900">{stats.activeCampaigns}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completadas</span>
                <span className="text-sm font-semibold text-gray-900">8</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '80%' }}></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Programadas</span>
                <span className="text-sm font-semibold text-gray-900">3</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '30%' }}></div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;