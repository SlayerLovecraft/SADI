import React from 'react';

/**
 * Iconos SVG de alta definición para los 10 Cursos de Vida (Resolución 3280)
 */

export const PrimeraInfanciaIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Chupete / Bebé */}
    <circle cx="12" cy="8" r="5" stroke="currentColor" fill="currentColor" fillOpacity="0.15" />
    <path d="M10 13v2a2 2 0 0 0 4 0v-2" />
    <circle cx="12" cy="18" r="3" stroke="currentColor" />
    <circle cx="10" cy="7" r="0.75" fill="currentColor" />
    <circle cx="14" cy="7" r="0.75" fill="currentColor" />
    <path d="M11 9.5c.5.5 1.5.5 2 0" />
  </svg>
);

export const InfanciaIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Mochila escolar / Niñez */}
    <rect x="5" y="7" width="14" height="14" rx="3" stroke="currentColor" fill="currentColor" fillOpacity="0.15" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    <path d="M5 12h14" />
    <rect x="9" y="14" width="6" height="4" rx="1" stroke="currentColor" />
  </svg>
);

export const AdolescenciaIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Audífonos / Juventud */}
    <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" fill="currentColor" fillOpacity="0.15" />
    <path d="M12 4v2" />
  </svg>
);

export const JuventudIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Birrete Universitario / Graduación */}
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" fill="currentColor" fillOpacity="0.15" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

export const AdultezIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Maletín Ejecutivo / Persona Laboral */}
    <rect x="2" y="7" width="20" height="14" rx="2" fill="currentColor" fillOpacity="0.15" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const VejezIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Bastón de Apoyo / Adulto Mayor */}
    <path d="M18 5a3 3 0 0 0-6 0v14a2 2 0 0 0 4 0V11" fill="currentColor" fillOpacity="0.15" />
    <circle cx="9" cy="6" r="3" stroke="currentColor" />
    <path d="M6 19a4 4 0 0 1 6-3.5" />
  </svg>
);

export const PreventivoMujerIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Símbolo Femenino / Cinta de Prevención Cáncer Rosa */}
    <circle cx="12" cy="9" r="6" stroke="currentColor" fill="currentColor" fillOpacity="0.15" />
    <path d="M12 15v7M9 19h6" />
  </svg>
);

export const PlanificacionFamiliarIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Pareja / Escudo Familia */}
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.15" />
    <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0" />
    <path d="M12 15v3" />
  </svg>
);

export const VacunacionIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Jeringa / Vacuna PAI */}
    <path d="m18 2 4 4-2 2-4-4 2-2zM15 5l-8 8v4h4l8-8-4-4zM2 22l4-4M10 10l-3 3" />
  </svg>
);

export const SaludOralIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Diente Molar / Odontología */}
    <path d="M12 3c-3 0-5.5 1.5-6 4.5C5 12 7 19 8.5 21c1.5 2 2.5-1 3.5-3 1 2 2 5 3.5 3C17 19 19 12 18 7.5 17.5 4.5 15 3 12 3z" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

/**
 * Iconos SVG de alta definición para los 10 Grupos de Riesgo Priorizados
 */

export const MaternoPerinatalIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Gestante / Corazón Materno */}
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="currentColor" fillOpacity="0.15" />
    <circle cx="12" cy="11" r="2.5" fill="currentColor" />
  </svg>
);

export const CardiovascularIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Electrocardiograma / Pulso Cardíaco */}
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

export const RespiratorioIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Pulmones */}
    <path d="M12 4v8M12 7c-2-2-5-3-7-3a5 5 0 0 0-5 5c0 6 5 11 9 11h3c4 0 9-5 9-11a5 5 0 0 0-5-5c-2 0-5 1-7 3" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

export const CancerIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Lazo Oncológico */}
    <path d="M12 2a5 5 0 0 0-5 5c0 2 1.5 4 3 6l-4 9h3l3-7 3 7h3l-4-9c1.5-2 3-4 3-6a5 5 0 0 0-5-5z" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

export const MentalIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Cerebro / Salud Mental */}
    <path d="M9.5 2A4.5 4.5 0 0 0 5 6.5c0 .77.2 1.5.54 2.14A4.5 4.5 0 0 0 3 12.5a4.5 4.5 0 0 0 2.54 4.02C5.2 17.15 5 17.8 5 18.5A3.5 3.5 0 0 0 8.5 22h3V2h-2z" fill="currentColor" fillOpacity="0.15" />
    <path d="M14.5 2A4.5 4.5 0 0 1 19 6.5c0 .77-.2 1.5-.54 2.14A4.5 4.5 0 0 1 21 12.5a4.5 4.5 0 0 1-2.54 4.02c.34.63.54 1.28.54 1.98A3.5 3.5 0 0 1 15.5 22h-3V2h2z" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

