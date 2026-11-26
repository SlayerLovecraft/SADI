// ==============================================================================
// callTraceLoggerService.js - VENTANA INDEPENDIENTE DE TRAZABILIDAD DE LLAMADAS
// + AUTO-COPIADO AL PORTAPAPELES PARA DIAGNÓSTICO DE EXTREMO A EXTREMO
//
// Al presionar CUALQUIER botón de "Llamar":
//   1. Abre una ventana pequeña INDEPENDIENTE (window.open, NO popup/modal que
//      bloquee el aplicativo) mostrando cada evento en vivo con marca de tiempo,
//      etapa alcanzada (UI -> Cupo -> Supabase Edge -> Vapi -> SIP/Issabel ->
//      OpenVox -> Contestación -> Registro BD) y diagnóstico automático.
//   2. Si el navegador bloquea ventanas nuevas, activa un panel flotante
//      no-bloqueante en la esquina inferior derecha con botón para abrir la
//      ventana independiente.
//   3. Copia automáticamente al portapapeles el reporte estructurado completo
//      con toda la evidencia técnica para pegarlo y diagnosticar dónde se quedó
//      o por qué falló la llamada.
// ==============================================================================

const WINDOW_NAME = 'SADI_CALL_TRACE_WINDOW';
const MAX_HISTORY_TRACES = 10;
const MAX_EVENTS_PER_TRACE = 250;

const STAGE_ORDER = {
  '1_UI_CLICK': { rank: 1, label: '1. Clic en UI', short: 'INICIANDO' },
  '2_VALIDATION': { rank: 2, label: '2. Validación & Cupo', short: 'VALIDANDO' },
  '3_EDGE_REQUEST': { rank: 3, label: '3. Envío Supabase Edge', short: 'ENVIANDO A EDGE' },
  '4_VAPI_ACCEPTED': { rank: 4, label: '4. Aceptada por Vapi', short: 'EN COLA VAPI' },
  '5_SIP_RINGING': { rank: 5, label: '5. Trunk SIP / Timbrando', short: 'TIMBRANDO' },
  '6_IN_CALL': { rank: 6, label: '6. Paciente Contestó', short: 'EN LLAMADA' },
  '7_DB_RECORD': { rank: 7, label: '7. Registro BD & Cupo', short: 'REGISTRANDO' },
  '8_COMPLETED': { rank: 8, label: '8. Llamada Exitosa', short: 'COMPLETADA' },
  '9_FAILED': { rank: 9, label: 'Fallo / Sin Contacto', short: 'FALLO' },
};

const traces = []; // más reciente primero
let activeTraceId = null;
let traceWin = null;
let windowBlocked = false;
let pendingClipboardCopy = false;
let lastClipboardStatus = {
  ok: false,
  at: null,
  method: null,
  pending: false,
  error: null,
};
let timerInterval = null;
const subscribers = new Set();

function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function pad3(n) {
  return String(Math.max(0, Math.floor(n))).padStart(3, '0');
}

export function formatColombiaTimestamp(dateInput = new Date()) {
  const dt = dateInput instanceof Date ? dateInput : new Date(dateInput);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(dt);
    const get = (t) => parts.find((p) => p.type === t)?.value || '00';
    const hour = get('hour') === '24' ? '00' : get('hour');
    const ms = pad3(dt.getMilliseconds());
    return {
      full: `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}.${ms} (America/Bogota)`,
      time: `${hour}:${get('minute')}:${get('second')}.${ms}`,
      isoUtc: dt.toISOString(),
    };
  } catch {
    return {
      full: dt.toISOString(),
      time: dt.toISOString().slice(11, 23),
      isoUtc: dt.toISOString(),
    };
  }
}

function makeTraceId() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SADI-TRACE-${stamp}-${rnd}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeJsonCompact(obj, maxLen = 700) {
  if (obj === undefined || obj === null) return '';
  try {
    const raw = typeof obj === 'string' ? obj : JSON.stringify(obj);
    if (raw.length <= maxLen) return raw;
    return `${raw.slice(0, maxLen)}… [truncado ${raw.length} chars]`;
  } catch {
    return String(obj);
  }
}

/**
 * Traduce códigos técnicos de HTTP / Vapi / SIP / OpenVox a un veredicto accionable.
 */
