import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { 
  MessageSquare, Search, Filter, CheckCircle, XCircle, Clock,
  AlertTriangle, FileText, Bug, Send, Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { interactionService } from '@/services/interactionService';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const InteractionsPage = () => {
  const [interactions, setInteractions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [selectedInteraction, setSelectedInteraction] = useState(null);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.hospitalId) {
      loadInteractions();
      loadStats();
    }
  }, [user]);

  const loadInteractions = async () => {
    setLoading(true);
    try {
      const result = await interactionService.getByHospital(user.hospitalId);
      if (result.success) {
        setInteractions(result.data);
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading interactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await interactionService.getStats(user.hospitalId);
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleRespond = async () => {
    if (!respuesta.trim()) {
      toast({
        title: "Error",
        description: "Debes escribir una respuesta",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await interactionService.respond(
        selectedInteraction.id,
        respuesta,
        user.id
      );

      if (result.success) {
        toast({
          title: "Respuesta enviada",
          description: "El paciente recibirá tu respuesta"
        });
        setShowResponseDialog(false);
        setRespuesta('');
        setSelectedInteraction(null);
        await loadInteractions();
        await loadStats();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar la respuesta",
        variant: "destructive"
      });
    }
  };

  const handleUpdateStatus = async (interactionId, nuevoEstado) => {
    try {
      const result = await interactionService.updateStatus(interactionId, nuevoEstado);
      
      if (result.success) {
        toast({
          title: "Estado actualizado",
          description: `La interacción ahora está: ${nuevoEstado}`
        });
        await loadInteractions();
        await loadStats();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive"
      });
    }
  };

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'urgencia':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'pqr':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'reporte_tecnico':
        return <Bug className="h-5 w-5 text-orange-600" />;
      default:
        return <MessageSquare className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTipoLabel = (tipo) => {
    switch (tipo) {
      case 'urgencia':
        return 'Urgencia';
      case 'pqr':
        return 'PQR';
      case 'reporte_tecnico':
        return 'Reporte Técnico';
      default:
        return tipo;
    }
  };

  const getTipoColor = (tipo) => {
    switch (tipo) {
      case 'urgencia':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pqr':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'reporte_tecnico':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'resuelto':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cerrado':
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
      case 'en_proceso':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'pendiente':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'resuelto':
        return 'bg-green-100 text-green-800';
      case 'cerrado':
        return 'bg-gray-100 text-gray-800';
      case 'en_proceso':
        return 'bg-yellow-100 text-yellow-800';
      case 'pendiente':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'resuelto':
        return 'Resuelto';
      case 'cerrado':
        return 'Cerrado';
      case 'en_proceso':
        return 'En Proceso';
      case 'pendiente':
        return 'Pendiente';
      default:
        return estado;
    }
  };

  // Ordenar por prioridad y fecha
  const sortedInteractions = [...interactions].sort((a, b) => {
    // Primero por prioridad (1=Alta, 2=Media, 3=Baja)
    if (a.prioridad !== b.prioridad) {
      return a.prioridad - b.prioridad;
    }
    // Luego por fecha (más recientes primero)
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Filtrar interacciones
  const filteredInteractions = sortedInteractions.filter(i => {
    const matchesSearch = 
      i.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.patient_phone?.includes(searchTerm) ||
      i.asunto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.mensaje?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'Todos' || i.estado === filterStatus;
    const matchesTipo = filterTipo === 'Todos' || i.tipo === filterTipo;
    
    return matchesSearch && matchesStatus && matchesTipo;
  });

  // Agrupar por tipo
  const urgencias = filteredInteractions.filter(i => i.tipo === 'urgencia');
  const reportes = filteredInteractions.filter(i => i.tipo === 'reporte_tecnico');
  const pqrs = filteredInteractions.filter(i => i.tipo === 'pqr');

  const InteractionCard = ({ interaction, index }) => (
    <motion.div
      key={interaction.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`border-2 rounded-lg p-4 hover:shadow-lg transition-all ${getTipoColor(interaction.tipo)}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getTipoIcon(interaction.tipo)}
          <div>
            <span className="font-semibold text-sm">{getTipoLabel(interaction.tipo)}</span>
            <p className="text-xs text-gray-600">
              {new Date(interaction.created_at).toLocaleDateString()} - {new Date(interaction.created_at).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center space-x-1 ${getEstadoColor(interaction.estado)}`}>
          {getEstadoIcon(interaction.estado)}
          <span className="ml-1">{getEstadoLabel(interaction.estado)}</span>
        </span>
      </div>

      <div className="mb-3">
        <h4 className="font-bold text-gray-900 mb-1">{interaction.asunto}</h4>
        <p className="text-sm text-gray-700 mb-2">{interaction.mensaje}</p>
        <div className="text-xs text-gray-600">
          <span className="font-medium">Paciente:</span> {interaction.patient_name}
          {interaction.patient_phone && ` • ${interaction.patient_phone}`}
        </div>
      </div>

      {interaction.respuesta && (
        <div className="bg-white/50 p-3 rounded-lg mb-3 border border-gray-300">
          <p className="text-xs font-semibold text-gray-700 mb-1">Respuesta del Hospital:</p>
          <p className="text-sm text-gray-800">{interaction.respuesta}</p>
          {interaction.respondido_en && (
            <p className="text-xs text-gray-500 mt-1">
              Respondido el {new Date(interaction.respondido_en).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {interaction.estado === 'pendiente' && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleUpdateStatus(interaction.id, 'en_proceso')}
            >
              Marcar en Proceso
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedInteraction(interaction);
                setShowResponseDialog(true);
              }}
            >
              <Send className="h-4 w-4 mr-1" />
              Responder
            </Button>
          </>
        )}
        {interaction.estado === 'en_proceso' && !interaction.respuesta && (
          <Button
            size="sm"
            onClick={() => {
              setSelectedInteraction(interaction);
              setShowResponseDialog(true);
            }}
          >
            <Send className="h-4 w-4 mr-1" />
            Responder
          </Button>
        )}
        {interaction.estado === 'resuelto' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleUpdateStatus(interaction.id, 'cerrado')}
          >
            Cerrar Ticket
          </Button>
        )}
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Cargando interacciones...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Interacciones - SADI</title>
        <meta name="description" content="Gestión de comunicaciones con pacientes" />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Interacciones</h1>
          <p className="text-gray-500 mt-1">
            Atiende las solicitudes y comunicaciones de tus pacientes
          </p>
        </div>

        {/* Estadísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Urgencias</p>
                  <p className="text-2xl font-bold text-red-700">{stats.urgencias}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Reportes Técnicos</p>
                  <p className="text-2xl font-bold text-orange-700">{stats.reportes}</p>
                </div>
                <Bug className="h-8 w-8 text-orange-500" />
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">PQR's</p>
                  <p className="text-2xl font-bold text-blue-700">{stats.pqrs}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Pendientes</p>
                  <p className="text-2xl font-bold text-green-700">{stats.pendientes}</p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por paciente, asunto o mensaje..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Todos">Todos los tipos</option>
              <option value="urgencia">Urgencias</option>
              <option value="reporte_tecnico">Reportes Técnicos</option>
              <option value="pqr">PQR's</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En Proceso</option>
              <option value="resuelto">Resuelto</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
        </div>

        {/* Lista de Interacciones Agrupadas */}
        {urgencias.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-red-700 mb-4 flex items-center">
              <AlertTriangle className="h-6 w-6 mr-2" />
              Urgencias ({urgencias.length})
            </h2>
            <div className="space-y-4">
              {urgencias.map((interaction, index) => (
                <InteractionCard key={interaction.id} interaction={interaction} index={index} />
              ))}
            </div>
          </div>
        )}

        {reportes.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-orange-700 mb-4 flex items-center">
              <Bug className="h-6 w-6 mr-2" />
              Reportes Técnicos ({reportes.length})
            </h2>
            <div className="space-y-4">
              {reportes.map((interaction, index) => (
                <InteractionCard key={interaction.id} interaction={interaction} index={index} />
              ))}
            </div>
          </div>
        )}

        {pqrs.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-blue-700 mb-4 flex items-center">
              <FileText className="h-6 w-6 mr-2" />
              PQR's ({pqrs.length})
            </h2>
            <div className="space-y-4">
              {pqrs.map((interaction, index) => (
                <InteractionCard key={interaction.id} interaction={interaction} index={index} />
              ))}
            </div>
          </div>
        )}

        {filteredInteractions.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron interacciones</p>
          </div>
        )}
      </div>

      {/* Dialog de Respuesta */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Responder a {selectedInteraction?.patient_name}</DialogTitle>
          </DialogHeader>
          {selectedInteraction && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-1">Asunto:</p>
                <p className="text-sm text-gray-900 mb-2">{selectedInteraction.asunto}</p>
                <p className="text-sm font-semibold text-gray-700 mb-1">Mensaje del paciente:</p>
                <p className="text-sm text-gray-900">{selectedInteraction.mensaje}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tu respuesta:
                </label>
                <textarea
                  value={respuesta}
                  onChange={(e) => setRespuesta(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Escribe tu respuesta aquí..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowResponseDialog(false);
              setRespuesta('');
              setSelectedInteraction(null);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleRespond}>
              <Send className="h-4 w-4 mr-2" />
              Enviar Respuesta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default InteractionsPage;