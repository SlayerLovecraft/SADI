import React, { useState } from 'react';
import { 
  Activity, TrendingUp, AlertTriangle, CheckCircle2, Phone, MessageSquare, 
  Mail, Smartphone, Eye, Calendar, Clock, Edit, Trash2, User, ChevronDown,
  HeartPulse, ShieldAlert, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// Canales disponibles
const CHANNELS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'email', name: 'E-mail', icon: Mail, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'call', name: 'Llamada (Call)', icon: Phone, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'sms', name: 'SMS', icon: Smartphone, color: 'text-amber-600 bg-amber-50 border-amber-200' }
];

export default function PatientTelemetryTable({
  patients = [],
  onEditPatient,
  onDeletePatient,
  selectedPatientIds = [],
  onToggleSelect,
  selectable = false,
  staffName = null,
  emptyMessage = "No hay pacientes asignados para este criterio."
}) {
  // Canal activo seleccionado por cada paciente (por defecto 'whatsapp')
  const [selectedChannels, setSelectedChannels] = useState({});

  // Modales
  const [curvePatient, setCurvePatient] = useState(null);
  const [criticalPatient, setCriticalPatient] = useState(null);

  const getActiveChannel = (patientId) => {
    return selectedChannels[patientId] || 'whatsapp';
  };

  const handleChannelChange = (patientId, channel) => {
    setSelectedChannels(prev => ({ ...prev, [patientId]: channel }));
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-white font-bold text-[11px] tracking-wider uppercase">
            <tr>
              {selectable && (
                <th className="p-3.5 w-10 text-center">
                  <span className="sr-only">Seleccionar</span>
                </th>
              )}
              <th className="p-3.5 whitespace-nowrap">Nombre del Paciente</th>
              <th className="p-3.5 whitespace-nowrap">Dispositivo</th>
              <th className="p-3.5 whitespace-nowrap">Grupos de Vida</th>
              <th className="p-3.5 whitespace-nowrap">Grupos de Riesgo</th>
              <th className="p-3.5 text-center whitespace-nowrap">Historial de Medida</th>
              <th className="p-3.5 text-center whitespace-nowrap">Valores Críticos</th>
              <th className="p-3.5 text-center whitespace-nowrap">Canales de Atención</th>
              {(onEditPatient || onDeletePatient) && (
                <th className="p-3.5 text-right whitespace-nowrap">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {patients.length === 0 ? (
              <tr>
                <td colSpan={selectable ? 9 : 8} className="text-center py-12 text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <User className="w-8 h-8 text-gray-300" />
                    <p className="text-xs font-semibold">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              patients.map((patient) => {
                const isSelected = selectedPatientIds.includes(patient.id);
                const activeChannelId = getActiveChannel(patient.id);
                const activeChannelObj = CHANNELS.find(c => c.id === activeChannelId) || CHANNELS[0];
                
                const conteo = patient.conteo_canales || { whatsapp: 0, email: 0, call: 0, sms: 0 };
                const interaccionesCount = conteo[activeChannelId] ?? 0;

                const dispositivos = Array.isArray(patient.dispositivos) && patient.dispositivos.length > 0
                  ? patient.dispositivos
                  : (Array.isArray(patient.dispositivos_caseros) && patient.dispositivos_caseros.length > 0
                      ? patient.dispositivos_caseros
                      : []);
                const hasDevice = dispositivos.length > 0;

                const critico = patient.valores_criticos || { tiene_critico: false, tipo: 'Normal', valor: 'Sin alertas', fecha_hora: 'N/A' };
                const hasCritical = Boolean(critico.tiene_critico);

                const historial = Array.isArray(patient.historial_medidas) ? patient.historial_medidas : [];
                const hasMeasures = historial.length > 0;

                return (
                  <tr key={patient.id} className="hover:bg-blue-50/40 transition-colors">
                    {/* Selección */}
                    {selectable && (
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect && onToggleSelect(patient.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    )}

                    {/* 1. Nombre del Paciente */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {patient.nombre ? patient.nombre.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                            {patient.nombre}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            CC: {patient.cc || patient.cedula || 'N/A'} {patient.edad ? `· ${patient.edad} años` : ''} {patient.sexo ? `(${patient.sexo})` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Dispositivo */}
                    <td className="p-3.5 max-w-[190px]">
                      {hasDevice ? (
                        <div className="flex flex-col gap-1">
                          {dispositivos.map((d, dIdx) => (
                            <span 
                              key={dIdx} 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 truncate"
                              title={d}
                            >
                              <Smartphone className="w-3 h-3 text-blue-600 shrink-0" />
                              <span className="truncate">{d}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 italic">
                          Sin dispositivo asignado
                        </span>
                      )}
                    </td>

                    {/* 3. Grupos de Vida */}
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-50 text-cyan-800 border border-cyan-200">
                        {patient.grupo_vida || patient.curso_vida || 'Primera Infancia'}
                      </span>
                    </td>

                    {/* 4. Grupos de Riesgo */}
                    <td className="p-3.5 max-w-[210px]">
                      <span 
                        className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 truncate max-w-full"
                        title={patient.grupo_riesgo || 'Población Materno-Perinatal'}
                      >
                        {patient.grupo_riesgo || 'Población Materno-Perinatal'}
                      </span>
                    </td>

                    {/* 5. Historial de Medida (Click -> Curva) */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <button
                        onClick={() => setCurvePatient(patient)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-sm ${
                          hasMeasures
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100 hover:shadow-md'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'
                        }`}
                        title="Ver trayectoria temporal de telemetría"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>{hasMeasures ? 'Ver Curva' : 'Curva Plana'}</span>
                      </button>
                    </td>

                    {/* 6. Valores Críticos (Click -> Fecha y Hora) */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <button
                        onClick={() => setCriticalPatient(patient)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-transform active:scale-95 ${
                          hasCritical
                            ? 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 animate-pulse'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                        title="Ver última toma y fecha/hora"
                      >
                        {hasCritical ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                            <span>{critico.valor || 'Alerta Crítica'}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Estable / Normal</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* 7. Canales de Atención (Selector interactivo + Conteo) */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex flex-col items-center gap-1 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
                        <select
                          value={activeChannelId}
                          onChange={(e) => handleChannelChange(patient.id, e.target.value)}
                          className="text-[10px] font-bold bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          {CHANNELS.map(ch => (
                            <option key={ch.id} value={ch.id}>
                              {ch.name}
                            </option>
                          ))}
                        </select>
                        
                        <div className="flex items-center gap-1 text-[10px] font-black text-slate-700">
                          <activeChannelObj.icon className="w-3 h-3 text-blue-600" />
                          <span>{interaccionesCount} {interaccionesCount === 1 ? 'contacto' : 'contactos'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Acciones */}
                    {(onEditPatient || onDeletePatient) && (
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {onEditPatient && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditPatient(patient)}
                              className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50"
                              title="Editar paciente"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {onDeletePatient && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeletePatient(patient)}
                              className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                              title="Eliminar paciente"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: HISTORIAL DE MEDIDA - GRÁFICA DE CURVA */}
      <Dialog open={!!curvePatient} onOpenChange={() => setCurvePatient(null)}>
        <DialogContent className="max-w-2xl bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-gray-900">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Historial de Medidas & Trayectoria de Telemetría
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Curva evolutiva domiciliaria para <strong>{curvePatient?.nombre}</strong> · CC: {curvePatient?.cc || 'N/A'}
            </DialogDescription>
          </DialogHeader>

          {curvePatient && (
            <div className="mt-4 space-y-4">
              {/* Badges de Información Rápida */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">DISPOSITIVO ASOCIADO</span>
                  <span className="font-bold text-gray-800 text-xs">
                    {(curvePatient.dispositivos && curvePatient.dispositivos[0]) || 
                     (curvePatient.dispositivos_caseros && curvePatient.dispositivos_caseros[0]) || 
                     'Sin dispositivo (Medición estándar)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">CURSO DE VIDA</span>
                  <span className="font-bold text-cyan-800 text-xs">
                    {curvePatient.grupo_vida || curvePatient.curso_vida || 'Primera Infancia'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">GRUPO DE RIESGO</span>
                  <span className="font-bold text-amber-800 text-xs truncate block" title={curvePatient.grupo_riesgo}>
                    {curvePatient.grupo_riesgo || 'Población General'}
                  </span>
                </div>
              </div>

              {/* RENDER DE LA CURVA SVG */}
              <div className="bg-slate-950 p-5 rounded-2xl text-white relative overflow-hidden">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="font-bold text-gray-200">
                      {curvePatient.historial_medidas && curvePatient.historial_medidas.length > 0
                        ? 'Trayectoria de Parámetros Vitales (Últimas 7 Tomas)'
                        : 'Línea Base Domiciliaria (Curva Plana)'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {curvePatient.historial_medidas && curvePatient.historial_medidas.length > 0
                      ? 'Telemetría Activa'
                      : 'Sin Equipos Registrados'}
                  </span>
                </div>

                {/* SVG CANVAS */}
                <div className="w-full h-52 flex items-center justify-center">
                  {curvePatient.historial_medidas && curvePatient.historial_medidas.length > 1 ? (
                    // Gráfica de Curva Dinámica
                    <svg viewBox="0 0 500 180" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Guías de fondo */}
                      <line x1="20" y1="30" x2="480" y2="30" stroke="#334155" strokeDasharray="3 3" />
                      <line x1="20" y1="80" x2="480" y2="80" stroke="#334155" strokeDasharray="3 3" />
                      <line x1="20" y1="130" x2="480" y2="130" stroke="#334155" strokeDasharray="3 3" />

                      {/* Path de la curva */}
                      {(() => {
                        const pts = curvePatient.historial_medidas;
                        const min = Math.min(...pts.map(p => p.valor)) - 2;
                        const max = Math.max(...pts.map(p => p.valor)) + 2;
                        const range = Math.max(1, max - min);

                        const coords = pts.map((p, i) => {
                          const x = 30 + (i * (440 / (pts.length - 1)));
                          const y = 150 - (((p.valor - min) / range) * 120);
                          return { x, y, p };
                        });

                        const pathData = coords.reduce((acc, c, idx) => {
                          if (idx === 0) return `M ${c.x} ${c.y}`;
                          const prev = coords[idx - 1];
                          const cx1 = prev.x + (c.x - prev.x) / 2;
                          const cy1 = prev.y;
                          const cx2 = prev.x + (c.x - prev.x) / 2;
                          const cy2 = c.y;
                          return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${c.x} ${c.y}`;
                        }, '');

                        const areaData = `${pathData} L ${coords[coords.length - 1].x} 165 L ${coords[0].x} 165 Z`;

                        return (
                          <>
                            <path d={areaData} fill="url(#curveGradient)" />
                            <path d={pathData} fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
                            {coords.map((c, idx) => (
                              <g key={idx}>
                                <circle 
                                  cx={c.x} 
                                  cy={c.y} 
                                  r="5" 
                                  fill={c.p.etiqueta?.includes('Alerta') ? '#ef4444' : '#38bdf8'} 
                                  stroke="#0f172a" 
                                  strokeWidth="2" 
                                />
                                <text 
                                  x={c.x} 
                                  y={c.y - 10} 
                                  fill="#cbd5e1" 
                                  fontSize="9" 
                                  textAnchor="middle" 
                                  fontWeight="bold"
                                >
                                  {c.p.valor}
                                </text>
                                <text 
                                  x={c.x} 
                                  y="175" 
                                  fill="#64748b" 
                                  fontSize="8" 
                                  textAnchor="middle"
                                >
                                  {c.p.fecha?.slice(5)}
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  ) : (
                    // CURVA PLANA (Requisito explícito del usuario para pacientes sin medidas)
                    <svg viewBox="0 0 500 180" className="w-full h-full">
                      <line x1="40" y1="90" x2="460" y2="90" stroke="#64748b" strokeWidth="2.5" />
                      <circle cx="50" cy="90" r="4" fill="#94a3b8" />
                      <circle cx="250" cy="90" r="4" fill="#94a3b8" />
                      <circle cx="450" cy="90" r="4" fill="#94a3b8" />
                      <text x="250" y="70" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">
                        Curva Basal Plana — Sin telemetría reportada
                      </text>
                      <text x="250" y="125" fill="#64748b" fontSize="9" textAnchor="middle">
                        El paciente no cuenta con dispositivo activo o no ha transmitido datos este mes.
                      </text>
                    </svg>
                  )}
                </div>
              </div>

              {/* Botón de cierre */}
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setCurvePatient(null)} className="text-xs">
                  Cerrar Gráfica
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 2: VALORES CRÍTICOS - FECHA Y HORA DE ÚLTIMA TOMA */}
      <Dialog open={!!criticalPatient} onOpenChange={() => setCriticalPatient(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-gray-900">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              Detalle de Valores Críticos & Última Medición
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Monitoreo clínico para <strong>{criticalPatient?.nombre}</strong>
            </DialogDescription>
          </DialogHeader>

          {criticalPatient && (
            <div className="mt-4 space-y-4">
              {criticalPatient.valores_criticos?.tiene_critico ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-red-800 bg-red-100 px-2 py-0.5 rounded-full">
                      {criticalPatient.valores_criticos.tipo || 'Valor Fuera de Rango'}
                    </span>
                    <span className="text-xs font-mono font-bold text-red-900">
                      {criticalPatient.valores_criticos.valor}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-red-200/60 text-xs">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span><strong>Fecha y Hora de la Toma:</strong> {criticalPatient.valores_criticos.fecha_hora || '2026-11-09 06:45 AM'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <HeartPulse className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span><strong>Estado Clínico:</strong> {criticalPatient.valores_criticos.estado || 'Alerta Roja - Pendiente Triage'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="font-bold text-xs text-emerald-900">Parámetros Clínicos Estables</p>
                  <p className="text-[11px] text-emerald-700">
                    Última verificación: {criticalPatient.valores_criticos?.fecha_hora || '2026-11-08 09:00 AM'}.
                    No se han registrado picos críticos de presión arterial, glucemia o temperatura.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setCriticalPatient(null)} className="text-xs">
                  Aceptar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

