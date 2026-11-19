// ==============================================================================
// cursoVidaConfig.js - CONFIGURACIÓN CENTRALIZADA DE 7 CURSOS DE VIDA RES. 3280
// Cursos oficiales A-G (Primera Infancia, Infancia, Adolescencia, Juventud,
// Adultez, Vejez, Preventivo de la Mujer / Materno-Perinatal).
// Planificación Familiar, Vacunación PAI y Salud Oral pertenecen a Grupos de Riesgo.
// ==============================================================================

export const CURSO_VIDA_CONFIG = {
  sin_asignacion: {
    id: 'sin_asignacion',
    key: 'sin_asignacion',
    letra: '—',
    nombre: 'Sin Asignación',
    rango: 'Pendiente de asignación',
    colorHex: '#64748B',
    gradient: 'from-slate-700 via-slate-800 to-slate-900',
    bannerBorder: 'border-slate-500/40',
    badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    pill: 'bg-white/10 text-slate-200 border-white/20',
  },
  todos: {
    id: 'todos',
    key: 'todos',
    letra: '★',
    nombre: 'Todos los Cursos de Vida',
    rango: 'Acceso Total Institucional (7 Cursos · A - G)',
    colorHex: '#2563EB',
    gradient: 'from-blue-700 via-indigo-700 to-slate-900',
    bannerBorder: 'border-blue-400/40',
    badge: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800',
    pill: 'bg-white/20 text-blue-100 border-white/30',
  },
  primera_infancia: {
    id: 'primera_infancia',
    key: 'primera_infancia',
    letra: 'A',
    nombre: 'Primera Infancia',
    rango: '7 días a 5 años',
    colorHex: '#EC4899',
    gradient: 'from-pink-600 via-pink-700 to-rose-900',
    bannerBorder: 'border-pink-400/40',
    badge: 'bg-pink-100 text-pink-900 border-pink-300 dark:bg-pink-950 dark:text-pink-200 dark:border-pink-800',
    pill: 'bg-white/20 text-pink-100 border-white/30',
  },
  infancia: {
    id: 'infancia',
    key: 'infancia',
    letra: 'B',
    nombre: 'Infancia',
    rango: '6 a 11 años',
    colorHex: '#F59E0B',
    gradient: 'from-amber-600 via-amber-700 to-orange-900',
    bannerBorder: 'border-amber-400/40',
    badge: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
    pill: 'bg-white/20 text-amber-100 border-white/30',
  },
  adolescencia: {
    id: 'adolescencia',
    key: 'adolescencia',
    letra: 'C',
    nombre: 'Adolescencia',
    rango: '12 a 17 años',
    colorHex: '#EA580C',
    gradient: 'from-orange-600 via-orange-700 to-red-900',
    bannerBorder: 'border-orange-400/40',
    badge: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800',
    pill: 'bg-white/20 text-orange-100 border-white/30',
  },
  juventud: {
    id: 'juventud',
    key: 'juventud',
    letra: 'D',
    nombre: 'Juventud',
    rango: '18 a 28 años',
    colorHex: '#10B981',
    gradient: 'from-emerald-600 via-emerald-700 to-teal-900',
    bannerBorder: 'border-emerald-400/40',
    badge: 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
    pill: 'bg-white/20 text-emerald-100 border-white/30',
  },
  adultez: {
    id: 'adultez',
    key: 'adultez',
    letra: 'E',
    nombre: 'Adultez',
    rango: '29 a 59 años',
    colorHex: '#2563EB',
    gradient: 'from-blue-600 via-blue-700 to-indigo-900',
    bannerBorder: 'border-blue-400/40',
    badge: 'bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800',
    pill: 'bg-white/20 text-blue-100 border-white/30',
  },
  vejez: {
    id: 'vejez',
    key: 'vejez',
    letra: 'F',
    nombre: 'Vejez',
    rango: '60+ años',
    colorHex: '#6366F1',
    gradient: 'from-indigo-600 via-indigo-700 to-purple-900',
    bannerBorder: 'border-indigo-400/40',
    badge: 'bg-indigo-100 text-indigo-950 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800',
    pill: 'bg-white/20 text-indigo-100 border-white/30',
  },
  preventivo_mujer: {
    id: 'preventivo_mujer',
    key: 'preventivo_mujer',
    letra: 'G',
    nombre: 'Preventivo de la Mujer',
    rango: 'Materno-Perinatal / RIAMP',
    colorHex: '#E11D48',
    gradient: 'from-rose-600 via-rose-700 to-pink-900',
    bannerBorder: 'border-rose-400/40',
    badge: 'bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
    pill: 'bg-white/20 text-rose-100 border-white/30',
  },
  materno_perinatal: {
    id: 'materno_perinatal',
    key: 'preventivo_mujer',
    letra: 'G',
    nombre: 'Preventivo de la Mujer',
    rango: 'Materno-Perinatal / RIAMP',
    colorHex: '#E11D48',
    gradient: 'from-rose-600 via-rose-700 to-pink-900',
    bannerBorder: 'border-rose-400/40',
    badge: 'bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
    pill: 'bg-white/20 text-rose-100 border-white/30',
  },
};

