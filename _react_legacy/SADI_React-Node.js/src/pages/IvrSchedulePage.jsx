// ==============================================================================
// IvrSchedulePage.jsx - CRONOGRAMA AUTOMÁTICO Y ROADMAP MENSUAL SADI 3280
// 1. ROADMAP MENSUAL EN 3 SECCIONES:
//    - Sección 1: Resolución 3280 (Todos los pacientes, hitos clínicos calculados,
//      horarios 10am-6pm inamovibles, renovación fin de mes, histórico de meses y descarga)
//    - Sección 2: Campañas (Ruta de campañas activas del mes, filtros de edad, reintentos)
//    - Sección 3: Individual o Particular (Llamadas bajo demanda, efectividad y transcripciones)
//    - Descarga Excel (3 hojas: Resolución 3280, Campañas, Individuales)
// 2. MONITOR DE TANDAS DIARIAS (Tandas de 32 pacientes cada 30 min)
// 3. BANDEJA DE CASOS AISLADOS (Gestión Humana)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { 
  Clock, PhoneCall, CheckCircle2, AlertTriangle, UserX, 
  RotateCw, Play, ShieldAlert, Sparkles, Phone, MessageSquare, 
  Calendar, Check, UserCheck, Search, Filter, Info, ChevronRight,
  Settings, ArrowRight, ShieldCheck, Download, FileSpreadsheet,
  Eye, CheckCircle, FileText, Layers, History, Users, RefreshCw,
  Baby, Stethoscope, ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ivrScheduleService, 
  IVR_TIME_SLOTS, 
  MAX_PATIENTS_PER_BATCH 
} from '@/services/ivrScheduleService';
import { vapiIntegrationService } from '@/services/vapiIntegrationService';
import { roadmapService, MESES_DEL_ANIO } from '@/services/roadmapService';
import ResolutionAnnualMatrix from '@/components/ResolutionAnnualMatrix';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function IvrSchedulePage() {
  const { toast } = useToast();
  const today = new Date();

  // Pestaña principal: 'roadmap' | 'tandas' | 'casos_humanos' | 'config'
  const [activeTab, setActiveTab] = useState('roadmap');

  // Sub-sección del Roadmap: 'resolucion' | 'campanas' | 'individual'
  const [roadmapSection, setRoadmapSection] = useState('resolucion');
  const [roadmapDisplayMode, setRoadmapDisplayMode] = useState('visual'); // 'visual' | 'tabla'
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  // Estados de datos del Roadmap
  const [resolutionRoadmap, setResolutionRoadmap] = useState([]);
  const [campaignsRoadmap, setCampaignsRoadmap] = useState([]);
  const [individualRoadmap, setIndividualRoadmap] = useState([]);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [filterCursoVida, setFilterCursoVida] = useState('todos');
  const [roadmapSearch, setRoadmapSearch] = useState('');

  // Estados de tandas diarias
  const [scheduleData, setScheduleData] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState('t1');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [isSimulating, setIsSimulating] = useState(false);
  const [config, setConfig] = useState(ivrScheduleService.getConfig());

  // Modal para registro de gestión humana
  const [selectedHumanCase, setSelectedHumanCase] = useState(null);
  const [humanNotes, setHumanNotes] = useState('');
  const [humanOutcome, setHumanOutcome] = useState('contactado_exitoso');

  // Modal de Transcripción de llamada
  const [selectedTranscriptItem, setSelectedTranscriptItem] = useState(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  const [callingId, setCallingId] = useState(null);

  useEffect(() => {
    loadRoadmapData(selectedYear, selectedMonth);
    loadDailySchedule();
  }, []);

  const loadRoadmapData = async (year = selectedYear, month = selectedMonth) => {
    setLoadingRoadmap(true);
    try {
      const [resData, campData, indivData] = await Promise.all([
        roadmapService.getResolutionRoadmap(null, year, month),
        roadmapService.getCampaignsRoadmap(null, year, month),
        roadmapService.getIndividualCallsRoadmap(null, year, month)
      ]);
      setResolutionRoadmap(resData);
      setCampaignsRoadmap(campData);
      setIndividualRoadmap(indivData);
    } catch (e) {
      console.error('Error cargando roadmap:', e);
      toast({
        title: "Error cargando roadmap",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setLoadingRoadmap(false);
    }
  };

  const loadDailySchedule = async (force = false) => {
    setLoadingDaily(true);
    try {
      // Si en caché local había quedado el lote completo de 56 pacientes, forzamos recálculo según la distribución real 3280
      const cached = localStorage.getItem('sadi_ivr_daily_schedule');
      const shouldForce = force || (cached && JSON.parse(cached)?.totalPacientes > 32);
      const data = await ivrScheduleService.getDailySchedule(null, shouldForce);
      setScheduleData(data);
    } catch (e) {
      console.error('Error cargando cronograma diario:', e);
    } finally {
      setLoadingDaily(false);
    }
  };

  const handleYearMonthChange = (newYear, newMonth) => {
    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    loadRoadmapData(newYear, newMonth);
  };

  const handleDownloadExcel = () => {
    try {
      const fileName = roadmapService.exportRoadmapToExcel(
        resolutionRoadmap,
        campaignsRoadmap,
        individualRoadmap,
        selectedYear,
        selectedMonth
      );
      toast({
        title: "📥 Descarga Completa",
        description: `Se ha descargado el archivo Excel "${fileName}" con 3 hojas dedicadas.`
      });
    } catch (e) {
      console.error('Error al exportar:', e);
      toast({
        title: "Error al exportar Excel",
        description: e.message,
        variant: "destructive"
      });
    }
  };

  const handleMakeLiveCall = async (item) => {
    setCallingId(item.id);
    toast({
      title: "📞 Iniciando llamada en vivo...",
      description: `Marcando a ${item.nombre} (${item.telefono}) a través de Puerto 22...`
    });

    try {
      const res = await vapiIntegrationService.triggerLiveCall(item.telefono, {
        nombre: item.nombre,
        cedula: item.documento,
        programa3280: item.programa3280 || item.programaPrincipal,
        hitoClinico: item.accion3280,
        cursoVida: item.cursoVida,
        direccion: item.direccion || 'Caldas'
      });
      if (res.ok) {
        toast({
          title: "🟢 Llamada Conectada con Éxito",
          description: `La llamada a ${item.nombre} fue enviada al Gateway GSM (Puerto 22). ID: ${res.data?.id?.slice(0, 8)}...`
        });
      } else {
        toast({
          title: "Error al emitir llamada",
          description: res.data?.message || JSON.stringify(res.data),
          variant: "destructive"
        });
      }
    } catch (e) {
      toast({
        title: "Error de conexión",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setCallingId(null);
    }
  };

  const handleSimulateBatch = async (slotId) => {
    setIsSimulating(true);
    try {
      const res = await ivrScheduleService.simulateBatchExecution(slotId);
      setScheduleData(res.schedule);
      const slot = IVR_TIME_SLOTS.find(s => s.id === slotId);

      toast({
        title: `⚡ Tanda ${slot?.hora} ejecutada`,
        description: `Procesados: ${res.stats.processed} | Reasignados a tanda siguiente: ${res.stats.reassigned} | Derivados a gestión humana: ${res.stats.sentToHuman}`
      });
    } catch (e) {
      toast({
        title: "Error en simulación",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSaveHumanIntervention = async (e) => {
    e.preventDefault();
    if (!selectedHumanCase) return;

    try {
      const updated = await ivrScheduleService.recordHumanIntervention(selectedHumanCase.id, {
        responsable: 'Enfermería Hospital SADI',
        notas: humanNotes,
        resultado: humanOutcome
      });
      setScheduleData(updated);
      setSelectedHumanCase(null);
      setHumanNotes('');
      toast({
        title: "✅ Gestión Humana Registrada",
        description: `El caso de ${selectedHumanCase.nombre} ha sido gestionado y archivado.`
      });
    } catch (e) {
      toast({
        title: "Error al registrar",
        description: e.message,
        variant: "destructive"
      });
    }
  };

  const handleReset = async () => {
    if (window.confirm('¿Desea reiniciar el cronograma y devolver todos los pacientes al estado inicial?')) {
      const fresh = await ivrScheduleService.resetSchedule();
      setScheduleData(fresh);
      toast({
        title: "Cronograma reiniciado",
        description: "Se han recalculado las tandas de 32 pacientes para el día de hoy."
      });
    }
  };

  const handleToggleEngine = () => {
    const updated = { ...config, isLiveEnabled: !config.isLiveEnabled };
    ivrScheduleService.saveConfig(updated);
    setConfig(updated);
    toast({
      title: updated.isLiveEnabled ? "🟢 Motor IVR EN VIVO Activado" : "🟡 Motor IVR en Modo Standby Seguro",
      description: updated.isLiveEnabled 
        ? "El sistema comenzará a lanzar llamadas por tandas a la hora programada."
        : "El sistema no realizará llamadas reales salientes hasta que se reactive."
    });
  };

  // Filtrado de pacientes de la sección Resolución del Roadmap
  const filteredResolutionItems = resolutionRoadmap.filter(item => {
    const matchesCourse = filterCursoVida === 'todos' || item.cursoVida === filterCursoVida;
    const matchesSearch = roadmapSearch === '' ||
      item.nombre.toLowerCase().includes(roadmapSearch.toLowerCase()) ||
      item.documento.includes(roadmapSearch) ||
      item.telefono.includes(roadmapSearch) ||
      item.programaPrincipal.toLowerCase().includes(roadmapSearch.toLowerCase());
    return matchesCourse && matchesSearch;
  });

  // Métricas calculadas para Tandas Diarias
  const items = scheduleData?.items || [];
  const totalPacientes = items.length;
  const confirmados = items.filter(i => i.estado === 'confirmada').length;
  const reagendados = items.filter(i => i.estado === 'reagendada').length;
  const enReintento = items.filter(i => i.estado === 'en_reintento').length;
  const casosHumanos = items.filter(i => i.estado === 'caso_aislado_humano' || i.gestionHumana?.requerida).length;
  const programados = items.filter(i => i.estado === 'programada').length;

  const currentSlotPatients = items.filter(i => {
    if (activeTab === 'casos_humanos') {
      return i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano';
    }
    const matchSlot = i.slotId === selectedSlotId;
    const matchSearch = searchTerm === '' || 
      i.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.documento.includes(searchTerm) ||
      i.telefono.includes(searchTerm);
    const matchStatus = filterStatus === 'todos' || i.estado === filterStatus;

    return matchSlot && matchSearch && matchStatus;
  });

  const selectedSlot = IVR_TIME_SLOTS.find(s => s.id === selectedSlotId) || IVR_TIME_SLOTS[0];
  const nombreMesSeleccionado = MESES_DEL_ANIO.find(m => m.id === Number(selectedMonth))?.nombre || `Mes ${selectedMonth}`;

  return (
    <Layout>
      <Helmet>
        <title>Cronograma y Roadmap 3280 • SADI</title>
      </Helmet>

      <div className="w-full min-w-0 space-y-6">

        {/* ========================================================================= */}
        {/* ENCABEZADO PRINCIPAL */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-cyan-900 text-white p-6 rounded-3xl shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-blue-500/20 rounded-2xl backdrop-blur-md border border-blue-400/30">
                <Calendar className="w-7 h-7 text-cyan-300" />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Cronograma & Roadmap Mensual SADI</h1>
                <p className="text-xs text-cyan-200 mt-0.5">
                  Planificación inamovible de llamadas Res. 3280, Campañas y Trazabilidad de Atenciones Particulares
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleDownloadExcel}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-lg gap-2 py-2.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Descargar Excel (3 Hojas)
            </Button>

            <div className="text-right hidden sm:block">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                config.isLiveEnabled 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                <span className={`w-2 h-2 rounded-full ${config.isLiveEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {config.isLiveEnabled ? 'EN VIVO AUTOMÁTICO' : 'MODO STANDBY SEGURO'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NAVEGACIÓN PRINCIPAL: ROADMAP VS TANDAS DIARIAS VS CASOS AISLADOS */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
              activeTab === 'roadmap'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Cronograma Anual Res. 3280
          </button>

          <button
            onClick={() => setActiveTab('tandas')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
              activeTab === 'tandas'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Monitor de Tandas Diarias (30 min)
          </button>

          <button
            onClick={() => setActiveTab('casos_humanos')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
              activeTab === 'casos_humanos'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Casos Aislados No Contactados
            {casosHumanos > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-700 rounded-full font-black">
                {casosHumanos}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
              activeTab === 'config'
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            Parámetros de Automatización
          </button>
        </div>

        {/* ========================================================================= */}
        {/* PESTAÑA 1: CRONOGRAMA ANUAL RESOLUCIÓN 3280 (MATRIZ COMPLETA)            */}
        {/* ========================================================================= */}
        {activeTab === 'roadmap' && (
          <div className="w-full">
            <ResolutionAnnualMatrix
              selectedYear={selectedYear}
              onYearChange={(y) => {
                setSelectedYear(y);
                loadRoadmapData(y, selectedMonth);
              }}
              onDownloadExcel={handleDownloadExcel}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: MONITOR DE TANDAS DIARIAS (10:00 AM - 06:00 PM) */}
        {/* ========================================================================= */}
        {activeTab === 'tandas' && (
          <div className="space-y-6">
            {/* CARDS DE MÉTRICAS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                  <span>Programados Hoy</span>
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-black text-gray-900 mt-2">{totalPacientes}</p>
                <span className="text-[11px] text-gray-500">{programados} en cola inicial</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm bg-emerald-50/20">
                <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
                  <span>Confirmados (Tecla 1)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-700 mt-2">{confirmados}</p>
                <span className="text-[11px] text-emerald-600">Asistencia garantizada</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm bg-blue-50/20">
                <div className="flex items-center justify-between text-blue-700 text-xs font-medium">
                  <span>Reagendados (Tecla 2)</span>
                  <PhoneCall className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-black text-blue-700 mt-2">{reagendados}</p>
                <span className="text-[11px] text-blue-600">Piden nueva fecha</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm bg-amber-50/20">
                <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
                  <span>En Reintento (Tanda Sig.)</span>
                  <RotateCw className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-black text-amber-700 mt-2">{enReintento}</p>
                <span className="text-[11px] text-amber-600">Pasan a próx. intervalo</span>
              </div>

              <div 
                onClick={() => setActiveTab('casos_humanos')}
                className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm bg-red-50/30 cursor-pointer hover:border-red-300 transition-colors"
              >
                <div className="flex items-center justify-between text-red-700 text-xs font-medium">
                  <span>Casos Aislados (Humano)</span>
                  <UserX className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-2xl font-black text-red-700 mt-2">{casosHumanos}</p>
                <span className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                  Requieren llamada manual <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* CARRUSEL DE HORARIOS DE TANDAS */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-700">Seleccionar Tanda Operativa (17 Intervalos de 30 min):</span>
                <span className="text-[11px] text-blue-600 font-semibold">Tanda seleccionada: {selectedSlot.hora}</span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {IVR_TIME_SLOTS.map((slot) => {
                  const slotItems = items.filter(i => i.slotId === slot.id);
                  const isSelected = selectedSlotId === slot.id;

                  return (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-left border transition-all ${
                        isSelected
                          ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                          {slot.hora}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                          slotItems.length >= MAX_PATIENTS_PER_BATCH 
                            ? 'bg-purple-100 text-purple-700' 
                            : slotItems.length > 0 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {slotItems.length}/{MAX_PATIENTS_PER_BATCH}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 block mt-1">
                        {slot.label.split(' ')[0]} {slot.label.split(' ')[1]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TABLA DE PACIENTES DE LA TANDA */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Pacientes Asignados a la Tanda de las {selectedSlot.hora}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {currentSlotPatients.length} paciente(s) en esta franja
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSimulateBatch(selectedSlot.id)}
                    disabled={isSimulating || currentSlotPatients.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isSimulating ? 'Lanzando Tanda...' : `Lanzar Tanda (${selectedSlot.hora})`}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
                    <tr>
                      <th className="p-3">Paciente / Cédula</th>
                      <th className="p-3">Teléfono</th>
                      <th className="p-3">Curso de Vida & Ruta 3280</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Intentos</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentSlotPatients.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-gray-400">
                          No hay pacientes programados en la tanda de las {selectedSlot.hora}.
                        </td>
                      </tr>
                    ) : (
                      currentSlotPatients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50/60">
                          <td className="p-3">
                            <div className="font-bold text-gray-900">{patient.nombre}</div>
                            <div className="text-[11px] text-gray-500">{patient.documento}</div>
                          </td>
                          <td className="p-3 font-mono text-gray-700">{patient.telefono}</td>
                          <td className="p-3">
                            <div className="font-semibold text-gray-900">{patient.programa3280 || patient.programa}</div>
                            <div className="text-[10px] text-blue-700 font-bold mt-0.5">{patient.accion3280 || patient.cursoVida}</div>
                            {patient.script && (
                              <div className="text-[10px] text-gray-600 mt-1 italic bg-blue-50/70 p-1.5 rounded-lg border border-blue-100 max-w-md">
                                <span className="font-bold text-blue-900 block not-italic">Motivo: {patient.script.motivo}</span>
                                "{patient.script.mensaje}"
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              {patient.estado}
                            </span>
                          </td>
                          <td className="p-3 text-gray-700 font-semibold">{patient.intentos || 0}</td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMakeLiveCall(patient)}
                              disabled={callingId === patient.id}
                              className="text-xs font-bold rounded-xl text-blue-700 hover:bg-blue-50"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              Llamar
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 3: BANDEJA CASOS AISLADOS (GESTIÓN HUMANA) */}
        {/* ========================================================================= */}
        {activeTab === 'casos_humanos' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  Bandeja de Casos Aislados para Gestión Humana
                </h3>
                <p className="text-xs text-gray-500">
                  Pacientes que no contestaron en ninguna de las tandas del día. Requieren contacto telefónico o domiciliario directo por el personal de enfermería.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="p-3">Paciente</th>
                    <th className="p-3">Documento</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3">Programa Res. 3280</th>
                    <th className="p-3">Intentos del Agente</th>
                    <th className="p-3 text-right">Gestión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.filter(i => i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-gray-400">
                        No hay casos aislados pendientes. Todos los pacientes del día fueron contactados o están en reintento programado.
                      </td>
                    </tr>
                  ) : (
                    items.filter(i => i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano').map((c) => (
                      <tr key={c.id} className="hover:bg-red-50/20">
                        <td className="p-3 font-bold text-gray-900">{c.nombre}</td>
                        <td className="p-3 text-gray-600">{c.documento}</td>
                        <td className="p-3 font-mono text-gray-700">{c.telefono}</td>
                        <td className="p-3 text-gray-700">{c.programa}</td>
                        <td className="p-3 text-red-600 font-bold">{c.intentos} intentos fallidos</td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            onClick={() => setSelectedHumanCase(c)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl"
                          >
                            Registrar Gestión
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 4: CONFIGURACIÓN */}
        {/* ========================================================================= */}
        {activeTab === 'config' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-black text-gray-900">Configuración del Motor de Automatización IVR</h3>
            <p className="text-xs text-gray-500">
              Ajustes de intervalos de tandas (10:00 AM a 06:00 PM), límite de 32 llamadas por franja y reintentos automáticos.
            </p>
            <div className="grid grid-cols-2 gap-4 text-xs pt-2">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <span className="font-bold text-gray-900 block mb-1">Capacidad Máxima por Tanda:</span>
                <span className="text-gray-600">32 pacientes cada 30 minutos (17 tandas diarias = 544 llamadas/día).</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <span className="font-bold text-gray-900 block mb-1">Gateway de Salida:</span>
                <span className="text-gray-600">Troncal GSM Puerto 22 conectada vía Vapi/Twilio.</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL DE TRANSCRIPCIÓN COMPLETA */}
      <Dialog open={showTranscriptModal} onOpenChange={setShowTranscriptModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Transcripción y Registro de Llamada Particular
            </DialogTitle>
            <DialogDescription>
              {selectedTranscriptItem?.pacienteNombre} • {selectedTranscriptItem?.telefono} • {selectedTranscriptItem?.fechaHora}
            </DialogDescription>
          </DialogHeader>

          {selectedTranscriptItem && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 block">Motivo / Protocolo:</span>
                  <span className="font-bold text-gray-900">{selectedTranscriptItem.motivoContacto}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Resultado:</span>
                  <span className="font-bold text-emerald-700">{selectedTranscriptItem.resultado} ({selectedTranscriptItem.duracionSegundos} seg)</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-700 block mb-1">Resumen Clínico IA:</span>
                <p className="text-xs text-gray-700 bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                  {selectedTranscriptItem.resumenClinico}
                </p>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-700 block mb-2">Diálogo Completo:</span>
                <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs font-sans whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto border border-slate-800">
                  {selectedTranscriptItem.transcripcion}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE GESTIÓN HUMANA */}
      {selectedHumanCase && (
        <Dialog open={!!selectedHumanCase} onOpenChange={() => setSelectedHumanCase(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">
                Registrar Gestión Humana para {selectedHumanCase.nombre}
              </DialogTitle>
              <DialogDescription>
                Paciente no contactado tras agotar las tandas del día.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveHumanIntervention} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Resultado de la Intervención:</label>
                <select
                  value={humanOutcome}
                  onChange={(e) => setHumanOutcome(e.target.value)}
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white"
                >
                  <option value="contactado_exitoso">Contactado y Cita Confirmada</option>
                  <option value="reagendado_manual">Reagendado Manualmente para otra fecha</option>
                  <option value="visita_domiciliaria_requerida">Requiere Visita Domiciliaria</option>
                  <option value="numero_erroneo">Número Erróneo o Inexistente</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Notas de la Auxiliar de Enfermería:</label>
                <textarea
                  rows={3}
                  value={humanNotes}
                  onChange={(e) => setHumanNotes(e.target.value)}
                  placeholder="Detalles del contacto humano con el paciente o familiar..."
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-xl"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-xl">
                Guardar y Cerrar Caso Aislado
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

    </Layout>
  );
}
