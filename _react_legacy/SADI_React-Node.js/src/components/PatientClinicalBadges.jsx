// ==============================================================================
// PatientClinicalBadges.jsx - BADGES UNIVERSALES DE CURSO DE VIDA Y GRUPOS DE RIESGO
// Garantiza que en TODA vista de SADI donde aparezca un paciente se muestre:
//   1) Su Curso de Vida (7 Rutas oficiales A-G)
//   2) Sus Grupo(s) de Riesgo clínicos REALES (o "Sin grupo de riesgo", nunca inventados)
// ==============================================================================

import React from 'react';
import { getPatientCursoVida, getPatientGruposRiesgo } from '@/services/callCapacityService';

export function CursoVidaBadge({ patient, size = 'xs', showCode = true, className = '' }) {
  const cv = getPatientCursoVida(patient);
  const sizeCls =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-[11px]'
      : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold text-white whitespace-nowrap shadow-2xs ${sizeCls} ${className}`}
      style={{ backgroundColor: cv.colorHex }}
      title={`Curso de Vida Res. 3280: ${cv.id}. ${cv.nombre} (${cv.rango})`}
    >
      {showCode && <span className="opacity-90 font-black">{cv.id}.</span>}
      <span>{cv.nombre}</span>
    </span>
  );
}

export function GruposRiesgoBadges({
  patient,
  size = 'xs',
  maxVisible = 3,
  emptyLabel = 'Sin grupo de riesgo',
  className = '',
}) {
  const riesgos = getPatientGruposRiesgo(patient);
  const sizeCls =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-[11px]'
      : 'px-2 py-0.5 text-[10px]';

  if (riesgos.length === 0) {
    return (
      <span
        className={`inline-flex items-center rounded-full font-semibold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 whitespace-nowrap ${sizeCls} ${className}`}
        title="Sin grupo de riesgo clínico asignado en historia clínica"
      >
        {emptyLabel}
      </span>
    );
  }

  const visible = riesgos.slice(0, maxVisible);
  const hiddenCount = Math.max(0, riesgos.length - visible.length);
  const hiddenNames = riesgos.slice(maxVisible).map((r) => r.nombre).join(', ');

  return (
    <div className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {visible.map((rg) => (
        <span
          key={rg.id}
          className={`inline-flex items-center rounded-full font-bold text-white whitespace-nowrap max-w-[210px] truncate shadow-2xs ${sizeCls}`}
          style={{ backgroundColor: rg.colorHex }}
          title={`Grupo de Riesgo: ${rg.nombre}`}
        >
          <span className="truncate">{rg.nombre}</span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span
          className={`inline-flex items-center rounded-full font-bold border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 ${sizeCls}`}
          title={`Otros grupos de riesgo: ${hiddenNames}`}
        >
          +{hiddenCount} más
        </span>
      )}
    </div>
  );
}

export default function PatientClinicalBadges({
  patient,
  layout = 'inline',
  size = 'xs',
  maxRisks = 3,
  showLabels = false,
  className = '',
}) {
  if (layout === 'stacked') {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {showLabels && (
            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
              Curso:
            </span>
          )}
          <CursoVidaBadge patient={patient} size={size} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {showLabels && (
            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
              Riesgo:
            </span>
          )}
          <GruposRiesgoBadges patient={patient} size={size} maxVisible={maxRisks} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      <CursoVidaBadge patient={patient} size={size} />
      <GruposRiesgoBadges patient={patient} size={size} maxVisible={maxRisks} />
    </div>
  );
}
