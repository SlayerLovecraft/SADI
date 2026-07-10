import { supabase } from '@/lib/supabase';
import { isSupabaseAuthError, withTimeout } from '@/lib/utils';

const mapSupabaseToFrontend = (doctor) => ({
  id: doctor.doctor_id,
  doctor_id: doctor.doctor_id,
  nombre: doctor.doctor_name || '',
  email: doctor.doctor_email || '',
  especialidad: doctor.doctor_specialty || '',
  hospitalId: doctor.hospital_id || null,
  is_active: doctor.is_active,
  created_at: doctor.created_at,
  updated_at: doctor.updated_at,
});

const getCurrentUserContext = () => {
  try {
    const raw = localStorage.getItem('sadi_user');
    if (!raw) return { role: null, hospitalId: null };
    const user = JSON.parse(raw);
    return { role: user?.role || null, hospitalId: user?.hospitalId || null };
  } catch {
    return { role: null, hospitalId: null };
  }
};

export const staffService = {
  async getAll() {
    try {
      const { role, hospitalId } = getCurrentUserContext();

      const makeQuery = () => {
        let query = supabase
          .from('staff')
          .select('doctor_id, doctor_name, doctor_email, doctor_specialty, hospital_id, is_active, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (role !== 'super_admin') {
          if (!hospitalId) {
            return null;
          }
          query = query.eq('hospital_id', hospitalId);
        }

        return query;
      };

      const query = makeQuery();
      if (!query) return { success: false, error: 'No se pudo identificar el hospital del usuario', data: [] };

      const run = async () => withTimeout(makeQuery(), 12000, 'Tiempo de espera agotado al cargar doctores');
      let { data, error } = await run();
      if (error && isSupabaseAuthError(error)) {
        await supabase.auth.refreshSession().catch(() => null);
        ({ data, error } = await run());
      }

      if (error) return { success: false, error: error.message, data: [] };

      return { success: true, data: (data || []).map(mapSupabaseToFrontend) };
    } catch (error) {
      return { success: false, error: error?.message || 'Error obteniendo doctores', data: [] };
    }
  },

  async createBulk(doctors, options = {}) {
    try {
      const { role, hospitalId } = getCurrentUserContext();
      const insertHospitalId = role === 'super_admin' ? null : hospitalId;

      if (role !== 'super_admin' && !insertHospitalId) {
        return {
          success: false,
          error: 'No se pudo identificar el hospital',
          successCount: 0,
          data: [],
          failed: [],
        };
      }

      const batchSize = options.batchSize || 50;

      const supabaseDoctors = (doctors || []).map((d) => ({
        doctor_name: d?.nombre ? String(d.nombre) : null,
        doctor_email: String(d?.email || '').trim().toLowerCase(),
        doctor_password: String(d?.password || ''),
        doctor_specialty: String(d?.especialidad || '').trim().toLowerCase(),
        hospital_id: role === 'super_admin' ? (d?.hospitalId || null) : insertHospitalId,
        is_active: d?.is_active ?? true,
      }));

      const results = {
        success: true,
        successCount: 0,
        data: [],
        failed: [],
      };

      for (let start = 0; start < supabaseDoctors.length; start += batchSize) {
        const batch = supabaseDoctors.slice(start, start + batchSize);
        const originalIndexes = Array.from({ length: batch.length }, (_, i) => start + i);

        const { data, error } = await supabase
          .from('staff')
          .insert(batch)
          .select('doctor_id, doctor_name, doctor_email, doctor_specialty, hospital_id, is_active, created_at, updated_at');

        if (!error && data) {
          results.successCount += data.length;
          results.data.push(...(data || []).map(mapSupabaseToFrontend));
          if (typeof options.onProgress === 'function') {
            options.onProgress(Math.min(start + batch.length, supabaseDoctors.length), supabaseDoctors.length);
          }
          continue;
        }

        for (let j = 0; j < batch.length; j++) {
          const idx = originalIndexes[j];
          const row = batch[j];

          try {
            const { data: rowData, error: rowError } = await supabase
              .from('staff')
              .insert([row])
              .select('doctor_id, doctor_name, doctor_email, doctor_specialty, hospital_id, is_active, created_at, updated_at');

            if (rowError || !rowData?.[0]) {
              results.failed.push({
                index: idx,
                doctor: doctors[idx],
                error: rowError?.message || 'Error desconocido',
              });
            } else {
              results.successCount += 1;
              results.data.push(mapSupabaseToFrontend(rowData[0]));
            }
          } catch (e) {
            results.failed.push({
              index: idx,
              doctor: doctors[idx],
              error: e?.message || 'Error desconocido',
            });
          }

          if (typeof options.onProgress === 'function') {
            options.onProgress(Math.min(start + j + 1, supabaseDoctors.length), supabaseDoctors.length);
          }
        }
      }

      if (results.failed.length > 0) {
        return {
          success: false,
          successCount: results.successCount,
          data: results.data,
          failed: results.failed,
          error: `${results.failed.length} filas fallaron`,
        };
      }

      return {
        success: true,
        successCount: results.successCount,
        data: results.data,
        failed: [],
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Error en carga masiva',
        successCount: 0,
        data: [],
        failed: [],
      };
    }
  },

  async create(doctor) {
    try {
      const { role, hospitalId } = getCurrentUserContext();

      const insertHospitalId = role === 'super_admin' ? doctor?.hospitalId || null : hospitalId;
      if (role !== 'super_admin' && !insertHospitalId) {
        return { success: false, error: 'No se pudo identificar el hospital. Inicie sesión nuevamente.' };
      }

      const payload = {
        doctor_name: doctor?.nombre ? String(doctor.nombre) : null,
        doctor_email: String(doctor?.email || '').trim().toLowerCase(),
        doctor_password: String(doctor?.password || ''),
        doctor_specialty: String(doctor?.especialidad || '').trim().toLowerCase(),
        hospital_id: insertHospitalId,
        is_active: doctor?.is_active ?? true,
      };

      if (!payload.doctor_email || !payload.doctor_password || !payload.doctor_specialty) {
        return { success: false, error: 'Email, contraseña y especialidad son obligatorios' };
      }

      const { data, error } = await supabase
        .from('staff')
        .insert([payload])
        .select('doctor_id, doctor_name, doctor_email, doctor_specialty, hospital_id, is_active, created_at, updated_at')
        .single();

      if (error) return { success: false, error: error.message };

      return { success: true, data: mapSupabaseToFrontend(data) };
    } catch (error) {
      return { success: false, error: error?.message || 'Error creando doctor' };
    }
  },

  async update(doctorId, changes) {
    try {
      const { role, hospitalId } = getCurrentUserContext();
      const id = String(doctorId || '').trim();
      if (!id) return { success: false, error: 'ID de doctor inválido' };

      const payload = {};
      if (changes?.nombre !== undefined) payload.doctor_name = changes.nombre ? String(changes.nombre) : null;
      if (changes?.email) payload.doctor_email = String(changes.email).trim().toLowerCase();
      if (changes?.especialidad) payload.doctor_specialty = String(changes.especialidad).trim().toLowerCase();
      if (changes?.password) payload.doctor_password = String(changes.password);
      if (changes?.is_active !== undefined) payload.is_active = Boolean(changes.is_active);
      payload.updated_at = new Date().toISOString();

      let query = supabase.from('staff').update(payload).eq('doctor_id', id);
      if (role !== 'super_admin') {
        if (!hospitalId) return { success: false, error: 'No se pudo identificar el hospital del usuario' };
        query = query.eq('hospital_id', hospitalId);
      }

      const { data, error } = await query
        .select('doctor_id, doctor_name, doctor_email, doctor_specialty, hospital_id, is_active, created_at, updated_at')
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, data: mapSupabaseToFrontend(data) };
    } catch (error) {
      return { success: false, error: error?.message || 'Error actualizando doctor' };
    }
  },

  async delete(doctorId) {
    try {
      const { role, hospitalId } = getCurrentUserContext();
      const id = String(doctorId || '').trim();
      if (!id) return { success: false, error: 'ID de doctor inválido' };

      let query = supabase.from('staff').delete().eq('doctor_id', id);
      if (role !== 'super_admin') {
        if (!hospitalId) return { success: false, error: 'No se pudo identificar el hospital del usuario' };
        query = query.eq('hospital_id', hospitalId);
      }

      const runDelete = () => query;
      const { error } = await withTimeout(runDelete(), 15000, 'Tiempo de espera agotado al eliminar doctor');
      
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Error eliminando doctor' };
    }
  },
};
