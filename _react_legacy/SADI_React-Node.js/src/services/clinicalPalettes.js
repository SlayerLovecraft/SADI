// ==============================================================================
// clinicalPalettes.js - PALETA DE COLORES CLÍNICOS UNIFICADOS SADI
// - 7 Cursos de Vida oficiales (A a G) de la Resolución 3280 de 2018
// - 11 Grupos de Riesgo Priorizados (1 a 11, incluyendo Planificación Familiar,
//   Vacunación PAI y Salud Oral reubicados desde antiguos H, I, J)
// ==============================================================================

export const CURSOS_VIDA_PALETTE = {
  A: {
    id: 'A',
    key: 'primera_infancia',
    nombre: 'Primera Infancia',
    rango: '7 días a 5 años',
    colorHex: '#EC4899', // Rose / Pink
    bgClass: 'bg-pink-600',
    bgSoft: 'bg-pink-50 dark:bg-pink-950/50',
    textClass: 'text-pink-700 dark:text-pink-300',
    borderClass: 'border-pink-300 dark:border-pink-800/60',
    badgeClass: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950/60 dark:text-pink-200 dark:border-pink-800',
  },
  B: {
    id: 'B',
    key: 'infancia',
    nombre: 'Infancia',
    rango: '6 a 11 años',
    colorHex: '#F59E0B', // Amber
    bgClass: 'bg-amber-500',
    bgSoft: 'bg-amber-50 dark:bg-amber-950/50',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-300 dark:border-amber-800/60',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
  },
  C: {
    id: 'C',
    key: 'adolescencia',
    nombre: 'Adolescencia',
    rango: '12 a 17 años',
    colorHex: '#EA580C', // Orange
    bgClass: 'bg-orange-600',
    bgSoft: 'bg-orange-50 dark:bg-orange-950/50',
    textClass: 'text-orange-700 dark:text-orange-300',
    borderClass: 'border-orange-300 dark:border-orange-800/60',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800',
  },
  D: {
    id: 'D',
    key: 'juventud',
    nombre: 'Juventud',
    rango: '18 a 28 años',
    colorHex: '#10B981', // Emerald
    bgClass: 'bg-emerald-600',
    bgSoft: 'bg-emerald-50 dark:bg-emerald-950/50',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-300 dark:border-emerald-800/60',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
  },
  E: {
    id: 'E',
    key: 'adultez',
    nombre: 'Adultez',
    rango: '29 a 59 años',
    colorHex: '#2563EB', // Blue
    bgClass: 'bg-blue-600',
    bgSoft: 'bg-blue-50 dark:bg-blue-950/50',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-300 dark:border-blue-800/60',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800',
  },
  F: {
    id: 'F',
    key: 'vejez',
    nombre: 'Vejez',
    rango: '60+ años',
    colorHex: '#6366F1', // Indigo
    bgClass: 'bg-indigo-600',
    bgSoft: 'bg-indigo-50 dark:bg-indigo-950/50',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    borderClass: 'border-indigo-300 dark:border-indigo-800/60',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800',
  },
  G: {
    id: 'G',
    key: 'preventivo_mujer',
    nombre: 'Preventivo de la Mujer',
    rango: 'Materno-Perinatal / RIAMP',
    colorHex: '#E11D48', // Rose-600
    bgClass: 'bg-rose-600',
    bgSoft: 'bg-rose-50 dark:bg-rose-950/50',
    textClass: 'text-rose-700 dark:text-rose-300',
    borderClass: 'border-rose-300 dark:border-rose-800/60',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
  },
};

