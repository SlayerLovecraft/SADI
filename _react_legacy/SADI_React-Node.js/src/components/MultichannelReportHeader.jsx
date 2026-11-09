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
  Send, 
  Layers, 
  ShieldAlert, 
  Sparkles, 
  Activity,
  ArrowRight
} from 'lucide-react';
import { PROGRAMAS_3280, GRUPOS_RIESGO_PRIORIZADOS } from '@/services/census400kService';

export default function MultichannelReportHeader({ matrixData, loading = false }) {
  // Pestaña de visualización de la tabla del header: 'todos' | 'cursos' | 'riesgos'
  const [activeTableTab, setActiveTableTab] = useState('todos');

  const totales = matrixData?.totales || {
    sms: 125430,
    email: 98210,
    call: 84650,
    whatsapp: 93820,
    general: 402110
  };

  const porCursoVida = matrixData?.porCursoVida || [];
  const porGrupoRiesgo = matrixData?.porGrupoRiesgo || [];

  const CHANNELS = [
    { id: 'sms', label: 'SMS Enviados', icon: MessageSquare, color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', total: totales.sms },
    { id: 'email', label: 'E-mails Enviados', icon: Mail, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', total: totales.email },
    { id: 'call', label: 'Llamadas Realizadas (Puerto 22)', icon: Phone, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', total: totales.call },
    { id: 'whatsapp', label: 'Interacciones por WhatsApp', icon: Send, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', total: totales.whatsapp }
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
              className={`p-4 rounded-2xl border ${ch.bg} ${ch.border} shadow-2xs flex items-center justify-between gap-3`}
            >
              <div>
                <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider block">
                  {ch.label}
                </span>
                <span className="text-2xl font-black text-slate-900 mt-0.5 block">
                  {ch.total.toLocaleString('es-CO')}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {((ch.total / totales.general) * 100).toFixed(1)}% de la demanda global
                </span>
              </div>
              <div className={`p-3 rounded-xl bg-white shadow-2xs ${ch.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Matriz Multicanal Header: Cantidades por Cursos de Vida y Grupos de Riesgo */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Cabecera de la Tabla y Toggles de Vista */}
        <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-teal-500 text-slate-950">
                Matriz Consolidada
              </span>
              <h3 className="text-sm font-black text-white">
                Reporte de Emisiones Multicanal SADI
              </h3>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Desglose cruzado de los 4 canales de contacto por Cursos de Vida (A - J) y Grupos de Riesgo Priorizados.
            </p>
          </div>

          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
            <button
              onClick={() => setActiveTableTab('todos')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTableTab === 'todos' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Vista Panorámica
            </button>
            <button
              onClick={() => setActiveTableTab('cursos')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTableTab === 'cursos' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Cursos de Vida (A - J)
            </button>
            <button
              onClick={() => setActiveTableTab('riesgos')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTableTab === 'riesgos' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Grupos de Riesgo (1 - 7)
            </button>
          </div>
        </div>

        {/* Tabla Desplazable Horizontalmente */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 bg-slate-200/80 sticky left-0 z-10 min-w-[200px]">
                  Canal de Demanda Inducida
                </th>

                {/* Columnas de Cursos de Vida (A - J) */}
                {(activeTableTab === 'todos' || activeTableTab === 'cursos') &&
                  porCursoVida.map((c) => (
                    <th key={c.id} className="p-2.5 text-center min-w-[105px] border-r border-slate-200/60">
                      <span className="block text-[10px] font-black text-teal-800">{c.id}</span>
                      <span className="block text-[10px] truncate" title={c.nombre}>{c.nombre}</span>
                    </th>
                  ))}

                {/* Columnas de Grupos de Riesgo Priorizados (1 - 7) */}
                {(activeTableTab === 'todos' || activeTableTab === 'riesgos') &&
                  porGrupoRiesgo.map((r) => (
                    <th key={r.id} className="p-2.5 text-center min-w-[110px] border-r border-slate-200/60 bg-amber-50/50">
                      <span className="block text-[10px] font-black text-amber-900">Riesgo {r.id}</span>
                      <span className="block text-[10px] truncate" title={r.titulo}>{r.titulo}</span>
                    </th>
                  ))}

                <th className="p-3 text-right bg-slate-200/90 font-black min-w-[110px]">
                  Total Canal
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                return (
                  <tr key={ch.id} className="hover:bg-slate-50 transition-colors">
                    {/* Canal (Fila fija a la izquierda) */}
                    <td className="p-3 font-bold text-slate-900 bg-slate-50/80 sticky left-0 z-10 border-r border-slate-200/70 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${ch.color}`} />
                        <span>{ch.label}</span>
                      </div>
                    </td>

                    {/* Celdas Cursos de Vida */}
                    {(activeTableTab === 'todos' || activeTableTab === 'cursos') &&
                      porCursoVida.map((c) => (
                        <td key={c.id} className="p-2.5 text-center font-mono text-slate-800 border-r border-slate-100 font-semibold">
                          {(c[ch.id] || 0).toLocaleString('es-CO')}
                        </td>
                      ))}

                    {/* Celdas Grupos de Riesgo */}
                    {(activeTableTab === 'todos' || activeTableTab === 'riesgos') &&
                      porGrupoRiesgo.map((r) => (
                        <td key={r.id} className="p-2.5 text-center font-mono text-slate-800 border-r border-slate-100 bg-amber-50/20 font-semibold">
                          {(r[ch.id] || 0).toLocaleString('es-CO')}
                        </td>
                      ))}

                    {/* Total Canal */}
                    <td className="p-3 text-right font-mono font-black text-slate-950 bg-slate-50/60">
                      {ch.total.toLocaleString('es-CO')}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Pie de Totales */}
            <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-200 text-slate-900">
              <tr>
                <td className="p-3 sticky left-0 z-10 bg-slate-200/90">
                  Total General Contactos
                </td>

                {(activeTableTab === 'todos' || activeTableTab === 'cursos') &&
                  porCursoVida.map((c) => {
                    const colTotal = (c.sms || 0) + (c.email || 0) + (c.call || 0) + (c.whatsapp || 0);
                    return (
                      <td key={c.id} className="p-2.5 text-center font-mono border-r border-slate-200 text-[11px]">
                        {colTotal.toLocaleString('es-CO')}
                      </td>
                    );
                  })}

                {(activeTableTab === 'todos' || activeTableTab === 'riesgos') &&
                  porGrupoRiesgo.map((r) => {
                    const colTotal = (r.sms || 0) + (r.email || 0) + (r.call || 0) + (r.whatsapp || 0);
                    return (
                      <td key={r.id} className="p-2.5 text-center font-mono border-r border-slate-200 bg-amber-100/40 text-[11px]">
                        {colTotal.toLocaleString('es-CO')}
                      </td>
                    );
                  })}

                <td className="p-3 text-right font-mono text-teal-900 text-sm">
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

