// ==============================================================================
// CallTraceFallbackDock.jsx - VENTANA FLOTANTE NO-BLOQUEANTE DE RESPALDO
// Solo se muestra si el navegador bloqueó window.open() para la ventana
// independiente de logs. NO es un popup/modal (no bloquea clics ni el fondo)
// e incluye botón directo para abrir en ventana independiente y copiar el log.
// ==============================================================================

import React, { useEffect, useState, useRef } from 'react';
import { Copy, Check, ExternalLink, Minimize2, Maximize2, X, Terminal } from 'lucide-react';
import {
  callTraceLoggerService,
  buildAutoDiagnosis,
} from '@/services/callTraceLoggerService';

export default function CallTraceFallbackDock() {
  const [snap, setSnap] = useState(() => callTraceLoggerService.getSnapshot());
  const [minimized, setMinimized] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const streamRef = useRef(null);

  useEffect(() => {
    return callTraceLoggerService.subscribe((next) => setSnap(next));
  }, []);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [snap.activeTrace?.events?.length]);

  // Solo visible cuando window.open fue bloqueado por el navegador y existe al menos 1 traza
  if (!snap.windowBlocked || !snap.activeTrace) return null;

  const tr = snap.activeTrace;
  const diag = buildAutoDiagnosis(tr);

  const handleCopy = async () => {
    const res = await callTraceLoggerService.copyTraceToClipboard(tr.id);
    if (res?.ok) {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    }
  };

  return (
    <div
      data-testid="call-trace-fallback-dock"
      className="fixed bottom-4 right-4 z-[60] w-[460px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-700 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/90 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-xs font-extrabold truncate">
            Log de Llamada · {tr.patientName}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => callTraceLoggerService.openIndependentWindow()}
            title="Abrir en ventana independiente"
            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Ventana aparte
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title="Copiar reporte completo al portapapeles"
            className={`px-2 py-1 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
              justCopied || snap.clipboard?.ok
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
            }`}
          >
            {justCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {justCopied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            type="button"
            onClick={() => setMinimized((m) => !m)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            title={minimized ? 'Expandir' : 'Minimizar'}
          >
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => callTraceLoggerService.dismissFallbackDock()}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Cerrar panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="p-2.5 space-y-2">
          <div className="text-[11px] px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 leading-snug">
            <strong className="text-sky-300">Diagnóstico:</strong> {diag}
          </div>
          <div
            ref={streamRef}
            className="max-h-56 overflow-y-auto rounded bg-black/70 border border-slate-800 p-2 font-mono text-[10.5px] space-y-1"
          >
            {tr.events.map((ev, idx) => (
              <div key={idx} className="leading-snug text-slate-200">
                <span className="text-slate-500">[{ev.timeCo} +{(ev.elapsedMs / 1000).toFixed(1)}s]</span>{' '}
                <span className="text-sky-400 font-bold">[{ev.stage}]</span>{' '}
                <span>{ev.message}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-amber-300/90">
            El navegador bloqueó la ventana independiente automática. Habilita ventanas emergentes para este sitio o pulsa <strong>Ventana aparte</strong>.
          </div>
        </div>
      )}
    </div>
  );
}