export const InfecciosasIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Microbio / Virus / Bacteria */}
    <circle cx="12" cy="12" r="5" stroke="currentColor" fill="currentColor" fillOpacity="0.15" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
  </svg>
);

export const HuerfanasIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Cadena de ADN / Genética Rara */}
    <path d="m2 15 5-5M9 8l5-5M2 9l5 5M9 16l5 5M15 2l5 5M15 22l5-5" />
    <path d="m14 10 6-6M8 16l-6 6" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

export const NutricionalIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Manzana Saludable / Nutrición */}
    <path d="M12 2a3 3 0 0 0-3 3c0 .3.05.6.14.88C6.6 6.3 4 8.8 4 12c0 4.5 3.5 9 8 9s8-4.5 8-9c0-3.2-2.6-5.7-5.14-6.12.1-.28.14-.58.14-.88a3 3 0 0 0-3-3z" fill="currentColor" fillOpacity="0.15" />
    <path d="M12 5V2" />
  </svg>
);

export const MusculoesqueleticoIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Hueso / Articulación */}
    <path d="M17.5 4a2.5 2.5 0 0 1 2.5 2.5c0 .6-.2 1.1-.5 1.5l-9.5 9.5c-.4.3-.9.5-1.5.5A2.5 2.5 0 0 1 6 15.5c0-.6.2-1.1.5-1.5l9.5-9.5c.4-.3.9-.5 1.5-.5z" fill="currentColor" fillOpacity="0.15" />
    <circle cx="6.5" cy="17.5" r="2.5" />
    <circle cx="17.5" cy="6.5" r="2.5" />
  </svg>
);

export const SaludOralRiesgoIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Sonrisa / Diente */}
    <path d="M12 3c-3 0-5.5 1.5-6 4.5C5 12 7 19 8.5 21c1.5 2 2.5-1 3.5-3 1 2 2 5 3.5 3C17 19 19 12 18 7.5 17.5 4.5 15 3 12 3z" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

/**
 * Función utilitaria para obtener el componente de icono de Curso de Vida por ID o clave
 */
export function getCursoVidaIcon(idOrKey) {
  const norm = String(idOrKey || '').toLowerCase();
  if (norm === 'a' || norm.includes('primera')) return PrimeraInfanciaIcon;
  if (norm === 'b' || norm.includes('infancia')) return InfanciaIcon;
  if (norm === 'c' || norm.includes('adolescen')) return AdolescenciaIcon;
  if (norm === 'd' || norm.includes('juven')) return JuventudIcon;
  if (norm === 'e' || norm.includes('adult')) return AdultezIcon;
  if (norm === 'f' || norm.includes('vejez')) return VejezIcon;
  if (norm === 'g' || norm.includes('mujer') || norm.includes('preventivo')) return PreventivoMujerIcon;
  if (norm === 'h' || norm.includes('planificac')) return PlanificacionFamiliarIcon;
  if (norm === 'i' || norm.includes('vacun')) return VacunacionIcon;
  if (norm === 'j' || norm.includes('oral') || norm.includes('odonto')) return SaludOralIcon;
  return PrimeraInfanciaIcon;
}

/**
 * Función utilitaria para obtener el componente de icono de Grupo de Riesgo por código o nombre
 */
export function getGrupoRiesgoIcon(idOrKey) {
  const norm = String(idOrKey || '').toLowerCase();
  if (norm === '1' || norm.includes('materno') || norm.includes('parto')) return MaternoPerinatalIcon;
  if (norm === '2' || norm.includes('cardio') || norm.includes('metabol') || norm.includes('renal')) return CardiovascularIcon;
  if (norm === '3' || norm.includes('respira') || norm.includes('epoc') || norm.includes('asma')) return RespiratorioIcon;
  if (norm === '4' || norm.includes('cancer') || norm.includes('onco') || norm.includes('mama')) return CancerIcon;
  if (norm === '5' || norm.includes('mental') || norm.includes('sustanc')) return MentalIcon;
  if (norm === '6' || norm.includes('infec') || norm.includes('vih') || norm.includes('tb')) return InfecciosasIcon;
  if (norm === '7' || norm.includes('huerfa') || norm.includes('rara') || norm.includes('genet')) return HuerfanasIcon;
  if (norm === '8' || norm.includes('nutric') || norm.includes('obesi')) return NutricionalIcon;
  if (norm === '9' || norm.includes('musculo') || norm.includes('esquelet')) return MusculoesqueleticoIcon;
  if (norm === '10' || norm.includes('oral') || norm.includes('orofac')) return SaludOralRiesgoIcon;
  return CardiovascularIcon;
}