export function buildAutoDiagnosis(trace) {
  if (!trace) return 'Esperando eventos de llamada...';
  const reason = String(trace.endedReason || '').toLowerCase();
  const msg = String(trace.endedMessage || trace.lastError || '').toLowerCase();
  const httpStatus = Number(trace.edgeHttpStatus || 0);
  const outcome = trace.outcome;

  if (outcome === 'success') {
    return `Llamada contestada y finalizada con éxito (${trace.durationSeconds || 0}s). Descontada del cupo diario (500/día).`;
  }

  if (reason === 'no_phone' || msg.includes('sin teléfono') || msg.includes('sin telefono')) {
    return 'BLOQUEADO EN UI (Etapa 2): El paciente no tiene un número telefónico válido registrado en la base de datos.';
  }
  if (httpStatus === 401 || msg.includes('401') || msg.includes('unauthorized')) {
    return 'FALLO EN AUTENTICACIÓN VAPI (HTTP 401): La llave VAPI_PRIVATE_KEY configurada en Supabase Edge Functions fue rechazada por Vapi.';
  }
  if (httpStatus === 400 || msg.includes('400') || msg.includes('bad request')) {
    return `FALLO DE VALIDACIÓN EN VAPI/EDGE (HTTP 400): El payload o formato telefónico fue rechazado. Detalle: ${trace.endedMessage || trace.lastError || 'revisar rawResponse'}.`;
  }
  if (httpStatus === 403 || msg.includes('permiso')) {
    return 'BLOQUEADO POR PERMISOS (HTTP 403): El usuario/profesional no tiene permiso para lanzar llamadas o el secreto/CORS rechazó la petición.';
  }
  if (httpStatus === 429 || msg.includes('rate limit') || msg.includes('quota')) {
    return 'LÍMITE DE TASA / CUPO (HTTP 429): Vapi o SADI rechazó temporalmente la llamada por concurrencia o cuota.';
  }
  if (httpStatus === 503 && !trace.vapiCallId) {
    return 'FALLO AL CONECTAR CON SUPABASE EDGE FUNCTION (HTTP 503): La función vapi-outbound-call no respondió o falló la red del navegador.';
  }
  if (reason.includes('sip-503') || reason.includes('503-service-unavailable') || msg.includes('503')) {
    return 'FALLO EN TRONCAL SIP (Issabel 69.30.247.178 -> OpenVox 190.90.52.5): Vapi recibió SIP 503 Service Unavailable. Causas típicas: Puerto 1 sin señal GSM, SIM sin saldo/bloqueada, prefijo 901 sin regla en OpenVox o canal GSM ocupado.';
  }
  if (reason.includes('sip-403') || reason.includes('sip-401') || reason.includes('403-forbidden')) {
    return 'FALLO DE AUTENTICACIÓN SIP (401/403): Issabel PBX rechazó el INVITE entrante de Vapi (revisar IP/contexto VAPI_TRUNK en sip_additional.conf).';
  }
  if (reason.includes('sip-404') || reason.includes('404-not-found')) {
    return 'FALLO DE RUTEO SIP (404 Not Found): Issabel o el OpenVox no encontró una extensión/regla coincidente para el destino marcado (revisar [desde-vapi] y prefijo 901).';
  }
  if (reason.includes('sip-486') || reason.includes('customer-busy')) {
    return 'LÍNEA OCUPADA (SIP 486 / customer-busy): El paciente rechazó la llamada o su línea estaba ocupada (o el canal GSM devolvió Busy).';
  }
  if (reason.includes('sip-480') || reason.includes('sip-408') || reason.includes('timeout')) {
    return 'SIN RESPUESTA / TIMEOUT SIP (408/480): El tronco SIP o el operador celular no respondió dentro del tiempo límite.';
  }
  if (reason.includes('voicemail') || reason.includes('machine')) {
    return `BUZÓN DE VOZ DETECTADO (${trace.endedReason}): La protección Anti-Buzón cortó la llamada automáticamente para evitar cobro innecesario.`;
  }
  if (reason.includes('did-not-answer') || reason.includes('no-answer')) {
    return 'NO CONTESTÓ (customer-did-not-answer): La llamada salió hacia la red celular pero el paciente no respondió.';
  }
  if (reason.includes('error-providerfault') || reason.includes('provider') || reason.includes('transport')) {
    return `FALLO EN PROVEEDOR TELEFÓNICO / SIP (${trace.endedReason}): Vapi creó la llamada pero falló el puente SIP hacia Issabel/OpenVox. Revisar /var/log/asterisk/full con Call ID ${trace.vapiCallId || 'N/A'}.`;
  }
  if (outcome === 'failed') {
    return `LLAMADA FALLIDA en etapa [${trace.lastStageLabel}]: ${trace.endedReason || trace.lastError || 'sin motivo específico devuelto'}.`;
  }
  if (trace.currentPhase === 'in_call') {
    return 'EN LLAMADA ACTIVA: El paciente contestó y está hablando con el agente IA de Vapi.';
  }
  if (trace.vapiCallId) {
    return `EN PROCESO (${trace.vapiStatus || 'calling'}): Vapi aceptó la llamada (${trace.vapiCallId}) y está marcando vía Issabel PBX -> OpenVox Puerto 1.`;
  }
  return 'EN PROCESO: Despachando solicitud desde SADI hacia Supabase Edge Function (vapi-outbound-call)...';
}

/**
 * Genera el bloque de texto plano estructurado que se copia al portapapeles
 * para pegarlo directamente y obtener diagnóstico inmediato.
 */
