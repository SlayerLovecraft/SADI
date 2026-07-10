// src/services/templateService.js
import { supabase } from '@/lib/supabase.js';
import { isSupabaseAuthError, withTimeout } from '@/lib/utils';

export const templateService = {
  /**
   * Obtener todas las plantillas de un hospital
   */
  async getAll(hospitalId) {
    try {
      console.log('📊 Obteniendo plantillas para hospital:', hospitalId);
      
      const makeQuery = () => {
        let query = supabase
          .from('templates')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (hospitalId) {
          query = query.eq('hospital_id', hospitalId);
        }

        return query;
      };

      const run = async () => withTimeout(makeQuery(), 12000, 'Tiempo de espera agotado al cargar plantillas');
      let { data, error } = await run();
      if (error && isSupabaseAuthError(error)) {
        await supabase.auth.refreshSession().catch(() => null);
        ({ data, error } = await run());
      }

      if (error) {
        console.error('❌ Error obteniendo plantillas:', error);
        throw error;
      }

      console.log('✅ Plantillas obtenidas:', data?.length || 0);
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('💥 Error en getAll:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Obtener una plantilla por ID
   */
  async getById(id) {
    try {
      console.log('🔍 Obteniendo plantilla:', id);
      
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Error obteniendo plantilla:', error);
        throw error;
      }

      console.log('✅ Plantilla encontrada:', data.nombre);
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en getById:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Crear una nueva plantilla
   */
  async create(templateData) {
    try {
      console.log('📝 Creando nueva plantilla:', templateData);
      
      // Validar datos requeridos
      if (!templateData.hospitalId) {
        throw new Error('hospitalId es requerido');
      }
      if (!templateData.nombre) {
        throw new Error('nombre es requerido');
      }
      if (!templateData.mensaje) {
        throw new Error('mensaje es requerido');
      }

      // Validar longitud del mensaje (SMS estándar es 160 caracteres)
      if (templateData.mensaje.length > 160) {
        console.warn('⚠️ Mensaje excede 160 caracteres, se enviará como SMS largo');
      }

      // Preparar datos para insertar
      const insertData = {
        nombre: templateData.nombre,
        mensaje: templateData.mensaje,
        categoria: templateData.categoria || 'General',
        variables: templateData.variables || [],
        hospital_id: templateData.hospitalId
      };

      console.log('📤 Datos a insertar:', insertData);

      const run = async () => withTimeout(
        supabase
          .from('templates')
          .insert([insertData])
          .select()
          .single(),
        10000,
        'Tiempo de espera agotado al crear plantilla'
      );

      const { data, error } = await run();

      if (error) {
        console.error('❌ Error al crear plantilla:', error);
        throw error;
      }

      console.log('✅ Plantilla creada exitosamente:', data);
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
          error: 'No tienes permisos para crear plantillas. Contacta al administrador.' 
        };
      }

      return { success: false, error: error.message };
    }
  },

  /**
   * Actualizar una plantilla existente
   */
  async update(id, templateData) {
    try {
      console.log('✏️ Actualizando plantilla:', id);
      
      const updateData = {
        nombre: templateData.nombre,
        mensaje: templateData.mensaje,
        categoria: templateData.categoria || 'General',
        variables: templateData.variables || [],
        updated_at: new Date().toISOString()
      };

      // Validar longitud del mensaje
      if (updateData.mensaje && updateData.mensaje.length > 160) {
        console.warn('⚠️ Mensaje excede 160 caracteres, se enviará como SMS largo');
      }

      console.log('📤 Datos a actualizar:', updateData);

      const run = async () => withTimeout(
        supabase
          .from('templates')
          .update(updateData)
          .eq('id', id)
          .select()
          .single(),
        10000,
        'Tiempo de espera agotado al actualizar plantilla'
      );

      const { data, error } = await run();

      if (error) {
        console.error('❌ Error al actualizar plantilla:', error);
        throw error;
      }

      console.log('✅ Plantilla actualizada exitosamente');
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en update:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Eliminar una plantilla
   */
  async delete(id) {
    try {
      console.log('🗑️ Eliminando plantilla:', id);
      
      // Verificar si la plantilla está siendo usada en campañas
      const { data: campaigns, error: checkError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('template_id', id)
        .limit(1);

      if (checkError) {
        console.error('❌ Error verificando uso de plantilla:', checkError);
      }

      if (campaigns && campaigns.length > 0) {
        console.warn('⚠️ La plantilla está siendo usada en campañas');
        return { 
          success: false, 
          error: 'No se puede eliminar. Esta plantilla está siendo usada en campañas activas.' 
        };
      }

      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error al eliminar plantilla:', error);
        throw error;
      }

      console.log('✅ Plantilla eliminada exitosamente');
      return { success: true };
    } catch (error) {
      console.error('💥 Error en delete:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Obtener plantillas por categoría
   */
  async getByCategory(hospitalId, categoria) {
    try {
      console.log('🔍 Obteniendo plantillas por categoría:', categoria);
      
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('hospital_id', hospitalId)
        .eq('categoria', categoria)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('✅ Plantillas encontradas:', data?.length || 0);
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('💥 Error en getByCategory:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Duplicar una plantilla
   */
  async duplicate(id, newName) {
    try {
      console.log('📋 Duplicando plantilla:', id);
      
      // Obtener plantilla original
      const { data: original, error: fetchError } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Crear nueva plantilla con datos duplicados
      const duplicateData = {
        nombre: newName || `${original.nombre} (Copia)`,
        mensaje: original.mensaje,
        categoria: original.categoria,
        variables: original.variables,
        hospital_id: original.hospital_id
      };

      const run = async () => withTimeout(
        supabase
          .from('templates')
          .insert([duplicateData])
          .select()
          .single(),
        10000,
        'Tiempo de espera agotado al duplicar plantilla'
      );

      const { data, error } = await run();

      if (error) throw error;

      console.log('✅ Plantilla duplicada exitosamente');
      return { success: true, data };
    } catch (error) {
      console.error('💥 Error en duplicate:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Previsualizar mensaje con variables reemplazadas
   */
  previewMessage(template, variables) {
    try {
      let mensaje = template.mensaje;

      // Reemplazar variables en el formato {{variable}} o {variable}
      if (variables) {
        Object.keys(variables).forEach(key => {
          const regex = new RegExp(`\\{+${key}\\}+`, 'g');
          mensaje = mensaje.replace(regex, variables[key] || '');
        });
      }

      return { success: true, preview: mensaje };
    } catch (error) {
      console.error('💥 Error en previewMessage:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Extraer variables del mensaje
   */
  extractVariables(mensaje) {
    try {
      // Buscar todas las variables en formato {{variable}} o {variable}
      const regex = /\{+([^}]+)\}+/g;
      const matches = mensaje.match(regex) || [];
      
      const variables = matches.map(match => 
        match.replace(/[{}]/g, '').trim()
      );

      // Eliminar duplicados
      const uniqueVariables = [...new Set(variables)];

      return { success: true, variables: uniqueVariables };
    } catch (error) {
      console.error('💥 Error en extractVariables:', error);
      return { success: false, error: error.message, variables: [] };
    }
  },

  /**
   * Validar plantilla
   */
  validate(templateData) {
    const errors = [];

    if (!templateData.nombre || templateData.nombre.trim() === '') {
      errors.push('El nombre es requerido');
    }

    if (!templateData.mensaje || templateData.mensaje.trim() === '') {
      errors.push('El mensaje es requerido');
    }

    if (templateData.mensaje && templateData.mensaje.length > 320) {
      errors.push('El mensaje es demasiado largo (máximo 320 caracteres para SMS doble)');
    }

    /*
    // Validación de formato de variables deshabilitada temporalmente para evitar falsos positivos
    // El usuario debe verificar en la previsualización que las variables se reemplacen correctamente
    if (templateData.mensaje) {
      const cleanMsg = templateData.mensaje.replace(/{{[^}]+}}/g, '');
      
      if (cleanMsg.includes('{') || cleanMsg.includes('}')) {
        // errors.push('Formato de variables inválido. Use {{variable}} y asegúrese de cerrar todas las llaves.');
        console.warn('Posible error de formato en variables detectado, pero se permite guardar:', cleanMsg);
      }
    }
    */

    return {
      valid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * Obtener estadísticas de uso de plantillas
   */
  async getUsageStats(hospitalId) {
    try {
      console.log('📈 Obteniendo estadísticas de uso de plantillas');
      
      // Obtener todas las plantillas del hospital
      const { data: templates, error: templatesError } = await supabase
        .from('templates')
        .select('id, nombre')
        .eq('hospital_id', hospitalId);

      if (templatesError) throw templatesError;

      // Obtener conteo de campañas por plantilla
      const stats = await Promise.all(
        templates.map(async (template) => {
          const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('id, estado')
            .eq('template_id', template.id);

          if (error) {
            console.error('Error obteniendo campañas para plantilla:', template.id);
            return {
              templateId: template.id,
              templateName: template.nombre,
              totalCampaigns: 0,
              activeCampaigns: 0
            };
          }

          return {
            templateId: template.id,
            templateName: template.nombre,
            totalCampaigns: campaigns.length,
            activeCampaigns: campaigns.filter(c => 
              c.estado === 'Activa' || c.estado === 'Programada'
            ).length
          };
        })
      );

      console.log('✅ Estadísticas calculadas');
      return { success: true, data: stats };
    } catch (error) {
      console.error('💥 Error en getUsageStats:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
};
