import { supabase } from '@/lib/supabase'
import { isSupabaseAuthError, withTimeout } from '@/lib/utils'
import { programToSpecialty, pickDoctorIdForPatient } from '@/pages/doctor/doctorUtils'
import { staffService } from './staffService'

// Función auxiliar para calcular edad desde fecha de nacimiento
function calculateAge(birthdate) {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

// Mapear de Supabase a Frontend
function mapSupabaseToFrontend(patient) {
  return {
    id: patient.patient_id,
    nombre: patient.name,
    telefono: patient.phone,
    email: patient.email,
    cc: patient.document,
    edad: calculateAge(patient.birthdate),
    fechaNacimiento: patient.birthdate,
    sexo: patient.sex === 'Masculino' ? 'M' : patient.sex === 'Femenino' ? 'F' : patient.sex,
    ciudad: patient.city || '',
    programa: patient.program || '',
    direccion: patient.address || '',
    hospitalId: patient.hospital_id,
    fechaRegistro: patient.created_at
  };
}

// Mapear de Frontend a Supabase
function mapFrontendToSupabase(patient) {
  return {
    name: patient.nombre,
    phone: patient.telefono,
    email: patient.email,
    document: patient.cc,
    birthdate: patient.fechaNacimiento,
    sex: patient.sexo === 'M' ? 'Masculino' : patient.sexo === 'F' ? 'Femenino' : patient.sexo,
    city: patient.ciudad,
    program: patient.programa,
    address: patient.direccion,
    hospital_id: patient.hospitalId
  };
}

// Obtener hospital_id del usuario logueado
function getCurrentHospitalId() {
  try {
    const userData = localStorage.getItem('sadi_user');
    if (!userData) {
      console.error('❌ No hay usuario logueado');
      return null;
    }

    const user = JSON.parse(userData);
    
    if (!user.hospitalId) {
      console.error('❌ Usuario no tiene hospitalId asignado');
      return null;
    }

    console.log('✅ Hospital ID del usuario:', user.hospitalId);
    return user.hospitalId;
  } catch (error) {
    console.error('❌ Error obteniendo hospitalId:', error);
    return null;
  }
}

export const patientService = {
  /**
   * Obtener SOLO los pacientes del hospital logueado
   * Filtrado manual por hospital_id
   */
  async getAll(filters = {}) {
    try {
      console.log('🔍 Obteniendo pacientes del hospital...');
      
      const hospitalId = getCurrentHospitalId();
      
      if (!hospitalId) {
        console.error('❌ No se pudo obtener hospitalId');
        return { 
          success: false, 
          error: 'No se pudo identificar el hospital del usuario',
          data: [] 
        };
      }

      const makeQuery = () => {
        let query = supabase
          .from('patients')
          .select('*')
          .eq('hospital_id', hospitalId)
          .order('created_at', { ascending: false });
        
        if (filters.programa) {
          query = query.eq('program', filters.programa);
        }
        
        if (filters.ciudad) {
          query = query.eq('city', filters.ciudad);
        }
        
        return query;
      };

      const run = async () => withTimeout(makeQuery(), 12000, 'Tiempo de espera agotado al cargar pacientes');

      let { data, error } = await run();
      if (error && isSupabaseAuthError(error)) {
        await supabase.auth.refreshSession().catch(() => null);
        ({ data, error } = await run());
      }
      
      if (error) {
        console.error('❌ Error de Supabase:', error);
        return { success: false, error: error.message, data: [] };
      }
      
      const mappedData = data?.map(mapSupabaseToFrontend) || [];
      
      console.log(`✅ Se obtuvieron ${mappedData.length} pacientes del hospital ${hospitalId}`);
      
      return { 
        success: true, 
        data: mappedData
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo pacientes:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Obtener paciente por ID (verificando que pertenezca al hospital)
   */
  async getById(id) {
    try {
      const hospitalId = getCurrentHospitalId();
      
      if (!hospitalId) {
        return { success: false, error: 'Usuario no identificado' };
      }

      const run = async () => withTimeout(
        supabase
          .from('patients')
          .select('*')
          .eq('patient_id', id)
          .eq('hospital_id', hospitalId)
          .single(),
        10000,
        'Tiempo de espera agotado al obtener paciente'
      );

      const { data, error } = await run();
      
      if (error) {
        console.error('❌ Error obteniendo paciente:', error);
        return { success: false, error: error.message };
      }
      
      return {
        success: true,
        data: mapSupabaseToFrontend(data)
      };
    } catch (error) {
      console.error('❌ Error obteniendo paciente por ID:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Actualizar datos de un paciente
   */
  async update(id, updates) {
    try {
      const hospitalId = getCurrentHospitalId();
      
      if (!hospitalId) {
        return { success: false, error: 'Usuario no identificado' };
      }

      console.log('📝 Actualizando paciente:', id);

      const supabaseUpdates = mapFrontendToSupabase({ ...updates, hospitalId });
      
      // Eliminar campos que no deben actualizarse o que son undefined
      delete supabaseUpdates.created_at;
      delete supabaseUpdates.hospital_id; // No permitir cambiar hospital

      const run = async () => withTimeout(
        supabase
          .from('patients')
          .update(supabaseUpdates)
          .eq('patient_id', id)
          .eq('hospital_id', hospitalId) // Seguridad extra
          .select()
          .single(),
        10000,
        'Tiempo de espera agotado al actualizar paciente'
      );

      const { data, error } = await run();

      if (error) {
        console.error('❌ Error actualizando paciente:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Paciente actualizado exitosamente');
      return {
        success: true,
        data: mapSupabaseToFrontend(data)
      };
    } catch (error) {
      console.error('❌ Error actualizando paciente:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Eliminar un paciente (soft delete o hard delete según política)
   * Por ahora hard delete
   */
  async delete(id) {
    try {
      const hospitalId = getCurrentHospitalId();
      
      if (!hospitalId) {
        return { success: false, error: 'Usuario no identificado' };
      }

      console.log('🗑️ Eliminando paciente:', id);

      const run = async () => withTimeout(
        supabase
          .from('patients')
          .delete()
          .eq('patient_id', id)
          .eq('hospital_id', hospitalId), // Seguridad extra
        10000,
        'Tiempo de espera agotado al eliminar paciente'
      );

      const { error } = await run();

      if (error) {
        console.error('❌ Error eliminando paciente:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Paciente eliminado exitosamente');
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando paciente:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Crear nuevo paciente asignado automáticamente al hospital logueado
   */
  async create(patient) {
    try {
      const hospitalId = getCurrentHospitalId();
      
      if (!hospitalId) {
        return { 
          success: false, 
          error: 'No se pudo identificar el hospital. Por favor inicie sesión nuevamente.' 
        };
      }

      console.log('➕ Creando paciente para hospital_id:', hospitalId);
      
      const supabasePatient = {
        ...mapFrontendToSupabase(patient),
        hospital_id: hospitalId
      };
      
      const run = async () => withTimeout(
        supabase
          .from('patients')
          .insert([supabasePatient])
          .select()
          .single(),
        10000,
        'Tiempo de espera agotado al crear paciente'
      );
      
      const { data, error } = await run();
      
      if (error) {
        console.error('❌ Error creando paciente:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ Paciente creado exitosamente');
      
      return {
        success: true,
        data: mapSupabaseToFrontend(data)
      };
    } catch (error) {
      console.error('❌ Error creando paciente:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Crear múltiples pacientes (CSV upload) asignados al hospital logueado
   */
  async createBulk(patients, options = {}) {
    try {
      const hospitalId = getCurrentHospitalId();
      
      if (!hospitalId) {
        return { 
          success: false, 
          error: 'No se pudo identificar el hospital',
          successCount: 0,
          data: [],
          failed: []
        };
      }

      console.log(`📦 Creando ${patients.length} pacientes para hospital ${hospitalId}`);

      const batchSize = options.batchSize || 25;

      const results = {
        success: true,
        successCount: 0,
        data: [],
        failed: []
      };

      const normalizeBirthdate = (value) => {
        if (!value) return null;
        const raw = String(value).trim();
        if (!raw) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

        const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) {
          const a = Number(m[1]);
          const b = Number(m[2]);
          const y = Number(m[3]);
          const day = a > 12 ? a : b > 12 ? b : a;
          const month = day === a ? b : a;
          const dd = String(day).padStart(2, '0');
          const mm = String(month).padStart(2, '0');
          return `${y}-${mm}-${dd}`;
        }

        return raw;
      };

      const total = patients.length;
      let processed = 0;

      for (let start = 0; start < patients.length; start += batchSize) {
        const batch = patients.slice(start, start + batchSize);
        const settled = await Promise.allSettled(
          batch.map(async (p) => {
            const normalized = {
              ...p,
              nombre: p?.nombre ? String(p.nombre).trim() : '',
              email: p?.email ? String(p.email).trim().toLowerCase() : '',
              cc: p?.cc ? String(p.cc).trim() : '',
              telefono: p?.telefono ? String(p.telefono).trim() : '',
              ciudad: p?.ciudad ? String(p.ciudad).trim() : '',
              programa: p?.programa ? String(p.programa).trim() : '',
              direccion: p?.direccion ? String(p.direccion).trim() : '',
              fechaNacimiento: p?.fechaNacimiento ? String(p.fechaNacimiento).trim() : '',
            };

            const mapped = mapFrontendToSupabase({
              ...normalized,
              hospitalId,
              fechaNacimiento: normalizeBirthdate(normalized.fechaNacimiento),
            });

            const runRpc = async () => withTimeout(
              supabase.rpc('create_patient_secure', {
                p_hospital_id: hospitalId,
                p_email: mapped.email,
                p_name: mapped.name,
                p_document: mapped.document,
                p_phone: mapped.phone || null,
                p_birthdate: mapped.birthdate || null,
                p_sex: mapped.sex || null,
                p_city: mapped.city || null,
                p_address: mapped.address || null,
                p_program: mapped.program || null,
                p_plain_password: normalized.cc,
                p_sms_opt_in: true,
              }),
              10000,
              'Tiempo de espera agotado al crear paciente (RPC)'
            );

            const { data, error } = await runRpc();

            if (error) throw new Error(error.message || 'Error creando paciente');
            return Array.isArray(data) ? data[0] : data;
          })
        );

        settled.forEach((res, i) => {
          const idx = start + i;
          processed += 1;

          if (res.status === 'fulfilled' && res.value) {
            results.successCount += 1;
            results.data.push(mapSupabaseToFrontend(res.value));
            return;
          }

          results.failed.push({
            index: idx,
            patient: patients[idx],
            error:
              res.status === 'rejected'
                ? res.reason?.message || String(res.reason)
                : 'No se recibió data del RPC create_patient_secure',
          });
        });

        if (typeof options.onProgress === 'function') {
          options.onProgress(processed, total);
        }
      }

      if (results.failed.length > 0) {
        // Intentar asignar doctores a los exitosos, aunque haya fallos en otros
        if (results.data.length > 0) {
           await patientService.assignDoctorsByProgram(results.data);
        }

        return {
          success: false,
          successCount: results.successCount,
          data: results.data,
          failed: results.failed,
          error: `${results.failed.length} filas fallaron`
        };
      }

      // Asignar doctores a todos los creados
      if (results.data.length > 0) {
         await patientService.assignDoctorsByProgram(results.data);
      }

      return {
        success: true,
        successCount: results.successCount,
        data: results.data,
        failed: []
      };

    } catch (error) {
      console.error('❌ Error en createBulk:', error);
      return { 
        success: false, 
        error: error.message,
        successCount: 0,
        data: [],
        failed: []
      };
    }
  },

  /**
   * Asignar doctores automáticamente según programa
   */
  async assignDoctorsByProgram(patients) {
    try {
      if (!patients || patients.length === 0) return { success: true, count: 0 };
      
      console.log(`🤖 Iniciando asignación automática para ${patients.length} pacientes...`);
      const hospitalId = getCurrentHospitalId();

      // 1. Obtener staff
      const rosterRes = await staffService.getAll();
      if (!rosterRes.success) {
        console.warn('⚠️ No se pudo obtener el staff para asignación automática');
        return { success: false, error: 'No se pudo cargar staff' };
      }

      // 2. Filtrar y agrupar doctores
      const roster = (rosterRes.data || [])
        .filter((d) => d.is_active && (String(d.hospitalId || '') === String(hospitalId || '')));

      if (roster.length === 0) {
        console.warn('⚠️ No hay doctores activos en este hospital para asignar');
        return { success: false, error: 'No hay doctores disponibles' };
      }

      const bySpecialty = new Map();
      roster.forEach((d) => {
        const key = String(d.especialidad || '').trim().toLowerCase();
        const list = bySpecialty.get(key) || [];
        list.push(String(d.id || '').trim());
        bySpecialty.set(key, list);
      });

      // 3. Agrupar pacientes por doctor destino
      const groups = new Map();
      patients.forEach((p) => {
        const spec = programToSpecialty(p.programa || '');
        const doctorIds = bySpecialty.get(spec) || [];
        
        // Si no hay especialista, intentar asignar a médico general si existe, o cualquiera
        const finalDoctorIds = doctorIds.length > 0 ? doctorIds : (bySpecialty.get('general') || []);
        
        const chosen = pickDoctorIdForPatient(p.id, finalDoctorIds);
        if (!chosen) return;
        
        const list = groups.get(chosen) || [];
        list.push(String(p.id));
        groups.set(chosen, list);
      });

      // 4. Ejecutar actualizaciones
      let totalAssigned = 0;
      for (const [doctorId, patientIds] of groups.entries()) {
        const assignRes = await patientService.assignDoctorBulk(patientIds, doctorId);
        if (assignRes.success) totalAssigned += (assignRes.updated || 0);
      }

      console.log(`✅ Asignación completada: ${totalAssigned} pacientes asignados.`);
      return { success: true, count: totalAssigned };

    } catch (error) {
      console.error('❌ Error en assignDoctorsByProgram:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Asignar doctor a múltiples pacientes
   */
  async assignDoctorBulk(patientIds, doctorId) {
    try {
      const hospitalId = getCurrentHospitalId();
      if (!hospitalId) {
        return { success: false, error: 'Usuario no identificado', updated: 0 };
      }

      const ids = (patientIds || []).map((x) => String(x || '').trim()).filter(Boolean);
      if (ids.length === 0) return { success: true, updated: 0 };

      const payload = { doctor_id: doctorId };

      const run = async () => withTimeout(
        supabase
          .from('patients')
          .update(payload)
          .in('patient_id', ids)
          .eq('hospital_id', hospitalId)
          .select('patient_id'),
        20000, // Mayor timeout para bulk update
        'Tiempo de espera agotado al asignar doctores'
      );

      const { data, error } = await run();

      if (error) return { success: false, error: error.message, updated: 0 };

      return { success: true, updated: Array.isArray(data) ? data.length : 0 };
    } catch (error) {
      return { success: false, error: error?.message || 'Error asignando doctor', updated: 0 };
    }
  },

  /**
   * Buscar pacientes del hospital logueado
   */
  async search(query) {
    try {
      const hospitalId = getCurrentHospitalId();
      
      if (!hospitalId) {
        return { success: false, error: 'Usuario no identificado', data: [] };
      }

      const run = async () => withTimeout(
        supabase
          .from('patients')
          .select('*')
          .eq('hospital_id', hospitalId)
          .or(`name.ilike.%${query}%,document.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`),
        10000,
        'Tiempo de espera agotado al buscar pacientes'
      );

      const { data, error } = await run();
      
      if (error) {
        console.error('❌ Error buscando pacientes:', error);
        return { success: false, error: error.message, data: [] };
      }
      
      const mappedData = data?.map(mapSupabaseToFrontend) || [];
      
      console.log(`🔍 Búsqueda retornó ${mappedData.length} resultados`);
      
      return {
        success: true,
        data: mappedData
      };
    } catch (error) {
      console.error('❌ Error buscando pacientes:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Obtener estadísticas de pacientes del hospital logueado
   */
  async getStats() {
    try {
      const hospitalId = getCurrentHospitalId();
      
      if (!hospitalId) {
        return { success: false, error: 'Usuario no identificado' };
      }

      const run = async () => withTimeout(
        supabase
          .from('patients')
          .select('program, city, sex')
          .eq('hospital_id', hospitalId),
        10000,
        'Tiempo de espera agotado al obtener estadísticas'
      );

      const { data, error } = await run();
      
      if (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        return { success: false, error: error.message };
      }
      
      const stats = {
        total: data.length,
        porPrograma: {},
        porCiudad: {},
        porSexo: { M: 0, F: 0 }
      };
      
      data.forEach(patient => {
        if (patient.program) {
          stats.porPrograma[patient.program] = (stats.porPrograma[patient.program] || 0) + 1;
        }
        
        if (patient.city) {
          stats.porCiudad[patient.city] = (stats.porCiudad[patient.city] || 0) + 1;
        }
        
        if (patient.sex === 'Masculino') stats.porSexo.M++;
        if (patient.sex === 'Femenino') stats.porSexo.F++;
      });
      
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return { success: false, error: error.message };
    }
  }
};
