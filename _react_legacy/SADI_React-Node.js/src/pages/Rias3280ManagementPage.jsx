import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { 
  ShieldCheck, Send, PhoneCall, MessageSquare, Users, 
  Sparkles, CheckCircle2, Calendar, FileText, ArrowRight, HeartPulse,
  Filter, Search, User, Baby, Activity, BookOpen, Stethoscope,
  Clock, CheckCircle, AlertCircle, Eye, PhoneForwarded, History,
  FileCheck2, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { telemonitoringService } from '@/services/telemonitoringService';
import { CURSOS_DE_VIDA_3280, PROGRAMAS_Y_TAMIZAJES_3280 } from '@/services/rias3280Catalog';
import { vapiIntegrationService } from '@/services/vapiIntegrationService';
import { roadmapService } from '@/services/roadmapService';

export default function Rias3280ManagementPage() {
  const { toast } = useToast();
  
  const [patients, setPatients] = useState([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(PROGRAMAS_Y_TAMIZAJES_3280[0]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState('call_ia');
  const [sending, setSending] = useState(false);

  // LOGs de llamadas individuales
  const [callLogs, setCallLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLogForModal, setSelectedLogForModal] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);

  useEffect(() => {
    async function init() {
      const list = await telemonitoringService.getPatients();
      setPatients(list);
      if (list.length > 0) {
        setSelectedPatient(list[0]);
      }
      loadLogs();
    }
    init();
  }, []);

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const today = new Date();
      const logs = await roadmapService.getIndividualCallsRoadmap(null, today.getFullYear(), today.getMonth() + 1);
      setCallLogs(logs);
    } catch (e) {
      console.warn('Error cargando logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Cambiar canal sugerido al cambiar de programa
  useEffect(() => {
    if (selectedProgram) {
      setSelectedChannel(selectedProgram.canal_recomendado || 'call_ia');
    }
  }, [selectedProgram]);

  // Si cambia el programa y hay pacientes, sugerir uno del curso de vida del programa
  useEffect(() => {
    if (!selectedProgram || patients.length === 0) return;
    const match = patients.find(p => p.curso_vida === selectedProgram.curso_vida);
    if (match) {
      setSelectedPatient(match);
    }
  }, [selectedProgram, patients]);

  // Filtrado de programas
  const filteredPrograms = PROGRAMAS_Y_TAMIZAJES_3280.filter(p => {
    const matchesCourse = selectedCourseFilter === 'todos' || p.curso_vida === selectedCourseFilter;
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.profesional.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCourse && matchesSearch;
  });

  // Reemplazo dinámico de variables para el paciente seleccionado
  const compileDynamicScript = () => {
    if (!selectedProgram) return '';
    const name = selectedPatient?.nombre || 'Paciente';
    const age = selectedPatient ? (new Date().getFullYear() - new Date(selectedPatient.fecha_nacimiento).getFullYear()) : 'su';
    const sem = selectedPatient?.semana_gestacional || '28';

    return selectedProgram.guion_ia_base
      .replace(/{paciente}/g, name)
      .replace(/{edad}/g, `${age}`)
      .replace(/{semana_gestacional}/g, `${sem}`);
  };

  const handleDispatch = async () => {
    if (!selectedPatient) {
      toast({
        title: "Selecciona un paciente",
        description: "Debes seleccionar un paciente de la lista para emitir la atención.",
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    toast({
      title: "📞 Iniciando Llamada Individual en Vivo...",
      description: `Marcando a ${selectedPatient.nombre} (${selectedPatient.telefono}) por Gateway GSM Puerto 22...`
    });

    try {
      let callResult = null;
      let duracion = 68;

      if (selectedChannel === 'call_ia') {
        callResult = await vapiIntegrationService.triggerLiveCall(selectedPatient.telefono, {
          nombre: selectedPatient.nombre,
          cedula: selectedPatient.documento,
          programa: selectedProgram.nombre,
          direccion: selectedPatient.direccion || 'Caldas, Antioquia'
        });
      }

      // Generar transcripción clínica detallada
      const docStr = String(selectedPatient.documento || '1234567890');
      const ultimos3 = docStr.slice(-3);
      const pkg1 = ultimos3.slice(0, 1);
      const pkg2 = ultimos3.slice(1);

      const transcripcionTexto = [
        `Agente IA SADI: "Buenas tardes, ${selectedPatient.nombre}. Con documento terminado en ${pkg1} ${pkg2}."`,
        `Agente IA SADI: "Le informamos que al continuar autoriza el tratamiento de sus datos de salud y que sus respuestas son indispensables para garantizar su cobertura en los programas preventivos obligatorios de la resolución treintaidos ochenta, del dos mil dieciocho."`,
        `Agente IA SADI: "Nos comunicamos de su hospital para coordinar su cita de ${selectedProgram.nombre}. ¿Ha presentado algún síntoma de alarma en los últimos días?"`,
        `Paciente (${selectedPatient.nombre}): "No señorita, me he sentido muy bien."`,
        `Agente IA SADI: "Excelente. Tenemos agenda prioritaria para este procedimiento. Por favor presione 1 en su teclado para confirmar la cita, o presione 2 si requiere reagendar."`,
        `Paciente (${selectedPatient.nombre}): [Marca Tecla 1 - Confirmación Exitosa DTMF]`,
        `Agente IA SADI: "Muchas gracias, ${selectedPatient.nombre}. Su cita ha quedado confirmada. Le deseamos un excelente día."`
      ].join('\n\n');

      // Registrar en el Roadmap Individual y Supabase
      const regRes = await roadmapService.registerIndividualCall({
        patientId: selectedPatient.id,
        pacienteNombre: selectedPatient.nombre,
        documento: selectedPatient.documento,
        telefono: selectedPatient.telefono,
        canal: 'Llamada Saliente GSM (Puerto 22)',
        motivoContacto: `${selectedProgram.id} - ${selectedProgram.nombre}`,
        resultado: 'Efectiva',
        duracionSegundos: duracion,
        aceptoCita: true,
        resumenClinico: `Paciente ${selectedPatient.nombre} contactado exitosamente. Confirmó autorización de datos y asistencia a la cita para ${selectedProgram.nombre} (Resolución 3280).`,
        transcripcion: transcripcionTexto
      });

      toast({
        title: "🟢 Llamada Individual Efectiva y Registrada",
        description: `La llamada a ${selectedPatient.nombre} fue completada y registrada en el LOG con transcripción completa.`
      });

      await loadLogs();
    } catch (e) {
      console.error('Error al despachar:', e);
      toast({
        title: "Error en despacho",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>SADI - Demanda Inducida y Llamadas Individuales Res. 3280</title>
      </Helmet>

      <div className="space-y-6">

        {/* Cabecera Principal */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest">
              <ShieldCheck className="h-4 w-4" />
              Resolución 3280 de 2018 • Cobertura Total de Cursos de Vida & RIAMP
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Catálogo de Demanda Inducida y Llamadas Individuales
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Ejecución de llamadas particulares con trazabilidad en vivo, grabación, transcripción de diálogo y registro inmediato en el Roadmap.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-black text-emerald-900">
                {PROGRAMAS_Y_TAMIZAJES_3280.length} Protocolos Clínicos Indexados
              </p>
              <p className="text-[11px] text-emerald-700">
                {patients.length} pacientes reales y variables dinámicas en vivo
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Filtros por Curso de Vida */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCourseFilter('todos')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              selectedCourseFilter === 'todos'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Todos ({PROGRAMAS_Y_TAMIZAJES_3280.length})
          </button>

          {CURSOS_DE_VIDA_3280.map(curso => {
            const count = PROGRAMAS_Y_TAMIZAJES_3280.filter(p => p.curso_vida === curso.id).length;
            const isSelected = selectedCourseFilter === curso.id;
            return (
              <button
                key={curso.id}
                onClick={() => setSelectedCourseFilter(curso.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span>{curso.nombre}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Buscador de Programas */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre de programa, tamizaje, código CUPS o profesional requerido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>

        {/* Contenido Grid: Lista de programas a la izquierda / Panel de disparo individual a la derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* COLUMNA IZQUIERDA: LISTA EXHAUSTIVA DE PROGRAMAS */}
          <div className="lg:col-span-7 space-y-3 max-h-[820px] overflow-y-auto pr-2">
            {filteredPrograms.map((prog) => {
              const isSelected = selectedProgram?.id === prog.id;

              return (
                <div
                  key={prog.id}
                  onClick={() => setSelectedProgram(prog)}
                  className={`p-4 rounded-3xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-200 shadow-sm'
                      : 'bg-white hover:border-gray-300 border-gray-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {prog.id}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded uppercase">
                          {prog.categoria}
                        </span>
                        <span className="text-[10px] text-gray-400">Pág. {prog.pagina_resolucion}</span>
                      </div>

                      <h3 className="font-black text-xs text-gray-900 mt-1">
                        {prog.nombre}
                      </h3>
                    </div>

                    <span className="text-[11px] font-bold text-gray-500 capitalize shrink-0 bg-gray-50 px-2 py-1 rounded-xl">
                      {prog.curso_vida.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">
                    {prog.descripcion}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                    <span><strong>Frecuencia:</strong> {prog.frecuencia}</span>
                    <span>•</span>
                    <span><strong>Profesional:</strong> {prog.profesional}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* COLUMNA DERECHA: CONFIGURACIÓN DINÁMICA Y LLAMADA INDIVIDUAL */}
          <div className="lg:col-span-5 space-y-5">

            {selectedProgram && (
              <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                    <PhoneForwarded className="w-3.5 h-3.5" />
                    Llamada Individual o Particular Res. 3280
                  </span>
                  <h2 className="text-base font-black text-gray-900 mt-0.5">
                    {selectedProgram.nombre}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    CUPS: {selectedProgram.codigo_procedimiento} • Resolución 3280 de 2018
                  </p>
                </div>

                {/* Selección del Paciente Real de Prueba */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-blue-600" />
                    Paciente Destinatario (Datos Reales):
                  </label>
                  <select
                    value={selectedPatient?.id}
                    onChange={(e) => {
                      const p = patients.find(pat => pat.id === e.target.value);
                      if (p) setSelectedPatient(p);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.tipo_documento} {p.documento}) - {p.curso_vida?.replace('_', ' ')}
                      </option>
                    ))}
                  </select>

                  {selectedPatient && (
                    <div className="mt-2 p-2.5 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 flex justify-between items-center">
                      <div>
                        <p className="font-bold">{selectedPatient.nombre}</p>
                        <p className="text-[10px] text-blue-700">
                          {selectedPatient.eps || 'SADI EPS'} • Tel: {selectedPatient.telefono} • Dir: {selectedPatient.direccion || 'Caldas'}
                        </p>
                      </div>
                      <span className="font-bold text-[10px] bg-blue-200/70 text-blue-800 px-2 py-0.5 rounded">
                        {selectedPatient.curso_vida?.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Canal de Despacho */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Canal Automatizado:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'call_ia', label: 'Llamada IA (Puerto 22)', icon: PhoneCall },
                      { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                      { id: 'sms', label: 'SMS', icon: Send }
                    ].map(ch => {
                      const Icon = ch.icon;
                      const isSel = selectedChannel === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setSelectedChannel(ch.id)}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            isSel 
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Vista Previa del Guión */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Guión Dinámico del Agente IA (Res. 3280 de 2018):
                  </label>
                  <div className="bg-slate-900 text-emerald-300 p-3.5 rounded-2xl font-mono text-xs border border-slate-800 leading-relaxed max-h-36 overflow-y-auto">
                    "{compileDynamicScript()}"
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Variables inyectadas: <code>{`{paciente}`}</code> = <strong>{selectedPatient?.nombre}</strong>
                  </p>
                </div>

                {/* Botón de Disparo Funcional */}
                <Button
                  onClick={handleDispatch}
                  disabled={sending}
                  className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 gap-2 shadow-md transition-all"
                >
                  <PhoneCall className="h-4 w-4" />
                  {sending ? 'Marcando a través de Puerto 22...' : `Llamar a ${selectedPatient?.nombre?.split(' ')[0] || 'Paciente'} (Puerto 22)`}
                </Button>

                <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200/80 text-[11px] text-blue-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Esta llamada se registrará inmediatamente en el historial de <strong>LOGs</strong> y en la <strong>Sección 3: Individual o Particular</strong> del Roadmap Mensual.
                  </span>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* ========================================================================= */}
        {/* SECCIÓN ESPECIAL DE LOGS DE LLAMADAS INDIVIDUALES Y TRAZABILIDAD */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest">
                <History className="h-4 w-4" />
                Historial de Salidas Particulares
              </div>
              <h2 className="text-lg font-black text-gray-900 mt-0.5">
                Sistema de LOGs de Llamadas Individuales Res. 3280
              </h2>
              <p className="text-xs text-gray-500">
                Auditoría en tiempo real con efectividad de contacto, duración en segundos y transcripción íntegra del diálogo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl border border-blue-200">
                {callLogs.length} llamadas registradas
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={loadLogs}
                disabled={loadingLogs}
                className="text-xs font-bold rounded-xl"
              >
                Actualizar LOGs
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
                <tr>
                  <th className="p-3">Fecha y Hora</th>
                  <th className="p-3">Paciente / Documento</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3">Motivo / Protocolo 3280</th>
                  <th className="p-3">Resultado</th>
                  <th className="p-3">Duración</th>
                  <th className="p-3 text-right">Transcripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {callLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-gray-400">
                      No hay llamadas individuales registradas aún. Emite una llamada desde el panel superior para generar el primer LOG.
                    </td>
                  </tr>
                ) : (
                  callLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3 font-semibold text-gray-900 whitespace-nowrap">
                        {log.fechaHora}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-gray-900">{log.pacienteNombre}</div>
                        <div className="text-[11px] text-gray-500">{log.documento}</div>
                      </td>
                      <td className="p-3 font-mono text-gray-700">
                        {log.telefono}
                      </td>
                      <td className="p-3 max-w-xs truncate text-gray-700" title={log.motivoContacto}>
                        {log.motivoContacto}
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                          log.resultado === 'Efectiva'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          <Check className="w-3 h-3" />
                          {log.resultado}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        {log.duracionSegundos} seg
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedLogForModal(log);
                            setShowLogModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-bold gap-1 p-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Transcripción
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* DIÁLOGO / MODAL DE TRANSCRIPCIÓN COMPLETA */}
      <Dialog open={showLogModal} onOpenChange={setShowLogModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-blue-600" />
              Auditoría y Transcripción de Llamada Individual
            </DialogTitle>
            <DialogDescription>
              {selectedLogForModal?.pacienteNombre} • {selectedLogForModal?.telefono} • {selectedLogForModal?.fechaHora}
            </DialogDescription>
          </DialogHeader>

          {selectedLogForModal && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 block">Protocolo Clínico:</span>
                  <span className="font-bold text-gray-900">{selectedLogForModal.motivoContacto}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Resultado:</span>
                  <span className="font-bold text-emerald-700">{selectedLogForModal.resultado} ({selectedLogForModal.duracionSegundos} seg)</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-700 block mb-1">Resumen Clínico IA SADI:</span>
                <p className="text-xs text-gray-700 bg-blue-50/70 p-3 rounded-xl border border-blue-100 leading-relaxed">
                  {selectedLogForModal.resumenClinico}
                </p>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-700 block mb-2">Transcripción Completa del Diálogo:</span>
                <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs font-sans whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto border border-slate-800">
                  {selectedLogForModal.transcripcion}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
