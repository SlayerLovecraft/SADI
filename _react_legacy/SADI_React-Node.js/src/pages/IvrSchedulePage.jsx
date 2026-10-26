// ==============================================================================
// IvrSchedulePage.jsx - CRONOGRAMA AUTOMÁTICO DE LLAMADAS IVR SADI 3280
// Tandas de 32 pacientes cada 30 min (10:00 AM a 06:00 PM)
// Reasignación automática a la tanda siguiente si no contesta
// Reporte de casos aislados para intervención humana
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { 
  Clock, PhoneCall, CheckCircle2, AlertTriangle, UserX, 
  RotateCw, Play, ShieldAlert, Sparkles, Phone, MessageSquare, 
  Calendar, Check, UserCheck, Search, Filter, Info, ChevronRight,
  Settings, ArrowRight, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ivrScheduleService, 
  IVR_TIME_SLOTS, 
  MAX_PATIENTS_PER_BATCH 
} from '@/services/ivrScheduleService';

export default function IvrSchedulePage() {
  const { toast } = useToast();
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tandas'); // 'tandas' | 'casos_humanos' | 'config'
  const [selectedSlotId, setSelectedSlotId] = useState('t1');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [isSimulating, setIsSimulating] = useState(false);
  const [config, setConfig] = useState(ivrScheduleService.getConfig());

  // Modal para registro de gestión humana
  const [selectedHumanCase, setSelectedHumanCase] = useState(null);
  const [humanNotes, setHumanNotes] = useState('');
  const [humanOutcome, setHumanOutcome] = useState('contactado_exitoso');

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async (force = false) => {
    setLoading(true);
    try {
      const data = await ivrScheduleService.getDailySchedule(null, force);
      setScheduleData(data);
    } catch (e) {
      console.error('Error cargando cronograma:', e);
      toast({
        title: "Error al cargar cronograma",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateBatch = async (slotId) => {
    setIsSimulating(true);
    try {
      const res = await ivrScheduleService.simulateBatchExecution(slotId);
      setScheduleData(res.schedule);
      const slot = IVR_TIME_SLOTS.find(s => s.id === slotId);

      toast({
        title: `⚡ Tanda ${slot?.hora} ejecutada`,
        description: `Procesados: ${res.stats.processed} | Reasignados a tanda siguiente: ${res.stats.reassigned} | Derivados a gestión humana: ${res.stats.sentToHuman}`
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

  const handleSaveHumanIntervention = async (e) => {
    e.preventDefault();
    if (!selectedHumanCase) return;

    try {
      const updated = await ivrScheduleService.recordHumanIntervention(selectedHumanCase.id, {
        responsable: 'Enfermería Hospital SADI',
        notas: humanNotes,
        resultado: humanOutcome
      });
      setScheduleData(updated);
      setSelectedHumanCase(null);
      setHumanNotes('');
      toast({
        title: "✅ Gestión Humana Registrada",
        description: `El caso de ${selectedHumanCase.nombre} ha sido gestionado y archivado.`
      });
    } catch (e) {
      toast({
        title: "Error al registrar",
        description: e.message,
        variant: "destructive"
      });
    }
  };

  const handleReset = async () => {
    if (window.confirm('¿Desea reiniciar el cronograma y devolver todos los pacientes al estado inicial?')) {
      const fresh = await ivrScheduleService.resetSchedule();
      setScheduleData(fresh);
      toast({
        title: "Cronograma reiniciado",
        description: "Se han recalculado las tandas de 32 pacientes para el día de hoy."
      });
    }
  };

  const handleToggleEngine = () => {
    const updated = { ...config, isLiveEnabled: !config.isLiveEnabled };
    ivrScheduleService.saveConfig(updated);
    setConfig(updated);
    toast({
      title: updated.isLiveEnabled ? "🟢 Motor IVR EN VIVO Activado" : "🟡 Motor IVR en Modo Standby Seguro",
      description: updated.isLiveEnabled 
        ? "El sistema comenzará a lanzar llamadas por tandas a la hora programada."
        : "El sistema no realizará llamadas reales salientes hasta que se reactive."
    });
  };

  // Métricas calculadas
  const items = scheduleData?.items || [];
  const totalPacientes = items.length;
  const confirmados = items.filter(i => i.estado === 'confirmada').length;
  const reagendados = items.filter(i => i.estado === 'reagendada').length;
  const enReintento = items.filter(i => i.estado === 'en_reintento').length;
  const casosHumanos = items.filter(i => i.estado === 'caso_aislado_humano' || i.gestionHumana?.requerida).length;
  const programados = items.filter(i => i.estado === 'programada').length;

  // Filtrado de pacientes de la tanda seleccionada
  const currentSlotPatients = items.filter(i => {
    if (activeTab === 'casos_humanos') {
      return i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano';
    }
    const matchSlot = i.slotId === selectedSlotId;
    const matchSearch = searchTerm === '' || 
      i.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.documento.includes(searchTerm) ||
      i.telefono.includes(searchTerm);
    const matchStatus = filterStatus === 'todos' || i.estado === filterStatus;

    return matchSlot && matchSearch && matchStatus;
  });

  const selectedSlot = IVR_TIME_SLOTS.find(s => s.id === selectedSlotId) || IVR_TIME_SLOTS[0];

  return (
    <Layout>
      <Helmet>
        <title>Cronograma IVR 3280 • Tandas de Llamadas - SADI</title>
      </Helmet>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* ENCABEZADO PRINCIPAL */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-cyan-900 text-white p-6 rounded-2xl shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-blue-500/20 rounded-xl backdrop-blur-md border border-blue-400/30">
                <Clock className="w-7 h-7 text-cyan-300" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Cronograma de Automatización IVR</h1>
                <p className="text-sm text-cyan-200 mt-0.5">
                  Tandas de 32 pacientes cada 30 minutos (10:00 AM - 6:00 PM) • Resolución 3280 de 2018
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right mr-2 hidden sm:block">
              <span className="text-xs uppercase tracking-wider text-cyan-300 block font-semibold">Estado del Motor</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mt-1 ${
                config.isLiveEnabled 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                <span className={`w-2 h-2 rounded-full ${config.isLiveEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {config.isLiveEnabled ? 'EN VIVO AUTOMÁTICO' : 'STANDBY SEGURO (Sin llamadas reales)'}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleEngine}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-medium"
            >
              {config.isLiveEnabled ? 'Pausar a Standby' : 'Activar Motor'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-medium"
              title="Reiniciar cronograma diario"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
              <span>Programados Hoy</span>
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-2">{totalPacientes}</p>
            <span className="text-[11px] text-gray-500">{programados} en cola inicial</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm bg-emerald-50/20">
            <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
              <span>Confirmados (Tecla 1)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 mt-2">{confirmados}</p>
            <span className="text-[11px] text-emerald-600">Asistencia garantizada</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm bg-blue-50/20">
            <div className="flex items-center justify-between text-blue-700 text-xs font-medium">
              <span>Reagendados (Tecla 2)</span>
              <PhoneCall className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-700 mt-2">{reagendados}</p>
            <span className="text-[11px] text-blue-600">Piden nueva fecha</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm bg-amber-50/20">
            <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
              <span>En Reintento (Tanda Sig.)</span>
              <RotateCw className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-700 mt-2">{enReintento}</p>
            <span className="text-[11px] text-amber-600">Pasan a próx. intervalo</span>
          </div>

          <div 
            onClick={() => setActiveTab('casos_humanos')}
            className="bg-white p-4 rounded-xl border border-red-200 shadow-sm bg-red-50/30 cursor-pointer hover:border-red-300 transition-colors"
          >
            <div className="flex items-center justify-between text-red-700 text-xs font-medium">
              <span>Casos Aislados (Humano)</span>
              <UserX className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-700 mt-2">{casosHumanos}</p>
            <span className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
              Requieren llamada manual <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          <button
            onClick={() => setActiveTab('tandas')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'tandas'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            Tandas de Llamadas (30 min)
          </button>

          <button
            onClick={() => setActiveTab('casos_humanos')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'casos_humanos'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Bandeja Casos Aislados No Contactados
            {casosHumanos > 0 && (
              <span className="px-2 py-0.5 text-xs bg-white text-red-600 rounded-full font-bold">
                {casosHumanos}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'config'
                ? 'bg-gray-800 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            Parámetros y Arquitectura de Automatización
          </button>
        </div>

        {/* CONTENIDO PESTAÑA 1: TANDAS DE LLAMADAS */}
        {activeTab === 'tandas' && (
          <div className="space-y-6">
            {/* CARROUSEL DE SLOTS DE TIEMPO (10:00 AM A 06:00 PM) */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Seleccionar Franja Horaria de la Tanda (Intervalos de 30 minutos)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Máximo {MAX_PATIENTS_PER_BATCH} llamadas por tanda. Los que no contesten pasan inmediatamente a la siguiente.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSimulateBatch(selectedSlotId)}
                  disabled={isSimulating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isSimulating ? 'Simulando llamadas...' : `Simular Tanda ${selectedSlot.hora}`}
                </Button>
              </div>

              {/* Botones de tandas */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {IVR_TIME_SLOTS.map((slot) => {
                  const slotItems = items.filter(i => i.slotId === slot.id);
                  const isSelected = selectedSlotId === slot.id;
                  const isFull = slotItems.length >= MAX_PATIENTS_PER_BATCH;

                  return (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-left border transition-all ${
                        isSelected
                          ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                          {slot.hora}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                          isFull 
                            ? 'bg-purple-100 text-purple-700' 
                            : slotItems.length > 0 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {slotItems.length}/{MAX_PATIENTS_PER_BATCH}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 block mt-1">
                        {slot.label.split(' ')[0]} {slot.label.split(' ')[1]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TABLA DE PACIENTES DE LA TANDA */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Pacientes Asignados a la Tanda de las {selectedSlot.hora}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {currentSlotPatients.length} paciente(s) en esta franja
                    </p>
                  </div>
                </div>

                {/* Filtros */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, cédula o tel..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="py-1.5 px-3 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="programada">Programadas</option>
                    <option value="confirmada">Confirmadas (Tecla 1)</option>
                    <option value="reagendada">Reagendadas (Tecla 2)</option>
                    <option value="en_reintento">En Reintento</option>
                    <option value="caso_aislado_humano">Casos Aislados</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
                    <tr>
                      <th className="p-3">Paciente / Cédula</th>
                      <th className="p-3">Teléfono</th>
                      <th className="p-3">Curso de Vida & Ruta 3280</th>
                      <th className="p-3">Estado de la Llamada</th>
                      <th className="p-3">Intentos</th>
                      <th className="p-3">Último Evento IVR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentSlotPatients.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-gray-400">
                          No hay pacientes programados en la tanda de las {selectedSlot.hora} con los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      currentSlotPatients.map((item) => (
                        <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-3">
                            <span className="font-bold text-gray-900 block">{item.nombre}</span>
                            <span className="text-[11px] text-gray-500">C.C. {item.documento}</span>
                          </td>
                          <td className="p-3 font-mono text-gray-700">
                            {item.telefono}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 block w-fit mb-1">
                              {item.cursoVida} ({item.edad} años)
                            </span>
                            <span className="text-gray-700 text-[11px] line-clamp-1">
                              {item.programa3280}
                            </span>
                          </td>
                          <td className="p-3">
                            {item.estado === 'confirmada' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                <Check className="w-3.5 h-3.5" /> Confirmó (Tecla 1)
                              </span>
                            )}
                            {item.estado === 'reagendada' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                                <PhoneCall className="w-3.5 h-3.5" /> Reagendó (Tecla 2)
                              </span>
                            )}
                            {item.estado === 'en_reintento' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                                <RotateCw className="w-3.5 h-3.5 animate-spin" /> Pasó a Tanda {item.slotHora}
                              </span>
                            )}
                            {item.estado === 'caso_aislado_humano' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                                <AlertTriangle className="w-3.5 h-3.5" /> Requiere Humano
                              </span>
                            )}
                            {item.estado === 'programada' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                                <Clock className="w-3.5 h-3.5" /> En Espera
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-gray-700">{item.intentos}</span>
                            <span className="text-gray-400 text-[11px]">/3 max</span>
                          </td>
                          <td className="p-3 text-[11px] text-gray-600">
                            {item.ultimaInteraccion || 'Pendiente de inicio de tanda'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO PESTAÑA 2: CASOS AISLADOS (GESTIÓN HUMANA) */}
        {activeTab === 'casos_humanos' && (
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 p-5 rounded-2xl flex items-start gap-4">
              <span className="p-2.5 bg-red-100 rounded-xl text-red-700 flex-shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-base font-bold text-red-900">
                  Bandeja de Casos No Contactados (Gestión Manual / Trabajo Social)
                </h3>
                <p className="text-xs text-red-700 mt-1">
                  Pacientes que no contestaron en ninguna de las tandas programadas a lo largo del día. Según las directrices del hospital, un profesional de trabajo social o enfermería debe comunicarse directamente vía llamada telefónica o WhatsApp para garantizar la cobertura de la Resolución 3280.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.filter(i => i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano').length === 0 ? (
                <div className="col-span-full bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400">
                  <UserCheck className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                  <p className="font-bold text-gray-800 text-base">No hay casos aislados pendientes</p>
                  <p className="text-xs text-gray-500 mt-1">Todos los pacientes han sido contactados exitosamente por el agente IVR o aún tienen tandas pendientes.</p>
                </div>
              ) : (
                items.filter(i => i.gestionHumana?.requerida || i.estado === 'caso_aislado_humano').map((item) => (
                  <div 
                    key={item.id} 
                    className={`bg-white rounded-xl border p-4 shadow-sm flex flex-col justify-between ${
                      item.gestionHumana?.atendido 
                        ? 'border-emerald-200 bg-emerald-50/20' 
                        : 'border-red-200 hover:border-red-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="font-bold text-gray-900 text-sm block">{item.nombre}</span>
                          <span className="text-xs text-gray-500 font-mono">C.C. {item.documento}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.gestionHumana?.atendido 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.gestionHumana?.atendido ? 'Gestionado por Humano' : 'No Contactado en Todo el Día'}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-gray-600 my-3">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-semibold text-gray-800">{item.telefono}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                          <span className="line-clamp-1">{item.programa3280}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>Intentos realizados por el agente: {item.intentos}</span>
                        </div>
                      </div>

                      {/* Historial de tandas fallidas */}
                      <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-[10px] space-y-1 mb-4">
                        <span className="font-semibold text-gray-700 block">Historial de tandas:</span>
                        {item.historialIntentos.map((h, i) => (
                          <div key={i} className="text-gray-600 flex justify-between">
                            <span>{h.tanda}:</span>
                            <span className="text-red-600 font-medium">{h.resultado}</span>
                          </div>
                        ))}
                      </div>

                      {item.gestionHumana?.atendido && (
                        <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 text-[11px] mb-3">
                          <span className="font-bold text-emerald-900 block">Gestión Manual Registrada:</span>
                          <p className="text-emerald-800 mt-0.5">{item.gestionHumana.notas}</p>
                          <span className="text-[10px] text-emerald-600 block mt-1">Por: {item.gestionHumana.responsable}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <a
                        href={`tel:${item.telefono}`}
                        className="flex-1 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-center font-bold text-xs hover:bg-blue-100 flex items-center justify-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" /> Llamar
                      </a>
                      <a
                        href={`https://wa.me/57${item.telefono}?text=Hola%20${encodeURIComponent(item.nombre)},%20te%20escribimos%20del%20Hospital%20SADI%20para%20tu%20cita%20de%20la%20Resolución%203280.`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-center font-bold text-xs hover:bg-emerald-100 flex items-center justify-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                      <Button
                        size="sm"
                        onClick={() => setSelectedHumanCase(item)}
                        className="py-1 px-3 bg-gray-900 text-white text-xs"
                      >
                        Registrar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CONTENIDO PESTAÑA 3: CONFIGURACIÓN Y ARQUITECTURA */}
        {activeTab === 'config' && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Arquitectura y Automatización del Motor IVR SADI 3280
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Cómo opera el sistema de llamadas salientes para cumplir la demanda inducida reglamentaria.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-700">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-900 text-sm mb-1">1. ¿Cómo sabe a quién y cuándo llamar?</h4>
                  <p>
                    El motor cruza la fecha de nacimiento (Curso de Vida: Primera Infancia, Infancia, Adolescencia, Juventud, Adultez, Vejez, Materno-Perinatal) con las atenciones obligatorias de la <strong>Resolución 3280 de 2018</strong>. Los pacientes cuya ventana de atención vence en la fecha son agendados automáticamente en el cronograma del día.
                  </p>
                </div>

                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-900 text-sm mb-1">2. ¿Cómo accede a los datos el agente de voz?</h4>
                  <p>
                    Al iniciar la llamada saliente, SADI inyecta dinámicamente en el asistente Vapi los datos del paciente (nombre, médico asignado, hospital, últimos signos vitales caseros y alerta médica). Además, cuenta con <em>Function Calling (Tools)</em> para consultar en vivo el expediente clínico y agendar citas en menos de 400 milisegundos.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-900 text-sm mb-1">3. Distribución por Tandas de 32 Pacientes (30 min)</h4>
                  <p>
                    Para no saturar las líneas ni el centro de contacto hospitalario, las llamadas se lanzan en bloques de <strong>32 pacientes cada 30 minutos</strong> desde las <strong>10:00 AM hasta las 06:00 PM</strong> (17 tandas diarias).
                  </p>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <h4 className="font-bold text-amber-900 text-sm mb-1">4. Reintentos Inmediatos y Casos Aislados</h4>
                  <p>
                    Si un paciente no contesta en su tanda (10:00 AM), el motor lo reasigna automáticamente a la tanda siguiente (10:30 AM). Si tras recorrer las tandas del día sigue sin contestar, el caso pasa inmediatamente a la <strong>Bandeja de Casos No Contactados</strong> para que una enfermera o trabajadora social lo atienda manualmente.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6 flex items-center justify-between">
              <div>
                <span className="font-bold text-gray-900 text-sm block">Modo Operativo Actual</span>
                <span className="text-xs text-gray-500">
                  {config.isLiveEnabled 
                    ? 'El sistema está en modo EN VIVO. Se realizarán llamadas telefónicas salientes reales.' 
                    : 'El sistema está en Standby Seguro. No se emitirán llamadas reales hasta que el hospital lo autorice.'}
                </span>
              </div>

              <Button
                onClick={handleToggleEngine}
                className={config.isLiveEnabled ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
              >
                {config.isLiveEnabled ? 'Pausar a Standby' : 'Activar Modo En Vivo'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL REGISTRO DE GESTIÓN HUMANA */}
      <AnimatePresence>
        {selectedHumanCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2 text-red-600">
                  <ShieldAlert className="w-5 h-5" />
                  <h3 className="font-bold text-gray-900">Registrar Gestión Manual</h3>
                </div>
                <button 
                  onClick={() => setSelectedHumanCase(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="text-xs space-y-1">
                <p><strong>Paciente:</strong> {selectedHumanCase.nombre}</p>
                <p><strong>Cédula:</strong> {selectedHumanCase.documento}</p>
                <p><strong>Teléfono:</strong> {selectedHumanCase.telefono}</p>
                <p><strong>Programa 3280:</strong> {selectedHumanCase.programa3280}</p>
              </div>

              <form onSubmit={handleSaveHumanIntervention} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Resultado del contacto manual
                  </label>
                  <select
                    value={humanOutcome}
                    onChange={(e) => setHumanOutcome(e.target.value)}
                    className="w-full text-xs p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="contactado_exitoso">Contactado con éxito (Confirma asistencia)</option>
                    <option value="reagendado_manual">Reagendado manualmente por el profesional</option>
                    <option value="numero_equivocado">Número equivocado / Inexistente (Reportar EPS)</option>
                    <option value="rechazo_atencion">Paciente rechaza atención 3280</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Notas y Observaciones de la Gestión
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={humanNotes}
                    onChange={(e) => setHumanNotes(e.target.value)}
                    placeholder="Ej: Se contactó por llamada directa, se le informó sobre la consulta de detección temprana y aceptó cita para el viernes..."
                    className="w-full text-xs p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedHumanCase(null)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Guardar Gestión
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
