// src/services/segmentService.js
import { supabase } from '@/lib/supabase.js';
import { isSupabaseAuthError, withTimeout } from '@/lib/utils';

export const segmentService = {
  async getAll(hospitalId) {
    try {
      console.log('📊 Obteniendo todos los segmentos para hospital:', hospitalId);
      
      const makeQuery = () => {
        let query = supabase
          .from('segments')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (hospitalId) {
          query = query.eq('hospital_id', hospitalId);
        }

        return query;
      };

      const run = async () => withTimeout(makeQuery(), 12000, 'Tiempo de espera agotado al cargar segmentos');
      let { data, error } = await run();
      if (error && isSupabaseAuthError(error)) {
        await supabase.auth.refreshSession().catch(() => null);
        ({ data, error } = await run());
      }

      if (error) {
        console.error('❌ Error obteniendo segmentos:', error);
        throw error;
      }

      console.log('✅ Segmentos obtenidos:', data?.length || 0);
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('💥 Error en getAll:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  async getById(id) {
    try {
      console.log('🔍 Obteniendo segmento:', id);
      
      const { data, error } = await supabase
        .from('segments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Error obteniendo segmento:', error);
        throw error;
      }

      console.log('✅ Segmento encontrado:', data.nombre);
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en getById:', error);
      return { success: false, error: error.message };
    }
  },

  async create(segmentData) {
    try {
      console.log('📝 Creando nuevo segmento:', segmentData);
      
      // Validar que tengamos hospital_id
      if (!segmentData.hospitalId) {
        throw new Error('hospitalId es requerido');
      }

      // Preparar datos para insertar
      const insertData = {
        nombre: segmentData.nombre,
        edad_min: segmentData.edadMin !== undefined ? segmentData.edadMin : null,
        edad_max: segmentData.edadMax !== undefined ? segmentData.edadMax : null,
        sexo: segmentData.sexo || 'Todos',
        ciudad: segmentData.ciudad || null,
        programa: segmentData.programa || null,
        hospital_id: segmentData.hospitalId,
        curso_vida: segmentData.cursoVida || null,
        edad_tipo: segmentData.edadTipo || 'cualquiera',
        edad_custom: segmentData.edadCustom || null
      };

      console.log('📤 Datos a insertar:', insertData);

      const run = async () => withTimeout(
        supabase
          .from('segments')
          .insert([insertData])
          .select()
          .single(),
        10000,
        'Tiempo de espera agotado al crear segmento'
      );

      const { data, error } = await run();

      if (error) {
        console.error('❌ Error al crear segmento:', error);
        throw error;
      }

      console.log('✅ Segmento creado exitosamente:', data);
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en create:', error);
      
      // Manejar errores específicos
      if (error.message.includes('infinite recursion')) {
        return { 
          success: false, 
          error: 'Error de permisos en la base de datos. Verifica las políticas RLS.' 
        };
      }
      
      if (error.code === '42501') {
        return { 
          success: false, 
          error: 'No tienes permisos para crear segmentos. Ejecuta el SQL `SQLs/fix_permissions_v2.sql` en Supabase.' 
        };
      }

      return { success: false, error: error.message };
    }
  },

  async update(id, segmentData) {
    try {
      console.log('✏️ Actualizando segmento:', id);
      
      const updateData = {
        nombre: segmentData.nombre,
        edad_min: segmentData.edadMin !== undefined ? segmentData.edadMin : null,
        edad_max: segmentData.edadMax !== undefined ? segmentData.edadMax : null,
        sexo: segmentData.sexo || 'Todos',
        ciudad: segmentData.ciudad || null,
        programa: segmentData.programa || null,
        curso_vida: segmentData.cursoVida || null,
        edad_tipo: segmentData.edadTipo || 'cualquiera',
        edad_custom: segmentData.edadCustom || null,
        updated_at: new Date().toISOString()
      };

      console.log('📤 Datos a actualizar:', updateData);

      const run = async () => withTimeout(
        supabase
          .from('segments')
          .update(updateData)
          .eq('id', id)
          .select()
          .single(),
        10000,
        'Tiempo de espera agotado al actualizar segmento'
      );

      const { data, error } = await run();

      if (error) {
        console.error('❌ Error al actualizar segmento:', error);
        throw error;
      }

      console.log('✅ Segmento actualizado exitosamente');
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en update:', error);
      return { success: false, error: error.message };
    }
  },

  async delete(id) {
    try {
      console.log('🗑️ Eliminando segmento:', id);
      
      const run = async () => withTimeout(
        supabase
          .from('segments')
          .delete()
          .eq('id', id),
        10000,
        'Tiempo de espera agotado al eliminar segmento'
      );

      const { error } = await run();

      if (error) {
        console.error('❌ Error al eliminar segmento:', error);
        throw error;
      }

      console.log('✅ Segmento eliminado exitosamente');
      return { success: true };
    } catch (error) {
      console.error('💥 Error en delete:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Evalúa los conteos reales de todos los segmentos del hospital sobre el 100% de pacientes (142k+) en Postgres RPC
   */
  async evaluateAllCounts(hospitalId = null) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('evaluate_all_segments_counts', {
          p_hospital_id: hospitalId || null,
        }),
        20000,
        'Tiempo de espera agotado calculando tamaños de segmentos'
      );
      if (error) throw error;
      return { success: true, data: data || {} };
    } catch (error) {
      console.warn('Error calculando conteos de segmentos por RPC:', error);
      return { success: false, error: error?.message, data: {} };
    }
  },

  /**
   * Obtiene página real de pacientes de un segmento + total exacto + demografía en SQL
   */
  async getPatientsInSegmentPaginated(segmentId, page = 1, pageSize = 50, search = null) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('get_segment_patients_paginated', {
          p_segment_id: segmentId,
          p_page: Math.max(1, Number(page) || 1),
          p_page_size: Math.max(1, Math.min(1000, Number(pageSize) || 50)),
          p_search: search?.trim() || null,
        }),
        20000,
        'Tiempo de espera agotado consultando pacientes del segmento'
      );
      if (error || !data) throw error || new Error('Sin respuesta de get_segment_patients_paginated');
      return {
        success: true,
        totalCount: Number(data.total_count || 0),
        demografia: data.demografia || { hombres: 0, mujeres: 0, ninos: 0, ninas: 0 },
        data: Array.isArray(data.rows) ? data.rows : [],
      };
    } catch (error) {
      return { success: false, error: error?.message, totalCount: 0, demografia: { hombres: 0, mujeres: 0, ninos: 0, ninas: 0 }, data: [] };
    }
  },

  /**
   * Obtener TODOS los pacientes que coinciden con un segmento (sin tope de 1,000)
   */
  async getPatientsInSegment(segmentId) {
    try {
      const first = await this.getPatientsInSegmentPaginated(segmentId, 1, 1000, null);
      if (!first.success) throw new Error(first.error || 'Error obteniendo pacientes del segmento');
      const total = first.totalCount;
      const allRows = [...(first.data || [])];
      const totalPages = Math.ceil(total / 1000);
      for (let p = 2; p <= totalPages; p++) {
        const nextPage = await this.getPatientsInSegmentPaginated(segmentId, p, 1000, null);
        if (nextPage.success && Array.isArray(nextPage.data)) {
          allRows.push(...nextPage.data);
        }
      }
      return { success: true, data: allRows, totalCount: total, demografia: first.demografia };
    } catch (error) {
      console.error('💥 Error en getPatientsInSegment:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
};
