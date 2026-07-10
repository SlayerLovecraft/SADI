import { supabase } from '@/lib/supabase';

const toIsoDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DEFAULT_DOCTOR_SCHEDULE = {
  timezone: 'America/Bogota',
  slot_minutes: 30,
  workdays: [1, 2, 3, 4, 5],
  morning_start: '05:00',
  morning_end: '11:00',
  afternoon_start: '14:00',
  afternoon_end: '20:00',
};

export const appointmentService = {
  async getDoctorSchedule(doctorId) {
    const id = String(doctorId || '').trim();
    if (!id) return { success: false, error: 'doctorId inválido' };

    const { data, error } = await supabase.rpc('get_doctor_schedule', { p_doctor_id: id });
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: {
        ...DEFAULT_DOCTOR_SCHEDULE,
        ...(data || {}),
      },
    };
  },

  async getDoctorBookedSlotsForMonth(doctorId, monthDate) {
    const id = String(doctorId || '').trim();
    if (!id) return { success: false, error: 'doctorId inválido', data: [] };

    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const { data, error } = await supabase.rpc('get_doctor_booked_slots_month', {
      p_doctor_id: id,
      p_month_start: toIsoDate(monthStart),
    });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  },

  async getDoctorAppointmentsForMonth(doctorId, monthDate) {
    const id = String(doctorId || '').trim();
    if (!id) return { success: false, error: 'doctorId inválido', data: [] };

    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const { data, error } = await supabase.rpc('get_doctor_appointments_month', {
      p_doctor_id: id,
      p_month_start: toIsoDate(monthStart),
    });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  },

  async getPatientAppointmentsForMonth(patientId, monthDate) {
    const id = String(patientId || '').trim();
    if (!id) return { success: false, error: 'patientId inválido', data: [] };

    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const { data, error } = await supabase.rpc('get_patient_appointments_month', {
      p_patient_id: id,
      p_month_start: toIsoDate(monthStart),
    });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  },

  async createAppointment({ patientId, doctorId, startAt, notes }) {
    const patient_id = String(patientId || '').trim();
    const doctor_id = String(doctorId || '').trim();
    const start_at = startAt instanceof Date ? startAt.toISOString() : String(startAt || '').trim();

    if (!patient_id || !doctor_id || !start_at) {
      return { success: false, error: 'patientId, doctorId y startAt son requeridos' };
    }

    const { data, error } = await supabase.rpc('create_appointment_for_patient', {
      p_patient_id: patient_id,
      p_doctor_id: doctor_id,
      p_start_at: start_at,
      p_notes: notes || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  async updateAppointmentStatusAsDoctor({ doctorId, appointmentId, status }) {
    const doctor_id = String(doctorId || '').trim();
    const appointment_id = String(appointmentId || '').trim();
    const new_status = String(status || '').trim();

    if (!doctor_id || !appointment_id || !new_status) {
      return { success: false, error: 'doctorId, appointmentId y status son requeridos' };
    }

    const { data, error } = await supabase.rpc('update_appointment_status_for_doctor', {
      p_doctor_id: doctor_id,
      p_appointment_id: appointment_id,
      p_new_status: new_status,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};
