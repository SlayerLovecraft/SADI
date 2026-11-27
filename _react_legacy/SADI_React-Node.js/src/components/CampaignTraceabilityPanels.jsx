import React, { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  PhoneCall,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  FileSpreadsheet,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  campaignTraceabilityService,
  summarizeTraceabilityByChannel,
  exportChannelTraceabilityExcel,
} from '@/services/campaignTraceabilityService';

const PANEL_CONFIGS = [
  {
    key: 'sms',
    title: 'Trazabilidad SMS',
    subtitle: 'OpenVox GSM Puerto 13 · Respuestas entrantes reales',
    icon: Send,
    accentBorder: 'border-emerald-200 dark:border-emerald-900/70',
    accentHeader: 'bg-emerald-50/70 dark:bg-emerald-950/40',
    accentIcon: 'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300',
    btnClass: 'border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60',
  },
  {
    key: 'call',
    title: 'Trazabilidad Llamadas IA',
    subtitle: 'Vapi · Puerto 13 · Confirmación por voz / teclado',
    icon: PhoneCall,
    accentBorder: 'border-indigo-200 dark:border-indigo-900/70',
    accentHeader: 'bg-indigo-50/70 dark:bg-indigo-950/40',
    accentIcon: 'bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300',
    btnClass: 'border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60',
  },
  {
    key: 'email',
    title: 'Trazabilidad Correos E-mail',
    subtitle: 'Envíos de campaña y confirmaciones de correo',
    icon: Mail,
    accentBorder: 'border-blue-200 dark:border-blue-900/70',
    accentHeader: 'bg-blue-50/70 dark:bg-blue-950/40',
    accentIcon: 'bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300',
    btnClass: 'border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/60',
  },
  {
    key: 'whatsapp',
    title: 'Trazabilidad WhatsApp',
    subtitle: 'Estado de mensajes y respuestas de asistencia',
    icon: MessageSquare,
    accentBorder: 'border-teal-200 dark:border-teal-900/70',
    accentHeader: 'bg-teal-50/70 dark:bg-teal-950/40',
    accentIcon: 'bg-teal-100 dark:bg-teal-900/70 text-teal-700 dark:text-teal-300',
    btnClass: 'border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/60',
  },
];

