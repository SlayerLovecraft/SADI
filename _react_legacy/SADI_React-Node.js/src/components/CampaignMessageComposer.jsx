import React from 'react';
import { Send, Mail, MessageSquare, Sparkles } from 'lucide-react';

const VARIABLE_CHIPS = [
  { token: '{nombre}', label: 'Primer nombre' },
  { token: '{paciente}', label: 'Nombre completo' },
  { token: '{campana}', label: 'Nombre campaña' },
  { token: '{sede}', label: 'Sede IPS' },
  { token: '{fecha}', label: 'Fecha' },
];

export default function CampaignMessageComposer({
  channels = { sms: true, email: true, call: true },
  onToggleChannel = null,
  smsMessage = '',
  onSmsMessageChange = () => {},
  emailSubject = '',
  onEmailSubjectChange = () => {},
  emailBody = '',
  onEmailBodyChange = () => {},
  compact = false,
}) {
  const smsLen = (smsMessage || '').length;
  const smsSegments = smsLen === 0 ? 0 : smsLen <= 160 ? 1 : Math.ceil(smsLen / 153);

  const appendToken = (current, setter, token) => {
    const base = String(current || '');
    const sep = base && !base.endsWith(' ') && !base.endsWith('\n') ? ' ' : '';
    setter(`${base}${sep}${token}`);
  };

  return (
    <div
      data-testid="campaign-message-composer"
      className={`space-y-4 ${compact ? 'text-xs' : ''}`}
    >
      {/* Selector opcional de canales SMS / Correo cuando se usa fuera del Paso 3 */}
      {typeof onToggleChannel === 'function' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleChannel('sms')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
              channels.sms
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/40'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            SMS (OpenVox Puerto 13): {channels.sms ? 'ACTIVO' : 'INACTIVO'}
          </button>
          <button
            type="button"
            onClick={() => onToggleChannel('email')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
              channels.email
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-800 dark:text-blue-200 ring-1 ring-blue-500/40'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Correo E-mail: {channels.email ? 'ACTIVO' : 'INACTIVO'}
          </button>
        </div>
      )}

      {/* REDACTOR SMS */}
      {channels.sms && (
        <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Contenido del Mensaje SMS (OpenVox Puerto 13)
            </label>
            <span
              className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                smsLen > 306
                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                  : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {smsLen} caracteres · {smsSegments || 1} SMS
            </span>
          </div>

          <textarea
            rows={compact ? 3 : 3}
            data-testid="campaign-sms-textarea"
            value={smsMessage}
            onChange={(e) => onSmsMessageChange(e.target.value)}
            placeholder="Escribe el texto exacto del SMS que recibirán los pacientes al arrancar la campaña..."
            className="w-full text-xs p-3 rounded-xl border border-emerald-300/80 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-semibold text-emerald-800 dark:text-emerald-300 inline-flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3" /> Insertar variable:
            </span>
            {VARIABLE_CHIPS.map((v) => (
              <button
                key={`sms-${v.token}`}
                type="button"
                onClick={() => appendToken(smsMessage, onSmsMessageChange, v.token)}
                title={v.label}
                className="px-2 py-0.5 text-[10.5px] font-mono font-bold rounded-lg bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700 transition-colors"
              >
                + {v.token}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* REDACTOR CORREO E-MAIL */}
      {channels.email && (
        <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-extrabold text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Contenido del Correo Electrónico (E-mail)
            </label>
            <span className="text-[10.5px] font-semibold text-blue-700 dark:text-blue-300">
              Envío automático a pacientes con correo
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
              Asunto del Correo
            </label>
            <input
              type="text"
              data-testid="campaign-email-subject-input"
              value={emailSubject}
              onChange={(e) => onEmailSubjectChange(e.target.value)}
              placeholder="Ej: Recordatorio de Atención Preventiva SADI · {campana}"
              className="w-full text-xs px-3 py-2 rounded-xl border border-blue-300/80 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
              Mensaje / Cuerpo del Correo
            </label>
            <textarea
              rows={compact ? 4 : 5}
              data-testid="campaign-email-body-textarea"
              value={emailBody}
              onChange={(e) => onEmailBodyChange(e.target.value)}
              placeholder="Redacta el contenido completo del correo electrónico que se enviará a los pacientes..."
              className="w-full text-xs p-3 rounded-xl border border-blue-300/80 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-semibold text-blue-800 dark:text-blue-300 inline-flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3" /> Insertar variable:
            </span>
            {VARIABLE_CHIPS.map((v) => (
              <button
                key={`mail-${v.token}`}
                type="button"
                onClick={() => appendToken(emailBody, onEmailBodyChange, v.token)}
                title={v.label}
                className="px-2 py-0.5 text-[10.5px] font-mono font-bold rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700 transition-colors"
              >
                + {v.token}
              </button>
            ))}
          </div>
        </div>
      )}

      {!channels.sms && !channels.email && (
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
          Activa <strong>Mensaje SMS</strong> o <strong>Correo E-mail</strong> para redactar el contenido del mensaje de esta campaña.
        </div>
      )}
    </div>
  );
}
