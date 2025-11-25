import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { BarChart3, Download, Calendar, Users, Send, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

const ReportsPage = () => {
  const [reportData, setReportData] = useState({
    totalPatients: 0,
    totalCampaigns: 0,
    totalInteractions: 0,
    deliveryRate: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = () => {
    const patients = JSON.parse(localStorage.getItem('sadi_patients') || '[]');
    const campaigns = JSON.parse(localStorage.getItem('sadi_campaigns') || '[]');
    const interactions = JSON.parse(localStorage.getItem('sadi_interactions') || '[]');
    
    const deliveredInteractions = interactions.filter(i => i.estado === 'Entregado').length;
    const deliveryRate = interactions.length > 0 ? (deliveredInteractions / interactions.length * 100).toFixed(1) : 0;

    setReportData({
      totalPatients: patients.length,
      totalCampaigns: campaigns.length,
      totalInteractions: interactions.length,
      deliveryRate: deliveryRate
    });
  };

  const exportToCSV = (type) => {
    let data = [];
    let filename = '';
    let headers = [];

    switch (type) {
      case 'patients':
        data = JSON.parse(localStorage.getItem('sadi_patients') || '[]');
        headers = ['ID', 'Nombre', 'Teléfono', 'Edad', 'Sexo', 'Ciudad', 'Programa', 'Fecha Registro'];
        filename = 'pacientes.csv';
        data = data.map(p => [p.id, p.nombre, p.telefono, p.edad, p.sexo, p.ciudad, p.programa, p.fechaRegistro]);
        break;
      case 'campaigns':
        data = JSON.parse(localStorage.getItem('sadi_campaigns') || '[]');
        headers = ['ID', 'Nombre', 'Estado', 'Fecha Creación', 'Fecha Programada', 'Destinatarios', 'Enviados', 'Entregados'];
        filename = 'campañas.csv';
        data = data.map(c => [c.id, c.nombre, c.estado, c.fechaCreacion, c.fechaProgramada, c.destinatarios, c.enviados, c.entregados]);
        break;
      case 'interactions':
        data = JSON.parse(localStorage.getItem('sadi_interactions') || '[]');
        headers = ['ID', 'Paciente', 'Teléfono', 'Fecha', 'Hora', 'Canal', 'Estado', 'Campaña'];
        filename = 'interacciones.csv';
        data = data.map(i => [i.id, i.pacienteNombre, i.pacienteTelefono, i.fecha, i.hora, i.canal, i.estado, i.campañaNombre]);
        break;
      default:
        return;
    }

    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    data.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Reporte exportado",
      description: `El archivo ${filename} ha sido descargado exitosamente`,
    });
  };

  const reportCards = [
    {
      title: 'Total Pacientes',
      value: reportData.totalPatients,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Total Campañas',
      value: reportData.totalCampaigns,
      icon: Send,
      color: 'bg-green-500'
    },
    {
      title: 'Total Interacciones',
      value: reportData.totalInteractions,
      icon: BarChart3,
      color: 'bg-purple-500'
    },
    {
      title: 'Tasa de Entrega',
      value: `${reportData.deliveryRate}%`,
      icon: TrendingUp,
      color: 'bg-orange-500'
    }
  ];

  const exportOptions = [
    {
      title: 'Reporte de Pacientes',
      description: 'Exportar lista completa de pacientes con sus datos',
      type: 'patients'
    },
    {
      title: 'Reporte de Campañas',
      description: 'Exportar historial de campañas y sus resultados',
      type: 'campaigns'
    },
    {
      title: 'Reporte de Interacciones',
      description: 'Exportar registro de todas las comunicaciones',
      type: 'interactions'
    }
  ];

  return (
    <Layout>
      <Helmet>
        <title>Reportes - SADI</title>
        <meta name="description" content="Análisis y exportación de reportes" />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes y Análisis</h1>
          <p className="text-gray-500 mt-1">Visualiza métricas y exporta datos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {reportCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-md p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{card.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                  </div>
                  <div className={`${card.color} p-4 rounded-lg`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Exportar Reportes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {exportOptions.map((option, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-gray-900 mb-2">{option.title}</h3>
                <p className="text-sm text-gray-500 mb-4">{option.description}</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => exportToCSV(option.type)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-6">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Análisis de Campañas</h2>
          </div>

          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Rendimiento Mensual</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Octubre 2025</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-48 bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">85%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Noviembre 2025</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-48 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">92%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReportsPage;