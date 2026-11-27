import React, { useEffect, useRef, useState } from 'react';
import {
  getCachedSandboxPatient,
  getLocalSinglePatientDoc,
  isLocalSinglePatientMode,
} from '@/lib/localSinglePatientSandbox';
import {
  campaignDispatchService,
  formatDispatchSummary,
  isLocalCampaignAutoLaunchAllowed,
} from '@/services/campaignDispatchService';
import { useToast } from '@/components/ui/use-toast';

export default function LocalSandboxBanner() {
  const active = isLocalSinglePatientMode();
  const autoAllowed = isLocalCampaignAutoLaunchAllowed();
  const doc = getLocalSinglePatientDoc();
  const { toast } = useToast();
  const [patient, setPatient] = useState(() => getCachedSandboxPatient());
  const [emailStatus, setEmailStatus] = useState({ checked: false, configured: false, provider: null });
  const [launching, setLaunching] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    const handler = (ev) => {
      if (ev?.detail) setPatient(ev.detail);
    };
    window.addEventListener('sadi:local-sandbox-patient-loaded', handler);
    return () => window.removeEventListener('sadi:local-sandbox-patient-loaded', handler);
  }, [active]);

  // Verificar estado del proveedor de correo (SMTP/Resend local o servidor)
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    campaignDispatchService.checkEmailProviderStatus().then((st) => {
      if (!cancelled) setEmailStatus({ checked: true, ...st });
    });
    return () => { cancelled = true; };
  }, [active]);

  // Motor global de auto-lanzamiento EXCLUSIVO de Pruebas en Local (localhost + 1 paciente)
  const scanAndAutoLaunchLocalCampaigns = async (manualTrigger = false) => {
    if (!autoAllowed || runningRef.current) return;
    runningRef.current = true;
    if (manualTrigger) setLaunching(true);
    try {
      const raw = localStorage.getItem('sadi_campaigns_v2');
      const localList = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(localList) || localList.length === 0) {
        if (manualTrigger) {
          toast({
            title: 'Sin campañas locales para hoy',
            description: 'Crea una campaña con fecha de hoy en Cronograma o Campañas para probar el lanzamiento automático.',
          });
        }
        return;
      }

      const reports = await campaignDispatchService.runDueCampaignsForToday(localList);
      if (reports.length > 0) {
        for (const rep of reports) {
          toast({
            title: rep.allChannelsSucceeded
              ? `🚀 Campaña Local Lanzada: ${rep.campaignName}`
              : `⚡ Auto-Lanzamiento Local: ${rep.campaignName}`,
            description: formatDispatchSummary(rep),
            variant: rep.success ? 'default' : 'destructive',
          });
        }
      } else if (manualTrigger) {
        toast({
          title: '✅ Campañas de hoy al día',
          description: 'No hay canales pendientes por despachar automáticamente hoy. Si quieres re-probar, pulsa "Emitir Ahora" en la tarjeta.',
        });
      }
    } catch (e) {
      console.warn('Error en auto-lanzador local:', e);
    } finally {
      runningRef.current = false;
      if (manualTrigger) setLaunching(false);
    }
  };

  useEffect(() => {
    if (!autoAllowed) return;
    // 1. Revisar 1.8s después de abrir/recargar el aplicativo local (para disparar campañas ya creadas hoy)
    const initTimer = setTimeout(() => {
      scanAndAutoLaunchLocalCampaigns(false);
    }, 1800);

    // 2. Revisar cada vez que se cree/edite una campaña local
    const onUpdated = () => {
      setTimeout(() => scanAndAutoLaunchLocalCampaigns(false), 600);
    };
    window.addEventListener('sadi:campaigns-updated', onUpdated);

    // 3. Revisión periódica cada 25s (por si cambia la fecha o se añade configuración SMTP)
    const interval = setInterval(() => {
      scanAndAutoLaunchLocalCampaigns(false);
    }, 25000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
      window.removeEventListener('sadi:campaigns-updated', onUpdated);
    };
  }, [autoAllowed]);

  if (!active) return null;

  return (
    <div
      data-testid="local-sandbox-banner"
      className="w-full bg-amber-950 text-amber-100 border-b border-amber-700/80 px-4 py-1.5 text-[11px] font-semibold flex flex-wrap items-center justify-center gap-x-3 gap-y-1 z-50 relative"
    >
      <span className="inline-flex items-center gap-1.5 font-black text-amber-300 uppercase tracking-wider">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        PRUEBAS EN LOCAL · 1 PACIENTE
      </span>
      <span className="text-amber-100">
        {patient?.name || 'Cargando paciente...'} ({patient?.tipo_documento || 'CC'} {doc})
      </span>
      {patient?.phone && <span className="font-mono text-emerald-300">Tel: {patient.phone}</span>}
      {patient?.email && <span className="font-mono text-sky-300">Email: {patient.email}</span>}
      {autoAllowed && (
        <span className="px-2 py-0.5 rounded-full bg-emerald-900/80 border border-emerald-500/60 text-emerald-200 text-[10px] font-bold">
          Auto-Lanzador Local: Llamada + SMS + Correo (Sin WA · Prod bloqueada)
        </span>
      )}
      {emailStatus.checked && (
        <span
          className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
            emailStatus.configured
              ? 'bg-sky-900/80 border-sky-500/60 text-sky-200'
              : 'bg-rose-900/80 border-rose-500/60 text-rose-200'
          }`}
        >
          {emailStatus.configured ? `Correo: Listo (${emailStatus.provider})` : 'Correo: Falta SMTP/Resend'}
        </span>
      )}
      {autoAllowed && (
        <button
          type="button"
          onClick={() => scanAndAutoLaunchLocalCampaigns(true)}
          disabled={launching}
          className="px-2.5 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-[10px] transition-colors cursor-pointer disabled:opacity-60"
        >
          {launching ? 'Lanzando...' : 'Lanzar Pendientes Hoy'}
        </button>
      )}
    </div>
  );
}