export const CURSOS_VIDA_LIST = [
  CURSO_VIDA_CONFIG.todos,
  CURSO_VIDA_CONFIG.primera_infancia,
  CURSO_VIDA_CONFIG.infancia,
  CURSO_VIDA_CONFIG.adolescencia,
  CURSO_VIDA_CONFIG.juventud,
  CURSO_VIDA_CONFIG.adultez,
  CURSO_VIDA_CONFIG.vejez,
  CURSO_VIDA_CONFIG.preventivo_mujer,
];

export const ALL_7_CURSOS_IDS = [
  'primera_infancia',
  'infancia',
  'adolescencia',
  'juventud',
  'adultez',
  'vejez',
  'preventivo_mujer',
];

export const CURSO_KEY_TO_CODE = {
  primera_infancia: 'A',
  infancia: 'B',
  adolescencia: 'C',
  juventud: 'D',
  adultez: 'E',
  vejez: 'F',
  preventivo_mujer: 'G',
};

export const CURSO_CODE_TO_KEY = {
  A: 'primera_infancia',
  B: 'infancia',
  C: 'adolescencia',
  D: 'juventud',
  E: 'adultez',
  F: 'vejez',
  G: 'preventivo_mujer',
};

export function normalizeCursosArray(raw) {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '{}' || trimmed === '[]') return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      const cleaned = trimmed.replace(/^\{|\}$/g, '');
      list = cleaned.split(',').map((s) => s.replace(/^["']|["']$/g, '').trim());
    }
  }
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const v = String(item || '').trim();
    if (v && v !== 'sin_asignacion' && !seen.has(v)) {
      if (v === 'todos' || CURSO_KEY_TO_CODE[v] || v === 'materno_perinatal') {
        const mapped = v === 'materno_perinatal' ? 'preventivo_mujer' : v;
        if (!seen.has(mapped)) {
          seen.add(mapped);
          out.push(mapped);
        }
      }
    }
  }
  return out;
}

export function getDoctorLifeCourseTheme(cursosAsignados) {
  const cursos = normalizeCursosArray(cursosAsignados);
  if (cursos.length === 0) {
    return CURSO_VIDA_CONFIG.sin_asignacion;
  }
  if (cursos.includes('todos') || cursos.length >= 7) {
    return CURSO_VIDA_CONFIG.todos;
  }
  const first = cursos.find((c) => c !== 'todos' && c !== 'sin_asignacion') || cursos[0];
  return CURSO_VIDA_CONFIG[first] || CURSO_VIDA_CONFIG.sin_asignacion;
}

export function formatCursosVidaLabel(cursosAsignados) {
  const cursos = normalizeCursosArray(cursosAsignados);
  if (cursos.length === 0) {
    return 'Sin Asignación';
  }
  if (cursos.includes('todos') || cursos.length >= 7) {
    return 'Todos los Cursos de Vida (A - G)';
  }
  return cursos
    .filter((c) => c !== 'todos' && c !== 'sin_asignacion')
    .map((cId) => {
      const cfg = CURSO_VIDA_CONFIG[cId];
      return cfg ? `${cfg.letra}. ${cfg.nombre}` : cId;
    })
    .join(', ');
}

