// ==============================================================================
// MultichannelReportHeader.jsx - TABLA HEADER MULTICANAL (SMS, EMAIL, LLAMADAS, WPP)
// Muestra las cantidades exactas por Cursos de Vida (A a J) y por Grupos de Riesgo
// Priorizados (1 a 7) para los 4 canales de demanda inducida de la Resolución 3280.
// ==============================================================================

import React, { useState } from 'react';
import {
  Phone,
  MessageSquare,
  Mail,
  Send
} from 'lucide-react';

export default function MultichannelReportHeader({ matrixData, loading = false }) {
  // Pestaña de visualización de la tabla del header: 'todos' | 'cursos' | 'riesgos'
  const [activeTableTab, setActiveTableTab] = useState('todos');

  const totales = matrixData?.totales || {
    sms: 0,
    email: 0,
    call: 0,
    whatsapp: 0,
    general: 0
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
      total: totales.sms
    },
    {
      id: 'email',
      label: 'E-mails Enviados',
      icon: Mail,
      color: 'text-indigo-700 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-slate-900',
      border: 'border-indigo-200 dark:border-indigo-800/60',
      iconBg: 'bg-white dark:bg-indigo-950/60 dark:border dark:border-indigo-800/50',
      total: totales.email
    },
    {
      id: 'call',
      label: 'Llamadas Realizadas (Puerto 22)',
      icon: Phone,
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-slate-900',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      iconBg: 'bg-white dark:bg-emerald-950/60 dark:border dark:border-emerald-800/50',
      total: totales.call
    },
    {
      id: 'whatsapp',
      label: 'Interacciones por WhatsApp',
      icon: Send,
      color: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-slate-900',
      border: 'border-green-200 dark:border-green-800/60',
      iconBg: 'bg-white dark:bg-green-950/60 dark:border dark:border-green-800/50',
      total: totales.whatsapp
    }
  ];

  return (
    <div className="space-y-4">
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

      {/* Matriz Multicanal Header: Cantidades por Cursos de Vida y Grupos de Riesgo */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        {/* Cabecera de la Tabla y Toggles de Vista */}
        <div className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-500/40">
                Matriz Consolidada
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Reporte de Emisiones Multicanal SADI
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
              Desglose real en Supabase ({(matrixData?.realPatientsCount ?? 0).toLocaleString('es-CO')} pacientes) por Cursos de Vida (A - J) y Grupos de Riesgo Priorizados.
            </p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
            {[
              { id: 'todos', label: 'Vista Panorámica' },
              { id: 'cursos', label: 'Cursos de Vida (A - J)' },
              { id: 'riesgos', label: 'Grupos de Riesgo (1 - 7)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTableTab(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTableTab === tab.id
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla Desplazable Horizontalmente */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 bg-slate-200/80 dark:bg-slate-800 dark:text-slate-100 sticky left-0 z-10 min-w-[200px] border-r border-slate-200/70 dark:border-slate-700">
                  Canal de Demanda Inducida
                </th>

                {/* Columnas de Cursos de Vida (A - J) */}
                {(activeTableTab === 'todos' || activeTableTab === 'cursos') &&
                  porCursoVida.map((c) => (
                    <th key={c.id} className="p-2.5 text-center min-w-[105px] border-r border-slate-200/60 dark:border-slate-700/70">
                      <span className="block text-[10px] font-black text-teal-800 dark:text-teal-400">{c.id}</span>
                      <span className="block text-[10px] truncate" title={c.nombre}>{c.nombre}</span>
                      <span className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400">{(c.totalCenso ?? 0).toLocaleString('es-CO')} pac.</span>
                    </th>
                  ))}

                {/* Columnas de Grupos de Riesgo Priorizados (1 - 7) */}
                {(activeTableTab === 'todos' || activeTableTab === 'riesgos') &&
                  porGrupoRiesgo.map((r) => (
                    <th key={r.id} className="p-2.5 text-center min-w-[110px] border-r border-slate-200/60 dark:border-slate-700/70 bg-amber-50/50 dark:bg-amber-950/35">
                      <span className="block text-[10px] font-black text-amber-900 dark:text-amber-400">Riesgo {r.id}</span>
                      <span className="block text-[10px] truncate" title={r.titulo}>{r.titulo}</span>
                      <span className="block text-[9px] font-semibold text-amber-800/80 dark:text-amber-300/80">{(r.totalCenso ?? 0).toLocaleString('es-CO')} pac.</span>
                    </th>
                  ))}

                <th className="p-3 text-right bg-slate-200/90 dark:bg-slate-800 dark:text-white font-black min-w-[110px]">
                  Total Canal
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                return (
                  <tr key={ch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Canal (Fila fija a la izquierda) */}
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 sticky left-0 z-10 border-r border-slate-200/70 dark:border-slate-800 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${ch.color}`} />
                        <span>{ch.label}</span>
                      </div>
                    </td>

                    {/* Celdas Cursos de Vida */}
                    {(activeTableTab === 'todos' || activeTableTab === 'cursos') &&
                      porCursoVida.map((c) => (
                        <td key={c.id} className="p-2.5 text-center font-mono text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800 font-semibold">
                          {(c[ch.id] || 0).toLocaleString('es-CO')}
                        </td>
                      ))}

                    {/* Celdas Grupos de Riesgo */}
                    {(activeTableTab === 'todos' || activeTableTab === 'riesgos') &&
                      porGrupoRiesgo.map((r) => (
                        <td key={r.id} className="p-2.5 text-center font-mono text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800 bg-amber-50/20 dark:bg-amber-950/20 font-semibold">
                          {(r[ch.id] || 0).toLocaleString('es-CO')}
                        </td>
                      ))}

                    {/* Total Canal */}
                    <td className="p-3 text-right font-mono font-black text-slate-950 dark:text-white bg-slate-50/60 dark:bg-slate-800/40">
                      {ch.total.toLocaleString('es-CO')}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Pie de Totales */}
            <tfoot className="bg-slate-100/90 dark:bg-slate-800/90 font-black border-t-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
              <tr>
                <td className="p-3 sticky left-0 z-10 bg-slate-200/90 dark:bg-slate-800 dark:text-white border-r border-slate-200/70 dark:border-slate-700">
                  Total General Contactos
                </td>

                {(activeTableTab === 'todos' || activeTableTab === 'cursos') &&
                  porCursoVida.map((c) => {
                    const colTotal = (c.sms || 0) + (c.email || 0) + (c.call || 0) + (c.whatsapp || 0);
                    return (
                      <td key={c.id} className="p-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-700 text-[11px]">
                        {colTotal.toLocaleString('es-CO')}
                      </td>
                    );
                  })}

                {(activeTableTab === 'todos' || activeTableTab === 'riesgos') &&
                  porGrupoRiesgo.map((r) => {
                    const colTotal = (r.sms || 0) + (r.email || 0) + (r.call || 0) + (r.whatsapp || 0);
                    return (
                      <td key={r.id} className="p-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-700 bg-amber-100/40 dark:bg-amber-950/35 text-[11px]">
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
    </div>
  );
}

