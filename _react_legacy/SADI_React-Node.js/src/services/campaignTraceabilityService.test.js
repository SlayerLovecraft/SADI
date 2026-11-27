import { describe, it, expect } from 'vitest';
import {
  classifyAttendanceText,
  summarizeTraceabilityByChannel,
} from './campaignTraceabilityService';

describe('campaignTraceabilityService (attendance classifier & channel aggregation)', () => {
  it('classifies affirmative responses (1, Sí, Acepto, Puedo ir, Confirmo) as confirma_asistencia', () => {
    for (const phrase of ['1', 'Sí', 'Si', 'si claro', 'Acepto', 'Puedo ir', 'Confirmo asistencia', 'Allí estaré', 'OK', 'Vale']) {
      expect(classifyAttendanceText(phrase)).toBe('confirma_asistencia');
    }
  });

  it('classifies negative responses (2, No, No puedo ir, Cancelar, Reprogramar) as no_puede_asistir without positive false-positives', () => {
    for (const phrase of ['2', 'No', 'No puedo ir', 'No acepto', 'No confirmo', 'No asistiré', 'Necesito reprogramar', 'Cancelar', 'Imposible ese día']) {
      expect(classifyAttendanceText(phrase)).toBe('no_puede_asistir');
    }
  });

  it('leaves empty or non-conclusive replies as pendiente', () => {
    expect(classifyAttendanceText('')).toBe('pendiente');
    expect(classifyAttendanceText('   ')).toBe('pendiente');
    expect(classifyAttendanceText('A qué hora abren?')).toBe('pendiente');
  });

  it('aggregates counts per channel across SMS, Call, Email and WhatsApp', () => {
    const summary = summarizeTraceabilityByChannel([
      { channel: 'sms', response_status: 'confirma_asistencia' },
      { channel: 'sms', response_status: 'pendiente' },
      { channel: 'call', response_status: 'no_puede_asistir' },
      { channel: 'email', response_status: 'pendiente' },
      { channel: 'whatsapp', response_status: 'confirma_asistencia' },
    ]);
    expect(summary.sms.total).toBe(2);
    expect(summary.sms.confirma_asistencia).toBe(1);
    expect(summary.sms.pendiente).toBe(1);
    expect(summary.call.no_puede_asistir).toBe(1);
    expect(summary.email.pendiente).toBe(1);
    expect(summary.whatsapp.confirma_asistencia).toBe(1);
  });
});
