// src/services/campaignService.js
import { supabase } from '@/lib/supabase.js';
import { segmentService } from './segmentService.js';
import { isSupabaseAuthError, withTimeout } from '@/lib/utils';

export const campaignService = {
  /**
   * Obtener todas las campañas de un hospital
   * ✅ OPTIMIZADO: Mejor manejo de errores
   */
  async getAll(hospitalId) {
    try {
      console.log('📊 Obteniendo campañas para hospital:', hospitalId);
      
      const makeQuery = () => {
        let query = supabase
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (hospitalId) {
          query = query.eq('hospital_id', hospitalId);
        }

        return query;
      };

      const run = async () => withTimeout(makeQuery(), 12000, 'Tiempo de espera agotado al cargar campañas');
      let { data, error } = await run();
      if (error && isSupabaseAuthError(error)) {
        await supabase.auth.refreshSession().catch(() => null);
        ({ data, error } = await run());
      }

      if (error) {
        console.error('❌ Error obteniendo campañas:', error);
        
        // Manejar error de recursión
        if (error.message?.includes('infinite recursion')) {
          console.warn('⚠️ Error de recursión detectado, retornando array vacío');
          return { success: true, data: [] };
        }
        
        throw error;
      }

      console.log('✅ Campañas obtenidas:', data?.length || 0);
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('💥 Error en getAll:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Obtener una campaña por ID
   */
  async getById(id) {
    try {
      console.log('🔍 Obteniendo campaña:', id);
      
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Error obteniendo campaña:', error);
        throw error;
      }

      console.log('✅ Campaña encontrada:', data.nombre);
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en getById:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Crear una nueva campaña
   * ✅ OPTIMIZADO: Mejor cálculo de participantes
   */
  async create(campaignData) {
    try {
      console.log('📝 Creando nueva campaña:', campaignData);
      
      // Validar datos requeridos
      if (!campaignData.hospitalId) {
        throw new Error('hospitalId es requerido');
      }
      if (!campaignData.nombre) {
        throw new Error('nombre es requerido');
      }
      if (!campaignData.templateId) {
        throw new Error('templateId es requerido');
      }
      if (!campaignData.segmentId) {
        throw new Error('segmentId es requerido');
      }

      // Obtener pacientes del segmento para calcular destinatarios
      const { data: patientsData } = await segmentService.getPatientsInSegment(
        campaignData.segmentId
      );
      
      const destinatarios = patientsData?.length || 0;

      // Calcular participantes por demografía de forma más robusta
      const participantes = {
        hombres: 0,
        mujeres: 0,
        ninos: 0,
        ninas: 0
      };

      if (patientsData && patientsData.length > 0) {
        patientsData.forEach(patient => {
          // Calcular edad si tiene fecha de nacimiento
          let edad = patient.edad || 0;
          if (!edad && patient.fecha_nacimiento) {
            const birthDate = new Date(patient.fecha_nacimiento);
            const today = new Date();
            edad = today.getFullYear() - birthDate.getFullYear();
          }
          
          // Normalizar género
          const sexo = (patient.sex || patient.sexo || '').toLowerCase();
          const esHombre = ['masculino', 'm', 'male', 'hombre'].includes(sexo);
          const esMujer = ['femenino', 'f', 'female', 'mujer'].includes(sexo);
          
          if (esHombre) {
            if (edad < 18) participantes.ninos++;
            else participantes.hombres++;
          } else if (esMujer) {
            if (edad < 18) participantes.ninas++;
            else participantes.mujeres++;
          }
        });
      }

      // Preparar datos para insertar
      const insertData = {
        nombre: campaignData.nombre,
        template_id: campaignData.templateId,
        segment_id: campaignData.segmentId,
        hospital_id: campaignData.hospitalId,
        fecha_programada: campaignData.fechaProgramada,
        hora_programada: campaignData.horaProgramada,
        estado: 'Programada',
        destinatarios: destinatarios,
        enviados: 0,
        entregados: 0,
        fallidos: 0,
        participantes: participantes
      };

      console.log('📤 Datos a insertar:', insertData);

      const runInsert = () => supabase
        .from('campaigns')
        .insert([insertData])
        .select('*')
        .single();

      const { data, error } = await withTimeout(runInsert(), 15000, 'Tiempo de espera agotado al crear campaña');

      if (error) {
        console.error('❌ Error al crear campaña:', error);
        throw error;
      }

      console.log('✅ Campaña creada exitosamente:', data);
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en create:', error);
      
      // Manejar errores específicos
      if (error.message?.includes('infinite recursion')) {
        return { 
          success: false, 
          error: 'Error de permisos en la base de datos. Verifica las políticas RLS.' 
        };
      }
      
      if (error.code === '42501') {
        return { 
          success: false, 
          error: 'No tienes permisos para crear campañas. Contacta al administrador.' 
        };
      }

      return { success: false, error: error.message };
    }
  },

  /**
   * Actualizar una campaña existente
   */
  async update(id, campaignData) {
    try {
      console.log('✏️ Actualizando campaña:', id);
      
      const updateData = {
        nombre: campaignData.nombre,
        template_id: campaignData.templateId,
        segment_id: campaignData.segmentId,
        fecha_programada: campaignData.fechaProgramada,
        hora_programada: campaignData.horaProgramada,
        updated_at: new Date().toISOString()
      };

      // Si se cambió el segmento, recalcular destinatarios
      if (campaignData.segmentId) {
        const { data: patientsData } = await segmentService.getPatientsInSegment(
          campaignData.segmentId
        );
        
        const destinatarios = patientsData?.length || 0;
        updateData.destinatarios = destinatarios;

        // Recalcular participantes
        const participantes = {
          hombres: 0,
          mujeres: 0,
          ninos: 0,
          ninas: 0
        };

        if (patientsData && patientsData.length > 0) {
          patientsData.forEach(patient => {
            let edad = patient.edad || 0;
            if (!edad && patient.fecha_nacimiento) {
              const birthDate = new Date(patient.fecha_nacimiento);
              const today = new Date();
              edad = today.getFullYear() - birthDate.getFullYear();
            }
            
            const sexo = (patient.sex || patient.sexo || '').toLowerCase();
            const esHombre = ['masculino', 'm', 'male', 'hombre'].includes(sexo);
            const esMujer = ['femenino', 'f', 'female', 'mujer'].includes(sexo);
            
            if (esHombre) {
              if (edad < 18) participantes.ninos++;
              else participantes.hombres++;
            } else if (esMujer) {
              if (edad < 18) participantes.ninas++;
              else participantes.mujeres++;
            }
          });
        }

        updateData.participantes = participantes;
      }

      console.log('📤 Datos a actualizar:', updateData);

      const { data, error } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Error al actualizar campaña:', error);
        throw error;
      }

      console.log('✅ Campaña actualizada exitosamente');
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en update:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Eliminar una campaña
   */
  async delete(id) {
    try {
      console.log('🗑️ Eliminando campaña:', id);
      
      const runDelete = () => supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      const { error } = await withTimeout(runDelete(), 15000, 'Tiempo de espera agotado al eliminar campaña');

      if (error) {
        console.error('❌ Error al eliminar campaña:', error);
        throw error;
      }

      console.log('✅ Campaña eliminada exitosamente');
      return { success: true };
    } catch (error) {
      console.error('💥 Error en delete:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Cambiar el estado de una campaña
   */
  async updateStatus(id, newStatus) {
    try {
      console.log('🔄 Actualizando estado de campaña:', id, 'a', newStatus);
      
      const updateData = {
        estado: newStatus,
        updated_at: new Date().toISOString()
      };

      // Si se cambia a 'Activa', registrar fecha de envío
      if (newStatus === 'Activa') {
        updateData.fecha_envio = new Date().toISOString();
      }

      // Si se cambia a 'Completada', registrar fecha de completado
      if (newStatus === 'Completada') {
        updateData.fecha_completado = new Date().toISOString();
      }

      const runUpdateStatus = () => supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      const { data, error } = await withTimeout(runUpdateStatus(), 15000, 'Tiempo de espera agotado al actualizar estado');

      if (error) {
        console.error('❌ Error al actualizar estado:', error);
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
   * Enviar campaña inmediatamente usando Edge Function
   * ✅ MANTIENE TU VERSIÓN OPTIMIZADA
   */
  async sendNow(campaignId) {
    try {
      console.log('🚀 [sendNow] Iniciando envío de campaña:', campaignId);

      if (!campaignId) {
        throw new Error('ID de campaña es requerido');
      }

      console.log('📡 [sendNow] Llamando a Edge Function...');

      const invokePromise = supabase.functions.invoke('send-sms', {
        body: { campaignId: campaignId }
      });

      const timeoutMs = 45000;
      const { data, error } = await Promise.race([
        invokePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`timeout_after_${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      console.log('📥 [sendNow] Respuesta de Edge Function:', { data, error });

      if (error) {
        console.error('❌ [sendNow] Error de Edge Function:', error);
        
        if (error.message?.includes('FunctionsHttpError')) {
          throw new Error('La función de envío no está disponible. Verifica que esté desplegada en Supabase.');
        }
        
        if (error.message?.includes('timeout')) {
          throw new Error('El envío está tomando más tiempo del esperado. La campaña continuará en segundo plano.');
        }

        throw new Error(error.message || 'Error desconocido al enviar campaña');
      }

      if (!data) {
        throw new Error('No se recibió respuesta de la función de envío');
      }

      console.log('✅ [sendNow] Campaña procesada exitosamente:', data);

      if (data.queued === true) {
        return {
          success: true,
          data: data,
          mensaje: `Envío iniciado (${data.procesados || 0} mensajes en cola). Actualiza en unos segundos.`
        };
      }

      return {
        success: true,
        data: data,
        mensaje: `${data.enviados || 0} mensajes enviados, ${data.entregados || 0} entregados, ${data.fallidos || 0} fallidos`
      };

    } catch (error) {
      console.error('💥 [sendNow] Error general:', error);

      if (String(error?.message || '').includes('timeout_after_')) {
        return {
          success: true,
          data: { queued: true },
          mensaje: 'Envío iniciado. Está tardando más de lo normal; revisa el progreso en unos segundos.'
        };
      }

      return {
        success: false,
        error: error.message || 'Error desconocido al enviar campaña',
        detalles: error
      };
    }
  },

  /**
   * Obtener estadísticas de campañas
   * ✅ OPTIMIZADO: Sin consultas recursivas
   */
  async getStats(hospitalId) {
    try {
      console.log('📈 Obteniendo estadísticas de campañas');
      
      const { data, error } = await supabase
        .from('campaigns')
        .select('estado, destinatarios, enviados, entregados, fallidos')
        .eq('hospital_id', hospitalId);

      if (error) {
        // Si hay error de recursión, retornar stats vacías
        if (error.message?.includes('infinite recursion')) {
          console.warn('⚠️ Error de recursión, retornando stats vacías');
          return {
            success: true,
            data: {
              total: 0,
              programadas: 0,
              activas: 0,
              completadas: 0,
              totalDestinatarios: 0,
              totalEnviados: 0,
              totalEntregados: 0,
              totalFallidos: 0,
              tasaExito: '0.00'
            }
          };
        }
        throw error;
      }

      const stats = {
        total: data?.length || 0,
        programadas: data?.filter(c => c.estado === 'Programada').length || 0,
        activas: data?.filter(c => c.estado === 'Activa').length || 0,
        completadas: data?.filter(c => c.estado === 'Completada').length || 0,
        totalDestinatarios: data?.reduce((sum, c) => sum + (c.destinatarios || 0), 0) || 0,
        totalEnviados: data?.reduce((sum, c) => sum + (c.enviados || 0), 0) || 0,
        totalEntregados: data?.reduce((sum, c) => sum + (c.entregados || 0), 0) || 0,
        totalFallidos: data?.reduce((sum, c) => sum + (c.fallidos || 0), 0) || 0,
        tasaExito: '0.00'
      };

      if (stats.totalEnviados > 0) {
        stats.tasaExito = ((stats.totalEntregados / stats.totalEnviados) * 100).toFixed(2);
      }

      console.log('✅ Estadísticas calculadas:', stats);
      return { success: true, data: stats };
    } catch (error) {
      console.error('💥 Error en getStats:', error);
      return { 
        success: false, 
        error: error.message,
        data: {
          total: 0,
          programadas: 0,
          activas: 0,
          completadas: 0,
          totalDestinatarios: 0,
          totalEnviados: 0,
          totalEntregados: 0,
          totalFallidos: 0,
          tasaExito: '0.00'
        }
      };
    }
  },

  /**
   * Obtener campañas programadas para hoy
   */
  async getScheduledForToday(hospitalId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('hospital_id', hospitalId)
        .eq('estado', 'Programada')
        .eq('fecha_programada', today)
        .order('hora_programada', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('💥 Error en getScheduledForToday:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
};
