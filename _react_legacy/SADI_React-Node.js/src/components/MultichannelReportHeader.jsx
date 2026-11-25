// ==============================================================================
// MultichannelReportHeader.jsx - REPORTES MULTICANAL SADI (RESOLUCIÓN 3280)
// 1. 4 Cards superiores con el total real del hospital por canal.
// 2. Matriz de Emisiones por Cursos de Vida (A - G): mutuamente excluyentes
//    (1 único Curso de Vida por paciente; suma exacta 100% del total del hospital).
// 3. Tabla independiente inferior: Volumen de Personas Contactadas por Grupos de
//    Riesgo (1 - 11), con encabezado explicativo de pertenencia múltiple.
// ==============================================================================

import React from 'react';
import {
  Phone,
  MessageSquare,
  Mail,
  Send,
  Info,
  ShieldAlert,
  Layers,
} from 'lucide-react';

export default function MultichannelReportHeader({ matrixData, loading = false }) {
  const totales = matrixData?.totales || {
    sms: 0,
    email: 0,
    call: 0,
    whatsapp: 0,
    general: 0,
  };

  const porCursoVida = matrixData?.porCursoVida || [];
  const porGrupoRiesgo = matrixData?.porGrupoRiesgo || [];

  const CHANNELS = [
    {
      id: 'sms',
      label: 'SMS Enviados',
      icon: MessageSquare,
      color: 'text-sky-700 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-slate-900',
      border: 'border-sky-200 dark:border-sky-800/60',
      iconBg: 'bg-white dark:bg-sky-950/60 dark:border dark:border-sky-800/50',
      total: totales.sms,
    },
    {
      id: 'email',
      label: 'E-mails Enviados',
      icon: Mail,
      color: 'text-indigo-700 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-slate-900',
      border: 'border-indigo-200 dark:border-indigo-800/60',
      iconBg: 'bg-white dark:bg-indigo-950/60 dark:border dark:border-indigo-800/50',
      total: totales.email,
    },
    {
      id: 'call',
      label: 'Llamadas Realizadas (Puerto 1)',
      icon: Phone,
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-slate-900',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      iconBg: 'bg-white dark:bg-emerald-950/60 dark:border dark:border-emerald-800/50',
      total: totales.call,
    },
    {
      id: 'whatsapp',
      label: 'Interacciones por WhatsApp',
      icon: Send,
      color: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-slate-900',
      border: 'border-green-200 dark:border-green-800/60',
      iconBg: 'bg-white dark:bg-green-950/60 dark:border dark:border-green-800/50',
      total: totales.whatsapp,
    },
  ];

  const getRiesgoRowVolume = (channelId) =>
    porGrupoRiesgo.reduce((acc, r) => acc + Number(r[channelId] || 0), 0);

  const totalRiesgoVolumeGeneral = CHANNELS.reduce(
    (acc, ch) => acc + getRiesgoRowVolume(ch.id),
    0
  );

  return (
    <div className="space-y-5">
      {/* 4 Cards de Métricas Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {CHANNELS.map((ch) => {
          const Icon = ch.icon;
          return (
            <div
              key={ch.id}
              className={`p-4 rounded-2xl border ${ch.bg} ${ch.border} shadow-2xs flex items-center justify-between gap-3 transition-colors`}
            >
              <div>
                <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                  {ch.label}
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">
                  {ch.total.toLocaleString('es-CO')}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {totales.general > 0 ? ((ch.total / totales.general) * 100).toFixed(1) : '0.0'}% de la demanda global
                </span>
              </div>
              <div className={`p-3 rounded-xl ${ch.iconBg} shadow-2xs ${ch.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TABLA 1: SOLO CURSOS DE VIDA (A - G) — ÚNICOS POR PACIENTE (1:1)      */}
      {/* ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-500/40">
                <Layers className="w-3 h-3" />
                Cursos de Vida (A - G)
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Reporte de Emisiones Multicanal por Curso de Vida
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-1">
              Desglose exacto en Supabase ({(matrixData?.realPatientsCount ?? 0).toLocaleString('es-CO')} pacientes) por los 7 Cursos de Vida oficiales. Cada paciente pertenece únicamente a 1 Curso de Vida, por lo que los totales cuadran al 100% con el volumen real del hospital.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center px-3 py-1 rounded-xl text-[11px] font-bold bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
            1 Curso único por paciente
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 bg-slate-200/80 dark:bg-slate-800 dark:text-slate-100 sticky left-0 z-10 min-w-[215px] border-r border-slate-200/70 dark:border-slate-700">
                  Canal de Demanda Inducida
                </th>
                {porCursoVida.map((c) => (
                  <th
                    key={c.id}
                    className="p-2.5 text-center min-w-[115px] border-r border-slate-200/60 dark:border-slate-700/70"
                  >
                    <span className="block text-[10px] font-black text-teal-800 dark:text-teal-400">
                      {c.id}
                    </span>
                    <span className="block text-[10px] truncate" title={c.nombre}>
                      {c.nombre}
                    </span>
                    <span className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                      {(c.totalCenso ?? 0).toLocaleString('es-CO')} pac.
                    </span>
                  </th>
                ))}
                <th className="p-3 text-right bg-slate-200/90 dark:bg-slate-800 dark:text-white font-black min-w-[115px]">
                  Total Canal
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                return (
                  <tr key={ch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 sticky left-0 z-10 border-r border-slate-200/70 dark:border-slate-800 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${ch.color}`} />
                        <span>{ch.label}</span>
                      </div>
                    </td>

                    {porCursoVida.map((c) => (
                      <td
                        key={c.id}
                        className="p-2.5 text-center font-mono text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800 font-semibold"
                      >
                        {(c[ch.id] || 0).toLocaleString('es-CO')}
                      </td>
                    ))}

                    <td className="p-3 text-right font-mono font-black text-slate-950 dark:text-white bg-slate-50/60 dark:bg-slate-800/40">
                      {ch.total.toLocaleString('es-CO')}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="bg-slate-100/90 dark:bg-slate-800/90 font-black border-t-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
              <tr>
                <td className="p-3 sticky left-0 z-10 bg-slate-200/90 dark:bg-slate-800 dark:text-white border-r border-slate-200/70 dark:border-slate-700">
                  Total General Contactos
                </td>

                {porCursoVida.map((c) => {
                  const colTotal = (c.sms || 0) + (c.email || 0) + (c.call || 0) + (c.whatsapp || 0);
                  return (
                    <td
                      key={c.id}
                      className="p-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-700 text-[11px]"
                    >
                      {colTotal.toLocaleString('es-CO')}
                    </td>
                  );
                })}

                <td className="p-3 text-right font-mono text-teal-900 dark:text-teal-300 text-sm">
                  {totales.general.toLocaleString('es-CO')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TABLA 2 (DEBAJO): VOLUMEN DE PERSONAS CONTACTADAS POR GRUPOS RIESGO   */}
      {/* ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/90 dark:border-amber-900/50 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 bg-amber-50/50 dark:bg-slate-950 border-b border-amber-200/80 dark:border-slate-800 space-y-2 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300/80 dark:border-amber-500/40">
                <ShieldAlert className="w-3 h-3" />
                Grupos de Riesgo (1 - 11)
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Volumen de Personas Contactadas por Grupos de Riesgo
              </h3>
            </div>
            <span className="shrink-0 inline-flex items-center px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/70 dark:border-amber-800/60">
              Pertenencia múltiple permitida
            </span>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/70 dark:border-amber-800/50 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              Muestra el <strong>volumen de personas pertenecientes a cada Grupo de Riesgo que han sido contactadas</strong>. A diferencia de los Cursos de Vida (que son exclusivos: 1 por paciente), un mismo paciente puede pertenecer simultáneamente a varios Grupos de Riesgo, por lo que el acumulado entre grupos puede superar o diferir del total de Cursos de Vida.
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-amber-50/80 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-amber-200/80 dark:border-slate-700">
              <tr>
                <th className="p-3 bg-amber-100/80 dark:bg-slate-800 dark:text-slate-100 sticky left-0 z-10 min-w-[215px] border-r border-amber-200/70 dark:border-slate-700">
                  Canal de Contacto
                </th>
                {porGrupoRiesgo.map((r) => (
                  <th
                    key={r.id}
                    className="p-2.5 text-center min-w-[115px] border-r border-amber-200/60 dark:border-slate-700/70"
                  >
                    <span className="block text-[10px] font-black text-amber-900 dark:text-amber-400">
                      Riesgo {r.id}
                    </span>
                    <span className="block text-[10px] truncate max-w-[130px] mx-auto" title={r.titulo}>
                      {r.titulo}
                    </span>
                    <span className="block text-[9px] font-semibold text-amber-800/80 dark:text-amber-300/80">
                      {(r.totalCenso ?? 0).toLocaleString('es-CO')} pac.
                    </span>
                  </th>
                ))}
                <th className="p-3 text-right bg-amber-100/90 dark:bg-slate-800 dark:text-amber-200 font-black min-w-[130px]">
                  Volumen Acumulado
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                const rowVolume = getRiesgoRowVolume(ch.id);
                return (
                  <tr key={ch.id} className="hover:bg-amber-50/30 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 sticky left-0 z-10 border-r border-slate-200/70 dark:border-slate-800 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${ch.color}`} />
                        <span>{ch.label}</span>
                      </div>
                    </td>

                    {porGrupoRiesgo.map((r) => (
                      <td
                        key={r.id}
                        className="p-2.5 text-center font-mono text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800 bg-amber-50/15 dark:bg-amber-950/15 font-semibold"
                      >
                        {(r[ch.id] || 0).toLocaleString('es-CO')}
                      </td>
                    ))}

                    <td className="p-3 text-right font-mono font-black text-amber-950 dark:text-amber-200 bg-amber-50/40 dark:bg-amber-950/25">
                      {rowVolume.toLocaleString('es-CO')}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="bg-amber-50/90 dark:bg-slate-800/90 font-black border-t-2 border-amber-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
              <tr>
                <td className="p-3 sticky left-0 z-10 bg-amber-100/90 dark:bg-slate-800 dark:text-white border-r border-amber-200/70 dark:border-slate-700">
                  Total Contactos por Grupo
                </td>

                {porGrupoRiesgo.map((r) => {
                  const colTotal = (r.sms || 0) + (r.email || 0) + (r.call || 0) + (r.whatsapp || 0);
                  return (
                    <td
                      key={r.id}
                      className="p-2.5 text-center font-mono border-r border-amber-200/70 dark:border-slate-700 text-[11px]"
                    >
                      {colTotal.toLocaleString('es-CO')}
                    </td>
                  );
                })}

                <td className="p-3 text-right font-mono text-amber-900 dark:text-amber-300 text-sm">
                  {totalRiesgoVolumeGeneral.toLocaleString('es-CO')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
