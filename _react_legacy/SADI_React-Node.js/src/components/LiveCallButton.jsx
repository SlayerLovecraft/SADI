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

  return (
    <Button
      type="button"
      size={size}
      variant={pres.isBusy ? 'default' : variant}
      data-testid={testId}
      data-call-phase={state.phase}
      disabled={isDisabled}
      onClick={onClick}
      title={title || pres.label}
      className={`${className} ${pres.isBusy ? pres.toneClass : idleClassName} transition-all`}
    >
      <LiveCallStateIcon iconType={pres.iconType} className={iconClassName} />
      {(!compactIconOnly || pres.isBusy) && <span>{pres.label}</span>}
    </Button>
  );
}
