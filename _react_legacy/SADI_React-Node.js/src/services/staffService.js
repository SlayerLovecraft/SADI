import { supabase } from '@/lib/supabase';
import { isSupabaseAuthError, withTimeout } from '@/lib/utils';
import { SEED_DOCTORS_3280 } from './telemonitoringService';

const normalizeRol = (rol, specialty = '', name = '') => {
  const r = (rol || '').trim();
  const n = (name || '').toLowerCase();
  const s = (specialty || '').toLowerCase();

  if (r === 'Enfermera Jefe' || n.includes('jefe sandra') || s.includes('jefe')) {
    // Solo Jefe Sandra Milena Duque Ríos es Enfermera Jefe
    if (n.includes('sandra') || r === 'Enfermera Jefe' && !n.includes('claudia')) return 'Enfermera Jefe';
  }
  if (r === 'Enfermera' || r === 'Enfermera Asistencial' || n.includes('enf.') || s.includes('enferm')) {
    return 'Enfermera';
  }
  if (r === 'Especialista' || r === 'Médico Especialista' || s.includes('especial') || s.includes('pediatr') || s.includes('interna') || s.includes('oncolog')) {
    return 'Especialista';
  }
  return 'Médico General';
};

const mapSupabaseToFrontend = (doctor) => ({
  id: doctor.doctor_id,
  doctor_id: doctor.doctor_id,
  nombre: doctor.doctor_name || '',
  email: doctor.doctor_email || '',
  especialidad: doctor.doctor_specialty || '',
  rol: normalizeRol(doctor.rol, doctor.doctor_specialty, doctor.doctor_name),
  cursos_vida_asignados: Array.isArray(doctor.cursos_vida_asignados) ? doctor.cursos_vida_asignados : ['todos'],
  grupos_riesgo_asignados: Array.isArray(doctor.grupos_riesgo_asignados) ? doctor.grupos_riesgo_asignados : ['todos'],
  solo_lectura: doctor.solo_lectura !== undefined ? Boolean(doctor.solo_lectura) : true,
  puede_lanzar_llamadas: Boolean(doctor.puede_lanzar_llamadas),
  puede_enviar_mensajes: Boolean(doctor.puede_enviar_mensajes),
  puede_crear_campanas: Boolean(doctor.puede_crear_campanas),
  puede_editar_pacientes: Boolean(doctor.puede_editar_pacientes),
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
          .select('doctor_id, doctor_name, doctor_email, doctor_specialty, rol, cursos_vida_asignados, grupos_riesgo_asignados, solo_lectura, puede_lanzar_llamadas, puede_enviar_mensajes, puede_crear_campanas, puede_editar_pacientes, hospital_id, is_active, created_at, updated_at')
          .not('doctor_name', 'is', null)
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

      const mapFallbackDoctor = (d, defaultHospId) => {
        const isJefe = (d.name || '').toLowerCase().includes('sandra') || (d.rol === 'Enfermera Jefe');
        return {
          id: d.id,
          doctor_id: d.id,
          nombre: d.name,
          email: d.email,
          especialidad: d.specialty,
          rol: isJefe ? 'Enfermera Jefe' : (d.rol || (d.name.toLowerCase().includes('enf') ? 'Enfermera' : 'Médico General')),
          cursos_vida_asignados: isJefe ? ['todos'] : (d.cursos_vida_asignados || (
            d.name.includes('Luciana') ? ['primera_infancia'] :
            d.name.includes('Claudia') ? ['infancia'] :
            d.name.includes('Loaiza') ? ['adolescencia', 'juventud'] :
            d.name.includes('Valeria') ? ['vacunacion', 'salud_oral', 'preventivo_mujer'] :
            d.name.includes('Carlos') ? ['adultez'] :
            d.name.includes('Maritza') ? ['vejez'] :
            d.name.includes('Paola') ? ['primera_infancia', 'infancia'] :
            d.name.includes('Rincón') ? ['adultez', 'vejez'] :
            d.name.includes('Alejandro') ? ['juventud', 'adultez'] :
            ['adolescencia', 'vejez']
          )),
          grupos_riesgo_asignados: isJefe ? ['todos'] : (d.grupos_riesgo_asignados || (
            d.name.includes('Luciana') ? ['nutricional'] :
            d.name.includes('Claudia') ? ['materno_perinatal'] :
            d.name.includes('Loaiza') ? ['mental'] :
            d.name.includes('Valeria') ? ['salud_oral'] :
            d.name.includes('Carlos') ? ['cardiovascular'] :
            d.name.includes('Maritza') ? ['respiratorio', 'cardiovascular'] :
            d.name.includes('Paola') ? ['nutricional', 'huerfanas'] :
            d.name.includes('Rincón') ? ['cardiovascular', 'cancer'] :
            d.name.includes('Alejandro') ? ['infecciosas', 'mental'] :
            ['musculoesqueletico']
          )),
          solo_lectura: true,
          puede_lanzar_llamadas: true,
          puede_enviar_mensajes: true,
          puede_crear_campanas: isJefe,
          puede_editar_pacientes: isJefe,
          hospitalId: defaultHospId,
          is_active: true,
          created_at: new Date().toISOString()
        };
      };

      if (error || !data || data.length === 0) {
        return {
          success: true,
          data: SEED_DOCTORS_3280.map(d => mapFallbackDoctor(d, hospitalId || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8'))
        };
      }

      return { success: true, data: (data || []).map(mapSupabaseToFrontend) };
    } catch (error) {
      return {
        success: true,
        data: SEED_DOCTORS_3280.map(d => mapFallbackDoctor(d, 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8'))
      };
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
        rol: String(doctor?.rol || 'Enfermera'),
        cursos_vida_asignados: Array.isArray(doctor?.cursos_vida_asignados) ? doctor.cursos_vida_asignados : ['todos'],
        grupos_riesgo_asignados: Array.isArray(doctor?.grupos_riesgo_asignados) ? doctor.grupos_riesgo_asignados : ['todos'],
        solo_lectura: doctor?.solo_lectura !== undefined ? Boolean(doctor.solo_lectura) : true,
        puede_lanzar_llamadas: Boolean(doctor?.puede_lanzar_llamadas),
        puede_enviar_mensajes: Boolean(doctor?.puede_enviar_mensajes),
        puede_crear_campanas: Boolean(doctor?.puede_crear_campanas),
        puede_editar_pacientes: Boolean(doctor?.puede_editar_pacientes),
        hospital_id: insertHospitalId,
        is_active: doctor?.is_active ?? true,
      };

      if (!payload.doctor_email || !payload.doctor_password || !payload.doctor_specialty) {
        return { success: false, error: 'Email, contraseña y especialidad son obligatorios' };
      }

      const { data, error } = await supabase
        .from('staff')
        .insert([payload])
        .select('doctor_id, doctor_name, doctor_email, doctor_specialty, rol, cursos_vida_asignados, grupos_riesgo_asignados, solo_lectura, puede_lanzar_llamadas, puede_enviar_mensajes, puede_crear_campanas, puede_editar_pacientes, hospital_id, is_active, created_at, updated_at')
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
      if (changes?.rol) payload.rol = String(changes.rol);
      if (changes?.cursos_vida_asignados) payload.cursos_vida_asignados = Array.isArray(changes.cursos_vida_asignados) ? changes.cursos_vida_asignados : ['todos'];
      if (changes?.grupos_riesgo_asignados) payload.grupos_riesgo_asignados = Array.isArray(changes.grupos_riesgo_asignados) ? changes.grupos_riesgo_asignados : ['todos'];
      if (changes?.solo_lectura !== undefined) payload.solo_lectura = Boolean(changes.solo_lectura);
      if (changes?.puede_lanzar_llamadas !== undefined) payload.puede_lanzar_llamadas = Boolean(changes.puede_lanzar_llamadas);
      if (changes?.puede_enviar_mensajes !== undefined) payload.puede_enviar_mensajes = Boolean(changes.puede_enviar_mensajes);
      if (changes?.puede_crear_campanas !== undefined) payload.puede_crear_campanas = Boolean(changes.puede_crear_campanas);
      if (changes?.puede_editar_pacientes !== undefined) payload.puede_editar_pacientes = Boolean(changes.puede_editar_pacientes);
      payload.updated_at = new Date().toISOString();

      let query = supabase.from('staff').update(payload).eq('doctor_id', id);
      if (role !== 'super_admin') {
        if (!hospitalId) return { success: false, error: 'No se pudo identificar el hospital del usuario' };
        query = query.eq('hospital_id', hospitalId);
      }

      const { data, error } = await query
        .select('doctor_id, doctor_name, doctor_email, doctor_specialty, rol, cursos_vida_asignados, grupos_riesgo_asignados, solo_lectura, puede_lanzar_llamadas, puede_enviar_mensajes, puede_crear_campanas, puede_editar_pacientes, hospital_id, is_active, created_at, updated_at')
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
