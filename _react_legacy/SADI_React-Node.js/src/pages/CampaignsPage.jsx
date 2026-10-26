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

  const [newCampaign, setNewCampaign] = useState({
    nombre: '',
    templateId: '',
    segmentId: '',
    fechaProgramada: '',
    horaProgramada: ''
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

    if (!newCampaign.templateId) {
      toast({
        title: "Error",
        description: "Debes seleccionar una plantilla SMS",
        variant: "destructive"
      });
      return;
    }

    if (!newCampaign.segmentId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un segmento de pacientes",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);

      const campaignData = {
        nombre: newCampaign.nombre,
        templateId: newCampaign.templateId,
        segmentId: newCampaign.segmentId,
        fechaProgramada: newCampaign.fechaProgramada,
        horaProgramada: newCampaign.horaProgramada,
        hospitalId: hospitalId
      };

      console.log('📤 Enviando datos:', campaignData);
      const result = await campaignService.create(campaignData);

      if (result.success) {
        toast({
          title: "✅ Campaña creada",
          description: `La campaña ha sido programada con ${result.data.destinatarios} destinatarios`,
        });

        setShowCreateDialog(false);
        setNewCampaign({
          nombre: '',
          templateId: '',
          segmentId: '',
          fechaProgramada: '',
          horaProgramada: ''
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
      console.error('💥 Error creando campaña:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al crear la campaña",
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
            <DialogContent aria-describedby="create-campaign-description">
              <DialogHeader>
                <DialogTitle>Crear Nueva Campaña</DialogTitle>
                <DialogDescription id="create-campaign-description">
                  Completa los siguientes campos para programar tu campaña SMS
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre de la Campaña</Label>
                  <input
                    id="nombre"
                    type="text"
                    value={newCampaign.nombre}
                    onChange={(e) => setNewCampaign({ ...newCampaign, nombre: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="templateId">Plantilla SMS</Label>
                  <select
                    id="templateId"
                    value={newCampaign.templateId}
                    onChange={(e) => setNewCampaign({ ...newCampaign, templateId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Selecciona una plantilla</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.nombre}</option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ No hay plantillas disponibles. Crea una primero.</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="segmentId">Segmento de Pacientes</Label>
                  <select
                    id="segmentId"
                    value={newCampaign.segmentId}
                    onChange={(e) => setNewCampaign({ ...newCampaign, segmentId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Selecciona un segmento</option>
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>{segment.nombre}</option>
                    ))}
                  </select>
                  {segments.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ No hay segmentos disponibles. Crea uno primero.</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fechaProgramada">Fecha</Label>
                    <input
                      id="fechaProgramada"
                      type="date"
                      value={newCampaign.fechaProgramada}
                      onChange={(e) => setNewCampaign({ ...newCampaign, fechaProgramada: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="horaProgramada">Hora</Label>
                    <input
                      id="horaProgramada"
                      type="time"
                      value={newCampaign.horaProgramada}
                      onChange={(e) => setNewCampaign({ ...newCampaign, horaProgramada: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitting || templates.length === 0 || segments.length === 0}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : templates.length === 0 || segments.length === 0 ? (
                    'Necesitas plantillas y segmentos'
                  ) : (
                    'Crear Campaña'
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

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Programada para:</span>
                  <span className="font-medium">{campaign.fecha_programada}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Destinatarios:</span>
                  <span className="font-medium">{campaign.destinatarios || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Enviados:</span>
                  <span className="font-medium">{campaign.enviados || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Entregados:</span>
                  <span className="font-medium text-green-600">{campaign.entregados || 0}</span>
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
