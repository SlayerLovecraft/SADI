// ==============================================================================
// localSinglePatientSandbox.js - ENTORNO DE PRUEBA LOCAL CON 1 PACIENTE ÚNICO
// ==============================================================================
// Se activa ÚNICAMENTE cuando existe VITE_LOCAL_SINGLE_PATIENT_DOC en `.env.local`
// (por ejemplo: VITE_LOCAL_SINGLE_PATIENT_DOC=1006010518).
// - NUNCA modifica ni elimina pacientes en Supabase de producción.
// - Intercepta las consultas y RPCs de pacientes para que TODO el aplicativo local
//   (Pacientes, Demanda Res. 3280, Cronograma/Matriz Anual, Campañas, Tandas,
//   Dashboard y Reportes) opere exclusivamente con ese 1 paciente real.
// ==============================================================================

const LOCAL_SINGLE_DOC = String(import.meta.env?.VITE_LOCAL_SINGLE_PATIENT_DOC || '').trim();

export function getLocalSinglePatientDoc() {
  return LOCAL_SINGLE_DOC || null;
}

export function isLocalSinglePatientMode() {
  return Boolean(LOCAL_SINGLE_DOC);
}

let cachedSinglePatient = null;
let cachedFetchPromise = null;

const CURSO_KEY_TO_CODE = {
  primera_infancia: 'A',
  infancia: 'B',
  adolescencia: 'C',
  juventud: 'D',
  adultez: 'E',
  vejez: 'F',
  preventivo_mujer: 'G',
  materno_perinatal: 'G',
};

const RIESGO_NAME_TO_ID = {
  'Población Materno-Perinatal': '1',
  'Riesgo Cardiovascular, Metabólico y Renal': '2',
  'Cáncer (Detección temprana y seguimiento)': '3',
  'Cáncer': '3',
  'Enfermedades Respiratorias Crónicas': '4',
  'Salud Mental y Sustancias Psicoactivas': '5',
  'Enfermedades Infecciosas y Zoonóticas': '6',
  'Alteraciones Nutricionales y del Crecimiento': '7',
  'Enfermedades Huérfanas y Neurológicas': '8',
  'Planificación Familiar': '9',
  'Vacunación PAI': '10',
  'Salud Oral': '11',
};

function getColombiaTodayIso() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch { /* fallback */ }
  return new Date().toISOString().slice(0, 10);
}

function calcAge(birthdate) {
  if (!birthdate) return 24;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return 24;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return Math.max(0, age);
}

