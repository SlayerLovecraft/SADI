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

import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllowedCursoKeysForUser,
  isCampaignAllowedForUser,
  canonicalizeCursoKey,
  formatCursosVidaLabel,
} from '@/services/cursoVidaConfig';
import { isPatientAssignedToDoctor } from '@/pages/doctor/doctorUtils';
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
import NoShowFollowupPanel from '@/components/NoShowFollowupPanel';
import { CursoVidaBadge, GruposRiesgoBadges } from '@/components/PatientClinicalBadges';
import { DAILY_CALL_CAPACITY } from '@/services/callCapacityService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function IvrSchedulePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const today = new Date();
  const doctorAccess = useMemo(() => getAllowedCursoKeysForUser(user), [user]);

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

    // Sincronización en tiempo real: si vapi-webhook registra corte anti-buzón, reencola la tanda en vivo
    const channel = supabase
      .channel('sadi-vapi-cuts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vapi_agent_sessions' },
        async (payload) => {
          const row = payload?.new;
          if (!row) return;
          const isCutoff =
            row.deteccion_buzon === true ||
            row.estado_llamada === 'cancelada_pre_cobro' ||
            row.estado_llamada === 'buzon_cortado';
          if (!isCutoff) return;

          try {
            const res = await ivrScheduleService.applyVoicemailCutoffToSchedule(
              row.patient_id || row.telefono_llamado,
              {
                capaDeteccion: row.capa_deteccion || 'pre_answer_sip_183',
                reason: row.motivo_corte || row.estado_llamada
              }
            );
            if (res?.schedule) {
              setScheduleData(res.schedule);
            }
          } catch {
            // No interrumpir interfaz si no aplica a cohorte actual
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => null);
    };
  }, []);

  const loadRoadmapData = async (year = selectedYear, month = selectedMonth) => {
    setLoadingRoadmap(true);
    try {
      const [campData, indivData] = await Promise.all([
        roadmapService.getCampaignsRoadmap(null, year, month),
        roadmapService.getIndividualCallsRoadmap(null, year, month)
      ]);
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
      // Actualizar caché antigua que no incluía universo completo 100% BD
      const cached = localStorage.getItem('sadi_ivr_daily_schedule');
      let shouldForce = force;
      if (!shouldForce && cached) {
        try {
          const parsed = JSON.parse(cached);
          shouldForce = !parsed?.totalUniversoBD;
        } catch {
          shouldForce = true;
        }
      }
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

  const handleDownloadExcel = async () => {
    try {
      let fullRes = resolutionRoadmap;
      if (!Array.isArray(fullRes) || fullRes.length === 0) {
        toast({
          title: "Preparando Exportación Completa (100% BD)...",
          description: "Descargando todo el universo de pacientes sin tope de 1.000 filas."
        });
        fullRes = await roadmapService.getResolutionRoadmap(null, selectedYear, selectedMonth);
        setResolutionRoadmap(fullRes);
      }
      const resForExport = doctorAccess.restricted
        ? (doctorAccess.keys.length === 0 ? [] : fullRes.filter(item => isPatientAssignedToDoctor(item, user)))
        : fullRes;
      const fileName = roadmapService.exportRoadmapToExcel(
        resForExport,
        visibleCampaignsRoadmap,
        visibleIndividualRoadmap,
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
        patientId: item.patientId,
        hospitalId: item.hospitalId || user?.hospital_id || null,
        doctorId: user?.doctor_id || null,
        slotTanda: item.slotId,
        nombre: item.nombre,
        cedula: item.documento,
        programa3280: item.programa3280 || item.programaPrincipal,
        hitoClinico: item.accion3280,
        cursoVida: item.cursoVida,
        direccion: item.direccion || 'Santiago de Cali'
      }, config);
      if (res.ok) {
        const capaMsg = res.mode === 'asterisk_preanswer_sip_183'
          ? 'Protección Pre-Answer SIP 183 + Vapi AMD activa'
          : `Motor Anti-Buzón Vapi (${config.voicemailProvider || 'vapi'}) activo`;
        toast({
          title: "🟢 Llamada Conectada con Éxito",
          description: `${item.nombre} en curso (${capaMsg}). ID: ${res.data?.id?.slice(0, 8) || 'ARI'}...`
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
    if (doctorAccess.restricted && doctorAccess.keys.length === 0) {
      toast({
        title: 'Sin Asignación de Cursos de Vida',
        description: 'No tienes Cursos de Vida asignados para ejecutar tandas de llamadas.',
        variant: 'destructive'
      });
      return;
    }
    setIsSimulating(true);
    try {
      const predicate = doctorAccess.restricted
        ? (item) => isPatientAssignedToDoctor(item, user)
        : null;
      const res = await ivrScheduleService.simulateBatchExecution(slotId, predicate);
      setScheduleData(res.schedule);
      const slot = IVR_TIME_SLOTS.find(s => s.id === slotId);

      toast({
        title: `⚡ Tanda ${slot?.hora} ejecutada`,
        description: `Procesados: ${res.stats.processed} | Reasignados: ${res.stats.reassigned} | Buzones cortados ($0): ${res.stats.voicemailCuts || 0} | Gestión humana: ${res.stats.sentToHuman}`
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
    const updated = ivrScheduleService.saveConfig(
      { ...config, isLiveEnabled: !config.isLiveEnabled },
      user?.hospital_id || null
    );
    setConfig(updated);
    toast({
      title: updated.isLiveEnabled ? "🟢 Motor IVR EN VIVO Activado" : "🟡 Motor IVR en Modo Standby Seguro",
      description: updated.isLiveEnabled
        ? "El sistema comenzará a lanzar llamadas por tandas a la hora programada."
        : "El sistema no realizará llamadas reales salientes hasta que se reactive."
    });
  };

  const handleToggleRetryUntilAnswered = () => {
    const updated = ivrScheduleService.saveConfig(
      { ...config, retryUntilAnswered: !config.retryUntilAnswered },
      user?.hospital_id || null
    );
    setConfig(updated);
    toast({
      title: updated.retryUntilAnswered ? "🔄 Reintentar hasta que conteste: ACTIVADO" : "⏸️ Reintento limitado",
      description: updated.retryUntilAnswered
        ? "Las llamadas no contestadas pasarán automáticamente a la tanda siguiente a lo largo de las 24 tandas del día (08:30 AM a 08:00 PM)."
        : "Los reintentos se detendrán según el límite configurado."
    });
  };

  const handleUpdateAntiVoicemail = (patch, titleMsg) => {
    const updated = ivrScheduleService.saveConfig(
      { ...config, ...patch },
      user?.hospital_id || null
    );
    setConfig(updated);
    if (titleMsg) {
      toast({
        title: titleMsg,
        description: 'Configuración anti-buzón y pre-cobro carrier actualizada para las tandas y llamadas en vivo.'
      });
    }
  };

  // Vistas del Roadmap filtradas por Cursos de Vida asignados al doctor
  const visibleResolutionRoadmap = useMemo(() => {
    if (!doctorAccess.restricted) return resolutionRoadmap;
    if (doctorAccess.keys.length === 0) return [];
    return resolutionRoadmap.filter(item => isPatientAssignedToDoctor(item, user));
  }, [resolutionRoadmap, doctorAccess, user]);

  const visibleCampaignsRoadmap = useMemo(() => {
    if (!doctorAccess.restricted) return campaignsRoadmap;
    if (doctorAccess.keys.length === 0) return [];
    return campaignsRoadmap.filter(c => isCampaignAllowedForUser(c, user));
  }, [campaignsRoadmap, doctorAccess, user]);

  const rawItems = scheduleData?.items || [];
  const items = useMemo(() => {
    if (!doctorAccess.restricted) return rawItems;
    if (doctorAccess.keys.length === 0) return [];
    return rawItems.filter(it => isPatientAssignedToDoctor(it, user));
  }, [rawItems, doctorAccess, user]);

  const visibleIndividualRoadmap = useMemo(() => {
    if (!doctorAccess.restricted) return individualRoadmap;
    if (doctorAccess.keys.length === 0) return [];
    const allowedIds = new Set();
    const allowedDocs = new Set();
    visibleResolutionRoadmap.forEach(r => {
      if (r.pacienteId) allowedIds.add(String(r.pacienteId));
      if (r.documento) allowedDocs.add(String(r.documento).trim());
    });
    items.forEach(it => {
      if (it.patientId) allowedIds.add(String(it.patientId));
      if (it.documento) allowedDocs.add(String(it.documento).trim());
    });
    return individualRoadmap.filter(log => {
      const cKey = canonicalizeCursoKey(log.curso_vida);
      if (cKey && doctorAccess.keySet.has(cKey)) return true;
      if (log.patient_id && allowedIds.has(String(log.patient_id))) return true;
      if (log.documento && allowedDocs.has(String(log.documento).trim())) return true;
      return false;
    });
  }, [individualRoadmap, doctorAccess, visibleResolutionRoadmap, items]);

  // Filtrado de pacientes de la sección Resolución del Roadmap
  const filteredResolutionItems = visibleResolutionRoadmap.filter(item => {
    const matchesCourse = filterCursoVida === 'todos' || item.cursoVida === filterCursoVida;
    const matchesSearch = roadmapSearch === '' ||
      item.nombre.toLowerCase().includes(roadmapSearch.toLowerCase()) ||
      item.documento.includes(roadmapSearch) ||
      item.telefono.includes(roadmapSearch) ||
      item.programaPrincipal.toLowerCase().includes(roadmapSearch.toLowerCase());
    return matchesCourse && matchesSearch;
  });

  // Métricas calculadas para Tandas Diarias
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
                {doctorAccess.restricted && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 border border-white/25 text-[11px] font-bold text-white">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Cursos de Vida autorizados: {formatCursosVidaLabel(user?.cursos_vida_asignados)}</span>
                  </div>
                )}
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
        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
              activeTab === 'roadmap'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700'
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
                : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700'
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
                : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Casos Aislados No Contactados
            {casosHumanos > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 rounded-full font-black">
                {casosHumanos}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('inasistentes')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
              activeTab === 'inasistentes'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700'
            }`}
          >
            <UserX className="w-4 h-4" />
            Inasistentes (+3d SMS → +2d SMS+Mail)
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
              activeTab === 'config'
                ? 'bg-gray-900 dark:bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700'
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
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-xs font-medium">
                  <span>Programados Hoy</span>
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{totalPacientes.toLocaleString('es-CO')}</p>
                <span className="text-[11px] text-gray-500 dark:text-slate-400">
                  {programados} en cola hoy{scheduleData?.totalUniversoBD ? ` • Universo ${Number(scheduleData.totalUniversoBD).toLocaleString('es-CO')} (100% BD)` : ''}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm bg-emerald-50/20 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                  <span>Confirmados (Tecla 1)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-2">{confirmados}</p>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-300">Asistencia garantizada</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 shadow-sm bg-blue-50/20 dark:bg-blue-950/20">
                <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 text-xs font-medium">
                  <span>Reagendados (Tecla 2)</span>
                  <PhoneCall className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-2">{reagendados}</p>
                <span className="text-[11px] text-blue-600 dark:text-blue-300">Piden nueva fecha</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/50 shadow-sm bg-amber-50/20 dark:bg-amber-950/20">
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-medium">
                  <span>En Reintento (Tanda Sig.)</span>
                  <RotateCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-2">{enReintento}</p>
                <span className="text-[11px] text-amber-600 dark:text-amber-300">Pasan a próx. intervalo</span>
              </div>

              <div
                onClick={() => setActiveTab('casos_humanos')}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-red-200 dark:border-red-800/60 shadow-sm bg-red-50/30 dark:bg-red-950/20 cursor-pointer hover:border-red-300 dark:hover:border-red-700 transition-colors"
              >
                <div className="flex items-center justify-between text-red-700 dark:text-red-400 text-xs font-medium">
                  <span>Casos Aislados (Humano)</span>
                  <UserX className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-2xl font-black text-red-700 dark:text-red-400 mt-2">{casosHumanos}</p>
                <span className="text-[11px] text-red-600 dark:text-red-300 font-bold flex items-center gap-1">
                  Requieren llamada manual <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* CARRUSEL DE HORARIOS DE TANDAS (24 INTERVALOS DE 30 MIN) */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-800 dark:text-slate-100">
                    Seleccionar Tanda Operativa (24 Intervalos de 30 min • 08:30 AM a 08:00 PM):
                  </span>
                  <span className="text-[11px] text-blue-600 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/60">
                    Tanda seleccionada: {selectedSlot.hora}
                  </span>
                </div>

                {/* BOTÓN / SWITCH DE REINTENTAR HASTA QUE CONTESTE */}
                <button
                  type="button"
                  onClick={handleToggleRetryUntilAnswered}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                    config.retryUntilAnswered
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-700'
                  }`}
                  title="Si está activo, las llamadas no contestadas o con buzón se reasignan a la tanda siguiente hasta que el paciente conteste."
                >
                  <RotateCw className={`w-3.5 h-3.5 ${config.retryUntilAnswered ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                  <span>{config.retryUntilAnswered ? '✓ Reintentar hasta que conteste (Por tandas)' : 'Reintento limitado'}</span>
                </button>
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
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 ring-2 ring-blue-500/20'
                          : 'bg-gray-50 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-white'}`}>
                          {slot.hora}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                          slotItems.length >= MAX_PATIENTS_PER_BATCH
                            ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300'
                            : slotItems.length > 0
                            ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300'
                            : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                        }`}>
                          {slotItems.length}/{MAX_PATIENTS_PER_BATCH}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-slate-400 block mt-1">
                        {slot.label.split(' ')[0]} {slot.label.split(' ')[1]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TABLA DE PACIENTES DE LA TANDA */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-900">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Pacientes Asignados a la Tanda de las {selectedSlot.hora}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
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
                  <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 font-semibold border-b border-gray-100 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Paciente / Cédula</th>
                      <th className="p-3">Teléfono</th>
                      <th className="p-3">Curso de Vida &amp; Grupos de Riesgo</th>
                      <th className="p-3">Ruta 3280</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Intentos</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {currentSlotPatients.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-8 text-gray-400 dark:text-slate-500">
                          No hay pacientes programados en la tanda de las {selectedSlot.hora}.
                        </td>
                      </tr>
                    ) : (
                      currentSlotPatients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-gray-900 dark:text-white">{patient.nombre}</div>
                            <div className="text-[11px] text-gray-500 dark:text-slate-400">{patient.documento}</div>
                          </td>
                          <td className="p-3 font-mono text-gray-700 dark:text-slate-300">{patient.telefono}</td>
                          <td className="p-3 max-w-[230px]">
                            <div className="flex flex-col items-start gap-1">
                              <CursoVidaBadge patient={{ curso_vida: patient.cursoVida || patient.curso_vida }} />
                              <GruposRiesgoBadges patient={{ grupo_riesgo: patient.grupoRiesgo || patient.grupo_riesgo, grupos_riesgo: patient.gruposRiesgo || patient.grupos_riesgo }} maxVisible={2} />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-gray-900 dark:text-slate-100">{patient.programa3280 || patient.programa}</div>
                            <div className="text-[10px] text-blue-700 dark:text-blue-400 font-bold mt-0.5">{patient.accion3280 || patient.cursoVida}</div>
                            {patient.script && (
                              <div className="text-[10px] text-gray-600 dark:text-slate-300 mt-1 italic bg-blue-50/70 dark:bg-blue-950/40 p-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50 max-w-md">
                                <span className="font-bold text-blue-900 dark:text-blue-200 block not-italic">Motivo: {patient.script.motivo}</span>
                                "{patient.script.mensaje}"
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              patient.resultadoDTMF === 'buzon'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                                : patient.estado === 'confirmada'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                            }`}>
                              {patient.resultadoDTMF === 'buzon'
                                ? `${patient.estado} · Buzón $0 COP`
                                : patient.estado}
                            </span>
                            {patient.capaDeteccion && patient.resultadoDTMF === 'buzon' && (
                              <span className="block text-[9px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
                                {patient.capaDeteccion === 'pre_answer_sip_183'
                                  ? 'SIP 183 Pre-200 OK'
                                  : patient.capaDeteccion === 'ring_timeout_pre_answer'
                                  ? 'Timeout Pre-Buzón'
                                  : 'Vapi AMD Silencioso'}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-gray-700 dark:text-slate-300 font-semibold">{patient.intentos || 0}</td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMakeLiveCall(patient)}
                              disabled={callingId === patient.id}
                              className="text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700"
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  Bandeja de Casos Aislados para Gestión Humana
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Pacientes que no contestaron en ninguna de las tandas del día. Requieren contacto telefónico o domiciliario directo por el personal de enfermería.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 font-semibold border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Paciente</th>
                    <th className="p-3">Documento</th>
                    <th className="p-3">Curso de Vida &amp; Grupos de Riesgo</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3">Programa Res. 3280</th>
                    <th className="p-3">Intentos del Agente</th>
                    <th className="p-3 text-right">Gestión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {items.filter(i => i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano').length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-gray-400 dark:text-slate-500">
                        No hay casos aislados pendientes. Todos los pacientes del día fueron contactados o están en reintento programado.
                      </td>
                    </tr>
                  ) : (
                    items.filter(i => i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano').map((c) => (
                      <tr key={c.id} className="hover:bg-red-50/20 dark:hover:bg-red-950/20">
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{c.nombre}</td>
                        <td className="p-3 text-gray-600 dark:text-slate-400">{c.documento}</td>
                        <td className="p-3 max-w-[220px]">
                          <div className="flex flex-col items-start gap-1">
                            <CursoVidaBadge patient={{ curso_vida: c.cursoVida || c.curso_vida }} />
                            <GruposRiesgoBadges patient={{ grupo_riesgo: c.grupoRiesgo || c.grupo_riesgo, grupos_riesgo: c.gruposRiesgo || c.grupos_riesgo }} maxVisible={2} />
                          </div>
                        </td>
                        <td className="p-3 font-mono text-gray-700 dark:text-slate-300">{c.telefono}</td>
                        <td className="p-3 text-gray-700 dark:text-slate-300">{c.programa}</td>
                        <td className="p-3 text-red-600 dark:text-red-400 font-bold">{c.intentos} intentos fallidos</td>
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
        {/* PESTAÑA 4: SEGUIMIENTO INASISTENTES (+3d SMS -> +2d SMS + EMAIL)           */}
        {/* ========================================================================= */}
        {activeTab === 'inasistentes' && (
          <NoShowFollowupPanel hospitalId={user?.hospitalId || user?.hospital_id || null} />
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 5: CONFIGURACIÓN & PARÁMETROS */}
        {/* ========================================================================= */}
        {activeTab === 'config' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Configuración del Motor de Automatización IVR & Campañas
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Ajustes de intervalos de tandas (08:00 AM a 06:00 PM), política de reintentos y tope operativo de {DAILY_CALL_CAPACITY} llamadas IA/día.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800/50">
                <span className="font-bold text-blue-950 dark:text-blue-200 block mb-1">Capacidad Instalada Hospitalaria:</span>
                <span className="text-blue-800 dark:text-blue-300 leading-relaxed block">
                  <strong>24 Tandas de 30 minutos</strong> (08:00 AM a 06:00 PM). Tope diario oficial de <strong>{DAILY_CALL_CAPACITY} llamadas IA/día</strong> (50/h) con priorización P1→P5 y desborde a <strong>SMS Respaldo (R1-04)</strong>.
                </span>
              </div>

              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-emerald-950 dark:text-emerald-200">Política de Reintentos:</span>
                  <button
                    type="button"
                    onClick={handleToggleRetryUntilAnswered}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                      config.retryUntilAnswered ? 'bg-emerald-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200'
                    }`}
                  >
                    {config.retryUntilAnswered ? 'ACTIVO' : 'LIMITADO'}
                  </button>
                </div>
                <span className="text-emerald-800 dark:text-emerald-300 leading-relaxed block">
                  {config.retryUntilAnswered
                    ? 'Reintentar hasta que conteste: El motor reasigna las llamadas no contestadas a la siguiente tanda disponible durante el día.'
                    : 'Reintentos fijados a un límite manual de llamadas por paciente.'}
                </span>
              </div>

              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-indigo-950 dark:text-indigo-200">Gateway GSM 32 Canales:</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-600 text-white">
                    {config.earlyMediaPreAnswer ? 'SIP 183 ACTIVO' : 'SOLO VAPI'}
                  </span>
                </div>
                <span className="text-indigo-800 dark:text-indigo-300 leading-relaxed block">
                  OpenVox GSM conectado vía Asterisk PJSIP/ARI + Vapi. Cancela Early Media (<code>SIP 183</code>) antes del <code>200 OK</code> con $0 COP de cobro carrier.
                </span>
              </div>
            </div>

            {/* BLOQUE DUAL ANTI-BUZÓN Y PRE-COBRO CARRIER */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Sistema Dual Anti-Buzón &amp; Cero Cobro Carrier (Pre-Answer SIP 183 + Vapi AMD)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Corta locuciones tempranas de Claro/Movistar/Tigo antes del SIP 200 OK y activa respaldo acústico silencioso en Vapi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateAntiVoicemail(
                    { antiVoicemail: !config.antiVoicemail },
                    !config.antiVoicemail ? '🛡️ Anti-Buzón Dual Activado' : '⚠️ Anti-Buzón Desactivado'
                  )}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    config.antiVoicemail ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200'
                  }`}
                >
                  {config.antiVoicemail ? '✓ Protección Dual ACTIVA' : 'Protección Inactiva'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-100">Capa 1 · SIP 183 Pre-200 OK</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateAntiVoicemail(
                        { earlyMediaPreAnswer: !config.earlyMediaPreAnswer, sipCancelOn183Voicemail: !config.earlyMediaPreAnswer },
                        !config.earlyMediaPreAnswer ? 'SIP 183 Early Media Activado' : 'SIP 183 Early Media Desactivado'
                      )}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        config.earlyMediaPreAnswer ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200'
                      }`}
                    >
                      {config.earlyMediaPreAnswer ? 'ACTIVO' : 'OFF'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Analiza RTP en fase 183 vía Asterisk ARI/OpenVox y envía <code>SIP CANCEL</code> antes de iniciar cobro carrier.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="font-bold text-slate-800 dark:text-slate-100 block">
                    Timeout Pre-Buzón ({config.preAnswerRingTimeoutSec || 19}s)
                  </label>
                  <select
                    value={config.preAnswerRingTimeoutSec || 19}
                    onChange={(e) => handleUpdateAntiVoicemail(
                      { preAnswerRingTimeoutSec: Number(e.target.value) },
                      `Timeout pre-buzón fijado en ${e.target.value}s`
                    )}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value={15}>15 seg (Agresivo anti-desvío)</option>
                    <option value={17}>17 seg (Conservador alto)</option>
                    <option value={19}>19 seg (Óptimo Claro/Movistar/Tigo)</option>
                    <option value={21}>21 seg (Extendido)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Corta el repique antes de que la operadora transfiera al correo de voz (~22–25s).
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="font-bold text-slate-800 dark:text-slate-100 block">
                    Capa 2 · Proveedor AMD Vapi
                  </label>
                  <select
                    value={config.voicemailProvider || 'vapi'}
                    onChange={(e) => handleUpdateAntiVoicemail(
                      { voicemailProvider: e.target.value },
                      `Motor Vapi AMD cambiado a ${e.target.value.toUpperCase()}`
                    )}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value="vapi">Vapi Nativo (Recomendado · Baja latencia)</option>
                    <option value="google">Google Audio Classifier</option>
                    <option value="openai">OpenAI Audio Classifier</option>
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Corte silencioso (<code>beepMaxAwait: 0s</code>) si el carrier abre <code>200 OK</code> directo.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-100">Respaldo SMS OpenVox</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateAntiVoicemail(
                        { autoSmsFallbackOnExhausted: !config.autoSmsFallbackOnExhausted },
                        !config.autoSmsFallbackOnExhausted ? 'Respaldo SMS OpenVox ACTIVADO' : 'Respaldo SMS OpenVox desactivado'
                      )}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        config.autoSmsFallbackOnExhausted ? 'bg-emerald-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200'
                      }`}
                    >
                      {config.autoSmsFallbackOnExhausted ? 'ACTIVO' : 'OFF'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Reasigna a la siguiente tanda a $0 COP; al agotar jornada dispara SMS directo por SIM Cards OpenVox (failover puerto X→Y→Z con purga automática de cola).
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-gray-900 dark:text-white block">Modo de Operación del Motor:</span>
                <span className="text-gray-500 dark:text-slate-400">
                  {config.isLiveEnabled ? 'Las tandas programadas se emiten automáticamente al Gateway GSM.' : 'Modo Standby Seguro activo para validación clínica previa.'}
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleToggleEngine}
                className={config.isLiveEnabled ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
              >
                {config.isLiveEnabled ? 'Pasar a Standby Seguro' : 'Activar Modo En Vivo'}
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* MODAL DE TRANSCRIPCIÓN COMPLETA */}
      <Dialog open={showTranscriptModal} onOpenChange={setShowTranscriptModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Transcripción y Registro de Llamada Particular
            </DialogTitle>
            <DialogDescription>
              {selectedTranscriptItem?.pacienteNombre} • {selectedTranscriptItem?.telefono} • {selectedTranscriptItem?.fechaHora}
            </DialogDescription>
          </DialogHeader>

          {selectedTranscriptItem && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-slate-800/70 p-3 rounded-2xl border border-gray-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-slate-400 block">Motivo / Protocolo:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedTranscriptItem.motivoContacto}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-slate-400 block">Resultado:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{selectedTranscriptItem.resultado} ({selectedTranscriptItem.duracionSegundos} seg)</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">Resumen Clínico IA:</span>
                <p className="text-xs text-gray-700 dark:text-slate-200 bg-blue-50/70 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-100 dark:border-blue-800/60">
                  {selectedTranscriptItem.resumenClinico}
                </p>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-2">Diálogo Completo:</span>
                <div className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-2xl text-xs font-sans whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto border border-slate-800">
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
              <DialogTitle className="text-base font-bold text-gray-900 dark:text-white">
                Registrar Gestión Humana para {selectedHumanCase.nombre}
              </DialogTitle>
              <DialogDescription>
                Paciente no contactado tras agotar las tandas del día.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveHumanIntervention} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">Resultado de la Intervención:</label>
                <select
                  value={humanOutcome}
                  onChange={(e) => setHumanOutcome(e.target.value)}
                  className="w-full text-xs p-2.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                >
                  <option value="contactado_exitoso">Contactado y Cita Confirmada</option>
                  <option value="reagendado_manual">Reagendado Manualmente para otra fecha</option>
                  <option value="visita_domiciliaria_requerida">Requiere Visita Domiciliaria</option>
                  <option value="numero_erroneo">Número Erróneo o Inexistente</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">Notas de la Auxiliar de Enfermería:</label>
                <textarea
                  rows={3}
                  value={humanNotes}
                  onChange={(e) => setHumanNotes(e.target.value)}
                  placeholder="Detalles del contacto humano con el paciente o familiar..."
                  className="w-full text-xs p-2.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
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