export const GRUPOS_RIESGO_PALETTE = {
  1: {
    id: 1,
    codigo: 'materno_perinatal',
    nombre: 'Población Materno-Perinatal',
    prioridad: 1,
    colorHex: '#E11D48',
    bgClass: 'bg-rose-600',
    bgSoft: 'bg-rose-50 dark:bg-rose-950/50',
    textClass: 'text-rose-700 dark:text-rose-300',
    borderClass: 'border-rose-300 dark:border-rose-800/60',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
  },
  2: {
    id: 2,
    codigo: 'cardiovascular',
    nombre: 'Riesgo Cardiovascular, Metabólico y Renal',
    prioridad: 4,
    colorHex: '#DC2626',
    bgClass: 'bg-red-600',
    bgSoft: 'bg-red-50 dark:bg-red-950/50',
    textClass: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-300 dark:border-red-800/60',
    badgeClass: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800',
  },
  3: {
    id: 3,
    codigo: 'cancer',
    nombre: 'Cáncer (Detección temprana y seguimiento)',
    prioridad: 2,
    colorHex: '#9333EA',
    bgClass: 'bg-purple-600',
    bgSoft: 'bg-purple-50 dark:bg-purple-950/50',
    textClass: 'text-purple-700 dark:text-purple-300',
    borderClass: 'border-purple-300 dark:border-purple-800/60',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800',
  },
  4: {
    id: 4,
    codigo: 'respiratorias',
    nombre: 'Enfermedades Respiratorias Crónicas',
    prioridad: 4,
    colorHex: '#0284C7',
    bgClass: 'bg-sky-600',
    bgSoft: 'bg-sky-50 dark:bg-sky-950/50',
    textClass: 'text-sky-700 dark:text-sky-300',
    borderClass: 'border-sky-300 dark:border-sky-800/60',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800',
  },
  5: {
    id: 5,
    codigo: 'salud_mental',
    nombre: 'Salud Mental y Sustancias Psicoactivas',
    prioridad: 4,
    colorHex: '#7C3AED',
    bgClass: 'bg-violet-600',
    bgSoft: 'bg-violet-50 dark:bg-violet-950/50',
    textClass: 'text-violet-700 dark:text-violet-300',
    borderClass: 'border-violet-300 dark:border-violet-800/60',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-800',
  },
  6: {
    id: 6,
    codigo: 'infecciosas',
    nombre: 'Enfermedades Infecciosas y Zoonóticas',
    prioridad: 4,
    colorHex: '#D97706',
    bgClass: 'bg-amber-600',
    bgSoft: 'bg-amber-50 dark:bg-amber-950/50',
    textClass: 'text-amber-800 dark:text-amber-300',
    borderClass: 'border-amber-300 dark:border-amber-800/60',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
  },
  7: {
    id: 7,
    codigo: 'nutricionales',
    nombre: 'Alteraciones Nutricionales y del Crecimiento',
    prioridad: 4,
    colorHex: '#16A34A',
    bgClass: 'bg-green-600',
    bgSoft: 'bg-green-50 dark:bg-green-950/50',
    textClass: 'text-green-700 dark:text-green-300',
    borderClass: 'border-green-300 dark:border-green-800/60',
    badgeClass: 'bg-green-100 text-green-900 border-green-300 dark:bg-green-950/60 dark:text-green-200 dark:border-green-800',
  },
  8: {
    id: 8,
    codigo: 'huerfanas_neurologicas',
    nombre: 'Enfermedades Huérfanas y Neurológicas',
    prioridad: 4,
    colorHex: '#4F46E5',
    bgClass: 'bg-indigo-600',
    bgSoft: 'bg-indigo-50 dark:bg-indigo-950/50',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    borderClass: 'border-indigo-300 dark:border-indigo-800/60',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800',
  },
  9: {
    id: 9,
    codigo: 'planificacion_familiar',
    nombre: 'Planificación Familiar',
    prioridad: 4,
    colorHex: '#DB2777',
    bgClass: 'bg-pink-600',
    bgSoft: 'bg-pink-50 dark:bg-pink-950/50',
    textClass: 'text-pink-700 dark:text-pink-300',
    borderClass: 'border-pink-300 dark:border-pink-800/60',
    badgeClass: 'bg-pink-100 text-pink-900 border-pink-300 dark:bg-pink-950/60 dark:text-pink-200 dark:border-pink-800',
  },
  10: {
    id: 10,
    codigo: 'vacunacion',
    nombre: 'Vacunación (Esquema PAI)',
    prioridad: 4,
    colorHex: '#059669',
    bgClass: 'bg-emerald-600',
    bgSoft: 'bg-emerald-50 dark:bg-emerald-950/50',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-300 dark:border-emerald-800/60',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
  },
  11: {
    id: 11,
    codigo: 'salud_oral',
    nombre: 'Salud Oral',
    prioridad: 4,
    colorHex: '#0891B2',
    bgClass: 'bg-cyan-600',
    bgSoft: 'bg-cyan-50 dark:bg-cyan-950/50',
    textClass: 'text-cyan-700 dark:text-cyan-300',
    borderClass: 'border-cyan-300 dark:border-cyan-800/60',
    badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-200 dark:border-cyan-800',
  },
};

