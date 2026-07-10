import { supabase } from '../lib/supabase.js'
import { isSupabaseAuthError, withTimeout } from '@/lib/utils';
export const hospitalService = {
  // Registrar o actualizar hospital cuando hace login
  async registerOrUpdate(hospitalData) {
    try {
      const { email, name, city, address } = hospitalData;

      // Verificar si el hospital ya existe
      const { data: existing, error: checkError } = await supabase
        .from('hospitals')
        .select('*')
        .eq('email', email)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (hospital no existe)
        console.error('Error checking hospital:', checkError);
        return { success: false, error: checkError.message };
      }

      if (existing) {
        // Hospital ya existe, actualizar última conexión
        const { data, error } = await supabase
          .from('hospitals')
          .update({ 
            updated_at: new Date().toISOString(),
            name: name || existing.name,
            city: city || existing.city,
            address: address || existing.address
          })
          .eq('email', email)
          .select()
          .single();

        if (error) {
          console.error('Error updating hospital:', error);
          return { success: false, error: error.message };
        }

        console.log('✅ Hospital actualizado:', data);
        return { success: true, data, isNew: false };
      } else {
        // Registrar nuevo hospital
        const { data, error } = await supabase
          .from('hospitals')
          .insert([{
            email,
            name: name || email.split('@')[1].split('.')[0], // Extraer nombre del dominio
            city: city || 'No especificado',
            address: address || 'No especificado'
          }])
          .select()
          .single();

        if (error) {
          console.error('Error creating hospital:', error);
          return { success: false, error: error.message };
        }

        console.log('✅ Nuevo hospital registrado:', data);
        return { success: true, data, isNew: true };
      }
    } catch (error) {
      console.error('Error in registerOrUpdate:', error);
      return { success: false, error: error.message };
    }
  },

  async getById(hospitalId) {
    try {
      const makeQuery = () => supabase
        .from('hospitals')
        .select('*')
        .eq('hospital_id', hospitalId)
        .single();

      const run = async () => withTimeout(makeQuery(), 12000, 'Tiempo de espera agotado al cargar hospital');
      let { data, error } = await run();
      if (error && isSupabaseAuthError(error)) {
        await supabase.auth.refreshSession().catch(() => null);
        ({ data, error } = await run());
      }

      if (error) {
        console.error('Error fetching hospital:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error in getById:', error);
      return { success: false, error: error.message };
    }
  },

  async getAll() {
    try {
      const makeQuery = () => supabase
        .from('hospitals')
        .select('*')
        .order('created_at', { ascending: false });

      const run = async () => withTimeout(makeQuery(), 12000, 'Tiempo de espera agotado al cargar hospitales');
      let { data, error } = await run();
      if (error && isSupabaseAuthError(error)) {
        await supabase.auth.refreshSession().catch(() => null);
        ({ data, error } = await run());
      }

      if (error) {
        console.error('Error fetching hospitals:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error in getAll:', error);
      return { success: false, error: error.message };
    }
  }
};
