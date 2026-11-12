// ==============================================================================
// cursoVidaConfig.js - CONFIGURACIÓN CENTRALIZADA DE CURSOS DE VIDA RES. 3280
// Incluye paletas de colores oficiales, gradientes psicológicos, badges y helpers
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
    pill: 'bg-white/10 text-slate-200 border-white/20'
  },
  todos: {
    id: 'todos',
    key: 'todos',
    letra: '★',
    nombre: 'Todos los Cursos de Vida',
    rango: 'Acceso Total Institucional (A - J)',
    colorHex: '#2563EB',
    gradient: 'from-blue-700 via-indigo-700 to-slate-900',
    bannerBorder: 'border-blue-400/40',
    badge: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800',
    pill: 'bg-white/20 text-blue-100 border-white/30'
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
    pill: 'bg-white/20 text-pink-100 border-white/30'
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
    pill: 'bg-white/20 text-amber-100 border-white/30'
  },
  adolescencia: {
    id: 'adolescencia',
    key: 'adolescencia',
    letra: 'C',
    nombre: 'Adolescencia',
    rango: '12 a 17 años',
    colorHex: '#F97316',
    gradient: 'from-orange-600 via-orange-700 to-red-900',
    bannerBorder: 'border-orange-400/40',
    badge: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800',
    pill: 'bg-white/20 text-orange-100 border-white/30'
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
    pill: 'bg-white/20 text-emerald-100 border-white/30'
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
    pill: 'bg-white/20 text-blue-100 border-white/30'
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
    pill: 'bg-white/20 text-indigo-100 border-white/30'
  },
  preventivo_mujer: {
    id: 'preventivo_mujer',
    key: 'preventivo_mujer',
    letra: 'G',
    nombre: 'Preventivo de la Mujer',
    rango: 'Ruta RIAMP & Ca Cuello/Mama',
    colorHex: '#D946EF',
    gradient: 'from-fuchsia-600 via-fuchsia-700 to-pink-900',
    bannerBorder: 'border-fuchsia-400/40',
    badge: 'bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300 dark:bg-fuchsia-950 dark:text-fuchsia-200 dark:border-fuchsia-800',
    pill: 'bg-white/20 text-fuchsia-100 border-white/30'
  },
  materno_perinatal: {
    id: 'materno_perinatal',
    key: 'materno_perinatal',
    letra: 'G',
    nombre: 'Preventivo de la Mujer',
    rango: 'Ruta RIAMP & Ca Cuello/Mama',
    colorHex: '#D946EF',
    gradient: 'from-fuchsia-600 via-fuchsia-700 to-pink-900',
    bannerBorder: 'border-fuchsia-400/40',
    badge: 'bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300 dark:bg-fuchsia-950 dark:text-fuchsia-200 dark:border-fuchsia-800',
    pill: 'bg-white/20 text-fuchsia-100 border-white/30'
  },
  planificacion_familiar: {
    id: 'planificacion_familiar',
    key: 'planificacion_familiar',
    letra: 'H',
    nombre: 'Planificación Familiar',
    rango: 'Salud Reproductiva',
    colorHex: '#8B5CF6',
    gradient: 'from-purple-600 via-purple-700 to-violet-900',
    bannerBorder: 'border-purple-400/40',
    badge: 'bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800',
    pill: 'bg-white/20 text-purple-100 border-white/30'
  },
  vacunacion: {
    id: 'vacunacion',
    key: 'vacunacion',
    letra: 'I',
    nombre: 'Vacunación PAI',
    rango: 'Esquema PAI Permanente',
    colorHex: '#06B6D4',
    gradient: 'from-cyan-600 via-cyan-700 to-blue-900',
    bannerBorder: 'border-cyan-400/40',
    badge: 'bg-cyan-100 text-cyan-950 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-800',
    pill: 'bg-white/20 text-cyan-100 border-white/30'
  },
  vacunacion_pai: {
    id: 'vacunacion_pai',
    key: 'vacunacion_pai',
    letra: 'I',
    nombre: 'Vacunación PAI',
    rango: 'Esquema PAI Permanente',
    colorHex: '#06B6D4',
    gradient: 'from-cyan-600 via-cyan-700 to-blue-900',
    bannerBorder: 'border-cyan-400/40',
    badge: 'bg-cyan-100 text-cyan-950 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-800',
    pill: 'bg-white/20 text-cyan-100 border-white/30'
  },
  salud_oral: {
    id: 'salud_oral',
    key: 'salud_oral',
    letra: 'J',
    nombre: 'Salud Oral',
    rango: 'Fluorización & Control Bucal',
    colorHex: '#14B8A6',
    gradient: 'from-teal-600 via-teal-700 to-emerald-900',
    bannerBorder: 'border-teal-400/40',
    badge: 'bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800',
    pill: 'bg-white/20 text-teal-100 border-white/30'
  }
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
  CURSO_VIDA_CONFIG.planificacion_familiar,
  CURSO_VIDA_CONFIG.vacunacion,
  CURSO_VIDA_CONFIG.salud_oral,
];

/**
 * Normaliza la columna cursos_vida_asignados desde PostgreSQL/JSON/texto a un arreglo único de IDs
 */
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
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Obtiene el tema visual y psicológico del doctor basado en sus cursos de vida asignados
 */
export function getDoctorLifeCourseTheme(cursosAsignados) {
  const cursos = normalizeCursosArray(cursosAsignados);
  if (cursos.length === 0) {
    return CURSO_VIDA_CONFIG.sin_asignacion;
  }
  if (cursos.includes('todos') || cursos.length >= 10) {
    return CURSO_VIDA_CONFIG.todos;
  }
  const first = cursos.find(c => c !== 'todos' && c !== 'sin_asignacion') || cursos[0];
  return CURSO_VIDA_CONFIG[first] || CURSO_VIDA_CONFIG.sin_asignacion;
}

/**
 * Formatea en texto legible los Cursos de Vida asignados
 */
export function formatCursosVidaLabel(cursosAsignados) {
  const cursos = normalizeCursosArray(cursosAsignados);
  if (cursos.length === 0) {
    return 'Sin Asignación';
  }
  if (cursos.includes('todos') || cursos.length >= 10) {
    return 'Todos los Cursos de Vida (A - J)';
  }
  return cursos
    .filter(c => c !== 'todos' && c !== 'sin_asignacion')
    .map(cId => {
      const cfg = CURSO_VIDA_CONFIG[cId];
      return cfg ? `${cfg.letra}. ${cfg.nombre}` : cId;
    })
    .join(', ');
}