export function formatTraceForClipboard(trace) {
  if (!trace) return 'SADI Call Trace: sin registros activos.';

  const elapsedSec = ((trace.finishedAtMs || Date.now()) - trace.startedAtMs) / 1000;
  const diagnosis = buildAutoDiagnosis(trace);
  const q = trace.quotaSnapshot || {};

  const lines = [
    '================================================================================',
    'SADI - REPORTE DIAGNOSTICO DE TRAZABILIDAD DE LLAMADA',
    '================================================================================',
    `Trace ID          : ${trace.id}`,
    `Fecha/Hora (CO)   : ${trace.startedAtCo}`,
    `Timestamp UTC     : ${trace.startedAtUtc}`,
    `Origen UI         : ${trace.uiOrigin || 'Desconocido'} | Ruta: ${trace.uiPathname || '/'} | Boton: "${trace.buttonLabel || 'Llamar'}"`,
    `URL Navegador     : ${trace.pageUrl || 'N/A'}`,
    `Navegador / OS    : ${trace.userAgent || 'N/A'}`,
    '',
    '--- 1. PACIENTE Y DESTINO ---',
    `Paciente          : ${trace.patientName || 'N/A'}`,
    `Patient ID        : ${trace.patientId || 'N/A'}`,
    `Documento         : ${trace.patientDoc || 'N/A'}`,
    `Curso de Vida     : ${trace.cursoVida || 'N/A'}`,
    `Motivo / Programa : ${trace.motivoLlamada || 'N/A'}`,
    `Telefono Original : ${trace.rawPhone || 'N/A'}`,
    `Telefono E.164    : ${trace.formattedPhone || 'Pendiente / Invalido'}`,
    `Hospital ID       : ${trace.hospitalId || 'N/A'}`,
    '',
    '--- 2. RUTA DE SALIDA (VAPI -> ISSABEL -> OPENVOX) ---',
    `Puerto GSM        : Puerto ${trace.gsmPort ?? 1} (${trace.callerNumber || '+573106783338'})`,
    `Vapi Phone ID     : ${trace.phoneNumberId || '3e836f48-6110-410d-a340-fd625598b324'}`,
    `Vapi Assistant ID : ${trace.assistantId || 'Edge Secret VAPI_ASSISTANT_ID'}`,
    `Route Mode        : ${trace.routeMode || 'vapi_issabel_port1'}`,
    `Edge Mode Resp.   : ${trace.dispatchMode || 'N/A'}`,
    `Anti-Buzon        : ${safeJsonCompact(trace.antiVoicemailSummary || {}, 240)}`,
    '',
    '--- 3. RESUMEN TECNICO Y DIAGNOSTICO ---',
    `Resultado Final   : ${String(trace.outcome || 'in_progress').toUpperCase()}`,
    `Ultima Etapa      : ${trace.lastStage} (${trace.lastStageLabel})`,
    `Vapi Call ID      : ${trace.vapiCallId || 'NO GENERADO'}`,
    `Provider / Transp : ${trace.phoneCallProvider || 'N/A'} / ${trace.phoneCallTransport || 'N/A'}`,
    `Provider/SIP ID   : ${trace.sipCallId || trace.phoneCallProviderId || 'N/A'}`,
    `HTTP Edge Status  : ${trace.edgeHttpStatus ?? 'N/A'} (Total Edge: ${trace.edgeLatencyMs ?? 'N/A'} ms | Vapi API: ${trace.vapiLatencyMs ?? 'N/A'} ms)`,
    `Vapi Status Final : ${trace.vapiStatus || 'N/A'}`,
    `endedReason       : ${trace.endedReason || 'N/A'}`,
    `endedMessage      : ${trace.endedMessage || trace.lastError || 'N/A'}`,
    `Tiempos Vapi      : created=${trace.vapiCreatedAt || '-'} | started=${trace.vapiStartedAt || '-'} | ended=${trace.vapiEndedAt || '-'}`,
    `Duracion Llamada  : ${trace.durationSeconds ?? 0}s | Tiempo Total Proceso: ${elapsedSec.toFixed(2)}s | Polls: ${trace.pollCount || 0}`,
    `Registro BD       : ${trace.dbRecordStatus || 'Pendiente'}`,
    `Cupo Diario (500) : Disponibles ${q.remainingToday ?? '?'}/${q.dailyCap ?? 500} (Res.3280: ${q.reservedResolucion ?? '?'} | Camp: ${q.reservedCampaigns ?? '?'} | Realizadas: ${q.usedToday ?? '?'})`,
    `Diagnostico Auto  : ${diagnosis}`,
  ];

  if (trace.transcriptPreview) {
    lines.push(`Transcripcion     : ${trace.transcriptPreview}`);
  }
  if (trace.rawErrorPayload) {
    lines.push('', '--- 3B. DETALLE CRUDO DE ERROR / RESPUESTA ---', safeJsonCompact(trace.rawErrorPayload, 1200));
  }

  lines.push('', `--- 4. CRONOLOGIA COMPLETA DE EVENTOS (${trace.events.length} registros) ---`);
  for (const ev of trace.events) {
    const dtStr = `+${(ev.elapsedMs / 1000).toFixed(2)}s`;
    const lvl = String(ev.level || 'INFO').toUpperCase().padEnd(5, ' ');
    const stg = String(ev.stage || 'TRACE');
    const detailPart = ev.data ? ` | ${safeJsonCompact(ev.data, 420)}` : '';
    lines.push(`[${ev.timeCo} | ${dtStr.padStart(7, ' ')}] [${lvl}] [${stg}] ${ev.message}${detailPart}`);
  }

  lines.push(
    '================================================================================',
    '(Fin del reporte SADI - Pega este bloque para diagnostico tecnico completo)'
  );
  return lines.join('\n');
}

function getTraceById(id) {
  if (!id) return traces[0] || null;
  return traces.find((t) => t.id === id) || traces[0] || null;
}

function notifySubscribers() {
  const snap = {
    traces: traces.slice(),
    activeTraceId,
    activeTrace: getTraceById(activeTraceId),
    windowOpen: isExternalWindowOpen(),
    windowBlocked,
    clipboard: { ...lastClipboardStatus },
  };
  subscribers.forEach((cb) => {
    try {
      cb(snap);
    } catch { }
  });
}

function isExternalWindowOpen() {
  try {
    return Boolean(traceWin && !traceWin.closed && traceWin.document);
  } catch {
    return false;
  }
}

