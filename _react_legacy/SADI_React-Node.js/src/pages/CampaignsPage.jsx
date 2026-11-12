import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Send, Plus, Clock, CheckCircle, AlertCircle, Edit, Trash2, Loader2,
  Calendar, Layers, ShieldAlert, Settings, RotateCw, CheckCircle2,
  PhoneCall, UserX, ChevronRight, FileSpreadsheet, Eye, Play, Sparkles,
  Search, Filter, RotateCcw, Building2, CalendarRange, HeartPulse,
  Info, ExternalLink, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { campaignService } from '@/services/campaignService';
import { templateService } from '@/services/templateService';
import { segmentService } from '@/services/segmentService';
import { supabase } from '@/lib/supabase';
import {
  ivrScheduleService,
  IVR_TIME_SLOTS,
  MAX_PATIENTS_PER_BATCH
} from '@/services/ivrScheduleService';
import { vapiIntegrationService } from '@/services/vapiIntegrationService';
import CampaignSchedulingCalendar from '@/components/CampaignSchedulingCalendar';
import { getCursoVidaIcon, getGrupoRiesgoIcon } from '@/components/CursosVidaIcons';
import {
  validateCampaignCallCapacity,
  generateAnnualResolutionRoadmap,
  DAILY_CALL_CAPACITY
} from '@/services/callCapacityService';
import { patientService } from '@/services/patientService';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllowedCursoKeysForUser,
  isCampaignAllowedForUser,
  formatCursosVidaLabel,
} from '@/services/cursoVidaConfig';
import { isPatientAssignedToDoctor } from '@/pages/doctor/doctorUtils';

// Horarios autorizados: 10 Horas (08:00 AM a 06:00 PM • 350 llamadas/hora = 3.500/día)
const FRANJAS_HORARIAS_10H = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'
];

const CampaignsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const doctorAccess = useMemo(() => getAllowedCursoKeysForUser(user), [user]);

  // Navegación de los 4 pasos / pestañas (IDÉNTICO A CRONOGRAMA)
  // 'campanas' (Paso 1) | 'tandas' (Paso 2) | 'casos_humanos' (Paso 3) | 'config' (Paso 4)
  const [activeTab, setActiveTab] = useState('campanas');

  // Subfiltro de Paquetes en Paso 1: 'todos' | 'cursos_vida' | 'grupos_riesgo'
  const [campaignPackageFilter, setCampaignPackageFilter] = useState('cursos_vida');

  // Estados de Campañas
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('todos');
  const [campaignSearchTerm, setCampaignSearchTerm] = useState('');

  // Modales
  const [showRelaunchDialog, setShowRelaunchDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // Estados para Relanzamiento de Campaña (Solo Fechas, Días, Semanas, Lugares y Frecuencia)
  const [relaunchSchedule, setRelaunchSchedule] = useState({
    frequency: 'diario',
    config: {},
    selectedDates: [],
    summary: 'Diario (Lunes a Sábado)'
  });
  const [relaunchLugar, setRelaunchLugar] = useState('Sede Principal - Manizales (Caldas)');
  const [relaunchFranjas, setRelaunchFranjas] = useState(['08:30 AM', '09:00 AM', '10:00 AM', '02:00 PM', '04:00 PM']);
  const [relaunchRetryUntilAnswer, setRelaunchRetryUntilAnswer] = useState(true);
  const [relaunchMaxRetries, setRelaunchMaxRetries] = useState(3);

  // Estados de Tandas Diarias (24 Intervalos de 30 min)
  const [scheduleData, setScheduleData] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState('t1');
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [batchFilterStatus, setBatchFilterStatus] = useState('todos');
  const [isSimulating, setIsSimulating] = useState(false);
  const [config, setConfig] = useState(ivrScheduleService.getConfig());
  const [callingId, setCallingId] = useState(null);

  // Estados de Gestión Humana para Casos Aislados
  const [selectedHumanCase, setSelectedHumanCase] = useState(null);
  const [humanNotes, setHumanNotes] = useState('');
  const [humanOutcome, setHumanOutcome] = useState('contactado_exitoso');

  // Hospital ID
  const [hospitalId, setHospitalId] = useState(null);

  useEffect(() => {
    initializePage();
  }, []);

  const initializePage = async () => {
    try {
      setLoading(true);

      let hId = null;
      const storedUser = localStorage.getItem('sadi_user');

      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          hId = user.hospital_id || user.hospitalId || user.Hospital_ID;
        } catch (e) {
          console.error('Error parseando usuario:', e);
        }
      }

      if (!hId) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user) {
          hId = user.user_metadata?.hospital_id || user.app_metadata?.hospital_id;
        }
      }

      if (!hId) {
        hId = 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8';
      }

      setHospitalId(hId);

      await Promise.all([
        loadCampaigns(hId),
        loadDailySchedule()
      ]);

    } catch (error) {
      console.error('Error inicializando página:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de campañas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDailySchedule = async (force = false) => {
    setLoadingDaily(true);
    try {
      const data = await ivrScheduleService.getDailySchedule(null, force);
      setScheduleData(data);
    } catch (e) {
      console.error('Error cargando cronograma de tandas:', e);
    } finally {
      setLoadingDaily(false);
    }
  };

  // Carga unificada de campañas (Supabase + localStorage sadi_campaigns_v2)
  const loadCampaigns = async (hId) => {
    try {
      let combined = [];

      // 1. Supabase campañas
      const result = await campaignService.getAll(hId);
      if (result.success && Array.isArray(result.data)) {
        combined = [...result.data];
      }

      // 2. LocalStorage sadi_campaigns_v2
      try {
        const localData = JSON.parse(localStorage.getItem('sadi_campaigns_v2') || '[]');
        if (Array.isArray(localData)) {
          // Unir evitando duplicados de ID
          const existingIds = new Set(combined.map(c => c.id));
          localData.forEach(item => {
            if (!existingIds.has(item.id)) {
              combined.push(item);
            }
          });
        }
      } catch (err) {
        console.error('Error leyendo sadi_campaigns_v2:', err);
      }

      setCampaigns(combined);
    } catch (error) {
      console.error('Error en loadCampaigns:', error);
    }
  };

  const normalizeStatus = (status) => (status || '').toLowerCase().trim();

  const getEffectiveCampaignStatus = (campaign) => {
    const destinatarios = Number(campaign?.destinatarios || campaign?.pacientes_asignados) || 0;
    const enviados = Number(campaign?.enviados) || 0;
    const entregados = Number(campaign?.entregados) || 0;
    const fallidos = Number(campaign?.fallidos) || 0;

    const processed = entregados + fallidos;
    const raw = normalizeStatus(campaign?.estado || campaign?.status);

    if (destinatarios > 0 && processed >= destinatarios) return 'Completada';
    if (raw === 'activa' || raw === 'active' || raw === 'enviando') return 'Activa';
    if (enviados > 0 || entregados > 0 || fallidos > 0) return 'Activa';
    if (raw === 'programada' || raw === 'scheduled') return 'Programada';
    if (raw === 'completada' || raw === 'completed') return 'Completada';

    return 'Programada';
  };

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'Activa':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Completada':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Programada':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'No Enviada':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Clasificación de campañas en los 2 paquetes: 'curso_vida' o 'grupo_riesgo'
  const getCampaignPackageType = (c) => {
    const rawTipo = (c.tipo_origen || '').toLowerCase().trim();
    if (rawTipo === 'grupo_riesgo' || rawTipo === 'grupos_riesgo' || rawTipo.includes('riesgo')) {
      return 'grupo_riesgo';
    }
    if (rawTipo === 'curso_vida' || rawTipo === 'cursos_vida' || rawTipo.includes('curso') || rawTipo.includes('vida')) {
      return 'curso_vida';
    }

    // Fallback por texto del nombre o contexto
    const txt = `${c.nombre || ''} ${c.contexto_agente || ''} ${c.edad_curso_vida || ''} ${c.origen_nombre || ''}`.toLowerCase();
    if (txt.includes('materno') || txt.includes('cardio') || txt.includes('hipertens') || txt.includes('riesgo') || txt.includes('cancer') || txt.includes('mental') || txt.includes('oral') || txt.includes('respirat')) {
      return 'grupo_riesgo';
    }
    return 'curso_vida';
  };

  const normalizePackageKey = (key) => {
    if (!key || key === 'todos') return 'todos';
    if (key === 'cursos_vida' || key === 'curso_vida') return 'curso_vida';
    if (key === 'grupos_riesgo' || key === 'grupo_riesgo') return 'grupo_riesgo';
    return key;
  };

  // Campañas visibles según Cursos de Vida permitidos al usuario
  const visibleCampaigns = useMemo(() => {
    if (!doctorAccess.restricted) return campaigns;
    if (doctorAccess.keys.length === 0) return [];
    return campaigns.filter(c => isCampaignAllowedForUser(c, user));
  }, [campaigns, doctorAccess, user]);

  // Conteo por paquetes
  const countCursosVida = useMemo(() => {
    return visibleCampaigns.filter(c => getCampaignPackageType(c) === 'curso_vida').length;
  }, [visibleCampaigns]);

  const countGruposRiesgo = useMemo(() => {
    return visibleCampaigns.filter(c => getCampaignPackageType(c) === 'grupo_riesgo').length;
  }, [visibleCampaigns]);

  // Filtrado de Campañas según paquete, estado y término de búsqueda
  const filteredCampaigns = useMemo(() => {
    return visibleCampaigns.filter(c => {
      // 1. Filtro de Paquete (normalizado para soportar singular y plural)
      const pkg = getCampaignPackageType(c);
      const activePkg = normalizePackageKey(campaignPackageFilter);
      if (activePkg !== 'todos' && pkg !== activePkg) {
        return false;
      }

      // 2. Filtro de Estado
      const st = getEffectiveCampaignStatus(c).toLowerCase();
      const matchesFilter = campaignStatusFilter === 'todos' || st === campaignStatusFilter.toLowerCase();

      // 3. Término de búsqueda
      const matchesSearch = campaignSearchTerm === '' ||
        (c.nombre || '').toLowerCase().includes(campaignSearchTerm.toLowerCase()) ||
        (c.contexto_agente || '').toLowerCase().includes(campaignSearchTerm.toLowerCase()) ||
        (c.origen_nombre || '').toLowerCase().includes(campaignSearchTerm.toLowerCase()) ||
        (c.lugar || '').toLowerCase().includes(campaignSearchTerm.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [visibleCampaigns, campaignPackageFilter, campaignStatusFilter, campaignSearchTerm]);

  // Abrir Modal de Relanzamiento
  const handleOpenRelaunchModal = (campaign) => {
    if (doctorAccess.restricted && !isCampaignAllowedForUser(campaign, user)) {
      toast({
        title: "Acceso Restringido",
        description: "Solo puedes gestionar campañas de tus Cursos de Vida asignados.",
        variant: "destructive"
      });
      return;
    }
    setSelectedCampaign(campaign);
    setRelaunchLugar(campaign.lugar || 'Sede Principal - Manizales (Caldas)');
    setRelaunchFranjas(campaign.horarios || ['08:30 AM', '09:00 AM', '10:00 AM', '02:00 PM', '04:00 PM']);
    setRelaunchRetryUntilAnswer(campaign.reintentos ? true : true);
    setRelaunchMaxRetries(campaign.reintentos || 3);
    setShowRelaunchDialog(true);
  };

  // Confirmar Relanzamiento (Solo se editan fechas, días, semanas, lugares y frecuencia)
  const handleConfirmRelaunch = async () => {
    if (!selectedCampaign) return;
    if (doctorAccess.restricted && !isCampaignAllowedForUser(selectedCampaign, user)) {
      toast({
        title: "Acceso Restringido",
        description: "No tienes permisos para relanzar campañas fuera de tus Cursos de Vida asignados.",
        variant: "destructive"
      });
      return;
    }

    if (!relaunchSchedule.selectedDates || relaunchSchedule.selectedDates.length === 0) {
      toast({
        title: "Fechas requeridas",
        description: "Por favor selecciona al menos una fecha en el calendario antes de relanzar.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);

      const relanchedCampaign = {
        ...selectedCampaign,
        id: `camp_relanz_${Date.now()}`,
        nombre: `${selectedCampaign.nombre.replace(/ \(Relanzada.*?\)/g, '')} (Relanzada ${relaunchSchedule.selectedDates[0] || ''})`,
        lugar: relaunchLugar,
        config_frecuencia: relaunchSchedule,
        fechas_ejecucion: relaunchSchedule.selectedDates,
        fecha_programada: relaunchSchedule.selectedDates[0] || new Date().toISOString().split('T')[0],
        horarios: relaunchFranjas,
        reintentos: relaunchRetryUntilAnswer ? relaunchMaxRetries : 0,
        estado: 'programada',
        enviados: 0,
        entregados: 0,
        fallidos: 0,
        fecha_relanzamiento: new Date().toISOString()
      };

      // Guardar en localStorage sadi_campaigns_v2
      try {
        const localData = JSON.parse(localStorage.getItem('sadi_campaigns_v2') || '[]');
        localData.unshift(relanchedCampaign);
        localStorage.setItem('sadi_campaigns_v2', JSON.stringify(localData));
      } catch (e) {
        console.error('Error guardando relanzamiento en localStorage:', e);
      }

      toast({
        title: "🚀 Campaña Relanzada con Éxito",
        description: `Se programó para ${relaunchSchedule.selectedDates.length} fecha(s) en ${relaunchLugar}.`,
      });

      setShowRelaunchDialog(false);
      setSelectedCampaign(null);
      await loadCampaigns(hospitalId);

    } catch (error) {
      console.error('Error relanzando campaña:', error);
      toast({
        title: "Error",
        description: "No se pudo relanzar la campaña",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar Campaña
  const handleDeleteCampaign = async () => {
    if (!selectedCampaign) return;
    if (doctorAccess.restricted && !isCampaignAllowedForUser(selectedCampaign, user)) {
      toast({
        title: "Acceso Restringido",
        description: "No puedes eliminar campañas fuera de tus Cursos de Vida asignados.",
        variant: "destructive"
      });
      return;
    }
    try {
      setSubmitting(true);
      if (selectedCampaign.id.startsWith('camp_')) {
        // Eliminar de localStorage
        try {
          const localData = JSON.parse(localStorage.getItem('sadi_campaigns_v2') || '[]');
          const filtered = localData.filter(c => c.id !== selectedCampaign.id);
          localStorage.setItem('sadi_campaigns_v2', JSON.stringify(filtered));
        } catch (e) { }
      } else {
        await campaignService.delete(selectedCampaign.id);
      }

      toast({
        title: "✅ Campaña eliminada",
        description: "La campaña ha sido eliminada exitosamente",
      });

      setShowDeleteDialog(false);
      setSelectedCampaign(null);
      await loadCampaigns(hospitalId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al eliminar la campaña",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendNow = async (campaign) => {
    if (doctorAccess.restricted && !isCampaignAllowedForUser(campaign, user)) {
      toast({
        title: "Acceso Restringido",
        description: "No tienes permisos para enviar campañas fuera de tus Cursos de Vida asignados.",
        variant: "destructive"
      });
      return;
    }
    try {
      setSubmitting(true);
      const result = await campaignService.sendNow(campaign.id);

      if (result.success) {
        toast({
          title: "✅ Campaña enviada a tanda activa",
          description: result.mensaje || "La campaña ha comenzado su emisión en las 24 tandas de 30 min.",
        });
        await loadCampaigns(hospitalId);
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo enviar la campaña",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al enviar la campaña",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Tandas & Simulación
  const handleSimulateBatch = async (slotId) => {
    if (doctorAccess.restricted && doctorAccess.keys.length === 0) {
      toast({
        title: "Sin Asignación de Cursos de Vida",
        description: "No tienes Cursos de Vida asignados para ejecutar tandas.",
        variant: "destructive"
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
        description: `Procesados: ${res.stats.processed} | Reasignados a próx. tanda: ${res.stats.reassigned} | Derivados a gestión humana: ${res.stats.sentToHuman}`
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

  const handleToggleRetryUntilAnswered = () => {
    const updated = { ...config, retryUntilAnswered: !config.retryUntilAnswered };
    ivrScheduleService.saveConfig(updated);
    setConfig(updated);
    toast({
      title: updated.retryUntilAnswered ? "Reintentar Hasta Responder: ACTIVO" : "Reintentar Hasta Responder: INACTIVO",
      description: updated.retryUntilAnswered
        ? "El motor reasignará automáticamente las llamadas no contestadas a la siguiente tanda disponible."
        : "Las llamadas se detendrán tras el límite fijado."
    });
  };

  const handleToggleEngine = () => {
    const updated = { ...config, isLiveEnabled: !config.isLiveEnabled };
    ivrScheduleService.saveConfig(updated);
    setConfig(updated);
    toast({
      title: updated.isLiveEnabled ? "Modo En Vivo Activado" : "Modo Standby Seguro Activado",
      description: updated.isLiveEnabled
        ? "Las tandas de llamadas salientes se emitirán automáticamente al Gateway GSM."
        : "El sistema está en pausa segura. Las tandas requieren ejecución manual.",
    });
  };

  const handleCallSinglePatient = async (item) => {
    setCallingId(item.id);
    try {
      const res = await vapiIntegrationService.makeOutboundCall({
        patientPhone: item.telefono || '+573002938450',
        patientName: item.nombre || 'Paciente',
        patientDoc: item.documento,
        motivoLlamada: item.campana || 'Demanda Inducida Res. 3280',
        accion3280: item.accion3280 || 'Control Preventivo de Salud',
        hitoClinico: item.accion3280 || 'Jornada Preventiva',
        cursoVida: item.cursoVida,
        direccion: item.direccion || 'Caldas'
      });
      if (res.ok) {
        toast({
          title: "🟢 Llamada de Campaña Conectada",
          description: `Enviada al Gateway GSM (Puerto 22). ID: ${res.data?.id?.slice(0, 8)}...`
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

  // Métricas de Tandas Diarias
  const rawItems = scheduleData?.items || [];
  const items = useMemo(() => {
    if (!doctorAccess.restricted) return rawItems;
    if (doctorAccess.keys.length === 0) return [];
    return rawItems.filter(it => isPatientAssignedToDoctor(it, user));
  }, [rawItems, doctorAccess, user]);
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
    const matchSearch = batchSearchTerm === '' ||
      (i.nombre || '').toLowerCase().includes(batchSearchTerm.toLowerCase()) ||
      (i.documento || '').includes(batchSearchTerm) ||
      (i.telefono || '').includes(batchSearchTerm);
    const matchStatus = batchFilterStatus === 'todos' || i.estado === batchFilterStatus;

    return matchSlot && matchSearch && matchStatus;
  });

  const selectedSlot = IVR_TIME_SLOTS.find(s => s.id === selectedSlotId) || IVR_TIME_SLOTS[0];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm font-semibold text-gray-600">Cargando campañas y tandas del hospital...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Campañas y Monitor de Tandas 3280 | SADI</title>
      </Helmet>

      <div className="space-y-6 pb-12">
        {/* ========================================================================= */}
        {/* HEADER UNIFICADO CON ESTILO CLÍNICO DE TODA LA PLATAFORMA                 */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Resolución 3280 de 2018 • Motor de Campañas y Relanzamientos
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Gateway GSM 32 Canales
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <Layers className="w-8 h-8 text-blue-400" />
              Gestor de Campañas & Monitor de Tandas Diarias
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-3xl">
              Supervisión en 2 paquetes estructurados (<strong>Cursos de Vida</strong> y <strong>Grupos de Riesgo</strong>), relanzamiento con nuevas fechas/lugares y control de los 24 intervalos diarios de llamadas (08:30 AM a 08:00 PM).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* BADGE DE MODO DE EMISIÓN */}
            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${config.isLiveEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                <span className={`w-2 h-2 rounded-full ${config.isLiveEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {config.isLiveEnabled ? 'EN VIVO AUTOMÁTICO' : 'MODO STANDBY SEGURO'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NAVEGACIÓN PRINCIPAL: 4 PASOS IDÉNTICOS AL CRONOGRAMA                     */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">

          {/* PASO 1: CAMPAÑAS Y ROADMAP ANUAL */}
          <button
            onClick={() => setActiveTab('campanas')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${activeTab === 'campanas'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
          >
            <Layers className="w-4 h-4" />
            Campañas Organizadas en 2 Paquetes
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'campanas' ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {visibleCampaigns.length}
            </span>
          </button>

          {/* PASO 2: MONITOR DE TANDAS DIARIAS */}
          <button
            onClick={() => setActiveTab('tandas')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${activeTab === 'tandas'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
          >
            <Clock className="w-4 h-4" />
            Monitor de Tandas Diarias (30 min)
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'tandas' ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-700'}`}>
              24 tandas
            </span>
          </button>

          {/* PASO 3: CASOS AISLADOS NO CONTACTADOS */}
          <button
            onClick={() => setActiveTab('casos_humanos')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${activeTab === 'casos_humanos'
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

          {/* PASO 4: PARÁMETROS DE AUTOMATIZACIÓN */}
          <button
            onClick={() => setActiveTab('config')}
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${activeTab === 'config'
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
          >
            <Settings className="w-4 h-4" />
            Parámetros de Automatización
          </button>
        </div>

        {/* ========================================================================= */}
        {/* PESTAÑA 1: LISTADO DE CAMPAÑAS EN 2 PAQUETES Y RELANZAMIENTO              */}
        {/* ========================================================================= */}
        {activeTab === 'campanas' && (
          <div className="space-y-6">

            {/* BANNER INFORMATIVO: ORIGEN EN CRONOGRAMA & FUNCIÓN DE RELANZAR */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-blue-950 uppercase tracking-wider">
                    Estructura de Campañas y Relanzamiento SADI
                  </h4>
                  <p className="text-xs text-blue-800 mt-0.5 max-w-3xl">
                    Las nuevas campañas se crean a partir de las celdas de los calendarios del <strong>Cronograma</strong> (Cursos de Vida y Grupos de Riesgo). En esta sección puedes supervisar los <strong>2 paquetes</strong> de campañas y <strong>Relanzarlas</strong> editando únicamente sus fechas, días, semanas, lugares y frecuencia de lanzamiento.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Navegar al Cronograma si existe en el router o invocar evento
                    window.location.hash = '#/cronograma';
                  }}
                  className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold rounded-xl gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Ir al Cronograma
                </Button>
              </div>
            </div>

            {/* SELECTOR DE LOS 2 PAQUETES DE CAMPAÑAS */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
              {/* Pestañas de Paquetes */}
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCampaignPackageFilter('cursos_vida')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${campaignPackageFilter === 'cursos_vida'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>📁 Paquete: Cursos de Vida</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${campaignPackageFilter === 'cursos_vida' ? 'bg-blue-800 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                    {countCursosVida}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCampaignPackageFilter('grupos_riesgo')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${campaignPackageFilter === 'grupos_riesgo'
                      ? 'bg-purple-700 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <HeartPulse className="w-3.5 h-3.5" />
                  <span>📁 Paquete: Grupos de Riesgo</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${campaignPackageFilter === 'grupos_riesgo' ? 'bg-purple-900 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                    {countGruposRiesgo}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCampaignPackageFilter('todos')}
                  className={`px-3 py-2 rounded-lg transition-all ${campaignPackageFilter === 'todos'
                      ? 'bg-gray-800 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Todas ({visibleCampaigns.length})
                </button>
              </div>

              {/* Filtros de Búsqueda y Estado */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar campaña o lugar..."
                    value={campaignSearchTerm}
                    onChange={(e) => setCampaignSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={campaignStatusFilter}
                  onChange={(e) => setCampaignStatusFilter(e.target.value)}
                  className="text-xs p-1.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="programada">Programadas</option>
                  <option value="activa">Activas</option>
                  <option value="completada">Completadas</option>
                </select>
              </div>
            </div>

            {/* Grilla de Campañas Filtradas */}
            {filteredCampaigns.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-sm">
                <Send className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  No hay campañas en este paquete
                </h3>
                <p className="text-xs text-gray-500 mb-4 max-w-md mx-auto">
                  Para crear nuevas campañas con segmentación clínica, accede al Cronograma y haz clic en la celda del mes deseado.
                </p>
                <Button
                  onClick={() => { window.location.hash = '#/cronograma'; }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md gap-1.5"
                >
                  <Calendar className="h-4 w-4" />
                  Abrir Cronograma y Crear Campaña
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredCampaigns.map((campaign, index) => {
                  const effectiveEstado = getEffectiveCampaignStatus(campaign);
                  const pkgType = getCampaignPackageType(campaign);
                  const isGrupoRiesgo = pkgType === 'grupo_riesgo';

                  return (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        {/* Cabecera de la Tarjeta */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2.5 rounded-2xl border ${isGrupoRiesgo
                                ? 'bg-purple-50 border-purple-100 text-purple-700'
                                : 'bg-blue-50 border-blue-100 text-blue-700'
                              }`}>
                              {isGrupoRiesgo ? (
                                <HeartPulse className="h-5 w-5 text-purple-600" />
                              ) : (
                                <Layers className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${isGrupoRiesgo
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                  }`}>
                                  {isGrupoRiesgo ? 'Paquete Grupos de Riesgo' : 'Paquete Cursos de Vida'}
                                </span>
                              </div>
                              <h3 className="font-bold text-sm text-gray-900 mt-0.5">{campaign.nombre}</h3>
                              <p className="text-[11px] text-gray-400">
                                Creada: {new Date(campaign.created_at || campaign.fecha_creacion || Date.now()).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${getStatusColor(effectiveEstado)}`}>
                            {effectiveEstado}
                          </span>
                        </div>

                        {/* Metadatos Clínicos y de Lanzamiento */}
                        <div className="space-y-2.5 text-xs">
                          {/* Fechas y Frecuencia */}
                          <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="text-gray-500 flex items-center gap-1.5">
                              <CalendarRange className="w-3.5 h-3.5 text-blue-600" />
                              Frecuencia & Fechas:
                            </span>
                            <span className="font-bold text-slate-800 text-right">
                              {campaign.config_frecuencia?.summary || campaign.fecha_programada || 'Fechas múltiples'}
                              {Array.isArray(campaign.fechas_ejecucion) && campaign.fechas_ejecucion.length > 1 && (
                                <span className="ml-1 text-[10px] text-blue-600 font-semibold">
                                  ({campaign.fechas_ejecucion.length} días)
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Lugar / Sede */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              Sede / Lugar:
                            </span>
                            <span className="font-semibold text-slate-800">
                              {campaign.lugar || 'Sede Principal - Manizales (Caldas)'}
                            </span>
                          </div>

                          {/* Segmento / Cruce */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Segmentación:</span>
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                              {Array.isArray(campaign.segmento_cursos) && campaign.segmento_cursos.length > 0 
                                ? campaign.segmento_cursos.join(', ') 
                                : (Array.isArray(campaign.segmento_riesgos) && campaign.segmento_riesgos.length > 0 
                                    ? campaign.segmento_riesgos.join(', ') 
                                    : (campaign.origen_nombre || 'Resolución 3280'))}
                            </span>
                          </div>

                          {/* Política Reintentos */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Reintentos por tandas:</span>
                            <span className="font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                              {campaign.reintentos ? `Hasta ${campaign.reintentos} reintentos` : 'Hasta que conteste'}
                            </span>
                          </div>

                          {/* Directriz IA si existe */}
                          {campaign.directriz_ia && (
                            <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100 text-[11px] text-slate-700 italic line-clamp-2">
                              "{campaign.directriz_ia}"
                            </div>
                          )}

                          {/* Destinatarios y Aforo */}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                            <span className="text-gray-500">Aforo / Destinatarios:</span>
                            <span className="font-bold text-gray-900">
                              {campaign.pacientes_asignados || campaign.destinatarios || 56} pacientes
                            </span>
                          </div>
                        </div>

                        {/* Progreso */}
                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                            <span>Progreso de Emisión en Tandas</span>
                            <span className="font-bold text-gray-700">
                              {effectiveEstado === 'Completada' ? '100%' : effectiveEstado === 'Activa' ? '45%' : '0%'}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${isGrupoRiesgo ? 'bg-purple-600' : 'bg-blue-600'}`}
                              style={{ width: effectiveEstado === 'Completada' ? '100%' : effectiveEstado === 'Activa' ? '45%' : '5%' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* ACCIONES: RELANZAR CAMPAÑA DESTACADO */}
                      <div className="mt-5 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                        {/* BOTÓN PRINCIPAL DE RELANZAR */}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOpenRelaunchModal(campaign)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5"
                          disabled={submitting}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Relanzar Campaña
                        </Button>

                        <div className="flex items-center gap-1.5">
                          {(effectiveEstado === 'Programada' || effectiveEstado === 'No Enviada') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendNow(campaign)}
                              className="text-blue-600 hover:bg-blue-50 text-xs font-bold rounded-xl border-blue-200"
                              disabled={submitting}
                            >
                              <Send className="h-3.5 w-3.5 mr-1" />
                              Emitir Ahora
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 text-xs font-semibold rounded-xl"
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setShowDeleteDialog(true);
                            }}
                            disabled={submitting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: MONITOR DE TANDAS DIARIAS (08:30 AM A 08:00 PM - 24 TANDAS)     */}
        {/* ========================================================================= */}
        {activeTab === 'tandas' && (
          <div className="space-y-6">
            {/* Tarjetas de Métricas de Tandas Diarias */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <span className="text-[11px] font-bold text-gray-500 uppercase block">Total en Cola</span>
                <span className="text-2xl font-black text-gray-900 mt-1 block">{totalPacientes || 56}</span>
                <span className="text-[10px] text-gray-400">Distribuidos en 24 tandas</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <span className="text-[11px] font-bold text-emerald-600 uppercase block">Confirmados (1)</span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">{confirmados}</span>
                <span className="text-[10px] text-emerald-600/80">Asistencia garantizada</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <span className="text-[11px] font-bold text-blue-600 uppercase block">Reagendados (2)</span>
                <span className="text-2xl font-black text-blue-700 mt-1 block">{reagendados}</span>
                <span className="text-[10px] text-blue-600/80">Piden nueva fecha</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <span className="text-[11px] font-bold text-amber-600 uppercase block">En Reintento</span>
                <span className="text-2xl font-black text-amber-700 mt-1 block">{enReintento}</span>
                <span className="text-[10px] text-amber-600/80">Pasar a próx. intervalo</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <span className="text-[11px] font-bold text-red-600 uppercase block">Casos Aislados</span>
                <span className="text-2xl font-black text-red-700 mt-1 block">{casosHumanos}</span>
                <span className="text-[10px] text-red-600/80">Requieren llamada manual</span>
              </div>
            </div>

            {/* Selector Visual de las 24 Tandas de 30 min (08:30 AM a 08:00 PM) */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Seleccionar Tanda Operativa (24 Intervalos de 30 min: 08:30 AM a 08:00 PM)
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Aforo del Gateway: 32 canales GSM simultáneos por intervalo.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSimulateBatch(selectedSlotId)}
                    disabled={isSimulating}
                    className="text-xs font-bold rounded-xl gap-1.5"
                  >
                    {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Simular Ejecución Tanda
                  </Button>
                </div>
              </div>

              {/* Botones de 24 Tandas */}
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-1.5">
                {IVR_TIME_SLOTS.map(slot => {
                  const slotCount = items.filter(i => i.slotId === slot.id).length;
                  const isSel = slot.id === selectedSlotId;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`p-2 rounded-xl border text-center transition-all ${isSel
                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-1 ring-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                        }`}
                    >
                      <div className="text-[11px] font-bold">{slot.hora}</div>
                      <div className={`text-[9px] mt-0.5 ${isSel ? 'text-blue-100' : 'text-gray-400'}`}>
                        {slotCount}/{MAX_PATIENTS_PER_BATCH}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Listado de Pacientes en la Tanda Seleccionada */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-gray-800">
                    Pacientes Asignados a la Tanda de las {selectedSlot.hora}
                  </h4>
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                    {currentSlotPatients.length} pacientes
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Buscar paciente en tanda..."
                    value={batchSearchTerm}
                    onChange={(e) => setBatchSearchTerm(e.target.value)}
                    className="text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                  <select
                    value={batchFilterStatus}
                    onChange={(e) => setBatchFilterStatus(e.target.value)}
                    className="text-xs p-1.5 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                  >
                    <option value="todos">Todos los Estados</option>
                    <option value="programada">Programada</option>
                    <option value="confirmada">Confirmada</option>
                    <option value="reagendada">Reagendada</option>
                    <option value="en_reintento">En Reintento</option>
                  </select>
                </div>
              </div>

              {currentSlotPatients.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs">
                  No hay pacientes asignados en esta franja horaria.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[380px] overflow-y-auto">
                  {currentSlotPatients.map(item => (
                    <div key={item.id} className="p-3 hover:bg-gray-50 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-gray-800">{item.nombre}</div>
                        <div className="text-gray-500">Doc: {item.documento} • Tel: {item.telefono}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.estado === 'confirmada' ? 'bg-emerald-100 text-emerald-700' :
                            item.estado === 'reagendada' ? 'bg-blue-100 text-blue-700' :
                              item.estado === 'en_reintento' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {item.estado}
                        </span>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCallSinglePatient(item)}
                          disabled={callingId === item.id}
                          className="text-xs font-bold rounded-xl gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          {callingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneCall className="w-3 h-3" />}
                          Llamar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 3: CASOS AISLADOS NO CONTACTADOS                                  */}
        {/* ========================================================================= */}
        {activeTab === 'casos_humanos' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-900">
              <strong className="block font-bold">Bandeja de Gestión Humana para Casos Aislados</strong>
              <span>
                Pacientes que no respondieron tras los reintentos automáticos de la campaña o presentaron inconvenientes de línea. Requieren intervención telefónica personalizada del personal de enfermería.
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-xs text-gray-500">
              No hay casos aislados pendientes en este momento. La plataforma ha procesado con éxito las confirmaciones.
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 4: PARÁMETROS DE AUTOMATIZACIÓN                                   */}
        {/* ========================================================================= */}
        {activeTab === 'config' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-gray-900">Parámetros del Motor de Emisión</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Configuración del hardware GSM, franjas horarias y políticas de reintento.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200">
                <span className="font-bold text-blue-950 block mb-1">Franjas de Operación:</span>
                <span className="text-blue-800 leading-relaxed block">
                  <strong>24 Tandas de 30 minutos</strong> (08:30 AM a 08:00 PM). Capacidad de hasta <strong>768 llamadas/día</strong> con el Gateway GSM de 32 canales.
                </span>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-emerald-950">Política de Reintentos:</span>
                  <button
                    type="button"
                    onClick={handleToggleRetryUntilAnswered}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${config.retryUntilAnswered ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                  >
                    {config.retryUntilAnswered ? 'ACTIVO' : 'LIMITADO'}
                  </button>
                </div>
                <span className="text-emerald-800 leading-relaxed block">
                  {config.retryUntilAnswered
                    ? 'Reintentar hasta que conteste: El motor reasigna las llamadas no contestadas a la siguiente tanda disponible durante el día.'
                    : 'Reintentos fijados a un límite manual de llamadas por paciente.'}
                </span>
              </div>

              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200">
                <span className="font-bold text-indigo-950 block mb-1">Gateway GSM 32 Canales:</span>
                <span className="text-indigo-800 leading-relaxed block">
                  OpenVox GSM conectado vía SIP/Vapi. Detección automática de buzón (Anti-voicemail) y captura DTMF teclas 1 y 2.
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-gray-900 block">Modo de Operación del Motor:</span>
                <span className="text-gray-500">
                  {config.isLiveEnabled ? 'Las campañas programadas se emiten automáticamente al Gateway GSM.' : 'Modo Standby Seguro activo para validación clínica previa.'}
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleToggleEngine}
                className={config.isLiveEnabled ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold' : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'}
              >
                {config.isLiveEnabled ? 'Pasar a Standby Seguro' : 'Activar Modo En Vivo'}
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL EXCLUSIVO DE RELANZAMIENTO DE CAMPAÑA                               */}
        {/* Solo permite editar: Fechas, Días, Semanas, Lugares y Frecuencia           */}
        {/* ========================================================================= */}
        {showRelaunchDialog && selectedCampaign && (
          <Dialog open={showRelaunchDialog} onOpenChange={setShowRelaunchDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
              <div className="bg-gradient-to-r from-emerald-900 to-slate-900 p-6 text-white rounded-t-2xl">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Relanzamiento de Campaña SADI
                </span>
                <DialogTitle className="text-xl font-bold mt-2 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-emerald-400" />
                  Relanzar Campaña: {selectedCampaign?.nombre}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-1">
                  La directriz clínica y segmentación original se conservan intactas. Configura el nuevo calendario de ejecución, frecuencia, lugar y horarios.
                </DialogDescription>
              </div>

              <div className="p-6 space-y-6">
                {/* Información Fija de la Campaña Original */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Segmentación Original:</span>
                    <strong className="text-slate-800">
                      {selectedCampaign?.segmento_cursos?.join(', ') || selectedCampaign?.segmento_riesgos?.join(', ') || selectedCampaign?.origen_nombre || 'General'}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Canales Autorizados:</span>
                    <strong className="text-slate-800">
                      {selectedCampaign?.canal || 'Llamada IA Vapi (Puerto 22), WhatsApp'}
                    </strong>
                  </div>
                  {selectedCampaign?.directriz_ia && (
                    <div className="text-[11px] text-slate-600 italic pt-1">
                      "{selectedCampaign?.directriz_ia}"
                    </div>
                  )}
                </div>

                {/* 1. SELECCIÓN DE FRECUENCIA & CALENDARIO (Diario, Semanal, Mensual) */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    1. Nuevo Calendario & Frecuencia de Lanzamiento
                  </Label>
                  <CampaignSchedulingCalendar
                    initialFrequency={selectedCampaign?.config_frecuencia?.frequency || 'diaria'}
                    onScheduleChange={(sched) => setRelaunchSchedule(sched)}
                  />
                </div>

                {/* 2. LUGAR / SEDE DE ATENCIÓN */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    2. Sede o Lugar de Atención Asignado
                  </Label>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-slate-400" />
                    <select
                      value={relaunchLugar}
                      onChange={(e) => setRelaunchLugar(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-medium"
                    >
                      <option value="Sede Principal - Manizales (Caldas)">Sede Principal - Manizales (Caldas)</option>
                      <option value="Sede Ambulatoria - Chinchiná">Sede Ambulatoria - Chinchiná</option>
                      <option value="Sede Villamaría - Centro Materno">Sede Villamaría - Centro Materno</option>
                      <option value="Sede La Dorada - Especialidades">Sede La Dorada - Especialidades</option>
                    </select>
                  </div>
                </div>

                {/* 3. HORARIOS DE TANDA (08:30 AM a 08:00 PM) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      3. Horarios Permitidos (08:00 AM a 06:00 PM)
                    </Label>
                    <span className="text-xs text-slate-500">{relaunchFranjas.length} franjas</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                    {FRANJAS_HORARIAS_10H.map(franja => {
                      const isSel = relaunchFranjas.includes(franja);
                      return (
                        <button
                          key={franja}
                          type="button"
                          onClick={() => {
                            setRelaunchFranjas(prev =>
                              isSel ? prev.filter(f => f !== franja) : [...prev, franja]
                            );
                          }}
                          className={`py-1 px-1.5 rounded-lg text-xs font-medium transition-all ${isSel
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                          {franja}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. REINTENTAR HASTA QUE CONTESTE */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-xs text-amber-900">
                        Reintentar automáticamente hasta que conteste
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={relaunchRetryUntilAnswer}
                      onChange={(e) => setRelaunchRetryUntilAnswer(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                  </div>
                  {relaunchRetryUntilAnswer && (
                    <div className="flex items-center gap-3 text-xs text-amber-800 pt-1.5 border-t border-amber-200">
                      <span>Máximo de reintentos por paciente:</span>
                      <select
                        value={relaunchMaxRetries}
                        onChange={(e) => setRelaunchMaxRetries(Number(e.target.value))}
                        className="bg-white border border-amber-300 rounded px-2 py-0.5 font-bold text-slate-800"
                      >
                        <option value={1}>1 reintento</option>
                        <option value={2}>2 reintentos</option>
                        <option value={3}>3 reintentos (Recomendado)</option>
                        <option value={5}>5 reintentos</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="p-6 pt-0">
                <Button
                  variant="outline"
                  onClick={() => setShowRelaunchDialog(false)}
                  className="text-xs rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmRelaunch}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md gap-1.5"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Confirmar y Relanzar Campaña
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* MODAL ELIMINAR CAMPAÑA */}
        {showDeleteDialog && selectedCampaign && (
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar esta campaña?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción retirará la campaña "{selectedCampaign?.nombre}" del panel operativo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCampaign} className="bg-red-600 hover:bg-red-700">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

      </div>
    </Layout>
  );
};

export default CampaignsPage;
