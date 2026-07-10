import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import PatientLayout from '@/layouts/PatientLayout';
import MonthCalendar from '@/components/MonthCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService, DEFAULT_DOCTOR_SCHEDULE } from '@/services/appointmentService';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseTimeToMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const getIsoDow = (d) => {
  const js = d.getDay();
  return js === 0 ? 7 : js;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const addDays = (d, days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

const isWeekday = (d) => {
  const js = d.getDay();
  return js >= 1 && js <= 5;
};

const getMinSelectableDate = () => addDays(startOfDay(new Date()), 15);

const PatientSchedulePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const patientId = useMemo(() => String(user?.id || '').trim(), [user?.id]);
  const hospitalId = useMemo(() => String(user?.hospitalId || '').trim(), [user?.hospitalId]);
  const [resolvedHospitalId, setResolvedHospitalId] = useState(() => hospitalId);

  const minSelectableDate = useMemo(() => getMinSelectableDate(), []);
  const [monthDate, setMonthDate] = useState(() => {
    const min = getMinSelectableDate();
    return new Date(min.getFullYear(), min.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);

  const [schedule, setSchedule] = useState(DEFAULT_DOCTOR_SCHEDULE);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [showSlotsDialog, setShowSlotsDialog] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setResolvedHospitalId(hospitalId);
  }, [hospitalId]);

  useEffect(() => {
    const hydrateHospitalId = async () => {
      if (resolvedHospitalId || !patientId) return;

      const { data, error: qError } = await supabase
        .from('patients')
        .select('hospital_id')
        .eq('patient_id', patientId)
        .maybeSingle();

      if (qError) {
        setError(qError.message || 'No se pudo identificar el hospital del paciente');
        setLoading(false);
        return;
      }

      const hid = String(data?.hospital_id || '').trim();
      if (!hid) {
        setError('No se pudo identificar el hospital del paciente');
        setLoading(false);
        return;
      }

      setResolvedHospitalId(hid);
      try {
        const stored = localStorage.getItem('sadi_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.role === 'patient' && String(parsed?.id || '').trim() === patientId) {
            const next = { ...parsed, hospitalId: hid };
            localStorage.setItem('sadi_user', JSON.stringify(next));
          }
        }
      } catch {}
    };

    hydrateHospitalId();
  }, [patientId, resolvedHospitalId]);

  const loadDoctors = useCallback(async () => {
    if (!resolvedHospitalId) return { success: false, error: 'No se pudo identificar el hospital del paciente', data: [] };
    const { data, error: qError } = await supabase
      .from('staff')
      .select('doctor_id, doctor_name, doctor_specialty, is_active')
      .eq('hospital_id', resolvedHospitalId)
      .eq('is_active', true)
      .order('doctor_name', { ascending: true });

    if (qError) return { success: false, error: qError.message, data: [] };
    return { success: true, data: data || [] };
  }, [resolvedHospitalId]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const doctorsResult = await loadDoctors();
      if (!doctorsResult.success) {
        setDoctors([]);
        setLoading(false);
        setError(doctorsResult.error || 'No se pudo cargar la lista de doctores');
        return;
      }

      setDoctors(doctorsResult.data || []);
      if (!selectedDoctorId && doctorsResult.data?.[0]?.doctor_id) {
        setSelectedDoctorId(doctorsResult.data[0].doctor_id);
      }

      setLoading(false);
    } catch (e) {
      setDoctors([]);
      setLoading(false);
      setError(e?.message || 'No se pudo cargar el cronograma');
    }
  }, [loadDoctors, selectedDoctorId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadMonthData = useCallback(async () => {
    if (!selectedDoctorId || !patientId) return;

    setLoading(true);
    setError(null);

    const [scheduleResult, bookedResult, myResult] = await Promise.all([
      appointmentService.getDoctorSchedule(selectedDoctorId),
      appointmentService.getDoctorBookedSlotsForMonth(selectedDoctorId, monthDate),
      appointmentService.getPatientAppointmentsForMonth(patientId, monthDate),
    ]);

    if (!scheduleResult.success) setError(scheduleResult.error || 'No se pudo cargar el horario del doctor');
    if (!bookedResult.success) setError(bookedResult.error || 'No se pudo cargar disponibilidad del mes');
    if (!myResult.success) setError(myResult.error || 'No se pudieron cargar tus citas');

    setSchedule(scheduleResult.success ? scheduleResult.data : DEFAULT_DOCTOR_SCHEDULE);
    setBookedSlots(bookedResult.success ? bookedResult.data : []);
    setMyAppointments(myResult.success ? myResult.data : []);
    setLoading(false);
  }, [selectedDoctorId, monthDate, patientId]);

  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  const bookedMap = useMemo(() => {
    const map = new Map();
    (bookedSlots || []).forEach((row) => {
      const d = new Date(row.start_at);
      const key = isoDate(d);
      const list = map.get(key) || [];
      list.push(d.getTime());
      map.set(key, list);
    });
    return map;
  }, [bookedSlots]);

  const myByDay = useMemo(() => {
    const map = new Map();
    (myAppointments || []).forEach((a) => {
      const d = new Date(a.start_at);
      const key = isoDate(d);
      const list = map.get(key) || [];
      list.push(a);
      map.set(key, list);
    });
    return map;
  }, [myAppointments]);

  const selectedDoctor = useMemo(() => {
    return (doctors || []).find((d) => d.doctor_id === selectedDoctorId) || null;
  }, [doctors, selectedDoctorId]);

  const isDateSelectable = useCallback(
    (d) => {
      if (!d) return false;
      const day = startOfDay(d);
      return day.getTime() >= minSelectableDate.getTime() && isWeekday(day);
    },
    [minSelectableDate]
  );

  const generateSlotsForDate = useCallback(
    (date) => {
      if (!date) return [];
      if (!isDateSelectable(date)) return [];
      const slotMinutes = Number(schedule?.slot_minutes || 30);
      const workdays = Array.isArray(schedule?.workdays) ? schedule.workdays : DEFAULT_DOCTOR_SCHEDULE.workdays;
      const isoDow = getIsoDow(date);
      if (!workdays.includes(isoDow)) return [];

      const windows = [
        { start: schedule?.morning_start, end: schedule?.morning_end },
        { start: schedule?.afternoon_start, end: schedule?.afternoon_end },
      ];

      const bookedTimes = new Set(bookedMap.get(isoDate(date)) || []);
      const results = [];
      windows.forEach((w) => {
        const startMin = parseTimeToMinutes(w.start);
        const endMin = parseTimeToMinutes(w.end);
        if (startMin == null || endMin == null) return;

        for (let t = startMin; t + slotMinutes <= endMin; t += slotMinutes) {
          const [hh, mm] = minutesToTime(t).split(':').map((x) => Number(x));
          const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0, 0);
          if (!bookedTimes.has(slotDate.getTime())) {
            results.push(slotDate);
          }
        }
      });

      return results.sort((a, b) => a.getTime() - b.getTime());
    },
    [bookedMap, schedule]
  );

  const getDayMeta = useCallback(
    (day) => {
      const available = generateSlotsForDate(day);
      const hasAvailable = available.length > 0;
      const myList = myByDay.get(isoDate(day)) || [];
      const badge = myList.length ? `${myList.length}` : hasAvailable ? `${available.length}` : null;
      return {
        badge,
        dots: {
          disponible: hasAvailable,
          confirmada: myList.some((a) => a.status === 'confirmada'),
          pendiente: myList.some((a) => a.status === 'pendiente'),
          cancelada: myList.some((a) => a.status === 'cancelada'),
        },
      };
    },
    [generateSlotsForDate, myByDay]
  );

  const openSlots = (day) => {
    if (!isDateSelectable(day)) {
      toast({
        title: 'Fecha no disponible',
        description: 'Solo puedes agendar de lunes a viernes y con mínimo 15 días de anticipación.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedDate(day);
    setShowSlotsDialog(true);
  };

  const slotsForSelectedDay = useMemo(() => generateSlotsForDate(selectedDate), [generateSlotsForDate, selectedDate]);

  const handleBook = async (slotDate) => {
    setBooking(true);
    setError(null);

    const result = await appointmentService.createAppointment({
      patientId,
      doctorId: selectedDoctorId,
      startAt: slotDate,
    });

    setBooking(false);
    if (!result.success) {
      setError(result.error || 'No se pudo agendar la cita');
      toast({
        title: 'No se pudo agendar',
        description: result.error || 'Verifica la disponibilidad e intenta nuevamente',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: '✅ Cita agendada',
      description: `Tu cita quedó en estado pendiente para el ${slotDate.toLocaleString('es-CO')}`,
    });

    await loadMonthData();
    setShowSlotsDialog(false);
  };

  return (
    <PatientLayout>
      <Helmet>
        <title>Mi Cronograma - SADI Salud</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mi Cronograma</h1>
            <p className="text-gray-500 mt-1">Agenda tus citas en espacios disponibles</p>
          </div>

          <div className="w-full lg:w-[420px] rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
            <Label htmlFor="doctor-select">Doctor</Label>
            <select
              id="doctor-select"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-xl bg-white"
              disabled={loading || !doctors.length}
            >
              {doctors.map((d) => (
                <option key={d.doctor_id} value={d.doctor_id}>
                  {(d.doctor_name || 'Doctor') + (d.doctor_specialty ? ` · ${d.doctor_specialty}` : '')}
                </option>
              ))}
            </select>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                Disponible
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Pendiente
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Confirmada
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Cancelada
              </span>
            </div>
          </div>
        </div>

        {error ? <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm">{error}</div> : null}

        {loading ? (
          <div className="flex items-center justify-center h-72">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
              <p className="text-gray-600">Cargando cronograma...</p>
            </div>
          </div>
        ) : (
          <MonthCalendar
            monthDate={monthDate}
            onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            selectedDate={selectedDate}
            onSelectDate={(day) => openSlots(day)}
            getDayMeta={getDayMeta}
            isDayDisabled={(day) => !isDateSelectable(day)}
            headerAccent="teal"
          />
        )}

        <Dialog open={showSlotsDialog} onOpenChange={setShowSlotsDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedDate
                  ? `Espacios disponibles · ${selectedDate.toLocaleDateString('es-CO')}`
                  : 'Espacios disponibles'}
              </DialogTitle>
            </DialogHeader>

            <div className="text-sm text-gray-600">
              {selectedDoctor ? (
                <span>
                  {selectedDoctor.doctor_name || 'Doctor'}
                  {selectedDoctor.doctor_specialty ? ` · ${selectedDoctor.doctor_specialty}` : ''}
                </span>
              ) : null}
            </div>

            {!slotsForSelectedDay.length ? (
              <div className="text-sm text-gray-600 mt-4">No hay espacios disponibles en este día.</div>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {slotsForSelectedDay.map((slot) => (
                  <div key={slot.toISOString()} className="p-4 rounded-xl border border-gray-200 bg-white flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900">
                      {slot.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <Button disabled={booking} onClick={() => handleBook(slot)}>
                      {booking ? 'Agendando...' : 'Agendar'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PatientLayout>
  );
};

export default PatientSchedulePage;
