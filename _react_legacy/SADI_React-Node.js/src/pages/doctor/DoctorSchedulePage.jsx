import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import MonthCalendar from '@/components/MonthCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CursoVidaBadge, GruposRiesgoBadges } from '@/components/PatientClinicalBadges';
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
  const { toast } = useToast();
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
    if (status === 'inasistente') {
      toast({
        title: '📩 Seguimiento por Inasistencia Programado',
        description: 'Se agendó automáticamente: 1° SMS a los +3 días de la cita y, si no responde, insistencia con 2° SMS + E-Mail 2 días después (+5 días).',
      });
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
                  <div key={a.id} className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatTime(a.start_at)}–{formatTime(a.end_at)}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                            a.status === 'confirmada'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                              : a.status === 'pendiente'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                                : a.status === 'inasistente'
                                  ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/60'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                          }`}
                        >
                          {a.status === 'inasistente' ? 'Inasistente (+3d SMS → +2d SMS+Mail)' : a.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-slate-200 font-semibold truncate">
                        Paciente: {a.patient_name || a.patient_id}
                        {a.patient_document ? <span className="text-xs font-mono text-gray-500 dark:text-slate-400 ml-1.5">({a.patient_document})</span> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <CursoVidaBadge patient={{ curso_vida: a.patient_curso_vida }} />
                        <GruposRiesgoBadges patient={{ grupo_riesgo: a.patient_grupo_riesgo, grupos_riesgo: a.patient_grupos_riesgo }} maxVisible={3} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updating || a.status === 'confirmada'}
                        onClick={() => handleStatus(a.id, 'confirmada')}
                      >
                        Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                        disabled={updating || a.status === 'inasistente'}
                        onClick={() => handleStatus(a.id, 'inasistente')}
                        title="Marca inasistencia y programa SMS a +3 días y SMS + E-Mail a +5 días"
                      >
                        Inasistente
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
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

