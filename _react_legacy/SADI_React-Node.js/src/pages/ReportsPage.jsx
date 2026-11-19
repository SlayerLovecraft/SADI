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
import { patientService } from '@/services/patientService';
import { getCaliComunas, getCaliCorregimientos } from '@/services/caliDivipola';
import { getPatientCursoVida, getPatientGruposRiesgo } from '@/services/callCapacityService';
import MultichannelReportHeader from '@/components/MultichannelReportHeader';
import InteractivePieChart from '@/components/InteractivePieChart';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FILTER_SELECT_CLASS =
  'w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800/90 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors';

const AUDIT_CARD_CLASS =
  'p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-3';

const EXCEL_BTN_CLASS =
  'rounded-xl text-xs font-bold gap-1 bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 h-8';

const CSV_BTN_CLASS =
  'rounded-xl text-xs font-bold gap-1 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 h-8';

const ReportsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [matrixData, setMatrixData] = useState(null);
  const [serverFilteredRpc, setServerFilteredRpc] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Estados de los 5 Filtros de la Columna Flotante (Boceto del Usuario)
  const [selectedCursoVida, setSelectedCursoVida] = useState('todos');
  const [selectedGrupoRiesgo, setSelectedGrupoRiesgo] = useState('todos');
  const [selectedBarrio, setSelectedBarrio] = useState('todos');
  const [selectedComuna, setSelectedComuna] = useState('todos');
  const [selectedZona, setSelectedZona] = useState('todos');

  const resolvedHospitalId = useMemo(() => {
    if (!user || user.role === 'super_admin') return null;
    const rawId = user.hospitalId || user.hospital_id || user.Hospital_ID;
    return !rawId || rawId === 'hosp-001' ? 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8' : rawId;
  }, [user]);

  // Cargar datos consolidados reales desde Supabase
  const loadReportsData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reportsAnalysisService.getChannelMatrixHeader(resolvedHospitalId);
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
  }, [resolvedHospitalId, toast]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  const comunasOptions = useMemo(() => {
    const dbComunas = matrixData?.filterOptions?.comunas || [];
    if (selectedZona === 'Rural') {
      return getCaliCorregimientos(dbComunas.filter((c) => !/^comuna\s/i.test(c)));
    }
    if (selectedZona === 'Urbana') {
      return getCaliComunas(dbComunas.filter((c) => /^comuna\s/i.test(c)));
    }
    return [...getCaliComunas(dbComunas), ...getCaliCorregimientos([])].filter((v, i, arr) => arr.indexOf(v) === i);
  }, [matrixData, selectedZona]);

  const barriosOptions = useMemo(() => {
    const dbBarrios = matrixData?.filterOptions?.barrios;
    return dbBarrios && dbBarrios.length > 0 ? dbBarrios : BARRIOS_LIST.slice(1);
  }, [matrixData]);

  useEffect(() => {
    if (!matrixData?.fromServerRpc) return;
    let cancelled = false;
    reportsAnalysisService
      .fetchFilteredPieStats({
        hospitalId: resolvedHospitalId,
        cursoVida: selectedCursoVida,
        grupoRiesgo: selectedGrupoRiesgo,
        barrio: selectedBarrio,
        comuna: selectedComuna,
        zona: selectedZona,
      })
      .then((res) => {
        if (!cancelled && res) setServerFilteredRpc(res);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [matrixData?.fromServerRpc, resolvedHospitalId, selectedCursoVida, selectedGrupoRiesgo, selectedBarrio, selectedComuna, selectedZona]);

  // Cálculo reactivo de los datos para la gráfica de torta según los filtros seleccionados
  const pieChartData = useMemo(() => {
    return reportsAnalysisService.computePieChartData({
      cursoVida: selectedCursoVida,
      grupoRiesgo: selectedGrupoRiesgo,
      barrio: selectedBarrio,
      comuna: selectedComuna,
      zona: selectedZona,
      matrixData: matrixData,
      serverFilteredRpc,
    });
  }, [selectedCursoVida, selectedGrupoRiesgo, selectedBarrio, selectedComuna, selectedZona, matrixData, serverFilteredRpc]);

  // Etiquetas legibles de los filtros para exportación
  const filterLabels = useMemo(() => {
    const prog = PROGRAMAS_3280.find(p => p.id === selectedCursoVida);
    const rg = GRUPOS_RIESGO_PRIORIZADOS.find(r => String(r.id) === selectedGrupoRiesgo);

    return {
      cursoVida: prog ? `${prog.id}. ${prog.nombre}` : 'Todos los Cursos (A - G)',
      grupoRiesgo: rg ? `${rg.id}. ${rg.titulo}` : 'Todos los Grupos (1 - 11)',
      barrio: selectedBarrio === 'todos' ? 'Todos los Barrios' : selectedBarrio,
      comuna: selectedComuna === 'todos' ? 'Todas las Comunas / Corregimientos' : selectedComuna,
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
        const res = await patientService.fetchAllCompact({
          hospitalId: resolvedHospitalId || null,
          batchSize: 5000,
        });
        if (!res.success) throw new Error(res.error || 'No se pudieron exportar todos los pacientes');
        const data = res.data || [];
        filenameBase = 'pacientes_georreferenciados_3280';
        columns = [
          'ID', 'Nombre', 'Documento', 'Teléfono', 'Email', 'Sexo',
          'Curso de Vida', 'Grupos de Riesgo', 'Programa 3280',
          'Zona', 'Comuna', 'Barrio', 'Corregimiento', 'Vereda', 'Centro Poblado', 'Dirección'
        ];
        rows = data.map(p => {
          const cv = getPatientCursoVida(p);
          const riesgos = getPatientGruposRiesgo(p);
          return {
            ID: p.id || p.patient_id,
            Nombre: p.nombre || p.name || '',
            Documento: p.cc || p.document || '',
            Teléfono: p.telefono || p.phone || '',
            Email: p.email || '',
            Sexo: p.sexo || p.sex || '',
            'Curso de Vida': `${cv.id}. ${cv.nombre}`,
            'Grupos de Riesgo': riesgos.length > 0 ? riesgos.map(r => r.nombre).join(' | ') : 'Sin grupo de riesgo',
            'Programa 3280': p.programa || p.program || '',
            Zona: p.zona || '',
            Comuna: p.comuna || '',
            Barrio: p.barrio || '',
            Corregimiento: p.corregimiento || '',
            Vereda: p.vereda || '',
            'Centro Poblado': p.centro_poblado || '',
            Dirección: p.direccion || p.address || ''
          };
        });
      } else if (type === 'campaigns') {
        query = supabase.from('campaigns').select('*');
        if (resolvedHospitalId) query = query.eq('hospital_id', resolvedHospitalId);
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
        if (resolvedHospitalId) query = query.eq('hospital_id', resolvedHospitalId);
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
            <Loader2 className="h-10 w-10 animate-spin text-teal-600 dark:text-teal-400 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400 text-sm">Cargando reportes hospitalarios...</p>
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                Auditoría & Analítica
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                • Resolución 3280 de 2018
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
              Reportes y Análisis de Demanda Inducida
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
              Consolidación de emisiones multicanal por Curso de Vida y Grupo de Riesgo, con gráfica interactiva filtrable por zona territorial (Rural/Urbana), comuna y barrio.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Base de Datos Sincronizada • {(matrixData?.realPatientsCount ?? 0).toLocaleString('es-CO')} pacientes reales
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
          <div className="lg:col-span-4 lg:sticky lg:top-20 z-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800/60">
                  <Filter className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Filtros de Segmentación
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">
                    Columna Flotante de Filtro Dinámico
                  </span>
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-200 font-bold flex items-center gap-1 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 px-2 py-1 rounded-lg transition-colors"
                  title="Restablecer todos los filtros"
                >
                  <RotateCcw className="w-3 h-3" />
                  Limpiar ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* 1. SELECT CURSO DE VIDA (A - G) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>1. Curso de Vida:</span>
                <span className="text-[10px] font-mono text-teal-700 dark:text-teal-400 font-semibold">7 Cursos (A - G)</span>
              </label>
              <select
                value={selectedCursoVida}
                onChange={(e) => setSelectedCursoVida(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="todos">Todos los Cursos de Vida (A - G)</option>
                {PROGRAMAS_3280.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id}. {p.nombre} ({p.rango})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. SELECT GRUPO DE RIESGO PRIORIZADO (1 - 11) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>2. Grupo de Riesgo Priorizado:</span>
                <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-semibold">11 Grupos</span>
              </label>
              <select
                value={selectedGrupoRiesgo}
                onChange={(e) => setSelectedGrupoRiesgo(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="todos">Todos los Grupos de Riesgo (1 - 11)</option>
                {GRUPOS_RIESGO_PRIORIZADOS.map((rg) => (
                  <option key={rg.id} value={String(rg.id)}>
                    {rg.id}. {rg.titulo}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. SELECT ZONA (URBANA / RURAL) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>3. Zona Geográfica:</span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">BD Actualizada</span>
              </label>
              <select
                value={selectedZona}
                onChange={(e) => setSelectedZona(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="todos">Todas las Zonas (Urbana y Rural)</option>
                <option value="Urbana">Zona Urbana</option>
                <option value="Rural">Zona Rural (Veredas y Corregimientos)</option>
              </select>
            </div>

            {/* 4. SELECT COMUNA */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                4. Comuna o Corregimiento:
              </label>
              <select
                value={selectedComuna}
                onChange={(e) => setSelectedComuna(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="todos">Todas las Comunas y Corregimientos</option>
                {comunasOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 5. SELECT BARRIO */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                5. Barrio o Vereda:
              </label>
              <select
                value={selectedBarrio}
                onChange={(e) => setSelectedBarrio(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="todos">Todos los Barrios y Veredas</option>
                {barriosOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Banner de Georreferenciación Activa */}
            <div className="p-3 bg-teal-50/60 dark:bg-teal-950/40 rounded-xl border border-teal-100 dark:border-teal-800/50 flex items-start gap-2 text-[11px] text-teal-900 dark:text-teal-200 leading-relaxed">
              <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                <Download className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Exportación de Reportes y Auditoría Hospitalaria
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Descargue los conjuntos de datos oficiales en formatos compatibles con sistemas de información en salud.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Pacientes con Zonas */}
            <div className={AUDIT_CARD_CLASS}>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  Pacientes y Territorio 3280
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Lista completa con columnas de zona (Rural/Urbana), comuna y barrio.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('patients', 'xlsx')}
                  disabled={exporting}
                  className={EXCEL_BTN_CLASS}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel (XLSX)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('patients', 'csv')}
                  disabled={exporting}
                  className={CSV_BTN_CLASS}
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </Button>
              </div>
            </div>

            {/* Card 2: Campañas */}
            <div className={AUDIT_CARD_CLASS}>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  Historial de Campañas
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Registro de campañas por canal, estado, grupos de riesgo y tasa de contacto.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('campaigns', 'xlsx')}
                  disabled={exporting}
                  className={EXCEL_BTN_CLASS}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel (XLSX)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('campaigns', 'csv')}
                  disabled={exporting}
                  className={CSV_BTN_CLASS}
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </Button>
              </div>
            </div>

            {/* Card 3: Interacciones */}
            <div className={AUDIT_CARD_CLASS}>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  Interacciones Multicanal
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Logs de llamadas (Puerto 22), mensajes SMS, WhatsApp y correos emitidos.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('interactions', 'xlsx')}
                  disabled={exporting}
                  className={EXCEL_BTN_CLASS}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel (XLSX)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAuditDataset('interactions', 'csv')}
                  disabled={exporting}
                  className={CSV_BTN_CLASS}
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
