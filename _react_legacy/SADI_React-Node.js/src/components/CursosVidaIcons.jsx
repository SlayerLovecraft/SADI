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
    {/* Bastón Geriátrico con Corazón de Longevidad */}
    <path d="M14 4a3 3 0 1 0-6 0v16" />
    <path d="M8 8h6" />
    <path d="M18 10a2.5 2.5 0 0 0-3.5 0l-.5.5-.5-.5a2.5 2.5 0 0 0-3.5 3.5l4 4 4-4a2.5 2.5 0 0 0 0-3.5z" fill="currentColor" fillOpacity="0.2" />
  </svg>
);

export const PreventivoMujerIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Lazo Rosa de Prevención Ca Cuello / Mama */}
    <path d="M12 2C8 2 7 6 7 9c0 4 5 11 5 13s5-9 5-13c0-3-1-7-5-7z" fill="currentColor" fillOpacity="0.15" />
    <path d="M9 11l6 6M15 11l-6 6" />
  </svg>
);

export const PlanificacionFamiliarIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Escudo con Pareja / Salud Reproductiva */}
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.15" />
    <circle cx="9" cy="10" r="1.5" />
    <circle cx="15" cy="10" r="1.5" />
    <path d="M7 15c0-1.5 1-2.5 2-2.5h6c1 0 2 1 2 2.5" />
  </svg>
);

export const VacunacionIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Jeringa Médica PAI */}
    <path d="m18 2 4 4" />
    <path d="m17 7 3-3" />
    <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" fill="currentColor" fillOpacity="0.15" />
    <path d="m9 11 4 4" />
    <path d="m5 19-3 3" />
    <path d="m14 4 6 6" />
  </svg>
);

export const SaludOralIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Diente Molar con Brillo */}
    <path d="M12 3c-3 0-5.5 1.5-6 4.5C5 12 7 19 8.5 21c1.5 2 2.5-1 3.5-3 1 2 2 5 3.5 3C17 19 19 12 18 7.5 17.5 4.5 15 3 12 3z" fill="currentColor" fillOpacity="0.15" />
    <path d="M18 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" />
  </svg>
);

/**
 * Iconos SVG para los 10 Grupos de Riesgo Priorizados
 */

export const MaternoPerinatalIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Madre y Bebé */}
    <circle cx="12" cy="6" r="3" fill="currentColor" fillOpacity="0.15" />
    <path d="M8 21v-4a4 4 0 0 1 4-4h1a4 4 0 0 1 4 4v4" />
    <circle cx="17" cy="13" r="2" fill="currentColor" />
  </svg>
);

export const CardiovascularIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Corazón con ECG */}
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="currentColor" fillOpacity="0.15" />
    <path d="M3.22 12H7l2-4 3 8 2-5 1.5 3h4.28" stroke="currentColor" strokeWidth="2.5" />
  </svg>
);

export const RespiratorioIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Pulmones */}
    <path d="M12 4v8" />
    <path d="M12 8c-3-2-8-1-8 5 0 5 4 8 8 7" fill="currentColor" fillOpacity="0.15" />
    <path d="M12 8c3-2 8-1 8 5 0 5-4 8-8 7" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

export const CancerIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Lazo de Prevención Oncológica */}
    <path d="M12 2C8 2 7 6 7 9c0 4 5 11 5 13s5-9 5-13c0-3-1-7-5-7z" fill="currentColor" fillOpacity="0.15" />
    <circle cx="12" cy="9" r="2" />
  </svg>
);

export const MentalIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Cerebro / Salud Mental */}
    <path d="M9.5 2A4.5 4.5 0 0 0 5 6.5c0 .77.2 1.5.55 2.14A4 4 0 0 0 4 12a4 4 0 0 0 2 3.46A4.5 4.5 0 0 0 10.5 20c.5 0 1-.08 1.5-.24" />
    <path d="M14.5 2A4.5 4.5 0 0 1 19 6.5c0 .77-.2 1.5-.55 2.14A4 4 0 0 1 20 12a4 4 0 0 1-2 3.46A4.5 4.5 0 0 1 13.5 20c-.5 0-1-.08-1.5-.24" fill="currentColor" fillOpacity="0.15" />
    <path d="M12 4v16" />
  </svg>
);

export const InfecciosasIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Escudo con Microorganismo / Virus */}
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.15" />
    <circle cx="12" cy="11" r="3" />
    <path d="M12 7v1M12 14v1M8 11h1M15 11h1" />
  </svg>
);

