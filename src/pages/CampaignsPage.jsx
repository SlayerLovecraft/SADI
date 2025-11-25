import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Send, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [segments, setSegments] = useState([]);
  const { toast } = useToast();

  const [newCampaign, setNewCampaign] = useState({
    nombre: '',
    templateId: '',
    segmentId: '',
    fechaProgramada: '',
    horaProgramada: ''
  });

  useEffect(() => {
    loadCampaigns();
    loadTemplates();
    loadSegments();
  }, []);

  const loadCampaigns = () => {
    const stored = localStorage.getItem('sadi_campaigns');
    if (stored) {
      setCampaigns(JSON.parse(stored));
    } else {
      // Sample campaigns
      const sampleCampaigns = [
        {
          id: '1',
          nombre: 'Recordatorio Citas Noviembre',
          estado: 'Activa',
          fechaCreacion: '2025-11-15',
          fechaProgramada: '2025-11-20',
          destinatarios: 45,
          enviados: 30,
          entregados: 28
        },
        {
          id: '2',
          nombre: 'Bienvenida Nuevos Pacientes',
          estado: 'Completada',
          fechaCreacion: '2025-10-10',
          fechaProgramada: '2025-10-15',
          destinatarios: 20,
          enviados: 20,
          entregados: 19
        }
      ];
      localStorage.setItem('sadi_campaigns', JSON.stringify(sampleCampaigns));
      setCampaigns(sampleCampaigns);
    }
  };

  const loadTemplates = () => {
    const stored = localStorage.getItem('sadi_templates');
    if (stored) {
      setTemplates(JSON.parse(stored));
    }
  };

  const loadSegments = () => {
    const stored = localStorage.getItem('sadi_segments');
    if (stored) {
      setSegments(JSON.parse(stored));
    }
  };

  const handleCreateCampaign = (e) => {
    e.preventDefault();
    
    const campaign = {
      ...newCampaign,
      id: Date.now().toString(),
      estado: 'Programada',
      fechaCreacion: new Date().toISOString().split('T')[0],
      destinatarios: 0,
      enviados: 0,
      entregados: 0
    };
    
    const updatedCampaigns = [...campaigns, campaign];
    localStorage.setItem('sadi_campaigns', JSON.stringify(updatedCampaigns));
    setCampaigns(updatedCampaigns);
    setShowCreateDialog(false);
    setNewCampaign({ nombre: '', templateId: '', segmentId: '', fechaProgramada: '', horaProgramada: '' });
    
    toast({
      title: "Campaña creada",
      description: "La campaña ha sido programada exitosamente",
    });
  };

  const getStatusIcon = (estado) => {
    switch (estado) {
      case 'Activa':
        return <Send className="h-5 w-5 text-blue-600" />;
      case 'Completada':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'Programada':
        return <Clock className="h-5 w-5 text-yellow-600" />;
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
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Campaña</DialogTitle>
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
                <Button type="submit" className="w-full">Crear Campaña</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {campaigns.map((campaign, index) => (
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
                    {getStatusIcon(campaign.estado)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{campaign.nombre}</h3>
                    <p className="text-xs text-gray-500">Creada: {campaign.fechaCreacion}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(campaign.estado)}`}>
                  {campaign.estado}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Programada para:</span>
                  <span className="font-medium">{campaign.fechaProgramada}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Destinatarios:</span>
                  <span className="font-medium">{campaign.destinatarios}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Enviados:</span>
                  <span className="font-medium">{campaign.enviados}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Entregados:</span>
                  <span className="font-medium text-green-600">{campaign.entregados}</span>
                </div>
              </div>

              {campaign.destinatarios > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progreso</span>
                    <span>{Math.round((campaign.entregados / campaign.destinatarios) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${(campaign.entregados / campaign.destinatarios) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => toast({
                    title: "🚧 Esta función no está implementada todavía",
                    description: "¡Puedes solicitarla en tu próximo prompt! 🚀",
                  })}
                >
                  Ver Detalles
                </Button>
                {campaign.estado === 'Programada' && (
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => toast({
                      title: "🚧 Esta función no está implementada todavía",
                      description: "¡Puedes solicitarla en tu próximo prompt! 🚀",
                    })}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Enviar Ahora
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {campaigns.length === 0 && (
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