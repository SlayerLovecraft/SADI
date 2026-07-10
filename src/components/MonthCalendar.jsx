import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const addDays = (d, days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const weekdayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MonthCalendar = ({
  monthDate,
  onPrevMonth,
  onNextMonth,
  selectedDate,
  onSelectDate,
  getDayMeta,
  isDayDisabled,
  headerAccent = 'blue',
}) => {
  const days = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const jsDay = monthStart.getDay();
    const isoDow = jsDay === 0 ? 7 : jsDay;
    const gridStart = addDays(monthStart, -(isoDow - 1));
    const grid = [];
    for (let i = 0; i < 42; i++) {
      const day = addDays(gridStart, i);
      const inMonth = day.getMonth() === monthDate.getMonth();
      const key = isoDate(day);
      grid.push({ day, key, inMonth });
    }
    return { monthStart, monthEnd, grid };
  }, [monthDate]);

  const title = useMemo(() => {
    return monthDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  }, [monthDate]);

  const accent = headerAccent === 'teal' ? 'teal' : 'blue';
  const headerClass =
    accent === 'teal'
      ? 'bg-gradient-to-r from-teal-700 via-teal-600 to-teal-500'
      : 'bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500';

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      <div className={`${headerClass} px-5 py-4`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-white text-lg font-semibold capitalize truncate">{title}</h2>
            <p className="text-white/80 text-xs">Vista mensual</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={onPrevMonth} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onNextMonth} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="grid grid-cols-7 gap-2 text-xs text-gray-500 mb-2">
          {weekdayLabels.map((l) => (
            <div key={l} className="text-center font-medium">
              {l}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.grid.map(({ day, key, inMonth }) => {
            const meta = typeof getDayMeta === 'function' ? getDayMeta(day) : null;
            const isSelected = sameDay(day, selectedDate);
            const disabled = !inMonth || (typeof isDayDisabled === 'function' ? isDayDisabled(day) : false);

            const base =
              'group rounded-xl border transition-all duration-150 min-h-[82px] px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-offset-2';
            const selectable = disabled ? 'cursor-not-allowed' : 'cursor-pointer';
            const border = isSelected ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300';
            const bg = disabled ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-gray-50';
            const ring = accent === 'teal' ? 'focus:ring-teal-500' : 'focus:ring-blue-500';

            const dayNumberClass = isSelected ? 'text-gray-900 font-semibold' : inMonth ? 'text-gray-700' : 'text-gray-400';

            return (
              <button
                key={key}
                type="button"
                className={`${base} ${selectable} ${border} ${bg} ${ring}`}
                onClick={() => (!disabled ? onSelectDate?.(day) : null)}
                disabled={disabled}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={dayNumberClass}>{day.getDate()}</div>
                  {meta?.badge ? (
                    <div className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                      {meta.badge}
                    </div>
                  ) : null}
                </div>

                {meta?.lines?.length ? (
                  <div className="mt-2 space-y-1">
                    {meta.lines.slice(0, 3).map((line) => (
                      <div key={line} className="text-[11px] text-gray-600 truncate">
                        {line}
                      </div>
                    ))}
                    {meta.lines.length > 3 ? <div className="text-[11px] text-gray-500">+{meta.lines.length - 3} más</div> : null}
                  </div>
                ) : meta?.dots ? (
                  <div className="mt-3 flex items-center gap-1">
                    {meta.dots.confirmada ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
                    {meta.dots.pendiente ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : null}
                    {meta.dots.cancelada ? <span className="h-2 w-2 rounded-full bg-rose-500" /> : null}
                    {meta.dots.disponible ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                  </div>
                ) : (
                  <div className="mt-3 text-[11px] text-gray-400"> </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MonthCalendar;
