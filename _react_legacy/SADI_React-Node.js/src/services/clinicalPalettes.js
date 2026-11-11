// ==============================================================================
// clinicalPalettes.js - CÓDIGO DE COLORES CLÍNICOS UNIFICADO RESOLUCIÓN 3280
// Asocia cada Curso de Vida y cada Grupo de Riesgo a un color único,
// usado en la matriz anual, los SVGs y la Regleta Anual de 365 días.
// ==============================================================================

export const CURSOS_VIDA_PALETTE = {
  'A': {
    id: 'A',
    key: 'primera_infancia',
    nombre: 'Primera Infancia',
    edadRango: '0 - 5 años',
    colorHex: '#EC4899', // Pink-500
    colorTailwind: 'pink-500',
    bgLight: 'bg-pink-50',
    border: 'border-pink-400',
    text: 'text-pink-700',
    badge: 'bg-pink-100 text-pink-800 border-pink-200'
  },
  'B': {
    id: 'B',
    key: 'infancia',
    nombre: 'Infancia',
    edadRango: '6 - 11 años',
    colorHex: '#F59E0B', // Amber-500
    colorTailwind: 'amber-500',
    bgLight: 'bg-amber-50',
    border: 'border-amber-400',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-900 border-amber-200'
  },
  'C': {
    id: 'C',
    key: 'adolescencia',
    nombre: 'Adolescencia',
    edadRango: '12 - 17 años',
    colorHex: '#F97316', // Orange-500
    colorTailwind: 'orange-500',
    bgLight: 'bg-orange-50',
    border: 'border-orange-400',
    text: 'text-orange-800',
    badge: 'bg-orange-100 text-orange-900 border-orange-200'
  },
  'D': {
    id: 'D',
    key: 'juventud',
    nombre: 'Juventud',
    edadRango: '18 - 28 años',
    colorHex: '#10B981', // Emerald-500
    colorTailwind: 'emerald-500',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-400',
    text: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-200'
  },
  'E': {
    id: 'E',
    key: 'adultez',
    nombre: 'Adultez',
    edadRango: '29 - 59 años',
    colorHex: '#2563EB', // Blue-600
    colorTailwind: 'blue-600',
    bgLight: 'bg-blue-50',
    border: 'border-blue-400',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-900 border-blue-200'
  },
  'F': {
    id: 'F',
    key: 'vejez',
    nombre: 'Vejez',
    edadRango: '60+ años',
    colorHex: '#6366F1', // Indigo-500
    colorTailwind: 'indigo-500',
    bgLight: 'bg-indigo-50',
    border: 'border-indigo-400',
    text: 'text-indigo-800',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-200'
  },
  'G': {
    id: 'G',
    key: 'preventivo_mujer',
    nombre: 'Preventivo Mujer',
    edadRango: '10 - 54 años',
    colorHex: '#D946EF', // Fuchsia-500
    colorTailwind: 'fuchsia-500',
    bgLight: 'bg-fuchsia-50',
    border: 'border-fuchsia-400',
    text: 'text-fuchsia-800',
    badge: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200'
  },
  'H': {
    id: 'H',
    key: 'planificacion_familiar',
    nombre: 'Planificación Familiar',
    edadRango: '13 - 49 años',
    colorHex: '#8B5CF6', // Purple-500
    colorTailwind: 'purple-500',
    bgLight: 'bg-purple-50',
    border: 'border-purple-400',
    text: 'text-purple-800',
    badge: 'bg-purple-100 text-purple-900 border-purple-200'
  },
  'I': {
    id: 'I',
    key: 'vacunacion_pai',
    nombre: 'Vacunación PAI',
    edadRango: '0 - 99 años',
    colorHex: '#06B6D4', // Cyan-500
    colorTailwind: 'cyan-500',
    bgLight: 'bg-cyan-50',
    border: 'border-cyan-400',
    text: 'text-cyan-800',
    badge: 'bg-cyan-100 text-cyan-900 border-cyan-200'
  },
  'J': {
    id: 'J',
    key: 'salud_oral',
    nombre: 'Salud Oral',
    edadRango: '6 meses a 99 años',
    colorHex: '#14B8A6', // Teal-500
    colorTailwind: 'teal-500',
    bgLight: 'bg-teal-50',
    border: 'border-teal-400',
    text: 'text-teal-800',
    badge: 'bg-teal-100 text-teal-900 border-teal-200'
  }
};

