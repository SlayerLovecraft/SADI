import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractCampaignChannels,
  isCampaignStartingToday,
  formatDispatchSummary,
  campaignDispatchService,
} from './campaignDispatchService';

describe('campaignDispatchService (3-channel omnichannel & strict local guard)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts call, sms, and email channels while omitting whatsapp', () => {
    const ch = extractCampaignChannels({
      canales_detalle: { call: true, sms: true, email: true, whatsapp: true },
      canal: 'call, sms, email, whatsapp',
    });
    expect(ch).toEqual({ call: true, sms: true, email: true });
    expect('whatsapp' in ch).toBe(false);
  });

  it('detects campaigns scheduled for today across fechas_ejecucion and fecha_programada', () => {
    expect(
      isCampaignStartingToday(
        { fecha_programada: '2026-11-27', fechas_ejecucion: ['2026-11-27', '2026-11-28'] },
        '2026-11-27',
      ),
    ).toBe(true);
    expect(
      isCampaignStartingToday(
        { fecha_programada: '2026-12-01', fechas_ejecucion: ['2026-12-01'] },
        '2026-11-27',
      ),
    ).toBe(false);
  });

  it('blocks automatic campaign launch outside localhost single-patient sandbox', async () => {
    // En entorno node/vitest sin window.location localhost ni VITE_LOCAL_SINGLE_PATIENT_DOC activo,
    // el auto-lanzador DEBE bloquear cualquier disparo automático (protección de producción).
    const res = await campaignDispatchService.runDueCampaignsForToday([
      {
        id: 'camp_prod_should_never_run',
        nombre: 'Campaña Producción',
        estado: 'programada',
        fecha_programada: campaignDispatchService.getColombiaTodayIso(),
        canales_detalle: { call: true, sms: true, email: true },
      },
    ]);
    expect(res).toEqual([]);
  });

  it('formats 3-channel dispatch summaries clearly including missing SMTP config', () => {
    const text = formatDispatchSummary({
      channels: { call: true, sms: true, email: true },
      call: { enviados: 1, fallidos: 0 },
      sms: { enviados: 1, fallidos: 0 },
      email: { enviados: 0, fallidos: 1, missingConfig: true },
    });
    expect(text).toContain('Llamada IA (P. 13): 1 iniciada(s)');
    expect(text).toContain('SMS (P. 13): 1 enviado(s)');
    expect(text).toContain('Correo: falta configurar SMTP/Resend');
  });
});
