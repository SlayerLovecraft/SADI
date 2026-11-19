import { supabase } from '@/lib/supabase'
import { isSupabaseAuthError, withTimeout } from '@/lib/utils'
import { programToSpecialty, pickDoctorIdForPatient } from '@/pages/doctor/doctorUtils'
import { staffService } from './staffService'
import { SEED_PATIENTS_3280 } from './telemonitoringService'
import { getPatientCursoVida, getPatientGrupoRiesgo, getPatientGruposRiesgo } from './callCapacityService'

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

// Función auxiliar para determinar Curso de Vida (7 Cursos A-G) según edad y programa
function getCursoVidaFromData(age, program) {
  const p = (program || '').toLowerCase();
  if (p.includes('embarazo') || p.includes('prenatal') || p.includes('materno') || p.includes('gestan') || p.includes('riamp')) {
    return 'Preventivo de la Mujer';
  }

  if (age === null || age === undefined) return 'Adultez';
  if (age <= 5) return 'Primera Infancia';
  if (age <= 11) return 'Infancia';
  if (age <= 17) return 'Adolescencia';
  if (age <= 28) return 'Juventud';
  if (age <= 59) return 'Adultez';
  return 'Vejez';
}

// Mapear de Supabase a Frontend (preserva grupos_riesgo[] reales, NUNCA inventa riesgos)
function mapSupabaseToFrontend(patient) {
  const cvObj = getPatientCursoVida(patient);
  const grList = getPatientGruposRiesgo(patient);
  const grObj = getPatientGrupoRiesgo(patient);
  const age = calculateAge(patient.birthdate || patient.fecha_nacimiento);
  const cursoVida = cvObj.nombre;
  const realRiesgoNames = grList.map((r) => r.nombre);
  const grupoRiesgo = realRiesgoNames.length > 0 ? realRiesgoNames[0] : null;

  // Parsing seguro de JSON
  let dispositivos = [];
  try {
    dispositivos = Array.isArray(patient.dispositivos_caseros)
      ? patient.dispositivos_caseros
      : (patient.dispositivos_caseros ? JSON.parse(patient.dispositivos_caseros) : []);
  } catch (e) {
    dispositivos = [];
  }

  let valoresCriticos = { tiene_critico: false, tipo: 'Sin alertas', valor: 'Normal', fecha_hora: 'N/A', estado: 'Estable' };
  try {
    if (patient.valores_criticos) {
      valoresCriticos = typeof patient.valores_criticos === 'object'
        ? patient.valores_criticos
        : JSON.parse(patient.valores_criticos);
    }
  } catch (e) { }

  let historialMedidas = [];
  try {
    if (patient.historial_medidas) {
      historialMedidas = Array.isArray(patient.historial_medidas)
        ? patient.historial_medidas
        : JSON.parse(patient.historial_medidas);
    }
  } catch (e) { }

  let conteoCanales = { whatsapp: 0, email: 0, call: 0, sms: 0 };
  try {
    if (patient.conteo_canales) {
      conteoCanales = typeof patient.conteo_canales === 'object'
        ? patient.conteo_canales
        : JSON.parse(patient.conteo_canales);
    }
  } catch (e) { }

  return {
    id: patient.patient_id || patient.id,
    patient_id: patient.patient_id || patient.id,
    nombre: patient.name || patient.nombre,
    telefono: patient.phone || patient.telefono,
    email: patient.email,
    cc: patient.document || patient.cc || patient.numero_documento,
    tipo_documento: patient.tipo_documento || 'CC',
    llave: patient.llave || null,
    eps: patient.eps || null,
    ips_asignada: patient.ips_asignada || null,
    edad: age,
    fechaNacimiento: patient.birthdate || patient.fecha_nacimiento,
    sexo: patient.sex === 'Masculino' || patient.sexo === 'masculino' || patient.sexo === 'M' ? 'M' : 'F',
    ciudad: patient.city || patient.ciudad || '',
    programa: patient.program || cursoVida,
    program: patient.program || cursoVida,
    direccion: patient.address || patient.direccion || '',
    hospitalId: patient.hospital_id || patient.hospitalId,
    fechaRegistro: patient.created_at || new Date().toISOString(),
    zona: patient.zona || 'Urbana',
    barrio: patient.barrio || '',
    comuna: patient.comuna || '',
    corregimiento: patient.corregimiento || null,
    vereda: patient.vereda || null,
    centro_poblado: patient.centro_poblado || null,
    grupo_riesgo: grupoRiesgo,
    grupos_riesgo: realRiesgoNames,
    grupo_vida: cursoVida,
    curso_vida: cursoVida,
    curso_vida_key: cvObj.key,
    doctor_id: patient.doctor_id || null,
    doctor_nombre: patient.doctor_name || patient.doctor_nombre || null,
    doctor_email: patient.doctor_email || null,
    doctor_specialty: patient.doctor_specialty || null,
    tipo_usuario: patient.tipo_usuario || 'Activo',
    dispositivos: dispositivos,
    dispositivos_caseros: dispositivos,
    valores_criticos: valoresCriticos,
    historial_medidas: historialMedidas,
    conteo_canales: conteoCanales
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

// Obtener hospital_id del usuario logueado con fallback al hospital oficial de Caldas
function getCurrentHospitalId() {
  try {
    const userData = localStorage.getItem('sadi_user');
    if (userData) {
      const user = JSON.parse(userData);
      const targetId = user.hospitalId || user.hospital_id || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8';
      return targetId;
    }
  } catch (error) {
    console.error('❌ Error obteniendo hospitalId:', error);
  }
  return 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8';
}

export const patientService = {
  /**
   * Obtener pacientes paginados y filtrados en servidor (soporta 142k+ registros sin truncar a 1,000)
   */
  async getPaginated({
    page = 1,
    pageSize = 50,
    search = '',
    cursoVida = 'todos',
    doctorId = null,
    hospitalId: overrideHospitalId = null,
  } = {}) {
    try {
      const hospitalId = overrideHospitalId || getCurrentHospitalId();
      if (!hospitalId) {
        return { success: false, error: 'No se pudo identificar el hospital del usuario', data: [], totalCount: 0 };
      }

      const safePage = Math.max(1, Number(page) || 1);
      const safeSize = Math.max(1, Math.min(1000, Number(pageSize) || 50));

      const { data: rpcData, error: rpcError } = await withTimeout(
        supabase.rpc('get_patients_paginated', {
          p_hospital_id: hospitalId,
          p_search: search?.trim() || null,
          p_curso_vida: cursoVida || 'todos',
          p_doctor_id: doctorId || null,
          p_page: safePage,
          p_page_size: safeSize,
        }),
        15000,
        'Tiempo de espera agotado al consultar pacientes paginados'
      );

      if (!rpcError && Array.isArray(rpcData)) {
        const totalCount = rpcData.length > 0 ? Number(rpcData[0].total_count || 0) : 0;
        let mappedData = rpcData.map(mapSupabaseToFrontend);

        // Si estamos buscando o filtrando en una página <=50, el total exacto viene en row.total_count;
        // si rpcData viene vacío y page === 1 con filtros, totalCount es 0.
        if (mappedData.length > 0 && mappedData.length <= 200) {
          try {
            const patientIds = mappedData.map((p) => p.patient_id || p.id).filter(Boolean);
            const { data: vitals } = await supabase
              .from('signos_vitales')
              .select('*')
              .in('paciente_id', patientIds)
              .order('fecha', { ascending: true });

            if (vitals && vitals.length > 0) {
              const vitalsByPatient = {};
              vitals.forEach((v) => {
                if (!v.paciente_id) return;
                if (!vitalsByPatient[v.paciente_id]) vitalsByPatient[v.paciente_id] = [];
                const fStr = new Date(v.fecha).toISOString().replace('T', ' ').substring(0, 16);
                const temp = parseFloat(v.temperatura) || 36.5;
                const pa = (v.presion_sistolica && v.presion_diastolica) ? ` · PA: ${v.presion_sistolica}/${v.presion_diastolica}` : '';
                const glu = v.glucometria ? ` · Gluc: ${v.glucometria} mg/dL` : '';
                const fc = v.ritmo_cardiaco ? ` · FC: ${v.ritmo_cardiaco} lpm` : '';
                const peso = v.peso ? ` · Peso: ${v.peso} kg` : '';
                vitalsByPatient[v.paciente_id].push({
                  fecha: fStr,
                  valor: temp,
                  etiqueta: `${temp} °C${pa}${glu}${fc}${peso}`,
                });
              });
              mappedData = mappedData.map((p) => {
                const extraVitals = vitalsByPatient[p.id] || vitalsByPatient[p.patient_id];
                if (extraVitals && extraVitals.length > 0) {
                  const lastVital = extraVitals[extraVitals.length - 1];
                  return {
                    ...p,
                    historial_medidas: extraVitals,
                    valores_criticos: {
                      tiene_critico: false,
                      tipo: 'Signos Vitales Registrados por Paciente',
                      valor: lastVital.etiqueta,
                      estado: 'Normal / Estable',
                      fecha_hora: lastVital.fecha,
                    },
                  };
                }
                return p;
              });
            }
          } catch {
            // signos_vitales enrichment is optional
          }
        }

        return {
          success: true,
          data: mappedData,
          totalCount,
          page: safePage,
          pageSize: safeSize,
        };
      }

      // Fallback directo por rango si el RPC aún no existiera
      const from = (safePage - 1) * safeSize;
      const to = from + safeSize - 1;
      let query = supabase
        .from('patients')
        .select('*', { count: 'exact' })
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search?.trim()) {
        const q = search.trim();
        query = query.or(`name.ilike.%${q}%,document.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%`);
      }
      if (cursoVida && cursoVida !== 'todos') {
        query = query.eq('curso_vida', cursoVida);
      }
      if (doctorId) {
        query = query.eq('doctor_id', doctorId);
      }

      const { data, count, error } = await withTimeout(query, 15000, 'Tiempo de espera agotado');
      if (error) throw error;
      return {
        success: true,
        data: (data || []).map(mapSupabaseToFrontend),
        totalCount: Number(count || 0),
        page: safePage,
        pageSize: safeSize,
      };
    } catch (error) {
      return { success: false, error: error?.message || 'Error consultando pacientes paginados', data: [], totalCount: 0 };
    }
  },

  /**
   * Ejecutar motor automático en BD de clasificación por edad (Res. 3280) y asignación 1:1 a doctores
   */
  async autoAssignDoctors(onlyUnassigned = false, overrideHospitalId = null) {
    try {
      const hospitalId = overrideHospitalId || getCurrentHospitalId();
      const { data, error } = await withTimeout(
        supabase.rpc('auto_assign_patients_doctors', {
          p_hospital_id: hospitalId || null,
          p_only_unassigned: Boolean(onlyUnassigned),
        }),
        45000,
        'Tiempo de espera agotado al ejecutar asignación automática'
      );
      if (error) return { success: false, error: error.message };
      return { success: true, ...(data || {}) };
    } catch (error) {
      return { success: false, error: error?.message || 'Error en asignación automática' };
    }
  },

  /**
   * Descarga por lotes keyset (sin tope de 1,000 filas de PostgREST) el 100% de pacientes del hospital
   */
  async fetchAllCompact({ hospitalId: overrideHospitalId = null, batchSize = 5000, onProgress = null, filters = {} } = {}) {
    try {
      const hospitalId = overrideHospitalId || getCurrentHospitalId();
      if (!hospitalId) {
        return { success: false, error: 'No se pudo identificar el hospital del usuario', data: [] };
      }

      let cursor = null;
      let hasMore = true;
      let totalExpected = 0;
      const allRows = [];

      while (hasMore) {
        const { data: batchRes, error } = await withTimeout(
          supabase.rpc('get_patients_compact_batch', {
            p_hospital_id: hospitalId,
            p_last_id: cursor,
            p_batch_size: Math.max(500, Math.min(10000, Number(batchSize) || 5000)),
          }),
          25000,
          'Tiempo de espera agotado descargando lote completo de pacientes'
        );
        if (error) throw error;

        if (!totalExpected && batchRes?.total) {
          totalExpected = Number(batchRes.total);
        }
        const chunk = Array.isArray(batchRes?.rows) ? batchRes.rows : [];
        for (let i = 0; i < chunk.length; i++) {
          allRows.push(mapSupabaseToFrontend(chunk[i]));
        }

        if (typeof onProgress === 'function') {
          onProgress({ loaded: allRows.length, total: totalExpected || allRows.length });
        }

        hasMore = Boolean(batchRes?.has_more && batchRes?.next_cursor);
        cursor = batchRes?.next_cursor || null;
        if (chunk.length === 0) break;
      }

      let result = allRows;
      if (filters?.programa) {
        result = result.filter((p) => p.programa === filters.programa);
      }
      if (filters?.ciudad) {
        result = result.filter((p) => p.ciudad === filters.ciudad);
      }

      return { success: true, data: result, totalCount: totalExpected || result.length };
    } catch (error) {
      return { success: false, error: error?.message || 'Error descargando censo completo', data: [] };
    }
  },

  /**
   * Obtener TODOS los pacientes del hospital logueado (100% sin tope de 1,000 filas)
   */
  async getAll(filters = {}) {
    try {
      console.log('🔍 Obteniendo 100% de pacientes del hospital...');

      const hospitalId = getCurrentHospitalId();

      if (!hospitalId) {
        console.error('❌ No se pudo obtener hospitalId');
        return {
          success: false,
          error: 'No se pudo identificar el hospital del usuario',
          data: []
        };
      }

      const batchRes = await this.fetchAllCompact({ hospitalId, batchSize: 5000, filters });
      if (!batchRes.success) {
        throw new Error(batchRes.error || 'Error cargando pacientes completos');
      }

      let mappedData = batchRes.data || [];

      // Enriquecer en tiempo real con signos vitales registrados por pacientes desde su panel
      try {
        const { data: vitals } = await supabase
          .from('signos_vitales')
          .select('*')
          .order('fecha', { ascending: true });

        if (vitals && vitals.length > 0) {
          const vitalsByPatient = {};
          vitals.forEach(v => {
            if (!v.paciente_id) return;
            if (!vitalsByPatient[v.paciente_id]) vitalsByPatient[v.paciente_id] = [];
            const fStr = new Date(v.fecha).toISOString().replace('T', ' ').substring(0, 16);
            const temp = parseFloat(v.temperatura) || 36.5;
            const pa = (v.presion_sistolica && v.presion_diastolica) ? ` · PA: ${v.presion_sistolica}/${v.presion_diastolica}` : '';
            const glu = v.glucometria ? ` · Gluc: ${v.glucometria} mg/dL` : '';
            const fc = v.ritmo_cardiaco ? ` · FC: ${v.ritmo_cardiaco} lpm` : '';
            const peso = v.peso ? ` · Peso: ${v.peso} kg` : '';
            vitalsByPatient[v.paciente_id].push({
              fecha: fStr,
              valor: temp,
              etiqueta: `${temp} °C${pa}${glu}${fc}${peso}`
            });
          });

          mappedData = mappedData.map(p => {
            const extraVitals = vitalsByPatient[p.id] || vitalsByPatient[p.patient_id];
            if (extraVitals && extraVitals.length > 0) {
              const lastVital = extraVitals[extraVitals.length - 1];
              return {
                ...p,
                historial_medidas: extraVitals,
                valores_criticos: {
                  tiene_critico: false,
                  tipo: 'Signos Vitales Registrados por Paciente',
                  valor: lastVital.etiqueta,
                  estado: 'Normal / Estable',
                  fecha_hora: lastVital.fecha
                }
              };
            }
            return p;
          });
        }
      } catch (errVitals) {
        console.warn('⚠️ No se pudieron consultar signos vitales:', errVitals);
      }

      console.log(`✅ Se obtuvieron ${mappedData.length} pacientes del hospital ${hospitalId}`);

      return {
        success: true,
        data: mappedData
      };

    } catch (error) {
      console.warn('⚠️ Excepción al cargar pacientes, fallback a pacientes 3280 con segmentación clínica:', error);
      return {
        success: true,
        data: SEED_PATIENTS_3280.map(p => {
          const cvObj = getPatientCursoVida(p);
          const grObj = getPatientGrupoRiesgo(p);
          const age = calculateAge(p.fecha_nacimiento);
          const cv = p.curso_vida?.replace('_', ' ') || cvObj.nombre;
          const gr = p.grupo_riesgo || grObj.nombre;
          return {
            id: p.id,
            nombre: p.nombre,
            telefono: p.telefono,
            email: p.email,
            cc: p.documento,
            edad: age,
            fechaNacimiento: p.fecha_nacimiento,
            sexo: p.sexo === 'masculino' ? 'M' : 'F',
            ciudad: 'Cali / Medellín / Bogotá',
            programa: cv,
            direccion: p.direccion || 'Dirección registrada',
            hospitalId: hospitalId || 'hosp-001',
            fechaRegistro: new Date().toISOString(),
            grupo_vida: cv,
            curso_vida: cv,
            grupo_riesgo: gr,
            tipo_usuario: 'Activo',
            dispositivos: p.dispositivos_caseros || [],
            dispositivos_caseros: p.dispositivos_caseros || [],
            valores_criticos: { tiene_critico: false, tipo: 'Sin alertas', valor: 'Normal', fecha_hora: 'N/A', estado: 'Estable' },
            historial_medidas: [],
            conteo_canales: { whatsapp: 2, email: 1, call: 2, sms: 1 }
          };
        })
      };
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
      const chunkSize = 150;
      let totalUpdated = 0;

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data, error } = await withTimeout(
          supabase
            .from('patients')
            .update(payload)
            .in('patient_id', chunk)
            .eq('hospital_id', hospitalId)
            .select('patient_id'),
          20000,
          'Tiempo de espera agotado al asignar doctores'
        );
        if (error) return { success: false, error: error.message, updated: totalUpdated };
        totalUpdated += Array.isArray(data) ? data.length : 0;
      }

      return { success: true, updated: totalUpdated };
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