export const HuerfanasIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Doble Hélice ADN */}
    <path d="M4 18c6-2 10-6 16-8" />
    <path d="M4 6c6 2 10 6 16 8" />
    <path d="M7 7.5v9M12 9.5v5M17 11.5v5" />
  </svg>
);

export const NutricionalIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Manzana Saludable */}
    <path d="M12 6c-2.5-3-7-2-7 2 0 6 7 13 7 13s7-7 7-13c0-4-4.5-5-7-2z" fill="currentColor" fillOpacity="0.15" />
    <path d="M12 6V2c1.5 0 3 .5 3 2" />
  </svg>
);

export const MusculoesqueleticoIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Hueso / Articulación */}
    <path d="M17 5a2 2 0 0 0-2-2 2 2 0 0 0-1.7 1L8.7 13A2 2 0 0 0 6 13a2 2 0 0 0-1 3.4l.6.6a2 2 0 0 0 3.4-1l4.6-9A2 2 0 0 0 15 7a2 2 0 0 0 2-2z" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

export const SaludOralRiesgoIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Sonrisa / Diente */}
    <path d="M12 3c-3 0-5.5 1.5-6 4.5C5 12 7 19 8.5 21c1.5 2 2.5-1 3.5-3 1 2 2 5 3.5 3C17 19 19 12 18 7.5 17.5 4.5 15 3 12 3z" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

/**
 * Función utilitaria para obtener el icono de Curso de Vida por ID o clave
 */
export function getCursoVidaIcon(idOrKey, className = "w-5 h-5") {
  const norm = String(idOrKey || '').toLowerCase();
  if (norm === 'a' || norm.includes('primera')) return <PrimeraInfanciaIcon className={className} />;
  if (norm === 'b' || norm.includes('infancia')) return <InfanciaIcon className={className} />;
  if (norm === 'c' || norm.includes('adolescen')) return <AdolescenciaIcon className={className} />;
  if (norm === 'd' || norm.includes('juven')) return <JuventudIcon className={className} />;
  if (norm === 'e' || norm.includes('adult')) return <AdultezIcon className={className} />;
  if (norm === 'f' || norm.includes('vejez')) return <VejezIcon className={className} />;
  if (norm === 'g' || norm.includes('mujer') || norm.includes('preventivo')) return <PreventivoMujerIcon className={className} />;
  if (norm === 'h' || norm.includes('planificac')) return <PlanificacionFamiliarIcon className={className} />;
  if (norm === 'i' || norm.includes('vacun')) return <VacunacionIcon className={className} />;
  if (norm === 'j' || norm.includes('oral') || norm.includes('odonto')) return <SaludOralIcon className={className} />;
  return <PrimeraInfanciaIcon className={className} />;
}

/**
 * Función utilitaria para obtener el icono de Grupo de Riesgo por código o nombre
 */
export function getGrupoRiesgoIcon(idOrKey, className = "w-5 h-5") {
  const norm = String(idOrKey || '').toLowerCase();
  if (norm === '1' || norm.includes('materno') || norm.includes('parto')) return <MaternoPerinatalIcon className={className} />;
  if (norm === '2' || norm.includes('cardio') || norm.includes('metabol') || norm.includes('renal')) return <CardiovascularIcon className={className} />;
  if (norm === '3' || norm.includes('respira') || norm.includes('epoc') || norm.includes('asma')) return <RespiratorioIcon className={className} />;
  if (norm === '4' || norm.includes('cancer') || norm.includes('onco') || norm.includes('mama')) return <CancerIcon className={className} />;
  if (norm === '5' || norm.includes('mental') || norm.includes('sustanc')) return <MentalIcon className={className} />;
  if (norm === '6' || norm.includes('infec') || norm.includes('vih') || norm.includes('tb')) return <InfecciosasIcon className={className} />;
  if (norm === '7' || norm.includes('huerfa') || norm.includes('rara') || norm.includes('genet')) return <HuerfanasIcon className={className} />;
  if (norm === '8' || norm.includes('nutric') || norm.includes('obesi')) return <NutricionalIcon className={className} />;
  if (norm === '9' || norm.includes('musculo') || norm.includes('esquelet')) return <MusculoesqueleticoIcon className={className} />;
  if (norm === '10' || norm.includes('oral') || norm.includes('orofac')) return <SaludOralRiesgoIcon className={className} />;
  return <CardiovascularIcon className={className} />;
}
