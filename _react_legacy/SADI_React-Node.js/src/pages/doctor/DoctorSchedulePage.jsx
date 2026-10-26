import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import MonthCalendar from '@/components/MonthCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const toIsoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const DoctorSchedulePage = () => {
  const { user } = useAuth();
  const doctorId = useMemo(() => String(user?.doctor_id || user?.id || '').trim(), [user?.doctor_id, user?.id]);

  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [showDayDialog, setShowDayDialog] = useState(false);

  const load = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    setError(null);
    const result = await appointmentService.getDoctorAppointmentsForMonth(doctorId, monthDate);
    if (!result.success) {
      setAppointments([]);
      setError(result.error || 'No se pudieron cargar las citas');
      setLoading(false);
      return;
    }
    setAppointments(result.data || []);
    setLoading(false);
  }, [doctorId, monthDate]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map();
    (appointments || []).forEach((a) => {
      const d = new Date(a.start_at);
      const key = toIsoDate(d);
      const existing = map.get(key) || [];
      existing.push(a);
      map.set(key, existing);
    });
    return map;
  }, [appointments]);

  const dayAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return byDay.get(toIsoDate(selectedDate)) || [];
  }, [byDay, selectedDate]);

  const getDayMeta = useCallback(
    (day) => {
      const list = byDay.get(toIsoDate(day)) || [];
      const dots = { confirmada: false, pendiente: false, cancelada: false };
      list.forEach((a) => {
        if (a.status === 'confirmada') dots.confirmada = true;
        if (a.status === 'pendiente') dots.pendiente = true;
        if (a.status === 'cancelada') dots.cancelada = true;
      });
      const badge = list.length ? `${list.length}` : null;
      return { badge, dots };
    },
    [byDay]
  );

  const openDay = (day) => {
    setSelectedDate(day);
    setShowDayDialog(true);
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  const handleStatus = async (appointmentId, status) => {
    setUpdating(true);
    const result = await appointmentService.updateAppointmentStatusAsDoctor({
      doctorId,
      appointmentId,
      status,
    });
    setUpdating(false);
    if (!result.success) {
      setError(result.error || 'No se pudo actualizar el estado');
      return;
    }
    await load();
  };

  return (
    <Layout>
      <Helmet>
        <title>Mi Cronograma - SADI</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mi Cronograma</h1>
            <p className="text-gray-500 mt-1">Citas médicas por mes</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Confirmada
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Pendiente
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Cancelada
            </span>
          </div>
        </div>

        {error ? <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm">{error}</div> : null}

        {loading ? (
          <div className="flex items-center justify-center h-72">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="text-gray-600">Cargando cronograma...</p>
            </div>
          </div>
        ) : (
          <MonthCalendar
            monthDate={monthDate}
            onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            selectedDate={selectedDate}
            onSelectDate={(day) => openDay(day)}
            getDayMeta={getDayMeta}
            headerAccent="blue"
          />
        )}

        <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedDate ? `Citas del ${selectedDate.toLocaleDateString('es-CO')}` : 'Citas del día'}
              </DialogTitle>
            </DialogHeader>

            {!dayAppointments.length ? (
              <div className="text-sm text-gray-600">No hay citas registradas para este día.</div>
            ) : (
              <div className="space-y-3">
                {dayAppointments.map((a) => (
                  <div key={a.id} className="p-4 rounded-xl border border-gray-200 bg-white flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatTime(a.start_at)}–{formatTime(a.end_at)}
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${
                            a.status === 'confirmada'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : a.status === 'pendiente'
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1 truncate">Paciente: {a.patient_name || a.patient_id}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        disabled={updating || a.status === 'confirmada'}
                        onClick={() => handleStatus(a.id, 'confirmada')}
                      >
                        Confirmar
                      </Button>
                      <Button
                        variant="outline"
                        className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        disabled={updating || a.status === 'cancelada'}
                        onClick={() => handleStatus(a.id, 'cancelada')}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default DoctorSchedulePage;

