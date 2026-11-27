import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, CalendarCheck2, Building2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ConfirmAttendancePage() {
  const [searchParams] = useSearchParams();
  const actionParam = (searchParams.get('action') || '').toLowerCase().trim();
  const resultParam = (searchParams.get('result') || '').toLowerCase().trim();
  const traceId = (searchParams.get('traceId') || '').trim();
  const campaignParam = (searchParams.get('campaign') || '').trim();

  const [state, setState] = useState(() => {
    if (resultParam === 'confirmed') {
      return { status: 'confirmed', campaignName: campaignParam, error: null };
    }
    if (resultParam === 'declined') {
      return { status: 'declined', campaignName: campaignParam, error: null };
    }
    if (resultParam === 'invalid' || resultParam === 'error') {
      return { status: 'error', campaignName: campaignParam, error: 'El enlace de confirmación no es válido o ya expiró.' };
    }
    if (traceId && ['confirm', 'decline'].includes(actionParam)) {
      return { status: 'loading', campaignName: campaignParam, error: null };
    }
    return { status: 'error', campaignName: '', error: 'Enlace de confirmación incompleto.' };
  });

  const submitDecision = async (decision) => {
    if (!traceId) return;
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    try {
      const { data, error } = await supabase.functions.invoke('sync-campaign-responses', {
        body: {
          action: 'email_click',
          decision,
          traceId,
        },
      });
      if (error || !data?.ok) {
        setState({
          status: 'error',
          campaignName: campaignParam,
          error: data?.error || error?.message || 'No fue posible registrar tu respuesta en este momento.',
        });
        return;
      }
      setState({
        status: decision === 'confirm' ? 'confirmed' : 'declined',
        campaignName: data.campaignName || campaignParam,
        error: null,
      });
    } catch (e) {
      setState({
        status: 'error',
        campaignName: campaignParam,
        error: e?.message || 'Error de conexión al registrar tu respuesta.',
      });
    }
  };

  useEffect(() => {
    if (!resultParam && traceId && ['confirm', 'decline'].includes(actionParam)) {
      submitDecision(actionParam);
    }
  }, [traceId, actionParam, resultParam]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-emerald-50/30 flex flex-col items-center justify-center p-4 sm:p-6">
      <Helmet>
        <title>Confirmación de Asistencia · SADI Salud</title>
      </Helmet>

      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Cabecera Institucional */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-6 py-6 text-white text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[11px] font-bold tracking-wider uppercase mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Portal Oficial · SADI Salud
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">
            Hospital Central SADI
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Confirmación segura de asistencia a jornada de salud preventiva
          </p>
        </div>

        {/* Cuerpo */}
        <div className="p-7 sm:p-8 text-center space-y-5">
          {state.status === 'loading' && (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-blue-50 text-blue-600">
                <Loader2 className="w-9 h-9 animate-spin" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Registrando tu respuesta...
              </h2>
              <p className="text-sm text-slate-500">
                Por favor espera un segundo mientras confirmamos tu asistencia en el sistema.
              </p>
            </div>
          )}

          {state.status === 'confirmed' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-slate-900">
                  ¡Asistencia Confirmada!
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Muchas gracias por confirmar. Tu espacio de atención ha quedado reservado exitosamente en nuestro sistema.
                </p>
              </div>
              {state.campaignName && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-left flex items-start gap-3">
                  <CalendarCheck2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold text-emerald-900 uppercase tracking-wider text-[10px]">
                      Campaña confirmada
                    </div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                      {state.campaignName}
                    </div>
                  </div>
                </div>
              )}
              {traceId && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => submitDecision('decline')}
                    className="text-xs font-semibold text-slate-500 hover:text-rose-600 underline underline-offset-4 transition-colors"
                  >
                    ¿Te equivocaste? Cambiar respuesta a "No puedo asistir"
                  </button>
                </div>
              )}
            </>
          )}

          {state.status === 'declined' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
                <XCircle className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-slate-900">
                  Respuesta Registrada
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Hemos registrado que en esta oportunidad no podrás asistir. Gracias por informarnos; nuestro equipo de salud podrá reprogramar tu atención cuando lo requieras.
                </p>
              </div>
              {state.campaignName && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                      Campaña
                    </div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                      {state.campaignName}
                    </div>
                  </div>
                </div>
              )}
              {traceId && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => submitDecision('confirm')}
                    className="text-xs font-semibold text-slate-500 hover:text-emerald-600 underline underline-offset-4 transition-colors"
                  >
                    ¿Cambiaste de opinión? Confirmar mi asistencia
                  </button>
                </div>
              )}
            </>
          )}

          {state.status === 'error' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-slate-900">
                  No pudimos validar el enlace
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {state.error || 'Verifica que hayas abierto el enlace completo desde tu correo electrónico.'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Pie institucional */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500">
          Ya puedes cerrar esta ventana con tranquilidad. · <strong>SADI Salud</strong> · sadi.apropiatic.com.co
        </div>
      </div>
    </div>
  );
}
