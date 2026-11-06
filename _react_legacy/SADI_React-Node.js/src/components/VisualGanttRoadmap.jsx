// ==============================================================================
// VisualGanttRoadmap.jsx - ROADMAP VISUAL CLÍNICO DINÁMICO (ESTILO GANTT SWIMLANES)
// ==============================================================================
// Basado en el diseño visual de referencia de producto:
// - Eje de días real del mes seleccionado con hitos circulares
// - 3 Carriles (Swimlanes):
//   1. RESOLUCIÓN 3280 (Amarillo/Ocre) con llamadas y pacientes reales por día y hora
//   2. CAMPAÑAS ACTIVAS (Celeste/Sky) con barras de duración reales por día
//   3. INDIVIDUAL O PARTICULAR (Lavanda/Púrpura) con llamadas bajo demanda y transcripciones
// - Navegación real entre meses: al cambiar de mes los días y las llamadas cambian dinámicamente
// ==============================================================================

import React, { useState, useMemo } from 'react';
import { 
  Stethoscope, Send, PhoneCall, Calendar, Users, CheckCircle2,
  AlertCircle, Clock, Sparkles, ChevronRight, Eye, Phone,
  FileSpreadsheet, Baby, HeartPulse, UserCheck, Layers,
  ChevronLeft, Search, Filter, PhoneForwarded, MessageSquare,
  FileCheck2, Check, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MESES_DEL_ANIO } from '@/services/roadmapService';

