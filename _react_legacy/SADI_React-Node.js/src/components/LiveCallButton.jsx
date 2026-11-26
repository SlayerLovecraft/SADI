// ==============================================================================
// LiveCallButton.jsx - BOTÓN Y HOOKS UNIVERSALES DE LLAMADA EN VIVO SADI
// Garantiza los 4 estados exactos en TODOS los botones de llamar del aplicativo:
//   - 'calling' -> Spinner + "Llamando" (permanece hasta que contesten)
//   - 'in_call' -> Pulso activo + "En Llamada..." (mientras están al teléfono)
//   - 'ending'  -> Spinner + "Finalizando Llamada" (3 segundos al colgar con éxito)
//   - 'failed'  -> Alerta + "Fallo al Contactar" (3 segundos si no contesta / error)
// ==============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, PhoneCall, PhoneOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { liveCallLifecycleService } from '@/services/liveCallLifecycleService';
import { callTraceLoggerService } from '@/services/callTraceLoggerService';

/**
 * Hook global para suscribirse al estado de llamadas activas y lanzar llamadas reales.
 */
export function useLiveCall() {
  const [callMap, setCallMap] = useState(() => liveCallLifecycleService.getSnapshot());

  useEffect(() => {
    return liveCallLifecycleService.subscribeCalls((nextMap) => {
      setCallMap(nextMap);
    });
  }, []);

  const getCallState = useCallback(
    (key) => callMap.get(String(key || '')) || { phase: 'idle' },
    [callMap]
  );

  const startCall = useCallback((options) => {
    return liveCallLifecycleService.executeLiveCall(options);
  }, []);

  return { callMap, getCallState, startCall };
}

/**
 * Hook global para el contador diario en vivo (500 llamadas exitosas/día).
 */
export function useDailyCallQuota(hospitalId = null) {
  const [quota, setQuota] = useState(() => liveCallLifecycleService.getQuotaSnapshot());

  useEffect(() => {
    const unsub = liveCallLifecycleService.subscribeQuota((next) => setQuota(next));
    liveCallLifecycleService.refreshDailyQuota(hospitalId);
    return unsub;
  }, [hospitalId]);

  const refresh = useCallback(
    () => liveCallLifecycleService.refreshDailyQuota(hospitalId),
    [hospitalId]
  );

  return { ...quota, refresh };
}

/**
 * Insignia unificada de Cupo Diario Disponible en Tiempo Real (500/día).
 * Descuenta automáticamente: Resolución 3280 hoy + Campañas activas hoy + Llamadas exitosas hoy.
 */
