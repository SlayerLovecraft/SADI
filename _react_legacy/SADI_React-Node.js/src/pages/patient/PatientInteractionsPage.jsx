import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import PatientLayout from '@/layouts/PatientLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  MessageSquare, 
  Plus, 
  AlertTriangle, 
  FileText, 
  Bug, 
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const PatientInteractionsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [patientData, setPatientData] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [tipo, setTipo] = useState('');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (user?.role === 'patient') {
      loadPatientData();
    }
  }, [user]);

  useEffect(() => {
    if (patientData?.patient_id) {
      loadInteractions();
    }
  }, [patientData]);

  const loadPatientData = async () => {
    try {
      console.log('🔍 Buscando paciente con ID:', user.id);
      
      const { data: patients, error } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_id', user.id);

      if (error) {
        console.error('❌ Error en query:', error);
        throw error;
      }

      if (!patients || patients.length === 0) {
        throw new Error('No se encontró el perfil del paciente');
      }

      const patient = patients[0];
      console.log('✅ Paciente encontrado:', patient);
      setPatientData(patient);
    } catch (error) {
      console.error('❌ Error cargando paciente:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo cargar tu información",
        variant: "destructive"
      });
    }
  };

  const loadInteractions = async () => {
    try {
      setLoading(true);
      console.log('🔍 Cargando interacciones para paciente:', patientData.patient_id);
      
      // INTENTO 1: Usar RPC segura con parámetro explícito
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_patient_interactions', {
        p_patient_id: patientData.patient_id
      });

      if (!rpcError) {
        console.log('✅ Interacciones cargadas (RPC):', rpcData?.length || 0);
        setInteractions(rpcData || []);
        return;
      }

      console.warn('⚠️ Falló RPC, intentando método normal:', rpcError);

      // FALLBACK: Método normal
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('patient_id', patientData.patient_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error cargando interacciones:', error);
        // Si el error es de permisos, no mostramos error al usuario
        if (error.code === '42501' || error.code === 'PGRST301') {
          console.warn('⚠️ Sin permisos para leer interacciones, mostrando lista vacía');
          setInteractions([]);
        } else {
          throw error;
        }
      } else {
        console.log('✅ Interacciones cargadas:', data?.length || 0);
        setInteractions(data || []);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las interacciones",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!tipo || !asunto.trim() || !mensaje.trim()) {
      toast({
        title: "Campos incompletos",
        description: "Por favor completa todos los campos",
        variant: "destructive"
      });
      return;
    }

    if (!patientData?.hospital_id) {
      toast({
        title: "Error",
        description: "No se encontró tu hospital asignado",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      console.log('📤 Enviando interacción:', {
        patient_id: patientData.patient_id,
        hospital_id: patientData.hospital_id,
        tipo,
        asunto
      });

      const interactionData = {
        patient_id: patientData.patient_id,
        hospital_id: patientData.hospital_id,
        patient_name: patientData.name,
        patient_phone: patientData.phone || '',
        patient_email: patientData.email || '',
        tipo: tipo,
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
        estado: 'pendiente',
        created_at: new Date().toISOString()
      };

      // INTENTO 1: Usar la función RPC segura (Bypass RLS)
      console.log('🔄 Intentando enviar con RPC segura...');
      
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_interaction_secure', {
        p_patient_id: interactionData.patient_id,
        p_hospital_id: interactionData.hospital_id,
        p_patient_name: interactionData.patient_name,
        p_patient_phone: interactionData.patient_phone,
        p_patient_email: interactionData.patient_email,
        p_tipo: interactionData.tipo,
        p_asunto: interactionData.asunto,
        p_mensaje: interactionData.mensaje
      });

      if (rpcError) {
        console.warn('⚠️ Error con RPC, intentando método normal:', rpcError);
        
        // FALLBACK: Método normal si la RPC no existe aún
        const { data, error } = await supabase
          .from('interactions')
          .insert([interactionData])
          .select();

        if (error) {
          console.error('❌ Error al insertar (Fallback):', error);
          
          if (error.code === '42501' || error.message.includes('permission denied')) {
             // Si falla por permisos, es probable que no hayan ejecutado el SQL de la RPC
             throw new Error('Error de permisos. Por favor solicita al administrador ejecutar el script "create_interaction_rpc.sql"');
          } else {
             throw error;
          }
        }
        console.log('✅ Interacción creada (Normal):', data);
      } else {
        console.log('✅ Interacción creada (RPC):', rpcData);
      }

      toast({
        title: "✅ Solicitud enviada",
        description: "Tu solicitud ha sido enviada al hospital. Recibirás una respuesta pronto."
      });
      
      // Limpiar formulario
      setTipo('');
      setAsunto('');
      setMensaje('');
      setShowForm(false);
      
      // Recargar interacciones
      await loadInteractions();
    } catch (error) {
      console.error('💥 Error completo:', error);
      toast({
        title: "Error al enviar",
        description: error.message || "No se pudo enviar tu solicitud. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (estado) => {
    const badges = {
      pendiente: {
        color: 'bg-yellow-100 text-yellow-800',
        icon: Clock,
        text: 'Pendiente'
      },
      en_proceso: {
        color: 'bg-blue-100 text-blue-800',
        icon: Loader2,
        text: 'En Proceso'
      },
      resuelta: {
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle,
        text: 'Resuelta'
      },
      cerrada: {
        color: 'bg-gray-100 text-gray-800',
        icon: XCircle,
        text: 'Cerrada'
      }
    };

    const badge = badges[estado] || badges.pendiente;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.text}
      </span>
    );
  };

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'urgencia':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'reporte_tecnico':
        return <Bug className="h-5 w-5 text-orange-600" />;
      case 'pqr':
        return <FileText className="h-5 w-5 text-blue-600" />;
      default:
        return <MessageSquare className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      urgencia: 'Urgencia',
      reporte_tecnico: 'Reporte Técnico',
      pqr: 'PQR'
    };
    return labels[tipo] || tipo;
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando interacciones...</p>
          </div>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <Helmet>
        <title>Mis Interacciones - SADI Salud</title>
      </Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mis Interacciones</h1>
            <p className="text-gray-600 mt-1">Gestiona tus solicitudes y consultas</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Solicitud
          </Button>
        </div>

        {/* Formulario de nueva interacción */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Nueva Solicitud</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Solicitud */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Tipo de Solicitud *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setTipo('urgencia')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      tipo === 'urgencia'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300 hover:border-red-300'
                    }`}
                  >
                    <AlertTriangle className={`h-8 w-8 mx-auto mb-2 ${
                      tipo === 'urgencia' ? 'text-red-600' : 'text-gray-400'
                    }`} />
                    <p className={`font-semibold ${
                      tipo === 'urgencia' ? 'text-red-700' : 'text-gray-700'
                    }`}>
                      Urgencia
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Necesito atención inmediata
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo('reporte_tecnico')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      tipo === 'reporte_tecnico'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-300 hover:border-orange-300'
                    }`}
                  >
                    <Bug className={`h-8 w-8 mx-auto mb-2 ${
                      tipo === 'reporte_tecnico' ? 'text-orange-600' : 'text-gray-400'
                    }`} />
                    <p className={`font-semibold ${
                      tipo === 'reporte_tecnico' ? 'text-orange-700' : 'text-gray-700'
                    }`}>
                      Problema Técnico
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Reportar un error de la app
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo('pqr')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      tipo === 'pqr'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <FileText className={`h-8 w-8 mx-auto mb-2 ${
                      tipo === 'pqr' ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <p className={`font-semibold ${
                      tipo === 'pqr' ? 'text-blue-700' : 'text-gray-700'
                    }`}>
                      PQR
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Petición, Queja o Reclamo
                    </p>
                  </button>
                </div>
              </div>

              {/* Asunto */}
              <div>
                <label htmlFor="asunto" className="block text-sm font-medium text-gray-700 mb-2">
                  Asunto *
                </label>
                <input
                  id="asunto"
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Resumen breve de tu solicitud"
                  maxLength={255}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{asunto.length}/255 caracteres</p>
              </div>

              {/* Mensaje */}
              <div>
                <label htmlFor="mensaje" className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción Detallada *
                </label>
                <textarea
                  id="mensaje"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Describe tu solicitud con el mayor detalle posible..."
                  required
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={submitting || !tipo}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Solicitud
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de interacciones */}
        <div className="space-y-4">
          {interactions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No tienes interacciones
              </h3>
              <p className="text-gray-600 mb-6">
                Crea tu primera solicitud para comunicarte con el hospital
              </p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Solicitud
              </Button>
            </div>
          ) : (
            interactions.map((interaction) => (
              <div
                key={interaction.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="mt-1">
                      {getTipoIcon(interaction.tipo)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {interaction.asunto}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {getTipoLabel(interaction.tipo)} • {new Date(interaction.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(interaction.estado)}
                </div>
                
                <p className="text-gray-700 mb-4">
                  {interaction.mensaje}
                </p>

                {interaction.respuesta && (
                  <div className="bg-teal-50 border-l-4 border-teal-500 p-4 rounded">
                    <p className="text-sm font-semibold text-teal-900 mb-1">
                      Respuesta del Hospital:
                    </p>
                    <p className="text-sm text-teal-800">
                      {interaction.respuesta}
                    </p>
                    {(interaction.hospital_name || interaction.respondido_por) && (
                      <p className="text-xs text-teal-600 mt-2">
                        Por: {interaction.hospital_name || interaction.respondido_por}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </PatientLayout>
  );
};

export default PatientInteractionsPage;