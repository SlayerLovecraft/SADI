// ==============================================================================
// ResolutionAnnualMatrix.jsx - CRONOGRAMA ANUAL DUAL SADI
// 1. Cronograma Anual por Cursos de Vida (Res. 3280 de 2018) con iconos SVG dedicados
// 2. Cronograma Anual por Grupos de Riesgo Priorizados con iconos SVG dedicados
// - Conectado exclusivamente a los 56 pacientes REALES de Supabase (sin mocks)
// - Regleta de 365 Días (365 cajones) por ventana clínica y código de colores
// - Limitador de Capacidad GSM: 8:00 AM a 6:00 PM (10h x 350/h = 3.500 llamadas/día)
// - Control de saldo residual y prevención de sobrecarga del Gateway OpenVox
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { 
  PROGRAMAS_3280, 
  MESES_TITULOS, 
  CANALES_DISPONIBLES 
} from '@/services/census400kService';
import { GRUPOS_RIESGO_10 } from '@/services/gruposRiesgoCatalog';
import { getCursoVidaIcon, getGrupoRiesgoIcon } from '@/components/CursosVidaIcons';
import { CURSOS_VIDA_PALETTE, GRUPOS_RIESGO_PALETTE } from '@/services/clinicalPalettes';
import CampaignSchedulingCalendar from '@/components/CampaignSchedulingCalendar';
import { 
  generateAnnualResolutionRoadmap, 
  validateCampaignCallCapacity, 
  generateIndividualClinicalPrompt,
  getPatientCursoVida,
  getPatientGrupoRiesgo,
  getCampaignFilteredPatients,
  DAILY_CALL_CAPACITY,
  OPERATING_HOURS_START,
  OPERATING_HOURS_END 
} from '@/services/callCapacityService';
import { patientService } from '@/services/patientService';
import { telemonitoringService } from '@/services/telemonitoringService';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllowedCursoKeysForUser,
  isCampaignAllowedForUser,
  canonicalizeCursoKey,
  formatCursosVidaLabel,
} from '@/services/cursoVidaConfig';
import { isPatientAssignedToDoctor } from '@/pages/doctor/doctorUtils';
import { 
  Users, Calendar, Phone, Mail, MessageSquare, Send, 
  CheckCircle2, Clock, ChevronRight, X, AlertCircle,
  Activity, Stethoscope, RefreshCw, Download, Sparkles,
  ChevronLeft, ArrowRight, UserCheck, Layers, Eye, Plus,
  Tag, Info, Zap, AlertTriangle, Building2, RotateCcw,
  Gauge, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// Horarios de salida autorizados: 08:00 AM a 06:00 PM (10 Horas Operativas = 350/h = 3.500/día)
const FRANJAS_HORARIAS_10H = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'
];

