// ==============================================================================
// noShowFollowupService.js - SEGUIMIENTO AUTOMÁTICO A INASISTENTES A CITAS
// Regla oficial SADI:
//   - Si un paciente falta a su cita (fecha_cita_original):
//       1) Día +3 desde la fecha original de la cita -> Envío automático de SMS.
//       2) Si NO responde a ese SMS -> Día +2 después del SMS (+5 desde la cita)
//          -> Insistencia automática con otro SMS + E-Mail.
// ==============================================================================

import { supabase } from '@/lib/supabase';
import { campaignDispatchService } from './campaignDispatchService';

export const NOSHOW_POLICY = {
  sms1DelayDays: 3,
  insistenciaDelayAfterSms1Days: 2,
  totalInsistenciaDelayDays: 5,
  resumenCorto: 'Inasistencia → +3 días SMS → Si no responde, +2 días SMS + E-Mail',
  descripcion:
    'Si un paciente falta a su cita programada, SADI programa automáticamente un SMS a los 3 días de la fecha original. Si no responde, insiste 2 días después (día +5) con un segundo SMS y un E-Mail.',
};

export function addDaysISO(dateISO, days) {
  if (!dateISO) return '';
  const base = new Date(`${String(dateISO).slice(0, 10)}T12:00:00`);
  if (isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + Number(days || 0));
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeNoShowSchedule(fechaCitaOriginalISO) {
  const cleanDate = String(fechaCitaOriginalISO || '').slice(0, 10);
  const fechaSms1 = addDaysISO(cleanDate, NOSHOW_POLICY.sms1DelayDays);
  const fechaInsistencia2 = addDaysISO(fechaSms1, NOSHOW_POLICY.insistenciaDelayAfterSms1Days);
  return {
    fechaCitaOriginal: cleanDate,
    fechaSms1,
    fechaInsistencia2,
  };
}

export function buildNoShowMessages(patientName, fechaCitaOriginal, motivoCita = 'cita de salud preventiva') {
  const firstName = String(patientName || 'Paciente').split(' ')[0];
  return {
    sms1: `SADI Cali: Hola ${firstName}, notamos que no pudiste asistir a tu ${motivoCita} del ${fechaCitaOriginal}. Responde SI para reagendar sin costo o comunicate con tu IPS.`,
    sms2: `SADI Cali (Recordatorio): Hola ${firstName}, seguimos pendientes de reagendar tu ${motivoCita} del ${fechaCitaOriginal}. Tu salud es prioridad; responde SI o llamanos para asignar nueva fecha.`,
    emailSubject: `Recordatorio de reagendamiento de cita - SADI Cali (${fechaCitaOriginal})`,
    emailBody: `Estimado(a) ${patientName || 'Paciente'},\n\nRegistramos su inasistencia a la ${motivoCita} programada originalmente para el ${fechaCitaOriginal}. Hace 2 días le enviamos un mensaje SMS sin recibir confirmación.\n\nPor favor responda a este correo o al SMS adjunto para reagendar su cita en su IPS de Santiago de Cali.\n\nEquipo de Demanda Inducida SADI - Resolución 3280.`,
  };
}

export const noShowFollowupService = {
  async registerNoShow({
    hospitalId = null,
    patientId,
    fechaCitaOriginal,
    appointmentId = null,
    motivoCita = 'Cita programada Resolución 3280',
    notas = null,
  }) {
    const cleanDate = String(fechaCitaOriginal || '').slice(0, 10);
    if (!patientId || !cleanDate) {
      return { success: false, error: 'patientId y fechaCitaOriginal son obligatorios' };
    }

    const { data, error } = await supabase.rpc('register_appointment_noshow', {
      p_hospital_id: hospitalId || null,
      p_patient_id: patientId,
      p_fecha_cita_original: cleanDate,
      p_appointment_id: appointmentId || null,
      p_motivo_cita: motivoCita || null,
      p_notas: notas || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  },

  async listFollowups({ hospitalId = null, estado = 'todos', limit = 100 } = {}) {
    const { data, error } = await supabase.rpc('get_noshow_followups', {
      p_hospital_id: hospitalId || null,
      p_estado: estado || 'todos',
      p_limit: limit,
    });

    if (error) {
      return { success: false, error: error.message, data: [] };
    }
    return { success: true, data: Array.isArray(data) ? data : [] };
  },

  async dispatchStep1Sms(followupRow, { notas = null } = {}) {
    if (!followupRow?.id) return { success: false, error: 'ID inválido' };
    const msgs = buildNoShowMessages(
      followupRow.patient_name,
      followupRow.fecha_cita_original,
      followupRow.motivo_cita
    );

    let realSmsRes = null;
    if (followupRow.patient_phone) {
      realSmsRes = await campaignDispatchService.sendIndividualSms({
        patientId: followupRow.patient_id,
        name: followupRow.patient_name,
        document: followupRow.patient_document || '',
        phone: followupRow.patient_phone,
        message: msgs.sms1,
        hospitalId: followupRow.hospital_id || null,
        forceResend: true,
      }).catch((e) => ({ success: false, error: e?.message }));
    }

    const smsTag = realSmsRes?.success
      ? `SMS #1 (+3d) REAL enviado por Puerto ${realSmsRes.winningPort || 13} (ID: ${realSmsRes.gatewayMessageId || 'OK'})`
      : `SMS #1 (+3d) registrado${realSmsRes?.error ? ` (aviso gateway: ${realSmsRes.error})` : ''}`;

    const { data, error } = await supabase.rpc('update_noshow_followup_step', {
      p_id: followupRow.id,
      p_action: 'send_sms_1',
      p_notas: notas || `${smsTag}: "${msgs.sms1.slice(0, 120)}..."`,
    });
    if (error) return { success: false, error: error.message };

    return { success: true, data, messageSent: msgs.sms1, realSms: realSmsRes };
  },

  async markPatientResponded(followupRow, { notas = null } = {}) {
    if (!followupRow?.id) return { success: false, error: 'ID inválido' };
    const { data, error } = await supabase.rpc('update_noshow_followup_step', {
      p_id: followupRow.id,
      p_action: 'mark_responded',
      p_notas: notas || 'Paciente respondió al primer SMS (+3d); insistencia +2d cancelada.',
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  async dispatchStep2SmsAndEmail(followupRow, { notas = null } = {}) {
    if (!followupRow?.id) return { success: false, error: 'ID inválido' };
    const msgs = buildNoShowMessages(
      followupRow.patient_name,
      followupRow.fecha_cita_original,
      followupRow.motivo_cita
    );

    const [realSmsRes, realEmailRes] = await Promise.all([
      followupRow.patient_phone
        ? campaignDispatchService.sendIndividualSms({
            patientId: followupRow.patient_id,
            name: followupRow.patient_name,
            document: followupRow.patient_document || '',
            phone: followupRow.patient_phone,
            message: msgs.sms2,
            hospitalId: followupRow.hospital_id || null,
            forceResend: true,
          }).catch((e) => ({ success: false, error: e?.message }))
        : Promise.resolve(null),
      followupRow.patient_email
        ? campaignDispatchService.sendIndividualEmail({
            patientId: followupRow.patient_id,
            name: followupRow.patient_name,
            document: followupRow.patient_document || '',
            email: followupRow.patient_email,
            subject: msgs.emailSubject,
            textBody: msgs.emailBody,
            hospitalId: followupRow.hospital_id || null,
          }).catch((e) => ({ success: false, error: e?.message }))
        : Promise.resolve(null),
    ]);

    const { data, error } = await supabase.rpc('update_noshow_followup_step', {
      p_id: followupRow.id,
      p_action: 'send_insistencia_2',
      p_notas:
        notas ||
        `Insistencia (+2d tras SMS #1): 2° SMS (${realSmsRes?.success ? `OK P.${realSmsRes.winningPort || 13}` : 'registrado'}) y E-Mail (${realEmailRes?.success ? 'OK' : (followupRow.patient_email || 'sin correo')}).`,
    });
    if (error) return { success: false, error: error.message };

    return { success: true, data, smsSent: msgs.sms2, emailSubject: msgs.emailSubject, realSms: realSmsRes, realEmail: realEmailRes };
  },
};
