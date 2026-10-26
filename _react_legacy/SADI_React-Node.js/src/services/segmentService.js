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
        edad_min: segmentData.edadMin || null,
        edad_max: segmentData.edadMax || null,
        sexo: segmentData.sexo || 'Todos',
        ciudad: segmentData.ciudad || null,
        programa: segmentData.programa || null,
        hospital_id: segmentData.hospitalId
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
        edad_min: segmentData.edadMin || null,
        edad_max: segmentData.edadMax || null,
        sexo: segmentData.sexo || 'Todos',
        ciudad: segmentData.ciudad || null,
        programa: segmentData.programa || null,
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
   * Obtener pacientes que coinciden con un segmento
   * OPTIMIZADO para la estructura real de la tabla patients
   */
  async getPatientsInSegment(segmentId) {
    try {
      console.log('👥 Obteniendo pacientes del segmento:', segmentId);
      
      // Primero obtener el segmento
      const { data: segment, error: segmentError } = await supabase
        .from('segments')
        .select('*')
        .eq('id', segmentId)
        .single();

      if (segmentError) {
        console.error('❌ Error obteniendo segmento:', segmentError);
        throw segmentError;
      }

      console.log('📋 Segmento a filtrar:', segment);

      // Obtener TODOS los pacientes del hospital
      const runPatients = async () => withTimeout(
        supabase
          .from('patients')
          .select('patient_id, name, document, phone, email, birthdate, sex, city, program, hospital_id')
          .eq('hospital_id', segment.hospital_id),
        20000, // Mayor timeout para pacientes
        'Tiempo de espera agotado al obtener pacientes para segmento'
      );

      const { data: allPatients, error: patientsError } = await runPatients();

      if (patientsError) {
        console.error('❌ Error obteniendo pacientes:', patientsError);
        throw patientsError;
      }

      console.log('📊 Total pacientes del hospital:', allPatients?.length || 0);

      // Filtrar pacientes en JavaScript según los criterios del segmento
      let filteredPatients = allPatients || [];

      // FILTRO DE EDAD (calculada desde birthdate)
      if (segment.edad_min !== null || segment.edad_max !== null) {
        filteredPatients = filteredPatients.filter(patient => {
          if (!patient.birthdate) return false;
          
          // Calcular edad desde birthdate
          const birthDate = new Date(patient.birthdate);
          const today = new Date();
          let edad = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            edad--;
          }

          // Aplicar filtros de edad
          if (segment.edad_min !== null && edad < segment.edad_min) return false;
          if (segment.edad_max !== null && edad > segment.edad_max) return false;
          
          return true;
        });
        console.log(`🔍 Después de filtro edad (${segment.edad_min}-${segment.edad_max}):`, filteredPatients.length);
      }

      // FILTRO DE SEXO
      if (segment.sexo && segment.sexo !== 'Todos') {
        filteredPatients = filteredPatients.filter(patient => {
          if (!patient.sex) return false;
          
          const sexoNormalizado = patient.sex.toLowerCase().trim();
          const filtroNormalizado = segment.sexo.toLowerCase().trim();
          
          return sexoNormalizado === filtroNormalizado ||
                 (filtroNormalizado === 'masculino' && sexoNormalizado === 'masculino') ||
                 (filtroNormalizado === 'femenino' && sexoNormalizado === 'femenino') ||
                 (filtroNormalizado === 'm' && sexoNormalizado === 'masculino') ||
                 (filtroNormalizado === 'f' && sexoNormalizado === 'femenino');
        });
        console.log(`🔍 Después de filtro sexo (${segment.sexo}):`, filteredPatients.length);
      }

      // FILTRO DE CIUDAD
      if (segment.ciudad) {
        filteredPatients = filteredPatients.filter(patient => {
          if (!patient.city) return false;
          return patient.city.toLowerCase().trim() === segment.ciudad.toLowerCase().trim();
        });
        console.log(`🔍 Después de filtro ciudad (${segment.ciudad}):`, filteredPatients.length);
      }

      // FILTRO DE PROGRAMA
      if (segment.programa) {
        filteredPatients = filteredPatients.filter(patient => {
          if (!patient.program) return false;
          return patient.program.toLowerCase().trim() === segment.programa.toLowerCase().trim();
        });
        console.log(`🔍 Después de filtro programa (${segment.programa}):`, filteredPatients.length);
      }

      console.log('✅ Pacientes filtrados encontrados:', filteredPatients.length);
      
      // Agregar campo edad calculado para uso posterior
      const patientsWithAge = filteredPatients.map(patient => {
        let edad = null;
        if (patient.birthdate) {
          const birthDate = new Date(patient.birthdate);
          const today = new Date();
          edad = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            edad--;
          }
        }
        return { ...patient, edad };
      });

      return { success: true, data: patientsWithAge };

    } catch (error) {
      console.error('💥 Error en getPatientsInSegment:', error);
      
      // Fallback: devolver todos los pacientes del hospital
      try {
        const { data: segment } = await supabase
          .from('segments')
          .select('hospital_id')
          .eq('id', segmentId)
          .single();

        if (segment) {
          const { data: allPatients } = await supabase
            .from('patients')
            .select('*')
            .eq('hospital_id', segment.hospital_id);

          console.warn('⚠️ Devolviendo todos los pacientes del hospital debido a error en filtros');
          return { 
            success: true, 
            data: allPatients || [],
            warning: 'No se pudieron aplicar todos los filtros del segmento'
          };
        }
      } catch (fallbackError) {
        console.error('💥 Error en fallback:', fallbackError);
      }

      return { success: false, error: error.message, data: [] };
    }
  }
};
