import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { BarChart3, Calendar, Download, Loader2, Send, TrendingUp, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ReportsPage = () => {
  const { user } = useAuth();
  const [reportData, setReportData] = useState({
    totalPatients: 0,
    totalCampaigns: 0,
    totalInteractions: 0,
    deliveryRate: 0
  });
  const [monthlyCampaignPerformance, setMonthlyCampaignPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadReportData();
  }, [user?.hospitalId, user?.role]);

  const hospitalIdForQueries = useMemo(() => {
    if (!user) return null;
    if (user.role === 'super_admin') return null;
    return user.hospitalId || null;
  }, [user]);

  const loadReportData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const patientsQuery = supabase
        .from('patients')
        .select('patient_id', { count: 'exact', head: true });

      const campaignsQuery = supabase
        .from('campaigns')
        .select('id', { count: 'exact', head: true });

      const interactionsQuery = supabase
        .from('interactions')
        .select('id', { count: 'exact', head: true });

      const campaignsForPerformanceQuery = supabase
        .from('campaigns')
        .select('created_at, fecha_envio, destinatarios, entregados');

      if (hospitalIdForQueries) {
        patientsQuery.eq('hospital_id', hospitalIdForQueries);
        campaignsQuery.eq('hospital_id', hospitalIdForQueries);
        interactionsQuery.eq('hospital_id', hospitalIdForQueries);
        campaignsForPerformanceQuery.eq('hospital_id', hospitalIdForQueries);
      }

      const [
        patientsRes,
        campaignsRes,
        interactionsRes,
        campaignsForPerformanceRes
      ] = await Promise.all([
        patientsQuery,
        campaignsQuery,
        interactionsQuery,
        campaignsForPerformanceQuery
      ]);

      if (patientsRes.error) throw patientsRes.error;
      if (campaignsRes.error) throw campaignsRes.error;
      if (interactionsRes.error) throw interactionsRes.error;
      if (campaignsForPerformanceRes.error) throw campaignsForPerformanceRes.error;

      const campaignsForPerformance = campaignsForPerformanceRes.data || [];
      const totalDestinatarios = campaignsForPerformance.reduce((acc, c) => acc + (Number(c.destinatarios) || 0), 0);
      const totalEntregados = campaignsForPerformance.reduce((acc, c) => acc + (Number(c.entregados) || 0), 0);
      const deliveryRate = totalDestinatarios > 0 ? ((totalEntregados / totalDestinatarios) * 100).toFixed(1) : '0.0';

      setReportData({
        totalPatients: patientsRes.count || 0,
        totalCampaigns: campaignsRes.count || 0,
        totalInteractions: interactionsRes.count || 0,
        deliveryRate
      });

      const now = new Date();
      const months = Array.from({ length: 6 }).map((_, idx) => {
        const d = new Date(now.getFullYear(), now.getMonth() - idx, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { key, date: d };
      });

      const monthAgg = new Map();
      months.forEach((m) => monthAgg.set(m.key, { destinatarios: 0, entregados: 0 }));

      campaignsForPerformance.forEach((c) => {
        const raw = c.fecha_envio || c.created_at;
        if (!raw) return;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthAgg.has(key)) return;
        const agg = monthAgg.get(key);
        agg.destinatarios += Number(c.destinatarios) || 0;
        agg.entregados += Number(c.entregados) || 0;
      });

      const performance = months
        .slice()
        .reverse()
        .map((m) => {
          const agg = monthAgg.get(m.key) || { destinatarios: 0, entregados: 0 };
          const rate = agg.destinatarios > 0 ? (agg.entregados / agg.destinatarios) * 100 : 0;
          return {
            key: m.key,
            label: m.date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
            rate: Number(rate.toFixed(1))
          };
        });

      setMonthlyCampaignPerformance(performance);
    } catch (error) {
      toast({
        title: 'Error cargando reportes',
        description: error?.message || 'No se pudieron cargar los datos desde Supabase',
        variant: 'destructive'
      });
      setReportData({
        totalPatients: 0,
        totalCampaigns: 0,
        totalInteractions: 0,
        deliveryRate: 0
      });
      setMonthlyCampaignPerformance([]);
    } finally {
      setLoading(false);
    }
  }, [hospitalIdForQueries, toast, user]);

  const quoteCsvCell = (value) => {
    const str = value === null || value === undefined ? '' : String(value);
    return `"${str.replaceAll('"', '""')}"`;
  };

  const getExportDataset = async (type) => {
    if (type === 'patients') {
      let query = supabase
        .from('patients')
        .select('patient_id, name, phone, email, document, birthdate, sex, city, program, address, created_at')
        .order('created_at', { ascending: false });

      if (hospitalIdForQueries) query = query.eq('hospital_id', hospitalIdForQueries);
      const { data, error } = await query;
      if (error) throw error;

      const columns = ['ID', 'Nombre', 'Teléfono', 'Email', 'Documento', 'Fecha Nacimiento', 'Sexo', 'Ciudad', 'Programa', 'Dirección', 'Fecha Registro'];
      const rows = (data || []).map((p) => ({
        ID: p.patient_id,
        Nombre: p.name || '',
        Teléfono: p.phone || '',
        Email: p.email || '',
        Documento: p.document || '',
        'Fecha Nacimiento': p.birthdate ? new Date(p.birthdate).toLocaleDateString('es-CO') : '',
        Sexo: p.sex || '',
        Ciudad: p.city || '',
        Programa: p.program || '',
        Dirección: p.address || '',
        'Fecha Registro': p.created_at ? new Date(p.created_at).toLocaleString('es-CO') : ''
      }));

      return { filenameBase: 'pacientes', columns, rows };
    }

    if (type === 'campaigns') {
      let query = supabase
        .from('campaigns')
        .select('id, nombre, estado, created_at, fecha_programada, hora_programada, fecha_envio, destinatarios, enviados, entregados, fallidos')
        .order('created_at', { ascending: false });

      if (hospitalIdForQueries) query = query.eq('hospital_id', hospitalIdForQueries);
      const { data, error } = await query;
      if (error) throw error;

      const columns = ['ID', 'Nombre', 'Estado', 'Fecha Creación', 'Fecha Programada', 'Hora Programada', 'Fecha Envío', 'Destinatarios', 'Enviados', 'Entregados', 'Fallidos'];
      const rows = (data || []).map((c) => ({
        ID: c.id,
        Nombre: c.nombre || '',
        Estado: c.estado || '',
        'Fecha Creación': c.created_at ? new Date(c.created_at).toLocaleString('es-CO') : '',
        'Fecha Programada': c.fecha_programada ? new Date(c.fecha_programada).toLocaleDateString('es-CO') : '',
        'Hora Programada': c.hora_programada || '',
        'Fecha Envío': c.fecha_envio ? new Date(c.fecha_envio).toLocaleString('es-CO') : '',
        Destinatarios: c.destinatarios ?? 0,
        Enviados: c.enviados ?? 0,
        Entregados: c.entregados ?? 0,
        Fallidos: c.fallidos ?? 0
      }));

      return { filenameBase: 'campañas', columns, rows };
    }

    if (type === 'interactions') {
      let query = supabase
        .from('interactions')
        .select('id, patient_name, patient_phone, patient_email, tipo, asunto, mensaje, estado, created_at')
        .order('created_at', { ascending: false });

      if (hospitalIdForQueries) query = query.eq('hospital_id', hospitalIdForQueries);
      const { data, error } = await query;
      if (error) throw error;

      const columns = ['ID', 'Paciente', 'Teléfono', 'Email', 'Tipo', 'Asunto', 'Mensaje', 'Estado', 'Fecha'];
      const rows = (data || []).map((i) => ({
        ID: i.id,
        Paciente: i.patient_name || '',
        Teléfono: i.patient_phone || '',
        Email: i.patient_email || '',
        Tipo: i.tipo || '',
        Asunto: i.asunto || '',
        Mensaje: i.mensaje || '',
        Estado: i.estado || '',
        Fecha: i.created_at ? new Date(i.created_at).toLocaleString('es-CO') : ''
      }));

      return { filenameBase: 'interacciones', columns, rows };
    }

    throw new Error('Tipo de reporte inválido');
  };

  const exportReport = async (type, format) => {
    try {
      setExporting(true);
      const { filenameBase, columns, rows } = await getExportDataset(type);
      const filename = `${filenameBase}.${format}`;

      if (format === 'csv') {
        let csvContent = `${columns.join(',')}\n`;
        rows.forEach((row) => {
          const line = columns.map((c) => quoteCsvCell(row[c])).join(',');
          csvContent += `${line}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(rows, { header: columns });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
        XLSX.writeFile(wb, filename);
      } else if (format === 'pdf') {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(14);
        doc.text(`Reporte: ${filenameBase}`, 40, 40);
        autoTable(doc, {
          startY: 60,
          head: [columns],
          body: rows.map((row) => columns.map((c) => row[c] ?? '')),
          styles: { fontSize: 8, cellPadding: 3 }
        });
        doc.save(filename);
      } else {
        throw new Error('Formato inválido');
      }

      toast({
        title: 'Reporte exportado',
        description: `El archivo ${filename} fue descargado exitosamente`
      });
    } catch (error) {
      toast({
        title: 'No se pudo exportar',
        description: error?.message || 'Ocurrió un error exportando el reporte',
        variant: 'destructive'
      });
    } finally {
      setExporting(false);
    }
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

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-gray-600">Cargando sesión...</p>
          </div>
        </div>
      </Layout>
    );
  }

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
                    {loading ? (
                      <div className="h-9 w-20 bg-gray-100 rounded animate-pulse" />
                    ) : (
                      <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                    )}
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
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={exporting || loading}
                    onClick={() => exportReport(option.type, 'csv')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={exporting || loading}
                    onClick={() => exportReport(option.type, 'xlsx')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    XLSX
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={exporting || loading}
                    onClick={() => exportReport(option.type, 'pdf')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
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
              <h3 className="font-semibold text-gray-900 mb-4">Rendimiento Mensual (últimos 6 meses)</h3>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                      <div className="flex items-center space-x-2">
                        <div className="w-48 bg-gray-200 rounded-full h-2" />
                        <div className="h-4 w-10 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : monthlyCampaignPerformance.length === 0 ? (
                <p className="text-sm text-gray-600">No hay datos suficientes para mostrar el rendimiento.</p>
              ) : (
                <div className="space-y-3">
                  {monthlyCampaignPerformance.map((m) => (
                    <div key={m.key} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-gray-600 capitalize">{m.label}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-48 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.max(0, Math.min(100, m.rate))}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{m.rate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReportsPage;
