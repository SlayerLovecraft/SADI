import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { 
  Bot, PhoneCall, Copy, Check, Sparkles, RefreshCw, Terminal, 
  User, Activity, ShieldAlert, FileText, Send, Zap, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { telemonitoringService } from '@/services/telemonitoringService';
import { vapiIntegrationService } from '@/services/vapiIntegrationService';

export default function VapiIntegrationPage() {
  const { toast } = useToast();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [vapiContext, setVapiContext] = useState(null);
  const [dynamicPrompt, setDynamicPrompt] = useState('');
  const [vapiConfig, setVapiConfig] = useState(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  // Simulador de webhook
  const [simulatedTool, setSimulatedTool] = useState('getPatientClinicalContext');
  const [simulatedArgs, setSimulatedArgs] = useState('{"sintoma": "cefalea intensa pulsatil", "severidad": "severa_emergencia"}');
  const [webhookResponse, setWebhookResponse] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    async function load() {
      const list = await telemonitoringService.getPatients();
      setPatients(list);
      if (list.length > 0) {
        // Seleccionar por defecto a Valentina Restrepo (gestante con preeclampsia)
        const def = list.find(p => p.nombre.includes('Valentina')) || list[0];
        setSelectedPatientId(def.id);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    loadPatientVapiContext(selectedPatientId);
  }, [selectedPatientId]);

  const loadPatientVapiContext = async (patientId) => {
    const ctx = await vapiIntegrationService.buildPatientVapiContext(patientId);
    setVapiContext(ctx);
    const prompt = vapiIntegrationService.generateVapiDynamicPrompt(ctx);
    setDynamicPrompt(prompt);
    const config = vapiIntegrationService.generateVapiAssistantConfig(ctx);
    setVapiConfig(config);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(dynamicPrompt);
    setCopiedPrompt(true);
    toast({
      title: "Copiado al portapapeles",
      description: "El Prompt Dinámico con datos del paciente está listo para pegarse en Vapi."
    });
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(vapiConfig, null, 2));
    setCopiedConfig(true);
    toast({
      title: "Configuración JSON Copiada",
      description: "Payload completo para la API de Vapi copiado."
    });
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const handleSimulateWebhook = async () => {
    setIsSimulating(true);
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(simulatedArgs);
      } catch (e) {
        parsedArgs = { raw: simulatedArgs };
      }

      const res = await vapiIntegrationService.simulateVapiWebhookCall(
        simulatedTool,
        parsedArgs,
        selectedPatientId
      );
      setWebhookResponse(res);
      toast({
        title: "⚡ Webhook ejecutado con éxito",
        description: `Herramienta "${simulatedTool}" respondió al agente de Vapi.`
      });
    } catch (e) {
      toast({
        title: "Error en simulación",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>SADI - Conexión & Alimentación de Agente IA Vapi</title>
      </Helmet>

      <div className="space-y-6">

        {/* Cabecera Principal */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest">
              <Bot className="h-4 w-4" />
              Integración Telefónica Vapi • Alimentación Dinámica en Tiempo Real
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Alimentación Automática de Datos al Agente de Voz
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Vapi se nutre en tiempo real de los datos de la BD, mediciones en casa, alertas 3280 y archivos de Historias Clínicas.
            </p>
          </div>

          {/* Selector de Paciente en Tiempo Real */}
          <div className="bg-indigo-50/70 border border-indigo-200/70 rounded-2xl p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Simular llamada para:</p>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="bg-transparent font-bold text-gray-900 text-xs focus:outline-none cursor-pointer pr-4"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.tipo_documento} {p.documento}) - {p.curso_vida?.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Resumen del Contexto Inyectado */}
        {vapiContext && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Curso de Vida 3280</span>
              <p className="text-sm font-black text-gray-900 mt-0.5">{vapiContext.curso.label}</p>
              <p className="text-xs text-gray-500">{vapiContext.curso.edad}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Último Signo Registrado</span>
              <p className="text-sm font-black text-blue-600 mt-0.5">
                {vapiContext.latestMeas 
                  ? (vapiContext.latestMeas.tipo_medicion === 'presion_arterial' 
                      ? `${vapiContext.latestMeas.presion_sistolica}/${vapiContext.latestMeas.presion_diastolica} mmHg` 
                      : `${vapiContext.latestMeas.glucosa_mgdl} mg/dL`) 
                  : 'Sin registros recientes'}
              </p>
              <p className="text-xs text-gray-500">
                {vapiContext.latestMeas?.dispositivo_modelo || 'Equipo domiciliario'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Alerta Clínica Activa</span>
              <p className="text-sm font-black text-rose-600 mt-0.5 truncate">
                {vapiContext.activeAlert ? vapiContext.activeAlert.titulo : 'Normal (Sin alertas)'}
              </p>
              <p className="text-xs text-gray-500">
                {vapiContext.activeAlert ? `Prioridad: ${vapiContext.activeAlert.severidad}` : 'Parámetros en rango'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Documentos en Expediente</span>
              <p className="text-sm font-black text-purple-600 mt-0.5">
                {vapiContext.docsCount} archivos categorizados
              </p>
              <p className="text-xs font-mono text-gray-500 truncate">{vapiContext.patientFolder}</p>
            </div>
          </div>
        )}

        {/* Sección de Prompt Dinámico para Vapi */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Columna Izquierda: Prompt Dinámico */}
          <div className="lg:col-span-7 bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-md flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  System Prompt Compilado en Tiempo Real (Vapi)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyPrompt}
                  className="rounded-xl text-xs gap-1 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                >
                  {copiedPrompt ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedPrompt ? 'Copiado' : 'Copiar Prompt'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyConfig}
                  className="rounded-xl text-xs gap-1 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                >
                  {copiedConfig ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Database className="h-3.5 w-3.5" />}
                  JSON Completo
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mb-2">
              Este texto se inyecta de forma automática en cada llamada que realiza o recibe Vapi. Al actualizarse la BD o una medición, el prompt se actualiza al instante.
            </p>

            <textarea
              readOnly
              value={dynamicPrompt}
              rows={16}
              className="w-full bg-slate-950 font-mono text-xs text-emerald-300 p-4 rounded-2xl border border-slate-800 focus:outline-none resize-none overflow-y-auto leading-relaxed"
            />
          </div>

          {/* Columna Derecha: Simulador de Webhook & Function Calling de Vapi */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Simulador de Webhooks / Herramientas de Voz (Vapi Tools)
                </h3>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                Durante la llamada de voz, el modelo de OpenAI/Vapi ejecuta estas funciones para pedirle datos a SADI o reportar triaje en vivo:
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Herramienta (Tool):</label>
                  <select
                    value={simulatedTool}
                    onChange={(e) => {
                      setSimulatedTool(e.target.value);
                      if (e.target.value === 'reportPatientSymptom') {
                        setSimulatedArgs('{"sintoma": "cefalea intensa y fosfenos", "severidad": "severa_emergencia"}');
                      } else if (e.target.value === 'schedule3280Appointment') {
                        setSimulatedArgs('{"programa_nombre": "Ecografía de Detalle Anatómico", "jornada": "manana"}');
                      } else {
                        setSimulatedArgs('{"documento": "' + (vapiContext?.patient.documento || '') + '"}');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:outline-none font-mono"
                  >
                    <option value="getPatientClinicalContext">getPatientClinicalContext (Consulta datos y alertas)</option>
                    <option value="reportPatientSymptom">reportPatientSymptom (Reporta síntoma en vivo)</option>
                    <option value="schedule3280Appointment">schedule3280Appointment (Agenda cita Res. 3280)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Argumentos enviados por Vapi (JSON):</label>
                  <textarea
                    value={simulatedArgs}
                    onChange={(e) => setSimulatedArgs(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono focus:outline-none bg-gray-50"
                  />
                </div>

                <Button
                  onClick={handleSimulateWebhook}
                  disabled={isSimulating}
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2"
                >
                  <Send className="h-4 w-4" />
                  {isSimulating ? 'Consultando SADI...' : 'Ejecutar Tool Call y Ver Respuesta'}
                </Button>
              </div>

              {/* Respuesta devuelta por SADI a Vapi */}
              {webhookResponse && (
                <div className="mt-4 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono">
                  <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold mb-1">
                    <span>Respuesta JSON devuelta a Vapi:</span>
                    <span>200 OK</span>
                  </div>
                  <pre className="text-slate-300 text-[11px] overflow-x-auto p-2 bg-slate-950 rounded-xl max-h-48">
                    {JSON.stringify(webhookResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Explicación de Conexión de Producción */}
            <div className="mt-4 p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-800">
              <strong>💡 ¿Cómo se conecta esto en Vapi real?</strong>
              <p className="mt-0.5">
                En tu panel de Vapi (vapi.ai), en la sección <em>Server URL</em> colocas la URL del webhook de SADI: <code>https://tu-dominio.com/api/vapi/webhook</code>. Antes de cada llamada saliente, SADI inyecta este prompt automáticamente en el parámetro <code>assistantOverrides</code> o <code>variableValues</code>.
              </p>
            </div>
          </div>

        </div>

      </div>
    </Layout>
  );
}
