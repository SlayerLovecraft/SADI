// ==============================================================================
// ResolutionAnnualMatrix.jsx - CRONOGRAMA ANUAL RESOLUCIÓN 3280 & 10 CRONOGRAMAS
// - Psicología del color clínica (tonos médicos sosegados, alto contraste, sin solapamientos)
// - Encuadre perfecto de textos y badges en cada celda
// - Hitos clínicos inamovibles de la Resolución 3280 detallados por mes y edad
// - Selector de vista:
//   * Vista General (Matriz 1/4 Cursos A-J + 3/4 12 Meses)
//   * 10 Cronogramas Dedicados por Curso de Vida (A a J) con desglose de llamadas de pacientes
// - Celdas clickeables que abren el Wizard de Campaña de 4 Pasos o el Explorador Clínico
// ==============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PROGRAMAS_3280, 
  MESES_TITULOS, 
  GRUPOS_RIESGO_PRIORIZADOS,
  CANALES_DISPONIBLES,
  census400kService 
} from '@/services/census400kService';
import { 
  Users, Calendar, Search, Phone, Mail, MessageSquare, Send, 
  CheckCircle2, Clock, ShieldCheck, ChevronRight, X, AlertCircle,
  FileText, Activity, Stethoscope, RefreshCw, Download, Sparkles,
  ChevronLeft, ArrowRight, UserCheck, Layers, Eye, Plus, Radio,
  Tag, Info, Zap, AlertTriangle, Baby, HeartPulse, ShieldAlert
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

  // Selector de vista: 'general' (Matriz A-J) o ID del curso ('A', 'B', 'C', ..., 'J')
  const [activeViewMode, setActiveViewMode] = useState('general');

  // Celda activa seleccionada: { programId: 'A', monthIndex: 1 }
  const [selectedCell, setSelectedCell] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('campaign_wizard'); // 'campaign_wizard' | 'patients_cohort'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Campañas activas en memoria y persistidas
  const [campaignList, setCampaignList] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // WIZARD DE CAMPAÑA - PASOS 1 A 4
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedRiskGroup, setSelectedRiskGroup] = useState(GRUPOS_RIESGO_PRIORIZADOS[0]);
  const [selectedChannels, setSelectedChannels] = useState({
    sms: false,
    email: false,
    call: true, // Puerto 22
    whatsapp: false
  });
  const [campaignName, setCampaignName] = useState('');
  
  // Fecha y hora mínima de lanzamiento (al menos el día siguiente)
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [launchDate, setLaunchDate] = useState(tomorrowStr);
  const [launchTime, setLaunchTime] = useState('08:00');
  const [campaignDurationHours, setCampaignDurationHours] = useState(8);
  const [messageType, setMessageType] = useState('personalizado'); // 'general' | 'personalizado'
  const [messageContent, setMessageContent] = useState('');
  const [frequency, setFrequency] = useState('diaria'); // 'diaria' | 'semanal' | 'mensual'
  const [retriesPerDay, setRetriesPerDay] = useState(1);
  const [isSubmittingCampaign, setIsSubmittingCampaign] = useState(false);

  // Ref al textarea del mensaje para insertar etiquetas
  const textareaRef = useRef(null);

  // Datos del cohort desplegado en el modal
  const [cohortPatients, setCohortPatients] = useState([]);
  const [loadingCohort, setLoadingCohort] = useState(false);
  const [cohortTotal, setCohortTotal] = useState(0);
  const [cohortMilestone, setCohortMilestone] = useState(null);
  const [cohortPage, setCohortPage] = useState(1);
  const [cohortTotalPages, setCohortTotalPages] = useState(1);
  const [cohortSearch, setCohortSearch] = useState('');
  const [cohortStatusFilter, setCohortStatusFilter] = useState('todos');

  // Datos para los 10 cronogramas individuales por curso de vida
  const [dedicatedMonthData, setDedicatedMonthData] = useState({});
  const [loadingDedicated, setLoadingDedicated] = useState(false);

  // Ficha Clínica del Paciente (Modal secundario)
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isCallingPatient, setIsCallingPatient] = useState(false);

  // Métricas del Censo
  const censusMetrics = useMemo(() => census400kService.getCensusMetrics(), []);

  // Cargar campañas desde Supabase al iniciar
  useEffect(() => {
    let mounted = true;
    setLoadingCampaigns(true);
    census400kService.getCampaignsFromSupabase()
      .then((data) => {
        if (!mounted) return;
        const formatted = (data || []).map((c) => {
          const cfg = c.configuracion || {};
          const mesNum = cfg.mes_inicio || 3;
          return {
            id: c.id,
            nombre: c.nombre,
            programaId: cfg.programa_id || 'A',
            startMonth: mesNum,
            endMonth: Math.min(12, mesNum + Math.max(1, Math.floor((cfg.duracion_horas || 24) / 48))),
            canales: cfg.canales || ['call'],
            tipoMensaje: cfg.tipo_mensaje || 'general',
            color: 'bg-indigo-600',
            frecuencia: cfg.frecuencia || 'diaria'
          };
        });
        setCampaignList(formatted);
      })
      .catch((err) => {
        console.warn('Error cargando campañas:', err);
      })
      .finally(() => {
        if (mounted) setLoadingCampaigns(false);
      });

    return () => { mounted = false; };
  }, []);

  // Cargar datos para el cronograma dedicado cuando se selecciona un curso específico
  useEffect(() => {
    if (activeViewMode === 'general') return;

    let mounted = true;
    setLoadingDedicated(true);

    const prog = PROGRAMAS_3280.find(p => p.id === activeViewMode);
    if (!prog) return;

    // Cargar pacientes de muestra para los 12 meses de este programa
    const monthPromises = MESES_TITULOS.map(m => 
      census400kService.getCohortForCell({
        programId: prog.id,
        monthIndex: m.id,
        page: 1,
        pageSize: 4,
        search: '',
        filterStatus: 'todos'
      }).then(res => ({ monthId: m.id, data: res }))
    );

    Promise.all(monthPromises)
      .then(results => {
        if (!mounted) return;
        const map = {};
        results.forEach(r => {
          map[r.monthId] = r.data;
        });
        setDedicatedMonthData(map);
      })
      .catch(err => {
        console.error('Error cargando cronograma dedicado:', err);
      })
      .finally(() => {
        if (mounted) setLoadingDedicated(false);
      });

    return () => { mounted = false; };
  }, [activeViewMode, selectedYear]);

  // Al hacer clic en una celda (Intersección Programa A-J x Mes 1-12)
  const handleCellClick = (programId, monthIndex) => {
    const prog = PROGRAMAS_3280.find(p => p.id === programId);
    const mes = MESES_TITULOS.find(m => m.id === monthIndex);
    const milestone = prog?.milestones?.[monthIndex - 1];
    
    setSelectedCell({
      programId,
      monthIndex,
      programa: prog,
      mes: mes,
      milestone: milestone
    });

    setWizardStep(1);
    setActiveModalTab('campaign_wizard');
    setSelectedRiskGroup(GRUPOS_RIESGO_PRIORIZADOS[0]);
    setSelectedChannels({ sms: false, email: false, call: true, whatsapp: false });
    
    setCampaignName(`Campaña ${prog?.nombre} - ${mes?.nombre} ${selectedYear}`);
    
    const dTomorrow = new Date();
    dTomorrow.setDate(dTomorrow.getDate() + 1);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    if (monthIndex >= currentMonth && selectedYear === currentYear) {
      setLaunchDate(dTomorrow.toISOString().split('T')[0]);
    } else {
      const padM = String(monthIndex).padStart(2, '0');
      setLaunchDate(`${selectedYear}-${padM}-05`);
    }

    setMessageType('personalizado');
    setMessageContent(`Hola {nombre}, le informamos desde el Hospital SADI que en el marco de la resolución treintaidos ochenta, del dos mil dieciocho, le corresponde su atención obligatoria en el programa de ${prog?.nombre} (${milestone?.hito || 'Control'}). Por favor confirme su asistencia marcando 1.`);
    setFrequency('diaria');
    setRetriesPerDay(1);

    setCohortPage(1);
    setCohortSearch('');
    setCohortStatusFilter('todos');
    setIsModalOpen(true);
  };

  // Cargar pacientes del cohort modal cuando cambia la pestaña o celda
  useEffect(() => {
    if (!selectedCell || !isModalOpen) return;

    let isMounted = true;
    setLoadingCohort(true);

    census400kService.getCohortForCell({
      programId: selectedCell.programId,
      monthIndex: selectedCell.monthIndex,
      page: cohortPage,
      pageSize: 10,
      search: cohortSearch,
      filterStatus: cohortStatusFilter
    })
      .then((res) => {
        if (!isMounted) return;
        setCohortPatients(res.data);
        setCohortTotal(res.totalCohortCenso);
        setCohortMilestone(res.milestone);
        setCohortTotalPages(res.totalPages);
      })
      .catch((err) => {
        console.error('Error cargando cohort:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingCohort(false);
      });

    return () => { isMounted = false; };
  }, [selectedCell, isModalOpen, cohortPage, cohortSearch, cohortStatusFilter]);

  // Insertar etiqueta en el mensaje personalizado en la posición del cursor
  const handleInsertTag = (tag) => {
    const el = textareaRef.current;
    if (!el) {
      setMessageContent((prev) => prev + ` ${tag} `);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const newContent = messageContent.substring(0, start) + tag + messageContent.substring(end);
    setMessageContent(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  // Validar y Lanzar Campaña (Paso 4)
  const handleLaunchCampaign = async () => {
    if (!campaignName.trim()) {
      toast({
        title: 'Nombre requerido',
        description: 'Por favor asigna un nombre descriptivo a la campaña.',
        variant: 'destructive'
      });
      setWizardStep(3);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (launchDate <= today) {
      toast({
        title: 'Fecha no válida',
        description: 'Bajo el sistema de 32 llamadas por cada 30 minutos, debe lanzar la campaña al menos en el día siguiente.',
        variant: 'destructive'
      });
      setWizardStep(3);
      return;
    }

    const activeChannels = Object.keys(selectedChannels).filter(k => selectedChannels[k]);
    if (activeChannels.length === 0) {
      toast({
        title: 'Selecciona al menos un canal',
        description: 'Debes marcar al menos un canal (SMS, EMAIL, LLAMADA o WHATSAPP).',
        variant: 'destructive'
      });
      setWizardStep(2);
      return;
    }

    if (!messageContent.trim()) {
      toast({
        title: 'Mensaje requerido',
        description: 'Escribe el guión o mensaje que transmitirá el agente.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSubmittingCampaign(true);

      const created = await census400kService.createCampaignInSupabase({
        nombre: campaignName,
        grupoRiesgo: selectedRiskGroup,
        canales: activeChannels,
        fechaLanzamiento: launchDate,
        horaLanzamiento: launchTime,
        duracionHoras: campaignDurationHours,
        tipoMensaje: messageType,
        mensaje: messageContent,
        frecuencia: frequency,
        reintentosDia: retriesPerDay,
        programaId: selectedCell.programId,
        mesInicio: selectedCell.monthIndex
      });

      const newBar = {
        id: created?.id || `local-${Date.now()}`,
        nombre: campaignName,
        programaId: selectedCell.programId,
        startMonth: selectedCell.monthIndex,
        endMonth: Math.min(12, selectedCell.monthIndex + 1),
        canales: activeChannels,
        tipoMensaje: messageType,
        color: 'bg-emerald-600',
        frecuencia: frequency
      };

      setCampaignList(prev => [newBar, ...prev]);

      toast({
        title: '¡Campaña Agendada con Éxito!',
        description: `La campaña "${campaignName}" fue programada para el ${launchDate} a las ${launchTime}. Registrada en Campañas e Interacciones.`,
        className: 'bg-emerald-600 text-white font-bold'
      });

      setIsModalOpen(false);
    } catch (err) {
      console.error('Error al agendar campaña:', err);
      toast({
        title: 'Error al agendar',
        description: err.message || 'No fue posible guardar la campaña en Supabase.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingCampaign(false);
    }
  };

  // Llamada de prueba directa por Puerto 22
  const handleCallPatientPuerto22 = async (patient) => {
    try {
      setIsCallingPatient(true);
      toast({
        title: '📞 Conectando con Puerto 22...',
        description: `Marcando a ${patient.nombre} (${patient.telefono}) vía OpenVox GSM.`,
      });

      const res = await vapiIntegrationService.startDirectOutboundCall({
        phoneNumber: patient.telefono,
        patientName: patient.nombre,
        patientCedula: patient.documento,
        address: patient.direccion,
        appointmentType: patient.milestoneActual?.hito || patient.programaActual?.nombre || 'Resolución 3280',
        appointmentDate: patient.fechaProgramada,
        appointmentTime: patient.horaProgramada
      });

      if (res.success) {
        toast({
          title: '🟢 Llamada en Curso en Puerto 22',
          description: `ID: ${res.callId}. El Agente IA está ejecutando el protocolo 3280.`,
          className: 'bg-emerald-600 text-white font-bold'
        });
      } else {
        throw new Error(res.error || 'Fallo de señal en el enlace GSM.');
      }
    } catch (err) {
      console.error('Error llamada:', err);
      toast({
        title: 'Error de llamada',
        description: err.message || 'No se pudo enlazar el Puerto 22.',
        variant: 'destructive'
      });
    } finally {
      setIsCallingPatient(false);
    }
  };

  // Abrir Ficha Clínica
  const handleOpenPatientDetails = (patient) => {
    setSelectedPatient(patient);
    setIsPatientModalOpen(true);
  };

  const selectedProgramForDedicatedView = useMemo(() => {
    if (activeViewMode === 'general') return null;
    return PROGRAMAS_3280.find(p => p.id === activeViewMode) || PROGRAMAS_3280[0];
  }, [activeViewMode]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* ========================================================================= */}
      {/* BARRA SUPERIOR: ENCABEZADO Y CONTROLES                                    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200">
              Resolución 3280 de 2018
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              • Censo Oficial 400.000 Pacientes
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center gap-2 tracking-tight">
            Cronograma Anual de Atenciones & Llamadas Obligatorias
            <span className="text-xs font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {selectedYear}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-3xl leading-relaxed">
            Hitos inamovibles calculados por edad y curso de vida. Cada celda contiene el protocolo obligatorio y permite programar campañas de refuerzo o examinar los pacientes a contactar.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => onYearChange(selectedYear - 1)}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors"
              title="Año Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-black text-slate-800">
              {selectedYear}
            </span>
            <button
              onClick={() => onYearChange(selectedYear + 1)}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors"
              title="Año Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadExcel}
            className="rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold text-xs gap-1.5 h-9"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Excel (3 Hojas)</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SELECTOR DE VISTAS: VISTA CONSOLIDADA (A-J) + 10 CRONOGRAMAS DEDICADOS   */}
      {/* ========================================================================= */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/90 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveViewMode('general')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            activeViewMode === 'general'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Matriz Anual Consolidada (A - J)</span>
        </button>

        {PROGRAMAS_3280.map((prog) => {
          const isActive = activeViewMode === prog.id;
          return (
            <button
              key={prog.id}
              onClick={() => setActiveViewMode(prog.id)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive
                  ? `${prog.color} text-white shadow-sm font-black`
                  : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200/60'
              }`}
              title={`Ver cronograma mensual detallado para ${prog.nombre}`}
            >
              <span className={`w-4 h-4 rounded-md text-[10px] font-black flex items-center justify-center ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {prog.id}
              </span>
              <span className="truncate max-w-[130px]">{prog.nombre}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: MATRIZ ANUAL CONSOLIDADA (1/4 IZQ + 3/4 DER) SIN SOLAPAMIENTO   */}
      {/* ========================================================================= */}
      {activeViewMode === 'general' && (
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
          {/* ENCABEZADO DE LA MATRIZ: 1/4 TÍTULO + 3/4 MESES */}
          <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-900 text-white">
            {/* 1/4 Izquierda (3 columnas de 12 = 25%) */}
            <div className="col-span-3 p-3.5 border-r border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold tracking-wider text-teal-400 uppercase block">
                  Cursos de Vida
                </span>
                <h3 className="text-sm font-black text-white tracking-tight">
                  Resolución 3280
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                10 Cursos (A - J)
              </span>
            </div>

            {/* 3/4 Derecha (9 columnas de 12 = 75%): 12 meses */}
            <div className="col-span-9 grid grid-cols-12 divide-x divide-slate-800 text-center">
              {MESES_TITULOS.map((mes) => (
                <div key={mes.id} className="py-2.5 px-1 bg-slate-900 flex flex-col justify-center">
                  <span className="text-[9px] font-black text-teal-400 uppercase tracking-tighter">
                    {mes.label}
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                    {mes.abreviatura}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* FILAS DE LA MATRIZ: CADA ITEM (A A J) ES UNA FILA COMPLETA */}
          <div className="divide-y divide-slate-200">
            {PROGRAMAS_3280.map((prog) => {
              const progCampaigns = campaignList.filter(c => c.programaId === prog.id);

              return (
                <div 
                  key={prog.id} 
                  className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors group"
                >
                  {/* 1/4 IZQUIERDA: INFORMACIÓN DEL CURSO DE VIDA */}
                  <div className="col-span-3 p-3 sm:p-3.5 border-r border-slate-200 bg-white flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs ${prog.color}`}>
                          {prog.id}
                        </div>
                        <h4 className="text-xs font-black text-slate-900 truncate">
                          {prog.id}. {prog.nombre}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1 line-clamp-1">
                        {prog.rango}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1 border-t border-slate-100">
                      <span className="font-semibold">Censo Asignado:</span>
                      <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        {prog.totalCenso.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>

                  {/* 3/4 DERECHA: 12 CELDAS DE MESES (ENCUADRE PERFECTO SIN SOLAPAMIENTO) */}
                  <div className="col-span-9 grid grid-cols-12 divide-x divide-slate-100">
                    {MESES_TITULOS.map((mes) => {
                      const countInMonth = prog.scheduledPattern[mes.id - 1] || 0;
                      const milestone = prog.milestones[mes.id - 1] || prog.milestones[0];
                      const monthCampaigns = progCampaigns.filter(c => c.startMonth === mes.id);

                      return (
                        <div
                          key={mes.id}
                          onClick={() => handleCellClick(prog.id, mes.id)}
                          className={`p-1.5 flex flex-col justify-between transition-all duration-150 cursor-pointer group/cell relative border-b border-transparent hover:border-teal-500 hover:bg-teal-50/40 min-h-[92px] ${prog.lightBg}`}
                          title={`Clic para ver cohort o lanzar campaña de ${prog.nombre} en ${mes.nombre}`}
                        >
                          {/* 1. Conteo de Pacientes */}
                          <div className="flex items-center justify-between text-left">
                            <span className="text-[11px] font-black text-slate-900 tracking-tight leading-none">
                              {countInMonth.toLocaleString('es-CO')}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                              pac.
                            </span>
                          </div>

                          {/* 2. Badge Inamovible de la Resolución 3280 (Nítido y sin solapamiento) */}
                          <div className={`my-1 p-1 rounded-md border text-[9px] font-bold leading-tight line-clamp-2 ${prog.badgeColor}`}>
                            <span className="font-black block text-[8px] opacity-80">
                              📞 {milestone.label}
                            </span>
                            <span className="text-[8px] font-semibold block truncate">
                              {milestone.edadTarget}
                            </span>
                          </div>

                          {/* 3. Campañas Activas (si existen) */}
                          {monthCampaigns.length > 0 ? (
                            <div className="mt-auto px-1 py-0.5 rounded bg-indigo-600 text-white text-[8px] font-black truncate shadow-2xs flex items-center gap-0.5">
                              <Sparkles className="w-2 h-2 shrink-0" />
                              <span className="truncate">{monthCampaigns[0].nombre}</span>
                            </div>
                          ) : (
                            <div className="mt-auto flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                              <span className="text-[8px] font-black text-teal-700 bg-white/90 px-1 py-0.2 rounded border border-teal-200">
                                + Campaña
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* PIE DE MATRIZ: LEYENDA DEL SISTEMA */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-teal-100 border border-teal-300" />
                <span className="text-[11px] font-medium">Hito Inamovible Resolución 3280</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-indigo-600" />
                <span className="text-[11px] font-medium">Campaña Agendada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-700 bg-slate-200 px-1.5 rounded">
                  Rate Limit
                </span>
                <span className="text-[11px] text-slate-500">32 llamadas / 30 minutos</span>
              </div>
            </div>

            <span className="text-[11px] text-slate-500 italic">
              * Haz clic en cualquier celda para lanzar una campaña o abrir el cohort de pacientes con historias clínicas.
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: CRONOGRAMA DEDICADO POR CURSO DE VIDA (A a J)                    */}
      {/* ========================================================================= */}
      {activeViewMode !== 'general' && selectedProgramForDedicatedView && (
        <div className="space-y-4">
          {/* Cabecera del Curso de Vida Seleccionado */}
          <div className={`p-5 rounded-2xl border ${selectedProgramForDedicatedView.lightBg} ${selectedProgramForDedicatedView.borderColor} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
            <div className="flex items-start gap-3.5">
              <div className={`w-12 h-12 rounded-2xl text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md ${selectedProgramForDedicatedView.color}`}>
                {selectedProgramForDedicatedView.id}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Cronograma Clínico Específico • Curso de Vida {selectedProgramForDedicatedView.id}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200">
                    {selectedProgramForDedicatedView.rango}
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-0.5">
                  {selectedProgramForDedicatedView.nombre}
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  {selectedProgramForDedicatedView.descripcion}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Población Censo</span>
                <span className="text-base font-black text-slate-900">{selectedProgramForDedicatedView.totalCenso.toLocaleString('es-CO')}</span>
              </div>

              <Button
                onClick={() => setActiveViewMode('general')}
                variant="outline"
                className="rounded-xl text-xs font-bold gap-1.5 h-11"
              >
                <ChevronLeft className="w-4 h-4" />
                Volver a Matriz
              </Button>
            </div>
          </div>

          {/* Cuadrícula de 12 Meses Detallados del Curso de Vida */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {MESES_TITULOS.map((mes) => {
              const countInMonth = selectedProgramForDedicatedView.scheduledPattern[mes.id - 1] || 0;
              const milestone = selectedProgramForDedicatedView.milestones[mes.id - 1];
              const monthData = dedicatedMonthData[mes.id];
              const patientsSample = monthData?.data || [];

              return (
                <div
                  key={mes.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between hover:border-teal-500 transition-all space-y-3"
                >
                  {/* Encabezado del Mes */}
                  <div className="border-b border-slate-100 pb-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-900 text-white">
                        {mes.label} • {mes.nombre}
                      </span>
                      <span className="text-xs font-black text-slate-800">
                        {countInMonth.toLocaleString('es-CO')} <span className="text-[10px] text-slate-400 font-normal">pac.</span>
                      </span>
                    </div>

                    {/* Hito Inamovible Res. 3280 */}
                    <div className={`mt-2 p-2 rounded-xl border ${selectedProgramForDedicatedView.badgeColor}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-teal-800 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Hito Inamovible 3280:
                        </span>
                        <span className="text-[9px] font-mono font-bold text-slate-500">
                          CUPS: {milestone.cups}
                        </span>
                      </div>
                      <h5 className="text-xs font-black text-slate-900 mt-1 leading-tight">
                        {milestone.hito}
                      </h5>
                      <span className="text-[10px] font-bold text-teal-900 block mt-1">
                        Edad Objetivo: {milestone.edadTarget}
                      </span>
                    </div>
                  </div>

                  {/* Lista de Pacientes Programados en este Mes para este Hito */}
                  <div className="space-y-1.5 flex-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                      Llamadas Obligatorias Programadas:
                    </span>

                    {loadingDedicated ? (
                      <div className="text-center py-4 text-xs text-slate-400">
                        Cargando registros clínicos...
                      </div>
                    ) : patientsSample.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-400">
                        No hay llamadas registradas.
                      </div>
                    ) : (
                      patientsSample.slice(0, 3).map((pt) => (
                        <div
                          key={pt.id}
                          className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-teal-50/50 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <button
                              onClick={() => handleOpenPatientDetails(pt)}
                              className="text-xs font-black text-slate-900 hover:text-teal-700 truncate block text-left"
                            >
                              {pt.nombre}
                            </button>
                            <span className="text-[10px] text-slate-500 font-medium block">
                              {pt.edadTexto} • {pt.telefono}
                            </span>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleCallPatientPuerto22(pt)}
                            disabled={isCallingPatient}
                            className="h-7 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] gap-1 shrink-0"
                            title="Llamar directamente por Puerto 22"
                          >
                            <Phone className="w-3 h-3" />
                            Llamar
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Botón de Acción Rápida: Lanzar Campaña o Abrir Cohort Completo */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCellClick(selectedProgramForDedicatedView.id, mes.id)}
                      className="w-full rounded-xl text-xs font-bold text-teal-800 border-teal-200 hover:bg-teal-50 h-8 gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Lanzar Campaña / Ver Todos ({countInMonth.toLocaleString('es-CO')})
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DESPLEGABLE: WIZARD DE CAMPAÑA (PASOS 1 A 4) & EXPLORADOR COHORT   */}
      {/* ========================================================================= */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border-none shadow-2xl">
          {selectedCell && (
            <div className="flex flex-col h-full bg-white">
              {/* CABECERA DEL MODAL */}
              <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-500 text-white uppercase tracking-wider">
                      {selectedCell.programa.id}. {selectedCell.programa.nombre}
                    </span>
                    <span className="text-xs text-slate-300 font-semibold">
                      • {selectedCell.mes.nombre} {selectedYear}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">
                    Gestor de Campañas & Cohort Res. 3280
                  </h3>
                  <p className="text-xs text-teal-200 mt-0.5">
                    Hito Inamovible: <strong>{selectedCell.milestone?.hito}</strong> ({selectedCell.milestone?.edadTarget})
                  </p>
                </div>

                {/* Pestañas de Alternancia: Wizard vs Pacientes */}
                <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setActiveModalTab('campaign_wizard')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeModalTab === 'campaign_wizard'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Lanzar Campaña
                  </button>
                  <button
                    onClick={() => setActiveModalTab('patients_cohort')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeModalTab === 'patients_cohort'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Ver Pacientes ({cohortPatients.length})
                  </button>
                </div>
              </div>

              {/* CONTENIDO 1: WIZARD DE CAMPAÑA DE 4 PASOS */}
              {activeModalTab === 'campaign_wizard' && (
                <div className="p-6 space-y-6">
                  {/* BARRA DE PROGRESO DE 4 PASOS */}
                  <div className="grid grid-cols-4 gap-2 border-b border-slate-100 pb-4">
                    {[
                      { step: 1, label: '1. Riesgo Priorizado' },
                      { step: 2, label: '2. Canales' },
                      { step: 3, label: '3. Lanzamiento' },
                      { step: 4, label: '4. Mensaje & Frecuencia' }
                    ].map(s => (
                      <button
                        key={s.step}
                        onClick={() => setWizardStep(s.step)}
                        className={`text-left p-2 rounded-xl transition-all ${
                          wizardStep === s.step
                            ? 'bg-teal-50 border border-teal-200'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className={`block text-[10px] font-black uppercase ${
                          wizardStep === s.step ? 'text-teal-700' : 'text-slate-400'
                        }`}>
                          Paso {s.step}
                        </span>
                        <span className={`text-xs font-bold truncate block ${
                          wizardStep === s.step ? 'text-teal-950 font-black' : 'text-slate-600'
                        }`}>
                          {s.label.split('. ')[1]}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* PASO 1: GRUPOS DE RIESGO PRIORIZADOS (7 OPCIONES) */}
                  {wizardStep === 1 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                          Seleccione el Grupo de Riesgo Priorizado
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Escoja la condición clínica o factor de riesgo que focalizará la intervención según la Resolución 3280.
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        {GRUPOS_RIESGO_PRIORIZADOS.map((rg) => {
                          const isSelected = selectedRiskGroup.id === rg.id;
                          return (
                            <div
                              key={rg.id}
                              onClick={() => setSelectedRiskGroup(rg)}
                              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                                isSelected
                                  ? 'border-teal-600 bg-teal-50/70 shadow-xs'
                                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                                isSelected ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300'
                              }`}>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </div>
                              <div className="min-w-0">
                                <strong className="text-xs font-black text-slate-900 block">
                                  {rg.id}. {rg.titulo}
                                </strong>
                                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                  {rg.descripcion}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-end pt-3">
                        <Button
                          onClick={() => setWizardStep(2)}
                          className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold gap-2 text-xs"
                        >
                          Continuar a Canales
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* PASO 2: CANALES (SMS, EMAIL, LLAMADA, WHATSAPP) */}
                  {wizardStep === 2 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                          Seleccione los Canales de Comunicación
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Medios por los cuales se contactará a la población priorizada.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* 1. SMS */}
                        <div
                          onClick={() => setSelectedChannels(p => ({ ...p, sms: !p.sms }))}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                            selectedChannels.sms ? 'border-teal-600 bg-teal-50/70' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            selectedChannels.sms ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300'
                          }`}>
                            {selectedChannels.sms && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <strong className="text-xs font-black text-slate-900 block flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                              1. SMS (Mensajes de Texto)
                            </strong>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Envío masivo con confirmación numérica mediante modem OpenVox GSM.
                            </p>
                          </div>
                        </div>

                        {/* 2. EMAIL */}
                        <div
                          onClick={() => setSelectedChannels(p => ({ ...p, email: !p.email }))}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                            selectedChannels.email ? 'border-teal-600 bg-teal-50/70' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            selectedChannels.email ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300'
                          }`}>
                            {selectedChannels.email && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <strong className="text-xs font-black text-slate-900 block flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-teal-600" />
                              2. EMAIL (Correo Electrónico)
                            </strong>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Citación formal hospitalaria con enlace de confirmación y folleto educativo.
                            </p>
                          </div>
                        </div>

                        {/* 3. LLAMADA */}
                        <div
                          onClick={() => setSelectedChannels(p => ({ ...p, call: !p.call }))}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                            selectedChannels.call ? 'border-emerald-600 bg-emerald-50/70' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            selectedChannels.call ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                          }`}>
                            {selectedChannels.call && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <strong className="text-xs font-black text-emerald-900 block flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              3. LLAMADA (Voz Agente IA - Puerto 22)
                            </strong>
                            <p className="text-[11px] text-emerald-800/80 mt-0.5">
                              Llamada bidireccional inteligente vía OpenVox Puerto 22 con protocolo Res. 3280.
                            </p>
                          </div>
                        </div>

                        {/* 4. WHATSAPP */}
                        <div
                          onClick={() => setSelectedChannels(p => ({ ...p, whatsapp: !p.whatsapp }))}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                            selectedChannels.whatsapp ? 'border-teal-600 bg-teal-50/70' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            selectedChannels.whatsapp ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300'
                          }`}>
                            {selectedChannels.whatsapp && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <strong className="text-xs font-black text-slate-900 block flex items-center gap-1.5">
                              <Send className="w-3.5 h-3.5 text-teal-600" />
                              4. WHATSAPP (Canal Verificado)
                            </strong>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Mensajes con botones interactivos y recordatorios multimedia oficiales.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between pt-3">
                        <Button
                          variant="outline"
                          onClick={() => setWizardStep(1)}
                          className="rounded-xl text-xs font-bold"
                        >
                          Volver al Paso 1
                        </Button>
                        <Button
                          onClick={() => setWizardStep(3)}
                          className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold gap-2 text-xs"
                        >
                          Continuar a Lanzamiento
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* PASO 3: NOMBRE, FECHA (>= MAÑANA), HORA Y DURACIÓN */}
                  {wizardStep === 3 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                          Parámetros de Campaña y Lanzamiento
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Asigne el nombre reutilizable y programe la fecha de emisión (debe ser al menos en el día siguiente).
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">
                          Nombre de la Campaña (Se guardará en la sección de Campañas):
                        </label>
                        <input
                          type="text"
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value)}
                          placeholder="Ej: Campaña Hipertensión y Cáncer de Mama - Mayo 2026"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-amber-900 leading-relaxed">
                          <strong>Regla del Sistema de Marcación:</strong> Bajo el régimen de 32 llamadas por cada 30 minutos, las campañas deben programarse <strong>al menos para el día siguiente</strong>. No se admiten fechas pasadas ni el día actual para garantizar la calibración del enlace GSM.
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">
                            Fecha de Lanzamiento:
                          </label>
                          <input
                            type="date"
                            min={tomorrowStr}
                            value={launchDate}
                            onChange={(e) => setLaunchDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">
                            Hora de Lanzamiento:
                          </label>
                          <input
                            type="time"
                            value={launchTime}
                            onChange={(e) => setLaunchTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">
                            Duración Estimada:
                          </label>
                          <select
                            value={campaignDurationHours}
                            onChange={(e) => setCampaignDurationHours(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                          >
                            <option value={4}>4 Horas (Tanda Rápida)</option>
                            <option value={8}>8 Horas (Jornada Diaria)</option>
                            <option value={24}>24 Horas (Ciclo Completo)</option>
                            <option value={48}>48 Horas (2 Días)</option>
                            <option value={72}>72 Horas (3 Días)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-between pt-3">
                        <Button
                          variant="outline"
                          onClick={() => setWizardStep(2)}
                          className="rounded-xl text-xs font-bold"
                        >
                          Volver a Canales
                        </Button>
                        <Button
                          onClick={() => setWizardStep(4)}
                          className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold gap-2 text-xs"
                        >
                          Continuar a Mensaje & Frecuencia
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* PASO 4: TIPO DE MENSAJE, ETIQUETAS, TEXTO Y FRECUENCIA */}
                  {wizardStep === 4 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                          Detalles del Mensaje, Etiquetas y Frecuencia
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Redacte el mensaje o guión del Agente IA y defina la política de reintentos.
                        </p>
                      </div>

                      <div className="flex items-center gap-4 p-2 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-xs font-bold text-slate-700 pl-2">Tipo de Mensaje:</span>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                          <input
                            type="radio"
                            name="msgType"
                            checked={messageType === 'general'}
                            onChange={() => setMessageType('general')}
                            className="text-teal-600"
                          />
                          General (Texto Estándar)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-teal-900">
                          <input
                            type="radio"
                            name="msgType"
                            checked={messageType === 'personalizado'}
                            onChange={() => setMessageType('personalizado')}
                            className="text-teal-600"
                          />
                          Personalizado (Con Etiquetas de Paciente)
                        </label>
                      </div>

                      {messageType === 'personalizado' && (
                        <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-teal-900 flex items-center gap-1">
                              <Tag className="w-3.5 h-3.5 text-teal-600" />
                              Barra de Etiquetas Dinámicas (Haz clic para insertar):
                            </span>
                            <span className="text-[10px] text-teal-700 font-medium">
                              Se reemplazarán con datos del ERP
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {[
                              { label: '{nombre}', desc: 'Nombre de pila' },
                              { label: '{apellido}', desc: 'Primer apellido' },
                              { label: '{cedula}', desc: 'Documento' },
                              { label: '{telefono}', desc: 'Número celular' },
                              { label: '{edad}', desc: 'Edad en años' },
                              { label: '{programa}', desc: 'Programa 3280' },
                              { label: '{fecha_cita}', desc: 'Fecha asignada' }
                            ].map((t) => (
                              <button
                                key={t.label}
                                type="button"
                                onClick={() => handleInsertTag(t.label)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-teal-300 text-teal-800 hover:bg-teal-600 hover:text-white font-mono text-xs font-bold transition-colors shadow-2xs"
                                title={t.desc}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">
                          Contenido del Mensaje / Guión del Agente IA:
                        </label>
                        <textarea
                          ref={textareaRef}
                          rows={4}
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          placeholder="Escriba aquí el mensaje o diálogo que transmitirá el agente..."
                          className="w-full p-3 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 font-sans leading-relaxed"
                        />
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                        <span className="text-xs font-black text-slate-900 uppercase block tracking-wider">
                          Frecuencia de Contacto y Reintentos
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700 block">
                              Frecuencia de Marcación:
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {['diaria', 'semanal', 'mensual'].map((f) => (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => setFrequency(f)}
                                  className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all ${
                                    frequency === f
                                      ? 'bg-teal-600 text-white shadow-xs'
                                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700 block">
                              Corregir veces al día (Reintentos):
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={retriesPerDay}
                                onChange={(e) => setRetriesPerDay(Math.max(1, Math.min(10, Number(e.target.value))))}
                                className="w-20 px-3 py-2 rounded-xl border border-slate-300 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                              />
                              <span className="text-xs text-slate-500">
                                intentos diarios si no contesta
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <Button
                          variant="outline"
                          onClick={() => setWizardStep(3)}
                          className="rounded-xl text-xs font-bold"
                        >
                          Volver a Parámetros
                        </Button>

                        <Button
                          onClick={handleLaunchCampaign}
                          disabled={isSubmittingCampaign}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-2 px-5 shadow-sm"
                        >
                          <Send className="w-4 h-4" />
                          {isSubmittingCampaign ? 'Agendando Campaña...' : 'Confirmar & Lanzar Campaña'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CONTENIDO 2: EXPLORADOR DE PACIENTES DEL COHORT */}
              {activeModalTab === 'patients_cohort' && (
                <div className="p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, documento o teléfono..."
                        value={cohortSearch}
                        onChange={(e) => setCohortSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={cohortStatusFilter}
                        onChange={(e) => setCohortStatusFilter(e.target.value)}
                        className="text-xs rounded-lg border border-slate-200 py-2 px-2.5 bg-white font-medium"
                      >
                        <option value="todos">Todos los Estados</option>
                        <option value="en_tratamiento">En Tratamiento Activo</option>
                        <option value="cita_confirmada">Cita Confirmada</option>
                        <option value="pendiente_tamizaje">Pendiente Tamizaje</option>
                        <option value="control_al_dia">Control al Día</option>
                      </select>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCohortPage(1);
                          setCohortSearch('');
                          setCohortStatusFilter('todos');
                        }}
                        className="rounded-lg text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Tabla de Pacientes */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Paciente & Cédula</th>
                          <th className="p-3">Teléfono / Ciudad</th>
                          <th className="p-3">Edad & Cursos de Vida</th>
                          <th className="p-3">Estado Tratamiento</th>
                          <th className="p-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingCohort ? (
                          <tr>
                            <td colSpan={5} className="text-center p-8 text-slate-400">
                              Cargando registros del censo...
                            </td>
                          </tr>
                        ) : cohortPatients.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center p-8 text-slate-400">
                              No se encontraron pacientes para este filtro.
                            </td>
                          </tr>
                        ) : (
                          cohortPatients.map((pt) => (
                            <tr key={pt.id} className="hover:bg-teal-50/40 transition-colors">
                              <td className="p-3">
                                <button
                                  onClick={() => handleOpenPatientDetails(pt)}
                                  className="font-bold text-teal-700 hover:underline text-left block"
                                >
                                  {pt.nombre}
                                </button>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  CC: {pt.documento}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="font-mono text-slate-700">{pt.telefono}</div>
                                <div className="text-[10px] text-slate-400">{pt.ciudad}</div>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-800">{pt.edadTexto || `${pt.edad} años`} ({pt.genero})</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {pt.grupos.map((g) => (
                                    <span
                                      key={g.id}
                                      className="px-1.5 py-0.2 rounded text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200"
                                      title={g.nombre}
                                    >
                                      {g.id}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${pt.estadoTratamiento.color}`}>
                                  {pt.estadoTratamiento.label}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenPatientDetails(pt)}
                                    className="rounded-lg text-[11px] font-bold h-7 gap-1"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Ver Ficha
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleCallPatientPuerto22(pt)}
                                    disabled={isCallingPatient}
                                    className="rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-7 gap-1"
                                    title="Llamar directamente por Puerto 22"
                                  >
                                    <Phone className="w-3 h-3" />
                                    Llamar
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                    <span>
                      Página <strong>{cohortPage}</strong> de <strong>{cohortTotalPages}</strong>
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCohortPage(p => Math.max(1, p - 1))}
                        disabled={cohortPage <= 1}
                        className="rounded-lg h-7 px-2"
                      >
                        Anterior
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCohortPage(p => Math.min(cohortTotalPages, p + 1))}
                        disabled={cohortPage >= cohortTotalPages}
                        className="rounded-lg h-7 px-2"
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL SECUNDARIO: FICHA CLÍNICA RES. 3280 DEL PACIENTE                   */}
      {/* ========================================================================= */}
      <Dialog open={isPatientModalOpen} onOpenChange={setIsPatientModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-5 rounded-2xl">
          {selectedPatient && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-100 text-teal-800 border border-teal-200">
                    Ficha Clínica Oficial 3280
                  </span>
                  <span className="text-xs text-slate-500">• {selectedPatient.eps}</span>
                </div>
                <DialogTitle className="text-lg font-black text-slate-900 mt-1">
                  {selectedPatient.nombre}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Documento: <strong>CC {selectedPatient.documento}</strong> • Tel: {selectedPatient.telefono} • {selectedPatient.edadTexto || `${selectedPatient.edad} años`} ({selectedPatient.genero})
                </DialogDescription>
              </DialogHeader>

              {/* Grupos a los que pertenece congruentemente */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  Cursos de Vida y Programas Res. 3280 Asignados:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {selectedPatient.grupos.map((g) => (
                    <div
                      key={g.id}
                      className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2"
                    >
                      <div className={`w-5 h-5 rounded text-white font-black text-[10px] flex items-center justify-center shrink-0 ${g.color}`}>
                        {g.id}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-900 block truncate">
                          {g.id}. {g.nombre}
                        </span>
                        <span className="text-[9px] text-slate-400 block truncate">
                          {g.rango}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historia Clínica */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Motivo de Ruta e Hito Asignado:</span>
                  <p className="font-semibold text-slate-800">{selectedPatient.historiaClinica.motivoConsulta}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Edad Objetivo:</span>
                    <span className="font-bold text-slate-800">{selectedPatient.historiaClinica.edadTarget}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Código CUPS Oficial:</span>
                    <span className="font-mono font-bold text-teal-800">{selectedPatient.historiaClinica.codigoCups}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Antecedentes Médicos:</span>
                  <p className="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">{selectedPatient.historiaClinica.antecedentes}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
                      Tamizajes Cumplidos:
                    </span>
                    <ul className="list-disc list-inside text-emerald-900 text-[11px] space-y-0.5">
                      {selectedPatient.historiaClinica.tamizajesCumplidos.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                    <span className="text-[10px] font-bold text-amber-800 uppercase block mb-1">
                      Tamizajes Pendientes 3280:
                    </span>
                    <ul className="list-disc list-inside text-amber-900 text-[11px] space-y-0.5">
                      {selectedPatient.historiaClinica.tamizajesPendientes.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Notas de Evolución Médica:</span>
                  <p className="text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                    "{selectedPatient.historiaClinica.notasEvolucion}"
                  </p>
                </div>
              </div>

              {/* Botón de Llamada Puerto 22 */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setIsPatientModalOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cerrar
                </Button>
                <Button
                  onClick={() => handleCallPatientPuerto22(selectedPatient)}
                  disabled={isCallingPatient}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
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