export const GRUPOS_RIESGO_PALETTE = {
  1: {
    id: 1,
    codigo: 'materno_perinatal',
    nombre: 'Población Materno-Perinatal',
    colorHex: '#F43F5E', // Rose-500
    colorTailwind: 'rose-500',
    bgLight: 'bg-rose-50',
    border: 'border-rose-400',
    text: 'text-rose-800',
    badge: 'bg-rose-100 text-rose-900 border-rose-200'
  },
  2: {
    id: 2,
    codigo: 'cardiovascular',
    nombre: 'Riesgo Cardiovascular, Metabólico y Renal',
    colorHex: '#EF4444', // Red-500
    colorTailwind: 'red-500',
    bgLight: 'bg-red-50',
    border: 'border-red-400',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-900 border-red-200'
  },
  3: {
    id: 3,
    codigo: 'respiratorio',
    nombre: 'Enfermedades Respiratorias Crónicas',
    colorHex: '#38BDF8', // Sky-400
    colorTailwind: 'sky-400',
    bgLight: 'bg-sky-50',
    border: 'border-sky-400',
    text: 'text-sky-800',
    badge: 'bg-sky-100 text-sky-900 border-sky-200'
  },
  4: {
    id: 4,
    codigo: 'cancer',
    nombre: 'Cáncer (Detección temprana y seguimiento)',
    colorHex: '#EAB308', // Yellow-500 (Gold)
    colorTailwind: 'yellow-500',
    bgLight: 'bg-yellow-50',
    border: 'border-yellow-400',
    text: 'text-yellow-900',
    badge: 'bg-yellow-100 text-yellow-900 border-yellow-200'
  },
  5: {
    id: 5,
    codigo: 'mental',
    nombre: 'Salud Mental y Sustancias Psicoactivas',
    colorHex: '#A855F7', // Purple-500
    colorTailwind: 'purple-500',
    bgLight: 'bg-purple-50',
    border: 'border-purple-400',
    text: 'text-purple-800',
    badge: 'bg-purple-100 text-purple-900 border-purple-200'
  },
  6: {
    id: 6,
    codigo: 'infecciosas',
    nombre: 'Enfermedades Infecciosas y Zoonóticas',
    colorHex: '#EA580C', // Orange-600
    colorTailwind: 'orange-600',
    bgLight: 'bg-orange-50',
    border: 'border-orange-400',
    text: 'text-orange-900',
    badge: 'bg-orange-100 text-orange-900 border-orange-200'
  },
  7: {
    id: 7,
    codigo: 'huerfanas',
    nombre: 'Enfermedades Huérfanas y Raras',
    colorHex: '#4F46E5', // Indigo-600
    colorTailwind: 'indigo-600',
    bgLight: 'bg-indigo-50',
    border: 'border-indigo-400',
    text: 'text-indigo-800',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-200'
  },
  8: {
    id: 8,
    codigo: 'nutricional',
    nombre: 'Alteraciones Nutricionales y del Crecimiento',
    colorHex: '#84CC16', // Lime-500
    colorTailwind: 'lime-500',
    bgLight: 'bg-lime-50',
    border: 'border-lime-400',
    text: 'text-lime-800',
    badge: 'bg-lime-100 text-lime-900 border-lime-200'
  },
  9: {
    id: 9,
    codigo: 'musculoesqueletico',
    nombre: 'Alteraciones Músculo-Esqueléticas y Articulares',
    colorHex: '#B45309', // Amber-700
    colorTailwind: 'amber-700',
    bgLight: 'bg-amber-50',
    border: 'border-amber-500',
    text: 'text-amber-900',
    badge: 'bg-amber-100 text-amber-950 border-amber-300'
  },
  10: {
    id: 10,
    codigo: 'salud_oral',
    nombre: 'Salud Bucal y Periodontal',
    colorHex: '#0D9488', // Teal-600
    colorTailwind: 'teal-600',
    bgLight: 'bg-teal-50',
    border: 'border-teal-400',
    text: 'text-teal-800',
    badge: 'bg-teal-100 text-teal-900 border-teal-200'
  }
};

export function getCursoVidaColor(idOrKey) {
  const norm = String(idOrKey || '').trim().toUpperCase();
  if (CURSOS_VIDA_PALETTE[norm]) return CURSOS_VIDA_PALETTE[norm];
  
  // Buscar por coincidencia parcial de texto
  const low = String(idOrKey || '').toLowerCase();
  for (const k in CURSOS_VIDA_PALETTE) {
    const item = CURSOS_VIDA_PALETTE[k];
    if (low.includes(item.key) || low.includes(item.nombre.toLowerCase())) {
      return item;
    }
  }
  return CURSOS_VIDA_PALETTE['E']; // Default Adultez
}

export function getGrupoRiesgoColor(idOrKey) {
  const norm = String(idOrKey || '').trim().toLowerCase();
  for (const k in GRUPOS_RIESGO_PALETTE) {
    const item = GRUPOS_RIESGO_PALETTE[k];
    if (String(item.id) === norm || norm.includes(item.codigo) || norm.includes(item.nombre.toLowerCase().slice(0, 10))) {
      return item;
    }
  }
  return GRUPOS_RIESGO_PALETTE[2]; // Default Cardiovascular
}

