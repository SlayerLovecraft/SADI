import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, 
  CheckCircle2, AlertCircle, Info, Sparkles 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const DIAS_SEMANA_NOMBRES = [
  { id: 1, nombre: 'Lunes', abrev: 'Lun' },
  { id: 2, nombre: 'Martes', abrev: 'Mar' },
  { id: 3, nombre: 'Miércoles', abrev: 'Mié' },
  { id: 4, nombre: 'Jueves', abrev: 'Jue' },
  { id: 5, nombre: 'Viernes', abrev: 'Vie' },
  { id: 6, nombre: 'Sábado', abrev: 'Sáb' }
  // DOMINGO EXCLUIDO EXPLÍCITAMENTE
];

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function CampaignSchedulingCalendar({
  initialFrequency = 'diaria',
  initialConfig = null,
  onScheduleChange = null,
  onChange = () => {}
}) {
  const today = useMemo(() => new Date(), []);
  
  // Normalizar frecuencia ('diario' -> 'diaria')
  const normalizeFreq = (f) => {
    if (!f) return 'diaria';
    if (f === 'diario') return 'diaria';
    return f;
  };

  // Frecuencia: 'diaria' | 'semanal' | 'mensual'
  const [frecuencia, setFrecuencia] = useState(normalizeFreq(initialConfig?.frecuencia || initialFrequency));

  // Navegación de mes en el calendario visual
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11

  // Estado para modo DIARIO
  const [dailyStartDate, setDailyStartDate] = useState(initialConfig?.fechaInicio || null);
  const [dailyEndDate, setDailyEndDate] = useState(initialConfig?.fechaFin || null);

  // Estado para modo SEMANAL
  const [semanasCount, setSemanasCount] = useState(initialConfig?.semanas || 4);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(initialConfig?.diaSemana || 2); // 1 = Lunes, 2 = Martes
  const [weeklyStartDate, setWeeklyStartDate] = useState(initialConfig?.fechaInicio || null);

  // Estado para modo MENSUAL
  const [mesesCount, setMesesCount] = useState(initialConfig?.meses || 3);
  const [monthlyDay, setMonthlyDay] = useState(initialConfig?.diaMes || null);
  const [monthlyStartMonth, setMonthlyStartMonth] = useState(today.getMonth());
  const [monthlyStartYear, setMonthlyStartYear] = useState(today.getFullYear());

  // Helper: Saber si una fecha es domingo
  const isSunday = (date) => date.getDay() === 0;

  // Helper: Saber si una fecha es anterior a hoy
  const isPast = (date) => {
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetZero = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return targetZero < todayZero;
  };

  // Helper: Formato YYYY-MM-DD
  const formatDateISO = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Calcular fechas programadas según la frecuencia
  const scheduledDates = useMemo(() => {
    const dates = [];

    if (frecuencia === 'diaria') {
      if (!dailyStartDate) return [];
      const start = new Date(dailyStartDate + 'T12:00:00');
      const end = dailyEndDate ? new Date(dailyEndDate + 'T12:00:00') : start;

      let cur = new Date(start);
      while (cur <= end) {
        if (!isSunday(cur) && !isPast(cur)) {
          dates.push(formatDateISO(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
    } else if (frecuencia === 'semanal') {
      if (!weeklyStartDate) return [];
      const start = new Date(weeklyStartDate + 'T12:00:00');
      for (let i = 0; i < semanasCount; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + (i * 7));
        if (!isSunday(d)) {
          dates.push(formatDateISO(d));
        }
      }
    } else if (frecuencia === 'mensual') {
      if (!monthlyDay) return [];
      for (let i = 0; i < mesesCount; i++) {
        let y = monthlyStartYear;
        let m = monthlyStartMonth + i;
        while (m > 11) {
          m -= 12;
          y += 1;
        }

        const daysInTargetMonth = new Date(y, m + 1, 0).getDate();
        const actualDay = Math.min(monthlyDay, daysInTargetMonth);
        let candidate = new Date(y, m, actualDay, 12, 0, 0);

        // Si cae domingo, ajustar al lunes siguiente hábil
        if (candidate.getDay() === 0) {
          candidate.setDate(candidate.getDate() + 1);
        }
        if (!isPast(candidate)) {
          dates.push(formatDateISO(candidate));
        }
      }
    }

    return dates;
  }, [
    frecuencia, 
    dailyStartDate, 
    dailyEndDate, 
    semanasCount, 
    weeklyStartDate, 
    mesesCount, 
    monthlyDay, 
    monthlyStartMonth, 
    monthlyStartYear
  ]);

  // Generar texto resumen
  const resumenTexto = useMemo(() => {
    if (scheduledDates.length === 0) {
      return 'Selecciona los días en el calendario para programar el lanzamiento.';
    }

    if (frecuencia === 'diaria') {
      return `Lanzamiento Diario continuo: ${scheduledDates.length} días hábiles programados (del ${scheduledDates[0]} al ${scheduledDates[scheduledDates.length - 1]}).`;
    }
    if (frecuencia === 'semanal') {
      const dayName = DIAS_SEMANA_NOMBRES.find(d => d.id === selectedDayOfWeek)?.nombre || 'día seleccionado';
      return `Lanzamiento Semanal: Todos los ${dayName} durante ${semanasCount} semanas (${scheduledDates.length} ejecuciones).`;
    }
    if (frecuencia === 'mensual') {
      return `Lanzamiento Mensual: Cada día ${monthlyDay} durante ${mesesCount} meses (${scheduledDates.length} ejecuciones programadas).`;
    }
    return '';
  }, [frecuencia, scheduledDates, selectedDayOfWeek, semanasCount, monthlyDay, mesesCount]);

  // Emitir cambios hacia el componente padre
  useEffect(() => {
    const isValid = scheduledDates.length > 0;
    const payload = {
      frecuencia,
      frequency: frecuencia === 'diaria' ? 'diario' : frecuencia,
      fechaInicio: scheduledDates[0] || null,
      fechaFin: scheduledDates[scheduledDates.length - 1] || null,
      semanas: semanasCount,
      diaSemana: selectedDayOfWeek,
      diaSemanaNombre: DIAS_SEMANA_NOMBRES.find(d => d.id === selectedDayOfWeek)?.nombre,
      meses: mesesCount,
      diaMes: monthlyDay,
      selectedDates: scheduledDates,
      fechasProgramadas: scheduledDates,
      totalEjecuciones: scheduledDates.length,
      resumen: resumenTexto,
      summary: resumenTexto,
      esValido: isValid
    };

    if (typeof onScheduleChange === 'function') {
      onScheduleChange(payload);
    }
    if (typeof onChange === 'function') {
      onChange(payload);
    }
  }, [frecuencia, scheduledDates, resumenTexto]);

  // Días del mes en vista
  const daysInViewMonth = useMemo(() => {
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Domingo, 1 = Lunes...
    // Convertir para que semana arranque en Lunes (0 = Lun, 6 = Dom)
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const list = [];
    // Espacios vacíos antes del día 1
    for (let i = 0; i < offset; i++) {
      list.push(null);
    }
    // Días 1 a N
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(viewYear, viewMonth, d, 12, 0, 0);
      list.push({
        dayNum: d,
        dateObj,
        isoStr: formatDateISO(dateObj),
        isSunday: dateObj.getDay() === 0,
        isPast: isPast(dateObj),
        dayOfWeek: dateObj.getDay() === 0 ? 7 : dateObj.getDay() // 1 = Lunes, 6 = Sáb, 7 = Dom
      });
    }
    return list;
  }, [viewYear, viewMonth]);

  // Navegar mes
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Manejar clic en un día del calendario
  const handleDayClick = (dayItem) => {
    if (!dayItem || dayItem.isSunday || dayItem.isPast) return;

    if (frecuencia === 'diaria') {
      if (!dailyStartDate || (dailyStartDate && dailyEndDate)) {
        setDailyStartDate(dayItem.isoStr);
        setDailyEndDate(null);
      } else {
        if (dayItem.isoStr < dailyStartDate) {
          setDailyStartDate(dayItem.isoStr);
          setDailyEndDate(null);
        } else {
          setDailyEndDate(dayItem.isoStr);
        }
      }
    } else if (frecuencia === 'semanal') {
      // En modo semanal, solo se permiten los días que coinciden con el día de la semana elegido
      if (dayItem.dayOfWeek === selectedDayOfWeek) {
        setWeeklyStartDate(dayItem.isoStr);
      }
    } else if (frecuencia === 'mensual') {
      setMonthlyDay(dayItem.dayNum);
      setMonthlyStartMonth(viewMonth);
      setMonthlyStartYear(viewYear);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-sm">
      
      {/* 1. SELECTOR DE FRECUENCIA (DIARIO, SEMANAL, MENSUAL) */}
      <div>
        <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-2">
          Paso 0: Modalidad de Frecuencia del Lanzamiento
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'diaria', label: 'Diario', sub: 'Rango continuo de fechas' },
            { id: 'semanal', label: 'Semanal', sub: 'Día fijo por N semanas' },
            { id: 'mensual', label: 'Mensual', sub: 'Día fijo por N meses' }
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setFrecuencia(opt.id);
                // Resetear selecciones para evitar inconsistencias
                if (opt.id === 'diaria' && !dailyStartDate) {
                  const tom = new Date(today);
                  tom.setDate(tom.getDate() + 1);
                  if (tom.getDay() === 0) tom.setDate(tom.getDate() + 1);
                  setDailyStartDate(formatDateISO(tom));
                }
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                frecuencia === opt.id
                  ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black">{opt.label}</span>
                {frecuencia === opt.id && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. CONTROLES ESPECÍFICOS SEGÚN LA FRECUENCIA */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
        {frecuencia === 'diaria' && (
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Selección de Rango Diario (Lunes a Sábado - Sin Domingos):
              </span>
              <span className="text-[11px] text-blue-700 font-semibold">
                Haz clic en el día de inicio y luego en el día final
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">Desde:</span>
                <span className="font-bold text-slate-800">{dailyStartDate || 'Pendiente selección'}</span>
              </div>
              <span className="text-slate-400">➔</span>
              <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">Hasta:</span>
                <span className="font-bold text-slate-800">{dailyEndDate || dailyStartDate || 'Mismo día'}</span>
              </div>
            </div>
          </div>
        )}

        {frecuencia === 'semanal' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  1. ¿Cuántas semanas?
                </label>
                <select
                  value={semanasCount}
                  onChange={(e) => setSemanasCount(Number(e.target.value))}
                  className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'semana' : 'semanas consecutivas'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  2. ¿Qué día de la semana? (Excluye Domingos)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                  {DIAS_SEMANA_NOMBRES.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSelectedDayOfWeek(d.id);
                        setWeeklyStartDate(null); // Resetear día de inicio al cambiar de día
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                        selectedDayOfWeek === d.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {d.abrev}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-blue-800 bg-blue-100/60 p-2.5 rounded-lg">
              ℹ️ <strong>Instrucción:</strong> En el calendario a continuación, haz clic en el primer <strong>{DIAS_SEMANA_NOMBRES.find(d => d.id === selectedDayOfWeek)?.nombre}</strong> disponible a partir del cual arrancará la campaña.
            </p>
          </div>
        )}

        {frecuencia === 'mensual' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="w-full sm:w-1/2">
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  1. ¿Cuántos meses? (Máximo 12 meses):
                </label>
                <select
                  value={mesesCount}
                  onChange={(e) => setMesesCount(Number(e.target.value))}
                  className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'mes' : 'meses consecutivos'}</option>
                  ))}
                </select>
              </div>

              {monthlyDay && (
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                  <span className="text-[10px] text-slate-400 block font-semibold">Día del mes fijado:</span>
                  <span className="font-black text-blue-900 text-sm">Día {monthlyDay} de cada mes</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-emerald-800 bg-emerald-100/60 p-2.5 rounded-lg">
              ℹ️ <strong>Instrucción:</strong> Selecciona en el calendario de este mes el día (del 1 al 31) en que se lanzará la campaña cada mes (se omiten domingos y días pasados).
            </p>
          </div>
        )}
      </div>

      {/* 3. CALENDARIO VISUAL INTERACTIVO CON REGLAS ESTRICTAS */}
      <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs">
        {/* CABECERA DE NAVEGACIÓN DEL MES */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-black text-slate-900">
              {MESES_NOMBRES[viewMonth]} {viewYear}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrevMonth}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNextMonth}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* CABECERAS DE DÍAS (LUN A DOM) */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-black uppercase text-slate-400">
          <span>Lun</span>
          <span>Mar</span>
          <span>Mié</span>
          <span>Jue</span>
          <span>Vie</span>
          <span>Sáb</span>
          <span className="text-red-400">Dom</span>
        </div>

        {/* MATRIZ DE DÍAS */}
        <div className="grid grid-cols-7 gap-1">
          {daysInViewMonth.map((dayItem, idx) => {
            if (!dayItem) {
              return <div key={`empty-${idx}`} className="h-10 bg-transparent" />;
            }

            const isSelected = scheduledDates.includes(dayItem.isoStr);
            const isSundayDay = dayItem.isSunday;
            const isPastDay = dayItem.isPast;

            // En modo semanal: solo se habilitan los días que coinciden con el día de la semana
            const isWeeklyAllowed = frecuencia === 'semanal' 
              ? dayItem.dayOfWeek === selectedDayOfWeek && !isPastDay && !isSundayDay
              : true;

            const isDisabled = isSundayDay || isPastDay || (frecuencia === 'semanal' && !isWeeklyAllowed);

            return (
              <button
                key={dayItem.isoStr}
                type="button"
                onClick={() => handleDayClick(dayItem)}
                disabled={isDisabled}
                className={`h-11 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center relative ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md font-black ring-2 ring-blue-400/50'
                    : isDisabled
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-transparent'
                    : 'bg-white hover:bg-blue-50 text-slate-800 border border-slate-200'
                }`}
              >
                <span>{dayItem.dayNum}</span>

                {isSundayDay && (
                  <span className="text-[8px] font-semibold text-red-300 leading-none">Dom</span>
                )}

                {isSelected && (
                  <span className="w-1.5 h-1.5 bg-cyan-300 rounded-full mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. RESUMEN DE PROYECCIÓN Y FECHAS CALCULADAS */}
      <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 flex items-start gap-3 text-xs">
        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-blue-950 block">Resumen de Programación:</span>
          <p className="text-blue-900 mt-0.5 leading-relaxed">{resumenTexto}</p>
          
          {scheduledDates.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {scheduledDates.slice(0, 10).map((dStr, i) => (
                <span key={dStr} className="bg-white text-blue-800 font-mono font-bold px-2 py-0.5 rounded border border-blue-200 text-[10px]">
                  #{i + 1}: {dStr}
                </span>
              ))}
              {scheduledDates.length > 10 && (
                <span className="text-[10px] text-blue-600 font-bold self-center">
                  +{scheduledDates.length - 10} fechas más...
                </span>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