export function DailyQuotaBadge({
  quota,
  testId = 'daily-quota-badge',
  variant = 'soft', // 'soft' | 'hero' | 'inline'
  showBreakdown = true,
  className = '',
}) {
  const dailyCap = Number(quota?.dailyCap ?? 500);
  const remaining = Math.max(0, Number(quota?.remainingToday ?? dailyCap));
  const resCount = Math.max(0, Number(quota?.reservedResolucion ?? 0));
  const campCount = Math.max(0, Number(quota?.reservedCampaigns ?? 0));
  const usedCount = Math.max(0, Number(quota?.usedToday ?? 0));
  const loaded = Boolean(quota?.loaded);

  const tooltip = loaded
    ? `Tope diario: ${dailyCap} llamadas | Res. 3280 hoy: -${resCount} | Campañas hoy: -${campCount} | Exitosas hoy: -${usedCount} | Disponibles ahora: ${remaining} de ${dailyCap}`
    : 'Consultando disponibilidad real del día (Res. 3280 + Campañas + Llamadas)...';

  const statusTone =
    !loaded
      ? variant === 'hero'
        ? 'bg-white/10 text-slate-200 border-white/20'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
      : remaining === 0
      ? variant === 'hero'
        ? 'bg-rose-500/25 text-rose-200 border-rose-400/50'
        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70'
      : remaining <= 50
      ? variant === 'hero'
        ? 'bg-amber-500/25 text-amber-200 border-amber-400/50'
        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
      : variant === 'hero'
      ? 'bg-cyan-500/20 text-cyan-100 border-cyan-400/40'
      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70';

  if (variant === 'inline') {
    return (
      <p
        data-testid={testId}
        title={tooltip}
        className={`text-[11px] font-bold mt-0.5 ${
          remaining === 0
            ? 'text-rose-600 dark:text-rose-400'
            : remaining <= 50
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-blue-700 dark:text-blue-300'
        } ${className}`}
      >
        {loaded ? (
          <>
            Disponibles hoy: <strong>{remaining}</strong> de {dailyCap}
            {showBreakdown && (
              <span className="font-normal opacity-85 ml-1">
                (Res. 3280: {resCount} · Camp.: {campCount} · Indiv.: {usedCount})
              </span>
            )}
          </>
        ) : (
          'Calculando disponibles hoy...'
        )}
      </p>
    );
  }

  return (
    <span
      data-testid={testId}
      title={tooltip}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${statusTone} ${className}`}
    >
      <PhoneCall className="w-3.5 h-3.5 shrink-0 opacity-85" />
      {loaded ? (
        <span className="flex items-center gap-1.5 flex-wrap">
          <span>
            Disponibles hoy: <strong className="font-black">{remaining}</strong> de {dailyCap}
          </span>
          {showBreakdown && (
            <span className="text-[10px] font-semibold opacity-80 hidden sm:inline">
              (Res. 3280: {resCount} · Camp.: {campCount}
              {usedCount > 0 ? ` · Realizadas: ${usedCount}` : ''})
            </span>
          )}
        </span>
      ) : (
        <span>Calculando cupo hoy...</span>
      )}
    </span>
  );
}

/**
 * Presentación visual estandarizada según la fase de la llamada.
 */
export function getLiveCallPresentation(phase, idleLabel = 'Llamar') {
  switch (phase) {
    case 'calling':
      return {
        label: 'Llamando',
        isBusy: true,
        iconType: 'spinner',
        toneClass:
          'bg-amber-500 hover:bg-amber-500 text-white border-amber-500 dark:bg-amber-600 dark:border-amber-500 dark:text-white',
      };
    case 'in_call':
      return {
        label: 'En Llamada...',
        isBusy: true,
        iconType: 'live',
        toneClass:
          'bg-emerald-600 hover:bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400/50 animate-pulse',
      };
    case 'ending':
      return {
        label: 'Finalizando Llamada',
        isBusy: true,
        iconType: 'ending',
        toneClass:
          'bg-indigo-600 hover:bg-indigo-600 text-white border-indigo-500 dark:bg-indigo-700 dark:text-white',
      };
    case 'failed':
      return {
        label: 'Fallo al Contactar',
        isBusy: true,
        iconType: 'failed',
        toneClass:
          'bg-rose-600 hover:bg-rose-600 text-white border-rose-500 dark:bg-rose-700 dark:text-white',
      };
    default:
      return {
        label: idleLabel,
        isBusy: false,
        iconType: 'phone',
        toneClass: '',
      };
  }
}

export function LiveCallStateIcon({ iconType, className = 'h-3.5 w-3.5 shrink-0' }) {
  if (iconType === 'spinner' || iconType === 'ending') {
    return <Loader2 className={`${className} animate-spin`} />;
  }
  if (iconType === 'failed') {
    return <PhoneOff className={className} />;
  }
  if (iconType === 'live') {
    return (
      <span className="relative inline-flex items-center justify-center shrink-0">
        <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-white opacity-75" />
        <PhoneCall className={className} />
      </span>
    );
  }
  return <PhoneCall className={className} />;
}

export default function LiveCallButton({
  callKey,
  idleLabel = 'Llamar',
  onClick,
  disabled = false,
  className = '',
  idleClassName = '',
  iconClassName = 'h-3.5 w-3.5 shrink-0',
  size = 'sm',
  variant = 'ghost',
  title = '',
  testId = 'live-call-btn',
  compactIconOnly = false,
}) {
  const { getCallState } = useLiveCall();
  const state = getCallState(callKey);
  const pres = getLiveCallPresentation(state.phase, idleLabel);
  const isDisabled = disabled || pres.isBusy;

  const handleClick = useCallback(
    (e) => {
      if (isDisabled) return;
      // Abrir ventana pequeña INDEPENDIENTE de log síncronamente dentro del clic del usuario
      callTraceLoggerService.onCallButtonClicked({
        buttonLabel: idleLabel,
        title,
        testId,
      });
      if (onClick) {
        onClick(e);
      }
    },
    [isDisabled, idleLabel, title, testId, onClick]
  );

  return (
    <Button
      type="button"
      size={size}
      variant={pres.isBusy ? 'default' : variant}
      data-testid={testId}
      data-call-phase={state.phase}
      disabled={isDisabled}
      onClick={handleClick}
      title={title || pres.label}
      className={`${className} ${pres.isBusy ? pres.toneClass : idleClassName} transition-all`}
    >
      <LiveCallStateIcon iconType={pres.iconType} className={iconClassName} />
      {(!compactIconOnly || pres.isBusy) && <span>{pres.label}</span>}
    </Button>
  );
}