export function canonicalizeCursoKey(raw) {
  if (raw === null || raw === undefined) return null;
  const norm = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (!norm || norm === 'sin_asignacion' || norm === 'general') return null;
  if (norm === 'todos' || norm.includes('todos los cursos')) return 'todos';

  const upper = norm.toUpperCase();
  if (CURSO_CODE_TO_KEY[upper]) return CURSO_CODE_TO_KEY[upper];

  const codePrefixMatch = norm.match(/^([a-g])(?:\.| -|:|\s|$)/);
  if (codePrefixMatch) {
    const code = codePrefixMatch[1].toUpperCase();
    if (CURSO_CODE_TO_KEY[code]) return CURSO_CODE_TO_KEY[code];
  }

  const snake = norm.replace(/[\s-]+/g, '_');
  if (CURSO_KEY_TO_CODE[snake]) return snake;
  if (snake === 'materno_perinatal') return 'preventivo_mujer';

  if (
    norm.includes('preventivo') ||
    norm.includes('mujer') ||
    norm.includes('materno') ||
    norm.includes('gestan') ||
    norm.includes('embaraz') ||
    norm.includes('riamp')
  ) {
    return 'preventivo_mujer';
  }
  if (norm.includes('primera') || norm.includes('0 a 5') || norm.includes('7 dias')) {
    return 'primera_infancia';
  }
  if (norm.includes('infancia') || norm.includes('6 a 11')) {
    return 'infancia';
  }
  if (norm.includes('adolesc') || norm.includes('12 a 17')) {
    return 'adolescencia';
  }
  if (norm.includes('juven') || norm.includes('18 a 28')) {
    return 'juventud';
  }
  if (norm.includes('adult') || norm.includes('29 a 59')) {
    return 'adultez';
  }
  if (norm.includes('vej') || norm.includes('mayor') || norm.includes('geriatr') || norm.includes('60')) {
    return 'vejez';
  }

  return null;
}

export function getAllowedCursoKeysForUser(user) {
  const allKeys = Object.keys(CURSO_KEY_TO_CODE);
  const allCodes = Object.values(CURSO_KEY_TO_CODE);

  if (!user) {
    return { restricted: true, hasAll: false, keys: [], keySet: new Set(), codeSet: new Set() };
  }

  const role = String(user.role || '').toLowerCase().trim();
  const GLOBAL_PORTAL_ADMIN_ROLES = new Set(['super_admin', 'operator', 'hospital_admin']);
  if (GLOBAL_PORTAL_ADMIN_ROLES.has(role)) {
    return {
      restricted: false,
      hasAll: true,
      keys: allKeys,
      keySet: new Set(allKeys),
      codeSet: new Set(allCodes),
    };
  }

  const rawList = normalizeCursosArray(user.cursos_vida_asignados);
  const canonicalKeys = [];
  const seen = new Set();
  let hasAll = false;

  for (const item of rawList) {
    const canon = canonicalizeCursoKey(item);
    if (canon === 'todos') {
      hasAll = true;
      break;
    }
    if (canon && CURSO_KEY_TO_CODE[canon] && !seen.has(canon)) {
      seen.add(canon);
      canonicalKeys.push(canon);
    }
  }

  if (hasAll || canonicalKeys.length >= 7) {
    return {
      restricted: false,
      hasAll: true,
      keys: allKeys,
      keySet: new Set(allKeys),
      codeSet: new Set(allCodes),
    };
  }

  const codeSet = new Set(canonicalKeys.map((k) => CURSO_KEY_TO_CODE[k]).filter(Boolean));
  return {
    restricted: true,
    hasAll: false,
    keys: canonicalKeys,
    keySet: new Set(canonicalKeys),
    codeSet,
  };
}

