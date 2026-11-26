import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  callTraceLoggerService,
  formatTraceForClipboard,
  buildAutoDiagnosis,
} from './callTraceLoggerService';

function createMockWindow(writeTextMock, openReturn = null) {
  return {
    screen: { availWidth: 1920, availHeight: 1080 },
    location: { pathname: '/patients', href: 'https://sadi.app/patients' },
    navigator: {
      userAgent: 'Vitest-Browser/1.0',
      clipboard: { writeText: writeTextMock },
    },
    open: vi.fn(() => openReturn),
    document: { body: null },
  };
}

describe('callTraceLoggerService', () => {
  beforeEach(() => {
    callTraceLoggerService.resetForTests();
  });

  it('opens an independent window, tracks stages, and auto-copies full SIP 503 diagnostic report', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    const fakeDoc = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      getElementById: vi.fn(() => null),
      addEventListener: vi.fn(),
    };
    const fakeExternalWin = {
      closed: false,
      document: fakeDoc,
      focus: vi.fn(),
      addEventListener: vi.fn(),
      navigator: { clipboard: { writeText: writeTextMock } },
    };

    globalThis.window = createMockWindow(writeTextMock, fakeExternalWin);
    Object.defineProperty(globalThis, 'navigator', {
      value: globalThis.window.navigator,
      configurable: true,
    });

    callTraceLoggerService.onCallButtonClicked({
      buttonLabel: 'Llamar',
      title: 'Llamar a Carlos Pérez',
      testId: 'patient-call-btn',
    });

    expect(globalThis.window.open).toHaveBeenCalledWith(
      '',
      'SADI_CALL_TRACE_WINDOW',
      expect.stringContaining('resizable=yes')
    );
    expect(fakeDoc.write).toHaveBeenCalled();

    const traceId = callTraceLoggerService.startTrace({
      patientData: {
        id: 'pat-001',
        nombre: 'Carlos Pérez',
        documento: '1006010518',
        cursoVida: 'C. Adolescencia',
        hospitalId: 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8',
      },
      rawPhone: '3101234567',
      gsmPort: 13,
      callerNumber: '+573106783338',
      phoneNumberId: '3e836f48-6110-410d-a340-fd625598b324',
      quotaSnapshot: {
        dailyCap: 500,
        reservedResolucion: 281,
        reservedCampaigns: 0,
        usedToday: 0,
        remainingToday: 219,
      },
    });

    callTraceLoggerService.updateTrace(traceId, {
      formattedPhone: '+573101234567',
      edgeHttpStatus: 200,
      edgeLatencyMs: 620,
      vapiLatencyMs: 410,
      vapiCallId: 'call-vapi-12345',
      vapiStatus: 'ringing',
      phoneCallProvider: 'byo-sip-trunk',
      phoneCallTransport: 'sip',
      sipCallId: 'sip-abc-999',
      pollCount: 4,
    });

    // Verify undefined patches do not clobber existing diagnostic fields
    callTraceLoggerService.updateTrace(traceId, {
      vapiCreatedAt: undefined,
      sipCallId: undefined,
    });

    callTraceLoggerService.logEvent(traceId, {
      level: 'STEP',
      stage: '5_SIP_RINGING',
      message: 'Timbrando en Issabel -> OpenVox Puerto 13',
      data: { vapiStatus: 'ringing' },
    });

    const finished = await callTraceLoggerService.finishTrace(traceId, {
      outcome: 'failed',
      extraPatch: {
        vapiStatus: 'ended',
        endedReason: 'call.in-progress.error-providerfault-outbound-sip-503-service-unavailable',
        endedMessage: 'SIP 503 Service Unavailable from 69.30.247.178',
      },
    });

    expect(finished.clipboard.ok).toBe(true);
    expect(writeTextMock).toHaveBeenCalled();
    const lastCopied = writeTextMock.mock.calls[writeTextMock.mock.calls.length - 1][0];
    expect(lastCopied).toContain('SADI - REPORTE DIAGNOSTICO DE TRAZABILIDAD DE LLAMADA');
    expect(lastCopied).toContain('Carlos Pérez');
    expect(lastCopied).toContain('+573101234567');
    expect(lastCopied).toContain('call-vapi-12345');
    expect(lastCopied).toContain('sip-abc-999');
    expect(lastCopied).toContain('Puerto 13 (+573106783338)');
    expect(lastCopied).toContain('Disponibles 219/500');
    expect(lastCopied).toContain('SIP 503 Service Unavailable');
    expect(formatTraceForClipboard(finished.trace)).toEqual(lastCopied);
    expect(buildAutoDiagnosis(finished.trace)).toContain('SIP 503');
  });

  it('activates non-blocking fallback dock flag if browser blocks window.open', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    globalThis.window = createMockWindow(writeTextMock, null);
    // Force previous external window reference closed
    callTraceLoggerService.resetForTests();

    const opened = callTraceLoggerService.openIndependentWindow();
    expect(opened).toBe(false);
    expect(callTraceLoggerService.getSnapshot().windowBlocked).toBe(true);
  });
});