export function getCursoVidaPalette(keyOrId) {
  if (!keyOrId) return CURSOS_VIDA_PALETTE.E;
  const upper = String(keyOrId).toUpperCase().trim();
  if (CURSOS_VIDA_PALETTE[upper]) return CURSOS_VIDA_PALETTE[upper];
  const low = String(keyOrId).toLowerCase().trim();
  if (low === 'materno_perinatal') return CURSOS_VIDA_PALETTE.G;
  for (const k in CURSOS_VIDA_PALETTE) {
    const item = CURSOS_VIDA_PALETTE[k];
    if (item.key === low || item.nombre.toLowerCase() === low) return item;
  }
  return CURSOS_VIDA_PALETTE.E;
}

// Clasificador estricto de paleta de Grupo de Riesgo: retorna NULL si no corresponde a un riesgo clínico real
export function getGrupoRiesgoPalette(idOrCodeOrName) {
  if (idOrCodeOrName === null || idOrCodeOrName === undefined || idOrCodeOrName === '') return null;
  if (GRUPOS_RIESGO_PALETTE[idOrCodeOrName]) return GRUPOS_RIESGO_PALETTE[idOrCodeOrName];

  const norm = String(idOrCodeOrName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (
    !norm ||
    norm.includes('preventiva general') ||
    norm.includes('sin grupo de riesgo') ||
    norm.includes('poblacion general') ||
    norm.includes('demanda inducida res')
  ) {
    return null;
  }

  for (const k in GRUPOS_RIESGO_PALETTE) {
    const item = GRUPOS_RIESGO_PALETTE[k];
    const itemNorm = item.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (item.codigo === norm || itemNorm === norm) return item;
  }

  if (norm.includes('materno') || norm.includes('gestan') || norm.includes('prenatal') || norm.includes('riamp') || norm.includes('puerper')) return GRUPOS_RIESGO_PALETTE[1];
  if (norm.includes('cardio') || norm.includes('hipertens') || norm.includes('diabet') || norm.includes('metab') || norm.includes('renal') || /\bhta\b/.test(norm)) return GRUPOS_RIESGO_PALETTE[2];
  if (norm.includes('cancer') || norm.includes('oncol')) return GRUPOS_RIESGO_PALETTE[3];
  if (norm.includes('respira') || norm.includes('asma') || norm.includes('epoc') || norm.includes('bronqu')) return GRUPOS_RIESGO_PALETTE[4];
  if (norm.includes('mental') || norm.includes('sustanc') || norm.includes('psico') || norm.includes('depres') || norm.includes('ansied') || norm.includes('violen') || /\bspa\b/.test(norm)) return GRUPOS_RIESGO_PALETTE[5];
  if (norm.includes('infec') || norm.includes('zoonot') || /\bvih\b/.test(norm) || norm.includes('tubercul') || norm.includes('dengue')) return GRUPOS_RIESGO_PALETTE[6];
  if (norm.includes('nutric') || norm.includes('desnutr') || norm.includes('crecimiento') || norm.includes('anemia')) return GRUPOS_RIESGO_PALETTE[7];
  if (norm.includes('huerfan') || norm.includes('neurol') || norm.includes('epilep') || norm.includes('raras')) return GRUPOS_RIESGO_PALETTE[8];
  if (norm.includes('planific') || norm.includes('anticoncep') || norm.includes('reproductiv')) return GRUPOS_RIESGO_PALETTE[9];
  if (norm.includes('vacun') || norm.includes('esquema pai') || /\bpai\b/.test(norm)) return GRUPOS_RIESGO_PALETTE[10];
  if (norm.includes('salud oral') || norm.includes('salud_oral') || norm.includes('bucal') || norm.includes('odont') || norm.includes('fluor')) return GRUPOS_RIESGO_PALETTE[11];

  return null;
}