export default function VisualGanttRoadmap({
  resolutionData = [],
  campaignsData = [],
  individualData = [],
  selectedYear = new Date().getFullYear(),
  selectedMonth = new Date().getMonth() + 1,
  onChangeMonth = () => {},
  onMakeCall = () => {},
  onViewTranscript = () => {}
}) {
  // Búsqueda y filtros interactivos
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('todos');

  // Modo de visualización: 'mes_completo' | 'semana'
  const [viewMode, setViewMode] = useState('mes_completo');
  const [selectedWeek, setSelectedWeek] = useState(1); // 1 a 5

  // Modal para detalle de un día o de un paciente
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);
  const [selectedPatientModal, setSelectedPatientModal] = useState(null);
  const [selectedCampaignModal, setSelectedCampaignModal] = useState(null);

  const nombreMes = MESES_DEL_ANIO.find(m => m.id === Number(selectedMonth))?.nombre || `Mes ${selectedMonth}`;

  // --------------------------------------------------------------------------
  // CÁLCULO DINÁMICO DE DÍAS DEL MES SELECCIONADO
  // --------------------------------------------------------------------------
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const allMonthDays = useMemo(() => {
    const list = [];
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === Number(selectedYear) && (today.getMonth() + 1) === Number(selectedMonth);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedYear, selectedMonth - 1, d);
      const dayOfWeek = dateObj.getDay(); // 0 = Dom, 1 = Lun, ...
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const mm = String(selectedMonth).padStart(2, '0');
      const dd = String(d).padStart(2, '0');

      list.push({
        dayNum: d,
        dayName: dayNames[dayOfWeek],
        dateStr: `${selectedYear}-${mm}-${dd}`,
        isWeekend: dayOfWeek === 0, // Domingo
        isToday: isCurrentMonth && today.getDate() === d,
        weekNum: Math.min(5, Math.ceil(d / 7))
      });
    }
    return list;
  }, [selectedYear, selectedMonth, daysInMonth]);

  // Días que se renderizan según el filtro de semana o mes completo
  const visibleDays = useMemo(() => {
    if (viewMode === 'semana') {
      return allMonthDays.filter(d => d.weekNum === selectedWeek);
    }
    return allMonthDays;
  }, [allMonthDays, viewMode, selectedWeek]);

  // --------------------------------------------------------------------------
  // MAPEO REAL DE LLAMADAS Y PACIENTES POR DÍA
  // --------------------------------------------------------------------------
  // Filtro de búsqueda y curso de vida
  const filteredResolution = useMemo(() => {
    return resolutionData.filter(item => {
      const matchesCourse = filterCourse === 'todos' || item.cursoVida === filterCourse;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        item.nombre.toLowerCase().includes(term) ||
        item.documento.includes(term) ||
        item.telefono.includes(term) ||
        item.hitoClinico.toLowerCase().includes(term);
      return matchesCourse && matchesSearch;
    });
  }, [resolutionData, filterCourse, searchTerm]);

  // Indexar pacientes de Resolución 3280 por día del mes
  const resolutionByDay = useMemo(() => {
    const map = {};
    for (const item of filteredResolution) {
      const d = item.diaNumero || (item.fechaProgramada ? Number(item.fechaProgramada.split('-')[2]) : 1);
      if (!map[d]) map[d] = [];
      map[d].push(item);
    }
    return map;
  }, [filteredResolution]);

  // Indexar campañas por rango de días
  const campaignsWithSpan = useMemo(() => {
    return campaignsData.map((c, i) => {
      const start = Number(c.diaInicio) || 1;
      const destinatarios = Number(c.destinatarios) || 32;
      const daysDuration = Math.max(1, Math.min(6, Math.ceil(destinatarios / 32)));
      const end = Math.min(daysInMonth, start + daysDuration - 1);

      return {
        ...c,
        id: c.id || `camp_${i}`,
        startDay: start,
        endDay: end,
        durationDays: daysDuration
      };
    });
  }, [campaignsData, daysInMonth]);

  // Indexar llamadas individuales por día
  const individualsByDay = useMemo(() => {
    const map = {};
    for (const ind of individualData) {
      let d = ind.diaNumero;
      if (!d && ind.rawDate) {
        d = new Date(ind.rawDate).getDate();
      }
      if (!d && ind.fechaHora) {
        const parts = ind.fechaHora.split('/');
        if (parts.length >= 2) d = Number(parts[0]);
      }
      d = d || 1;
      if (!map[d]) map[d] = [];
      map[d].push(ind);
    }
    return map;
  }, [individualData]);

  // --------------------------------------------------------------------------
  // NAVEGACIÓN DE MESES ANTERIOR / SIGUIENTE
  // --------------------------------------------------------------------------
  const handlePrevMonth = () => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    onChangeMonth(newYear, newMonth);
  };

  const handleNextMonth = () => {
    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    onChangeMonth(newYear, newMonth);
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm overflow-hidden p-6 space-y-6">

      {/* ===================================================================== */}
      {/* BARRA SUPERIOR DE ENCABEZADO Y CONTROL DE MESES */}
      {/* ===================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">
            <span>SADI EPS // HOSPITAL CENTRAL // CLINICAL ROADMAP 3280</span>
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight mt-0.5">
            Línea de Tiempo Mensual de Llamadas y Atenciones Médicas
          </h2>
          <p className="text-xs text-gray-500">
            Cronograma inamovible por días con pacientes asignados, campañas activas y llamadas particulares auditadas.
          </p>
        </div>

        {/* NAVEGADOR RÁPIDO DE MESES Y LEYENDA */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Navegador de Mes con Flechas */}
          <div className="flex items-center bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white rounded-xl text-gray-700 transition-all font-bold flex items-center gap-1 text-xs px-2.5"
              title="Mes Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </button>

            <div className="px-3 py-1 bg-white rounded-xl shadow-sm border border-gray-200 mx-1">
              <span className="text-xs font-black text-blue-900 whitespace-nowrap">
                {nombreMes} {selectedYear} ({daysInMonth} días)
              </span>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white rounded-xl text-gray-700 transition-all font-bold flex items-center gap-1 text-xs px-2.5"
              title="Mes Siguiente"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Selector de Vista: Mes Completo vs Semanas */}
          <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200">
            <button
              onClick={() => setViewMode('mes_completo')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                viewMode === 'mes_completo'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mes Completo (1-{daysInMonth})
            </button>
            <button
              onClick={() => setViewMode('semana')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                viewMode === 'semana'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Por Semanas
            </button>
          </div>

          {/* Leyenda de Puntos como en la Imagen de Referencia */}
          <div className="hidden xl:flex items-center gap-4 text-xs font-bold text-gray-600 pl-2">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400"></span>
              Res. 3280
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-sky-400"></span>
              Campañas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-400"></span>
              Individuales
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* FILTROS DINÁMICOS: BÚSQUEDA Y SELECTOR DE SEMANAS */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/80 p-3 rounded-2xl border border-gray-200">
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Semana cuando viewMode === 'semana' */}
          {viewMode === 'semana' && (
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm mr-2">
              {[1, 2, 3, 4, 5].map((w) => {
                const isAvail = (w - 1) * 7 < daysInMonth;
                if (!isAvail) return null;
                const startD = (w - 1) * 7 + 1;
                const endD = Math.min(daysInMonth, w * 7);
                const isSel = selectedWeek === w;
                return (
                  <button
                    key={w}
                    onClick={() => setSelectedWeek(w)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      isSel ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Semana {w} ({startD}-{endD})
                  </button>
                );
              })}
            </div>
          )}

          {/* Buscador de Paciente */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar paciente por nombre, cédula o tel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>

          {/* Filtro de Curso de Vida */}
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-xl bg-white focus:outline-none font-semibold text-gray-700"
          >
            <option value="todos">Todos los Cursos de Vida (3280)</option>
            <option value="primera_infancia">Primera Infancia (0 a 5 años)</option>
            <option value="infancia">Infancia (6 a 11 años)</option>
            <option value="adolescencia">Adolescencia (12 a 17 años)</option>
            <option value="juventud">Juventud (18 a 28 años)</option>
            <option value="adultez">Adultez (29 a 59 años)</option>
            <option value="vejez">Vejez (60+ años)</option>
            <option value="materno_perinatal">Ruta Materno Perinatal (RIAMP)</option>
          </select>
        </div>

        <div className="text-xs font-bold text-gray-600">
          <span>{filteredResolution.length} pacientes programados en {nombreMes} {selectedYear}</span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TABLERO GANTT / SWIMLANES POR DÍAS REALES DEL MES */}
      {/* ===================================================================== */}
      <div className="overflow-x-auto border border-gray-200/90 rounded-3xl shadow-sm bg-white">
        <div style={{ minWidth: `${Math.max(900, visibleDays.length * 150 + 260)}px` }}>

          {/* ----------------------------------------------------------------- */}
          {/* EJE TEMPORAL: HITOS CIRCULARES POR DÍA (IDÉNTICO A LA IMAGEN) */}
          {/* ----------------------------------------------------------------- */}
          <div className="flex border-b-2 border-gray-900 bg-gray-50/50 py-3 sticky top-0 z-20">
            {/* Columna Izquierda: Encabezado de carriles */}
            <div className="w-64 shrink-0 pl-6 flex items-center font-bold text-xs text-gray-500 uppercase tracking-wider">
              <span>Cursos & Modalidad</span>
            </div>

            {/* Columnas de los días del mes con línea continua y círculos */}
            <div className="flex-1 flex relative items-center justify-between pr-4">
              <div className="absolute left-0 right-4 h-0.5 bg-gray-900 -z-0"></div>

              {visibleDays.map((day) => (
                <div 
                  key={day.dayNum} 
                  onClick={() => setSelectedDayDetails(day)}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-md border-2 transition-all relative z-10 ${
                    day.isToday
                      ? 'bg-blue-600 text-white border-blue-300 ring-4 ring-blue-100 scale-110'
                      : day.isWeekend
                      ? 'bg-gray-400 text-white border-white'
                      : 'bg-gray-900 text-white border-white group-hover:bg-blue-700'
                  }`}>
                    {day.dayNum}
                  </div>
                  <span className={`text-[10px] font-bold mt-1 uppercase ${
                    day.isToday ? 'text-blue-700 font-black' : day.isWeekend ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {day.dayName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* SWIMLANE 1: RESOLUCIÓN 3280 (Amarillo / Ocre) */}
          {/* ----------------------------------------------------------------- */}
          <div className="flex border-b border-gray-200 py-4 relative group/lane hover:bg-amber-50/10 transition-colors">
            {/* Cabecera Izquierda del Carril */}
            <div className="w-64 shrink-0 pl-6 pr-4 flex flex-col justify-center border-r border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 leading-tight">RESOLUCIÓN 3280</h3>
                  <span className="text-[10px] text-gray-500 font-medium">Atención Preventiva</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Tandas de 10:00 AM a 06:00 PM • Obligatorias
              </p>
              <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md w-fit">
                {filteredResolution.length} Pacientes este Mes
              </div>
            </div>

            {/* Columnas de Días con Pacientes Reales Asignados */}
            <div className="flex-1 flex pr-4">
              {visibleDays.map((day) => {
                const dayPatients = resolutionByDay[day.dayNum] || [];
                const hasPatients = dayPatients.length > 0;

                return (
                  <div
                    key={day.dayNum}
                    className={`flex-1 min-w-[130px] p-1.5 border-r border-gray-100 flex flex-col gap-1.5 relative ${
                      day.isWeekend ? 'bg-gray-50/60' : ''
                    } ${day.isToday ? 'bg-blue-50/30' : ''}`}
                  >
                    {hasPatients ? (
                      dayPatients.map((pat) => (
                        <div
                          key={pat.id}
                          onClick={() => setSelectedPatientModal(pat)}
                          className="p-2 rounded-xl border border-amber-300 bg-amber-100/90 hover:bg-amber-200 hover:scale-[1.02] transition-all cursor-pointer shadow-sm text-amber-950 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[9px] font-extrabold bg-amber-200/90 text-amber-900 px-1.5 py-0.2 rounded">
                              {pat.horaProgramada}
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full ${
                              pat.estado === 'Confirmada' ? 'bg-emerald-200 text-emerald-900' : 'bg-white/70 text-gray-700'
                            }`}>
                              {pat.estado}
                            </span>
                          </div>

                          <div className="font-black text-[11px] leading-tight truncate" title={pat.nombre}>
                            {pat.nombre}
                          </div>
                          <div className="text-[9px] opacity-75 font-mono truncate">
                            {pat.documento}
                          </div>
                          <div className="text-[9px] font-semibold text-amber-900 mt-1 line-clamp-2 leading-tight" title={pat.hitoClinico}>
                            {pat.hitoClinico}
                          </div>

                          <div className="mt-1.5 pt-1 border-t border-amber-200/60 flex items-center justify-between">
                            <span className="text-[8px] font-bold text-amber-800 uppercase truncate">
                              {pat.cursoVidaLabel.split(' ')[0]}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMakeCall(pat);
                              }}
                              className="p-1 hover:bg-amber-300 rounded text-amber-900 transition-colors"
                              title="Llamar por Puerto 22"
                            >
                              <Phone className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full min-h-[90px] flex items-center justify-center">
                        <span className="text-[10px] text-gray-300 font-medium">
                          {day.isWeekend ? 'Descanso' : 'Sin citas'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* SWIMLANE 2: CAMPAÑAS ACTIVAS (Celeste / Sky) */}
          {/* ----------------------------------------------------------------- */}
          <div className="flex border-b border-gray-200 py-4 relative group/lane hover:bg-sky-50/10 transition-colors">
            {/* Cabecera Izquierda del Carril */}
            <div className="w-64 shrink-0 pl-6 pr-4 flex flex-col justify-center border-r border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 leading-tight">CAMPAÑAS ACTIVAS</h3>
                  <span className="text-[10px] text-gray-500 font-medium">Inducción y Prevención</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Llamadas por tandas de 32 cada 30 min
              </p>
              <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-black bg-sky-100 text-sky-900 px-2 py-0.5 rounded-md w-fit">
                {campaignsWithSpan.length} Campañas este Mes
              </div>
            </div>

            {/* Columnas con Barras de Campañas Extensibles */}
            <div className="flex-1 flex pr-4 relative">
              {visibleDays.map((day) => {
                // Campañas activas en este día específico
                const activeCamps = campaignsWithSpan.filter(c => day.dayNum >= c.startDay && day.dayNum <= c.endDay);

                return (
                  <div
                    key={day.dayNum}
                    className={`flex-1 min-w-[130px] p-1.5 border-r border-gray-100 flex flex-col gap-1.5 ${
                      day.isWeekend ? 'bg-gray-50/60' : ''
                    }`}
                  >
                    {activeCamps.map((camp) => (
                      <div
                        key={camp.id}
                        onClick={() => setSelectedCampaignModal(camp)}
                        className="p-2.5 rounded-xl border border-sky-300 bg-sky-100/90 hover:bg-sky-200 hover:scale-[1.01] transition-all cursor-pointer shadow-sm text-sky-950 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[9px] font-black bg-sky-200 text-sky-900 px-1.5 py-0.2 rounded">
                            Día {camp.startDay}-{camp.endDay}
                          </span>
                          <span className="text-[8px] font-bold text-sky-700">
                            {camp.destinatarios} pac
                          </span>
                        </div>

                        <div className="font-bold text-[10px] leading-tight truncate" title={camp.nombre}>
                          {camp.nombre}
                        </div>
                        <div className="text-[8px] text-sky-800 opacity-80 mt-1 line-clamp-2">
                          {camp.rangoEdadDisplay}
                        </div>

                        <div className="mt-1.5 pt-1 border-t border-sky-200 text-[8px] font-semibold text-sky-800 flex items-center justify-between">
                          <span>{camp.modoReintento?.includes('Hasta') ? 'Reintentos ON' : '1 sola vez'}</span>
                          <ChevronRight className="w-2.5 h-2.5" />
                        </div>
                      </div>
                    ))}
                    {activeCamps.length === 0 && (
                      <div className="h-full min-h-[60px] flex items-center justify-center">
                        <span className="text-[10px] text-gray-300 font-medium">-</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* SWIMLANE 3: INDIVIDUAL O PARTICULAR (Lavanda / Púrpura) */}
          {/* ----------------------------------------------------------------- */}
          <div className="flex py-4 relative group/lane hover:bg-purple-50/10 transition-colors">
            {/* Cabecera Izquierda del Carril */}
            <div className="w-64 shrink-0 pl-6 pr-4 flex flex-col justify-center border-r border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 leading-tight">INDIVIDUAL O PARTICULAR</h3>
                  <span className="text-[10px] text-gray-500 font-medium">Bajo Demanda y Trazabilidad</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Llamadas emitidas desde Demanda Res. 3280
              </p>
              <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-black bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md w-fit">
                {individualData.length} Llamadas Auditadas
              </div>
            </div>

            {/* Columnas con Llamadas Individuales */}
            <div className="flex-1 flex pr-4">
              {visibleDays.map((day) => {
                const dayIndivs = individualsByDay[day.dayNum] || [];

                return (
                  <div
                    key={day.dayNum}
                    className={`flex-1 min-w-[130px] p-1.5 border-r border-gray-100 flex flex-col gap-1.5 ${
                      day.isWeekend ? 'bg-gray-50/60' : ''
                    }`}
                  >
                    {dayIndivs.map((ind) => (
                      <div
                        key={ind.id}
                        onClick={() => onViewTranscript(ind)}
                        className="p-2 rounded-xl border border-purple-300 bg-purple-100/90 hover:bg-purple-200 hover:scale-[1.02] transition-all cursor-pointer shadow-sm text-purple-950 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[9px] font-extrabold bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded">
                            {ind.hora || '11:00 AM'}
                          </span>
                          <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full ${
                            ind.resultado === 'Efectiva' ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                          }`}>
                            {ind.resultado}
                          </span>
                        </div>

                        <div className="font-black text-[11px] leading-tight truncate">
                          {ind.pacienteNombre}
                        </div>
                        <div className="text-[9px] font-mono text-purple-800 truncate">
                          {ind.telefono}
                        </div>
                        <div className="text-[9px] opacity-80 mt-1 line-clamp-1">
                          {ind.motivoContacto}
                        </div>

                        <div className="mt-1.5 pt-1 border-t border-purple-200 text-[8px] font-bold text-purple-900 flex items-center justify-between">
                          <span>{ind.duracionSegundos} seg</span>
                          <span className="flex items-center gap-0.5 text-blue-700">
                            Ver Chat <Eye className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    ))}
                    {dayIndivs.length === 0 && (
                      <div className="h-full min-h-[60px] flex items-center justify-center">
                        <span className="text-[10px] text-gray-300 font-medium">-</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL DETALLE DE PACIENTE ASIGNADO (AL HACER CLIC EN UN PACIENTE) */}
      {/* ===================================================================== */}
      <Dialog open={!!selectedPatientModal} onOpenChange={() => setSelectedPatientModal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-amber-600" />
              Detalle de Atención Programada Res. 3280
            </DialogTitle>
            <DialogDescription>
              Programación inamovible para {selectedPatientModal?.nombre} en {nombreMes} {selectedYear}
            </DialogDescription>
          </DialogHeader>

          {selectedPatientModal && (
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-500 block">Paciente:</span>
                    <span className="font-bold text-base text-gray-900">{selectedPatientModal.nombre}</span>
                  </div>
                  <span className="text-xs font-bold bg-amber-200 text-amber-900 px-2.5 py-1 rounded-xl">
                    {selectedPatientModal.cursoVidaLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200">
                  <div>
                    <span className="text-gray-500 block">Documento:</span>
                    <span className="font-mono font-bold text-gray-900">{selectedPatientModal.documento}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Teléfono:</span>
                    <span className="font-mono font-bold text-gray-900">{selectedPatientModal.telefono}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Fecha Programada:</span>
                    <span className="font-bold text-gray-900">{selectedPatientModal.fechaProgramada} ({selectedPatientModal.diaNombre})</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Hora y Tanda:</span>
                    <span className="font-bold text-blue-700">{selectedPatientModal.horaProgramada} ({selectedPatientModal.slotLabel})</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-700 block mb-1">Hito Clínico Resolución 3280 de 2018:</span>
                <p className="text-xs text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-200 leading-relaxed">
                  {selectedPatientModal.hitoClinico}
                </p>
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  Código Procedimiento CUPS: {selectedPatientModal.codigoCups}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  onClick={() => {
                    onMakeCall(selectedPatientModal);
                    setSelectedPatientModal(null);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl gap-2 shadow-md"
                >
                  <Phone className="w-4 h-4" />
                  Emitir Llamada en Vivo al Paciente (Puerto 22)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL DETALLE DE DÍA (AL HACER CLIC EN EL CÍRCULO DEL DÍA) */}
      {/* ===================================================================== */}
      <Dialog open={!!selectedDayDetails} onOpenChange={() => setSelectedDayDetails(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Llamadas y Atenciones del Día {selectedDayDetails?.dayNum} de {nombreMes} {selectedYear} ({selectedDayDetails?.dayName})
            </DialogTitle>
            <DialogDescription>
              Resumen integral de pacientes asignados a este día para las 3 secciones del Roadmap.
            </DialogDescription>
          </DialogHeader>

          {selectedDayDetails && (
            <div className="space-y-4 pt-2">
              {/* Pacientes de Resolución en este día */}
              <div>
                <span className="text-xs font-bold text-amber-900 block mb-2">
                  1. Pacientes de Resolución 3280 ({resolutionByDay[selectedDayDetails.dayNum]?.length || 0}):
                </span>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl bg-white max-h-48 overflow-y-auto">
                  {(resolutionByDay[selectedDayDetails.dayNum] || []).length === 0 ? (
                    <p className="p-4 text-xs text-gray-400 text-center">No hay citas de Resolución 3280 asignadas a este día.</p>
                  ) : (
                    resolutionByDay[selectedDayDetails.dayNum].map((p) => (
                      <div key={p.id} className="p-3 flex items-center justify-between hover:bg-gray-50 text-xs">
                        <div>
                          <div className="font-bold text-gray-900">{p.nombre} ({p.horaProgramada})</div>
                          <div className="text-[11px] text-gray-500">CC: {p.documento} • Tel: {p.telefono}</div>
                          <div className="text-[10px] text-amber-800 font-semibold">{p.hitoClinico}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onMakeCall(p);
                            setSelectedDayDetails(null);
                          }}
                          className="text-xs font-bold rounded-xl text-blue-700 border-blue-200"
                        >
                          <Phone className="w-3.5 h-3.5 mr-1" />
                          Llamar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Campañas activas en este día */}
              <div>
                <span className="text-xs font-bold text-sky-900 block mb-2">
                  2. Campañas Activas en este Día:
                </span>
                <div className="space-y-2">
                  {campaignsWithSpan.filter(c => selectedDayDetails.dayNum >= c.startDay && selectedDayDetails.dayNum <= c.endDay).length === 0 ? (
                    <p className="p-3 bg-gray-50 rounded-xl text-xs text-gray-400 text-center">Sin campañas en este día.</p>
                  ) : (
                    campaignsWithSpan.filter(c => selectedDayDetails.dayNum >= c.startDay && selectedDayDetails.dayNum <= c.endDay).map((c) => (
                      <div key={c.id} className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs space-y-1">
                        <div className="font-bold text-sky-950">{c.nombre}</div>
                        <div className="text-gray-600">{c.rangoEdadDisplay} • {c.destinatarios} pacientes</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Llamadas individuales de este día */}
              <div>
                <span className="text-xs font-bold text-purple-900 block mb-2">
                  3. Llamadas Individuales Auditadas en este Día:
                </span>
                <div className="space-y-2">
                  {(individualsByDay[selectedDayDetails.dayNum] || []).length === 0 ? (
                    <p className="p-3 bg-gray-50 rounded-xl text-xs text-gray-400 text-center">No hay llamadas particulares registradas en este día.</p>
                  ) : (
                    individualsByDay[selectedDayDetails.dayNum].map((ind) => (
                      <div key={ind.id} className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-purple-950">{ind.pacienteNombre} ({ind.hora || '11:00 AM'})</div>
                          <div className="text-gray-600">{ind.motivoContacto} • Tel: {ind.telefono}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            onViewTranscript(ind);
                            setSelectedDayDetails(null);
                          }}
                          className="text-xs font-bold text-purple-700"
                        >
                          Ver Transcripción
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL DETALLE DE CAMPAÑA */}
      {/* ===================================================================== */}
      <Dialog open={!!selectedCampaignModal} onOpenChange={() => setSelectedCampaignModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-sky-600" />
              {selectedCampaignModal?.nombre}
            </DialogTitle>
            <DialogDescription>
              Campaña activa para {nombreMes} {selectedYear}
            </DialogDescription>
          </DialogHeader>

          {selectedCampaignModal && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3.5 bg-sky-50 rounded-2xl border border-sky-200 space-y-1.5">
                <div><strong>Días de Ejecución:</strong> Del Día {selectedCampaignModal.startDay} al {selectedCampaignModal.endDay} de {nombreMes}</div>
                <div><strong>Segmento / Edad:</strong> {selectedCampaignModal.rangoEdadDisplay}</div>
                <div><strong>Estrategia de Reintento:</strong> {selectedCampaignModal.modoReintento}</div>
                <div><strong>Destinatarios Asignados:</strong> {selectedCampaignModal.destinatarios} pacientes</div>
                <div><strong>Duración Estimada Agente:</strong> {selectedCampaignModal.duracionEstimada}</div>
              </div>

              <div>
                <span className="font-bold text-gray-700 block mb-1">Directrices para el Agente IA:</span>
                <p className="bg-gray-50 p-3 rounded-xl border border-gray-200 italic leading-relaxed text-gray-700">
                  "{selectedCampaignModal.contextoAgente}"
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
