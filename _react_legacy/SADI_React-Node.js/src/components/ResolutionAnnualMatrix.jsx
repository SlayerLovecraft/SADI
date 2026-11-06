// ==============================================================================
// ResolutionAnnualMatrix.jsx - CRONOGRAMA ANUAL RESOLUCIÓN 3280 (1/4 + 3/4)
// - Estructura estipulada exactamente en el boceto a mano del usuario:
//   * 1/4 Izquierda (25% ancho): Lista de 10 Cursos de Vida (A a J) bajo la Resolución 3280
//   * 3/4 Derecha (75% ancho): 12 Columnas mensuales (Mes 1 a Mes 12 / Ene a Dic)
// - Celdas clickeables que abren el Wizard de Campaña de 4 Pasos:
//   1. Grupos de Riesgo Priorizados (1 a 7)
//   2. Canales (SMS, EMAIL, LLAMADA, WHATSAPP)
//   3. Nombre de Campaña, Fecha de Lanzamiento (>= día siguiente), Hora y Duración
//   4. Tipo de Mensaje (General vs Personalizado con barra de etiquetas), Texto y Frecuencia
// - Exploración de Pacientes del Cohort (Censo 400.000) y Ficha Clínica individual Res. 3280
// - Barras visuales de campañas activas en la cuadrícula
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
  Tag, Info, Zap, AlertTriangle
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

  // Datos del cohort desplegado
  const [cohortPatients, setCohortPatients] = useState([]);
  const [loadingCohort, setLoadingCohort] = useState(false);
  const [cohortTotal, setCohortTotal] = useState(0);
  const [cohortPage, setCohortPage] = useState(1);
  const [cohortTotalPages, setCohortTotalPages] = useState(1);
  const [cohortSearch, setCohortSearch] = useState('');
  const [cohortStatusFilter, setCohortStatusFilter] = useState('todos');

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
        // Transformar campañas a barras visuales
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

  // Al hacer clic en una celda (Intersección Programa A-J x Mes 1-12)
  const handleCellClick = (programId, monthIndex) => {
    const prog = PROGRAMAS_3280.find(p => p.id === programId);
    const mes = MESES_TITULOS.find(m => m.id === monthIndex);
    
    setSelectedCell({
      programId,
      monthIndex,
      programa: prog,
      mes: mes
    });

    // Resetear Wizard al paso 1
    setWizardStep(1);
    setActiveModalTab('campaign_wizard');
    setSelectedRiskGroup(GRUPOS_RIESGO_PRIORIZADOS[0]);
    setSelectedChannels({ sms: false, email: false, call: true, whatsapp: false });
    
    // Nombre sugerido acorde al boceto
    setCampaignName(`Campaña ${prog?.nombre} - ${mes?.nombre} ${selectedYear}`);
    
    // Fecha sugerida: mínimo mañana
    const dTomorrow = new Date();
    dTomorrow.setDate(dTomorrow.getDate() + 1);
    // Ajustar mes si es posible
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    if (monthIndex >= currentMonth && selectedYear === currentYear) {
      setLaunchDate(dTomorrow.toISOString().split('T')[0]);
    } else {
      const padM = String(monthIndex).padStart(2, '0');
      setLaunchDate(`${selectedYear}-${padM}-05`);
    }

    setMessageType('personalizado');
    setMessageContent(`Hola {nombre}, le informamos desde el Hospital SADI que en el marco de la resolución treintaidos ochenta, del dos mil dieciocho, le corresponde su atención obligatoria en el programa de ${prog?.nombre}. Por favor confirme su asistencia marcando 1.`);
    setFrequency('diaria');
    setRetriesPerDay(1);

    // Cargar pacientes
    setCohortPage(1);
    setCohortSearch('');
    setCohortStatusFilter('todos');
    setIsModalOpen(true);
  };

  // Cargar pacientes del cohort cuando cambia la pestaña o la celda
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
    // Restaurar foco y cursor
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

    // Validar fecha de lanzamiento >= mañana
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

    // Validar canales
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

      // Agregar barra visual inmediatamente
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
        title: '¡Campaña Agendada y Guardada!',
        description: `La campaña "${campaignName}" fue programada para el ${launchDate} a las ${launchTime}. Registrada en Campañas e Interacciones.`,
        className: 'bg-emerald-600 text-white'
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
        title: 'Iniciando llamada por Puerto 22...',
        description: `Marcando a ${patient.nombre} (${patient.telefono}) vía OpenVox GSM.`,
      });

      const res = await vapiIntegrationService.startDirectOutboundCall({
        phoneNumber: patient.telefono,
        patientName: patient.nombre,
        patientCedula: patient.documento,
        address: patient.direccion,
        appointmentType: patient.programaActual?.nombre || 'Resolución 3280',
        appointmentDate: patient.fechaProgramada,
        appointmentTime: patient.horaProgramada
      });

      if (res.success) {
        toast({
          title: 'Llamada conectada en Puerto 22',
          description: `ID: ${res.callId}. El agente IA está ejecutando el protocolo 3280.`,
          className: 'bg-emerald-600 text-white'
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

  return (
    <div className="w-full flex flex-col gap-4">
      {/* BARRA SUPERIOR: ENCABEZADO Y ACCIONES DE AÑO / EXCEL */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
              Censo Oficial Activo
            </span>
            <span className="text-xs text-gray-500 font-semibold">
              • 400.000 Pacientes Distribuidos
            </span>
          </div>
          <h2 className="text-xl font-black text-gray-900 mt-1 flex items-center gap-2">
            Cronograma Anual de Demanda Inducida
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
              Año {selectedYear}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Intersección de 10 Cursos de Vida (A a J) con los 12 Meses. Haz clic en cualquier celda para desplegar el lanzador de campañas o explorar los pacientes programados.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => onYearChange(selectedYear - 1)}
              className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition-colors"
              title="Año Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-black text-gray-800">
              {selectedYear}
            </span>
            <button
              onClick={() => onYearChange(selectedYear + 1)}
              className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition-colors"
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
      {/* CONTENEDOR PRINCIPAL: CAJA QUE CUBRE LA PANTALLA (1/4 IZQ + 3/4 DER)     */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden flex flex-col">
        {/* ENCABEZADO DE LA MATRIZ: 1/4 TÍTULO + 3/4 MESES */}
        <div className="grid grid-cols-12 border-b border-gray-200 bg-slate-900 text-white">
          {/* 1/4 Izquierda (3 columnas de 12 = 25%) */}
          <div className="col-span-3 p-3.5 border-r border-slate-700/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold tracking-wider text-blue-400 uppercase block">
                Cursos de Vida
              </span>
              <h3 className="text-sm font-black text-white tracking-tight">
                Resolución 3280
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              10 Items (A - J)
            </span>
          </div>

          {/* 3/4 Derecha (9 columnas de 12 = 75%): Dividido en los 12 meses */}
          <div className="col-span-9 grid grid-cols-12 divide-x divide-slate-800 text-center">
            {MESES_TITULOS.map((mes) => (
              <div key={mes.id} className="py-2.5 px-1 bg-slate-900 flex flex-col justify-center">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">
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
        <div className="divide-y divide-gray-200">
          {PROGRAMAS_3280.map((prog) => {
            // Campañas asignadas a este programa
            const progCampaigns = campaignList.filter(c => c.programaId === prog.id);

            return (
              <div 
                key={prog.id} 
                className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors group relative"
              >
                {/* 1/4 IZQUIERDA: INFORMACIÓN DEL CURSO DE VIDA (ITEM A - J) */}
                <div className="col-span-3 p-3 border-r border-gray-200 bg-white flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs ${prog.color}`}>
                        {prog.id}
                      </div>
                      <h4 className="text-xs font-black text-gray-900 truncate">
                        {prog.id}. {prog.nombre}
                      </h4>
                    </div>
                    <p className="text-[11px] text-gray-500 font-medium mt-1 line-clamp-1">
                      {prog.rango}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-2 pt-1 border-t border-gray-100">
                    <span className="font-semibold">Censo Asignado:</span>
                    <span className="font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                      {prog.totalCenso.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>

                {/* 3/4 DERECHA: 12 CELDAS DE MESES (CLICKABLES) + BARRAS DE CAMPAÑA */}
                <div className="col-span-9 grid grid-cols-12 divide-x divide-gray-100 relative min-h-[72px]">
                  {MESES_TITULOS.map((mes) => {
                    const countInMonth = prog.scheduledPattern[mes.id - 1] || 0;

                    return (
                      <button
                        key={mes.id}
                        onClick={() => handleCellClick(prog.id, mes.id)}
                        className="p-1 flex flex-col items-center justify-center text-center transition-all duration-150 hover:bg-blue-50/80 group/cell relative focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        title={`Clic para crear campaña o ver cohort de ${prog.nombre} en ${mes.nombre} (${countInMonth.toLocaleString('es-CO')} pacientes)`}
                      >
                        {/* Conteo de Pacientes */}
                        <span className="text-[11px] font-black text-gray-700 group-hover/cell:text-blue-700">
                          {countInMonth.toLocaleString('es-CO')}
                        </span>
                        <span className="text-[9px] font-semibold text-gray-400 group-hover/cell:text-blue-500">
                          pacientes
                        </span>

                        {/* Indicador de acción al pasar el ratón */}
                        <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover/cell:opacity-100 rounded transition-opacity flex items-center justify-center pointer-events-none">
                          <Plus className="w-4 h-4 text-blue-600 opacity-60" />
                        </div>
                      </button>
                    );
                  })}

                  {/* BARRAS DE CAMPAÑAS ACTIVAS (BOCETO: BARRAS HORIZONTALES CRUZANDO MESES) */}
                  {/* Barra por defecto de la resolución */}
                  {prog.defaultBar && (
                    <div 
                      className="absolute top-1 bottom-1 pointer-events-none rounded-lg bg-blue-500/10 border border-blue-400/30 flex items-center px-2 z-10"
                      style={{
                        left: `${((prog.defaultBar.startMonth - 1) / 12) * 100}%`,
                        width: `${((prog.defaultBar.endMonth - prog.defaultBar.startMonth + 1) / 12) * 100}%`
                      }}
                    >
                      <span className="text-[9px] font-extrabold text-blue-800 uppercase tracking-tight truncate drop-shadow-xs">
                        • {prog.defaultBar.label}
                      </span>
                    </div>
                  )}

                  {/* Campañas dinámicas añadidas */}
                  {progCampaigns.map((camp) => (
                    <div
                      key={camp.id}
                      className="absolute bottom-1.5 h-5 pointer-events-auto rounded-md bg-emerald-600 text-white shadow-xs flex items-center px-2 z-20 cursor-pointer hover:bg-emerald-700 transition-colors"
                      style={{
                        left: `${((camp.startMonth - 1) / 12) * 100 + 1}%`,
                        width: `${Math.max(8, ((camp.endMonth - camp.startMonth + 1) / 12) * 100 - 2)}%`
                      }}
                      onClick={() => handleCellClick(prog.id, camp.startMonth)}
                      title={`Campaña: ${camp.nombre} (${camp.canales.join(', ')})`}
                    >
                      <Sparkles className="w-2.5 h-2.5 mr-1 shrink-0" />
                      <span className="text-[9px] font-black truncate">
                        {camp.nombre}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* PIE DE MATRIZ: LEYENDA DEL SISTEMA */}
        <div className="p-3 bg-slate-50 border-t border-gray-200 flex flex-wrap items-center justify-between text-xs text-gray-600 gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-400/40" />
              <span className="text-[11px] font-medium">Ruta Continua Res. 3280</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-600" />
              <span className="text-[11px] font-medium">Campaña Activa / Agendada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-700 bg-gray-200 px-1.5 rounded">
                Rate Limit
              </span>
              <span className="text-[11px] text-gray-500">32 llamadas / 30 minutos</span>
            </div>
          </div>

          <span className="text-[11px] text-gray-500 italic">
            * Un paciente pertenece congruentemente a múltiples grupos según su edad y condición clínica.
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DESPLEGABLE: WIZARD DE CAMPAÑA (PASOS 1 A 4) & EXPLORADOR COHORT   */}
      {/* ========================================================================= */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border-none shadow-2xl">
          {selectedCell && (
            <div className="flex flex-col h-full bg-white">
              {/* CABECERA DEL MODAL */}
              <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500 text-white uppercase tracking-wider">
                      {selectedCell.programa.id}. {selectedCell.programa.nombre}
                    </span>
                    <span className="text-xs text-slate-300 font-semibold">
                      • {selectedCell.mes.nombre} {selectedYear}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">
                    Gestor de Campañas & Cohort Res. 3280
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Total pacientes objetivo en este mes: <strong>{cohortTotal.toLocaleString('es-CO')}</strong>
                  </p>
                </div>

                {/* Pestañas de Alternancia: Wizard vs Pacientes */}
                <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setActiveModalTab('campaign_wizard')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeModalTab === 'campaign_wizard'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Lanzar Campaña
                  </button>
                  <button
                    onClick={() => setActiveModalTab('patients_cohort')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeModalTab === 'patients_cohort'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Ver Pacientes ({cohortPatients.length})
                  </button>
                </div>
              </div>

              {/* CONTENIDO 1: WIZARD DE CAMPAÑA DE 4 PASOS (ESTIPULADO POR EL USUARIO) */}
              {activeModalTab === 'campaign_wizard' && (
                <div className="p-6 space-y-6">
                  {/* BARRA DE PROGRESO DE 4 PASOS */}
                  <div className="grid grid-cols-4 gap-2 border-b border-gray-100 pb-4">
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
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className={`block text-[10px] font-black uppercase ${
                          wizardStep === s.step ? 'text-blue-700' : 'text-gray-400'
                        }`}>
                          Paso {s.step}
                        </span>
                        <span className={`text-xs font-bold truncate block ${
                          wizardStep === s.step ? 'text-blue-950 font-black' : 'text-gray-600'
                        }`}>
                          {s.label.split('. ')[1]}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* ========================================================= */}
                  {/* PASO 1: GRUPOS DE RIESGO PRIORIZADOS (7 OPCIONES)         */}
                  {/* ========================================================= */}
                  {wizardStep === 1 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                          Seleccione el Grupo de Riesgo Priorizado
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
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
                                  ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                                isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                              }`}>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </div>
                              <div className="min-w-0">
                                <strong className="text-xs font-black text-gray-900 block">
                                  {rg.id}. {rg.titulo}
                                </strong>
                                <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
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
                          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs"
                        >
                          Continuar a Canales
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* PASO 2: CANALES (SMS, EMAIL, LLAMADA, WHATSAPP)           */}
                  {/* ========================================================= */}
                  {wizardStep === 2 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                          Seleccione los Canales de Comunicación
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Medios por los cuales se contactará a la población priorizada.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* 1. SMS */}
                        <div
                          onClick={() => setSelectedChannels(p => ({ ...p, sms: !p.sms }))}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                            selectedChannels.sms ? 'border-blue-600 bg-blue-50/70' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            selectedChannels.sms ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                          }`}>
                            {selectedChannels.sms && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <strong className="text-xs font-black text-gray-900 block flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                              1. SMS (Mensajes de Texto)
                            </strong>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Envío masivo con confirmación numérica mediante modem OpenVox GSM.
                            </p>
                          </div>
                        </div>

                        {/* 2. EMAIL */}
                        <div
                          onClick={() => setSelectedChannels(p => ({ ...p, email: !p.email }))}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                            selectedChannels.email ? 'border-blue-600 bg-blue-50/70' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            selectedChannels.email ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                          }`}>
                            {selectedChannels.email && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <strong className="text-xs font-black text-gray-900 block flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-blue-600" />
                              2. EMAIL (Correo Electrónico)
                            </strong>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Citación formal hospitalaria con enlace de confirmación y folleto educativo.
                            </p>
                          </div>
                        </div>

                        {/* 3. LLAMADA */}
                        <div
                          onClick={() => setSelectedChannels(p => ({ ...p, call: !p.call }))}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                            selectedChannels.call ? 'border-emerald-600 bg-emerald-50/70' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            selectedChannels.call ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300'
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
                            selectedChannels.whatsapp ? 'border-blue-600 bg-blue-50/70' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            selectedChannels.whatsapp ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                          }`}>
                            {selectedChannels.whatsapp && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <strong className="text-xs font-black text-gray-900 block flex items-center gap-1.5">
                              <Send className="w-3.5 h-3.5 text-blue-600" />
                              4. WHATSAPP (Canal Verificado)
                            </strong>
                            <p className="text-[11px] text-gray-500 mt-0.5">
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
                          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs"
                        >
                          Continuar a Lanzamiento
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* PASO 3: NOMBRE, FECHA (>= MAÑANA), HORA Y DURACIÓN        */}
                  {/* ========================================================= */}
                  {wizardStep === 3 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                          Parámetros de Campaña y Lanzamiento
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Asigne el nombre reutilizable y programe la fecha de emisión (debe ser al menos en el día siguiente).
                        </p>
                      </div>

                      {/* Nombre de la Campaña */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 block">
                          Nombre de la Campaña (Se guardará en la sección de Campañas):
                        </label>
                        <input
                          type="text"
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value)}
                          placeholder="Ej: Campaña Hipertensión y Cáncer de Mama - Mayo 2026"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Advertencia del sistema 32 llamadas / 30 minutos */}
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-amber-900 leading-relaxed">
                          <strong>Regla del Sistema de Marcación:</strong> Bajo el régimen de 32 llamadas por cada 30 minutos, las campañas deben programarse <strong>al menos para el día siguiente</strong>. No se admiten fechas pasadas ni el día actual para garantizar la calibración del enlace GSM.
                        </div>
                      </div>

                      {/* Fecha y Hora de Lanzamiento */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-700 block">
                            Fecha de Lanzamiento:
                          </label>
                          <input
                            type="date"
                            min={tomorrowStr}
                            value={launchDate}
                            onChange={(e) => setLaunchDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-700 block">
                            Hora de Lanzamiento:
                          </label>
                          <input
                            type="time"
                            value={launchTime}
                            onChange={(e) => setLaunchTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-700 block">
                            Duración Estimada:
                          </label>
                          <select
                            value={campaignDurationHours}
                            onChange={(e) => setCampaignDurationHours(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs"
                        >
                          Continuar a Mensaje & Frecuencia
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* PASO 4: TIPO DE MENSAJE, ETIQUETAS, TEXTO Y FRECUENCIA    */}
                  {/* ========================================================= */}
                  {wizardStep === 4 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                          Detalles del Mensaje, Etiquetas y Frecuencia
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Redacte el mensaje o guión del Agente IA y defina la política de reintentos.
                        </p>
                      </div>

                      {/* Selector de Tipo de Mensaje */}
                      <div className="flex items-center gap-4 p-2 bg-gray-50 rounded-xl border border-gray-200">
                        <span className="text-xs font-bold text-gray-700 pl-2">Tipo de Mensaje:</span>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                          <input
                            type="radio"
                            name="msgType"
                            checked={messageType === 'general'}
                            onChange={() => setMessageType('general')}
                            className="text-blue-600"
                          />
                          General (Texto Estándar)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-900">
                          <input
                            type="radio"
                            name="msgType"
                            checked={messageType === 'personalizado'}
                            onChange={() => setMessageType('personalizado')}
                            className="text-blue-600"
                          />
                          Personalizado (Con Etiquetas de Paciente)
                        </label>
                      </div>

                      {/* Barra de Etiquetas (Si es Personalizado) */}
                      {messageType === 'personalizado' && (
                        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-blue-900 flex items-center gap-1">
                              <Tag className="w-3.5 h-3.5 text-blue-600" />
                              Barra de Etiquetas Dinámicas (Haz clic para insertar):
                            </span>
                            <span className="text-[10px] text-blue-700 font-medium">
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
                                className="px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-800 hover:bg-blue-600 hover:text-white font-mono text-xs font-bold transition-colors shadow-2xs"
                                title={t.desc}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cuadro de Texto del Mensaje */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 block">
                          Contenido del Mensaje / Guión del Agente IA:
                        </label>
                        <textarea
                          ref={textareaRef}
                          rows={4}
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          placeholder="Escriba aquí el mensaje o diálogo que transmitirá el agente..."
                          className="w-full p-3 rounded-xl border border-gray-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
                        />
                      </div>

                      {/* Configuración de Frecuencia */}
                      <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-3">
                        <span className="text-xs font-black text-gray-900 uppercase block tracking-wider">
                          Frecuencia de Contacto y Reintentos
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-700 block">
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
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                  }`}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-700 block">
                              Corregir veces al día (Reintentos):
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={retriesPerDay}
                                onChange={(e) => setRetriesPerDay(Math.max(1, Math.min(10, Number(e.target.value))))}
                                className="w-20 px-3 py-2 rounded-xl border border-gray-300 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                              <span className="text-xs text-gray-500">
                                intentos diarios si no contesta
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Acciones de Lanzamiento Final */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
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

              {/* CONTENIDO 2: EXPLORADOR DE PACIENTES DEL COHORT (CENSO 400.000) */}
              {activeModalTab === 'patients_cohort' && (
                <div className="p-6 space-y-4">
                  {/* Filtros de Cohort */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, documento o teléfono..."
                        value={cohortSearch}
                        onChange={(e) => setCohortSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={cohortStatusFilter}
                        onChange={(e) => setCohortStatusFilter(e.target.value)}
                        className="text-xs rounded-lg border border-gray-200 py-2 px-2.5 bg-white font-medium"
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
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100/80 text-gray-700 font-bold border-b border-gray-200">
                        <tr>
                          <th className="p-3">Paciente & Cédula</th>
                          <th className="p-3">Teléfono / Ciudad</th>
                          <th className="p-3">Edad & Cursos de Vida</th>
                          <th className="p-3">Estado Tratamiento</th>
                          <th className="p-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {loadingCohort ? (
                          <tr>
                            <td colSpan={5} className="text-center p-8 text-gray-400">
                              Cargando registros del censo...
                            </td>
                          </tr>
                        ) : cohortPatients.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center p-8 text-gray-400">
                              No se encontraron pacientes para este filtro.
                            </td>
                          </tr>
                        ) : (
                          cohortPatients.map((pt) => (
                            <tr key={pt.id} className="hover:bg-blue-50/40 transition-colors">
                              <td className="p-3">
                                <button
                                  onClick={() => handleOpenPatientDetails(pt)}
                                  className="font-bold text-blue-700 hover:underline text-left block"
                                >
                                  {pt.nombre}
                                </button>
                                <span className="text-[11px] text-gray-400 font-mono">
                                  CC: {pt.documento}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="font-mono text-gray-700">{pt.telefono}</div>
                                <div className="text-[10px] text-gray-400">{pt.ciudad}</div>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-gray-800">{pt.edad} años ({pt.genero})</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {pt.grupos.map((g) => (
                                    <span
                                      key={g.id}
                                      className="px-1.5 py-0.2 rounded text-[9px] font-black bg-gray-100 text-gray-700 border border-gray-200"
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
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
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
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                    Ficha Clínica Oficial 3280
                  </span>
                  <span className="text-xs text-gray-500">• {selectedPatient.eps}</span>
                </div>
                <DialogTitle className="text-lg font-black text-gray-900 mt-1">
                  {selectedPatient.nombre}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  Documento: <strong>CC {selectedPatient.documento}</strong> • Tel: {selectedPatient.telefono} • {selectedPatient.edad} años ({selectedPatient.genero})
                </DialogDescription>
              </DialogHeader>

              {/* Grupos a los que pertenece congruentemente */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-2">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">
                  Cursos de Vida y Programas Res. 3280 Asignados:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {selectedPatient.grupos.map((g) => (
                    <div
                      key={g.id}
                      className="p-2 rounded-lg bg-white border border-gray-200 flex items-center gap-2"
                    >
                      <div className={`w-5 h-5 rounded text-white font-black text-[10px] flex items-center justify-center shrink-0 ${g.color}`}>
                        {g.id}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-gray-900 block truncate">
                          {g.id}. {g.nombre}
                        </span>
                        <span className="text-[9px] text-gray-400 block truncate">
                          {g.rango}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historia Clínica */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Motivo de Ruta:</span>
                  <p className="font-semibold text-gray-800">{selectedPatient.historiaClinica.motivoConsulta}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Antecedentes Médicos:</span>
                  <p className="text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">{selectedPatient.historiaClinica.antecedentes}</p>
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
                      Tamizajes Pendientes:
                    </span>
                    <ul className="list-disc list-inside text-amber-900 text-[11px] space-y-0.5">
                      {selectedPatient.historiaClinica.tamizajesPendientes.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Notas Médicas:</span>
                  <p className="text-gray-600 italic bg-gray-50 p-2 rounded-lg border border-gray-100">
                    "{selectedPatient.historiaClinica.notasEvolucion}"
                  </p>
                </div>
              </div>

              {/* Botón de Llamada Puerto 22 */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
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