function tryExecCommandCopy(targetDoc, text) {
  if (!targetDoc || !targetDoc.body) return false;
  try {
    const ta = targetDoc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    ta.style.opacity = '0';
    targetDoc.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = Boolean(targetDoc.execCommand && targetDoc.execCommand('copy'));
    targetDoc.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function copyTextRobust(text, preferExternal = false) {
  const nowStr = formatColombiaTimestamp().time;
  const targets = preferExternal
    ? [
        { name: 'logWindow', win: isExternalWindowOpen() ? traceWin : null },
        { name: 'mainWindow', win: typeof window !== 'undefined' ? window : null },
      ]
    : [
        { name: 'mainWindow', win: typeof window !== 'undefined' ? window : null },
        { name: 'logWindow', win: isExternalWindowOpen() ? traceWin : null },
      ];

  let lastErr = null;
  for (const t of targets) {
    if (!t.win) continue;
    try {
      if (t.win.navigator?.clipboard?.writeText) {
        await t.win.navigator.clipboard.writeText(text);
        pendingClipboardCopy = false;
        lastClipboardStatus = { ok: true, at: nowStr, method: `${t.name}:clipboardAPI`, pending: false, error: null };
        renderExternalWindow();
        notifySubscribers();
        return lastClipboardStatus;
      }
    } catch (err) {
      lastErr = err?.message || String(err);
    }
    try {
      if (tryExecCommandCopy(t.win.document, text)) {
        pendingClipboardCopy = false;
        lastClipboardStatus = { ok: true, at: nowStr, method: `${t.name}:execCommand`, pending: false, error: null };
        renderExternalWindow();
        notifySubscribers();
        return lastClipboardStatus;
      }
    } catch (err) {
      lastErr = err?.message || String(err);
    }
  }

  pendingClipboardCopy = true;
  lastClipboardStatus = {
    ok: false,
    at: nowStr,
    method: null,
    pending: true,
    error: lastErr || 'El navegador requiere foco para copiar automáticamente (haz clic en la ventana de log).',
  };
  renderExternalWindow();
  notifySubscribers();
  return lastClipboardStatus;
}

function buildExternalWindowShellHtml() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SADI · Log de Trazabilidad de Llamadas</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070d1a;
      --panel: #0f172a;
      --panel2: #111c34;
      --border: #1e293b;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --blue: #38bdf8;
      --green: #34d399;
      --amber: #fbbf24;
      --red: #fb7185;
      --indigo: #818cf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-size: 12px;
    }
    .topbar {
      background: linear-gradient(90deg, #0b132b 0%, #111f3f 100%);
      border-bottom: 1px solid var(--border);
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.2px;
    }
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--amber);
      box-shadow: 0 0 8px var(--amber);
      flex-shrink: 0;
    }
    .dot.success { background: var(--green); box-shadow: 0 0 8px var(--green); }
    .dot.failed { background: var(--red); box-shadow: 0 0 8px var(--red); }
    .dot.in_call { background: var(--green); animation: pulse 1.1s infinite; }
    .dot.calling { background: var(--amber); animation: pulse 1.1s infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(1.25); }
    }
    .pills { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .pill {
      padding: 3px 8px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 11px;
      border: 1px solid var(--border);
      background: #172544;
      color: #cbd5e1;
    }
    .pill.stage-calling { background: rgba(245,158,11,0.18); border-color: rgba(245,158,11,0.5); color: #fde68a; }
    .pill.stage-in_call { background: rgba(16,185,129,0.2); border-color: rgba(16,185,129,0.55); color: #a7f3d0; }
    .pill.stage-success { background: rgba(16,185,129,0.2); border-color: rgba(16,185,129,0.55); color: #6ee7b7; }
    .pill.stage-failed { background: rgba(244,63,94,0.2); border-color: rgba(244,63,94,0.55); color: #fecdd3; }
    .pill.clip-ok { background: rgba(16,185,129,0.16); border-color: rgba(52,211,153,0.45); color: #6ee7b7; cursor: pointer; }
    .pill.clip-pending { background: rgba(251,191,36,0.18); border-color: rgba(251,191,36,0.55); color: #fde68a; cursor: pointer; }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 8px 12px;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
    }
    .btn-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    button {
      border: 1px solid #334155;
      background: #1e293b;
      color: #f8fafc;
      font-weight: 700;
      font-size: 11px;
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    button:hover { background: #334155; }
    button.primary {
      background: #2563eb;
      border-color: #3b82f6;
      color: #fff;
    }
    button.primary:hover { background: #1d4ed8; }
    button.copied {
      background: #059669 !important;
      border-color: #10b981 !important;
    }
    .history-bar {
      display: flex;
      gap: 5px;
      overflow-x: auto;
      padding: 6px 12px;
      background: #0b1222;
      border-bottom: 1px solid var(--border);
    }
    .hist-tab {
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 5px;
      background: #131f38;
      border: 1px solid #1e293b;
      color: #94a3b8;
      white-space: nowrap;
      cursor: pointer;
    }
    .hist-tab.active {
      background: #1e3a8a;
      border-color: #3b82f6;
      color: #fff;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      padding: 8px 12px;
      background: var(--panel2);
      border-bottom: 1px solid var(--border);
    }
    .meta-card {
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 6px 8px;
      min-width: 0;
    }
    .meta-label {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--muted);
      font-weight: 700;
      margin-bottom: 2px;
    }
    .meta-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      color: #f1f5f9;
      word-break: break-all;
    }
    .diag-banner {
      padding: 8px 12px;
      background: rgba(30, 58, 138, 0.25);
      border-bottom: 1px solid rgba(59, 130, 246, 0.35);
      font-size: 11.5px;
      line-height: 1.4;
      color: #dbeafe;
    }
    .diag-banner.failed {
      background: rgba(159, 18, 57, 0.26);
      border-bottom-color: rgba(244, 63, 94, 0.45);
      color: #ffe4e6;
    }
    .diag-banner.success {
      background: rgba(6, 95, 70, 0.26);
      border-bottom-color: rgba(16, 185, 129, 0.45);
      color: #d1fae5;
    }
    .log-stream {
      flex: 1;
      overflow-y: auto;
      padding: 10px 12px;
      background: #050a14;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      line-height: 1.5;
    }
    .log-row {
      padding: 4px 6px;
      border-left: 3px solid #334155;
      margin-bottom: 5px;
      background: rgba(15, 23, 42, 0.55);
      border-radius: 0 4px 4px 0;
      word-break: break-word;
    }
    .log-row.lvl-STEP { border-left-color: #38bdf8; }
    .log-row.lvl-OK { border-left-color: #34d399; background: rgba(6, 78, 59, 0.2); }
    .log-row.lvl-WARN { border-left-color: #fbbf24; background: rgba(120, 53, 15, 0.22); }
    .log-row.lvl-ERROR { border-left-color: #fb7185; background: rgba(136, 19, 55, 0.26); }
    .log-row.lvl-POLL { border-left-color: #818cf8; }
    .log-head {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: baseline;
    }
    .t-time { color: #64748b; }
    .t-elapsed { color: #94a3b8; font-weight: 700; }
    .t-lvl { font-weight: 800; padding: 0 4px; border-radius: 3px; font-size: 10px; }
    .t-lvl.INFO { color: #bae6fd; background: rgba(56,189,248,0.16); }
    .t-lvl.STEP { color: #7dd3fc; background: rgba(14,165,233,0.2); }
    .t-lvl.OK { color: #6ee7b7; background: rgba(16,185,129,0.2); }
    .t-lvl.WARN { color: #fde68a; background: rgba(245,158,11,0.2); }
    .t-lvl.ERROR { color: #fecdd3; background: rgba(244,63,94,0.25); }
    .t-lvl.POLL { color: #c7d2fe; background: rgba(99,102,241,0.22); }
    .t-stage { color: #a5b4fc; font-weight: 700; }
    .t-msg { color: #f8fafc; }
    .t-data {
      margin-top: 3px;
      padding: 4px 6px;
      background: rgba(2, 6, 23, 0.72);
      border-radius: 4px;
      color: #cbd5e1;
      font-size: 10.5px;
      white-space: pre-wrap;
    }
    .footer-tip {
      padding: 6px 12px;
      background: #0b1222;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 10.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">
      <span id="status-dot" class="dot calling"></span>
      <span>SADI · Monitor de Trazabilidad de Llamada</span>
    </div>
    <div class="pills">
      <span id="stage-pill" class="pill stage-calling">INICIANDO</span>
      <span id="timer-pill" class="pill">00:00.0</span>
      <span id="clip-pill" class="pill clip-pending" title="Haz clic para copiar el reporte completo al portapapeles">Copiando...</span>
    </div>
  </div>
  <div class="toolbar">
    <div class="btn-group">
      <button id="btn-copy" class="primary">Copiar Log Completo</button>
      <button id="btn-download">Descargar .txt</button>
      <button id="btn-clear">Limpiar</button>
    </div>
    <label style="display:flex;align-items:center;gap:5px;color:#94a3b8;font-size:11px;cursor:pointer;">
      <input id="chk-autoscroll" type="checkbox" checked />
      Auto-scroll
    </label>
  </div>
  <div id="history-bar" class="history-bar" style="display:none;"></div>
  <div id="meta-grid" class="meta-grid"></div>
  <div id="diag-banner" class="diag-banner">Esperando inicio de llamada...</div>
  <div id="log-stream" class="log-stream"></div>
  <div class="footer-tip">
    <span>Ventana independiente SADI · Puerto 1 (+573106783338)</span>
    <span id="event-count">0 eventos</span>
  </div>
</body>
</html>`;
}

function attachExternalWindowHandlers(win) {
  if (!win || !win.document) return;
  const doc = win.document;

  const btnCopy = doc.getElementById('btn-copy');
  if (btnCopy) {
    btnCopy.onclick = async () => {
      const tr = getTraceById(activeTraceId);
      const text = formatTraceForClipboard(tr);
      const res = await copyTextRobust(text, true);
      if (res.ok && btnCopy) {
        btnCopy.textContent = '✓ Copiado al Portapapeles';
        btnCopy.classList.add('copied');
        setTimeout(() => {
          try {
            if (!win.closed && btnCopy) {
              btnCopy.textContent = 'Copiar Log Completo';
              btnCopy.classList.remove('copied');
            }
          } catch { }
        }, 2000);
      }
    };
  }

  const clipPill = doc.getElementById('clip-pill');
  if (clipPill) {
    clipPill.onclick = () => btnCopy && btnCopy.click();
  }

  const btnDownload = doc.getElementById('btn-download');
  if (btnDownload) {
    btnDownload.onclick = () => {
      const tr = getTraceById(activeTraceId);
      if (!tr) return;
      const text = formatTraceForClipboard(tr);
      try {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = win.URL.createObjectURL(blob);
        const a = doc.createElement('a');
        a.href = url;
        a.download = `${tr.id}.txt`;
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        setTimeout(() => win.URL.revokeObjectURL(url), 1000);
      } catch { }
    };
  }

  const btnClear = doc.getElementById('btn-clear');
  if (btnClear) {
    btnClear.onclick = () => {
      const tr = getTraceById(activeTraceId);
      if (tr) {
        tr.events = [];
        renderExternalWindow();
        notifySubscribers();
      }
    };
  }

  // Si hubo un auto-copiado pendiente por foco, copiarlo apenas el usuario enfoque o toque esta ventana
  const flushPendingCopy = () => {
    if (!pendingClipboardCopy) return;
    const tr = getTraceById(activeTraceId);
    if (!tr) return;
    copyTextRobust(formatTraceForClipboard(tr), true);
  };
  win.addEventListener('focus', flushPendingCopy);
  doc.addEventListener('click', flushPendingCopy);
}

function updateLiveTimer() {
  if (!isExternalWindowOpen()) return;
  const tr = getTraceById(activeTraceId);
  if (!tr) return;
  try {
    const timerEl = traceWin.document.getElementById('timer-pill');
    if (!timerEl) return;
    const ms = Math.max(0, (tr.finishedAtMs || Date.now()) - tr.startedAtMs);
    const totalSec = ms / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec - mins * 60;
    timerEl.textContent = `${pad2(mins)}:${secs < 10 ? '0' : ''}${secs.toFixed(1)}`;
  } catch { }
}

function ensureTimerRunning() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    const active = getTraceById(activeTraceId);
    if (!active || active.finishedAtMs || !isExternalWindowOpen()) {
      updateLiveTimer();
      if (!active || active.finishedAtMs) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      return;
    }
    updateLiveTimer();
  }, 200);
}

function renderExternalWindow() {
  if (!isExternalWindowOpen()) return;
  const tr = getTraceById(activeTraceId);
  if (!tr) return;

  try {
    const doc = traceWin.document;
    const dot = doc.getElementById('status-dot');
    const stagePill = doc.getElementById('stage-pill');
    const clipPill = doc.getElementById('clip-pill');
    const historyBar = doc.getElementById('history-bar');
    const metaGrid = doc.getElementById('meta-grid');
    const diagBanner = doc.getElementById('diag-banner');
    const logStream = doc.getElementById('log-stream');
    const eventCount = doc.getElementById('event-count');
    const chkAuto = doc.getElementById('chk-autoscroll');

    if (!logStream || !metaGrid) return;

    const statusTone =
      tr.outcome === 'success'
        ? 'success'
        : tr.outcome === 'failed'
        ? 'failed'
        : tr.currentPhase === 'in_call'
        ? 'in_call'
        : 'calling';

    if (dot) dot.className = `dot ${statusTone}`;
    if (stagePill) {
      stagePill.className = `pill stage-${statusTone}`;
      stagePill.textContent = STAGE_ORDER[tr.lastStage]?.short || tr.lastStage || 'EN CURSO';
    }
    if (clipPill) {
      if (lastClipboardStatus.ok) {
        clipPill.className = 'pill clip-ok';
        clipPill.textContent = `✓ Copiado (${lastClipboardStatus.at})`;
      } else if (lastClipboardStatus.pending) {
        clipPill.className = 'pill clip-pending';
        clipPill.textContent = '📋 Clic aquí para copiar';
      } else {
        clipPill.className = 'pill clip-pending';
        clipPill.textContent = 'Preparando copia...';
      }
    }

    if (historyBar) {
      if (traces.length > 1) {
        historyBar.style.display = 'flex';
        historyBar.innerHTML = traces
          .map((item) => {
            const isActive = item.id === tr.id;
            const icon = item.outcome === 'success' ? '✓' : item.outcome === 'failed' ? '✗' : '●';
            const shortName = String(item.patientName || 'Paciente').split(' ')[0];
            return `<button class="hist-tab ${isActive ? 'active' : ''}" data-trace-id="${escapeHtml(item.id)}">${icon} ${escapeHtml(shortName)} (${escapeHtml(item.startedAtTime?.slice(0, 8) || '')})</button>`;
          })
          .join('');
        historyBar.querySelectorAll('[data-trace-id]').forEach((btn) => {
          btn.onclick = () => {
            activeTraceId = btn.getAttribute('data-trace-id');
            renderExternalWindow();
            notifySubscribers();
          };
        });
      } else {
        historyBar.style.display = 'none';
      }
    }

    const q = tr.quotaSnapshot || {};
    metaGrid.innerHTML = `
      <div class="meta-card">
        <div class="meta-label">Paciente &amp; Documento</div>
        <div class="meta-val">${escapeHtml(tr.patientName || 'Paciente')} · ${escapeHtml(tr.patientDoc || 'Sin doc')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Teléfono (BD → E.164)</div>
        <div class="meta-val">${escapeHtml(tr.rawPhone || 'N/A')} → ${escapeHtml(tr.formattedPhone || 'Pendiente')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Vapi Call ID</div>
        <div class="meta-val">${escapeHtml(tr.vapiCallId || 'Aún no generado')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">HTTP / Vapi / endedReason</div>
        <div class="meta-val">HTTP ${escapeHtml(tr.edgeHttpStatus ?? '-')} · ${escapeHtml(tr.vapiStatus || '-')} · ${escapeHtml(tr.endedReason || '-')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Origen UI &amp; Trace ID</div>
        <div class="meta-val">${escapeHtml(tr.uiOrigin || 'SADI')} · ${escapeHtml(tr.id)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Ruta &amp; Cupo Hoy (500/día)</div>
        <div class="meta-val">P.${escapeHtml(tr.gsmPort ?? 1)} (${escapeHtml(tr.callerNumber || '+573106783338')}) · Disp: ${escapeHtml(q.remainingToday ?? '?')}/${escapeHtml(q.dailyCap ?? 500)}</div>
      </div>
    `;

    const diag = buildAutoDiagnosis(tr);
    if (diagBanner) {
      diagBanner.className = `diag-banner ${tr.outcome === 'failed' ? 'failed' : tr.outcome === 'success' ? 'success' : ''}`;
      diagBanner.innerHTML = `<strong>Diagnóstico:</strong> ${escapeHtml(diag)}`;
    }

    logStream.innerHTML = tr.events
      .map((ev) => {
        const dtStr = `+${(ev.elapsedMs / 1000).toFixed(2)}s`;
        const lvl = escapeHtml(ev.level || 'INFO');
        const dataHtml = ev.data
          ? `<div class="t-data">${escapeHtml(safeJsonCompact(ev.data, 600))}</div>`
          : '';
        return `
          <div class="log-row lvl-${lvl}">
            <div class="log-head">
              <span class="t-time">[${escapeHtml(ev.timeCo)}]</span>
              <span class="t-elapsed">${dtStr}</span>
              <span class="t-lvl ${lvl}">${lvl}</span>
              <span class="t-stage">${escapeHtml(ev.stage)}</span>
              <span class="t-msg">${escapeHtml(ev.message)}</span>
            </div>
            ${dataHtml}
          </div>
        `;
      })
      .join('');

    if (eventCount) {
      eventCount.textContent = `${tr.events.length} eventos · Polls: ${tr.pollCount || 0}`;
    }

    if (!chkAuto || chkAuto.checked) {
      logStream.scrollTop = logStream.scrollHeight;
    }
    updateLiveTimer();
  } catch { }
}

export const callTraceLoggerService = {
  /**
   * Abre (o enfoca) la ventana pequeña INDEPENDIENTE de log.
   * DEBE llamarse síncronamente dentro del onClick del botón "Llamar"
   * para garantizar que el navegador nunca la bloquee como popup no solicitado.
   */
  openIndependentWindow() {
    if (typeof window === 'undefined') return false;

    if (isExternalWindowOpen()) {
      windowBlocked = false;
      try {
        traceWin.focus();
      } catch { }
      renderExternalWindow();
      notifySubscribers();
      return true;
    }

    try {
      const width = 660;
      const height = 740;
      const availW = window.screen?.availWidth || 1280;
      const availH = window.screen?.availHeight || 800;
      const left = Math.max(24, availW - width - 28);
      const top = Math.max(24, Math.round((availH - height) / 2));
      const features = [
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        'resizable=yes',
        'scrollbars=yes',
        'menubar=no',
        'toolbar=no',
        'location=no',
        'status=no',
      ].join(',');

      const win = window.open('', WINDOW_NAME, features);
      if (!win) {
        windowBlocked = true;
        notifySubscribers();
        return false;
      }

      traceWin = win;
      windowBlocked = false;

      // Inicializar el documento de la ventana independiente solo si está vacío
      const alreadyInitialized = Boolean(win.document && win.document.getElementById('log-stream'));
      if (!alreadyInitialized) {
        win.document.open();
        win.document.write(buildExternalWindowShellHtml());
        win.document.close();
      }
      attachExternalWindowHandlers(win);
      try {
        win.focus();
      } catch { }
      renderExternalWindow();
      notifySubscribers();
      return true;
    } catch {
      windowBlocked = true;
      notifySubscribers();
      return false;
    }
  },

  /**
   * Guarda un hint sincrónico desde LiveCallButton (nombre de botón, ruta actual)
   * y abre la ventana independiente de inmediato durante el gesto del clic.
   */
  onCallButtonClicked({ buttonLabel = 'Llamar', title = '', testId = '' } = {}) {
    this._lastClickHint = {
      buttonLabel,
      title,
      testId,
      clickedAtMs: Date.now(),
      pathname: typeof window !== 'undefined' ? window.location?.pathname || '/' : '/',
      pageUrl: typeof window !== 'undefined' ? window.location?.href || '' : '',
    };
    this.openIndependentWindow();
  },

  /**
   * Crea una nueva sesión de trazabilidad al dispararse executeLiveCall.
   */
  startTrace({
    patientData = {},
    rawPhone = '',
    gsmPort = 1,
    callerNumber = '+573106783338',
    phoneNumberId = '3e836f48-6110-410d-a340-fd625598b324',
    routeMode = 'vapi_issabel_port1',
    antiVoicemailConfig = null,
    quotaSnapshot = null,
    uiOrigin = '',
  } = {}) {
    // Asegurar que la ventana independiente esté abierta si aún no lo estaba
    if (!isExternalWindowOpen()) {
      this.openIndependentWindow();
    }

    const now = new Date();
    const ts = formatColombiaTimestamp(now);
    const clickHint =
      this._lastClickHint && Date.now() - this._lastClickHint.clickedAtMs < 4000
        ? this._lastClickHint
        : null;

    const pathname =
      clickHint?.pathname || (typeof window !== 'undefined' ? window.location?.pathname || '/' : '/');
    const resolvedOrigin =
      uiOrigin ||
      patientData.uiOrigin ||
      patientData.sourceView ||
      (pathname.includes('patients')
        ? 'Pacientes'
        : pathname.includes('demanda') || pathname.includes('rias')
        ? 'Demanda Res. 3280'
        : pathname.includes('ivr') || pathname.includes('cronograma')
        ? 'Cronograma Res. 3280'
        : pathname.includes('campaign')
        ? 'Campañas'
        : pathname || 'SADI');

    const trace = {
      id: makeTraceId(),
      startedAtMs: now.getTime(),
      finishedAtMs: null,
      startedAtCo: ts.full,
      startedAtTime: ts.time,
      startedAtUtc: ts.isoUtc,
      uiOrigin: resolvedOrigin,
      uiPathname: pathname,
      buttonLabel: clickHint?.buttonLabel || 'Llamar',
      pageUrl: clickHint?.pageUrl || (typeof window !== 'undefined' ? window.location?.href || '' : ''),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      patientId: patientData.patientId || patientData.id || null,
      patientName: patientData.nombre || patientData.name || 'Paciente',
      patientDoc: patientData.documento || patientData.document || patientData.cedula || 'N/A',
      cursoVida: patientData.cursoVida || patientData.curso_vida || 'N/A',
      motivoLlamada: patientData.motivoLlamada || patientData.programa3280 || 'Demanda Inducida Res. 3280',
      hospitalId: patientData.hospitalId || patientData.hospital_id || null,
      rawPhone: String(rawPhone || ''),
      formattedPhone: null,
      gsmPort,
      callerNumber,
      phoneNumberId,
      assistantId: null,
      routeMode,
      dispatchMode: null,
      antiVoicemailSummary: antiVoicemailConfig
        ? {
            antiVoicemail: antiVoicemailConfig.antiVoicemail !== false,
            voicemailProvider: antiVoicemailConfig.voicemailProvider || 'vapi',
            earlyMediaPreAnswer: Boolean(antiVoicemailConfig.earlyMediaPreAnswer),
          }
        : null,
      quotaSnapshot: quotaSnapshot ? { ...quotaSnapshot } : null,
      vapiCallId: null,
      vapiStatus: null,
      vapiCreatedAt: null,
      vapiStartedAt: null,
      vapiEndedAt: null,
      phoneCallProvider: null,
      phoneCallProviderId: null,
      phoneCallTransport: null,
      sipCallId: null,
      edgeHttpStatus: null,
      edgeLatencyMs: null,
      vapiLatencyMs: null,
      endedReason: null,
      endedMessage: null,
      lastError: null,
      rawErrorPayload: null,
      transcriptPreview: null,
      durationSeconds: 0,
      pollCount: 0,
      dbRecordStatus: 'Pendiente',
      currentPhase: 'calling',
      outcome: 'in_progress',
      lastStage: '1_UI_CLICK',
      lastStageLabel: STAGE_ORDER['1_UI_CLICK'].label,
      events: [],
    };

    traces.unshift(trace);
    if (traces.length > MAX_HISTORY_TRACES) {
      traces.length = MAX_HISTORY_TRACES;
    }
    activeTraceId = trace.id;

    this.logEvent(trace.id, {
      level: 'INFO',
      stage: '1_UI_CLICK',
      message: `Inicio de llamada individual para ${trace.patientName} (tel BD: "${trace.rawPhone || 'vacío'}")`,
      data: {
        origen: trace.uiOrigin,
        ruta: trace.uiPathname,
        puerto: `Puerto ${trace.gsmPort} (${trace.callerNumber})`,
        vapiPhoneId: trace.phoneNumberId,
      },
    });

    ensureTimerRunning();
    // Primera copia inmediata dentro del flujo de clic (garantiza disponibilidad en portapapeles)
    this.copyTraceToClipboard(trace.id);
    return trace.id;
  },

  updateTrace(traceId, patch = {}) {
    const tr = getTraceById(traceId);
    if (!tr) return null;
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) {
        tr[k] = v;
      }
    }
    if (patch.lastStage && STAGE_ORDER[patch.lastStage]) {
      tr.lastStageLabel = STAGE_ORDER[patch.lastStage].label;
    }
    renderExternalWindow();
    notifySubscribers();
    return tr;
  },

  logEvent(traceId, { level = 'INFO', stage = 'TRACE', message = '', data = null } = {}) {
    const tr = getTraceById(traceId);
    if (!tr) return;
    const now = new Date();
    const ts = formatColombiaTimestamp(now);
    const elapsedMs = Math.max(0, now.getTime() - tr.startedAtMs);

    tr.events.push({
      timeCo: ts.time,
      isoUtc: ts.isoUtc,
      elapsedMs,
      level,
      stage,
      message,
      data,
    });
    if (tr.events.length > MAX_EVENTS_PER_TRACE) {
      tr.events.shift();
    }

    if (STAGE_ORDER[stage]) {
      tr.lastStage = stage;
      tr.lastStageLabel = STAGE_ORDER[stage].label;
    }

    renderExternalWindow();
    notifySubscribers();
  },

  async finishTrace(traceId, { outcome = 'failed', summaryMessage = '', extraPatch = {} } = {}) {
    const tr = getTraceById(traceId);
    if (!tr) return null;

    Object.assign(tr, extraPatch, {
      outcome,
      finishedAtMs: Date.now(),
      currentPhase: outcome === 'success' ? 'ended' : 'failed',
      lastStage: outcome === 'success' ? '8_COMPLETED' : '9_FAILED',
      lastStageLabel: STAGE_ORDER[outcome === 'success' ? '8_COMPLETED' : '9_FAILED'].label,
    });

    this.logEvent(tr.id, {
      level: outcome === 'success' ? 'OK' : 'ERROR',
      stage: tr.lastStage,
      message: summaryMessage || buildAutoDiagnosis(tr),
      data: {
        outcome,
        vapiCallId: tr.vapiCallId,
        vapiStatus: tr.vapiStatus,
        endedReason: tr.endedReason,
        endedMessage: tr.endedMessage || tr.lastError,
        durationSeconds: tr.durationSeconds,
      },
    });

    const clipRes = await this.copyTraceToClipboard(tr.id);
    renderExternalWindow();
    notifySubscribers();
    return { trace: tr, clipboard: clipRes };
  },

  async copyTraceToClipboard(traceId = null) {
    const tr = getTraceById(traceId || activeTraceId);
    if (!tr) return { ok: false, error: 'Sin registro activo' };
    const formatted = formatTraceForClipboard(tr);
    return copyTextRobust(formatted, false);
  },

  getSnapshot() {
    return {
      traces: traces.slice(),
      activeTraceId,
      activeTrace: getTraceById(activeTraceId),
      windowOpen: isExternalWindowOpen(),
      windowBlocked,
      clipboard: { ...lastClipboardStatus },
    };
  },

  subscribe(listener) {
    subscribers.add(listener);
    listener(this.getSnapshot());
    return () => subscribers.delete(listener);
  },

  dismissFallbackDock() {
    windowBlocked = false;
    notifySubscribers();
  },

  selectTrace(id) {
    activeTraceId = id;
    renderExternalWindow();
    notifySubscribers();
  },

  resetForTests() {
    traces.length = 0;
    activeTraceId = null;
    traceWin = null;
    windowBlocked = false;
    pendingClipboardCopy = false;
    lastClipboardStatus = { ok: false, at: null, method: null, pending: false, error: null };
  },
};
