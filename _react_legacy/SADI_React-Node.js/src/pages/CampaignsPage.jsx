import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Send, Plus, Clock, CheckCircle, AlertCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
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

const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Obtener hospitalId del usuario actual
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
    horaProgramada: '10:00',
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
      
      // Método 1: Intentar obtener de localStorage primero
      let hId = null;
      const storedUser = localStorage.getItem('sadi_user');
      
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          console.log('👤 Usuario en localStorage:', user);
          hId = user.hospital_id || user.hospitalId || user.Hospital_ID;
          
          if (hId) {
            console.log('✅ Hospital ID obtenido de localStorage:', hId);
          }
        } catch (e) {
          console.error('Error parseando usuario:', e);
        }
      }
      
      // Método 2: Si no está en localStorage, obtener de Supabase
      if (!hId) {
        console.log('🔍 Hospital ID no en localStorage, consultando Supabase...');
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('❌ Error obteniendo usuario de Supabase:', userError);
          toast({
            title: "Error de autenticación",
            description: "No hay sesión activa. Por favor inicia sesión.",
            variant: "destructive"
          });
          return;
        }

        console.log('👤 Usuario de Supabase:', user);
        
        // Intentar obtener hospital_id del metadata
        hId = user.user_metadata?.hospital_id || user.user_metadata?.hospitalId;
        
        if (hId) {
          console.log('✅ Hospital ID obtenido de user_metadata:', hId);
          
          // Guardarlo en localStorage para próxima vez
          localStorage.setItem('sadi_user', JSON.stringify({
            email: user.email,
            hospital_id: hId
          }));
        }
      }

      if (!hId) {
        console.error('❌ No se pudo obtener hospital_id');
        toast({
          title: "Error de configuración",
          description: "No se pudo identificar tu hospital. Contacta al administrador.",
          variant: "destructive"
        });
        return;
      }

      console.log('🏥 Hospital ID a usar:', hId);
      setHospitalId(hId);
      
      // Cargar datos de Supabase
      await Promise.all([
        loadCampaigns(hId),
        loadTemplates(hId),
        loadSegments(hId)
      ]);
      
    } catch (error) {
      console.error('💥 Error inicializando página:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async (hId) => {
    try {
      console.log('🔄 Cargando campañas para hospital:', hId);
      const result = await campaignService.getAll(hId);
      
      if (result.success) {
        setCampaigns(result.data);
        console.log('✅ Campañas cargadas:', result.data.length);
      } else {
        console.error('❌ Error cargando campañas:', result.error);
        toast({
          title: "Error",
          description: result.error || "No se pudieron cargar las campañas",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('💥 Error en loadCampaigns:', error);
    }
  };

  const loadTemplates = async (hId) => {
    try {
      console.log('🔄 Cargando plantillas para hospital:', hId);
      const result = await templateService.getAll(hId);
      
      if (result.success) {
        setTemplates(result.data);
        console.log('✅ Plantillas cargadas:', result.data.length);
      } else {
        console.error('❌ Error cargando plantillas:', result.error);
        toast({
          title: "Advertencia",
          description: "No se pudieron cargar las plantillas",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('💥 Error en loadTemplates:', error);
    }
  };

  const loadSegments = async (hId) => {
    try {
      console.log('🔄 Cargando segmentos para hospital:', hId);
      const result = await segmentService.getAll(hId);
      
      if (result.success) {
        setSegments(result.data);
        console.log('✅ Segmentos cargados:', result.data.length);
      } else {
        console.error('❌ Error cargando segmentos:', result.error);
        toast({
          title: "Advertencia",
          description: "No se pudieron cargar los segmentos",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('💥 Error en loadSegments:', error);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    
    console.log('🚀 handleCreateCampaign LLAMADO');
    console.log('📋 Datos del formulario:', newCampaign);
    console.log('🏥 Hospital ID:', hospitalId);
    
    if (!hospitalId) {
      console.error('❌ No hay hospitalId');
      toast({
        title: "Error",
        description: "No se pudo identificar el hospital",
        variant: "destructive"
      });
      return;
    }

    // Template y segmento por defecto si no están explícitamente seleccionados
    const targetTemplateId = newCampaign.templateId || templates[0]?.id;
    const targetSegmentId = newCampaign.segmentId || segments[0]?.id;

    if (newCampaign.edadTipo === 'personalizado') {
      const { anos, meses, dias } = newCampaign.edadCustom;
      if (!anos && !meses && !dias) {
        toast({
          title: "Rango personalizado incompleto",
          description: "Por favor ingresa al menos un valor en Años, Meses o Días para el rango personalizado.",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      setSubmitting(true);

      const anio = Number(newCampaign.anio) || currentYear;
      const mes = Number(newCampaign.mes) || currentMonth;
      const diaInicio = Number(newCampaign.diaInicio) || 1;
      const mm = String(mes).padStart(2, '0');
      const dd = String(diaInicio).padStart(2, '0');
      const fechaProgramada = `${anio}-${mm}-${dd}`;

      const campaignData = {
        nombre: newCampaign.nombre,
        templateId: targetTemplateId,
        segmentId: targetSegmentId,
        anio: anio,
        mes: mes,
        diaInicio: diaInicio,
        fechaProgramada: fechaProgramada,
        horaProgramada: newCampaign.horaProgramada || '10:00:00',
        edadTipo: newCampaign.edadTipo,
        edadCursoVida: newCampaign.edadCursoVida,
        edadCustom: newCampaign.edadCustom,
        modoReintento: newCampaign.modoReintento,
        contextoAgente: newCampaign.contextoAgente,
        hospitalId: hospitalId
      };

      console.log('📤 Enviando datos de campaña:', campaignData);
      const result = await campaignService.create(campaignData);

      if (result.success) {
        toast({
          title: "✅ Campaña Creada con Éxito",
          description: `La campaña "${newCampaign.nombre}" ha sido programada a partir del ${fechaProgramada}.`,
        });

        setShowCreateDialog(false);
        setNewCampaign({
          nombre: '',
          templateId: templates[0]?.id || '',
          segmentId: segments[0]?.id || '',
          anio: currentYear,
          mes: currentMonth,
          diaInicio: 1,
          horaProgramada: '10:00',
          edadTipo: 'cualquiera',
          edadCursoVida: 'primera_infancia',
          edadCustom: { anos: '', meses: '', dias: '' },
          modoReintento: 'hasta_responder',
          contextoAgente: 'Le informamos al paciente sobre la jornada de salud obligatoria de la Resolución 3280, verificamos si presenta síntomas y agendamos su cita médica preventiva en su IPS de adscripción.'
        });

        await loadCampaigns(hospitalId);
      } else {
        toast({
          title: "Error al crear campaña",
          description: result.error || "No se pudo registrar la campaña en la base de datos",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('💥 Error creando campaña:', error);
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al crear la campaña",
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
        templateId: selectedCampaign.template_id,
        segmentId: selectedCampaign.segment_id,
        fechaProgramada: selectedCampaign.fecha_programada,
        horaProgramada: selectedCampaign.hora_programada
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
      console.error('💥 Error actualizando campaña:', error);
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
      console.error('💥 Error eliminando campaña:', error);
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
      console.log('🚀 Enviando campaña:', campaign.id);

      const result = await campaignService.sendNow(campaign.id);

      if (result.success) {
        toast({
          title: "✅ Campaña enviada",
          description: result.mensaje || "La campaña ha sido enviada exitosamente",
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
      console.error('💥 Error enviando campaña:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al enviar la campaña",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (campaign) => {
    setSelectedCampaign({ ...campaign });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (campaign) => {
    setSelectedCampaign(campaign);
    setShowDeleteDialog(true);
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

  const getStatusIcon = (estado) => {
    switch (estado) {
      case 'Activa':
        return <Send className="h-5 w-5 text-blue-600" />;
      case 'Completada':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'Programada':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'No Enviada':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'Activa':
        return 'bg-blue-100 text-blue-800';
      case 'Completada':
        return 'bg-green-100 text-green-800';
      case 'Programada':
        return 'bg-yellow-100 text-yellow-800';
      case 'No Enviada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
            <p className="text-gray-500">Cargando campañas...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Campañas - SADI</title>
        <meta name="description" content="Gestión de campañas de mensajes SMS" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campañas</h1>
            <p className="text-gray-500 mt-1">Programa y gestiona tus campañas SMS</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Campaña
              </Button>
            </DialogTrigger>
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

                {/* Fecha de Inicio: Año, Mes, Día de inicio */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Programación de Lanzamiento y Duración
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                      Tandas de 32 / 30m
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="camp-anio" className="text-[11px] font-semibold text-gray-600">Año Campaña</Label>
                      <select
                        id="camp-anio"
                        value={newCampaign.anio}
                        onChange={(e) => setNewCampaign({ ...newCampaign, anio: e.target.value })}
                        className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-xl"
                      >
                        {[2025, 2026, 2027, 2028].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="camp-mes" className="text-[11px] font-semibold text-gray-600">Mes Campaña</Label>
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
                    ℹ️ <strong>Duración de la Campaña:</strong> Será el tiempo exacto que le tome al Agente IA llamar a todos los pacientes del segmento (procesando tandas de 32 pacientes cada 30 min entre 10:00 AM y 06:00 PM).
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

                  {/* Sub-opción: Selección de Curso de Vida */}
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

                  {/* Sub-opción: Rango Personalizado con 3 boxes numéricos estrictos */}
                  {newCampaign.edadTipo === 'personalizado' && (
                    <div className="pt-2 bg-white p-3 rounded-xl border border-emerald-200">
                      <p className="text-[11px] font-bold text-gray-700 mb-2">
                        Ingrese el rango límite de edad (Solo valores numéricos):
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
                    <span>🔁</span> Política de Contacto y Reintentos
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
                      <span>Hasta que todos respondan</span>
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
                      ✅ <strong>Filtro Inteligente:</strong> Cuando un paciente conteste exitosamente en su intento X, se excluirá automáticamente para no recibir más llamadas en esta campaña.
                    </p>
                  )}
                </div>

                {/* Cuadro de Contexto para el Agente IA */}
                <div>
                  <Label htmlFor="contextoAgente" className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>💬 Contexto y Directrices para el Agente IA:</span>
                    <span className="text-[10px] text-gray-400 font-normal">Qué decir, cómo preguntar y qué tono usar</span>
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {campaigns.map((campaign, index) => {
            const effectiveEstado = getEffectiveCampaignStatus(campaign);
            return (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-100 p-2 rounded-full">
                    {getStatusIcon(effectiveEstado)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{campaign.nombre}</h3>
                    <p className="text-xs text-gray-500">
                      Creada: {new Date(campaign.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(effectiveEstado)}`}>
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
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {campaign.edad_tipo === 'curso_vida' 
                      ? (campaign.edad_curso_vida?.replace('_', ' ') || 'Curso de vida')
                      : campaign.edad_tipo === 'personalizado'
                      ? 'Personalizado (A/M/D)'
                      : 'Cualquiera (Todos)'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Política Reintento:</span>
                  <span className="font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                    {campaign.modo_reintento === 'solo_una_vez' ? 'Solo 1 vez' : 'Hasta contestar (Filtro activo)'}
                  </span>
                </div>
                {campaign.contexto_agente && (
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px] text-slate-700 italic line-clamp-2">
                    "{campaign.contexto_agente}"
                  </div>
                )}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-gray-500">Destinatarios:</span>
                  <span className="font-bold">{campaign.destinatarios || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Enviados / Entregados:</span>
                  <span className="font-medium text-green-700">{campaign.enviados || 0} / {campaign.entregados || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Duración Estimada Agente:</span>
                  <span className="font-medium text-blue-700">
                    {Math.ceil((campaign.destinatarios || 1) / 32)} tanda(s) de 32 (~{Math.ceil((campaign.destinatarios || 1) / 32) * 0.5}h)
                  </span>
                </div>
              </div>

              {campaign.destinatarios > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progreso</span>
                    <span>{Math.round(((campaign.entregados || 0) / campaign.destinatarios) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${((campaign.entregados || 0) / campaign.destinatarios) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(campaign)}
                  disabled={submitting}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => openDeleteDialog(campaign)}
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>

                {(effectiveEstado === 'Programada' || effectiveEstado === 'No Enviada') && (
                  <Button 
                    size="sm"
                    onClick={() => handleSendNow(campaign)}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-1" />
                    )}
                    Enviar Ahora
                  </Button>
                )}
              </div>
            </motion.div>
          )})}
        </div>

        {/* Edit Campaign Dialog */}
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
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="edit-template">Plantilla SMS</Label>
                  <select
                    id="edit-template"
                    value={selectedCampaign.template_id}
                    onChange={(e) =>
                      setSelectedCampaign({ ...selectedCampaign, template_id: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Selecciona una plantilla</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="edit-segment">Segmento de Pacientes</Label>
                  <select
                    id="edit-segment"
                    value={selectedCampaign.segment_id}
                    onChange={(e) =>
                      setSelectedCampaign({ ...selectedCampaign, segment_id: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Selecciona un segmento</option>
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="edit-fecha">Fecha</Label>
                  <input
                    id="edit-fecha"
                    type="date"
                    value={selectedCampaign.fecha_programada}
                    onChange={(e) =>
                      setSelectedCampaign({ ...selectedCampaign, fecha_programada: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="edit-hora">Hora</Label>
                  <input
                    id="edit-hora"
                    type="time"
                    value={selectedCampaign.hora_programada}
                    onChange={(e) =>
                      setSelectedCampaign({ ...selectedCampaign, hora_programada: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditDialog(false)}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Cambios'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Esto eliminará permanentemente la campaña
                "{selectedCampaign?.nombre}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCampaign}
                className="bg-red-600 hover:bg-red-700"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Eliminar'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {campaigns.length === 0 && !loading && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Send className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay campañas creadas</h3>
            <p className="text-gray-500 mb-4">Crea tu primera campaña SMS</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Campaña
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CampaignsPage;
