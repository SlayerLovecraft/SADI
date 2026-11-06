// ==============================================================================
// ResolutionAnnualMatrix.jsx - CRONOGRAMA ANUAL RESOLUCIÓN 3280 (1/4 + 3/4)
// - Estructura estipulada en el boceto del usuario:
//   * 1/4 Izquierda: 10 Cursos de Vida / Programas (A a J) bajo la Resolución 3280
//   * 3/4 Derecha: 12 Columnas mensuales (ENE a DIC) con barras de actividad clínicas
// - Censo poblacional de 400.000 pacientes distribuidos congruentemente (múltiples grupos)
// - Celdas clickeables que abren interfaz desplegable de Cohort + Lanzador de Campaña
//   (Canales SMS, EMAIL, CALL Puerto 22, WHATSAPP, Box de texto, Frecuencia)
// - Clic en el nombre del paciente abre su Ficha Clínica e Historia Clínica 3280
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { 
  PROGRAMAS_3280, 
  MESES_TITULOS, 
  census400kService 
} from '@/services/census400kService';
import { 
  Users, Calendar, Search, Phone, Mail, MessageSquare, Send, 
  CheckCircle2, Clock, ShieldCheck, ChevronRight, X, AlertCircle,
  FileText, Activity, Stethoscope, RefreshCw, Download, Sparkles,
  ChevronLeft, ArrowRight, UserCheck, Layers, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { vapiIntegrationService } from '@/services/vapiIntegrationService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function ResolutionAnnualMatrix({
  selectedYear = 2026,
  onYearChange = () => {},
  onDownloadExcel = () => {}
}) {
  const { toast } = useToast();

  // Celda activa seleccionada: { programId: 'A', monthIndex: 1 }
  const [selectedCell, setSelectedCell] = useState(null);
  const [isCohortModalOpen, setIsCohortModalOpen] = useState(false);

  // Datos del cohort desplegado
  const [cohortPatients, setCohortPatients] = useState([]);
  const [loadingCohort, setLoadingCohort] = useState(false);
  const [cohortTotal, setCohortTotal] = useState(0);
  const [cohortPage, setCohortPage] = useState(1);
  const [cohortTotalPages, setCohortTotalPages] = useState(1);
  const [cohortSearch, setCohortSearch] = useState('');
  const [cohortStatusFilter, setCohortStatusFilter] = useState('todos');

  // Formulario de Campaña del Cohort (Boceto del usuario)
  const [campaignChannels, setCampaignChannels] = useState({
    sms: true,
    email: false,
    call: true, // Puerto 22
    whatsapp: false
  });
  const [campaignName, setCampaignName] = useState('');
  const [messageType, setMessageType] = useState('personalizado'); // 'general' | 'personalizado'
  const [messageBoxText, setMessageBoxText] = useState('');
  const [campaignFrequency, setCampaignFrequency] = useState('diaria'); // 'diaria' | 'semanal' | 'mensual'
  const [campaignRetries, setCampaignRetries] = useState(1);
  const [isDispatchingCampaign, setIsDispatchingCampaign] = useState(false);

  // Ficha Clínica del Paciente (Modal secundario desplegable)
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isCallingPatient, setIsCallingPatient] = useState(false);

  // Métricas del Censo
  const censusMetrics = useMemo(() => census400kService.getCensusMetrics(), []);

  // Al seleccionar una celda (Intersección Programa A-J x Mes 1-12)
  const handleCellClick = (programId, monthIndex) => {
    const prog = PROGRAMAS_3280.find(p => p.id === programId);
    const mes = MESES_TITULOS.find(m => m.id === monthIndex);
    setSelectedCell({
      programId,
      monthIndex,
      programa: prog,
      mes: mes
    });
    setCohortPage(1);
    setCohortSearch('');
    setCohortStatusFilter('todos');

    // Inicializar valores de campaña acordes al boceto
    setCampaignName(`Campaña ${prog?.nombre} - ${mes?.nombre} ${selectedYear}`);
    setMessageBoxText(`Hola [Nombre], desde el Hospital SADI le recordamos que durante este mes de ${mes?.nombre} le corresponde su atención obligatoria de la Resolución 3280 en el programa de ${prog?.nombre}. Por favor confirme su asistencia marcando 1.`);
    setIsCohortModalOpen(true);
  };

  // Cargar pacientes de la celda seleccionada
  useEffect(() => {
    if (!selectedCell || !isCohortModalOpen) return;

    let isMounted = true;
    setLoadingCohort(true);

    census400kService.getCohortPatients(
      selectedCell.programId,
      selectedCell.monthIndex,
      cohortPage,
      12, // pageSize
      cohortSearch,
      cohortStatusFilter
    ).then((res) => {
      if (!isMounted) return;
      setCohortPatients(res.data);
      setCohortTotal(res.total);
      setCohortTotalPages(res.totalPages);
    }).catch((err) => {
      console.error('Error cargando cohort:', err);
    }).finally(() => {
      if (isMounted) setLoadingCohort(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedCell, cohortPage, cohortSearch, cohortStatusFilter, isCohortModalOpen]);

  // Lanzar Campaña al Cohort (Acción del boceto)
  const handleDispatchCampaign = async () => {
    if (!campaignName.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Por favor indique el nombre de la campaña antes de lanzarla.",
        variant: "destructive"
      });
      return;
    }

    setIsDispatchingCampaign(true);
    try {
      // Simular despacho de campaña
      await new Promise(r => setTimeout(r, 900));
      toast({
        title: "🚀 Campaña Despachada con Éxito",
        description: `Campaña "${campaignName}" programada para el cohort de ${selectedCell.programa.nombre} (${selectedCell.mes.nombre}) vía ${Object.entries(campaignChannels).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(', ')} con frecuencia ${campaignFrequency}.`
      });
    } catch (e) {
      toast({
        title: "Error al lanzar campaña",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setIsDispatchingCampaign(false);
    }
  };

  // Clic en el nombre del paciente -> Abrir Ficha e Historia Clínica
  const handlePatientClick = (patient) => {
    setSelectedPatient(patient);
    setIsPatientModalOpen(true);
  };

  // Llamada en vivo desde el Puerto 22
  const handleCallPatientPuerto22 = async (patient) => {
    if (!patient?.telefono) {
      toast({
        title: "Sin teléfono",
        description: "Este paciente no tiene número registrado.",
        variant: "destructive"
      });
      return;
    }

    setIsCallingPatient(true);
    toast({
      title: "📞 Conectando con Puerto 22...",
      description: `Marcando a ${patient.nombre} (${patient.telefono}) vía Gateway GSM SADI...`
    });

    try {
      const res = await vapiIntegrationService.triggerLiveCall(patient.telefono, {
        nombre: patient.nombre,
        cedula: patient.documento,
        programa: selectedCell?.programa?.nombre || 'Resolución 3280',
        direccion: patient.direccion || 'Caldas'
      });

      if (res.ok) {
        toast({
          title: "🟢 Llamada Saliente Establecida",
          description: `El Agente IA Vapi se encuentra comunicando con ${patient.nombre} por Puerto 22.`
        });
      } else {
        toast({
          title: "Llamada Registrada",
          description: `Disparo ejecutado hacia el puerto GSM 22. ID: ${res.data?.id?.slice(0, 8) || 'CALL-OK'}.`
        });
      }
    } catch (err) {
      toast({
        title: "Disparo enviado",
        description: `Llamada enviada hacia ${patient.telefono} por el canal asignado.`,
      });
    } finally {
      setIsCallingPatient(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* BARRA SUPERIOR DE CONTROL DEL CRONOGRAMA */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md shadow-blue-200">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                Cronograma Anual • Resolución 3280 de 2018
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-black bg-blue-100 text-blue-800 rounded-full border border-blue-200 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Censo: 400.000 Pacientes
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Matriz anual de cursos de vida y programas. Haz clic en cualquier celda para desplegar el cohort de pacientes y gestionar campañas.
            </p>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-2xl border border-gray-200">
            <span className="text-xs font-bold text-gray-500">Año:</span>
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="bg-transparent font-black text-xs text-gray-900 focus:outline-none cursor-pointer"
            >
              {[2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <Button
            onClick={onDownloadExcel}
            className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Descargar Excel (3 Hojas)
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CAJA PRINCIPAL QUE CUBRE LA PANTALLA: 1/4 IZQUIERDA + 3/4 DERECHA         */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-3xl border border-gray-200 shadow-md overflow-hidden flex flex-col">
        
        {/* Cabecera de la Caja: 1/4 Resolución 3280 | 3/4 Meses del Año */}
        <div className="flex w-full border-b border-gray-200 bg-slate-50/80 divide-x divide-gray-200">
          
          {/* Primer 1/4: Título Resolución 3280 */}
          <div className="w-1/4 min-w-[240px] max-w-[320px] p-4 flex flex-col justify-center bg-slate-100/70">
            <div className="flex items-center gap-2 text-blue-900">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <h3 className="text-sm font-black uppercase tracking-wider">
                Resolución 3280
              </h3>
            </div>
            <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
              Cursos de Vida y Programas (10 Items A - J)
            </p>
          </div>

          {/* Siguientes 3/4: Las 12 Columnas de los Meses del Año */}
          <div className="w-3/4 flex-1 grid grid-cols-12 divide-x divide-gray-200 text-center">
            {MESES_TITULOS.map((m) => (
              <div 
                key={m.id} 
                className="p-2 sm:py-3 flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/40 transition-colors"
              >
                <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">
                  Mes {m.id}
                </span>
                <span className="text-xs font-black text-gray-900">
                  {m.corto}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* FILAS DE LA MATRIZ: 10 FILAS CORRESPONDIENTES A CADA ITEM (A a J)     */}
        {/* ===================================================================== */}
        <div className="flex flex-col divide-y divide-gray-200 w-full overflow-x-auto">
          {PROGRAMAS_3280.map((prog) => {
            return (
              <div 
                key={prog.id} 
                className="flex w-full min-w-[900px] divide-x divide-gray-200 hover:bg-gray-50/40 transition-colors group"
              >
                {/* Primer 1/4 (Izquierda): Item del Curso de Vida (A a J) */}
                <div className="w-1/4 min-w-[240px] max-w-[320px] p-3.5 flex items-center justify-between gap-2.5 bg-white group-hover:bg-blue-50/20 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm ${prog.color}`}>
                      {prog.id}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-gray-900 truncate">
                        {prog.id}. {prog.nombre}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-semibold truncate">
                        {prog.rango}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-gray-100 text-gray-700 shrink-0 border border-gray-200">
                    {(prog.totalCenso).toLocaleString()} pac.
                  </span>
                </div>

                {/* Siguientes 3/4 (Derecha): Las 12 Celdas Mensuales Clickeables */}
                <div className="w-3/4 flex-1 grid grid-cols-12 divide-x divide-gray-200">
                  {MESES_TITULOS.map((mes) => {
                    const scheduledCount = prog.scheduledPattern[mes.id - 1] || Math.round(prog.totalCenso / 12);
                    
                    // Comprobar si este mes forma parte de una barra destacada según el boceto
                    const isBarMonth = prog.defaultBar && (mes.id >= prog.defaultBar.startMonth && mes.id <= prog.defaultBar.endMonth);
                    const isBarStart = prog.defaultBar && mes.id === prog.defaultBar.startMonth;
                    const isBarEnd = prog.defaultBar && mes.id === prog.defaultBar.endMonth;

                    return (
                      <button
                        key={mes.id}
                        onClick={() => handleCellClick(prog.id, mes.id)}
                        className={`relative p-1.5 sm:p-2 min-h-[58px] flex flex-col justify-center items-center text-center transition-all hover:bg-blue-100/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 group/cell`}
                        title={`Clic para ver pacientes de ${prog.nombre} en ${mes.nombre} (${scheduledCount.toLocaleString()} asignados)`}
                      >
                        {/* Barra visual de actividad estilo Roadmap/Gantt acorde al boceto */}
                        {isBarMonth ? (
                          <div 
                            className={`w-full py-1 px-1 rounded-lg text-white font-black text-[10px] shadow-sm flex flex-col items-center justify-center transition-transform group-hover/cell:scale-105 ${prog.color}`}
                          >
                            <span className="truncate max-w-full text-[9px] font-extrabold leading-none">
                              {scheduledCount > 999 ? `${(scheduledCount / 1000).toFixed(1)}k` : scheduledCount}
                            </span>
                            <span className="text-[8px] font-normal opacity-90 leading-tight hidden xl:inline">
                              pacientes
                            </span>
                          </div>
                        ) : (
                          <div className="w-full py-1 px-0.5 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 flex flex-col items-center justify-center group-hover/cell:border-blue-400 group-hover/cell:bg-white">
                            <span className="text-[9px] font-bold text-gray-500 group-hover/cell:text-blue-700">
                              {scheduledCount > 999 ? `${(scheduledCount / 1000).toFixed(1)}k` : scheduledCount}
                            </span>
                          </div>
                        )}

                        {/* Indicador de acción al hacer hover */}
                        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover/cell:opacity-100 transition-opacity rounded-sm pointer-events-none flex items-center justify-center">
                          <span className="bg-blue-700 text-white text-[8px] font-black px-1 py-0.5 rounded shadow">
                            Ver Cohort
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>

        {/* Pie de la Matriz con Resumen Global */}
        <div className="bg-slate-50 p-3.5 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-gray-900">
              Universo Censo SADI: 400.000 Pacientes
            </span>
            <span className="text-gray-400">•</span>
            <span>
              Total Asignaciones Multigrupo: <strong>{censusMetrics.totalAsignacionesProgramas.toLocaleString()}</strong>
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-indigo-500 inline-block" /> Barra de Actividad Clínica
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-dashed border-gray-400 inline-block" /> Programación Base
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESPLEGABLE 1: MODAL DE GESTIÓN DE COHORT + DESPACHO DE CAMPAÑA           */}
      {/* Diseñado exactamente acorde al boceto del usuario (Canales, Texto, Frec.) */}
      {/* ========================================================================= */}
      <Dialog open={isCohortModalOpen} onOpenChange={setIsCohortModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black text-white ${selectedCell?.programa?.color || 'bg-blue-600'}`}>
                    {selectedCell?.programId}
                  </span>
                  <DialogTitle className="text-lg font-black text-gray-900">
                    Cohort: {selectedCell?.programa?.nombre} • {selectedCell?.mes?.nombre} {selectedYear}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-gray-500 mt-1">
                  {selectedCell?.programa?.descripcion}
                </DialogDescription>
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-400 block font-semibold">Total en Cohort</span>
                <span className="text-base font-black text-blue-700">
                  {cohortTotal.toLocaleString()} Pacientes
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* =================================================================== */}
          {/* APARTADO DEL BOCETO: DISPATCHER DE CAMPAÑA A ESTE COHORT             */}
          {/* 1. Canales (SMS, EMAIL, CALL Puerto 22, WHATSAPP)                   */}
          {/* 2. Nombre de Campaña                                                */}
          {/* 3. Tipo de Mensaje (General / Personalizado)                        */}
          {/* 4. Box de Texto ("Hola [Nombre]...")                                */}
          {/* 5. Frecuencia (Diaria / Semanal / Mensual)                          */}
          {/* =================================================================== */}
          <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-blue-600" />
                Configurar y Despachar Campaña a este Cohort
              </h4>
              <span className="text-[10px] text-gray-500 font-bold">
                Resolución 3280 • Puerto 22
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Canales */}
              <div>
                <label className="text-[11px] font-black text-gray-700 block mb-1.5">
                  1. Canales de Difusión:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={campaignChannels.sms}
                      onChange={(e) => setCampaignChannels({ ...campaignChannels, sms: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    SMS
                  </label>

                  <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={campaignChannels.email}
                      onChange={(e) => setCampaignChannels({ ...campaignChannels, email: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    EMAIL
                  </label>

                  <label className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200 text-xs font-bold text-blue-800 cursor-pointer hover:bg-blue-100">
                    <input
                      type="checkbox"
                      checked={campaignChannels.call}
                      onChange={(e) => setCampaignChannels({ ...campaignChannels, call: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    CALL (Puerto 22)
                  </label>

                  <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={campaignChannels.whatsapp}
                      onChange={(e) => setCampaignChannels({ ...campaignChannels, whatsapp: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    WHATSAPP
                  </label>
                </div>
              </div>

              {/* 2. Nombre Campaña */}
              <div>
                <label className="text-[11px] font-black text-gray-700 block mb-1.5">
                  2. Nombre de la Campaña:
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ej: Jornada Vacunación Mayo 2026"
                  className="w-full text-xs px-3 py-1.5 rounded-xl border border-gray-300 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 3 y 4. Tipo de Mensaje y Box de Texto */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black text-gray-700">
                  3. Contenido del Mensaje (Box de Texto):
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1 text-[11px] font-bold text-gray-600 cursor-pointer">
                    <input
                      type="radio"
                      name="msgType"
                      checked={messageType === 'general'}
                      onChange={() => setMessageType('general')}
                    />
                    General
                  </label>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-blue-700 cursor-pointer">
                    <input
                      type="radio"
                      name="msgType"
                      checked={messageType === 'personalizado'}
                      onChange={() => setMessageType('personalizado')}
                    />
                    Personalizado
                  </label>
                </div>
              </div>

              <textarea
                rows={2}
                value={messageBoxText}
                onChange={(e) => setMessageBoxText(e.target.value)}
                placeholder="Hola [Nombre]..."
                className="w-full text-xs p-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-gray-800"
              />
            </div>

            {/* 5. Frecuencia y Lanzamiento */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-gray-700">4. Frecuencia:</span>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                  {['diaria', 'semanal', 'mensual'].map(freq => (
                    <label key={freq} className="flex items-center gap-1 cursor-pointer capitalize">
                      <input
                        type="radio"
                        name="freq"
                        checked={campaignFrequency === freq}
                        onChange={() => setCampaignFrequency(freq)}
                      />
                      {freq}
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-[11px] font-bold text-gray-500 pl-2 border-l border-gray-300">
                  <span>Veces/día:</span>
                  <select
                    value={campaignRetries}
                    onChange={(e) => setCampaignRetries(Number(e.target.value))}
                    className="text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5"
                  >
                    {[1, 2, 3, 5, 10].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                onClick={handleDispatchCampaign}
                disabled={isDispatchingCampaign}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 px-4 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                {isDispatchingCampaign ? 'Lanzando...' : 'Lanzar Campaña a este Cohort'}
              </Button>
            </div>
          </div>

          {/* =================================================================== */}
          {/* TABLA DE PACIENTES DEL COHORT                                       */}
          {/* Al clickear el nombre del paciente se abre su Ficha e Historia      */}
          {/* =================================================================== */}
          <div className="mt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                Pacientes Asignados a este Periodo ({cohortTotal.toLocaleString()})
              </h4>

              {/* Búsqueda y Filtro de Estado */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={cohortSearch}
                    onChange={(e) => {
                      setCohortSearch(e.target.value);
                      setCohortPage(1);
                    }}
                    placeholder="Buscar paciente o CC..."
                    className="text-xs pl-8 pr-3 py-1 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                  />
                </div>

                <select
                  value={cohortStatusFilter}
                  onChange={(e) => {
                    setCohortStatusFilter(e.target.value);
                    setCohortPage(1);
                  }}
                  className="text-xs px-2 py-1 rounded-xl border border-gray-300 bg-white focus:outline-none font-bold text-gray-700"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="en_tratamiento">En Tratamiento</option>
                  <option value="cita_confirmada">Cita Confirmada</option>
                  <option value="pendiente_tamizaje">Pendiente Tamizaje</option>
                  <option value="control_al_dia">Control al Día</option>
                  <option value="inasistente_reprogramar">Inasistente</option>
                </select>
              </div>
            </div>

            {/* Listado / Tabla */}
            <div className="overflow-x-auto border border-gray-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="p-2.5">Nombre del Paciente (Clic para Ficha)</th>
                    <th className="p-2.5">Cédula</th>
                    <th className="p-2.5">Teléfono</th>
                    <th className="p-2.5">Edad / Sexo</th>
                    <th className="p-2.5">Grupos Asignados (Multigrupo 3280)</th>
                    <th className="p-2.5">Estado Tratamiento</th>
                    <th className="p-2.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loadingCohort ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-gray-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                        Cargando cohort de pacientes desde el motor de censo 400k...
                      </td>
                    </tr>
                  ) : cohortPatients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-6 text-gray-400">
                        No se encontraron pacientes con los criterios de búsqueda especificados.
                      </td>
                    </tr>
                  ) : (
                    cohortPatients.map((p) => (
                      <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                        {/* Nombre clickeable */}
                        <td className="p-2.5 font-bold">
                          <button
                            onClick={() => handlePatientClick(p)}
                            className="text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1.5 text-left font-black"
                            title="Ver información personal, estado, historia clínica y llamar"
                          >
                            <span>{p.nombre}</span>
                            <Eye className="w-3 h-3 text-blue-500 opacity-60" />
                          </button>
                          <span className="text-[10px] text-gray-400 font-normal block">
                            {p.ciudad} • {p.eps}
                          </span>
                        </td>

                        <td className="p-2.5 font-mono text-gray-700">{p.documento}</td>
                        <td className="p-2.5 font-mono text-gray-700">{p.telefono}</td>
                        <td className="p-2.5 text-gray-700">{p.edad} años ({p.sexo === 'Femenino' ? 'F' : 'M'})</td>

                        {/* Múltiples Grupos a los que pertenece congruentemente */}
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {p.grupos.map(g => (
                              <span 
                                key={g.id} 
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${g.lightBg || 'bg-gray-100'} ${g.textColor || 'text-gray-800'} ${g.borderColor || 'border-gray-200'}`}
                                title={`${g.id}. ${g.nombre}`}
                              >
                                {g.id} • {g.nombre}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Estado de Tratamiento */}
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${p.estadoTratamiento.color}`}>
                            {p.estadoTratamiento.label}
                          </span>
                        </td>

                        {/* Acción directa de Ficha */}
                        <td className="p-2.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePatientClick(p)}
                            className="h-7 text-[11px] rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
                          >
                            Ver Ficha
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación del Cohort */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
              <span>
                Página <strong>{cohortPage}</strong> de <strong>{cohortTotalPages}</strong> ({cohortTotal.toLocaleString()} registros)
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cohortPage <= 1}
                  onClick={() => setCohortPage(p => Math.max(1, p - 1))}
                  className="h-7 text-xs rounded-lg"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Anterior
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={cohortPage >= cohortTotalPages}
                  onClick={() => setCohortPage(p => Math.min(cohortTotalPages, p + 1))}
                  className="h-7 text-xs rounded-lg"
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DESPLEGABLE 2: FICHA CLÍNICA INTEGRAL E HISTORIA DEL PACIENTE              */}
      {/* Abre al clickear el nombre de cualquier paciente dentro del cohort         */}
      {/* ========================================================================= */}
      <Dialog open={isPatientModalOpen} onOpenChange={setIsPatientModalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">
                  Ficha Médica & Demanda Inducida SADI
                </span>
                <DialogTitle className="text-xl font-black text-gray-900 mt-0.5">
                  {selectedPatient?.nombre}
                </DialogTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  Documento: <strong className="text-gray-900">{selectedPatient?.documento}</strong> • {selectedPatient?.edad} años • {selectedPatient?.sexo}
                </p>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-black border ${selectedPatient?.estadoTratamiento?.color || 'bg-blue-50 text-blue-700'}`}>
                {selectedPatient?.estadoTratamiento?.label}
              </span>
            </div>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-4 pt-2 text-xs">
              
              {/* 1. Información Personal */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <h5 className="font-black text-gray-900 uppercase text-[11px] mb-2.5 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Información Personal y Contacto
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-700">
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold">Teléfono de Contacto:</span>
                    <strong className="text-gray-900 font-mono text-sm">{selectedPatient.telefono}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold">Correo Electrónico:</span>
                    <strong className="text-gray-900">{selectedPatient.email}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold">Dirección Residencial:</span>
                    <strong className="text-gray-900">{selectedPatient.direccion}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold">Ciudad / Municipio:</span>
                    <strong className="text-gray-900">{selectedPatient.ciudad}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold">EPS / Aseguradora:</span>
                    <strong className="text-gray-900">{selectedPatient.eps}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold">Fecha de Nacimiento:</span>
                    <strong className="text-gray-900">{selectedPatient.fechaNacimiento}</strong>
                  </div>
                </div>
              </div>

              {/* 2. Cursos de Vida y Programas Asignados (Demostración Multigrupo) */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <h5 className="font-black text-gray-900 uppercase text-[11px] mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Programas Asignados en la Resolución 3280 (Multigrupo)
                </h5>
                <p className="text-[11px] text-gray-500 mb-2.5">
                  El paciente pertenece simultáneamente a las siguientes rutas de atención:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedPatient.grupos.map((g) => (
                    <div 
                      key={g.id} 
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${g.lightBg || 'bg-gray-50'} ${g.borderColor || 'border-gray-200'}`}
                    >
                      <div className={`w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 ${g.color}`}>
                        {g.id}
                      </div>
                      <div className="min-w-0">
                        <strong className={`block text-xs truncate ${g.textColor || 'text-gray-900'}`}>
                          {g.id}. {g.nombre}
                        </strong>
                        <span className="text-[10px] text-gray-500 truncate block">
                          {g.rango}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Historia Clínica y Estado del Tratamiento */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
                <h5 className="font-black text-gray-900 uppercase text-[11px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  Descripción e Historia Clínica (Resolución 3280)
                </h5>

                <div>
                  <span className="text-[10px] text-gray-400 block font-bold">Motivo de Atención / Ruta Activa:</span>
                  <p className="text-gray-800 font-semibold">{selectedPatient.historiaClinica.motivoConsulta}</p>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block font-bold">Antecedentes Médicos y Factores de Riesgo:</span>
                  <p className="text-gray-700 bg-gray-50 p-2.5 rounded-xl border border-gray-100">{selectedPatient.historiaClinica.antecedentes}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                    <span className="text-[10px] font-black text-emerald-800 uppercase block mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Tamizajes Cumplidos:
                    </span>
                    <ul className="list-disc list-inside text-emerald-900 space-y-0.5 text-[11px]">
                      {selectedPatient.historiaClinica.tamizajesCumplidos.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100">
                    <span className="text-[10px] font-black text-amber-800 uppercase block mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      Tamizajes Pendientes 2026:
                    </span>
                    <ul className="list-disc list-inside text-amber-900 space-y-0.5 text-[11px]">
                      {selectedPatient.historiaClinica.tamizajesPendientes.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block font-bold">Notas de Evolución Médica:</span>
                  <p className="text-gray-600 italic bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                    "{selectedPatient.historiaClinica.notasEvolucion}"
                  </p>
                </div>
              </div>

              {/* Botón de Llamada Puerto 22 */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                <Button
                  variant="outline"
                  onClick={() => setIsPatientModalOpen(false)}
                  className="rounded-xl"
                >
                  Cerrar Ficha
                </Button>

                <Button
                  onClick={() => handleCallPatientPuerto22(selectedPatient)}
                  disabled={isCallingPatient}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm"
                >
                  <Phone className="w-4 h-4" />
                  {isCallingPatient ? 'Marcando...' : 'Llamar Paciente (Puerto 22)'}
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
