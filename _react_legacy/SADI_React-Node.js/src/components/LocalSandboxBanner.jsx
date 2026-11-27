import React, { useEffect, useState } from 'react';
import {
  getCachedSandboxPatient,
  getLocalSinglePatientDoc,
  isLocalSinglePatientMode,
} from '@/lib/localSinglePatientSandbox';

export default function LocalSandboxBanner() {
  const active = isLocalSinglePatientMode();
  const doc = getLocalSinglePatientDoc();
  const [patient, setPatient] = useState(() => getCachedSandboxPatient());

  useEffect(() => {
    if (!active) return;
    const handler = (ev) => {
      if (ev?.detail) setPatient(ev.detail);
    };
    window.addEventListener('sadi:local-sandbox-patient-loaded', handler);
    return () => window.removeEventListener('sadi:local-sandbox-patient-loaded', handler);
  }, [active]);

  if (!active) return null;

  return (
    <div
      data-testid="local-sandbox-banner"
      className="w-full bg-amber-950 text-amber-100 border-b border-amber-700/80 px-4 py-1.5 text-[11px] font-semibold flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 z-50 relative"
    >
      <span className="inline-flex items-center gap-1.5 font-black text-amber-300 uppercase tracking-wider">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        ENTORNO LOCAL · 1 PACIENTE DE PRUEBA
      </span>
      <span className="text-amber-100">
        {patient?.name || 'Cargando paciente...'} ({patient?.tipo_documento || 'CC'} {doc})
      </span>
      {patient?.phone && <span className="font-mono text-emerald-300">Tel: {patient.phone}</span>}
      {patient?.email && <span className="font-mono text-sky-300">Email: {patient.email}</span>}
      <span className="text-amber-300/90">
        Puerto GSM 13 (+573106783338) · Producción 142k intacta
      </span>
    </div>
  );
}