function ResolutionAnnualMatrix({
  selectedYear = 2026,
  onYearChange = () => {},
  onDownloadExcel = () => {}
}) {
  const { toast } = useToast();
  const { user } = useAuth();

  // Permisos efectivos del usuario por Cursos de Vida (A - J)
  const doctorAccess = useMemo(() => getAllowedCursoKeysForUser(user), [user]);

  // Estados de datos reales
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);

  // Campañas existentes en localStorage para validar aforo acumulado
  const [existingCampaigns, setExistingCampaigns] = useState([]);

  // Navegación entre pestañas de vista del cronograma
  const [activeTab, setActiveTab] = useState('ambos'); // 'ambos' | 'cursos_vida' | 'grupos_riesgo'

  // Modal y Celda seleccionada
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('wizard'); // 'wizard' | 'cohort'
  
  // Origen de la selección:
  // type: 'curso_vida' | 'grupo_riesgo'
  // item: objeto del curso o grupo
  // monthIndex: 0 a 11
  const [selectedContext, setSelectedContext] = useState(null);

  // Estados del Wizard de Campaña (5 Pasos)
  const [wizardStep, setWizardStep] = useState(1);
  const [campaignSchedule, setCampaignSchedule] = useState({
    frequency: 'diario',
    config: {},
    selectedDates: [],
    summary: 'Diario (Lunes a Sábado)'
  });
  const [campaignName, setCampaignName] = useState('');
  const [crossSegmentSelection, setCrossSegmentSelection] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState({
    call: true,
    whatsapp: true,
    sms: false,
    email: false
  });
  const [selectedFranjas, setSelectedFranjas] = useState(['08:00 AM', '09:00 AM', '10:00 AM', '02:00 PM', '04:00 PM']);
  const [retryUntilAnswer, setRetryUntilAnswer] = useState(true);
  const [maxRetries, setMaxRetries] = useState(3);
  const [sedeLugar, setSedeLugar] = useState('Sede Principal - Manizales (Caldas)');
  const [promptDirectriz, setPromptDirectriz] = useState('');

  // 1. Cargar pacientes reales desde Supabase (conservando programa transversal) y campañas previas
  useEffect(() => {
    async function loadInitialData() {
      setLoadingPatients(true);
      try {
        const [res, teleList] = await Promise.all([
          patientService.getAll(),
          telemonitoringService.getPatients().catch(() => [])
        ]);
        const basePatients = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        const telePatients = Array.isArray(teleList) ? teleList : [];

        let mergedPatients = basePatients;
        if (telePatients.length > 0) {
          const baseById = new Map();
          basePatients.forEach((bp) => {
            if (bp?.id) baseById.set(bp.id, bp);
            if (bp?.patient_id) baseById.set(bp.patient_id, bp);
          });
          mergedPatients = telePatients.map((tp) => {
            const bp = baseById.get(tp.id) || baseById.get(tp.patient_id) || {};
            return {
              ...bp,
              ...tp,
              program: tp.program || bp.program || tp.programa || bp.programa || '',
              programa: tp.program || tp.programa || bp.programa || bp.program || '',
              curso_vida: tp.curso_vida || bp.curso_vida || '',
              birthdate: tp.birthdate || bp.birthdate || tp.fecha_nacimiento || bp.fecha_nacimiento,
              fecha_nacimiento: tp.fecha_nacimiento || tp.birthdate || bp.fecha_nacimiento || bp.birthdate
            };
          });
        }
        setPatients(mergedPatients);

        const stored = JSON.parse(localStorage.getItem('sadi_campaigns_v2') || '[]');
        setExistingCampaigns(Array.isArray(stored) ? stored : []);
      } catch (err) {
        console.error('Error cargando datos para cronograma:', err);
        setPatients([]);
      } finally {
        setLoadingPatients(false);
      }
    }
    loadInitialData();

    // Sincronizar campañas en tiempo real si se lanzan o editan
    const handleStorageChange = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('sadi_campaigns_v2') || '[]');
        setExistingCampaigns(Array.isArray(stored) ? stored : []);
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Constantes de Fecha Real
  const CURRENT_REAL_YEAR = 2026;
  const CURRENT_REAL_MONTH = 10; // Noviembre (0 = Ene ... 10 = Nov, 11 = Dic)

  // Año activo (soporta únicamente: 2025 Año Pasado, 2026 Año Actual, 2027 Año Siguiente)
  const [internalYear, setInternalYear] = useState(selectedYear || CURRENT_REAL_YEAR);
  const activeYear = internalYear;

  useEffect(() => {
    if (selectedYear && selectedYear !== internalYear) {
      setInternalYear(selectedYear);
    }
  }, [selectedYear]);

  const handleYearChange = (newYear) => {
    // Restricción del usuario: año actual, pasado o siguiente ("no mas que eso")
    if (newYear < CURRENT_REAL_YEAR - 1 || newYear > CURRENT_REAL_YEAR + 1) return;
    setInternalYear(newYear);
    if (typeof onYearChange === 'function') {
      onYearChange(newYear);
    }
  };

  // Helper para saber si un mes es anterior a la fecha actual (Noviembre 2026)
  const isMonthPast = (year, mIdx) => {
    if (year < CURRENT_REAL_YEAR) return true;
    if (year === CURRENT_REAL_YEAR && mIdx < CURRENT_REAL_MONTH) return true;
    return false;
  };

  // Pacientes, programas y campañas filtrados según Cursos de Vida permitidos al doctor
  const visiblePatients = useMemo(() => {
    if (!doctorAccess.restricted) return patients;
    if (doctorAccess.keys.length === 0) return [];
    return patients.filter(p => isPatientAssignedToDoctor(p, user));
  }, [patients, doctorAccess, user]);

  const visibleProgramas = useMemo(() => {
    if (!doctorAccess.restricted) return PROGRAMAS_3280;
    if (doctorAccess.keys.length === 0) return [];
    return PROGRAMAS_3280.filter(prog => {
      const canon = canonicalizeCursoKey(prog.key || prog.id || prog.nombre);
      return doctorAccess.codeSet.has(prog.id) || (canon && doctorAccess.keySet.has(canon));
    });
  }, [doctorAccess]);

  const visibleCampaigns = useMemo(() => {
    if (!doctorAccess.restricted) return existingCampaigns;
    if (doctorAccess.keys.length === 0) return [];
    return existingCampaigns.filter(c => isCampaignAllowedForUser(c, user));
  }, [existingCampaigns, doctorAccess, user]);

  // 2. Generar la Ruta Anual de 365 días repartiendo por ventana de oportunidad clínica
  const roadmap365 = useMemo(() => {
    return generateAnnualResolutionRoadmap(visiblePatients, activeYear);
  }, [visiblePatients, activeYear]);

  // Modal de Detalle de Día de la Ruta 3280 y Prompt IA
  const [selectedRoadmapDay, setSelectedRoadmapDay] = useState(null);
  const [isRoadmapDayOpen, setIsRoadmapDayOpen] = useState(false);
  const [selectedPromptPatient, setSelectedPromptPatient] = useState(null);

  // Helper: Campañas asociadas a una celda específica (por programa, mes y año)
  const getCellCampaigns = (type, item, monthIndex) => {
    if (!Array.isArray(visibleCampaigns)) return [];
    return visibleCampaigns.filter(c => {
      if (!c) return false;

      // 1. Coincidencia de tipo y programa
      let matchesItem = false;
      if (type === 'curso_vida') {
        const itemKey = canonicalizeCursoKey(item?.key || item?.id || item?.nombre);
        const origKey = c.tipo_origen === 'curso_vida' ? canonicalizeCursoKey(c.origen_id || c.origen_nombre) : null;
        matchesItem =
          (c.tipo_origen === 'curso_vida' && (c.origen_id === item?.id || c.origen_nombre === item?.nombre || (itemKey && origKey === itemKey))) ||
          (Array.isArray(c.segmento_cursos) && c.segmento_cursos.some(seg => seg === item?.nombre || (itemKey && canonicalizeCursoKey(seg) === itemKey)));
      } else {
        matchesItem = (c.tipo_origen === 'grupo_riesgo' && (c.origen_id === item?.id || c.origen_nombre === item?.nombre)) ||
          (Array.isArray(c.segmento_riesgos) && c.segmento_riesgos.includes(item?.nombre));
      }
      if (!matchesItem) return false;

      // 2. Coincidencia de año y mes de forma segura
      const rawDates = Array.isArray(c.fechas_ejecucion)
        ? c.fechas_ejecucion
        : (Array.isArray(c.config_frecuencia?.selectedDates) ? c.config_frecuencia.selectedDates : []);
      const dates = rawDates.filter(d => typeof d === 'string');

      const padM = String(monthIndex + 1).padStart(2, '0');
      const monthPrefix = `${activeYear}-${padM}`;
      const hasDateInMonth = dates.some(d => d.startsWith(monthPrefix));

      const mTitle = typeof MESES_TITULOS[monthIndex] === 'string'
        ? MESES_TITULOS[monthIndex]
        : (MESES_TITULOS[monthIndex]?.nombre || '');

      const matchesYear = Number(c.ano) === Number(activeYear);
      const matchesMonth = c.mes_index === monthIndex ||
        (typeof c.mes_objetivo === 'string' && mTitle && c.mes_objetivo.toLowerCase().startsWith(mTitle.slice(0, 3).toLowerCase()));

      return hasDateInMonth || (matchesYear && matchesMonth);
    });
  };

  // Apertura interactiva del expediente de llamadas del día (Res. 3280 y Campañas)
  const handleOpenDayDetail = (dayData, item = null, type = null) => {
    const iso = dayData.isoDate;
    
    // Filtrar llamadas de resolución si se abre desde una fila específica
    let resCalls = Array.isArray(dayData.callsResolucion) ? dayData.callsResolucion : [];
    if (item && type === 'curso_vida') {
      resCalls = resCalls.filter(c => c.cursoVidaId === item?.id);
    } else if (item && type === 'grupo_riesgo') {
      resCalls = resCalls.filter(c => c.grupoRiesgoId === item?.id);
    }

    // Filtrar campañas que tengan programada esta fecha de forma segura
    let dayCampaigns = (Array.isArray(visibleCampaigns) ? visibleCampaigns : []).filter(c => {
      if (!c) return false;
      const rawDates = Array.isArray(c.fechas_ejecucion)
        ? c.fechas_ejecucion
        : (Array.isArray(c.config_frecuencia?.selectedDates) ? c.config_frecuencia.selectedDates : []);
      if (!rawDates.includes(iso)) return false;
      if (!item) return true;
      if (type === 'curso_vida') {
        const itemKey = canonicalizeCursoKey(item?.key || item?.id || item?.nombre);
        const origKey = c.tipo_origen === 'curso_vida' ? canonicalizeCursoKey(c.origen_id || c.origen_nombre) : null;
        return (c.tipo_origen === 'curso_vida' && (c.origen_id === item?.id || c.origen_nombre === item?.nombre || (itemKey && origKey === itemKey))) ||
          (Array.isArray(c.segmento_cursos) && c.segmento_cursos.some(seg => seg === item?.nombre || (itemKey && canonicalizeCursoKey(seg) === itemKey)));
      } else {
        return (c.tipo_origen === 'grupo_riesgo' && (c.origen_id === item?.id || c.origen_nombre === item?.nombre)) ||
          (Array.isArray(c.segmento_riesgos) && c.segmento_riesgos.includes(item?.nombre));
      }
    });

    setSelectedRoadmapDay({
      ...dayData,
      callsResolucion: resCalls,
      campaigns: dayCampaigns,
      specificItem: item,
      specificType: type
    });
    setSelectedPromptPatient(null);
    setIsRoadmapDayOpen(true);
  };

  // Cache memorizado de los 12 meses de días para evitar recalcular 264 veces por render (8.184 new Date() suprimidos)
  const allMonthsDays = useMemo(() => {
    return Array.from({ length: 12 }, (_, mIdx) => {
      const daysInMonth = new Date(activeYear, mIdx + 1, 0).getDate();
      const days = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const padD = String(d).padStart(2, '0');
        const padM = String(mIdx + 1).padStart(2, '0');
        const iso = `${activeYear}-${padM}-${padD}`;
        const dayData = roadmap365[iso] || {
          isoDate: iso,
          dayIndex: d,
          dayOfMonth: d,
          isSunday: new Date(activeYear, mIdx, d, 12, 0, 0).getDay() === 0,
          callsResolucion: [],
          cursosVidaPresentes: new Set(),
          gruposRiesgoPresentes: new Set(),
          totalLlamadasResolucion: 0,
          cupoDisponible: DAILY_CALL_CAPACITY
        };
        days.push({
          ...dayData,
          dayOfMonth: d,
          isoDate: iso
        });
      }
      return days;
    });
  }, [activeYear, roadmap365]);

  // Acceso O(1) ultra-rápido a los días del mes
  const getDaysForMonth = (mIdx) => allMonthsDays[mIdx] || [];

  // Total anual de llamadas de resolución
  const totalYearlyCalls = useMemo(() => {
    return Object.values(roadmap365).reduce((acc, d) => acc + (d.totalLlamadasResolucion || 0), 0);
  }, [roadmap365]);

  // 3. Mapeo de pacientes a Cursos de Vida y Meses
  const matrixCursosData = useMemo(() => {
    const grid = {};
    PROGRAMAS_3280.forEach(prog => {
      grid[prog.id] = Array.from({ length: 12 }, () => []);
    });

    visiblePatients.forEach(pat => {
      const cv = getPatientCursoVida(pat);
      const matchedProgId = cv.id;

      let birthMonth = 0;
      const fn = pat.fechaNacimiento || pat.fecha_nacimiento;
      if (fn) {
        const parts = fn.split('-');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          if (m >= 1 && m <= 12) birthMonth = m - 1;
        }
      } else {
        birthMonth = (pat.id || 1) % 12;
      }

      if (grid[matchedProgId] && grid[matchedProgId][birthMonth]) {
        grid[matchedProgId][birthMonth].push(pat);
      }
    });

    return grid;
  }, [visiblePatients]);

  // 4. Mapeo de pacientes a Grupos de Riesgo y Meses
  const matrixRiesgosData = useMemo(() => {
    const grid = {};
    GRUPOS_RIESGO_10.forEach(rg => {
      grid[rg.id] = Array.from({ length: 12 }, () => []);
    });

    visiblePatients.forEach(pat => {
      const gr = getPatientGrupoRiesgo(pat);
      const matchedRgId = gr.id;

      let birthMonth = 0;
      const fn = pat.fechaNacimiento || pat.fecha_nacimiento;
      if (fn) {
        const parts = fn.split('-');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          if (m >= 1 && m <= 12) birthMonth = m - 1;
        }
      } else {
        birthMonth = (pat.id || 1) % 12;
      }

      if (grid[matchedRgId] && grid[matchedRgId][birthMonth]) {
        grid[matchedRgId][birthMonth].push(pat);
      }
    });

    return grid;
  }, [visiblePatients]);

  // Abrir Modal para crear campaña o ver cohorte desde una celda
  const handleCellClick = (type, item, monthIndex, mode = 'wizard', targetDateISO = null) => {
    const mObj = MESES_TITULOS[monthIndex];
    const monthName = typeof mObj === 'string' ? mObj : (mObj?.nombre || `Mes ${monthIndex + 1}`);

    // Restricción por Cursos de Vida asignados al doctor
    if (doctorAccess.restricted) {
      if (doctorAccess.keys.length === 0) {
        toast({
          title: 'Sin Cursos de Vida Asignados',
          description: 'Actualmente tu perfil no tiene Cursos de Vida asignados ("Sin Asignación"). Solicita al administrador que habilite tus cursos antes de programar o consultar campañas.',
          variant: 'destructive'
        });
        return;
      }
      if (type === 'curso_vida') {
        const itemKey = canonicalizeCursoKey(item?.key || item?.id || item?.nombre);
        if (!itemKey || !doctorAccess.keySet.has(itemKey)) {
          toast({
            title: 'Acceso Restringido por Curso de Vida',
            description: `Tu perfil solo tiene acceso a: ${formatCursosVidaLabel(user?.cursos_vida_asignados)}.`,
            variant: 'destructive'
          });
          return;
        }
      }
    }

    // Bloqueo estricto: NO permitir programar campañas en meses pasados
    if (mode === 'wizard' && isMonthPast(activeYear, monthIndex)) {
      toast({
        title: "⚠️ Periodo Histórico Finalizado",
        description: `No es posible crear campañas en meses anteriores (${monthName} ${activeYear}). Ya nos encontramos en Noviembre de ${CURRENT_REAL_YEAR}; solo puedes programar campañas para el mes en curso o periodos futuros.`,
        variant: "destructive"
      });
      return;
    }

    setSelectedContext({
      type, // 'curso_vida' | 'grupo_riesgo'
      item,
      monthIndex,
      monthName,
      targetDateISO
    });

    const defaultName = type === 'curso_vida'
      ? `Campaña ${item.nombre} - ${monthName} ${activeYear}`
      : `Campaña Control: ${item.nombre} - ${monthName} ${activeYear}`;

    setCampaignName(defaultName);
    setWizardStep(1);
    setCrossSegmentSelection([]);
    setPromptDirectriz(
      type === 'curso_vida'
        ? `Llamar a los pacientes del curso ${item.nombre} nacidos o citados en ${monthName} para tamizaje preventivo 3280, confirmando asistencia a la IPS ${sedeLugar}.`
        : `Llamar a los pacientes en seguimiento de ${item.nombre} para su control de ${monthName}, verificando adherencia farmacológica y signos de alarma en ${sedeLugar}.`
    );

    setModalMode(mode);
    setIsModalOpen(true);
  };

  // Pacientes en la celda activa seleccionada
  const activeCellPatients = useMemo(() => {
    if (!selectedContext) return [];
    if (selectedContext.type === 'curso_vida') {
      return matrixCursosData[selectedContext.item.id]?.[selectedContext.monthIndex] || [];
    } else {
      return matrixRiesgosData[selectedContext.item.id]?.[selectedContext.monthIndex] || [];
    }
  }, [selectedContext, matrixCursosData, matrixRiesgosData]);

  // Pacientes en la cohorte cruzada estricta (Intersección Curso de Vida + Grupos de Riesgo)
  const campaignTargetPatients = useMemo(() => {
    if (!selectedContext) return [];
    return getCampaignFilteredPatients(
      visiblePatients,
      selectedContext.type,
      selectedContext.item,
      crossSegmentSelection
    );
  }, [visiblePatients, selectedContext, crossSegmentSelection]);

  // Configuración estable memorizada para el calendario del Wizard
  const initialCalendarConfig = useMemo(() => {
    const targetMonth = selectedContext?.monthIndex ?? CURRENT_REAL_MONTH;
    const targetYear = activeYear || CURRENT_REAL_YEAR;
    let targetDate = selectedContext?.targetDateISO;

    if (!targetDate) {
      const isCurrentM = targetYear === CURRENT_REAL_YEAR && targetMonth === CURRENT_REAL_MONTH;
      let startD = isCurrentM ? new Date().getDate() : 1;
      const daysInM = new Date(targetYear, targetMonth + 1, 0).getDate();
      for (let d = startD; d <= daysInM; d++) {
        const dt = new Date(targetYear, targetMonth, d, 12, 0, 0);
        if (dt.getDay() !== 0) {
          const padM = String(targetMonth + 1).padStart(2, '0');
          const padD = String(d).padStart(2, '0');
          targetDate = `${targetYear}-${padM}-${padD}`;
          break;
        }
      }
      if (!targetDate) {
        targetDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
      }
    }

    return {
      mes: targetMonth,
      year: targetYear,
      fechaInicio: targetDate
    };
  }, [selectedContext?.monthIndex, selectedContext?.targetDateISO, activeYear]);

  // Manejo del Wizard con Control de Aforo Diario (3.500 llamadas)
  const handleNextStep = () => {
    if (wizardStep === 1) {
      let datesToValidate = campaignSchedule?.selectedDates || [];

      // Si por alguna razón el arreglo de fechas aún no se ha poblado, calcular el primer día hábil
      if (datesToValidate.length === 0) {
        const targetMonth = selectedContext?.monthIndex ?? CURRENT_REAL_MONTH;
        const targetYear = activeYear || CURRENT_REAL_YEAR;
        const isCurrentM = targetYear === CURRENT_REAL_YEAR && targetMonth === CURRENT_REAL_MONTH;
        let startD = isCurrentM ? new Date().getDate() : 1;
        const daysInM = new Date(targetYear, targetMonth + 1, 0).getDate();
        for (let d = startD; d <= daysInM; d++) {
          const dt = new Date(targetYear, targetMonth, d, 12, 0, 0);
          if (dt.getDay() !== 0) {
            const padM = String(targetMonth + 1).padStart(2, '0');
            const padD = String(d).padStart(2, '0');
            const calculatedDate = `${targetYear}-${padM}-${padD}`;
            datesToValidate = [calculatedDate];
            setCampaignSchedule(prev => ({
              ...prev,
              selectedDates: [calculatedDate],
              fechaInicio: calculatedDate,
              fechaFin: calculatedDate
            }));
            break;
          }
        }
      }

      if (datesToValidate.length === 0) {
        toast({
          title: 'Fecha requerida',
          description: 'Por favor selecciona al menos una fecha hábil en el calendario antes de continuar.',
          variant: 'destructive'
        });
        return;
      }

      // Validar capacidad si incluye llamadas
      if (selectedChannels.call) {
        const targetVol = campaignTargetPatients.length > 0 
          ? campaignTargetPatients.length 
          : (activeCellPatients.length || 1);

        const check = validateCampaignCallCapacity(
          datesToValidate,
          targetVol,
          roadmap365,
          existingCampaigns
        );

        if (!check.allowed) {
          toast({
            title: '⚠️ Límite de Capacidad GSM Excedido',
            description: check.message,
            variant: 'destructive'
          });
          return;
        }
      }
    }

    if (wizardStep === 2) {
      if (crossSegmentSelection.length === 0) {
        toast({
          title: 'Selección de Segmentación Requerida',
          description: selectedContext?.type === 'curso_vida'
            ? 'Selecciona al menos un Grupo de Riesgo para cruzar la campaña.'
            : 'Selecciona al menos un Curso de Vida para enfocar la campaña.',
          variant: 'destructive'
        });
        return;
      }
    }

    if (wizardStep < 5) {
      setWizardStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (wizardStep > 1) {
      setWizardStep(prev => prev - 1);
    }
  };

  // Guardar y Lanzar Campaña
  const handleLaunchCampaign = () => {
    let effectiveCrossCursos = crossSegmentSelection;
    if (doctorAccess.restricted) {
      if (doctorAccess.keys.length === 0) {
        toast({
          title: 'Sin Permisos de Creación',
          description: 'No tienes Cursos de Vida asignados para programar campañas.',
          variant: 'destructive'
        });
        return;
      }
      if (selectedContext?.type === 'curso_vida') {
        const itemKey = canonicalizeCursoKey(selectedContext.item?.key || selectedContext.item?.id || selectedContext.item?.nombre);
        if (!itemKey || !doctorAccess.keySet.has(itemKey)) {
          toast({
            title: 'Curso de Vida No Autorizado',
            description: 'Solo puedes crear programaciones dentro de tus Cursos de Vida asignados.',
            variant: 'destructive'
          });
          return;
        }
      } else {
        effectiveCrossCursos = (Array.isArray(crossSegmentSelection) ? crossSegmentSelection : []).filter(seg => {
          const canon = canonicalizeCursoKey(seg);
          return canon && doctorAccess.keySet.has(canon);
        });
        if (effectiveCrossCursos.length === 0) {
          toast({
            title: 'Selección Restringida',
            description: 'Debes seleccionar al menos uno de tus Cursos de Vida permitidos para lanzar esta campaña.',
            variant: 'destructive'
          });
          return;
        }
      }
    }

    // Validación final estricta de saldo residual
    if (selectedChannels.call) {
      const check = validateCampaignCallCapacity(
        campaignSchedule.selectedDates,
        campaignTargetPatients.length || 1,
        roadmap365,
        existingCampaigns
      );

      if (!check.allowed) {
        toast({
          title: 'Aforo GSM Bloqueado',
          description: check.message,
          variant: 'destructive'
        });
        return;
      }
    }

    const firstDate = campaignSchedule?.selectedDates?.[0];
    const detectedYear = firstDate 
      ? new Date(firstDate + 'T12:00:00').getFullYear() 
      : activeYear;

    const assignedPatientsList = campaignTargetPatients.map(p => {
      const cv = getPatientCursoVida(p);
      const gr = getPatientGrupoRiesgo(p);
      return {
        id: p.id,
        nombre: p.nombre,
        documento: p.cc || p.numero_documento || p.documento,
        telefono: p.telefono,
        edad: p.edad,
        curso_vida: cv.nombre,
        cursoVidaId: cv.id,
        cursoVidaColorHex: cv.colorHex,
        grupo_riesgo: gr.nombre,
        grupoRiesgoId: gr.id,
        grupoRiesgoColorHex: gr.colorHex
      };
    });

    const newCampaign = {
      id: `camp_${Date.now()}`,
      tipo_origen: selectedContext.type, // 'curso_vida' | 'grupo_riesgo'
      origen_id: selectedContext.item.id,
      origen_nombre: selectedContext.item.nombre,
      nombre: campaignName || `Campaña ${selectedContext.item.nombre} - ${selectedContext.monthName} ${detectedYear}`,
      mes_objetivo: selectedContext.monthName,
      mes_index: selectedContext.monthIndex,
      ano: detectedYear,
      canal: Object.keys(selectedChannels).filter(k => selectedChannels[k]).join(', '),
      canales_detalle: selectedChannels,
      horarios: selectedFranjas,
      reintentos: retryUntilAnswer ? maxRetries : 0,
      lugar: sedeLugar,
      directriz_ia: promptDirectriz,
      estado: 'programada',
      fecha_creacion: new Date().toISOString(),
      config_frecuencia: campaignSchedule,
      fechas_ejecucion: campaignSchedule.selectedDates,
      segmento_cursos: selectedContext.type === 'curso_vida' ? [selectedContext.item.nombre] : effectiveCrossCursos,
      segmento_riesgos: selectedContext.type === 'grupo_riesgo' ? [selectedContext.item.nombre] : crossSegmentSelection,
      creado_por_id: user?.id || null,
      creado_por_email: user?.email || null,
      creado_por_nombre: user?.name || user?.nombre || null,
      pacientes_asignados: assignedPatientsList.length,
      pacientes_ids: assignedPatientsList.map(p => p.id),
      pacientes_detalle: assignedPatientsList,
      enviados: 0,
      entregados: 0
    };

    try {
      const updated = [newCampaign, ...existingCampaigns];
      setExistingCampaigns(updated);
      localStorage.setItem('sadi_campaigns_v2', JSON.stringify(updated));
    } catch (e) {
      console.error('Error guardando campaña:', e);
    }

    toast({
      title: '¡Campaña Programada y Saldo Reservado!',
      description: `"${campaignName}" agendada dentro de la capacidad de 3.500 llamadas/día (08:00 AM - 06:00 PM).`,
    });

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      {/* HEADER PRINCIPAL */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              Resolución 3280 de 2018 • Cronograma Operativo Anual
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              Capacidad GSM: 3.500 llamadas/día (350/h • 08:00 AM a 06:00 PM)
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-400" />
            Matriz Anual y Regleta Longitudinal de Demanda Inducida
          </h2>
          <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-3xl">
            Monitoreo clínico estructurado en dos dimensiones con <strong>separación visual reforzada</strong>: Cursos de Vida (A-J) y Grupos de Riesgo Priorizados (1-10). Incluye la <strong>Regleta de 365 días</strong> para trazabilidad de cada llamada programada por ventana de resolución.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* 1. Selector de Año: Pasado (2025), Actual (2026), Siguiente (2027) */}
          <div className="bg-slate-800/90 p-1 rounded-2xl border border-slate-700 flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleYearChange(CURRENT_REAL_YEAR - 1)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                activeYear === CURRENT_REAL_YEAR - 1
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
              title="Ver Cronograma del Año Pasado (2025)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>2025 (Año Pasado)</span>
            </button>
            
            <button
              type="button"
              onClick={() => handleYearChange(CURRENT_REAL_YEAR)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                activeYear === CURRENT_REAL_YEAR
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
              title="Ver Cronograma del Año Actual (2026)"
            >
              <span>2026 (Año Actual)</span>
            </button>

            <button
              type="button"
              onClick={() => handleYearChange(CURRENT_REAL_YEAR + 1)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                activeYear === CURRENT_REAL_YEAR + 1
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
              title="Ver Cronograma del Año Siguiente (2027)"
            >
              <span>2027 (Año Siguiente)</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Selector de pestañas */}
          <div className="bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700 flex items-center text-xs font-bold">
            <button
              onClick={() => setActiveTab('ambos')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'ambos' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ambos Calendarios
            </button>
            <button
              onClick={() => setActiveTab('cursos_vida')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'cursos_vida' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cursos de Vida
            </button>
            <button
              onClick={() => setActiveTab('grupos_riesgo')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'grupos_riesgo' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Grupos de Riesgo
            </button>
          </div>

          <Button
            variant="outline"
            onClick={onDownloadExcel}
            className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs gap-1.5 rounded-xl"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CALENDARIO: CURSOS DE VIDA (A a J) CON SEPARACIÓN VISUAL REFORZADA     */}
      {/* ========================================================================= */}
      {(activeTab === 'ambos' || activeTab === 'cursos_vida') && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-6 transition-colors">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                1
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2 flex-wrap">
                  <span>Cronograma por Cursos de Vida (Resolución 3280 de 2018)</span>
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/50">
                    {doctorAccess.restricted
                      ? `${visibleProgramas.length} ${visibleProgramas.length === 1 ? 'Ruta Asignada' : 'Rutas Asignadas'}`
                      : `${visibleProgramas.length} Rutas Integrales de Atención`}
                  </span>
                  {doctorAccess.restricted && (
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Acceso exclusivo: {formatCursosVidaLabel(user?.cursos_vida_asignados)}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Líneas separadas claramente por programa etario con colores unificados y badges clínicos.
                </p>
              </div>
            </div>
            <div className="text-xs text-blue-900 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Haz clic en cualquier celda para activar el <strong>Wizard con límite de aforo</strong>.</span>
            </div>
          </div>

          <div className="w-full overflow-hidden px-2 sm:px-4">
            <table className="w-full table-fixed text-left border-collapse">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold transition-colors">
                  <th className="p-2 sticky left-0 bg-slate-100 dark:bg-slate-900 z-10 border-r-2 border-slate-300 dark:border-slate-800 overflow-hidden transition-colors">
                    <div className="truncate font-black text-slate-800 dark:text-white">
                      Curso de Vida & Rango Etario
                    </div>
                  </th>
                  {MESES_TITULOS.map((mObj, idx) => {
                    const nombreMes = typeof mObj === 'string' ? mObj : (mObj?.nombre || mObj?.label || `Mes ${idx + 1}`);
                    const abrev = typeof mObj === 'string' ? mObj.slice(0, 3) : (mObj?.abreviatura || nombreMes.slice(0, 3));
                    return (
                      <th key={idx} className="p-1 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 overflow-hidden transition-colors">
                        <div className="font-black text-slate-800 dark:text-slate-200 text-[11px] truncate">{abrev}</div>
                        <div className="text-[8px] font-normal text-slate-500 dark:text-slate-400 capitalize truncate">{nombreMes}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y-4 divide-slate-100 dark:divide-slate-800 text-xs">
                {/* LÍNEA EXTRA DEL ROADMAP ANUAL DIRECTAMENTE DEBAJO DE LOS MESES (Blanco en Luz, Negro en Noche) */}
                <tr className="bg-white dark:bg-slate-950 text-slate-800 dark:text-white border-b-4 border-slate-200 dark:border-slate-800 group/roadmap">
                  <td className="p-2 sticky left-0 bg-white dark:bg-slate-950 z-10 border-r-2 border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800/60">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 truncate">
                          Ruta Res. 3280
                        </div>
                        <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">
                          {totalYearlyCalls} llam. • 365d
                        </div>
                      </div>
                    </div>
                  </td>
                  {MESES_TITULOS.map((_, mIdx) => {
                    const days = getDaysForMonth(mIdx);
                    const monthCalls = days.reduce((acc, d) => acc + (d.totalLlamadasResolucion || 0), 0);
                    const isPast = isMonthPast(activeYear, mIdx);

                    return (
                      <td 
                        key={mIdx} 
                        className={`p-1 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 overflow-hidden align-top ${
                          isPast ? 'bg-slate-100/90 dark:bg-slate-900/60 filter grayscale contrast-[75%] opacity-70' : 'bg-white dark:bg-slate-950'
                        }`}
                        title={isPast ? 'Periodo pasado cerrado (Vencido) en la Resolución 3280' : undefined}
                      >
                        {/* Mini Calendario Mensual (Blanco en activo, grisáceo vencido en pasado) */}
                        <div className={`w-full rounded-lg p-1 border flex flex-col justify-between min-h-[58px] ${
                          isPast 
                            ? 'bg-slate-200/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800 shadow-none' 
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                        }`}>
                          <div className="grid grid-cols-7 gap-[1px] w-full">
                            {days.map(d => {
                              const cvIds = Array.from(d.cursosVidaPresentes || []);
                              const colors = cvIds.map(id => CURSOS_VIDA_PALETTE[id]?.colorHex || '#3b82f6');
                              const hasCalls = colors.length > 0;
                              const isSun = d.isSunday;

                              let bgStyle = {};
                              if (hasCalls) {
                                if (colors.length === 1) {
                                  bgStyle = { backgroundColor: colors[0] };
                                } else {
                                  bgStyle = { background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[0]} 50%, ${colors[1]} 50%, ${colors[1]} 100%)` };
                                }
                              }

                              return (
                                <button
                                  key={d.isoDate}
                                  type="button"
                                  onClick={() => {
                                    handleOpenDayDetail(d, null, 'global_cursos');
                                  }}
                                  title={`${d.isoDate}: ${d.totalLlamadasResolucion || 0} llamadas`}
                                  style={bgStyle}
                                  className={`w-full aspect-square rounded-[1.5px] text-[7px] leading-none flex items-center justify-center ${
                                    isSun
                                      ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 opacity-40 cursor-default'
                                      : hasCalls
                                        ? 'text-white font-black hover:scale-125 shadow-sm ring-1 ring-white/60 cursor-pointer transition-transform'
                                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-100 dark:border-slate-800 cursor-pointer'
                                  }`}
                                >
                                  {d.dayOfMonth}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] text-slate-600 dark:text-slate-400 mt-1 pt-0.5 border-t border-slate-100 dark:border-slate-800 px-0.5">
                            <span className={monthCalls > 0 ? "text-emerald-700 dark:text-emerald-400 font-bold truncate" : "text-slate-400 truncate"}>
                              {monthCalls} llam.
                            </span>
                            <span className="text-[7px] text-slate-400">{days.length}d</span>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {visibleProgramas.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center bg-slate-50/70 dark:bg-slate-900/60">
                      <div className="max-w-md mx-auto flex flex-col items-center gap-2">
                        <AlertCircle className="w-8 h-8 text-amber-500" />
                        <div className="text-sm font-black text-slate-900 dark:text-white">
                          Sin Asignación de Cursos de Vida
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Tu perfil clínico aún no tiene Cursos de Vida habilitados. Solicita al administrador hospitalario asignar tus categorías en Gestión de Personal para ver y programar en el cronograma.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : visibleProgramas.map(prog => {
                  const pal = CURSOS_VIDA_PALETTE[prog.id] || CURSOS_VIDA_PALETTE['E'];
                  const IconComponent = getCursoVidaIcon(prog.id);

                  return (
                    <tr 
                      key={prog.id} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors border-b-4 border-slate-100 dark:border-slate-800 group/row"
                    >
                      {/* Columna Fija: Curso de Vida con Icono SVG en su color oficial */}
                      <td className="p-2 sticky left-0 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 z-10 border-r-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div 
                            className="shrink-0 p-1.5 rounded-lg border flex items-center justify-center shadow-xs"
                            style={{ 
                              backgroundColor: `${pal.colorHex}18`, 
                              borderColor: `${pal.colorHex}40`,
                              color: pal.colorHex 
                            }}
                          >
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="font-black text-slate-900 dark:text-white text-xs flex items-center gap-1">
                              <span className="truncate">{prog.nombre}</span>
                              <span 
                                className="text-[9px] font-black px-1 rounded text-white shrink-0"
                                style={{ backgroundColor: pal.colorHex }}
                              >
                                {prog.id}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                              {prog.edad}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 12 Meses */}
                      {MESES_TITULOS.map((mObj, mIdx) => {
                        const cellPatients = matrixCursosData[prog.id]?.[mIdx] || [];
                        const count = cellPatients.length;
                        const hitoClinico = prog.hitosMeses?.[mIdx] || 'Tamizaje preventivo';
                        const isPast = isMonthPast(activeYear, mIdx);
                        const cellCampaigns = getCellCampaigns('curso_vida', prog, mIdx);
                        const days = getDaysForMonth(mIdx);
                        const progCalls = days.reduce((acc, d) => {
                          return acc + (d.callsResolucion || []).filter(c => c.cursoVidaId === prog.id).length;
                        }, 0);

                        return (
                          <td 
                            key={mIdx}
                            onClick={() => handleCellClick('curso_vida', prog, mIdx, 'wizard')}
                            className={`p-1 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0 relative group overflow-hidden ${
                              isPast 
                                ? 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60' 
                                : 'cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20'
                            }`}
                          >
                            <div 
                              className={`p-1 rounded-xl border text-[9px] flex flex-col justify-between min-h-[105px] overflow-hidden ${
                                isPast
                                  ? 'bg-slate-200/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800 text-slate-500 filter grayscale contrast-[75%] opacity-70'
                                  : (count > 0 || cellCampaigns.length > 0)
                                    ? 'border-blue-200 dark:border-slate-700 text-slate-900 dark:text-white group-hover:border-blue-500 group-hover:shadow-sm bg-white dark:bg-slate-900'
                                    : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 text-slate-400 group-hover:border-slate-300'
                              }`}
                              style={!isPast && (count > 0 || cellCampaigns.length > 0) ? { backgroundColor: `${pal.colorHex}08` } : {}}
                              title={isPast ? 'Periodo pasado cerrado (Vencido) • No se permiten campañas en meses anteriores' : 'Haz clic fuera de los días para crear una nueva campaña en este mes'}
                            >
                              {/* Cabecera de celda: Hito clínico y badge de campañas si existen */}
                              <div className="flex items-center justify-between gap-1 overflow-hidden">
                                <div className="text-[7.5px] truncate text-slate-700 dark:text-slate-300 font-bold leading-tight text-left">
                                  {hitoClinico}
                                </div>
                                {cellCampaigns.length > 0 && (
                                  <span className="text-[7px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-1 py-0.2 rounded-full shrink-0" title={`${cellCampaigns.length} campaña(s) activa(s) en este mes`}>
                                    📢 {cellCampaigns.length}
                                  </span>
                                )}
                              </div>

                              {/* Mini Calendario Mensual del Curso de Vida (Blanco en activo, grisáceo vencido en pasado) */}
                              <div className={`w-full rounded-lg p-0.5 border flex flex-col justify-between my-0.5 ${
                                isPast 
                                  ? 'bg-slate-100/90 dark:bg-slate-900/60 border-slate-300 dark:border-slate-800 shadow-none' 
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                              }`}>
                                <div className="grid grid-cols-7 gap-[1px] w-full">
                                  {days.map(d => {
                                    const resCalls = (d.callsResolucion || []).filter(c => c.cursoVidaId === prog.id);
                                    const dayCamps = cellCampaigns.filter(c => (c.fechas_ejecucion || c.config_frecuencia?.selectedDates || []).includes(d.isoDate));
                                    const hasResCalls = resCalls.length > 0;
                                    const hasCampCalls = dayCamps.length > 0;
                                    const hasCalls = hasResCalls || hasCampCalls;
                                    const isSun = d.isSunday;

                                    let bgStyle = {};
                                    if (hasCalls) {
                                      if (hasCampCalls && hasResCalls) {
                                        bgStyle = { background: `linear-gradient(135deg, ${pal.colorHex} 0%, ${pal.colorHex} 50%, #f59e0b 50%, #f59e0b 100%)` };
                                      } else if (hasCampCalls) {
                                        bgStyle = { backgroundColor: '#f59e0b' };
                                      } else {
                                        bgStyle = { backgroundColor: pal.colorHex };
                                      }
                                    }

                                    return (
                                      <button
                                        key={d.isoDate}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (hasCalls) {
                                            handleOpenDayDetail(d, prog, 'curso_vida');
                                          } else if (!isSun && !isPast) {
                                            handleCellClick('curso_vida', prog, mIdx, 'wizard', d.isoDate);
                                          }
                                        }}
                                        title={
                                          hasCalls
                                            ? `${d.isoDate}: ${resCalls.length} citas Res. 3280 • ${dayCamps.length} campañas. Haz clic para ver detalles y guion de llamada.`
                                            : isSun
                                              ? 'Domingo no operativo'
                                              : isPast
                                                ? 'Periodo cerrado (Vencido)'
                                                : `${d.isoDate}: Haz clic para crear campaña en este día.`
                                        }
                                        style={bgStyle}
                                        className={`w-full aspect-square rounded-[1.5px] text-[6.5px] leading-none flex items-center justify-center ${
                                          isSun
                                            ? 'bg-slate-100/60 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 opacity-40 cursor-default'
                                            : hasCalls
                                              ? 'text-white font-black hover:scale-125 shadow-sm ring-1 ring-white/60 cursor-pointer transition-transform'
                                              : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-900 dark:hover:text-blue-200 border border-slate-100 dark:border-slate-800 cursor-pointer'
                                        }`}
                                      >
                                        {d.dayOfMonth}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center justify-between text-[7px] text-slate-600 dark:text-slate-400 mt-0.5 pt-0.5 border-t border-slate-100 dark:border-slate-800 px-0.5">
                                  <span className={progCalls > 0 ? "text-emerald-700 dark:text-emerald-400 font-bold truncate" : "text-slate-400 truncate"}>
                                    {progCalls} llam.
                                  </span>
                                  <span className="text-[6.5px] text-slate-400">{days.length}d</span>
                                </div>
                              </div>

                              {/* Footer de Celda: Conteo y botón + */}
                              <div className="flex items-center justify-between pt-0.5 border-t border-slate-200/40 dark:border-slate-800">
                                <span 
                                  className={`text-[8.5px] font-black px-1 py-0.2 rounded-full truncate max-w-[70%] ${
                                    isPast 
                                      ? 'bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300' 
                                      : (count > 0 || cellCampaigns.length > 0) ? 'text-white' : 'text-white bg-slate-400'
                                  }`}
                                  style={!isPast && (count > 0 || cellCampaigns.length > 0) ? { backgroundColor: pal.colorHex } : {}}
                                >
                                  {count} pac.
                                </span>
                                {isPast ? (
                                  <Clock className="w-3 h-3 text-slate-400 shrink-0" title="Periodo cerrado • Vencido" />
                                ) : (
                                  <span className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-bold text-xs leading-none">
                                    +
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CALENDARIO: GRUPOS DE RIESGO CON SEPARACIÓN VISUAL REFORZADA           */}
      {/* ========================================================================= */}
      {(activeTab === 'ambos' || activeTab === 'grupos_riesgo') && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-6 transition-colors">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-black text-lg shadow-sm">
                2
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                  <span>Cronograma por Grupos de Riesgo Priorizados</span>
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-md border border-purple-200 dark:border-purple-900/50">
                    10 Cohortes Clínicas Crónicas y Específicas
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Líneas separadas de forma nítida con sus hitos inamovibles de control mensual y códigos CUPS.
                </p>
              </div>
            </div>
            <div className="text-xs text-purple-900 dark:text-purple-200 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-900 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Al crear campaña desde aquí, <strong>el Paso 1 te permitirá seleccionar los Cursos de Vida</strong> a intervenir.</span>
            </div>
          </div>

          <div className="w-full overflow-hidden px-2 sm:px-4">
            <table className="w-full table-fixed text-left border-collapse">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold transition-colors">
                  <th className="p-2 sticky left-0 bg-slate-100 dark:bg-slate-900 z-10 border-r-2 border-slate-300 dark:border-slate-800 overflow-hidden transition-colors">
                    <div className="truncate font-black text-slate-800 dark:text-white">
                      Grupo de Riesgo Priorizado
                    </div>
                  </th>
                  {MESES_TITULOS.map((mObj, idx) => {
                    const nombreMes = typeof mObj === 'string' ? mObj : (mObj?.nombre || mObj?.label || `Mes ${idx + 1}`);
                    const abrev = typeof mObj === 'string' ? mObj.slice(0, 3) : (mObj?.abreviatura || nombreMes.slice(0, 3));
                    return (
                      <th key={idx} className="p-1 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 overflow-hidden transition-colors">
                        <div className="font-black text-slate-800 dark:text-slate-200 text-[11px] truncate">{abrev}</div>
                        <div className="text-[8px] font-normal text-slate-500 dark:text-slate-400 capitalize truncate">{nombreMes}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y-4 divide-slate-100 dark:divide-slate-800 text-xs">
                {/* LÍNEA EXTRA DEL ROADMAP ANUAL DIRECTAMENTE DEBAJO DE LOS MESES (Blanco en Luz, Negro en Noche) */}
                <tr className="bg-white dark:bg-slate-950 text-slate-800 dark:text-white border-b-4 border-slate-200 dark:border-slate-800 group/roadmap">
                  <td className="p-2 sticky left-0 bg-white dark:bg-slate-950 z-10 border-r-2 border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <div className="w-6 h-6 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-200 dark:border-purple-800/60">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 truncate">
                          Ruta Res. 3280
                        </div>
                        <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">
                          {totalYearlyCalls} llam. • 365d
                        </div>
                      </div>
                    </div>
                  </td>
                  {MESES_TITULOS.map((_, mIdx) => {
                    const days = getDaysForMonth(mIdx);
                    const monthCalls = days.reduce((acc, d) => acc + (d.totalLlamadasResolucion || 0), 0);
                    const isPast = isMonthPast(activeYear, mIdx);

                    return (
                      <td 
                        key={mIdx} 
                        className={`p-1 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 overflow-hidden align-top ${
                          isPast ? 'bg-slate-100/90 dark:bg-slate-900/60 filter grayscale contrast-[75%] opacity-70' : 'bg-white dark:bg-slate-950'
                        }`}
                        title={isPast ? 'Periodo pasado cerrado (Vencido) en la Resolución 3280' : undefined}
                      >
                        {/* Mini Calendario Mensual (Blanco en activo, grisáceo vencido en pasado) */}
                        <div className={`w-full rounded-lg p-1 border flex flex-col justify-between min-h-[58px] ${
                          isPast 
                            ? 'bg-slate-200/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800 shadow-none' 
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                        }`}>
                          <div className="grid grid-cols-7 gap-[1px] w-full">
                            {days.map(d => {
                              const grIds = Array.from(d.gruposRiesgoPresentes || []);
                              const colors = grIds.map(id => GRUPOS_RIESGO_PALETTE[id]?.colorHex || '#8b5cf6');
                              const hasCalls = colors.length > 0;
                              const isSun = d.isSunday;

                              let bgStyle = {};
                              if (hasCalls) {
                                if (colors.length === 1) {
                                  bgStyle = { backgroundColor: colors[0] };
                                } else {
                                  bgStyle = { background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[0]} 50%, ${colors[1]} 50%, ${colors[1]} 100%)` };
                                }
                              }

                              return (
                                <button
                                  key={d.isoDate}
                                  type="button"
                                  onClick={() => {
                                    handleOpenDayDetail(d, null, 'global_riesgos');
                                  }}
                                  title={`${d.isoDate}: ${d.totalLlamadasResolucion || 0} llamadas (Grupos de Riesgo)`}
                                  style={bgStyle}
                                  className={`w-full aspect-square rounded-[1.5px] text-[7px] leading-none flex items-center justify-center ${
                                    isSun
                                      ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 opacity-40 cursor-default'
                                      : hasCalls
                                        ? 'text-white font-black hover:scale-125 shadow-sm ring-1 ring-white/60 cursor-pointer transition-transform'
                                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-100 dark:border-slate-800 cursor-pointer'
                                  }`}
                                >
                                  {d.dayOfMonth}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] text-slate-600 dark:text-slate-400 mt-1 pt-0.5 border-t border-slate-100 dark:border-slate-800 px-0.5">
                            <span className={monthCalls > 0 ? "text-purple-700 dark:text-purple-400 font-bold truncate" : "text-slate-400 truncate"}>
                              {monthCalls} llam.
                            </span>
                            <span className="text-[7px] text-slate-400">{days.length}d</span>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {GRUPOS_RIESGO_10.map(rg => {
                  const pal = GRUPOS_RIESGO_PALETTE[rg.id] || GRUPOS_RIESGO_PALETTE[2];
                  const IconComponent = getGrupoRiesgoIcon(rg.id);

                  return (
                    <tr 
                      key={rg.id} 
                      className="hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-colors border-b-4 border-slate-100 dark:border-slate-800 group/row"
                    >
                      {/* Columna Fija: Grupo de Riesgo con Icono SVG en su color oficial */}
                      <td className="p-2 sticky left-0 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 z-10 border-r-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div 
                            className="shrink-0 p-1.5 rounded-lg border flex items-center justify-center shadow-xs"
                            style={{ 
                              backgroundColor: `${pal.colorHex}18`, 
                              borderColor: `${pal.colorHex}40`,
                              color: pal.colorHex 
                            }}
                          >
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="font-black text-slate-900 dark:text-white text-xs flex items-center gap-1">
                              <span className="truncate">{rg.nombre}</span>
                              <span 
                                className="text-[9px] font-black px-1 rounded text-white shrink-0"
                                style={{ backgroundColor: pal.colorHex }}
                              >
                                #{rg.id}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                              {rg.descripcion}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 12 Meses */}
                      {MESES_TITULOS.map((mObj, mIdx) => {
                        const cellPatients = matrixRiesgosData[rg.id]?.[mIdx] || [];
                        const count = cellPatients.length;
                        const milestone = rg.milestones?.[mIdx];
                        const hitoClinico = milestone?.hito || 'Control clínico';
                        const isPast = isMonthPast(activeYear, mIdx);
                        const cellCampaigns = getCellCampaigns('grupo_riesgo', rg, mIdx);
                        const days = getDaysForMonth(mIdx);
                        const rgCalls = days.reduce((acc, d) => {
                          return acc + (d.callsResolucion || []).filter(c => c.grupoRiesgoId === rg.id).length;
                        }, 0);

                        return (
                          <td 
                            key={mIdx}
                            onClick={() => handleCellClick('grupo_riesgo', rg, mIdx, 'wizard')}
                            className={`p-1 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0 relative group overflow-hidden ${
                              isPast 
                                ? 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60' 
                                : 'cursor-pointer hover:bg-purple-50/40 dark:hover:bg-purple-950/20'
                            }`}
                          >
                            <div 
                              className={`p-1 rounded-xl border text-[9px] flex flex-col justify-between min-h-[105px] overflow-hidden ${
                                isPast
                                  ? 'bg-slate-200/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800 text-slate-500 filter grayscale contrast-[75%] opacity-70'
                                  : (count > 0 || cellCampaigns.length > 0)
                                    ? 'border-purple-200 dark:border-purple-900/60 text-slate-900 dark:text-white group-hover:border-purple-500 group-hover:shadow-sm bg-white dark:bg-slate-900'
                                    : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 text-slate-400 group-hover:border-slate-300'
                              }`}
                              style={!isPast && (count > 0 || cellCampaigns.length > 0) ? { backgroundColor: `${pal.colorHex}08` } : {}}
                              title={isPast ? 'Periodo pasado cerrado (Vencido) • No se permiten campañas en meses anteriores' : 'Haz clic fuera de los días para crear una nueva campaña en este mes'}
                            >
                              {/* Cabecera de celda: Hito clínico y badge de campañas si existen */}
                              <div className="flex items-center justify-between gap-1 overflow-hidden">
                                <div className="text-[7.5px] truncate text-slate-700 dark:text-slate-300 font-bold leading-tight text-left">
                                  {hitoClinico}
                                </div>
                                {cellCampaigns.length > 0 && (
                                  <span className="text-[7px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-1 py-0.2 rounded-full shrink-0" title={`${cellCampaigns.length} campaña(s) activa(s) en este mes`}>
                                    📢 {cellCampaigns.length}
                                  </span>
                                )}
                              </div>

                              {/* Mini Calendario Mensual del Grupo de Riesgo (Blanco en activo, grisáceo vencido en pasado) */}
                              <div className={`w-full rounded-lg p-0.5 border flex flex-col justify-between my-0.5 ${
                                isPast 
                                  ? 'bg-slate-100/90 dark:bg-slate-900/60 border-slate-300 dark:border-slate-800 shadow-none' 
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                              }`}>
                                <div className="grid grid-cols-7 gap-[1px] w-full">
                                  {days.map(d => {
                                    const resCalls = (d.callsResolucion || []).filter(c => c.grupoRiesgoId === rg.id);
                                    const dayCamps = cellCampaigns.filter(c => (c.fechas_ejecucion || c.config_frecuencia?.selectedDates || []).includes(d.isoDate));
                                    const hasResCalls = resCalls.length > 0;
                                    const hasCampCalls = dayCamps.length > 0;
                                    const hasCalls = hasResCalls || hasCampCalls;
                                    const isSun = d.isSunday;

                                    let bgStyle = {};
                                    if (hasCalls) {
                                      if (hasCampCalls && hasResCalls) {
                                        bgStyle = { background: `linear-gradient(135deg, ${pal.colorHex} 0%, ${pal.colorHex} 50%, #f59e0b 50%, #f59e0b 100%)` };
                                      } else if (hasCampCalls) {
                                        bgStyle = { backgroundColor: '#f59e0b' };
                                      } else {
                                        bgStyle = { backgroundColor: pal.colorHex };
                                      }
                                    }

                                    return (
                                      <button
                                        key={d.isoDate}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (hasCalls) {
                                            handleOpenDayDetail(d, rg, 'grupo_riesgo');
                                          } else if (!isSun && !isPast) {
                                            handleCellClick('grupo_riesgo', rg, mIdx, 'wizard', d.isoDate);
                                          }
                                        }}
                                        title={
                                          hasCalls
                                            ? `${d.isoDate}: ${resCalls.length} citas Res. 3280 • ${dayCamps.length} campañas. Haz clic para ver detalles y guion de llamada.`
                                            : isSun
                                              ? 'Domingo no operativo'
                                              : isPast
                                                ? 'Periodo cerrado (Vencido)'
                                                : `${d.isoDate}: Haz clic para crear campaña en este día.`
                                        }
                                        style={bgStyle}
                                        className={`w-full aspect-square rounded-[1.5px] text-[6.5px] leading-none flex items-center justify-center ${
                                          isSun
                                            ? 'bg-slate-100/60 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 opacity-40 cursor-default'
                                            : hasCalls
                                              ? 'text-white font-black hover:scale-125 shadow-sm ring-1 ring-white/60 cursor-pointer transition-transform'
                                              : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:text-purple-900 dark:hover:text-purple-200 border border-slate-100 dark:border-slate-800 cursor-pointer'
                                        }`}
                                      >
                                        {d.dayOfMonth}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center justify-between text-[7px] text-slate-600 dark:text-slate-400 mt-0.5 pt-0.5 border-t border-slate-100 dark:border-slate-800 px-0.5">
                                  <span className={rgCalls > 0 ? "text-purple-700 dark:text-purple-400 font-bold truncate" : "text-slate-400 truncate"}>
                                    {rgCalls} llam.
                                  </span>
                                  <span className="text-[6.5px] text-slate-400">{days.length}d</span>
                                </div>
                              </div>

                              {/* Footer de Celda: Conteo y botón + */}
                              <div className="flex items-center justify-between pt-0.5 border-t border-purple-200/40 dark:border-slate-800">
                                <span 
                                  className={`text-[8.5px] font-black px-1 py-0.2 rounded-full truncate max-w-[70%] ${
                                    isPast 
                                      ? 'bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300' 
                                      : (count > 0 || cellCampaigns.length > 0) ? 'text-white' : 'text-white bg-slate-400'
                                  }`}
                                  style={!isPast && (count > 0 || cellCampaigns.length > 0) ? { backgroundColor: pal.colorHex } : {}}
                                >
                                  {count} pac.
                                </span>
                                {isPast ? (
                                  <Clock className="w-3 h-3 text-slate-400 shrink-0" title="Periodo cerrado • Vencido" />
                                ) : (
                                  <span className="text-purple-600 hover:text-purple-800 dark:text-purple-400 font-bold text-xs leading-none">
                                    +
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PRINCIPAL: WIZARD DE CAMPAÑA (5 PASOS) O COHORTE DE PACIENTES       */}
      {/* ========================================================================= */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95%] sm:w-[90%] max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl">
          {/* Header del Modal */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white rounded-t-3xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {selectedContext?.type === 'curso_vida' ? 'Campaña desde Curso de Vida' : 'Campaña desde Grupo de Riesgo'}
                </span>
                <DialogTitle className="text-xl font-bold mt-2 flex items-center gap-2">
                  {selectedContext?.item?.nombre} ({selectedContext?.monthName} {selectedYear})
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-1">
                  Cohorte objetivo: <strong>{campaignTargetPatients.length > 0 ? campaignTargetPatients.length : activeCellPatients.length} pacientes verificados</strong> {crossSegmentSelection.length > 0 ? `(Cruce: ${selectedContext?.item?.nombre} + ${crossSegmentSelection.join(', ')})` : `(Corte ${selectedContext?.item?.nombre})`}.
                </DialogDescription>
              </div>

              {/* Selector de modo: Wizard vs Pacientes */}
              <div className="flex bg-slate-800 p-1.5 rounded-2xl text-xs font-bold border border-slate-700">
                <button
                  onClick={() => setModalMode('wizard')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    modalMode === 'wizard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Wizard de Campaña
                </button>
                <button
                  onClick={() => setModalMode('cohort')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    modalMode === 'cohort' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ver Cohorte ({campaignTargetPatients.length > 0 ? campaignTargetPatients.length : activeCellPatients.length})
                </button>
              </div>
            </div>

            {/* Stepper visual para el Wizard (5 Pasos) */}
            {modalMode === 'wizard' && (
              <div className="mt-6 pt-4 border-t border-slate-800 grid grid-cols-5 gap-2 text-center text-xs">
                {[
                  { step: 1, label: '1. Calendario & Aforo' },
                  { step: 2, label: selectedContext?.type === 'curso_vida' ? '2. Grupos de Riesgo' : '2. Cursos de Vida' },
                  { step: 3, label: '3. Canales & Horarios' },
                  { step: 4, label: '4. Directriz & Sede' },
                  { step: 5, label: '5. Resumen & Saldo' }
                ].map(s => (
                  <div 
                    key={s.step}
                    className={`py-1.5 px-2 rounded-xl font-bold transition-all ${
                      wizardStep === s.step 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : wizardStep > s.step 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800/60 text-slate-400'
                    }`}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cuerpo del Modal */}
          <div className="p-6">
            {modalMode === 'cohort' ? (
              /* VISTA DE PACIENTES DE LA CELDA */
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 text-sm">
                    Pacientes en este Segmento Clínico ({campaignTargetPatients.length > 0 ? campaignTargetPatients.length : activeCellPatients.length})
                  </h4>
                  <span className="text-xs text-slate-500">Datos verificados con Historia Clínica</span>
                </div>

                {(() => {
                  const listToShow = campaignTargetPatients.length > 0 ? campaignTargetPatients : activeCellPatients;
                  if (listToShow.length === 0) {
                    return (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                        <p className="text-sm text-slate-500">No hay pacientes que cumplan simultáneamente con los filtros clínicos de este segmento.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto border border-slate-200 rounded-2xl">
                      {listToShow.map(pat => {
                        const cv = getPatientCursoVida(pat);
                        const gr = getPatientGrupoRiesgo(pat);
                        return (
                          <div key={pat.id} className="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{pat.nombre}</div>
                              <div className="text-slate-500 text-[11px] font-mono">CC: {pat.cc || pat.numero_documento} • Tel: {pat.telefono} • {pat.edad} años</div>
                              {(pat.diagnostico || pat.notas_clinicas) && (
                                <div className="text-[11px] text-slate-500 mt-0.5 italic">
                                  {pat.diagnostico || pat.notas_clinicas}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                              <span 
                                className="px-2.5 py-0.5 rounded-full text-white font-bold text-[10px]"
                                style={{ backgroundColor: cv.colorHex }}
                              >
                                {cv.nombre}
                              </span>
                              <span 
                                className="px-2.5 py-0.5 rounded-full text-white font-bold text-[10px]"
                                style={{ backgroundColor: gr.colorHex }}
                              >
                                {gr.nombre}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* WIZARD DE CAMPAÑA - PASOS 1 A 5 CON LIMITADOR DE 3.500 LLAMADAS */
              <div className="space-y-6">
                {/* =================================================================== */}
                {/* PASO 1: CALENDARIO & FRECUENCIA CON VALIDACIÓN DE AFORO             */}
                {/* =================================================================== */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-950 flex items-start gap-3">
                      <Gauge className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Paso 1: Planificación de Calendario & Control de Capacidad GSM</strong>
                        <p className="mt-0.5 text-blue-800">
                          Horario de emisión: <strong>08:00 AM a 06:00 PM (10 horas)</strong>. Capacidad máxima: <strong>3.500 llamadas diarias</strong>. Las llamadas de la Resolución 3280 tienen prioridad inamovible y se descuentan del saldo disponible para campañas.
                        </p>
                      </div>
                    </div>

                    <CampaignSchedulingCalendar
                      initialFrequency="diaria"
                      initialConfig={initialCalendarConfig}
                      onScheduleChange={(sched) => setCampaignSchedule(sched)}
                    />
                  </div>
                )}

                {/* =================================================================== */}
                {/* PASO 2: SEGMENTACIÓN CRUZADA                                        */}
                {/* =================================================================== */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-xs text-purple-950">
                      <strong>
                        {selectedContext?.type === 'curso_vida' 
                          ? 'Paso 2: Cruce con Grupos de Riesgo Priorizados' 
                          : 'Paso 2: Cruce con Cursos de Vida'}
                      </strong>
                      <p className="mt-0.5 text-purple-800">
                        {selectedContext?.type === 'curso_vida'
                          ? `Para el curso "${selectedContext.item.nombre}", selecciona qué grupos de riesgo priorizados recibirán esta campaña.`
                          : `Para el grupo de riesgo "${selectedContext.item.nombre}", selecciona a qué cursos de vida se aplicará esta campaña (un grupo de riesgo abarca varios cursos de vida).`}
                      </p>
                    </div>

                    {/* Indicador en tiempo real de pacientes coincidentes */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Población objetivo tras intersección clínica:
                        </span>
                      </div>
                      <span className={`font-bold px-3 py-1 rounded-full text-xs border ${
                        campaignTargetPatients.length > 0
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}>
                        {campaignTargetPatients.length} paciente(s) seleccionado(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto p-1">
                      {selectedContext?.type === 'curso_vida' ? (
                        GRUPOS_RIESGO_10.map(rg => {
                          const pal = GRUPOS_RIESGO_PALETTE[rg.id] || GRUPOS_RIESGO_PALETTE[2];
                          const IconComponent = getGrupoRiesgoIcon(rg.id);
                          const isSelected = crossSegmentSelection.includes(rg.nombre);
                          return (
                            <div
                              key={rg.id}
                              onClick={() => {
                                setCrossSegmentSelection(prev => 
                                  isSelected ? prev.filter(x => x !== rg.nombre) : [...prev, rg.nombre]
                                );
                              }}
                              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                                isSelected
                                  ? 'bg-purple-50 border-purple-500 shadow-sm ring-1 ring-purple-500'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div 
                                className="p-2.5 rounded-xl shrink-0 text-white"
                                style={{ backgroundColor: pal.colorHex }}
                              >
                                <IconComponent className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                                  <span>{rg.nombre}</span>
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                                </div>
                                <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                                  {rg.descripcion}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : visibleProgramas.length === 0 ? (
                        <div className="col-span-full p-6 text-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-xs font-semibold">
                          Sin Cursos de Vida asignados a tu perfil. No puedes programar campañas hasta recibir asignación.
                        </div>
                      ) : (
                        visibleProgramas.map(cv => {
                          const pal = CURSOS_VIDA_PALETTE[cv.id] || CURSOS_VIDA_PALETTE['E'];
                          const IconComponent = getCursoVidaIcon(cv.id);
                          const isSelected = crossSegmentSelection.includes(cv.nombre);
                          return (
                            <div
                              key={cv.id}
                              onClick={() => {
                                setCrossSegmentSelection(prev => 
                                  isSelected ? prev.filter(x => x !== cv.nombre) : [...prev, cv.nombre]
                                );
                              }}
                              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                                isSelected
                                  ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div 
                                className="p-2.5 rounded-xl shrink-0 text-white"
                                style={{ backgroundColor: pal.colorHex }}
                              >
                                <IconComponent className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                                  <span>{cv.nombre}</span>
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Rango: {cv.edad}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* =================================================================== */}
                {/* PASO 3: CANALES, REINTENTOS Y HORARIOS (8:00 AM A 6:00 PM)          */}
                {/* =================================================================== */}
                {wizardStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                        Canales de Envío Autorizados
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { key: 'call', label: 'Llamada IA Vapi', sub: 'Gateway OpenVox GSM', icon: Phone, color: 'blue' },
                          { key: 'whatsapp', label: 'WhatsApp', sub: 'Plantilla Meta', icon: MessageSquare, color: 'emerald' },
                          { key: 'sms', label: 'Mensaje SMS', sub: 'Pasarela Móvil', icon: Send, color: 'purple' },
                          { key: 'email', label: 'Correo E-mail', sub: 'Notificación', icon: Mail, color: 'slate' }
                        ].map(c => {
                          const isAct = selectedChannels[c.key];
                          const Icon = c.icon;
                          return (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => setSelectedChannels(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
                              className={`p-3 rounded-2xl border text-left transition-all ${
                                isAct 
                                  ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500' 
                                  : 'bg-white border-slate-200 opacity-60'
                              }`}
                            >
                              <Icon className={`w-5 h-5 ${isAct ? 'text-blue-600' : 'text-slate-400'}`} />
                              <div className="font-bold text-xs text-slate-800 mt-2">{c.label}</div>
                              <div className="text-[10px] text-slate-500">{c.sub}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-amber-600" />
                          <span className="font-bold text-xs text-amber-900">
                            Reintentar automáticamente hasta que conteste durante el día
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={retryUntilAnswer}
                          onChange={(e) => setRetryUntilAnswer(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </div>
                      {retryUntilAnswer && (
                        <div className="flex items-center gap-3 text-xs text-amber-800 pt-2 border-t border-amber-200">
                          <span>Máximo de reintentos por paciente:</span>
                          <select
                            value={maxRetries}
                            onChange={(e) => setMaxRetries(Number(e.target.value))}
                            className="bg-white border border-amber-300 rounded-xl px-2.5 py-1 font-bold text-slate-800"
                          >
                            <option value={1}>1 reintento</option>
                            <option value={2}>2 reintentos</option>
                            <option value={3}>3 reintentos (Recomendado)</option>
                            <option value={5}>5 reintentos</option>
                          </select>
                          <span className="text-[11px] text-slate-500">
                            (Se espaciarán automáticamente dentro de las 10 horas operativas)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Horarios de Operación: 8:00 AM a 6:00 PM */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Horarios Permitidos (10 Horas: 08:00 AM - 06:00 PM • 350 llamadas/hora)
                        </label>
                        <span className="text-xs text-slate-500">{selectedFranjas.length} franjas seleccionadas</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-200">
                        {FRANJAS_HORARIAS_10H.map(franja => {
                          const isSel = selectedFranjas.includes(franja);
                          return (
                            <button
                              key={franja}
                              type="button"
                              onClick={() => {
                                setSelectedFranjas(prev => 
                                  isSel ? prev.filter(f => f !== franja) : [...prev, franja]
                                );
                              }}
                              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                                isSel
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {franja}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* =================================================================== */}
                {/* PASO 4: DIRECTRIZ IA & LUGAR / SEDE                                 */}
                {/* =================================================================== */}
                {wizardStep === 4 && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Nombre de la Campaña
                      </label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full text-sm font-semibold p-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Sede o Lugar de Atención Asignado
                      </label>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-slate-400" />
                        <select
                          value={sedeLugar}
                          onChange={(e) => setSedeLugar(e.target.value)}
                          className="w-full text-xs p-3 border border-slate-300 rounded-2xl bg-white font-medium"
                        >
                          <option value="Sede Principal - Manizales (Caldas)">Sede Principal - Manizales (Caldas)</option>
                          <option value="Sede Ambulatoria - Chinchiná">Sede Ambulatoria - Chinchiná</option>
                          <option value="Sede Villamaría - Centro Materno">Sede Villamaría - Centro Materno</option>
                          <option value="Sede La Dorada - Especialidades">Sede La Dorada - Especialidades</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Instrucciones Clínicas para el Agente IA de Voz y Mensajes
                      </label>
                      <textarea
                        rows={4}
                        value={promptDirectriz}
                        onChange={(e) => setPromptDirectriz(e.target.value)}
                        className="w-full text-xs p-3.5 border border-slate-300 rounded-2xl font-mono text-slate-800 focus:ring-2 focus:ring-blue-500"
                        placeholder="Ejemplo: Indicar al paciente que debe acudir en ayunas para la toma de glicemia y perfil lipídico..."
                      />
                    </div>
                  </div>
                )}

                {/* =================================================================== */}
                {/* PASO 5: RESUMEN, SALDO RESIDUAL Y LANZAMIENTO                       */}
                {/* =================================================================== */}
                {wizardStep === 5 && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        Campaña Validada Dentro del Cupo GSM Autorizado
                      </div>
                      <p>
                        El aforo diario no sobrepasa las 3.500 llamadas en ninguna fecha programada. Se garantizará la emisión fluida sin colapsar el Gateway GSM OpenVox.
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-3">
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500">Campaña:</span>
                        <strong className="text-slate-800">{campaignName}</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500">Frecuencia & Calendario:</span>
                        <strong className="text-slate-800">{campaignSchedule.summary} ({campaignSchedule.selectedDates.length} fechas hábiles)</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500">Capacidad Máxima Diaria:</span>
                        <strong className="text-emerald-700">3.500 llamadas/día (08:00 AM - 06:00 PM)</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500">Segmentación Cruzada:</span>
                        <strong className="text-slate-800">
                          {crossSegmentSelection.join(', ') || 'Todo el segmento'}
                        </strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500">Población Objetivo Asignada:</span>
                        <strong className="text-emerald-700">{campaignTargetPatients.length} paciente(s) verificados</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500">Horarios (08:00 AM - 06:00 PM):</span>
                        <strong className="text-slate-800">{selectedFranjas.length} franjas seleccionadas</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500">Política de Reintentos:</span>
                        <strong className="text-slate-800">
                          {retryUntilAnswer ? `Hasta ${maxRetries} reintentos automáticos` : 'Sin reintentos'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sede asignada:</span>
                        <strong className="text-slate-800">{sedeLugar}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botones de Navegación del Wizard */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                  {wizardStep > 1 ? (
                    <Button
                      variant="outline"
                      onClick={handlePrevStep}
                      className="text-xs gap-1.5 rounded-xl"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                  ) : (
                    <div />
                  )}

                  {wizardStep < 5 ? (
                    <Button
                      onClick={handleNextStep}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 rounded-xl shadow-xs"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleLaunchCampaign}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-md rounded-xl font-bold"
                    >
                      <Sparkles className="w-4 h-4" />
                      Confirmar y Reservar Cupo GSM
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL INTERACTIVO: DETALLE DE DÍA DE LA RUTA 3280 Y PROMPTS IA             */}
      {/* ========================================================================= */}
      <Dialog open={isRoadmapDayOpen} onOpenChange={setIsRoadmapDayOpen}>
        <DialogContent className="w-[95%] max-w-3xl sm:w-[90%] max-h-[85vh] overflow-y-auto p-0 rounded-3xl">
          {selectedRoadmapDay && (
            <div className="space-y-4">
              {/* Cabecera del día */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white rounded-t-3xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        {selectedRoadmapDay.specificItem ? selectedRoadmapDay.specificItem.nombre : 'Ruta Preventiva Res. 3280'}
                      </span>
                      {selectedRoadmapDay.campaigns?.length > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                          {selectedRoadmapDay.campaigns.length} Campaña(s) Activa(s)
                        </span>
                      )}
                    </div>
                    <DialogTitle className="text-lg font-bold mt-1 text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      Fecha: {selectedRoadmapDay.isoDate} ({selectedRoadmapDay.dayOfMonth} de {(() => {
                        const mIdx = new Date(selectedRoadmapDay.isoDate + 'T12:00:00').getMonth();
                        const mObj = MESES_TITULOS[mIdx];
                        return typeof mObj === 'string' ? mObj : (mObj?.nombre || '');
                      })()} {activeYear})
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-300 mt-0.5">
                      {selectedRoadmapDay.callsResolucion?.length || 0} cita(s) Resolución 3280 • {selectedRoadmapDay.campaigns?.length || 0} campaña(s) asignadas a este día.
                    </DialogDescription>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Aforo Gateway GSM OpenVox
                    </div>
                    <div className="text-xs font-bold text-emerald-400">
                      {(selectedRoadmapDay.totalLlamadasResolucion || 0) + (selectedRoadmapDay.campaigns?.length ? selectedRoadmapDay.campaigns.reduce((a, c) => a + (c.pacientes_asignados || 0), 0) : 0)} / {DAILY_CALL_CAPACITY} llamadas
                    </div>
                    <div className="text-[9px] text-slate-400">
                      Saldo restante: {selectedRoadmapDay.cupoDisponible ?? (DAILY_CALL_CAPACITY - (selectedRoadmapDay.totalLlamadasResolucion || 0))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contenido interactivo: ¿Qué se le dirá a los pacientes ese día? */}
              <div className="p-5 pt-0 space-y-4">
                
                {/* 1. SECCIÓN DE CAMPAÑAS ASIGNADAS A ESTE DÍA */}
                {selectedRoadmapDay.campaigns && selectedRoadmapDay.campaigns.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-amber-900 flex items-center justify-between border-b border-amber-200 pb-1">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Campañas Hospitalarias Programadas para esta Fecha ({selectedRoadmapDay.campaigns.length}):
                      </span>
                      <span className="text-[11px] font-semibold text-amber-700">Canal de Emisión Automática</span>
                    </div>

                    <div className="space-y-3">
                      {selectedRoadmapDay.campaigns.map((camp, campIdx) => {
                        const rawCampPatients = (Array.isArray(camp.pacientes_detalle) && camp.pacientes_detalle.length > 0)
                          ? camp.pacientes_detalle
                          : getCampaignFilteredPatients(
                              visiblePatients,
                              camp.tipo_origen,
                              { id: camp.origen_id, nombre: camp.origen_nombre },
                              camp.tipo_origen === 'curso_vida' ? camp.segmento_riesgos : camp.segmento_cursos
                            ).map(p => {
                              const cv = getPatientCursoVida(p);
                              const gr = getPatientGrupoRiesgo(p);
                              return {
                                id: p.id,
                                nombre: p.nombre,
                                documento: p.cc || p.numero_documento || p.documento,
                                telefono: p.telefono,
                                edad: p.edad,
                                curso_vida: cv.nombre,
                                cursoVidaId: cv.id,
                                cursoVidaColorHex: cv.colorHex,
                                grupo_riesgo: gr.nombre,
                                grupoRiesgoId: gr.id,
                                grupoRiesgoColorHex: gr.colorHex
                              };
                            });

                        const campPatients = doctorAccess.restricted
                          ? rawCampPatients.filter(p => isPatientAssignedToDoctor(p, user))
                          : rawCampPatients;

                        return (
                          <div key={campIdx} className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="font-black text-slate-900 text-sm">{camp.nombre}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                                {camp.canal || 'Llamada Telefónica'}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                              <div><strong>Sede:</strong> {camp.lugar || 'Sede Principal - Manizales'}</div>
                              <div><strong>Horarios de llamada:</strong> {Array.isArray(camp.horarios) ? camp.horarios.join(', ') : '08:00 AM - 06:00 PM'}</div>
                              <div><strong>Reintentos:</strong> {camp.reintentos ? `Hasta ${camp.reintentos} reintentos` : 'Sin reintentos'}</div>
                              <div><strong>Audiencia:</strong> {campPatients.length} pacientes asignados (100% segmentados)</div>
                            </div>

                            {/* ¿Qué se le dirá al paciente en la campaña? */}
                            <div className="p-3 bg-white rounded-xl border border-amber-200/80 space-y-1">
                              <div className="text-[10px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                ¿Qué le dirá el Agente IA al paciente en esta llamada?
                              </div>
                              <p className="text-[11px] text-slate-700 font-mono italic">
                                "{camp.directriz_ia || 'Llamada de tamizaje preventivo y demanda inducida para control de salud en el hospital.'}"
                              </p>
                            </div>

                            {/* Listado de Pacientes Asignados a la Campaña */}
                            <div className="mt-3 pt-2.5 border-t border-amber-200/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-amber-700" />
                                  Pacientes Asignados a esta Campaña ({campPatients.length}):
                                </span>
                                <span className="text-[10px] text-amber-800 font-medium">
                                  Filtro: {camp.tipo_origen === 'curso_vida' ? `${camp.origen_nombre} + ${(camp.segmento_riesgos || []).join(', ')}` : `${camp.origen_nombre} + ${(camp.segmento_cursos || []).join(', ')}`}
                                </span>
                              </div>

                              {campPatients.length === 0 ? (
                                <div className="p-3 bg-white/90 rounded-xl text-center text-slate-500 text-[11px] border border-amber-200">
                                  No hay pacientes en la base de datos que coincidan con la segmentación de esta campaña.
                                </div>
                              ) : (
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {campPatients.map((pat, pIdx) => (
                                    <div key={pat.id || pIdx} className="p-2.5 bg-white rounded-xl border border-amber-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-xs">
                                      <div>
                                        <div className="font-bold text-slate-900 text-xs">{pat.nombre}</div>
                                        <div className="text-[10px] text-slate-500 font-mono">
                                          CC: {pat.documento || pat.cc} • Tel: {pat.telefono} • {pat.edad} años
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: pat.cursoVidaColorHex || '#10b981' }}>
                                          {pat.curso_vida || 'Juventud'}
                                        </span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: pat.grupoRiesgoColorHex || '#06b6d4' }}>
                                          {pat.grupo_riesgo || 'Enfermedades Respiratorias'}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            const promptText = generateIndividualClinicalPrompt(
                                              { nombre: pat.nombre, cc: pat.documento || pat.cc, telefono: pat.telefono },
                                              camp.nombre,
                                              pat.curso_vida || camp.origen_nombre,
                                              pat.grupo_riesgo || (camp.segmento_riesgos?.[0] || 'General'),
                                              camp.nombre,
                                              camp.directriz_ia,
                                              camp.lugar
                                            );
                                            setSelectedPromptPatient({ ...pat, accion3280: camp.nombre, indicaciones: camp.directriz_ia, promptText });
                                          }}
                                          className="text-[10px] h-6 px-2 border-amber-300 text-amber-900 hover:bg-amber-100 font-bold"
                                        >
                                          <Sparkles className="w-3 h-3 text-amber-600 mr-1" />
                                          Guion IA
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. SECCIÓN DE CITAS RESOLUCIÓN 3280 */}
                {(() => {
                  let calls = selectedRoadmapDay.callsResolucion || [];
                  if (selectedRoadmapDay.specificItem && selectedRoadmapDay.specificType === 'curso_vida') {
                    calls = calls.filter(c => c.cursoVidaId === selectedRoadmapDay.specificItem.id);
                  } else if (selectedRoadmapDay.specificItem && selectedRoadmapDay.specificType === 'grupo_riesgo') {
                    calls = calls.filter(c => c.grupoRiesgoId === selectedRoadmapDay.specificItem.id);
                  }

                  return (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-800 flex items-center justify-between border-b border-slate-200 pb-1">
                        <span className="flex items-center gap-1.5">
                          <Stethoscope className="w-4 h-4 text-blue-600" />
                          Llamadas Normativas Resolución 3280 ({calls.length}):
                        </span>
                        <span className="text-slate-500 text-[11px] font-normal">
                          Horario: 08:00 AM a 06:00 PM (10h • 350 llam/h)
                        </span>
                      </div>

                      {calls.length === 0 ? (
                        <div className="p-4 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                          {selectedRoadmapDay.campaigns?.length > 0 
                            ? `No hay llamadas normativas de la Resolución 3280 agendadas para ${selectedRoadmapDay.specificItem ? selectedRoadmapDay.specificItem.nombre : 'este programa'} en esta fecha. Toda la franja está disponible para la campaña.`
                            : 'No hay citas de la Resolución 3280 programadas para este día. El cupo del Gateway GSM está disponible para campañas hospitalarias.'}
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {calls.map((cItem, cIdx) => (
                            <div 
                              key={cIdx}
                              className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-all flex flex-col justify-between items-start gap-2 shadow-xs"
                            >
                              <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-xs">{cItem.nombre}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">CC: {cItem.documento}</span>
                                  <span 
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                                    style={{ backgroundColor: cItem.cursoVidaColorHex }}
                                  >
                                    {cItem.cursoVidaNombre}
                                  </span>
                                  <span 
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                                    style={{ backgroundColor: cItem.grupoRiesgoColorHex }}
                                  >
                                    {cItem.grupoRiesgoNombre}
                                  </span>
                                </div>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const promptText = generateIndividualClinicalPrompt(
                                      { nombre: cItem.nombre, cc: cItem.documento, telefono: cItem.telefono },
                                      cItem.accion3280,
                                      cItem.cursoVidaNombre,
                                      cItem.grupoRiesgoNombre
                                    );
                                    setSelectedPromptPatient({ ...cItem, promptText });
                                  }}
                                  className="text-xs shrink-0 rounded-lg gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  Ver Guion IA Completo
                                </Button>
                              </div>

                              <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                                <Stethoscope className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="font-semibold text-blue-900">{cItem.accion3280}</span>
                                <span className="text-[9px] px-1 bg-slate-100 rounded text-slate-600 font-mono">CUPS: {cItem.cups}</span>
                                {cItem.indicaciones && (
                                  <span className="text-[10px] text-slate-500 italic">· {cItem.indicaciones}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Panel de Prompt IA Individualizado */}
                {selectedPromptPatient && (
                  <div className="p-4 bg-slate-950 text-slate-200 rounded-2xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Guion y Prompt Clínico de Voz para {selectedPromptPatient.nombre}
                      </span>
                      <button 
                        onClick={() => setSelectedPromptPatient(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      {selectedPromptPatient.promptText}
                    </pre>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-slate-100">
                  {/* Botón rápido para agregar campaña en esta fecha */}
                  {!(doctorAccess.restricted && visibleProgramas.length === 0) ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsRoadmapDayOpen(false);
                        const mIdx = new Date(selectedRoadmapDay.isoDate + 'T12:00:00').getMonth();
                        const hasSpecific =
                          selectedRoadmapDay.specificItem &&
                          (selectedRoadmapDay.specificType === 'curso_vida' || selectedRoadmapDay.specificType === 'grupo_riesgo');
                        const item = hasSpecific ? selectedRoadmapDay.specificItem : (visibleProgramas[0] || PROGRAMAS_3280[0]);
                        const type = hasSpecific ? selectedRoadmapDay.specificType : 'curso_vida';
                        handleCellClick(type, item, mIdx, 'wizard', selectedRoadmapDay.isoDate);
                      }}
                      className="text-xs rounded-xl font-bold border-blue-200 text-blue-700 hover:bg-blue-50 gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Programar Nueva Campaña en esta Fecha
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                      Sin Cursos de Vida asignados para crear campañas
                    </span>
                  )}

                  <Button
                    onClick={() => setIsRoadmapDayOpen(false)}
                    className="text-xs rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800"
                  >
                    Cerrar Expediente
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default React.memo(ResolutionAnnualMatrix);