export default function CampaignTraceabilityPanels({ campaigns = [], hospitalId = null }) {
  const { toast } = useToast();
  const [selectedCampaignId, setSelectedCampaignId] = useState('todas');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const runSync = async (showToast = false) => {
    setLoading(true);
    try {
      const res = await campaignTraceabilityService.syncAndFetch({
        hospitalId,
        campaignId: selectedCampaignId,
      });
      setRecords(res.records || []);
      setLastSyncAt(new Date());
      if (showToast) {
        toast({
          title: '🔄 Trazabilidad Sincronizada en Vivo',
          description: `Registros: ${res.records?.length || 0} | Respuestas SMS leídas de OpenVox P.13: ${res.syncedSmsReplies || 0} | Llamadas actualizadas: ${res.syncedCalls || 0}.`,
        });
      }
    } catch (e) {
      if (showToast) {
        toast({
          title: 'Error sincronizando trazabilidad',
          description: e?.message || 'No se pudo consultar respuestas.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSync(false);
    const interval = setInterval(() => runSync(false), 30000);
    const onCampaignUpdated = () => setTimeout(() => runSync(false), 1200);
    window.addEventListener('sadi:campaigns-updated', onCampaignUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('sadi:campaigns-updated', onCampaignUpdated);
    };
  }, [selectedCampaignId, hospitalId]);

  const byChannel = useMemo(() => summarizeTraceabilityByChannel(records), [records]);

  const handleExport = (channelKey) => {
    const res = exportChannelTraceabilityExcel({
      records,
      channel: channelKey,
      campaignsList: campaigns,
    });
    toast({
      title: '📊 Excel de Trazabilidad Descargado',
      description: `Archivo "${res.filename}" generado con ${res.count} registro(s).`,
    });
  };

  return (
    <div
      data-testid="campaign-traceability-section"
      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-5"
    >
      {/* Cabecera de Trazabilidad */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-slate-900 dark:bg-blue-600 text-white shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
              Trazabilidad de Respuestas por Canal (SMS · Llamadas · Correos · WhatsApp)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Conteo anónimo en tiempo real de respuestas de asistencia. Descarga el Excel en cada panel para ver paciente, medio, estado y hora exacta de recibido.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold max-w-[240px]"
          >
            <option value="todas">Todas las Campañas</option>
            {(campaigns || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="btn-sync-traceability"
            onClick={() => runSync(true)}
            disabled={loading}
            className="text-xs font-bold rounded-xl gap-1.5 border-slate-300 dark:border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar Respuestas
          </Button>

          <Button
            type="button"
            size="sm"
            data-testid="btn-excel-trace-all"
            onClick={() => handleExport('all')}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-bold rounded-xl gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel Consolidado
          </Button>
        </div>
      </div>

      {/* Grilla de los 4 Paneles de Trazabilidad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PANEL_CONFIGS.map((cfg) => {
          const Icon = cfg.icon;
          const stats = byChannel[cfg.key] || {
            total: 0,
            confirma_asistencia: 0,
            no_puede_asistir: 0,
            pendiente: 0,
          };
          const pctConfirm = stats.total > 0 ? Math.round((stats.confirma_asistencia / stats.total) * 100) : 0;
          const pctDecline = stats.total > 0 ? Math.round((stats.no_puede_asistir / stats.total) * 100) : 0;
          const pctPending = stats.total > 0 ? Math.max(0, 100 - pctConfirm - pctDecline) : 0;

          return (
            <div
              key={cfg.key}
              data-testid={`traceability-panel-${cfg.key}`}
              className={`rounded-2xl border ${cfg.accentBorder} bg-white dark:bg-slate-950/40 overflow-hidden flex flex-col justify-between`}
            >
              {/* Encabezado del Panel */}
              <div className={`${cfg.accentHeader} px-4 py-3 flex items-center justify-between gap-2 border-b ${cfg.accentBorder}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 ${cfg.accentIcon}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {cfg.title}
                    </h4>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                      {cfg.subtitle}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shrink-0">
                  {stats.total} envíos
                </span>
              </div>

              {/* 3 Contadores Exactos (Anónimos) */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-900/60 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Confirma Asistencia</span>
                    </div>
                    <div
                      data-testid={`count-${cfg.key}-confirma`}
                      className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1"
                    >
                      +{stats.confirma_asistencia}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/35 border border-rose-200/80 dark:border-rose-900/60 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-rose-800 dark:text-rose-300">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>No Puede Asistir</span>
                    </div>
                    <div
                      data-testid={`count-${cfg.key}-rechaza`}
                      className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1"
                    >
                      +{stats.no_puede_asistir}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-900/60 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>Pendiente por Confirmación</span>
                    </div>
                    <div
                      data-testid={`count-${cfg.key}-pendiente`}
                      className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1"
                    >
                      +{stats.pendiente}
                    </div>
                  </div>
                </div>

                {/* Barra de distribución visual */}
                <div className="space-y-1">
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                    {pctConfirm > 0 && (
                      <div className="bg-emerald-500 h-full transition-all" style={{ width: `${pctConfirm}%` }} />
                    )}
                    {pctDecline > 0 && (
                      <div className="bg-rose-500 h-full transition-all" style={{ width: `${pctDecline}%` }} />
                    )}
                    {pctPending > 0 && (
                      <div className="bg-amber-400 h-full transition-all" style={{ width: `${pctPending}%` }} />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400">
                    <span>Confirmación: <strong className="text-emerald-700 dark:text-emerald-400">{pctConfirm}%</strong></span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid={`btn-excel-trace-${cfg.key}`}
                      onClick={() => handleExport(cfg.key)}
                      className={`h-7 px-2.5 text-[11px] font-bold rounded-lg gap-1.5 bg-white dark:bg-slate-900 ${cfg.btnClass}`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Descargar Excel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lastSyncAt && (
        <div className="text-[10.5px] text-right text-slate-400 dark:text-slate-500">
          Última sincronización en vivo: {lastSyncAt.toLocaleTimeString('es-CO')}
        </div>
      )}
    </div>
  );
}
