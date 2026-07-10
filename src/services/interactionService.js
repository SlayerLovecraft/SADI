// src/services/interactionService.js
import { supabase } from '@/lib/supabase.js';
import { isSupabaseAuthError, withTimeout } from '@/lib/utils';

export const interactionService = {
  /**
   * Obtener todas las interacciones de un hospital
   * ✅ OPTIMIZADO: Usa alias correcto y maneja errores
   */
async getByHospital(hospitalId) {
  try {
    console.log('📋 Obteniendo interacciones del hospital:', hospitalId);
    
    const makeQuery = () => supabase
      .from('interactions')
      .select(`
        *,
        patient:patient_id (
          patient_id,
          name,
          phone,
          email,
          document
        )
      `)
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false });

    const run = async () => withTimeout(makeQuery(), 12000, 'Tiempo de espera agotado al cargar interacciones');
    let { data, error } = await run();
    if (error && isSupabaseAuthError(error)) {
      await supabase.auth.refreshSession().catch(() => null);
      ({ data, error } = await run());
    }

    if (error) {
      console.error('❌ Error obteniendo interacciones:', error);
      throw error;
    }

    console.log('✅ Interacciones obtenidas:', data?.length || 0);
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('💥 Error en getByHospital:', error);
    return { success: false, error: error.message, data: [] };
  }
},

  /**
   * Obtener interacciones de un paciente específico
   */
  async getByPatient(patientId) {
    try {
      console.log('👤 Obteniendo interacciones del paciente:', patientId);
      
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error obteniendo interacciones:', error);
        throw error;
      }

      console.log('✅ Interacciones obtenidas:', data?.length || 0);
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('💥 Error en getByPatient:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Crear una nueva interacción (desde paciente)
   */
  async create(interactionData) {
    try {
      console.log('📝 Creando nueva interacción:', interactionData);

      // Validaciones
      if (!interactionData.patientId || !interactionData.hospitalId) {
        throw new Error('patientId y hospitalId son requeridos');
      }

      if (!['urgencia', 'pqr', 'reporte_tecnico'].includes(interactionData.tipo)) {
        throw new Error('Tipo de interacción inválido');
      }

      // Asignar prioridad automática según el tipo
      let prioridad = 2; // Media por defecto
      if (interactionData.tipo === 'urgencia') {
        prioridad = 1; // Alta
      } else if (interactionData.tipo === 'reporte_tecnico') {
        prioridad = 2; // Media
      } else if (interactionData.tipo === 'pqr') {
        prioridad = 3; // Baja
      }

      const insertData = {
        patient_id: interactionData.patientId,
        hospital_id: interactionData.hospitalId,
        patient_name: interactionData.patientName,
        patient_phone: interactionData.patientPhone || null,
        patient_email: interactionData.patientEmail || null,
        tipo: interactionData.tipo,
        asunto: interactionData.asunto,
        mensaje: interactionData.mensaje,
        prioridad: prioridad,
        estado: 'pendiente'
      };

      console.log('📤 Datos a insertar:', insertData);

      const { data, error } = await supabase
        .from('interactions')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al crear interacción:', error);
        throw error;
      }

      console.log('✅ Interacción creada exitosamente:', data);
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en create:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Actualizar estado de una interacción
   */
  async updateStatus(interactionId, nuevoEstado) {
    try {
      console.log('🔄 Actualizando estado de interacción:', interactionId);

      const { data, error } = await supabase
        .from('interactions')
        .update({ 
          estado: nuevoEstado,
          updated_at: new Date().toISOString()
        })
        .eq('id', interactionId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error actualizando estado:', error);
        throw error;
      }

      console.log('✅ Estado actualizado exitosamente');
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en updateStatus:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Responder a una interacción (desde hospital)
   */
  async respond(interactionId, respuesta, userId) {
    try {
      console.log('💬 Respondiendo interacción:', interactionId);

      const { data, error } = await supabase
        .from('interactions')
        .update({
          respuesta: respuesta,
          respondido_por: userId,
          respondido_en: new Date().toISOString(),
          estado: 'resuelto',
          updated_at: new Date().toISOString()
        })
        .eq('id', interactionId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error al responder:', error);
        throw error;
      }

      console.log('✅ Respuesta guardada exitosamente');
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en respond:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Cerrar una interacción
   */
  async close(interactionId) {
    try {
      console.log('🔒 Cerrando interacción:', interactionId);

      const { data, error } = await supabase
        .from('interactions')
        .update({
          estado: 'cerrado',
          updated_at: new Date().toISOString()
        })
        .eq('id', interactionId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error al cerrar:', error);
        throw error;
      }

      console.log('✅ Interacción cerrada exitosamente');
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en close:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Eliminar una interacción
   */
  async delete(interactionId) {
    try {
      console.log('🗑️ Eliminando interacción:', interactionId);

      const { error } = await supabase
        .from('interactions')
        .delete()
        .eq('id', interactionId);

      if (error) {
        console.error('❌ Error al eliminar:', error);
        throw error;
      }

      console.log('✅ Interacción eliminada exitosamente');
      return { success: true };
    } catch (error) {
      console.error('💥 Error en delete:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Obtener estadísticas de interacciones por tipo
   * ✅ OPTIMIZADO: Sin consultas recursivas
   */
  async getStats(hospitalId) {
    try {
      console.log('📊 Obteniendo estadísticas de interacciones');

      const { data, error } = await supabase
        .from('interactions')
        .select('tipo, estado, created_at')
        .eq('hospital_id', hospitalId);

      if (error) throw error;

      // Calcular estadísticas en el cliente (más seguro)
      const now = new Date();
      const today = now.toDateString();
      
      const stats = {
        total: data?.length || 0,
        urgencias: data?.filter(i => i.tipo === 'urgencia').length || 0,
        pqrs: data?.filter(i => i.tipo === 'pqr').length || 0,
        reportes: data?.filter(i => i.tipo === 'reporte_tecnico').length || 0,
        pendientes: data?.filter(i => i.estado === 'pendiente').length || 0,
        enProceso: data?.filter(i => i.estado === 'en_proceso').length || 0,
        resueltas: data?.filter(i => i.estado === 'resuelto').length || 0,
        cerradas: data?.filter(i => i.estado === 'cerrado').length || 0,
        hoy: data?.filter(i => new Date(i.created_at).toDateString() === today).length || 0
      };

      console.log('✅ Estadísticas calculadas:', stats);
      return { success: true, data: stats };
    } catch (error) {
      console.error('💥 Error en getStats:', error);
      return { 
        success: false, 
        error: error.message,
        data: {
          total: 0,
          urgencias: 0,
          pqrs: 0,
          reportes: 0,
          pendientes: 0,
          enProceso: 0,
          resueltas: 0,
          cerradas: 0,
          hoy: 0
        }
      };
    }
  }
};