export function getCampaignCursoKeys(campaign) {
  if (!campaign) return [];
  const keys = [];
  const seen = new Set();

  const pushRaw = (val) => {
    const canon = canonicalizeCursoKey(val);
    if (canon && canon !== 'todos' && CURSO_KEY_TO_CODE[canon] && !seen.has(canon)) {
      seen.add(canon);
      keys.push(canon);
    }
  };

  if (Array.isArray(campaign.segmento_cursos)) {
    campaign.segmento_cursos.forEach(pushRaw);
  }
  if (Array.isArray(campaign.cursos_vida)) {
    campaign.cursos_vida.forEach(pushRaw);
  }

  pushRaw(campaign.curso_vida);
  pushRaw(campaign.curso_vida_id);
  pushRaw(campaign.edad_curso_vida);

  const tipoOrigen = String(campaign.tipo_origen || '').toLowerCase().trim();
  if (tipoOrigen !== 'grupo_riesgo') {
    pushRaw(campaign.origen_id);
    pushRaw(campaign.origen_nombre);
  }

  if (keys.length === 0 && Array.isArray(campaign.pacientes_detalle)) {
    campaign.pacientes_detalle.forEach((p) => {
      if (p) {
        pushRaw(p.curso_vida_key || p.curso_vida || p.program || p.programa);
      }
    });
  }

  return keys;
}

export function isCampaignAllowedForUser(campaign, user) {
  const access = getAllowedCursoKeysForUser(user);
  if (!access.restricted) return true;
  if (!campaign || access.keys.length === 0) return false;
  const campKeys = getCampaignCursoKeys(campaign);
  if (campKeys.length === 0) return false;
  return campKeys.some((k) => access.keySet.has(k));
}

function normalizePlainText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function computeAgeFromDate(birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) {
    age--;
  }
  return age;
}

/**
 * Clasifica un paciente estrictamente en uno de los 7 Cursos de Vida (A - G).
 */
export function classifyPatientCursoVidaKey(patient) {
  if (!patient) return 'adultez';

  const explicitKey = canonicalizeCursoKey(patient.curso_vida_key || patient.cursoVidaId);
  if (explicitKey && explicitKey === 'preventivo_mujer') {
    return 'preventivo_mujer';
  }

  const rawCurso = patient.curso_vida || patient.cursoVida || patient.ciclo_vida || patient.grupo_vida || '';
  const normCurso = normalizePlainText(rawCurso);

  if (normCurso.includes('mujer') || normCurso.includes('materno') || normCurso.includes('gestan') || normCurso === 'g') {
    return 'preventivo_mujer';
  }

  if (patient.es_gestante === true) return 'preventivo_mujer';

  const pProg = normalizePlainText(patient.program || patient.programa || patient.program_raw || '');
  if (
    pProg &&
    (pProg.includes('embarazo') ||
      pProg.includes('materno') ||
      pProg.includes('gestan') ||
      pProg.includes('preeclampsia') ||
      pProg.includes('riamp') ||
      pProg.includes('preventivo de la mujer'))
  ) {
    return 'preventivo_mujer';
  }

  // Cálculo prioritario por edad cronológica si hay fecha de nacimiento
  let age = computeAgeFromDate(
    patient.birthdate || patient.fecha_nacimiento || patient.birth_date || patient.fechaNacimiento
  );
  if ((age === null || age === undefined) && patient.edad !== undefined && patient.edad !== null && patient.edad !== '') {
    const numEdad = Number(patient.edad);
    if (Number.isFinite(numEdad)) age = numEdad;
  }
  if (age !== null && age !== undefined) {
    if (age <= 5) return 'primera_infancia';
    if (age <= 11) return 'infancia';
    if (age <= 17) return 'adolescencia';
    if (age <= 28) return 'juventud';
    if (age <= 59) return 'adultez';
    return 'vejez';
  }

  const lifeText = normCurso || pProg;
  if (lifeText.includes('primera') || lifeText === 'a' || lifeText.includes('0 a 5')) return 'primera_infancia';
  if ((lifeText.includes('infancia') && !lifeText.includes('primera')) || lifeText === 'b' || lifeText.includes('6 a 11')) return 'infancia';
  if (lifeText.includes('adolesc') || lifeText === 'c' || lifeText.includes('12 a 17')) return 'adolescencia';
  if (lifeText.includes('juven') || lifeText === 'd' || lifeText.includes('18 a 28')) return 'juventud';
  if (lifeText.includes('adult') || lifeText === 'e' || lifeText.includes('29 a 59')) return 'adultez';
  if (lifeText.includes('vej') || lifeText.includes('mayor') || lifeText.includes('geriatr') || lifeText === 'f' || lifeText.includes('60')) return 'vejez';

  return 'adultez';
}