function matchesSearch(patient, searchRaw) {
  const q = String(searchRaw || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [
    patient.name,
    patient.document,
    patient.phone,
    patient.email,
    patient.program,
    patient.curso_vida,
    patient.grupo_riesgo,
    ...(Array.isArray(patient.grupos_riesgo) ? patient.grupos_riesgo : []),
    patient.barrio,
    patient.comuna,
  ].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

function getPatientRiesgoIds(patient) {
  const list = Array.isArray(patient.grupos_riesgo) && patient.grupos_riesgo.length > 0
    ? patient.grupos_riesgo
    : (patient.grupo_riesgo ? [patient.grupo_riesgo] : []);
  return [...new Set(list.map((n) => RIESGO_NAME_TO_ID[n]).filter(Boolean))];
}

function buildSinglePatientSummary(patient, year = 2026) {
  const todayIso = getColombiaTodayIso();
  const curMonthIdx = Number(todayIso.slice(5, 7)) - 1; // 0..11
  const ccode = CURSO_KEY_TO_CODE[patient.curso_vida] || 'D';
  const riesgoIds = getPatientRiesgoIds(patient);
  const prio = riesgoIds.includes('1') ? '1' : riesgoIds.includes('3') ? '2' : riesgoIds.length > 0 ? '4' : '5';

  const makeMonthsArr = (active) => {
    const arr = Array(12).fill(0);
    if (active) {
      // Colocar al paciente en el mes actual (y su mes de nacimiento) para poder probar campañas HOY en cualquier pestaña
      arr[curMonthIdx] = 1;
      const bMonth = patient.birthdate ? (new Date(patient.birthdate).getMonth()) : curMonthIdx;
      if (bMonth >= 0 && bMonth <= 11) arr[bMonth] = 1;
    }
    return arr;
  };

  const censoByCurso = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, [ccode]: 1 };
  const censoByRiesgo = {};
  const riesgosMatrix = {};
  for (let i = 1; i <= 11; i++) {
    const k = String(i);
    const has = riesgoIds.includes(k);
    censoByRiesgo[k] = has ? 1 : 0;
    riesgosMatrix[k] = makeMonthsArr(has);
  }
  const cursosMatrix = {};
  for (const code of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
    cursosMatrix[code] = makeMonthsArr(code === ccode);
  }
  const priorityMatrix = {};
  for (let p = 1; p <= 5; p++) {
    priorityMatrix[String(p)] = makeMonthsArr(String(p) === prio);
  }

  const dailyBreakdown = {
    [todayIso]: {
      total: 1,
      llamadas: 1,
      sms: 0,
      cursos: { [ccode]: 1 },
      riesgos: riesgoIds.reduce((acc, id) => { acc[id] = 1; return acc; }, {}),
      priorities: { [prio]: 1 },
    },
  };

  return {
    year: Number(year || 2026),
    daily_cap: 500,
    total_patients: 1,
    total_eligible_year: 1,
    no_risk_count: riesgoIds.length === 0 ? 1 : 0,
    censo_by_curso: censoByCurso,
    censo_by_riesgo: censoByRiesgo,
    cursos_matrix: cursosMatrix,
    riesgos_matrix: riesgosMatrix,
    priority_matrix: priorityMatrix,
    daily_breakdown: dailyBreakdown,
    holidays: [],
  };
}

export function getCachedSandboxPatient() {
  return cachedSinglePatient;
}

/**
 * Envuelve el cliente Supabase ÚNICAMENTE cuando VITE_LOCAL_SINGLE_PATIENT_DOC está configurado.
 */
export function wrapSupabaseForLocalSinglePatient(rawClient) {
  if (!LOCAL_SINGLE_DOC) return rawClient;

  const rawFrom = rawClient.from.bind(rawClient);
  const rawRpc = rawClient.rpc.bind(rawClient);

  const fetchSinglePatient = async (forceRefresh = false) => {
    if (cachedSinglePatient && !forceRefresh) return cachedSinglePatient;
    if (!cachedFetchPromise || forceRefresh) {
      cachedFetchPromise = rawFrom('patients')
        .select('*')
        .eq('document', LOCAL_SINGLE_DOC)
        .limit(1)
        .then(({ data, error }) => {
          if (!error && Array.isArray(data) && data.length > 0) {
            cachedSinglePatient = data[0];
            try {
              window.dispatchEvent(new CustomEvent('sadi:local-sandbox-patient-loaded', { detail: cachedSinglePatient }));
            } catch { /* ignore */ }
          }
          return cachedSinglePatient;
        })
        .catch(() => cachedSinglePatient);
    }
    return cachedFetchPromise;
  };

  // Pre-cargar inmediatamente en segundo plano
  fetchSinglePatient();

  // Envolver `.from('patients')` para que cualquier `select` local solo vea al paciente único
  rawClient.from = (table) => {
    const builder = rawFrom(table);
    if (table !== 'patients') return builder;

    const origSelect = builder.select.bind(builder);
    builder.select = (...args) => {
      const q = origSelect(...args);
      return q.eq('document', LOCAL_SINGLE_DOC);
    };
    return builder;
  };

  // Envolver `.rpc(...)` para todos los RPCs de censo/pacientes/cronograma/reportes
  rawClient.rpc = (fnName, params = {}, options) => {
    const intercepted = new Set([
      'get_patients_paginated',
      'get_patients_compact_batch',
      'get_dashboard_patient_demography',
      'get_staff_assignment_stats',
      'get_doctor_assigned_patients_paginated',
      'get_demanda_filter_options',
      'get_demanda_monthly_page',
      'get_cronograma_res3280_summary',
      'get_cronograma_cohort_paginated',
      'get_cronograma_day_patients_paginated',
      'get_segment_patients_paginated',
      'evaluate_all_segments_counts',
      'get_billing_nonzero_canales_patients',
      'get_reports_demanda_summary',
    ]);

    if (!intercepted.has(fnName)) {
      return rawRpc(fnName, params, options);
    }

    const promise = (async () => {
      const pat = await fetchSinglePatient(fnName === 'get_patients_paginated' || fnName === 'get_billing_nonzero_canales_patients');
      if (!pat) {
        return { data: null, error: { message: `Paciente de prueba local (CC ${LOCAL_SINGLE_DOC}) no encontrado en BD.` } };
      }

      const age = calcAge(pat.birthdate);
      const isMale = String(pat.sex || '').toLowerCase().startsWith('m');
      const isMinor = age < 18;
      const ccode = CURSO_KEY_TO_CODE[pat.curso_vida] || 'D';
      const riesgoIds = getPatientRiesgoIds(pat);
      const prio = riesgoIds.includes('1') ? 1 : riesgoIds.includes('3') ? 2 : riesgoIds.length > 0 ? 4 : 5;
      const todayDay = Number(getColombiaTodayIso().slice(8, 10)) || 1;

      switch (fnName) {
        case 'get_patients_paginated': {
          const cursoFilter = String(params?.p_curso_vida || 'todos').toLowerCase();
          const cursoOk = cursoFilter === 'todos' || cursoFilter === String(pat.curso_vida || '').toLowerCase();
          const searchOk = matchesSearch(pat, params?.p_search);
          const rows = (cursoOk && searchOk && Number(params?.p_page || 1) === 1)
            ? [{ ...pat, total_count: 1 }]
            : [];
          return { data: rows, error: null };
        }

        case 'get_patients_compact_batch': {
          const isFirst = !params?.p_last_id;
          return {
            data: {
              rows: isFirst ? [pat] : [],
              has_more: false,
              next_cursor: null,
            },
            error: null,
          };
        }

        case 'get_dashboard_patient_demography': {
          return {
            data: [{
              total_patients: 1,
              hombres: isMale && !isMinor ? 1 : 0,
              mujeres: !isMale && !isMinor ? 1 : 0,
              ninos: isMale && isMinor ? 1 : 0,
              ninas: !isMale && isMinor ? 1 : 0,
            }],
            error: null,
          };
        }

        case 'get_staff_assignment_stats': {
          return {
            data: {
              total_patients: 1,
              assigned_patients: pat.doctor_id ? 1 : 0,
              unassigned_patients: pat.doctor_id ? 0 : 1,
              by_curso: { [pat.curso_vida || 'juventud']: 1 },
            },
            error: null,
          };
        }

        case 'get_doctor_assigned_patients_paginated': {
          const searchOk = matchesSearch(pat, params?.p_search);
          const rows = (searchOk && Number(params?.p_page || 1) === 1) ? [{ ...pat, total_count: 1 }] : [];
          return { data: rows, error: null };
        }

        case 'get_demanda_filter_options': {
          const comuna = pat.comuna || 'Comuna 3';
          const barrio = pat.barrio || 'Centro';
          return {
            data: {
              total_cohort: 1,
              comunas: comuna ? [comuna] : [],
              barrios_por_comuna: comuna ? { [comuna]: barrio ? [barrio] : [] } : {},
              centros_poblados: pat.centro_poblado ? [pat.centro_poblado] : [],
              corregimientos: pat.corregimiento ? [pat.corregimiento] : [],
              veredas: pat.vereda ? [pat.vereda] : [],
              veredas_por_corregimiento: {},
              centros_poblados_por_corregimiento: {},
              conteo_por_tipo: {
                Activo: pat.tipo_usuario === 'Activo' ? 1 : 0,
                Nuevo: pat.tipo_usuario === 'Nuevo' ? 1 : 0,
                Inactivo: pat.tipo_usuario === 'Inactivo' ? 1 : 0,
              },
            },
            error: null,
          };
        }

        case 'get_demanda_monthly_page': {
          const searchOk = matchesSearch(pat, params?.p_search);
          const rows = (searchOk && Number(params?.p_page || 1) === 1)
            ? [{ ...pat, day_num: todayDay, prioridad_llamada: prio }]
            : [];
          return {
            data: {
              filtered_count: searchOk ? 1 : 0,
              rows,
            },
            error: null,
          };
        }

        case 'get_cronograma_res3280_summary': {
          return {
            data: buildSinglePatientSummary(pat, params?.p_year || 2026),
            error: null,
          };
        }

        case 'get_cronograma_cohort_paginated': {
          const pType = String(params?.p_type || '');
          const pKey = String(params?.p_item_key || '');
          let matchesCell = true;
          if (pType === 'curso_vida' && pKey) {
            matchesCell = pKey.toUpperCase() === ccode || pKey.toLowerCase() === String(pat.curso_vida || '').toLowerCase();
          } else if (pType === 'grupo_riesgo' && pKey) {
            matchesCell = riesgoIds.includes(pKey);
          }
          const searchOk = matchesSearch(pat, params?.p_search);
          const match = matchesCell && searchOk;
          return {
            data: {
              total_count: match ? 1 : 0,
              rows: (match && Number(params?.p_page || 1) === 1) ? [{ ...pat, edad: age }] : [],
            },
            error: null,
          };
        }

        case 'get_cronograma_day_patients_paginated': {
          const searchOk = matchesSearch(pat, params?.p_search);
          const rows = (searchOk && Number(params?.p_page || 1) === 1)
            ? [{
              ...pat,
              edad: age,
              prioridad_llamada: prio,
              accion_3280: 'Atención Integral en Salud para la Juventud',
              cups_3280: '890201-JUV',
              canal_asignado: 'Llamada IA (Voz)',
            }]
            : [];
          return {
            data: {
              day_total_all: 1,
              llamadas_ia: 1,
              sms_respaldo: 0,
              total_count: searchOk ? 1 : 0,
              priority_counts: { [String(prio)]: 1 },
              rows,
            },
            error: null,
          };
        }

        case 'get_segment_patients_paginated': {
          const rows = Number(params?.p_page || 1) === 1 ? [pat] : [];
          return {
            data: {
              total_count: 1,
              rows,
              demografia: {
                hombres: isMale && !isMinor ? 1 : 0,
                mujeres: !isMale && !isMinor ? 1 : 0,
                ninos: isMale && isMinor ? 1 : 0,
                ninas: !isMale && isMinor ? 1 : 0,
              },
            },
            error: null,
          };
        }

        case 'evaluate_all_segments_counts': {
          return { data: [], error: null };
        }

        case 'get_billing_nonzero_canales_patients': {
          return { data: [pat], error: null };
        }

        case 'get_reports_demanda_summary': {
          // Dejar pasar el resumen real pero sobreescribiendo total_patients = 1 si se necesita
          const realRes = await rawRpc(fnName, params, options);
          if (realRes?.data && typeof realRes.data === 'object') {
            return {
              data: {
                ...realRes.data,
                total_patients: 1,
                censo_total: 1,
              },
              error: null,
            };
          }
          return realRes;
        }

        default:
          return rawRpc(fnName, params, options);
      }
    })();

    return promise;
  };

  console.info(`🧪 [SADI LOCAL SANDBOX] Activo con 1 paciente único: CC ${LOCAL_SINGLE_DOC}`);
  return rawClient;
}
