// ==============================================================================
// AnnualTimelineRuler.jsx - REGLETA ANUAL DE 365 DÍAS DE LA RESOLUCIÓN 3280
// - 365 cajones diarios con código de color clínico por Curso de Vida o Grupo de Riesgo
// - Soporta división multi-stripe cuando coinciden varios programas en un mismo día
// - Clic en cualquier día abre el modal con los pacientes citados, sus hitos clínicos y prompts IA
// - Indicador de capacidad diaria consumida (sobre 3.500 llamadas máximas)
// ==============================================================================

import React, { useState, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Phone,
  Users, CheckCircle2, AlertCircle, Info, Sparkles, X, ShieldAlert,
  ArrowRight, FileText, UserCheck, Stethoscope
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { 
  DAILY_CALL_CAPACITY, 
  generateIndividualClinicalPrompt 
} from '@/services/callCapacityService';
import { CURSOS_VIDA_PALETTE, GRUPOS_RIESGO_PALETTE } from '@/services/clinicalPalettes';

const MESES_ABREV = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export default function AnnualTimelineRuler({
  type = 'cursos_vida', // 'cursos_vida' | 'grupos_riesgo'
  year = 2026,
  roadmap365 = {},
  onSelectDay = () => {}
}) {
  const scrollContainerRef = useRef(null);

  // Día seleccionado para el modal interactivo
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Paciente seleccionado para previsualizar el Prompt IA particular
  const [selectedPatientPrompt, setSelectedPatientPrompt] = useState(null);

  // Convertir roadmap365 en arreglo de 365 días
  const daysArray = useMemo(() => {
    return Object.keys(roadmap365).sort().map(iso => roadmap365[iso]);
  }, [roadmap365]);

  // Manejar clic en un cajón del día
  const handleDayClick = (dayData) => {
    if (!dayData) return;
    setSelectedDayData(dayData);
    setSelectedPatientPrompt(null);
    setIsDetailOpen(true);
    onSelectDay(dayData);
  };

  // Scroll horizontal asistido por meses
  const scrollToMonth = (monthIdx) => {
    if (!scrollContainerRef.current) return;
    // Aproximación de días acumulados antes del mes
    let daysBefore = 0;
    for (let m = 0; m < monthIdx; m++) {
      daysBefore += new Date(year, m + 1, 0).getDate();
    }
    const cajonWidth = 32; // Ancho promedio del cajón con márgenes
    scrollContainerRef.current.scrollTo({
      left: daysBefore * cajonWidth,
      behavior: 'smooth'
    });
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800 space-y-4">
      {/* Cabecera de la Regleta */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
              Regleta Anual de 365 Días • Resolución 3280
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Límite GSM: 3.500 llamadas/día (08:00 AM - 06:00 PM)
            </span>
          </div>
          <h4 className="text-sm font-bold mt-1 text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Ruta Longitudinal de Llamadas Preventivas del Año {year} ({type === 'cursos_vida' ? 'Por Cursos de Vida' : 'Por Grupos de Riesgo'})
          </h4>
          <p className="text-[11px] text-slate-400">
            Cada cajón representa un día calendario. Los colores señalan los Cursos de Vida o Grupos de Riesgo con llamadas agendadas por ventana de resolución. Haz clic en cualquier día para abrir el expediente de citas.
          </p>
        </div>

        {/* Botones de salto rápido por meses */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
          {MESES_ABREV.map((mes, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToMonth(idx)}
              className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              {mes}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENEDOR DE LA REGLETA CON SCROLL HORIZONTAL */}
      <div className="space-y-2">
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
        >
          <div className="inline-flex gap-1.5 min-w-max px-1">
            {daysArray.map((day) => {
              const count = day.totalLlamadasResolucion || 0;
              const isSun = day.isSunday;

              // Obtener colores según type ('cursos_vida' o 'grupos_riesgo')
              const colorHexList = [];
              if (type === 'cursos_vida') {
                day.cursosVidaPresentes.forEach(cvId => {
                  const pal = CURSOS_VIDA_PALETTE[cvId];
                  if (pal) colorHexList.push(pal.colorHex);
                });
              } else {
                day.gruposRiesgoPresentes.forEach(grId => {
                  const pal = GRUPOS_RIESGO_PALETTE[grId];
                  if (pal) colorHexList.push(pal.colorHex);
                });
              }

              // Estilo visual del cajón (soporte multi-stripe si hay más de 1 color)
              let backgroundStyle = {};
              if (isSun) {
                backgroundStyle = { backgroundColor: '#1e293b', opacity: 0.4 }; // Domingo
              } else if (colorHexList.length === 0) {
                backgroundStyle = { backgroundColor: '#0f172a' }; // Sin llamadas
              } else if (colorHexList.length === 1) {
                backgroundStyle = { backgroundColor: colorHexList[0] };
              } else {
                // Multi-stripe horizontal o vertical con todos los colores
                const step = 100 / colorHexList.length;
                const stops = colorHexList.map((col, i) => `${col} ${i * step}%, ${col} ${(i + 1) * step}%`).join(', ');
                backgroundStyle = { background: `linear-gradient(135deg, ${stops})` };
              }

              const dateObj = new Date(day.isoDate + 'T12:00:00');
              const dayOfMonth = dateObj.getDate();
              const monthShort = MESES_ABREV[dateObj.getMonth()];

              return (
                <div
                  key={day.isoDate}
                  onClick={() => !isSun && handleDayClick(day)}
                  style={backgroundStyle}
                  title={`${day.isoDate} (${monthShort} ${dayOfMonth}) - ${count} llamadas agendadas Res. 3280`}
                  className={`w-8 h-14 rounded-lg flex flex-col items-center justify-between p-1 transition-all select-none border ${
                    isSun
                      ? 'border-slate-800 cursor-not-allowed'
                      : count > 0
                        ? 'border-white/30 cursor-pointer hover:scale-110 hover:shadow-lg hover:z-20 hover:border-white ring-1 ring-white/10'
                        : 'border-slate-800 hover:border-slate-600 cursor-pointer'
                  }`}
                >
                  <span className={`text-[9px] font-black leading-none ${count > 0 ? 'text-white drop-shadow' : 'text-slate-500'}`}>
                    {dayOfMonth}
                  </span>
                  <span className={`text-[8px] font-semibold leading-none ${count > 0 ? 'text-white/90 drop-shadow' : 'text-slate-600'}`}>
                    {monthShort}
                  </span>
                  {count > 0 ? (
                    <span className="text-[8px] font-black bg-black/50 text-white px-1 py-0.2 rounded-full leading-none mt-0.5">
                      {count}
                    </span>
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-slate-800 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leyenda de Colores Rápida */}
        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-300">Convención de Colores:</span>
            {type === 'cursos_vida' ? (
              Object.keys(CURSOS_VIDA_PALETTE).map(k => {
                const item = CURSOS_VIDA_PALETTE[k];
                return (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md" style={{ backgroundColor: item.colorHex }} />
                    <span className="text-[11px] text-slate-300">{item.nombre}</span>
                  </div>
                );
              })
            ) : (
              Object.keys(GRUPOS_RIESGO_PALETTE).map(k => {
                const item = GRUPOS_RIESGO_PALETTE[k];
                return (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md" style={{ backgroundColor: item.colorHex }} />
                    <span className="text-[11px] text-slate-300">{item.nombre.split(' ')[0]} {item.nombre.split(' ')[1] || ''}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-700" />
              Domingo no operativo
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-gradient-to-r from-pink-500 via-amber-500 to-blue-600" />
              Múltiples programas cruzados
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DETALLADO AL HACER CLIC EN UN DÍA DE LA REGLETA                     */}
      {/* ========================================================================= */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0 rounded-2xl">
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Ruta de Llamadas Res. 3280 • Día #{selectedDayData?.dayIndex} de 365
                </span>
                <DialogTitle className="text-xl font-bold mt-2 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-400" />
                  Programación del {selectedDayData?.isoDate}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-1">
                  Capacidad consumida: <strong>{selectedDayData?.totalLlamadasResolucion || 0} de {DAILY_CALL_CAPACITY} llamadas máximas</strong> ({selectedDayData?.cupoDisponible || DAILY_CALL_CAPACITY} llamadas libres para campañas).
                </DialogDescription>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Horario: 08:00 AM a 06:00 PM
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Lista de Pacientes con llamada ese día */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  Pacientes Asignados a este Día ({selectedDayData?.callsResolucion?.length || 0})
                </h4>
                <span className="text-xs text-slate-500">Priorizados por ventana de oportunidad clínica</span>
              </div>

              {!selectedDayData?.callsResolucion || selectedDayData.callsResolucion.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  No hay llamadas de la Resolución 3280 programadas para este día hábil. Capacidad completa disponible para campañas de demanda inducida.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  {selectedDayData.callsResolucion.map((c, idx) => (
                    <div 
                      key={idx}
                      className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{c.nombre}</span>
                          <span className="px-2 py-0.2 rounded text-[10px] font-bold text-white shadow-xs" style={{ backgroundColor: c.cursoVidaColorHex }}>
                            {c.cursoVidaNombre}
                          </span>
                          <span className="px-2 py-0.2 rounded text-[10px] font-bold text-white shadow-xs" style={{ backgroundColor: c.grupoRiesgoColorHex }}>
                            {c.grupoRiesgoNombre}
                          </span>
                        </div>
                        <div className="text-slate-500 flex items-center gap-3">
                          <span>CC: {c.documento}</span>
                          <span>Tel: {c.telefono}</span>
                          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.2 rounded">
                            CUPS: {c.cups}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-700 font-medium flex items-center gap-1">
                          <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                          <span>Hito: <strong>{c.accion3280}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const promptText = generateIndividualClinicalPrompt({
                              patient: { nombre: c.nombre, cc: c.documento, edad: 45 },
                              cursoVida: { nombre: c.cursoVidaNombre },
                              grupoRiesgo: { nombre: c.grupoRiesgoNombre },
                              hitoClinico: { titulo: c.accion3280, cups: c.cups, indicaciones: c.indicaciones }
                            });
                            setSelectedPatientPrompt({ ...c, promptText });
                          }}
                          className="text-[11px] font-bold rounded-xl gap-1 text-slate-700 border-slate-300 hover:bg-slate-100"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          Ver Prompt IA
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Previsualización del Prompt Particular del Paciente Seleccionado */}
            {selectedPatientPrompt && (
              <div className="bg-slate-900 text-slate-100 rounded-xl p-4 space-y-2 border border-slate-800 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Prompt Particular de Voz IA para {selectedPatientPrompt.nombre}
                    </span>
                  </div>
                  <button 
                    onClick={() => setSelectedPatientPrompt(null)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
                  {selectedPatientPrompt.promptText}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
