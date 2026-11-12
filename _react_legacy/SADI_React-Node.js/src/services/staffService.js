import { supabase } from '@/lib/supabase';
import { runWithSupabaseAuthRecovery } from '@/lib/utils';
import { normalizeCursosArray } from './cursoVidaConfig';
import { SEED_DOCTORS_3280 } from './telemonitoringService';

const STAFF_SNAPSHOT_KEY = 'sadi_staff_snapshot_v1';

const saveStaffSnapshot = (staffList) => {
  try {
    if (typeof localStorage !== 'undefined' && Array.isArray(staffList) && staffList.length > 0) {
      localStorage.setItem(STAFF_SNAPSHOT_KEY, JSON.stringify(staffList));
    }
  } catch {
    // Ignore storage quota errors
  }
};

const loadStaffSnapshot = () => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STAFF_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const updateSnapshotAndActiveDoctor = (updatedStaff) => {
  try {
    if (typeof localStorage === 'undefined' || !updatedStaff) return;
    const current = loadStaffSnapshot();
    if (current) {
      const next = current.map((s) =>
        (s.id === updatedStaff.id || s.doctor_id === updatedStaff.doctor_id) ? { ...s, ...updatedStaff } : s
      );
      saveStaffSnapshot(next);
    }

    const rawUser = localStorage.getItem('sadi_user');
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser);
      const isSameDoctor =
        parsedUser?.role === 'doctor' &&
        (
          (parsedUser.doctor_id && parsedUser.doctor_id === updatedStaff.doctor_id) ||
          (parsedUser.id && parsedUser.id === updatedStaff.id) ||
          (parsedUser.email && updatedStaff.email && parsedUser.email.toLowerCase() === updatedStaff.email.toLowerCase())
        );
      if (isSameDoctor) {
        const merged = {
          ...parsedUser,
          nombre: updatedStaff.nombre || parsedUser.nombre,
          doctor_specialty: updatedStaff.especialidad || parsedUser.doctor_specialty,
          rol: updatedStaff.rol || parsedUser.rol,
          cursos_vida_asignados: updatedStaff.cursos_vida_asignados,
          solo_lectura: updatedStaff.solo_lectura,
          puede_lanzar_llamadas: updatedStaff.puede_lanzar_llamadas,
          puede_enviar_mensajes: updatedStaff.puede_enviar_mensajes,
          puede_crear_campanas: updatedStaff.puede_crear_campanas,
          puede_editar_pacientes: updatedStaff.puede_editar_pacientes,
        };
        localStorage.setItem('sadi_user', JSON.stringify(merged));
      }
    }
  } catch {
    // Ignore storage errors
  }
};

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
  cursos_vida_asignados: normalizeCursosArray(doctor.cursos_vida_asignados),
  grupos_riesgo_asignados: Array.isArray(doctor.grupos_riesgo_asignados) ? doctor.grupos_riesgo_asignados : [],
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
    const { role, hospitalId } = getCurrentUserContext();

    const mapFallbackDoctor = (d, defaultHospId) => ({
      id: d.id,
      doctor_id: d.id,
      nombre: d.name,
      email: d.email,
      especialidad: d.specialty,
      rol: d.rol || (d.name?.toLowerCase().includes('enf') ? 'Enfermera' : 'Médico General'),
      cursos_vida_asignados: normalizeCursosArray(d.cursos_vida_asignados),
      grupos_riesgo_asignados: [],
      solo_lectura: true,
      puede_lanzar_llamadas: true,
      puede_enviar_mensajes: true,
      puede_crear_campanas: false,
      puede_editar_pacientes: false,
      hospitalId: defaultHospId,
      is_active: true,
      created_at: new Date().toISOString()
    });

    try {
      // 1. Consulta principal directa a Supabase con recuperación automática de JWT expirado
      const { data: allStaff, error: allErr } = await runWithSupabaseAuthRecovery(
        supabase,
        () =>
          supabase
            .from('staff')
            .select('doctor_id, doctor_name, doctor_email, doctor_specialty, rol, cursos_vida_asignados, grupos_riesgo_asignados, solo_lectura, puede_lanzar_llamadas, puede_enviar_mensajes, puede_crear_campanas, puede_editar_pacientes, hospital_id, is_active, created_at, updated_at')
            .not('doctor_name', 'is', null)
            .order('created_at', { ascending: false }),
        15000,
        'Tiempo de espera agotado al consultar el personal'
      );

      if (!allErr && allStaff && allStaff.length > 0) {
        let mapped = allStaff.map(mapSupabaseToFrontend);
        if (role !== 'super_admin' && hospitalId && hospitalId !== 'a0000000-0000-0000-0000-000000000001') {
          const filteredByHosp = mapped.filter(s => s.hospitalId === hospitalId);
          if (filteredByHosp.length > 0) {
            mapped = filteredByHosp;
          }
        }
        saveStaffSnapshot(mapped);
        return { success: true, data: mapped };
      }

      const snapshot = loadStaffSnapshot();
      if (snapshot) {
        return {
          success: false,
          fromFallback: true,
          error: allErr?.message || 'No se pudo sincronizar con la base de datos',
          data: snapshot,
        };
      }

      return {
        success: false,
        fromFallback: true,
        error: allErr?.message || 'Base de datos no disponible',
        data: SEED_DOCTORS_3280.map(d => mapFallbackDoctor(d, hospitalId || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8')),
      };
    } catch (error) {
      const snapshot = loadStaffSnapshot();
      return {
        success: false,
        fromFallback: true,
        error: error?.message || 'Error al consultar personal',
        data: snapshot || SEED_DOCTORS_3280.map(d => mapFallbackDoctor(d, hospitalId || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8')),
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
        cursos_vida_asignados: normalizeCursosArray(doctor?.cursos_vida_asignados),
        grupos_riesgo_asignados: Array.isArray(doctor?.grupos_riesgo_asignados) ? doctor.grupos_riesgo_asignados : [],
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

      const { data, error } = await runWithSupabaseAuthRecovery(
        supabase,
        () =>
          supabase
            .from('staff')
            .insert([payload])
            .select('doctor_id, doctor_name, doctor_email, doctor_specialty, rol, cursos_vida_asignados, grupos_riesgo_asignados, solo_lectura, puede_lanzar_llamadas, puede_enviar_mensajes, puede_crear_campanas, puede_editar_pacientes, hospital_id, is_active, created_at, updated_at')
            .single(),
        15000,
        'Tiempo de espera agotado al crear personal'
      );

      if (error) return { success: false, error: error.message };

      const mapped = mapSupabaseToFrontend(data);
      const current = loadStaffSnapshot() || [];
      saveStaffSnapshot([mapped, ...current.filter((s) => s.id !== mapped.id)]);
      return { success: true, data: mapped };
    } catch (error) {
      return { success: false, error: error?.message || 'Error creando doctor' };
    }
  },

  async update(doctorId, changes) {
    try {
      const id = String(doctorId || '').trim();
      if (!id) return { success: false, error: 'ID de doctor inválido' };

      const payload = {};
      if (changes?.nombre !== undefined) payload.doctor_name = changes.nombre ? String(changes.nombre) : null;
      if (changes?.email) payload.doctor_email = String(changes.email).trim().toLowerCase();
      if (changes?.especialidad) payload.doctor_specialty = String(changes.especialidad).trim().toLowerCase();
      if (changes?.password) payload.doctor_password = String(changes.password);
      if (changes?.is_active !== undefined) payload.is_active = Boolean(changes.is_active);
      if (changes?.rol) payload.rol = String(changes.rol);
      if (changes?.cursos_vida_asignados !== undefined) payload.cursos_vida_asignados = normalizeCursosArray(changes.cursos_vida_asignados);
      if (changes?.grupos_riesgo_asignados !== undefined) payload.grupos_riesgo_asignados = Array.isArray(changes.grupos_riesgo_asignados) ? changes.grupos_riesgo_asignados : [];
      if (changes?.solo_lectura !== undefined) payload.solo_lectura = Boolean(changes.solo_lectura);
      if (changes?.puede_lanzar_llamadas !== undefined) payload.puede_lanzar_llamadas = Boolean(changes.puede_lanzar_llamadas);
      if (changes?.puede_enviar_mensajes !== undefined) payload.puede_enviar_mensajes = Boolean(changes.puede_enviar_mensajes);
      if (changes?.puede_crear_campanas !== undefined) payload.puede_crear_campanas = Boolean(changes.puede_crear_campanas);
      if (changes?.puede_editar_pacientes !== undefined) payload.puede_editar_pacientes = Boolean(changes.puede_editar_pacientes);
      payload.updated_at = new Date().toISOString();

      // doctor_id es la clave primaria UUID única del registro; sobrescribe en BD de forma persistente
      const { data, error } = await runWithSupabaseAuthRecovery(
        supabase,
        () =>
          supabase
            .from('staff')
            .update(payload)
            .eq('doctor_id', id)
            .select('doctor_id, doctor_name, doctor_email, doctor_specialty, rol, cursos_vida_asignados, grupos_riesgo_asignados, solo_lectura, puede_lanzar_llamadas, puede_enviar_mensajes, puede_crear_campanas, puede_editar_pacientes, hospital_id, is_active, created_at, updated_at')
            .single(),
        15000,
        'Tiempo de espera agotado al guardar permisos en base de datos'
      );

      if (error || !data) {
        return { success: false, error: error?.message || 'La base de datos no confirmó la actualización del registro' };
      }

      const mapped = mapSupabaseToFrontend(data);
      updateSnapshotAndActiveDoctor(mapped);
      return { success: true, data: mapped };
    } catch (error) {
      return { success: false, error: error?.message || 'Error actualizando doctor' };
    }
  },

  async delete(doctorId) {
    try {
      const { role, hospitalId } = getCurrentUserContext();
      const id = String(doctorId || '').trim();
      if (!id) return { success: false, error: 'ID de doctor inválido' };

      const runDelete = () => {
        let query = supabase.from('staff').delete().eq('doctor_id', id);
        if (role !== 'super_admin') {
          if (!hospitalId) return Promise.resolve({ error: { message: 'No se pudo identificar el hospital del usuario' } });
          query = query.eq('hospital_id', hospitalId);
        }
        return query;
      };

      const { error } = await runWithSupabaseAuthRecovery(
        supabase,
        runDelete,
        15000,
        'Tiempo de espera agotado al eliminar doctor'
      );

      if (error) return { success: false, error: error.message };
      const current = loadStaffSnapshot();
      if (current) {
        saveStaffSnapshot(current.filter((s) => s.id !== id && s.doctor_id !== id));
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Error eliminando doctor' };
    }
  },
};
