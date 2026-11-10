import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Send, Plus, Clock, CheckCircle, AlertCircle, Edit, Trash2, Loader2,
  Calendar, Layers, ShieldAlert, Settings, RotateCw, CheckCircle2,
  PhoneCall, UserX, ChevronRight, FileSpreadsheet, Eye, Play, Sparkles,
  Search, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const CampaignsPage = () => {
  const { toast } = useToast();

  // Navegación de los 4 pasos / pestañas (IDÉNTICO A CRONOGRAMA)
  // 'campanas' (Paso 1) | 'tandas' (Paso 2) | 'casos_humanos' (Paso 3) | 'config' (Paso 4)
  const [activeTab, setActiveTab] = useState('campanas');

  // Estados de Campañas
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('todos');
  const [campaignSearchTerm, setCampaignSearchTerm] = useState('');

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

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [newCampaign, setNewCampaign] = useState({
    nombre: '',
    templateId: '',
    segmentId: '',
    anio: currentYear,
    mes: currentMonth,
    diaInicio: 1,
    horaProgramada: '08:30',
    edadTipo: 'cualquiera', // 'cualquiera' | 'curso_vida' | 'personalizado'
    edadCursoVida: 'primera_infancia',
    edadCustom: {
      anos: '',
      meses: '',
      dias: ''
    },
    modoReintento: 'hasta_responder', // 'hasta_responder' | 'solo_una_vez'
    contextoAgente: 'Le informamos al paciente sobre la jornada de salud obligatoria de la Resolución 3280, verificamos si presenta síntomas y agendamos su cita médica preventiva en su IPS de adscripción.'
  });

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
        loadTemplates(hId),
        loadSegments(hId),
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

  const loadCampaigns = async (hId) => {
    try {
      const result = await campaignService.getAll(hId);
      if (result.success) {
        setCampaigns(result.data || []);
      }
    } catch (error) {
      console.error('Error en loadCampaigns:', error);
    }
  };

  const loadTemplates = async (hId) => {
    try {
      const result = await templateService.getAll(hId);
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('Error en loadTemplates:', error);
    }
  };

  const loadSegments = async (hId) => {
    try {
      const result = await segmentService.getAll(hId);
      if (result.success) {
        setSegments(result.data || []);
      }
    } catch (error) {
      console.error('Error en loadSegments:', error);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!hospitalId) {
      toast({
        title: "Error",
        description: "No se pudo identificar el hospital",
        variant: "destructive"
      });
      return;
    }

    const targetTemplateId = newCampaign.templateId || templates[0]?.id;
    const targetSegmentId = newCampaign.segmentId || segments[0]?.id;

    if (newCampaign.edadTipo === 'personalizado') {
      const { anos, meses, dias } = newCampaign.edadCustom;
      if (!anos && !meses && !dias) {
        toast({
          title: "Rango personalizado incompleto",
          description: "Por favor ingresa al menos un valor en Años, Meses o Días.",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      setSubmitting(true);
      const fechaProg = `${newCampaign.anio}-${String(newCampaign.mes).padStart(2, '0')}-${String(newCampaign.diaInicio).padStart(2, '0')}`;

      const campaignData = {
        nombre: newCampaign.nombre,
        template_id: targetTemplateId,
        segment_id: targetSegmentId,
        fecha_programada: fechaProg,
        hora_programada: newCampaign.horaProgramada,
        dia_inicio: parseInt(newCampaign.diaInicio),
        mes: parseInt(newCampaign.mes),
        anio: parseInt(newCampaign.anio),
        edad_tipo: newCampaign.edadTipo,
        edad_curso_vida: newCampaign.edadTipo === 'curso_vida' ? newCampaign.edadCursoVida : null,
        edad_custom: newCampaign.edadTipo === 'personalizado' ? newCampaign.edadCustom : null,
        modo_reintento: newCampaign.modoReintento,
        contexto_agente: newCampaign.contextoAgente,
        hospital_id: hospitalId,
        tipo: 'automatica_3280',
        estado: 'programada'
      };

      const result = await campaignService.create(campaignData);

      if (result.success) {
        toast({
          title: "✅ Campaña Creada",
          description: `"${newCampaign.nombre}" ha sido programada con éxito en las tandas operativas.`,
        });

        setShowCreateDialog(false);
        setNewCampaign({
          nombre: '',
          templateId: '',
          segmentId: '',
          anio: currentYear,
          mes: currentMonth,
          diaInicio: 1,
          horaProgramada: '08:30',
          edadTipo: 'cualquiera',
          edadCursoVida: 'primera_infancia',
          edadCustom: { anos: '', meses: '', dias: '' },
          modoReintento: 'hasta_responder',
          contextoAgente: 'Le informamos al paciente sobre la jornada de salud obligatoria de la Resolución 3280, verificamos si presenta síntomas y agendamos su cita médica preventiva en su IPS de adscripción.'
        });

        await loadCampaigns(hospitalId);
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo crear la campaña",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error inesperado al crear la campaña",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCampaign = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const campaignData = {
        nombre: selectedCampaign.nombre,
        template_id: selectedCampaign.template_id,
        segment_id: selectedCampaign.segment_id,
        fecha_programada: selectedCampaign.fecha_programada,
        hora_programada: selectedCampaign.hora_programada,
        hospital_id: hospitalId
      };

      const result = await campaignService.update(selectedCampaign.id, campaignData);

      if (result.success) {
        toast({
          title: "✅ Campaña actualizada",
          description: "Los cambios han sido guardados exitosamente",
        });

        setShowEditDialog(false);
        setSelectedCampaign(null);
        await loadCampaigns(hospitalId);
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo actualizar la campaña",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al actualizar la campaña",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCampaign = async () => {
    try {
      setSubmitting(true);
      const result = await campaignService.delete(selectedCampaign.id);

      if (result.success) {
        toast({
          title: "✅ Campaña eliminada",
          description: "La campaña ha sido eliminada exitosamente",
        });

        setShowDeleteDialog(false);
        setSelectedCampaign(null);
        await loadCampaigns(hospitalId);
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar la campaña",
          variant: "destructive"
        });
      }
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
    setIsSimulating(true);
    try {
      const res = await ivrScheduleService.simulateBatchExecution(slotId);
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
      title: updated.retryUntilAnswered ? "🔄 Reintentar hasta que conteste: ACTIVADO" : "⏸️ Reintento limitado",
      description: updated.retryUntilAnswered
        ? "Las llamadas de campañas no contestadas se reasignarán automáticamente a las siguientes tandas del día (24 intervalos de 08:30 AM a 08:00 PM)."
        : "Se detendrán los reintentos automáticos tras el límite fijado."
    });
  };

  const handleToggleEngine = () => {
    const updated = { ...config, isLiveEnabled: !config.isLiveEnabled };
    ivrScheduleService.saveConfig(updated);
    setConfig(updated);
    toast({
      title: updated.isLiveEnabled ? "🟢 Emisión Automática EN VIVO Activada" : "🟡 Modo Standby Seguro Activado",
      description: updated.isLiveEnabled
        ? "Las campañas saldrán automáticamente por el Gateway GSM en sus tandas."
        : "Las llamadas se encuentran en espera para revisión clínica."
    });
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
        title: "✅ Gestión Asistencial Registrada",
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

  const handleMakeLiveCall = async (item) => {
    setCallingId(item.id);
    toast({
      title: "📞 Probando llamada de campaña...",
      description: `Marcando a ${item.nombre} (${item.telefono}) vía Puerto 22...`
    });

    try {
      const res = await vapiIntegrationService.triggerLiveCall(item.telefono, {
        nombre: item.nombre,
        cedula: item.documento,
        programa3280: item.programa3280 || 'Campaña de Salud',
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

  // Filtrado de Campañas
  const filteredCampaigns = campaigns.filter(c => {
    const st = getEffectiveCampaignStatus(c).toLowerCase();
    const matchesFilter = campaignStatusFilter === 'todos' || st === campaignStatusFilter.toLowerCase();
    const matchesSearch = campaignSearchTerm === '' ||
      (c.nombre || '').toLowerCase().includes(campaignSearchTerm.toLowerCase()) ||
      (c.contexto_agente || '').toLowerCase().includes(campaignSearchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Métricas de Tandas Diarias
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
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">Cargando módulo de campañas SADI...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Campañas y Monitor de Tandas • SADI</title>
        <meta name="description" content="Gestión de campañas de salud Res. 3280 y monitor de tandas multicanal" />
      </Helmet>

      <div className="w-full min-w-0 space-y-6">

        {/* ========================================================================= */}
        {/* ENCABEZADO PRINCIPAL DE CAMPAÑAS (HOMOGÉNEO CON CRONOGRAMA)               */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-cyan-900 text-white p-6 rounded-3xl shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-blue-500/20 rounded-2xl backdrop-blur-md border border-blue-400/30 shadow-inner">
                <Send className="w-7 h-7 text-cyan-300" />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Gestión y Automatización de Campañas SADI</h1>
                <p className="text-xs text-cyan-200 mt-0.5">
                  Planificación de Campañas Res. 3280, Monitor de Tandas de 30 min y Trazabilidad Multicanal
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* BOTÓN NUEVA CAMPAÑA */}
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-2xl shadow-lg gap-2 py-2.5"
            >
              <Plus className="w-4 h-4" />
              Nueva Campaña
            </Button>

            {/* BADGE DE MODO DE EMISIÓN */}
            <div className="text-right hidden sm:block">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                config.isLiveEnabled 
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
            className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
              activeTab === 'campanas'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Cronograma & Campañas Anuales 3280
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'campanas' ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {campaigns.length}
            </span>
          </button>

          {/* PASO 2: MONITOR DE TANDAS DIARIAS */}
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
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'tandas' ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-700'}`}>
              24 tandas
            </span>
          </button>

          {/* PASO 3: CASOS AISLADOS NO CONTACTADOS */}
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

          {/* PASO 4: PARÁMETROS DE AUTOMATIZACIÓN */}
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
        {/* PESTAÑA 1: LISTADO DE CAMPAÑAS Y GESTIÓN ANUAL                             */}
        {/* ========================================================================= */}
        {activeTab === 'campanas' && (
          <div className="space-y-6">

            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar campaña por nombre o directriz clínica..."
                  value={campaignSearchTerm}
                  onChange={(e) => setCampaignSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <Filter className="h-4 w-4 text-gray-400 shrink-0" />
                {['todos', 'activa', 'programada', 'completada'].map((statusKey) => (
                  <button
                    key={statusKey}
                    onClick={() => setCampaignStatusFilter(statusKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors whitespace-nowrap ${
                      campaignStatusFilter === statusKey
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {statusKey === 'todos' ? 'Todas' : statusKey}
                  </button>
                ))}
              </div>
            </div>

            {/* Grilla de Campañas */}
            {filteredCampaigns.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-sm">
                <Send className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900 mb-1">No se encontraron campañas</h3>
                <p className="text-xs text-gray-500 mb-4">Crea una nueva campaña de demanda inducida para la cohorte hospitalaria.</p>
                <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Crear Campaña
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredCampaigns.map((campaign, index) => {
                  const effectiveEstado = getEffectiveCampaignStatus(campaign);
                  return (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-blue-50 p-2.5 rounded-2xl border border-blue-100 text-blue-600">
                            <Send className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-gray-900">{campaign.nombre}</h3>
                            <p className="text-[11px] text-gray-400">
                              Creada: {new Date(campaign.created_at || Date.now()).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${getStatusColor(effectiveEstado)}`}>
                          {effectiveEstado}
                        </span>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Programada para:</span>
                          <span className="font-bold text-gray-900">{campaign.fecha_programada || 'Fecha pendiente'} (Día {campaign.dia_inicio || 1})</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Edad / Segmento:</span>
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {campaign.edad_tipo === 'curso_vida' 
                              ? (campaign.edad_curso_vida?.replace('_', ' ') || 'Curso de vida')
                              : campaign.edad_tipo === 'personalizado'
                              ? 'Personalizado (A/M/D)'
                              : 'Cualquiera (Todos)'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Política Reintento:</span>
                          <span className="font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {campaign.modo_reintento === 'solo_una_vez' ? 'Solo 1 vez' : 'Hasta responder (Por tandas)'}
                          </span>
                        </div>
                        {campaign.contexto_agente && (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-700 italic line-clamp-2">
                            "{campaign.contexto_agente}"
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-gray-500">Aforo / Destinatarios:</span>
                          <span className="font-bold text-gray-900">{campaign.destinatarios || totalPacientes || 56} pacientes</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Duración Estimada Agente:</span>
                          <span className="font-medium text-blue-700">
                            {Math.ceil((campaign.destinatarios || totalPacientes || 56) / 32)} tanda(s) de 32 (~{Math.ceil((campaign.destinatarios || totalPacientes || 56) / 32) * 0.5}h en 24 tandas)
                          </span>
                        </div>
                      </div>

                      {/* Progreso */}
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span>Progreso de Emisión</span>
                          <span className="font-bold text-gray-700">
                            {effectiveEstado === 'Completada' ? '100%' : effectiveEstado === 'Activa' ? '45%' : '0%'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: effectiveEstado === 'Completada' ? '100%' : effectiveEstado === 'Activa' ? '45%' : '5%' }}
                          />
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCampaign({ ...campaign });
                            setShowEditDialog(true);
                          }}
                          className="text-xs font-semibold rounded-xl"
                          disabled={submitting}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Button>
                        
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 text-xs font-semibold rounded-xl border-red-200"
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setShowDeleteDialog(true);
                          }}
                          disabled={submitting}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Eliminar
                        </Button>

                        {(effectiveEstado === 'Programada' || effectiveEstado === 'No Enviada') && (
                          <Button 
                            size="sm"
                            onClick={() => handleSendNow(campaign)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs"
                            disabled={submitting}
                          >
                            {submitting ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5 mr-1" />
                            )}
                            Enviar Ahora
                          </Button>
                        )}
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

            {/* CARDS DE MÉTRICAS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                  <span>Programados Hoy</span>
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-black text-gray-900 mt-2">{totalPacientes}</p>
                <span className="text-[11px] text-gray-500">{programados} en cola de emisión</span>
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

            {/* CARRUSEL DE HORARIOS DE TANDAS (24 INTERVALOS DE 30 MIN) */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-800">
                    Seleccionar Tanda Operativa (24 Intervalos de 30 min • 08:30 AM a 08:00 PM):
                  </span>
                  <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
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
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                  }`}
                  title="Si está activo, las llamadas no contestadas pasan a la siguiente tanda disponible del día."
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

            {/* TABLA DE PACIENTES DE LA TANDA SELECCIONADA */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
                <div>
                  <h3 className="text-sm font-black text-gray-900">
                    Pacientes Asignados a la Tanda de las {selectedSlot.hora}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {currentSlotPatients.length} paciente(s) en esta franja horaria • Canal: Gateway GSM OpenVox 32 Canales
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSimulateBatch(selectedSlotId)}
                    disabled={isSimulating}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5"
                  >
                    {isSimulating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Lanzar Tanda ({selectedSlot.hora})</span>
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase">
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
                        <td colSpan={6} className="text-center py-8 text-gray-400">
                          No hay llamadas programadas para la tanda de las {selectedSlot.hora}.
                        </td>
                      </tr>
                    ) : (
                      currentSlotPatients.map((p) => (
                        <tr key={p.id} className="hover:bg-blue-50/30">
                          <td className="p-3">
                            <span className="font-bold text-gray-900 block">{p.nombre}</span>
                            <span className="text-[10px] text-gray-400 font-mono">CC {p.documento}</span>
                          </td>
                          <td className="p-3 font-mono text-gray-700">{p.telefono}</td>
                          <td className="p-3">
                            <span className="font-semibold text-gray-800 block">{p.cursoVida}</span>
                            <span className="text-[10px] text-gray-500">{p.programa3280}</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.estado === 'confirmada' ? 'bg-emerald-100 text-emerald-800' :
                              p.estado === 'reagendada' ? 'bg-blue-100 text-blue-800' :
                              p.estado === 'en_reintento' ? 'bg-amber-100 text-amber-800' :
                              p.estado === 'caso_aislado_humano' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {p.estado}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-gray-700">{p.intentos || 0}</td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMakeLiveCall(p)}
                              disabled={callingId === p.id}
                              className="text-xs font-bold rounded-xl"
                            >
                              {callingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5 mr-1 text-blue-600" />}
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
        {/* PESTAÑA 3: CASOS AISLADOS NO CONTACTADOS (GESTIÓN HUMANA)                  */}
        {/* ========================================================================= */}
        {activeTab === 'casos_humanos' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  Bandeja de Casos Aislados No Contactados
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pacientes de campañas o rutas que agotaron las tandas del día sin responder y requieren gestión asistencial manual.
                </p>
              </div>
              <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-200">
                {items.filter(i => i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano').length} casos pendientes
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase">
                  <tr>
                    <th className="p-3">Paciente</th>
                    <th className="p-3">Cédula</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3">Campaña / Programa</th>
                    <th className="p-3">Intentos Realizados</th>
                    <th className="p-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.filter(i => i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-400">
                        No hay casos aislados pendientes. Todos los pacientes fueron contactados o están en reintento programado.
                      </td>
                    </tr>
                  ) : (
                    items.filter(i => i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano').map((c) => (
                      <tr key={c.id} className="hover:bg-red-50/20">
                        <td className="p-3 font-bold text-gray-900">{c.nombre}</td>
                        <td className="p-3 text-gray-600">{c.documento}</td>
                        <td className="p-3 font-mono text-gray-700">{c.telefono}</td>
                        <td className="p-3 text-gray-700">{c.programa3280 || c.programa}</td>
                        <td className="p-3 text-red-600 font-bold">{c.intentos} intentos fallidos</td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            onClick={() => setSelectedHumanCase(c)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs"
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
        {/* PESTAÑA 4: CONFIGURACIÓN & PARÁMETROS DE AUTOMATIZACIÓN                     */}
        {/* ========================================================================= */}
        {activeTab === 'config' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Configuración del Motor de Automatización de Campañas & IVR
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Ajustes de franjas de tandas (08:30 AM a 08:00 PM), política de reintentos continuos y control de aforo hospitalario.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200">
                <span className="font-bold text-blue-950 block mb-1">Capacidad Instalada Hospitalaria:</span>
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
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                      config.retryUntilAnswered ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
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
        {/* MODAL CREAR NUEVA CAMPAÑA                                                 */}
        {/* ========================================================================= */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent aria-describedby="create-campaign-description" className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600" />
                Crear Nueva Campaña Automatizada SADI
              </DialogTitle>
              <DialogDescription id="create-campaign-description">
                Configura el calendario, los segmentos de edad de la Resolución 3280, el modo de reintento y las instrucciones personalizadas para el Agente IA.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCampaign} className="space-y-4 pt-2">
              <div>
                <Label htmlFor="nombre" className="text-xs font-bold text-gray-700">Nombre de la Campaña</Label>
                <input
                  id="nombre"
                  type="text"
                  placeholder="Ej: Jornada de Salud Infantil y Vacunación Noviembre"
                  value={newCampaign.nombre}
                  onChange={(e) => setNewCampaign({ ...newCampaign, nombre: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Calendario de Lanzamiento */}
              <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200/80 space-y-3">
                <Label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-700" />
                  Programación en el Calendario (Resolución 3280)
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="camp-anio" className="text-[11px] font-semibold text-gray-600">Año</Label>
                    <select
                      id="camp-anio"
                      value={newCampaign.anio}
                      onChange={(e) => setNewCampaign({ ...newCampaign, anio: e.target.value })}
                      className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-xl"
                    >
                      <option value={currentYear}>{currentYear}</option>
                      <option value={currentYear + 1}>{currentYear + 1}</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="camp-mes" className="text-[11px] font-semibold text-gray-600">Mes</Label>
                    <select
                      id="camp-mes"
                      value={newCampaign.mes}
                      onChange={(e) => setNewCampaign({ ...newCampaign, mes: e.target.value })}
                      className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-xl"
                    >
                      {[
                        { id: 1, label: 'Enero' },
                        { id: 2, label: 'Febrero' },
                        { id: 3, label: 'Marzo' },
                        { id: 4, label: 'Abril' },
                        { id: 5, label: 'Mayo' },
                        { id: 6, label: 'Junio' },
                        { id: 7, label: 'Julio' },
                        { id: 8, label: 'Agosto' },
                        { id: 9, label: 'Septiembre' },
                        { id: 10, label: 'Octubre' },
                        { id: 11, label: 'Noviembre' },
                        { id: 12, label: 'Diciembre' }
                      ].map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="camp-dia" className="text-[11px] font-semibold text-gray-600">Día en que Comienza</Label>
                    <select
                      id="camp-dia"
                      value={newCampaign.diaInicio}
                      onChange={(e) => setNewCampaign({ ...newCampaign, diaInicio: e.target.value })}
                      className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-xl"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>Día {d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 italic bg-white p-2 rounded-xl border border-gray-100">
                  ℹ️ <strong>Horario Operativo de Tandas:</strong> El Agente IA procesará tandas de 32 pacientes cada 30 min entre 08:30 AM y 08:00 PM (24 intervalos diarios).
                </p>
              </div>

              {/* Filtro: Edad de los Pacientes */}
              <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80 space-y-3">
                <Label htmlFor="edadTipo" className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>🎯</span> Edad de los Pacientes (Segmento Res. 3280 / Personalizado)
                </Label>
                <select
                  id="edadTipo"
                  value={newCampaign.edadTipo}
                  onChange={(e) => setNewCampaign({ ...newCampaign, edadTipo: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="cualquiera">Cualquiera (Todos los rangos de edad)</option>
                  <option value="curso_vida">Segmento de la Resolución 3280 (Cursos de Vida)</option>
                  <option value="personalizado">Personalizado (Rango exacto en Años, Meses y Días)</option>
                </select>

                {newCampaign.edadTipo === 'curso_vida' && (
                  <div className="pt-2">
                    <Label className="text-[11px] font-semibold text-emerald-900">Curso de Vida de la Resolución 3280:</Label>
                    <select
                      value={newCampaign.edadCursoVida}
                      onChange={(e) => setNewCampaign({ ...newCampaign, edadCursoVida: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-xs bg-white border border-emerald-300 rounded-xl font-medium"
                    >
                      <option value="primera_infancia">Primera Infancia (7 días a 5 años, 11 meses y 29 días)</option>
                      <option value="infancia">Infancia (6 a 11 años)</option>
                      <option value="adolescencia">Adolescencia (12 a 17 años)</option>
                      <option value="juventud">Juventud (18 a 28 años)</option>
                      <option value="adultez">Adultez (29 a 59 años)</option>
                      <option value="vejez">Vejez (60 años o más)</option>
                      <option value="materno_perinatal">Ruta Materno Perinatal (RIAMP)</option>
                    </select>
                  </div>
                )}

                {newCampaign.edadTipo === 'personalizado' && (
                  <div className="pt-2 bg-white p-3 rounded-xl border border-emerald-200">
                    <p className="text-[11px] font-bold text-gray-700 mb-2">
                      Ingrese el rango límite de edad:
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-gray-500">Años</Label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej: 5"
                          value={newCampaign.edadCustom.anos}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setNewCampaign({
                              ...newCampaign,
                              edadCustom: { ...newCampaign.edadCustom, anos: val }
                            });
                          }}
                          className="w-full mt-0.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">Meses</Label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej: 11"
                          value={newCampaign.edadCustom.meses}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setNewCampaign({
                              ...newCampaign,
                              edadCustom: { ...newCampaign.edadCustom, meses: val }
                            });
                          }}
                          className="w-full mt-0.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">Días</Label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej: 29"
                          value={newCampaign.edadCustom.dias}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setNewCampaign({
                              ...newCampaign,
                              edadCustom: { ...newCampaign.edadCustom, dias: val }
                            });
                          }}
                          className="w-full mt-0.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Estrategia de Reintento */}
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 space-y-2">
                <Label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 text-amber-700" />
                  Política de Contacto y Reintentos
                </Label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                    newCampaign.modoReintento === 'hasta_responder'
                      ? 'bg-amber-100/90 border-amber-500 font-bold text-amber-950'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}>
                    <input
                      type="radio"
                      name="modoReintento"
                      value="hasta_responder"
                      checked={newCampaign.modoReintento === 'hasta_responder'}
                      onChange={(e) => setNewCampaign({ ...newCampaign, modoReintento: e.target.value })}
                      className="text-amber-600"
                    />
                    <span>Hasta responder (Por tandas)</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                    newCampaign.modoReintento === 'solo_una_vez'
                      ? 'bg-amber-100/90 border-amber-500 font-bold text-amber-950'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}>
                    <input
                      type="radio"
                      name="modoReintento"
                      value="solo_una_vez"
                      checked={newCampaign.modoReintento === 'solo_una_vez'}
                      onChange={(e) => setNewCampaign({ ...newCampaign, modoReintento: e.target.value })}
                      className="text-amber-600"
                    />
                    <span>Solo 1 vez</span>
                  </label>
                </div>
                {newCampaign.modoReintento === 'hasta_responder' && (
                  <p className="text-[10px] text-amber-800 bg-amber-100/60 p-2 rounded-xl mt-1">
                    ✅ <strong>Reintentar hasta que conteste:</strong> Las llamadas no contestadas se reasignarán automáticamente a las siguientes tandas del día a lo largo de las 24 franjas.
                  </p>
                )}
              </div>

              {/* Contexto y Directrices para el Agente IA */}
              <div>
                <Label htmlFor="contextoAgente" className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>💬 Contexto y Directrices para el Agente IA:</span>
                  <span className="text-[10px] text-gray-400 font-normal">Protocolo clínico y tono</span>
                </Label>
                <textarea
                  id="contextoAgente"
                  rows={3}
                  value={newCampaign.contextoAgente}
                  onChange={(e) => setNewCampaign({ ...newCampaign, contextoAgente: e.target.value })}
                  placeholder="Escribe las directrices clínicas: qué debe preguntar el agente, cómo debe formular las preguntas, tono cordial y protocolo de agendamiento..."
                  className="w-full mt-1 p-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md" 
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Programando Campaña en Supabase...
                  </>
                ) : (
                  '🚀 Guardar y Programar Campaña'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL EDITAR CAMPAÑA                                                      */}
        {/* ========================================================================= */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md" aria-describedby="edit-campaign-description">
            <DialogHeader>
              <DialogTitle>Editar Campaña</DialogTitle>
              <DialogDescription id="edit-campaign-description">
                Actualiza los datos de tu campaña programada
              </DialogDescription>
            </DialogHeader>
            
            {selectedCampaign && (
              <form onSubmit={handleEditCampaign} className="space-y-4">
                <div>
                  <Label htmlFor="edit-nombre">Nombre de la Campaña</Label>
                  <input
                    id="edit-nombre"
                    type="text"
                    value={selectedCampaign.nombre}
                    onChange={(e) =>
                      setSelectedCampaign({ ...selectedCampaign, nombre: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 text-xs border border-gray-300 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="edit-fecha">Fecha Programada</Label>
                  <input
                    id="edit-fecha"
                    type="date"
                    value={selectedCampaign.fecha_programada}
                    onChange={(e) =>
                      setSelectedCampaign({ ...selectedCampaign, fecha_programada: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 text-xs border border-gray-300 rounded-xl"
                    required
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditDialog(false)}
                    disabled={submitting}
                    className="text-xs font-bold rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-blue-600 text-white text-xs font-bold rounded-xl">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar Cambios'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL ELIMINAR CAMPAÑA                                                    */}
        {/* ========================================================================= */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Deseas eliminar esta campaña?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se removerá la campaña "{selectedCampaign?.nombre}" de las tandas programadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCampaign}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ========================================================================= */}
        {/* MODAL GESTIÓN HUMANA                                                      */}
        {/* ========================================================================= */}
        {selectedHumanCase && (
          <Dialog open={!!selectedHumanCase} onOpenChange={() => setSelectedHumanCase(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Registrar Gestión Asistencial para {selectedHumanCase.nombre}
                </DialogTitle>
                <DialogDescription>
                  Paciente no contactado tras agotar las tandas operativas.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveHumanIntervention} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Resultado del Contacto Asistencial:</label>
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
                  <label className="text-xs font-bold text-gray-700 block mb-1">Notas Clínicas / Enfermería:</label>
                  <textarea
                    rows={3}
                    value={humanNotes}
                    onChange={(e) => setHumanNotes(e.target.value)}
                    placeholder="Detalles de la gestión humana con el paciente o acudiente..."
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

      </div>
    </Layout>
  );
};

export default CampaignsPage;
