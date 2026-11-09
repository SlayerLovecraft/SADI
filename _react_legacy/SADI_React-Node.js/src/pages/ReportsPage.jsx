// ==============================================================================
// ReportsPage.jsx - REPORTES Y ANÁLISIS DE DEMANDA INDUCIDA (RESOLUCIÓN 3280)
// - Header Multicanal: SMS, Email, Llamadas (Puerto 22), WhatsApp vs Cursos A-J y Riesgo 1-7
// - Cuadro con Columna Flotante de Filtros (Curso de Vida, Riesgo, Barrio, Comuna, Zona Urbana/Rural)
// - Gráfica de Torta Interactiva Exportable a PNG y EXCEL
// - Módulos de Exportación y Auditoría Hospitalaria
// ==============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Loader2, 
  Send, 
  TrendingUp, 
  Users, 
  Filter, 
  RotateCcw, 
  MapPin, 
  ShieldCheck, 
  PieChart as PieIcon,
  FileSpreadsheet,
  Building2,
  Sparkles,
  Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  PROGRAMAS_3280, 
  GRUPOS_RIESGO_PRIORIZADOS 
} from '@/services/census400kService';
import { 
  reportsAnalysisService, 
  ZONAS_LIST, 
  COMUNAS_LIST, 
  BARRIOS_LIST 
} from '@/services/reportsAnalysisService';
import MultichannelReportHeader from '@/components/MultichannelReportHeader';
import InteractivePieChart from '@/components/InteractivePieChart';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ReportsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [matrixData, setMatrixData] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Estados de los 5 Filtros de la Columna Flotante (Boceto del Usuario)
  const [selectedCursoVida, setSelectedCursoVida] = useState('todos');
  const [selectedGrupoRiesgo, setSelectedGrupoRiesgo] = useState('todos');
  const [selectedBarrio, setSelectedBarrio] = useState('todos');
  const [selectedComuna, setSelectedComuna] = useState('todos');
  const [selectedZona, setSelectedZona] = useState('todos');

  // Cargar datos consolidados de la matriz
  const loadReportsData = useCallback(async () => {
    try {
      setLoading(true);
      const hospitalId = user?.role === 'super_admin' ? null : user?.hospitalId;
      const data = await reportsAnalysisService.getChannelMatrixHeader(hospitalId);
      setMatrixData(data);
    } catch (e) {
      console.error('Error cargando reportes:', e);
      toast({
        title: 'Error al cargar métricas',
        description: e.message || 'No se pudieron recuperar los datos de Supabase',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  // Cálculo reactivo de los datos para la gráfica de torta según los filtros seleccionados
  const pieChartData = useMemo(() => {
    return reportsAnalysisService.computePieChartData({
      cursoVida: selectedCursoVida,
      grupoRiesgo: selectedGrupoRiesgo,
      barrio: selectedBarrio,
      comuna: selectedComuna,
      zona: selectedZona,
      matrixData: matrixData
    });
  }, [selectedCursoVida, selectedGrupoRiesgo, selectedBarrio, selectedComuna, selectedZona, matrixData]);

  // Etiquetas legibles de los filtros para exportación
  const filterLabels = useMemo(() => {
    const prog = PROGRAMAS_3280.find(p => p.id === selectedCursoVida);
    const rg = GRUPOS_RIESGO_PRIORIZADOS.find(r => String(r.id) === selectedGrupoRiesgo);

    return {
      cursoVida: prog ? `${prog.id}. ${prog.nombre}` : 'Todos los Cursos (A - J)',
      grupoRiesgo: rg ? `${rg.id}. ${rg.titulo}` : 'Todos los Grupos (1 - 7)',
      barrio: selectedBarrio === 'todos' ? 'Todos los Barrios' : selectedBarrio,
      comuna: selectedComuna === 'todos' ? 'Todas las Comunas' : selectedComuna,
      zona: selectedZona === 'todos' ? 'Todas las Zonas (Urbana y Rural)' : selectedZona
    };
  }, [selectedCursoVida, selectedGrupoRiesgo, selectedBarrio, selectedComuna, selectedZona]);

  // Restablecer todos los filtros
  const handleResetFilters = () => {
    setSelectedCursoVida('todos');
    setSelectedGrupoRiesgo('todos');
    setSelectedBarrio('todos');
    setSelectedComuna('todos');
    setSelectedZona('todos');
  };

  const activeFiltersCount = [
    selectedCursoVida !== 'todos',
    selectedGrupoRiesgo !== 'todos',
    selectedBarrio !== 'todos',
    selectedComuna !== 'todos',
    selectedZona !== 'todos'
  ].filter(Boolean).length;

  // Exportaciones de auditoría general (Pacientes, Campañas, Interacciones)
  const exportAuditDataset = async (type, format) => {
    try {
      setExporting(true);
      let query;
      let filenameBase = '';
      let columns = [];
      let rows = [];

      if (type === 'patients') {
        query = supabase.from('patients').select('patient_id, name, document, phone, email, birthdate, sex, city, program, address, zona, barrio, comuna, created_at');
        const { data, error } = await query;
        if (error) throw error;
        filenameBase = 'pacientes_georreferenciados_3280';
        columns = ['ID', 'Nombre', 'Documento', 'Teléfono', 'Email', 'Sexo', 'Programa 3280', 'Zona', 'Barrio', 'Comuna', 'Dirección'];
        rows = (data || []).map(p => ({
          ID: p.patient_id,
          Nombre: p.name || '',
          Documento: p.document || '',
          Teléfono: p.phone || '',
          Email: p.email || '',
          Sexo: p.sex || '',
          'Programa 3280': p.program || '',
          Zona: p.zona || 'Urbana',
          Barrio: p.barrio || 'Centro',
          Comuna: p.comuna || 'Comuna 1',
          Dirección: p.address || ''
        }));
      } else if (type === 'campaigns') {
        query = supabase.from('campaigns').select('*');
        const { data, error } = await query;
        if (error) throw error;
        filenameBase = 'campanas_demanda_inducida';
        columns = ['ID', 'Nombre', 'Tipo', 'Canal', 'Estado', 'Destinatarios', 'Creado'];
        rows = (data || []).map(c => ({
          ID: c.id,
          Nombre: c.nombre || '',
          Tipo: c.tipo || '',
          Canal: c.canal || '',
          Estado: c.estado || '',
          Destinatarios: c.destinatarios || c.destinatarios_count || 0,
          Creado: c.created_at ? new Date(c.created_at).toLocaleString('es-CO') : ''
        }));
      } else {
        query = supabase.from('interactions').select('*');
        const { data, error } = await query;
        if (error) throw error;
        filenameBase = 'interacciones_multicanal';
        columns = ['ID', 'Canal', 'Estado', 'Mensaje', 'Fecha'];
        rows = (data || []).map(i => ({
          ID: i.id,
          Canal: i.tipo_canal || i.tipo || '',
          Estado: i.estado || '',
          Mensaje: i.mensaje || i.mensaje_enviado || '',
          Fecha: i.created_at ? new Date(i.created_at).toLocaleString('es-CO') : ''
        }));
      }

      const filename = `${filenameBase}.${format}`;

      if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(rows, { header: columns });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Datos');
        XLSX.writeFile(wb, filename);
      } else if (format === 'csv') {
        const header = columns.join(',');
        const csvRows = rows.map(r => columns.map(c => `"${String(r[c] ?? '').replaceAll('"', '""')}"`).join(','));
        const csvContent = [header, ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
      }

      toast({
        title: 'Exportación Exitosa',
        description: `Se descargó "${filename}" con los registros solicitados.`,
        className: 'bg-emerald-600 text-white font-bold'
      });
    } catch (err) {
      console.error('Error exportando datos:', err);
      toast({
        title: 'Fallo al exportar',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setExporting(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-teal-600 mx-auto mb-3" />
            <p className="text-slate-600 text-sm">Cargando reportes hospitalarios...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Reportes y Análisis • SADI</title>
        <meta name="description" content="Reportes y análisis multicanal de demanda inducida Resolución 3280" />
      </Helmet>

      <div className="w-full space-y-6">
        {/* ========================================================================= */}
        {/* ENCABEZADO DE PÁGINA                                                      */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200">
                Auditoría & Analítica
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                • Resolución 3280 de 2018
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 tracking-tight">
              Reportes y Análisis de Demanda Inducida
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
              Consolidación de emisiones multicanal por Curso de Vida y Grupo de Riesgo, con gráfica interactiva filtrable por zona territorial (Rural/Urbana), comuna y barrio.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              Base de Datos Sincronizada
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECCIÓN 1: HEADER CON DATOS SMS, EMAIL, LLAMADAS Y WHATSAPP               */}
        {/* ========================================================================= */}
        <MultichannelReportHeader matrixData={matrixData} loading={loading} />

        {/* ========================================================================= */}
        {/* SECCIÓN 2: CUADRO CON COLUMNA FLOTANTE DE FILTRO Y GRÁFICA DE TORTA      */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* COLUMNA FLOTANTE DE FILTROS (IZQUIERDA: 4 COLUMNAS DE 12 = ~33%) */}
          <div className="lg:col-span-4 lg:sticky lg:top-20 z-10 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
                  <Filter className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Filtros de Segmentación
                  </h3>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    Columna Flotante de Filtro Dinámico
                  </span>
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg transition-colors"
                  title="Restablecer todos los filtros"
                >
                  <RotateCcw className="w-3 h-3" />
                  Limpiar ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* 1. SELECT CURSO DE VIDA (A - J) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>1. Curso de Vida:</span>
                <span className="text-[10px] font-mono text-teal-700 font-semibold">10 Cursos (A - J)</span>
              </label>
              <select
                value={selectedCursoVida}
                onChange={(e) => setSelectedCursoVida(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
              >
                <option value="todos">Todos los Cursos de Vida (A - J)</option>
                {PROGRAMAS_3280.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id}. {p.nombre} ({p.rango})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. SELECT GRUPO DE RIESGO PRIORIZADO (1 - 7) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>2. Grupo de Riesgo Priorizado:</span>
                <span className="text-[10px] font-mono text-amber-700 font-semibold">7 Grupos</span>
              </label>
              <select
                value={selectedGrupoRiesgo}
                onChange={(e) => setSelectedGrupoRiesgo(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
              >
                <option value="todos">Todos los Grupos de Riesgo Priorizados</option>
                {GRUPOS_RIESGO_PRIORIZADOS.map((rg) => (
                  <option key={rg.id} value={String(rg.id)}>
                    {rg.id}. {rg.titulo}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. SELECT ZONA (URBANA / RURAL) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>3. Zona Geográfica:</span>
                <span className="text-[10px] font-bold text-slate-400">BD Actualizada</span>
              </label>
              <select
                value={selectedZona}
                onChange={(e) => setSelectedZona(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
              >
                <option value="todos">Todas las Zonas (Urbana y Rural)</option>
                <option value="Urbana">Zona Urbana</option>
                <option value="Rural">Zona Rural (Veredas y Corregimientos)</option>
              </select>
            </div>

            {/* 4. SELECT COMUNA */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                4. Comuna o Corregimiento:
              </label>
              <select
                value={selectedComuna}
                onChange={(e) => setSelectedComuna(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
              >
                <option value="todos">Todas las Comunas y Corregimientos</option>
                {COMUNAS_LIST.slice(1).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 5. SELECT BARRIO */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                5. Barrio o Vereda:
              </label>
              <select
                value={selectedBarrio}
                onChange={(e) => setSelectedBarrio(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
              >
                <option value="todos">Todos los Barrios y Veredas</option>
                {BARRIOS_LIST.slice(1).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Banner de Georreferenciación Activa */}
            <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100 flex items-start gap-2 text-[11px] text-teal-900 leading-relaxed">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <strong>Ubicación Exacta Georreferenciada:</strong> La tabla de pacientes cuenta con campos de geolocalización territorial para discriminar canales óptimos de contacto.
              </div>
            </div>
          </div>

          {/* ÁREA DE LA GRÁFICA DE TORTA (DERECHA: 8 COLUMNAS DE 12 = ~67%) */}
          <div className="lg:col-span-8">
            <InteractivePieChart
              chartData={pieChartData}
              filterLabels={filterLabels}
              loading={loading}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECCIÓN 3: EXPORTACIÓN DE REPORTES DE AUDITORÍA                           */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Download className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Exportación de Reportes y Auditoría Hospitalaria
                </h3>
                <p className="text-xs text-slate-500">
                  Descargue los conjuntos de datos oficiales en formatos compatibles con sistemas de información en salud.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Pacientes con Zonas */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:border-slate-300 transition-colors space-y-3">
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  Pacientes y Territorio 3280
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Lista completa con columnas de zona (Rural/Urbana), comuna y barrio.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('patients', 'xlsx')}
                  disabled={exporting}
                  className="rounded-xl text-xs font-bold gap-1 text-emerald-800 border-emerald-200 hover:bg-emerald-50 h-8"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel (XLSX)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('patients', 'csv')}
                  disabled={exporting}
                  className="rounded-xl text-xs font-bold gap-1 text-slate-700 border-slate-200 hover:bg-slate-50 h-8"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </Button>
              </div>
            </div>

            {/* Card 2: Campañas */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:border-slate-300 transition-colors space-y-3">
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  Historial de Campañas
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Registro de campañas por canal, estado, grupos de riesgo y tasa de contacto.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('campaigns', 'xlsx')}
                  disabled={exporting}
                  className="rounded-xl text-xs font-bold gap-1 text-emerald-800 border-emerald-200 hover:bg-emerald-50 h-8"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel (XLSX)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('campaigns', 'csv')}
                  disabled={exporting}
                  className="rounded-xl text-xs font-bold gap-1 text-slate-700 border-slate-200 hover:bg-slate-50 h-8"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </Button>
              </div>
            </div>

            {/* Card 3: Interacciones */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:border-slate-300 transition-colors space-y-3">
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  Interacciones Multicanal
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Logs de llamadas (Puerto 22), mensajes SMS, WhatsApp y correos emitidos.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('interactions', 'xlsx')}
                  disabled={exporting}
                  className="rounded-xl text-xs font-bold gap-1 text-emerald-800 border-emerald-200 hover:bg-emerald-50 h-8"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel (XLSX)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('interactions', 'csv')}
                  disabled={exporting}
                  className="rounded-xl text-xs font-bold gap-1 text-slate-700 border-slate-200 hover:bg-slate-50 h-8"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReportsPage;
