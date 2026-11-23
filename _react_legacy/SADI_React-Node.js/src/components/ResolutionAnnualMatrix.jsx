// ==============================================================================
// ResolutionAnnualMatrix.jsx - CRONOGRAMA UNIFICADO ANUAL SADI (CALI · RES. 3280)
// - 1 solo almanaque unificado: Ruta Res. 3280 + 7 Cursos de Vida (A-G)
//   + 11 Grupos de Riesgo Priorizados (incluye Planificación Familiar, Vacunación PAI
//   y Salud Oral), divididos por celdas combinadas y centradas.
// - Tope operativo real: 500 llamadas IA/día (50/h · 08:00 AM - 06:00 PM · Lun-Sáb
//   excluyendo domingos y festivos de Colombia), ordenadas por prioridad P1 -> P5,
//   con derivación automática del excedente a SMS Respaldo (R1-04).
// - CERO grupos de riesgo inventados: 100% datos clínicos reales de Supabase.
// - Wizard de Campaña con salto libre entre pasos (1..5 en cualquier orden) y
//   Paso 4 "Filtro de Ubicación" con DIVIPOLA Santiago de Cali (Rural/Urbano).
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  PROGRAMAS_3280,
  MESES_TITULOS,
} from '@/services/census400kService';
import { GRUPOS_RIESGO_CATALOG } from '@/services/gruposRiesgoCatalog';
import { getCursoVidaIcon, getGrupoRiesgoIcon } from '@/components/CursosVidaIcons';
import { CURSOS_VIDA_PALETTE, GRUPOS_RIESGO_PALETTE } from '@/services/clinicalPalettes';
import CampaignSchedulingCalendar from '@/components/CampaignSchedulingCalendar';
import { CursoVidaBadge, GruposRiesgoBadges } from '@/components/PatientClinicalBadges';
import {
  validateCampaignCallCapacity,
  generateIndividualClinicalPrompt,
  getPatientCursoVida,
  getPatientGruposRiesgo,
  getPriorityMeta,
  DAILY_CALL_CAPACITY,
  CALLS_PER_HOUR,
  COLOMBIA_HOLIDAYS,
  isOperationalWorkday,
} from '@/services/callCapacityService';
import {
  CALI_IPS_SEDES,
  getCaliComunas,
  getCaliBarriosForComuna,
  getCaliCorregimientos,
  getCaliVeredasForCorregimiento,
  getCaliCentrosPobladosForCorregimiento,
  formatLocationFilterSummary,
} from '@/services/caliDivipola';
import { NOSHOW_POLICY } from '@/services/noShowFollowupService';
import { demanda3280Service } from '@/services/demanda3280Service';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllowedCursoKeysForUser,
  isCampaignAllowedForUser,
  canonicalizeCursoKey,
  formatCursosVidaLabel,
} from '@/services/cursoVidaConfig';
import {
  Users, Calendar, Phone, Mail, MessageSquare, Send,
  CheckCircle2, Clock, ChevronRight, AlertCircle,
  Download, Sparkles, ChevronLeft, ArrowRight,
  Info, Zap, Building2, RotateCcw, Gauge, ShieldCheck,
  MapPin, Trees, Search, BellRing,
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

// Hora fija oficial de lanzamiento para todas las campañas programadas por el personal
const CAMPAIGN_LAUNCH_TIME = '08:30 AM';

function ResolutionAnnualMatrix({
  selectedYear = 2026,
  onYearChange = () => {},
  onDownloadExcel = () => {},
}) {
  const { toast } = useToast();
  const { user } = useAuth();

  // Permisos efectivos del usuario por Cursos de Vida (7 Cursos: A - G)
  const doctorAccess = useMemo(() => getAllowedCursoKeysForUser(user), [user]);

  // Constantes de Fecha Real
  const CURRENT_REAL_YEAR = 2026;
  const CURRENT_REAL_MONTH = 10; // Noviembre (0 = Ene ... 10 = Nov, 11 = Dic)

  // Año activo (2025, 2026, 2027)
  const [internalYear, setInternalYear] = useState(selectedYear || CURRENT_REAL_YEAR);
  const activeYear = internalYear;

  useEffect(() => {
    if (selectedYear && selectedYear !== internalYear) {
      setInternalYear(selectedYear);
    }
  }, [selectedYear]);

  const handleYearChange = (newYear) => {
    if (newYear < CURRENT_REAL_YEAR - 1 || newYear > CURRENT_REAL_YEAR + 1) return;
    setInternalYear(newYear);
    if (typeof onYearChange === 'function') onYearChange(newYear);
  };

  // Estados de datos reales agregados 100% en Postgres (sin tope de 1,000 filas)
  const [cronogramaSummary, setCronogramaSummary] = useState({
    year: CURRENT_REAL_YEAR,
    dailyCap: DAILY_CALL_CAPACITY,
    totalPatients: 0,
    totalEligibleYear: 0,
    noRiskCount: 0,
    censoByCurso: {},
    censoByRiesgo: {},
    cursosMatrix: {},
    riesgosMatrix: {},
    priorityMatrix: {},
    dailyBreakdown: {},
    holidays: [],
  });
  const [loadingPatients, setLoadingPatients] = useState(true);

  // Opciones geográficas reales en BD (para fusionar con catálogo oficial DIVIPOLA Cali)
  const [dbGeoOptions, setDbGeoOptions] = useState({
    comunas: [],
    barriosPorComuna: {},
    corregimientos: [],
    veredasPorCorregimiento: {},
    centrosPobladosPorCorregimiento: {},
  });

  // Cohorte paginada en modal Wizard / Ver Cohorte
  const [cohortRows, setCohortRows] = useState([]);
  const [cohortTotalCount, setCohortTotalCount] = useState(0);
  const [cohortPage, setCohortPage] = useState(1);
  const [cohortSearch, setCohortSearch] = useState('');
  const [debouncedCohortSearch, setDebouncedCohortSearch] = useState('');
  const [loadingCohort, setLoadingCohort] = useState(false);

  // Campañas existentes en localStorage para validar aforo acumulado
  const [existingCampaigns, setExistingCampaigns] = useState([]);

  // Vista del calendario unificado: 'ambos' (unificado por defecto) | 'cursos_vida' | 'grupos_riesgo'
  const [activeTab, setActiveTab] = useState('ambos');

  // Modal y Celda seleccionada
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('wizard'); // 'wizard' | 'cohort'
  const [selectedContext, setSelectedContext] = useState(null);

  // Estados del Wizard de Campaña (5 Pasos con salto libre en cualquier orden)
  const [wizardStep, setWizardStep] = useState(1);
  const [campaignSchedule, setCampaignSchedule] = useState({
    frequency: 'diario',
    config: {},
    selectedDates: [],
    summary: 'Diario (Lunes a Sábado sin festivos)',
  });
  const [campaignName, setCampaignName] = useState('');
  const [crossSegmentSelection, setCrossSegmentSelection] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState({
    call: true,
    whatsapp: true,
    sms: true,
    email: false,
  });
  const [retryUntilAnswer, setRetryUntilAnswer] = useState(true);
  const [maxRetries, setMaxRetries] = useState(3);
  const [sedeLugar, setSedeLugar] = useState(CALI_IPS_SEDES[0]);
  const [promptDirectriz, setPromptDirectriz] = useState('');

  // PASO 4: Filtro de Ubicación DIVIPOLA Santiago de Cali (Cascada Rural / Urbano)
  const [ubicacionZona, setUbicacionZona] = useState('todas'); // 'todas' | 'Rural' | 'Urbana'
  const [ubicacionCorregimiento, setUbicacionCorregimiento] = useState('todos');
  const [ubicacionVereda, setUbicacionVereda] = useState('todas');
  const [ubicacionCentroPoblado, setUbicacionCentroPoblado] = useState('todos');
  const [ubicacionComuna, setUbicacionComuna] = useState('todas');
  const [ubicacionBarrio, setUbicacionBarrio] = useState('todos');

  // Modal de Detalle de Día (paginado con búsqueda real desde Postgres)
  const [selectedRoadmapDay, setSelectedRoadmapDay] = useState(null);
  const [isRoadmapDayOpen, setIsRoadmapDayOpen] = useState(false);
  // PopUp informativo de las tarjetas del encabezado: null | 'riesgo' | 'prioridad' | 'inasistencias'
  const [activeInfoPopup, setActiveInfoPopup] = useState(null);
  const [dayModalRows, setDayModalRows] = useState([]);
  const [dayModalMeta, setDayModalMeta] = useState({
    dayTotalAll: 0,
    llamadasIa: 0,
    smsRespaldo: 0,
    totalCount: 0,
    priorityCounts: {},
  });
  const [dayModalPage, setDayModalPage] = useState(1);
  const [dayModalSearch, setDayModalSearch] = useState('');
  const [debouncedDaySearch, setDebouncedDaySearch] = useState('');
  const [loadingDayModal, setLoadingDayModal] = useState(false);
  const [selectedPromptPatient, setSelectedPromptPatient] = useState(null);

  const doctorCursosParam = useMemo(() => {
    if (!doctorAccess.restricted) return null;
    return doctorAccess.keys.map((c) => (c === 'materno_perinatal' ? 'preventivo_mujer' : c));
  }, [doctorAccess]);

  // 1. Cargar matriz 100% real desde Postgres RPC para el año activo + opciones geo Cali
  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      setLoadingPatients(true);
      try {
        const hospId = user?.hospitalId || user?.hospital_id || null;
        const [sumRes, geoOpts] = await Promise.all([
          supabase.rpc('get_cronograma_res3280_summary', {
            p_hospital_id: hospId,
            p_doctor_cursos: doctorCursosParam,
            p_year: activeYear,
          }),
          demanda3280Service.getFilterOptions(hospId, doctorCursosParam),
        ]);

        if (!active) return;
        const { data: sumData, error } = sumRes;
        if (!error && sumData) {
          setCronogramaSummary({
            year: Number(sumData.year || activeYear),
            dailyCap: Number(sumData.daily_cap || DAILY_CALL_CAPACITY),
            totalPatients: Number(sumData.total_patients || 0),
            totalEligibleYear: Number(sumData.total_eligible_year || 0),
            noRiskCount: Number(sumData.no_risk_count || 0),
            censoByCurso: sumData.censo_by_curso || {},
            censoByRiesgo: sumData.censo_by_riesgo || {},
            cursosMatrix: sumData.cursos_matrix || {},
            riesgosMatrix: sumData.riesgos_matrix || {},
            priorityMatrix: sumData.priority_matrix || {},
            dailyBreakdown: sumData.daily_breakdown || {},
            holidays: Array.isArray(sumData.holidays) ? sumData.holidays : [],
          });
        }

        if (geoOpts) {
          setDbGeoOptions({
            comunas: geoOpts.comunas || [],
            barriosPorComuna: geoOpts.barriosPorComuna || {},
            corregimientos: geoOpts.corregimientos || [],
            veredasPorCorregimiento: geoOpts.veredasPorCorregimiento || {},
            centrosPobladosPorCorregimiento: geoOpts.centrosPobladosPorCorregimiento || {},
          });
        }

        const stored = JSON.parse(localStorage.getItem('sadi_campaigns_v2') || '[]');
        setExistingCampaigns(Array.isArray(stored) ? stored : []);
      } catch (err) {
        console.error('Error cargando datos para cronograma:', err);
      } finally {
        if (active) setLoadingPatients(false);
      }
    }
    loadInitialData();

    const handleStorageChange = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('sadi_campaigns_v2') || '[]');
        setExistingCampaigns(Array.isArray(stored) ? stored : []);
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      active = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, doctorCursosParam, activeYear]);

  // Debounce búsqueda cohorte y modal día
  useEffect(() => {
    const t = setTimeout(() => {
      setCohortPage(1);
      setDebouncedCohortSearch(cohortSearch);
    }, 300);
    return () => clearTimeout(t);
  }, [cohortSearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDayModalPage(1);
      setDebouncedDaySearch(dayModalSearch);
    }, 300);
    return () => clearTimeout(t);
  }, [dayModalSearch]);

  // Cargar cohorte filtrada en tiempo real desde Postgres (incluye Paso 4 Filtro Ubicación Cali)
  useEffect(() => {
    if (!isModalOpen || !selectedContext) return;
    let active = true;
    async function loadCohort() {
      setLoadingCohort(true);
      try {
        const hospId = user?.hospitalId || user?.hospital_id || null;
        const { data, error } = await supabase.rpc('get_cronograma_cohort_paginated', {
          p_hospital_id: hospId,
          p_type: selectedContext.type,
          p_item_key: String(selectedContext.item.id),
          p_month: selectedContext.monthIndex + 1,
          p_cross_items: crossSegmentSelection.length > 0 ? crossSegmentSelection : null,
          p_doctor_cursos: doctorCursosParam,
          p_search: debouncedCohortSearch?.trim() || null,
          p_page: cohortPage,
          p_page_size: 25,
          p_zona: ubicacionZona !== 'todas' ? ubicacionZona : null,
          p_comuna: ubicacionZona === 'Urbana' && ubicacionComuna !== 'todas' ? ubicacionComuna : null,
          p_barrio: ubicacionZona === 'Urbana' && ubicacionBarrio !== 'todos' ? ubicacionBarrio : null,
          p_corregimiento: ubicacionZona === 'Rural' && ubicacionCorregimiento !== 'todos' ? ubicacionCorregimiento : null,
          p_vereda: ubicacionZona === 'Rural' && ubicacionVereda !== 'todas' ? ubicacionVereda : null,
          p_centro_poblado: ubicacionZona === 'Rural' && ubicacionCentroPoblado !== 'todos' ? ubicacionCentroPoblado : null,
          p_year: activeYear,
        });
        if (!active) return;
        if (!error && data) {
          setCohortTotalCount(Number(data.total_count || 0));
          const rows = Array.isArray(data.rows) ? data.rows : [];
          setCohortRows(
            rows.map((p) => ({
              ...p,
              id: p.patient_id || p.id,
              nombre: p.name || p.nombre || 'Paciente sin nombre',
              documento: p.document || p.documento || '',
              cc: p.document || p.documento || '',
              telefono: p.phone || p.telefono || 'Sin teléfono',
              fecha_nacimiento: p.birthdate,
            }))
          );
        } else {
          setCohortTotalCount(0);
          setCohortRows([]);
        }
      } catch {
        if (active) {
          setCohortTotalCount(0);
          setCohortRows([]);
        }
      } finally {
        if (active) setLoadingCohort(false);
      }
    }
    loadCohort();
    return () => { active = false; };
  }, [
    isModalOpen,
    selectedContext,
    crossSegmentSelection,
    cohortPage,
    debouncedCohortSearch,
    ubicacionZona,
    ubicacionComuna,
    ubicacionBarrio,
    ubicacionCorregimiento,
    ubicacionVereda,
    ubicacionCentroPoblado,
    activeYear,
    user,
    doctorCursosParam,
  ]);

  // Cargar pacientes REALES del Día seleccionado en el Modal de Día (paginado + prioridad P1..P5)
  useEffect(() => {
    if (!isRoadmapDayOpen || !selectedRoadmapDay?.isoDate) return;
    let active = true;
    async function loadDayPatients() {
      setLoadingDayModal(true);
      try {
        const hospId = user?.hospitalId || user?.hospital_id || null;
        const filterType =
          selectedRoadmapDay.specificType === 'curso_vida'
            ? 'curso_vida'
            : selectedRoadmapDay.specificType === 'grupo_riesgo'
            ? 'grupo_riesgo'
            : 'all';
        const itemKey = selectedRoadmapDay.specificItem?.id ? String(selectedRoadmapDay.specificItem.id) : null;

        const { data, error } = await supabase.rpc('get_cronograma_day_patients_paginated', {
          p_hospital_id: hospId,
          p_date: selectedRoadmapDay.isoDate,
          p_filter_type: filterType,
          p_item_key: itemKey,
          p_doctor_cursos: doctorCursosParam,
          p_search: debouncedDaySearch?.trim() || null,
          p_page: dayModalPage,
          p_page_size: 25,
        });
        if (!active) return;
        if (!error && data) {
          setDayModalMeta({
            dayTotalAll: Number(data.day_total_all || 0),
            llamadasIa: Number(data.llamadas_ia || 0),
            smsRespaldo: Number(data.sms_respaldo || 0),
            totalCount: Number(data.total_count || 0),
            priorityCounts: data.priority_counts || {},
          });
          const rows = Array.isArray(data.rows) ? data.rows : [];
          setDayModalRows(
            rows.map((p) => {
              const cv = getPatientCursoVida(p);
              const riesgos = getPatientGruposRiesgo(p);
              return {
                ...p,
                id: p.patient_id,
                nombre: p.name || 'Paciente sin nombre',
                documento: p.document || 'N/A',
                telefono: p.phone || 'Sin teléfono',
                cursoVidaId: cv.id,
                cursoVidaNombre: cv.nombre,
                cursoVidaColorHex: cv.colorHex,
                grupos_riesgo: Array.isArray(p.grupos_riesgo) ? p.grupos_riesgo : riesgos.map((r) => r.nombre),
                accion3280: p.accion_3280 || 'Valoración Integral Res. 3280',
                cups: p.cups_3280 || '890201',
                prioridad: Number(p.prioridad_llamada || 5),
                canalAsignado: p.canal_asignado || 'Llamada IA (Voz)',
              };
            })
          );
        } else {
          setDayModalRows([]);
        }
      } catch (err) {
        console.error('Error cargando expediente del día:', err);
        if (active) setDayModalRows([]);
      } finally {
        if (active) setLoadingDayModal(false);
      }
    }
    loadDayPatients();
    return () => { active = false; };
  }, [isRoadmapDayOpen, selectedRoadmapDay, dayModalPage, debouncedDaySearch, user, doctorCursosParam]);

  const isMonthPast = (year, mIdx) => {
    if (year < CURRENT_REAL_YEAR) return true;
    if (year === CURRENT_REAL_YEAR && mIdx < CURRENT_REAL_MONTH) return true;
    return false;
  };

  // 7 Cursos de Vida visibles según permisos
  const visibleProgramas = useMemo(() => {
    if (!doctorAccess.restricted) return PROGRAMAS_3280;
    if (doctorAccess.keys.length === 0) return [];
    return PROGRAMAS_3280.filter((prog) => {
      const canon = canonicalizeCursoKey(prog.key || prog.id || prog.nombre);
      return doctorAccess.codeSet.has(prog.id) || (canon && doctorAccess.keySet.has(canon));
    });
  }, [doctorAccess]);

  const visibleCampaigns = useMemo(() => {
    if (!doctorAccess.restricted) return existingCampaigns;
    if (doctorAccess.keys.length === 0) return [];
    return existingCampaigns.filter((c) => isCampaignAllowedForUser(c, user));
  }, [existingCampaigns, doctorAccess, user]);

  // Mapa exacto 365 días derivado 1:1 de daily_breakdown en Postgres (0 aproximaciones)
  const holidaySet = useMemo(() => {
    const s = new Set(COLOMBIA_HOLIDAYS);
    (cronogramaSummary.holidays || []).forEach((h) => s.add(h));
    return s;
  }, [cronogramaSummary.holidays]);

  const roadmap365 = useMemo(() => {
    const map = {};
    const daily = cronogramaSummary.dailyBreakdown || {};

    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(activeYear, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(activeYear, m, d, 12, 0, 0);
        const iso = `${activeYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSunday = dt.getDay() === 0;
        const isHoliday = holidaySet.has(iso);
        const srvDay = daily[iso] || null;
        const totalDay = Number(srvDay?.total || 0);
        const llamadasDay = Number(srvDay?.llamadas ?? Math.min(totalDay, DAILY_CALL_CAPACITY));
        const smsDay = Number(srvDay?.sms ?? Math.max(0, totalDay - DAILY_CALL_CAPACITY));
        const cursoCounts = srvDay?.cursos || {};
        const riesgoCounts = srvDay?.riesgos || {};
        const priorityCounts = srvDay?.priorities || {};

        map[iso] = {
          isoDate: iso,
          dayIndex: d,
          dayOfMonth: d,
          isSunday,
          isHoliday,
          cursosVidaPresentes: new Set(Object.keys(cursoCounts).filter((k) => Number(cursoCounts[k]) > 0)),
          gruposRiesgoPresentes: new Set(Object.keys(riesgoCounts).filter((k) => Number(riesgoCounts[k]) > 0).map(Number)),
          cursoCounts,
          riesgoCounts,
          priorityCounts,
          totalLlamadasResolucion: totalDay,
          llamadasAsignadas: llamadasDay,
          smsRespaldo: smsDay,
          cupoDisponible: Math.max(0, DAILY_CALL_CAPACITY - llamadasDay),
        };
      }
    }
    return map;
  }, [cronogramaSummary, activeYear, holidaySet]);

  // Cache de días por mes
  const allMonthsDays = useMemo(() => {
    return Array.from({ length: 12 }, (_, mIdx) => {
      const daysInMonth = new Date(activeYear, mIdx + 1, 0).getDate();
      const days = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${activeYear}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push(
          roadmap365[iso] || {
            isoDate: iso,
            dayOfMonth: d,
            isSunday: new Date(activeYear, mIdx, d, 12, 0, 0).getDay() === 0,
            isHoliday: holidaySet.has(iso),
            cursosVidaPresentes: new Set(),
            gruposRiesgoPresentes: new Set(),
            cursoCounts: {},
            riesgoCounts: {},
            priorityCounts: {},
            totalLlamadasResolucion: 0,
            llamadasAsignadas: 0,
            smsRespaldo: 0,
            cupoDisponible: DAILY_CALL_CAPACITY,
          }
        );
      }
      return days;
    });
  }, [activeYear, roadmap365, holidaySet]);

  const getDaysForMonth = (mIdx) => allMonthsDays[mIdx] || [];

  // Totales anuales conciliados 100%
  const yearlyStats = useMemo(() => {
    let totalEligible = 0;
    let totalVoice = 0;
    let totalSmsBackup = 0;
    Object.values(roadmap365).forEach((d) => {
      totalEligible += Number(d.totalLlamadasResolucion || 0);
      totalVoice += Number(d.llamadasAsignadas || 0);
      totalSmsBackup += Number(d.smsRespaldo || 0);
    });
    return {
      totalEligible: totalEligible || Number(cronogramaSummary.totalEligibleYear || 0),
      totalVoice,
      totalSmsBackup,
    };
  }, [roadmap365, cronogramaSummary.totalEligibleYear]);

  // Conteo anual real por cada prioridad (P1 a P5) desde Postgres
  const priorityYearlyTotals = useMemo(() => {
    const totals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const pMat = cronogramaSummary?.priorityMatrix || {};
    let hasMatrixValues = false;
    [1, 2, 3, 4, 5].forEach((pNum) => {
      const arr = pMat[String(pNum)];
      if (Array.isArray(arr)) {
        const s = arr.reduce((acc, v) => acc + Number(v || 0), 0);
        totals[pNum] = s;
        if (s > 0) hasMatrixValues = true;
      }
    });
    if (!hasMatrixValues) {
      Object.values(roadmap365).forEach((d) => {
        [1, 2, 3, 4, 5].forEach((pNum) => {
          totals[pNum] += Number(d.priorityCounts?.[String(pNum)] || 0);
        });
      });
    }
    return totals;
  }, [cronogramaSummary?.priorityMatrix, roadmap365]);

  // Matrices mensuales exactas desde Postgres
  const matrixCursosCounts = useMemo(() => {
    const grid = {};
    PROGRAMAS_3280.forEach((prog) => {
      const srvArr = cronogramaSummary?.cursosMatrix?.[prog.id];
      grid[prog.id] = Array.from({ length: 12 }, (_, idx) => Number(srvArr?.[idx] || 0));
    });
    return grid;
  }, [cronogramaSummary]);

  const matrixRiesgosCounts = useMemo(() => {
    const grid = {};
    GRUPOS_RIESGO_CATALOG.forEach((rg) => {
      const srvArr = cronogramaSummary?.riesgosMatrix?.[String(rg.id)];
      grid[rg.id] = Array.from({ length: 12 }, (_, idx) => Number(srvArr?.[idx] || 0));
    });
    return grid;
  }, [cronogramaSummary]);

  // Opciones Cali DIVIPOLA fusionadas con datos reales de Supabase
  const caliComunasList = useMemo(() => getCaliComunas(dbGeoOptions.comunas), [dbGeoOptions.comunas]);
  const caliBarriosList = useMemo(
    () => (ubicacionComuna !== 'todas' ? getCaliBarriosForComuna(ubicacionComuna, dbGeoOptions.barriosPorComuna) : []),
    [ubicacionComuna, dbGeoOptions.barriosPorComuna]
  );
  const caliCorregimientosList = useMemo(
    () => getCaliCorregimientos(dbGeoOptions.corregimientos),
    [dbGeoOptions.corregimientos]
  );
  const caliVeredasList = useMemo(
    () =>
      ubicacionCorregimiento !== 'todos'
        ? getCaliVeredasForCorregimiento(ubicacionCorregimiento, dbGeoOptions.veredasPorCorregimiento)
        : [],
    [ubicacionCorregimiento, dbGeoOptions.veredasPorCorregimiento]
  );
  const caliCentrosPobladosList = useMemo(
    () =>
      ubicacionCorregimiento !== 'todos'
        ? getCaliCentrosPobladosForCorregimiento(ubicacionCorregimiento, dbGeoOptions.centrosPobladosPorCorregimiento)
        : [],
    [ubicacionCorregimiento, dbGeoOptions.centrosPobladosPorCorregimiento]
  );

  // Campañas asociadas a una celda
  const getCellCampaigns = (type, item, monthIndex) => {
    if (!Array.isArray(visibleCampaigns)) return [];
    return visibleCampaigns.filter((c) => {
      if (!c) return false;
      let matchesItem = false;
      if (type === 'curso_vida') {
        const itemKey = canonicalizeCursoKey(item?.key || item?.id || item?.nombre);
        const origKey = c.tipo_origen === 'curso_vida' ? canonicalizeCursoKey(c.origen_id || c.origen_nombre) : null;
        matchesItem =
          (c.tipo_origen === 'curso_vida' &&
            (c.origen_id === item?.id || c.origen_nombre === item?.nombre || (itemKey && origKey === itemKey))) ||
          (Array.isArray(c.segmento_cursos) &&
            c.segmento_cursos.some((seg) => seg === item?.nombre || (itemKey && canonicalizeCursoKey(seg) === itemKey)));
      } else {
        matchesItem =
          (c.tipo_origen === 'grupo_riesgo' && (c.origen_id === item?.id || c.origen_nombre === item?.nombre)) ||
          (Array.isArray(c.segmento_riesgos) && c.segmento_riesgos.includes(item?.nombre));
      }
      if (!matchesItem) return false;

      const rawDates = Array.isArray(c.fechas_ejecucion)
        ? c.fechas_ejecucion
        : Array.isArray(c.config_frecuencia?.selectedDates)
        ? c.config_frecuencia.selectedDates
        : [];
      const dates = rawDates.filter((d) => typeof d === 'string');
      const monthPrefix = `${activeYear}-${String(monthIndex + 1).padStart(2, '0')}`;
      const hasDateInMonth = dates.some((d) => d.startsWith(monthPrefix));

      const mTitle = typeof MESES_TITULOS[monthIndex] === 'string' ? MESES_TITULOS[monthIndex] : MESES_TITULOS[monthIndex]?.nombre || '';
      const matchesYear = Number(c.ano) === Number(activeYear);
      const matchesMonth =
        c.mes_index === monthIndex ||
        (typeof c.mes_objetivo === 'string' && mTitle && c.mes_objetivo.toLowerCase().startsWith(mTitle.slice(0, 3).toLowerCase()));
      return hasDateInMonth || (matchesYear && matchesMonth);
    });
  };

  // Abrir Modal de Expediente del Día
  const handleOpenDayDetail = (dayData, item = null, type = null) => {
    const iso = dayData.isoDate;
    const dayCampaigns = (Array.isArray(visibleCampaigns) ? visibleCampaigns : []).filter((c) => {
      if (!c) return false;
      const rawDates = Array.isArray(c.fechas_ejecucion)
        ? c.fechas_ejecucion
        : Array.isArray(c.config_frecuencia?.selectedDates)
        ? c.config_frecuencia.selectedDates
        : [];
      if (!rawDates.includes(iso)) return false;
      if (!item) return true;
      if (type === 'curso_vida') {
        const itemKey = canonicalizeCursoKey(item?.key || item?.id || item?.nombre);
        const origKey = c.tipo_origen === 'curso_vida' ? canonicalizeCursoKey(c.origen_id || c.origen_nombre) : null;
        return (
          (c.tipo_origen === 'curso_vida' &&
            (c.origen_id === item?.id || c.origen_nombre === item?.nombre || (itemKey && origKey === itemKey))) ||
          (Array.isArray(c.segmento_cursos) &&
            c.segmento_cursos.some((seg) => seg === item?.nombre || (itemKey && canonicalizeCursoKey(seg) === itemKey)))
        );
      }
      return (
        (c.tipo_origen === 'grupo_riesgo' && (c.origen_id === item?.id || c.origen_nombre === item?.nombre)) ||
        (Array.isArray(c.segmento_riesgos) && c.segmento_riesgos.includes(item?.nombre))
      );
    });

    setDayModalPage(1);
    setDayModalSearch('');
    setDebouncedDaySearch('');
    setDayModalRows([]);
    setSelectedPromptPatient(null);
    setSelectedRoadmapDay({
      ...dayData,
      campaigns: dayCampaigns,
      specificItem: item,
      specificType: type,
    });
    setIsRoadmapDayOpen(true);
  };

  // Abrir Modal de Wizard o Cohorte
  const handleCellClick = (type, item, monthIndex, mode = 'wizard', targetDateISO = null) => {
    const mObj = MESES_TITULOS[monthIndex];
    const monthName = typeof mObj === 'string' ? mObj : mObj?.nombre || `Mes ${monthIndex + 1}`;

    if (doctorAccess.restricted) {
      if (doctorAccess.keys.length === 0) {
        toast({
          title: 'Sin Cursos de Vida Asignados',
          description: 'Solicita al administrador que habilite tus cursos de vida antes de programar campañas.',
          variant: 'destructive',
        });
        return;
      }
      if (type === 'curso_vida') {
        const itemKey = canonicalizeCursoKey(item?.key || item?.id || item?.nombre);
        if (!itemKey || !doctorAccess.keySet.has(itemKey)) {
          toast({
            title: 'Acceso Restringido por Curso de Vida',
            description: `Tu perfil solo tiene acceso a: ${formatCursosVidaLabel(user?.cursos_vida_asignados)}.`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    if (mode === 'wizard' && isMonthPast(activeYear, monthIndex)) {
      toast({
        title: 'Periodo Histórico Finalizado',
        description: `No es posible crear campañas en meses anteriores (${monthName} ${activeYear}). Selecciona el mes actual o un periodo futuro.`,
        variant: 'destructive',
      });
      return;
    }

    setCohortPage(1);
    setCohortSearch('');
    setDebouncedCohortSearch('');
    setCohortRows([]);
    setUbicacionZona('todas');
    setUbicacionCorregimiento('todos');
    setUbicacionVereda('todas');
    setUbicacionCentroPoblado('todos');
    setUbicacionComuna('todas');
    setUbicacionBarrio('todos');

    setSelectedContext({
      type,
      item,
      monthIndex,
      monthName,
      targetDateISO,
    });

    const defaultName =
      type === 'curso_vida'
        ? `Campaña ${item.nombre} - ${monthName} ${activeYear}`
        : `Campaña Riesgo: ${item.nombre} - ${monthName} ${activeYear}`;

    setCampaignName(defaultName);
    setWizardStep(1);
    setCrossSegmentSelection([]);
    setPromptDirectriz(
      type === 'curso_vida'
        ? `Llamar a los pacientes del curso ${item.nombre} programados en ${monthName} ${activeYear} para valoración preventiva Res. 3280 en Santiago de Cali (${sedeLugar}).`
        : `Llamar a los pacientes del grupo de riesgo "${item.nombre}" en ${monthName} ${activeYear} para control prioritario en Santiago de Cali (${sedeLugar}).`
    );

    setModalMode(mode);
    setIsModalOpen(true);
  };

  // Conteo exacto en la celda activa
  const activeCellCount = useMemo(() => {
    if (!selectedContext) return 0;
    if (selectedContext.type === 'curso_vida') {
      return Number(matrixCursosCounts[selectedContext.item.id]?.[selectedContext.monthIndex] || 0);
    }
    return Number(matrixRiesgosCounts[selectedContext.item.id]?.[selectedContext.monthIndex] || 0);
  }, [selectedContext, matrixCursosCounts, matrixRiesgosCounts]);

  const hasCustomFilter =
    crossSegmentSelection.length > 0 ||
    ubicacionZona !== 'todas' ||
    Boolean(debouncedCohortSearch?.trim());

  const effectiveTargetCount = hasCustomFilter ? cohortTotalCount : cohortTotalCount || activeCellCount;

  // Configuración inicial para CampaignSchedulingCalendar
  const initialCalendarConfig = useMemo(() => {
    const targetMonth = selectedContext?.monthIndex ?? CURRENT_REAL_MONTH;
    const targetYear = activeYear || CURRENT_REAL_YEAR;
    let targetDate = selectedContext?.targetDateISO;

    if (!targetDate) {
      const isCurrentM = targetYear === CURRENT_REAL_YEAR && targetMonth === CURRENT_REAL_MONTH;
      const startD = isCurrentM ? new Date().getDate() : 1;
      const daysInM = new Date(targetYear, targetMonth + 1, 0).getDate();
      for (let d = startD; d <= daysInM; d++) {
        const iso = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (isOperationalWorkday(iso)) {
          targetDate = iso;
          break;
        }
      }
      if (!targetDate) targetDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
    }

    return {
      mes: targetMonth,
      year: targetYear,
      fechaInicio: targetDate,
    };
  }, [selectedContext?.monthIndex, selectedContext?.targetDateISO, activeYear]);

  // Fechas efectivas (si el usuario salta directo al Paso 5 sin tocar Paso 1, toma la fecha hábil por defecto)
  const effectiveScheduleDates = useMemo(() => {
    const raw = campaignSchedule?.selectedDates || [];
    if (raw.length > 0) return raw;
    return initialCalendarConfig?.fechaInicio ? [initialCalendarConfig.fechaInicio] : [];
  }, [campaignSchedule?.selectedDates, initialCalendarConfig?.fechaInicio]);

  // Previsualización en vivo de capacidad GSM (500 llamadas/día + SMS respaldo R1-04)
  const liveCapacityCheck = useMemo(() => {
    return validateCampaignCallCapacity(
      effectiveScheduleDates,
      Math.max(1, effectiveTargetCount),
      roadmap365,
      existingCampaigns,
      { allowSmsOverflow: true }
    );
  }, [effectiveScheduleDates, effectiveTargetCount, roadmap365, existingCampaigns]);

  // NAVEGACIÓN LIBRE ENTRE PASOS (SIN ORDEN OBLIGATORIO: 1->5, 4->2, 1->3, etc.)
  const handleNextStep = () => {
    if (wizardStep < 5) setWizardStep((prev) => prev + 1);
  };
  const handlePrevStep = () => {
    if (wizardStep > 1) setWizardStep((prev) => prev - 1);
  };

  // Resumen legible del filtro de ubicación Cali (Paso 4)
  const locationFilterSummary = useMemo(
    () =>
      formatLocationFilterSummary({
        zona: ubicacionZona,
        comuna: ubicacionComuna,
        barrio: ubicacionBarrio,
        corregimiento: ubicacionCorregimiento,
        vereda: ubicacionVereda,
        centroPoblado: ubicacionCentroPoblado,
      }),
    [
      ubicacionZona,
      ubicacionComuna,
      ubicacionBarrio,
      ubicacionCorregimiento,
      ubicacionVereda,
      ubicacionCentroPoblado,
    ]
  );

  // Guardar y Lanzar Campaña
  const handleLaunchCampaign = () => {
    let effectiveCrossCursos = crossSegmentSelection;
    if (doctorAccess.restricted) {
      if (doctorAccess.keys.length === 0) {
        toast({
          title: 'Sin Permisos de Creación',
          description: 'No tienes Cursos de Vida asignados para programar campañas.',
          variant: 'destructive',
        });
        return;
      }
      if (selectedContext?.type === 'curso_vida') {
        const itemKey = canonicalizeCursoKey(selectedContext.item?.key || selectedContext.item?.id || selectedContext.item?.nombre);
        if (!itemKey || !doctorAccess.keySet.has(itemKey)) {
          toast({
            title: 'Curso de Vida No Autorizado',
            description: 'Solo puedes crear programaciones dentro de tus Cursos de Vida asignados.',
            variant: 'destructive',
          });
          return;
        }
      } else if (crossSegmentSelection.length > 0) {
        effectiveCrossCursos = crossSegmentSelection.filter((seg) => {
          const canon = canonicalizeCursoKey(seg);
          return canon && doctorAccess.keySet.has(canon);
        });
      }
    }

    if (effectiveScheduleDates.length === 0) {
      toast({
        title: 'Fecha hábil requerida',
        description: 'Selecciona al menos una fecha hábil (Lunes a Sábado sin festivos) en el Paso 1.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedChannels.call && !liveCapacityCheck.allowed) {
      toast({
        title: 'Aforo GSM no disponible',
        description: liveCapacityCheck.message,
        variant: 'destructive',
      });
      return;
    }

    const firstDate = effectiveScheduleDates[0];
    const detectedYear = firstDate ? new Date(`${firstDate}T12:00:00`).getFullYear() : activeYear;

    const assignedPatientsList = cohortRows.map((p) => {
      const cv = getPatientCursoVida(p);
      const riesgos = getPatientGruposRiesgo(p);
      return {
        id: p.id,
        nombre: p.nombre,
        documento: p.documento || p.cc,
        telefono: p.telefono,
        edad: p.edad,
        curso_vida: cv.nombre,
        cursoVidaId: cv.id,
        cursoVidaColorHex: cv.colorHex,
        grupo_riesgo: riesgos[0]?.nombre || null,
        grupos_riesgo: riesgos.map((r) => r.nombre),
      };
    });

    const newCampaign = {
      id: `camp_${Date.now()}`,
      tipo_origen: selectedContext.type,
      origen_id: selectedContext.item.id,
      origen_nombre: selectedContext.item.nombre,
      nombre: campaignName || `Campaña ${selectedContext.item.nombre} - ${selectedContext.monthName} ${detectedYear}`,
      mes_objetivo: selectedContext.monthName,
      mes_index: selectedContext.monthIndex,
      ano: detectedYear,
      canal: Object.keys(selectedChannels).filter((k) => selectedChannels[k]).join(', '),
      canales_detalle: selectedChannels,
      horarios: [CAMPAIGN_LAUNCH_TIME],
      hora_lanzamiento: CAMPAIGN_LAUNCH_TIME,
      reintentos: retryUntilAnswer ? maxRetries : 0,
      politica_inasistencia: NOSHOW_POLICY.resumenCorto,
      lugar: `${sedeLugar} · ${locationFilterSummary}`,
      filtro_ubicacion: {
        municipio: 'Santiago de Cali',
        dane: '76001',
        zona: ubicacionZona,
        corregimiento: ubicacionCorregimiento,
        vereda: ubicacionVereda,
        centro_poblado: ubicacionCentroPoblado,
        comuna: ubicacionComuna,
        barrio: ubicacionBarrio,
        resumen: locationFilterSummary,
      },
      directriz_ia: promptDirectriz,
      estado: 'programada',
      fecha_creacion: new Date().toISOString(),
      config_frecuencia: { ...campaignSchedule, selectedDates: effectiveScheduleDates },
      fechas_ejecucion: effectiveScheduleDates,
      segmento_cursos:
        selectedContext.type === 'curso_vida'
          ? [selectedContext.item.nombre]
          : effectiveCrossCursos.length > 0
          ? effectiveCrossCursos
          : ['Todos los Cursos de Vida (A - G)'],
      segmento_riesgos:
        selectedContext.type === 'grupo_riesgo'
          ? [selectedContext.item.nombre]
          : crossSegmentSelection,
      creado_por_id: user?.id || null,
      creado_por_email: user?.email || null,
      creado_por_nombre: user?.name || user?.nombre || null,
      pacientes_asignados: effectiveTargetCount,
      llamadas_ia_asignadas: selectedChannels.call ? liveCapacityCheck.voiceAssignedTotal : 0,
      sms_respaldo_asignados: selectedChannels.call ? liveCapacityCheck.smsOverflowTotal : 0,
      pacientes_ids: assignedPatientsList.map((p) => p.id),
      pacientes_detalle: assignedPatientsList,
      enviados: 0,
      entregados: 0,
    };

    try {
      const updated = [newCampaign, ...existingCampaigns];
      setExistingCampaigns(updated);
      localStorage.setItem('sadi_campaigns_v2', JSON.stringify(updated));
    } catch (e) {
      console.error('Error guardando campaña:', e);
    }

    toast({
      title: 'Campaña Programada con Control de Aforo (500/día)',
      description: liveCapacityCheck.hasOverflow
        ? `"${newCampaign.nombre}" agendada en ${locationFilterSummary}: ${liveCapacityCheck.voiceAssignedTotal.toLocaleString('es-CO')} llamadas IA + ${liveCapacityCheck.smsOverflowTotal.toLocaleString('es-CO')} respaldos SMS (R1-04).`
        : `"${newCampaign.nombre}" agendada en ${locationFilterSummary} dentro del límite real de ${DAILY_CALL_CAPACITY} llamadas IA/día.`,
    });

    setIsModalOpen(false);
  };

  // Renderizado reutilizable de una fila del calendario unificado (Curso de Vida o Grupo de Riesgo)
  const renderMatrixRow = (rowType, item) => {
    const isCurso = rowType === 'curso_vida';
    const pal = isCurso
      ? CURSOS_VIDA_PALETTE[item.id] || CURSOS_VIDA_PALETTE.E
      : GRUPOS_RIESGO_PALETTE[item.id] || GRUPOS_RIESGO_PALETTE[2];
    const IconComponent = isCurso ? getCursoVidaIcon(item.id) : getGrupoRiesgoIcon(item.id);
    const censoReal = isCurso
      ? Number(cronogramaSummary?.censoByCurso?.[item.id] || 0)
      : Number(cronogramaSummary?.censoByRiesgo?.[String(item.id)] || 0);
    const rowMatrix = isCurso ? matrixCursosCounts[item.id] : matrixRiesgosCounts[item.id];
    const prioBadge = !isCurso ? getPriorityMeta(item.prioridad || 4) : null;

    return (
      <tr
        key={`${rowType}-${item.id}`}
        className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors border-b-4 border-slate-100 dark:border-slate-800 group/row"
      >
        {/* Columna Fija */}
        <td className="p-2 sticky left-0 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 z-10 border-r-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="flex items-center gap-2 overflow-hidden">
            <div
              className="shrink-0 p-1.5 rounded-lg border flex items-center justify-center shadow-xs"
              style={{
                backgroundColor: `${pal.colorHex}18`,
                borderColor: `${pal.colorHex}45`,
                color: pal.colorHex,
              }}
            >
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="font-black text-slate-900 dark:text-white text-[11px] flex items-center gap-1">
                <span className="truncate" title={item.nombre}>
                  {item.nombre}
                </span>
                <span
                  className="text-[8.5px] font-black px-1 rounded text-white shrink-0"
                  style={{ backgroundColor: pal.colorHex }}
                >
                  {isCurso ? item.id : `R${item.id}`}
                </span>
              </div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5 flex items-center gap-1">
                <span>Censo BD: {censoReal.toLocaleString('es-CO')}</span>
                {prioBadge && (
                  <span
                    className="text-[8px] font-black px-1 rounded text-white shrink-0"
                    style={{ backgroundColor: prioBadge.colorHex }}
                  >
                    {prioBadge.code}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* 12 Meses */}
        {MESES_TITULOS.map((mObj, mIdx) => {
          const count = Number(rowMatrix?.[mIdx] || 0);
          const hitoClinico = isCurso
            ? item.milestones?.[mIdx]?.label || 'Valoración Res. 3280'
            : item.hitosMeses?.[mIdx] || 'Control prioritario';
          const isPast = isMonthPast(activeYear, mIdx);
          const cellCampaigns = getCellCampaigns(rowType, item, mIdx);
          const days = getDaysForMonth(mIdx);

          // Conciliación EXACTA: la suma de días hábiles del mes equivale exactamente a count
          const monthDailySum = days.reduce((acc, d) => {
            const val = isCurso ? Number(d.cursoCounts?.[item.id] || 0) : Number(d.riesgoCounts?.[String(item.id)] || 0);
            return acc + val;
          }, 0);
          const workdaysCount = days.filter((d) => !d.isSunday && !d.isHoliday).length;

          return (
            <td
              key={mIdx}
              onClick={() => handleCellClick(rowType, item, mIdx, 'wizard')}
              className={`p-1 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0 relative group overflow-hidden ${
                isPast
                  ? 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                  : 'cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20'
              }`}
            >
              <div
                className={`p-1 rounded-xl border text-[9px] flex flex-col justify-between min-h-[106px] overflow-hidden ${
                  isPast
                    ? 'bg-slate-200/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800 text-slate-500 filter grayscale contrast-[75%] opacity-70'
                    : count > 0 || cellCampaigns.length > 0
                    ? 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white group-hover:border-blue-500 group-hover:shadow-sm bg-white dark:bg-slate-900'
                    : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 text-slate-400 group-hover:border-slate-300'
                }`}
                style={!isPast && (count > 0 || cellCampaigns.length > 0) ? { backgroundColor: `${pal.colorHex}0A` } : {}}
                title={
                  isPast
                    ? 'Periodo histórico cerrado (Vencido)'
                    : `${item.nombre} (${MESES_TITULOS[mIdx].nombre} ${activeYear}): ${count.toLocaleString('es-CO')} pacientes elegibles = ${monthDailySum.toLocaleString('es-CO')} contactos programados en ${workdaysCount} días hábiles. Haz clic para crear campaña.`
                }
              >
                {/* Hito clínico */}
                <div className="flex items-center justify-between gap-1 overflow-hidden">
                  <div className="text-[7.5px] truncate text-slate-700 dark:text-slate-300 font-bold leading-tight text-left">
                    {hitoClinico}
                  </div>
                  {cellCampaigns.length > 0 && (
                    <span
                      className="text-[7px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-1 rounded-full shrink-0"
                      title={`${cellCampaigns.length} campaña(s) en este mes`}
                    >
                      {cellCampaigns.length}
                    </span>
                  )}
                </div>

                {/* Mini calendario diario exacto */}
                <div
                  className={`w-full rounded-lg p-0.5 border flex flex-col justify-between my-0.5 ${
                    isPast
                      ? 'bg-slate-100/90 dark:bg-slate-900/60 border-slate-300 dark:border-slate-800'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                  }`}
                >
                  <div className="grid grid-cols-7 gap-[1px] w-full">
                    {days.map((d) => {
                      const resCallsCount = isCurso
                        ? Number(d.cursoCounts?.[item.id] || 0)
                        : Number(d.riesgoCounts?.[String(item.id)] || 0);
                      const dayCamps = cellCampaigns.filter((c) =>
                        (c.fechas_ejecucion || c.config_frecuencia?.selectedDates || []).includes(d.isoDate)
                      );
                      const hasResCalls = resCallsCount > 0;
                      const hasCampCalls = dayCamps.length > 0;
                      const hasCalls = hasResCalls || hasCampCalls;
                      const isNonOp = d.isSunday || d.isHoliday;

                      let bgStyle = {};
                      if (hasCalls && !isNonOp) {
                        if (hasCampCalls && hasResCalls) {
                          bgStyle = {
                            background: `linear-gradient(135deg, ${pal.colorHex} 0%, ${pal.colorHex} 50%, #f59e0b 50%, #f59e0b 100%)`,
                          };
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
                            if (hasCalls && !isNonOp) {
                              handleOpenDayDetail(d, item, rowType);
                            } else if (!isNonOp && !isPast) {
                              handleCellClick(rowType, item, mIdx, 'wizard', d.isoDate);
                            }
                          }}
                          title={
                            d.isHoliday
                              ? `${d.isoDate}: Festivo Colombia (No operativo)`
                              : d.isSunday
                              ? `${d.isoDate}: Domingo (No operativo)`
                              : hasCalls
                              ? `${d.isoDate}: ${resCallsCount.toLocaleString('es-CO')} citas Res. 3280 (${item.nombre}) • ${dayCamps.length} campañas. Clic para ver pacientes reales.`
                              : isPast
                              ? 'Periodo cerrado (Vencido)'
                              : `${d.isoDate}: Sin citas en este corte · Clic para programar campaña.`
                          }
                          style={bgStyle}
                          className={`w-full aspect-square rounded-[1.5px] text-[6.5px] leading-none flex items-center justify-center ${
                            d.isHoliday
                              ? 'bg-amber-100/70 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 opacity-70 cursor-default'
                              : d.isSunday
                              ? 'bg-slate-100/60 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 opacity-40 cursor-default'
                              : hasCalls
                              ? 'text-white font-black hover:scale-125 shadow-sm ring-1 ring-white/60 cursor-pointer transition-transform'
                              : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-slate-100 dark:border-slate-800 cursor-pointer'
                          }`}
                        >
                          {d.dayOfMonth}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[7px] text-slate-600 dark:text-slate-400 mt-0.5 pt-0.5 border-t border-slate-100 dark:border-slate-800 px-0.5">
                    <span
                      className={
                        monthDailySum > 0
                          ? isCurso
                            ? 'text-emerald-700 dark:text-emerald-400 font-bold truncate'
                            : 'text-purple-700 dark:text-purple-400 font-bold truncate'
                          : 'text-slate-400 truncate'
                      }
                    >
                      {monthDailySum.toLocaleString('es-CO')} llam.
                    </span>
                    <span className="text-[6.5px] text-slate-400" title="Días hábiles (Lun-Sáb sin festivos)">
                      {workdaysCount}d
                    </span>
                  </div>
                </div>

                {/* Footer conciliado: pacientes == llamadas */}
                <div className="flex items-center justify-between pt-0.5 border-t border-slate-200/40 dark:border-slate-800">
                  <span
                    className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full truncate max-w-[76%] ${
                      isPast
                        ? 'bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        : count > 0 || cellCampaigns.length > 0
                        ? 'text-white'
                        : 'text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800'
                    }`}
                    style={!isPast && (count > 0 || cellCampaigns.length > 0) ? { backgroundColor: pal.colorHex } : {}}
                  >
                    {count.toLocaleString('es-CO')} pac.
                  </span>
                  {isPast ? (
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" title="Periodo cerrado" />
                  ) : (
                    <span className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-bold text-xs leading-none">+</span>
                  )}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER PRINCIPAL */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 md:p-7 text-white shadow-xl flex flex-col gap-5">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                Resolución 3280 de 2018 • Santiago de Cali (DIVIPOLA 76001)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                Límite Operativo: {DAILY_CALL_CAPACITY} llamadas IA/día ({CALLS_PER_HOUR}/h • 08:00 AM - 06:00 PM • Lun–Sáb sin festivos)
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-400 shrink-0" />
              Cronograma Unificado de Demanda Inducida (Res. 3280)
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2.5">
            {/* Selector de Año */}
            <div className="bg-slate-800/90 p-1 rounded-2xl border border-slate-700 flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleYearChange(CURRENT_REAL_YEAR - 1)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  activeYear === CURRENT_REAL_YEAR - 1
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>2025</span>
              </button>
              <button
                type="button"
                onClick={() => handleYearChange(CURRENT_REAL_YEAR)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  activeYear === CURRENT_REAL_YEAR
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                2026 (Actual)
              </button>
              <button
                type="button"
                onClick={() => handleYearChange(CURRENT_REAL_YEAR + 1)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  activeYear === CURRENT_REAL_YEAR + 1
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span>2027</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Filtro rápido de secciones del almanaque único */}
            <div className="bg-slate-800/80 p-1 rounded-2xl border border-slate-700 flex items-center text-xs font-bold">
              {[
                { id: 'ambos', label: 'Almanaque Unificado' },
                { id: 'cursos_vida', label: 'Cursos de Vida (7)' },
                { id: 'grupos_riesgo', label: 'Grupos de Riesgo (11)' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-2.5 py-1.5 rounded-xl transition-all ${
                    activeTab === t.id ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
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

        {/* Barra de Resumen Conciliado y Accesos a Reglas / Prioridades */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 pt-3 border-t border-white/10 text-xs">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 flex flex-col justify-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Censo Real en BD</div>
            <div className="text-base font-black text-white mt-0.5">
              {Number(cronogramaSummary.totalPatients || 0).toLocaleString('es-CO')}{' '}
              <span className="text-[11px] font-medium text-slate-300">pacientes</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 flex flex-col justify-center">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">
              Elegibles Res. 3280 ({activeYear})
            </div>
            <div className="text-base font-black text-emerald-300 mt-0.5">
              {yearlyStats.totalEligible.toLocaleString('es-CO')}
            </div>
          </div>

          <button
            type="button"
            data-testid="kpi-riesgo-real"
            onClick={() => setActiveInfoPopup('riesgo')}
            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/50 rounded-2xl px-3.5 py-2.5 transition-all cursor-pointer group flex flex-col justify-center"
          >
            <div className="text-[10px] uppercase tracking-wider text-purple-300 font-bold flex items-center justify-between gap-1">
              <span>Con Riesgo Clínico Real</span>
              <Info className="w-3.5 h-3.5 text-purple-300/70 group-hover:text-purple-200 shrink-0" />
            </div>
            <div className="text-base font-black text-purple-200 mt-0.5">
              {Math.max(0, Number(cronogramaSummary.totalPatients || 0) - Number(cronogramaSummary.noRiskCount || 0)).toLocaleString('es-CO')}
            </div>
          </button>

          <button
            type="button"
            data-testid="kpi-prioridad-cola"
            onClick={() => setActiveInfoPopup('prioridad')}
            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/50 rounded-2xl px-3.5 py-2.5 transition-all cursor-pointer group flex items-center justify-between gap-2"
          >
            <div className="text-xs uppercase tracking-wider text-amber-300 font-black">
              Prioridad Cola Voz
            </div>
            <Info className="w-4 h-4 text-amber-300/70 group-hover:text-amber-200 shrink-0" />
          </button>

          <button
            type="button"
            data-testid="kpi-inasistencias"
            onClick={() => setActiveInfoPopup('inasistencias')}
            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 rounded-2xl px-3.5 py-2.5 transition-all cursor-pointer group col-span-2 lg:col-span-1 flex items-center justify-between gap-2"
          >
            <div className="text-xs uppercase tracking-wider text-cyan-300 font-black flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 shrink-0" />
              <span>Inasistencias</span>
            </div>
            <Info className="w-4 h-4 text-cyan-300/70 group-hover:text-cyan-200 shrink-0" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ALMANAQUE UNIFICADO ÚNICO: RUTA RES. 3280 + CURSOS DE VIDA (7) + GRUPOS DE RIESGO (11) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-base shadow-sm shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base md:text-lg flex items-center gap-2 flex-wrap">
                <span>Almanaque Operativo Único • Resolución 3280 ({activeYear})</span>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/50">
                  {visibleProgramas.length} Cursos de Vida + {GRUPOS_RIESGO_CATALOG.length} Grupos de Riesgo
                </span>
                {doctorAccess.restricted && (
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Acceso: {formatCursosVidaLabel(user?.cursos_vida_asignados)}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Haz clic en cualquier día coloreado para ver los pacientes exactos priorizados (P1–P5), o en cualquier mes para crear una campaña con salto libre entre pasos y filtro de ubicación de Cali.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shrink-0">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Hábil con citas
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-400 inline-block" /> Festivo
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-slate-700 inline-block" /> Domingo
            </span>
          </div>
        </div>

        {loadingPatients ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
            Sincronizando almanaque real 3280 ({activeYear}) desde Supabase...
          </div>
        ) : (
          <div className="w-full overflow-x-auto px-2 sm:px-4 pb-4 pt-2">
            <table className="w-full min-w-[1120px] table-fixed text-left border-collapse">
              <colgroup>
                <col className="w-[16%]" />
                {Array.from({ length: 12 }).map((_, i) => (
                  <col key={i} className="w-[7%]" />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                  <th className="p-2 sticky left-0 bg-slate-100 dark:bg-slate-900 z-20 border-r-2 border-slate-300 dark:border-slate-800 overflow-hidden">
                    <div className="truncate font-black text-slate-800 dark:text-white">
                      Ruta / Cohorte Clínica
                    </div>
                  </th>
                  {MESES_TITULOS.map((mObj, idx) => (
                    <th key={idx} className="p-1 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 overflow-hidden">
                      <div className="font-black text-slate-800 dark:text-slate-200 text-[11px] truncate">{mObj.abreviatura}</div>
                      <div className="text-[8px] font-normal text-slate-500 dark:text-slate-400 capitalize truncate">{mObj.nombre}</div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="text-xs">
                {/* ================================================================= */}
                {/* FILA SUPERIOR CONSOLIDADA: RUTA RES. 3280 (CONCILIACIÓN 100% EXACTA) */}
                {/* ================================================================= */}
                <tr className="bg-emerald-50/40 dark:bg-slate-950 text-slate-800 dark:text-white border-b-4 border-slate-200 dark:border-slate-800">
                  <td className="p-2 sticky left-0 bg-emerald-50 dark:bg-slate-950 z-10 border-r-2 border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 truncate">
                          Ruta Res. 3280
                        </div>
                        <div className="text-[8.5px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                          {yearlyStats.totalVoice.toLocaleString('es-CO')} llam. IA · {yearlyStats.totalEligible.toLocaleString('es-CO')} pac.
                        </div>
                        {yearlyStats.totalSmsBackup > 0 && (
                          <div className="text-[8px] font-bold text-amber-700 dark:text-amber-400 truncate">
                            +{yearlyStats.totalSmsBackup.toLocaleString('es-CO')} SMS respaldo (R1-04)
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {MESES_TITULOS.map((_, mIdx) => {
                    const days = getDaysForMonth(mIdx);
                    const monthVoice = days.reduce((acc, d) => acc + Number(d.llamadasAsignadas || 0), 0);
                    const monthEligible = days.reduce((acc, d) => acc + Number(d.totalLlamadasResolucion || 0), 0);
                    const monthSms = days.reduce((acc, d) => acc + Number(d.smsRespaldo || 0), 0);
                    const workdaysCount = days.filter((d) => !d.isSunday && !d.isHoliday).length;
                    const monthCap = workdaysCount * DAILY_CALL_CAPACITY;
                    const isPast = isMonthPast(activeYear, mIdx);

                    return (
                      <td
                        key={mIdx}
                        className={`p-1 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 overflow-hidden align-top ${
                          isPast ? 'bg-slate-100/90 dark:bg-slate-900/60 filter grayscale contrast-[75%] opacity-70' : 'bg-white dark:bg-slate-950'
                        }`}
                      >
                        <div
                          className={`w-full rounded-lg p-1 border flex flex-col justify-between min-h-[68px] ${
                            isPast
                              ? 'bg-slate-200/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800'
                              : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/60 shadow-xs'
                          }`}
                        >
                          <div className="grid grid-cols-7 gap-[1px] w-full">
                            {days.map((d) => {
                              const cvIds = Array.from(d.cursosVidaPresentes || []);
                              const colors = cvIds.map((id) => CURSOS_VIDA_PALETTE[id]?.colorHex || '#3b82f6');
                              const isNonOp = d.isSunday || d.isHoliday;
                              const hasCalls = !isNonOp && Number(d.totalLlamadasResolucion || 0) > 0;

                              let bgStyle = {};
                              if (hasCalls) {
                                if (colors.length === 1) {
                                  bgStyle = { backgroundColor: colors[0] };
                                } else if (colors.length > 1) {
                                  bgStyle = {
                                    background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[0]} 50%, ${colors[1]} 50%, ${colors[1]} 100%)`,
                                  };
                                } else {
                                  bgStyle = { backgroundColor: '#10b981' };
                                }
                              }

                              return (
                                <button
                                  key={d.isoDate}
                                  type="button"
                                  onClick={() => {
                                    if (!isNonOp) handleOpenDayDetail(d, null, 'all');
                                  }}
                                  title={
                                    d.isHoliday
                                      ? `${d.isoDate}: Festivo Colombia (0 llamadas)`
                                      : d.isSunday
                                      ? `${d.isoDate}: Domingo (0 llamadas)`
                                      : `${d.isoDate}: ${d.llamadasAsignadas}/${DAILY_CALL_CAPACITY} llamadas IA${d.smsRespaldo > 0 ? ` + ${d.smsRespaldo} SMS respaldo` : ''} (${d.totalLlamadasResolucion} pacientes). Clic para ver detalle.`
                                  }
                                  style={bgStyle}
                                  className={`w-full aspect-square rounded-[1.5px] text-[7px] leading-none flex items-center justify-center ${
                                    d.isHoliday
                                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 cursor-default'
                                      : d.isSunday
                                      ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 opacity-40 cursor-default'
                                      : hasCalls
                                      ? 'text-white font-black hover:scale-125 shadow-sm ring-1 ring-white/60 cursor-pointer transition-transform'
                                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800 cursor-pointer'
                                  }`}
                                >
                                  {d.dayOfMonth}
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-1 pt-0.5 border-t border-slate-100 dark:border-slate-800 px-0.5 space-y-0.5">
                            <div className="flex items-center justify-between text-[7.5px]">
                              <span className="text-emerald-700 dark:text-emerald-400 font-black truncate" title={`Capacidad mensual: ${monthCap.toLocaleString('es-CO')} llam. (${workdaysCount} días hábiles × 500)`}>
                                {monthVoice.toLocaleString('es-CO')} llam.
                              </span>
                              <span className="text-[6.5px] text-slate-400">{workdaysCount}d</span>
                            </div>
                            <div className="flex items-center justify-between text-[7px] text-slate-500 dark:text-slate-400">
                              <span className="truncate font-semibold">{monthEligible.toLocaleString('es-CO')} pac.</span>
                              {monthSms > 0 && (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">+{monthSms} SMS</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* ================================================================= */}
                {/* CELDA COMBINADA Y CENTRADA: CURSOS DE VIDA (7 RUTAS · A - G)     */}
                {/* ================================================================= */}
                {(activeTab === 'ambos' || activeTab === 'cursos_vida') && (
                  <>
                    <tr data-testid="divider-cursos-vida" className="bg-blue-600/10 dark:bg-blue-950/60 border-y-2 border-blue-300 dark:border-blue-800">
                      <td colSpan={13} className="py-2.5 px-4 text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                          <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-blue-900 dark:text-blue-200">
                            Cursos de Vida
                          </span>
                        </div>
                      </td>
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
                              Tu perfil clínico aún no tiene Cursos de Vida habilitados. Solicita al administrador asignar tus categorías en Gestión de Personal.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      visibleProgramas.map((prog) => renderMatrixRow('curso_vida', prog))
                    )}
                  </>
                )}

                {/* ================================================================= */}
                {/* CELDA COMBINADA Y CENTRADA: GRUPOS DE RIESGO (11 COHORTES REALES) */}
                {/* ================================================================= */}
                {(activeTab === 'ambos' || activeTab === 'grupos_riesgo') && (
                  <>
                    <tr data-testid="divider-grupos-riesgo" className="bg-purple-600/10 dark:bg-purple-950/60 border-y-2 border-purple-300 dark:border-purple-800">
                      <td colSpan={13} className="py-2.5 px-4 text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 dark:bg-purple-400" />
                          <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-purple-900 dark:text-purple-200">
                            Grupos de Riesgo
                          </span>
                        </div>
                      </td>
                    </tr>

                    {GRUPOS_RIESGO_CATALOG.map((rg) => renderMatrixRow('grupo_riesgo', rg))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL PRINCIPAL: WIZARD DE CAMPAÑA (SALTO LIBRE 1..5) O VER COHORTE       */}
      {/* ========================================================================= */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95%] sm:w-[92%] max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl">
          {/* Header del Modal */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white rounded-t-3xl">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {selectedContext?.type === 'curso_vida' ? 'Campaña desde Curso de Vida' : 'Campaña desde Grupo de Riesgo'}
                </span>
                <DialogTitle className="text-xl font-bold mt-2 flex items-center gap-2">
                  {selectedContext?.item?.nombre} ({selectedContext?.monthName} {activeYear})
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-1">
                  Cohorte objetivo: <strong>{effectiveTargetCount.toLocaleString('es-CO')} pacientes verificados</strong> • Ubicación: <strong>{locationFilterSummary}</strong>
                </DialogDescription>
              </div>

              <div className="flex bg-slate-800 p-1.5 rounded-2xl text-xs font-bold border border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalMode('wizard')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    modalMode === 'wizard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Wizard de Campaña
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('cohort')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    modalMode === 'cohort' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ver Cohorte ({effectiveTargetCount.toLocaleString('es-CO')})
                </button>
              </div>
            </div>

            {/* Stepper LIBRE: Cada paso es un botón clicable sin restricciones de orden */}
            {modalMode === 'wizard' && (
              <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Navegación libre: haz clic en cualquier paso (1 a 5) en el orden que necesites.</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  {[
                    { step: 1, label: '1. Calendario & Aforo' },
                    { step: 2, label: selectedContext?.type === 'curso_vida' ? '2. Grupos de Riesgo' : '2. Cursos de Vida' },
                    { step: 3, label: '3. Canales & Reintentos' },
                    { step: 4, label: '4. Filtro de Ubicación' },
                    { step: 5, label: '5. Resumen & Saldo' },
                  ].map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      data-testid={`wizard-step-${s.step}`}
                      onClick={() => setWizardStep(s.step)}
                      className={`py-2 px-2 rounded-xl font-bold transition-all cursor-pointer border ${
                        wizardStep === s.step
                          ? 'bg-blue-500 text-white border-blue-400 shadow-md scale-[1.02]'
                          : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white hover:border-blue-400/50'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cuerpo del Modal */}
          <div className="p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            {modalMode === 'cohort' ? (
              /* VISTA COHORTE DE PACIENTES CON CURSO DE VIDA + GRUPOS DE RIESGO REALES */
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                      Pacientes en este Segmento ({cohortTotalCount.toLocaleString('es-CO')} en BD)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Filtro territorial activo: {locationFilterSummary}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={cohortSearch}
                    onChange={(e) => setCohortSearch(e.target.value)}
                    placeholder="Buscar paciente o cédula en toda la cohorte..."
                    className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                  />
                </div>

                {loadingCohort ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Cargando cohorte real desde Supabase...
                  </div>
                ) : cohortRows.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No hay pacientes que cumplan simultáneamente con los filtros clínicos y de ubicación seleccionados.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-2xl">
                      {cohortRows.map((pat) => {
                        const prio = getPriorityMeta(pat.prioridad_llamada || 5);
                        return (
                          <div
                            key={pat.id}
                            className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 flex-wrap">
                                <span>{pat.nombre}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-black border ${prio.badgeClass}`}>
                                  {prio.shortLabel}
                                </span>
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                                {pat.tipo_documento || 'CC'}: {pat.documento} • Tel: {pat.telefono} • {pat.edad} años
                              </div>
                              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {pat.zona === 'Rural'
                                  ? `Rural · ${pat.corregimiento || 'Cali'}${pat.vereda ? ` · ${pat.vereda}` : ''}${pat.centro_poblado ? ` · ${pat.centro_poblado}` : ''}`
                                  : `Urbano · ${pat.comuna || 'Cali'}${pat.barrio ? ` · ${pat.barrio}` : ''}`}
                              </div>
                            </div>
                            <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                              <CursoVidaBadge patient={pat} />
                              <GruposRiesgoBadges patient={pat} maxVisible={3} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {cohortTotalCount > 25 && (
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-1">
                        <span>
                          Página <strong>{cohortPage}</strong> de{' '}
                          <strong>{Math.max(1, Math.ceil(cohortTotalCount / 25)).toLocaleString('es-CO')}</strong> (
                          {cohortTotalCount.toLocaleString('es-CO')} pacientes)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={cohortPage <= 1}
                            onClick={() => setCohortPage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                          >
                            Anterior
                          </button>
                          <button
                            type="button"
                            disabled={cohortPage >= Math.ceil(cohortTotalCount / 25)}
                            onClick={() => setCohortPage((p) => Math.min(Math.ceil(cohortTotalCount / 25), p + 1))}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* WIZARD DE CAMPAÑA - PASOS 1 A 5 CON NAVEGACIÓN LIBRE */
              <div className="space-y-6">
                {/* PASO 1: CALENDARIO & CAPACIDAD 500 LLAMADAS/DÍA */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl p-4 text-xs text-blue-950 dark:text-blue-100 flex items-start gap-3">
                      <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Paso 1: Calendario & Control de Capacidad ({DAILY_CALL_CAPACITY} llamadas IA/día)</strong>
                        <p className="mt-0.5 text-blue-800 dark:text-blue-200">
                          Horario: <strong>08:00 AM a 06:00 PM ({CALLS_PER_HOUR} llamadas/hora = {DAILY_CALL_CAPACITY}/día)</strong> de Lunes a Sábado excluyendo domingos y festivos de Colombia. Cualquier excedente se deriva automáticamente a <strong>SMS Respaldo (R1-04)</strong> respetando prioridad P1 → P5.
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

                {/* PASO 2: SEGMENTACIÓN CRUZADA (OPCIONAL, SIN BLOQUEO) */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-4 text-xs text-purple-950 dark:text-purple-100">
                      <strong>
                        {selectedContext?.type === 'curso_vida'
                          ? 'Paso 2: Cruce opcional con Grupos de Riesgo Priorizados (11 reales)'
                          : 'Paso 2: Cruce opcional con Cursos de Vida (7 rutas A–G)'}
                      </strong>
                      <p className="mt-0.5 text-purple-800 dark:text-purple-200">
                        {selectedContext?.type === 'curso_vida'
                          ? `Selecciona uno o varios Grupos de Riesgo para cruzar sobre "${selectedContext.item.nombre}", o déjalo sin marcar para incluir toda la cohorte.`
                          : `Selecciona uno o varios Cursos de Vida (A–G) para focalizar "${selectedContext.item.nombre}", o déjalo sin marcar para incluir todos.`}
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          Población objetivo real tras cruce:
                        </span>
                      </div>
                      <span
                        className={`font-bold px-3 py-1 rounded-full text-xs border ${
                          effectiveTargetCount > 0
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {effectiveTargetCount.toLocaleString('es-CO')} paciente(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto p-1">
                      {selectedContext?.type === 'curso_vida' ? (
                        GRUPOS_RIESGO_CATALOG.map((rg) => {
                          const pal = GRUPOS_RIESGO_PALETTE[rg.id] || GRUPOS_RIESGO_PALETTE[2];
                          const IconComponent = getGrupoRiesgoIcon(rg.id);
                          const isSelected = crossSegmentSelection.includes(rg.nombre);
                          const censoRg = Number(cronogramaSummary?.censoByRiesgo?.[String(rg.id)] || 0);
                          return (
                            <div
                              key={rg.id}
                              onClick={() => {
                                setCrossSegmentSelection((prev) =>
                                  isSelected ? prev.filter((x) => x !== rg.nombre) : [...prev, rg.nombre]
                                );
                              }}
                              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                                isSelected
                                  ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 shadow-sm ring-1 ring-purple-500'
                                  : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="p-2.5 rounded-xl shrink-0 text-white" style={{ backgroundColor: pal.colorHex }}>
                                <IconComponent className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-xs text-slate-800 dark:text-white flex items-center justify-between gap-2">
                                  <span className="truncate">{rg.nombre}</span>
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />}
                                </div>
                                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Censo real BD: <strong>{censoRg.toLocaleString('es-CO')}</strong> · {rg.frecuenciaContacto}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        visibleProgramas.map((cv) => {
                          const pal = CURSOS_VIDA_PALETTE[cv.id] || CURSOS_VIDA_PALETTE.E;
                          const IconComponent = getCursoVidaIcon(cv.id);
                          const isSelected = crossSegmentSelection.includes(cv.nombre);
                          return (
                            <div
                              key={cv.id}
                              onClick={() => {
                                setCrossSegmentSelection((prev) =>
                                  isSelected ? prev.filter((x) => x !== cv.nombre) : [...prev, cv.nombre]
                                );
                              }}
                              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 shadow-sm ring-1 ring-blue-500'
                                  : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="p-2.5 rounded-xl shrink-0 text-white" style={{ backgroundColor: pal.colorHex }}>
                                <IconComponent className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-xs text-slate-800 dark:text-white flex items-center justify-between">
                                  <span>
                                    {cv.id}. {cv.nombre}
                                  </span>
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Rango: {cv.rango}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* PASO 3: CANALES, REINTENTOS, INASISTENCIAS Y HORARIOS */}
                {wizardStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider block mb-2">
                        Canales de Envío Autorizados
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { key: 'call', label: 'Llamada IA Vapi', sub: `Máx ${DAILY_CALL_CAPACITY}/día (P1-P5)`, icon: Phone },
                          { key: 'whatsapp', label: 'WhatsApp', sub: 'Educación / R2', icon: MessageSquare },
                          { key: 'sms', label: 'Mensaje SMS', sub: 'Recordatorio / Respaldo R1', icon: Send },
                          { key: 'email', label: 'Correo E-mail', sub: 'Insistencia / Soporte', icon: Mail },
                        ].map((c) => {
                          const isAct = selectedChannels[c.key];
                          const Icon = c.icon;
                          return (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => setSelectedChannels((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
                              className={`p-3 rounded-2xl border text-left transition-all ${
                                isAct
                                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 shadow-sm ring-1 ring-blue-500'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-65'
                              }`}
                            >
                              <Icon className={`w-5 h-5 ${isAct ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                              <div className="font-bold text-xs text-slate-800 dark:text-white mt-2">{c.label}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">{c.sub}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Regla automática de inasistencia */}
                    <div className="p-4 bg-cyan-50/70 dark:bg-cyan-950/35 border border-cyan-200 dark:border-cyan-800/60 rounded-2xl text-xs flex items-start gap-3">
                      <BellRing className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-cyan-950 dark:text-cyan-200">
                          Seguimiento Automático por Inasistencia a Cita (Activo)
                        </div>
                        <p className="text-cyan-900 dark:text-cyan-300/90 mt-0.5 leading-relaxed">
                          {NOSHOW_POLICY.descripcion}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span className="font-bold text-xs text-amber-900 dark:text-amber-200">
                            Reintentar automáticamente hasta que conteste durante la jornada
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
                        <div className="flex flex-wrap items-center gap-3 text-xs text-amber-800 dark:text-amber-200 pt-2 border-t border-amber-200 dark:border-amber-800/60">
                          <span>Máximo de reintentos por paciente:</span>
                          <select
                            value={maxRetries}
                            onChange={(e) => setMaxRetries(Number(e.target.value))}
                            className="bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-xl px-2.5 py-1 font-bold text-slate-800 dark:text-white"
                          >
                            <option value={1}>1 reintento</option>
                            <option value={2}>2 reintentos</option>
                            <option value={3}>3 reintentos (Recomendado)</option>
                            <option value={5}>5 reintentos</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div
                      data-testid="campaign-fixed-launch-time"
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-slate-700 dark:text-slate-200">
                          <strong>Hora de lanzamiento de campañas:</strong> todas las campañas se lanzan automáticamente a las{' '}
                          <strong>{CAMPAIGN_LAUNCH_TIME}</strong> en el día o los días dispuestos por el personal.
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-blue-600 text-white font-black text-[11px] shrink-0">
                        {CAMPAIGN_LAUNCH_TIME}
                      </span>
                    </div>
                  </div>
                )}

                {/* =================================================================== */}
                {/* PASO 4: FILTRO DE UBICACIÓN (DIVIPOLA SANTIAGO DE CALI 76001)       */}
                {/* 1. Rural -> Corregimiento -> Vereda / Centro Poblado                */}
                {/* 2. Urbano -> Comuna (1-22) -> Barrio                                */}
                {/* =================================================================== */}
                {wizardStep === 4 && (
                  <div className="space-y-5" data-testid="wizard-step4-ubicacion">
                    <div className="bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 text-xs text-emerald-950 dark:text-emerald-100 flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-sm">Paso 4: Filtro de Ubicación — Santiago de Cali (DIVIPOLA 76001)</strong>
                          <p className="mt-0.5 text-emerald-800 dark:text-emerald-200/90">
                            Selecciona el nivel territorial (<strong>Rural</strong> o <strong>Urbano</strong>) para desplegar dinámicamente corregimientos/veredas/centros poblados o comunas/barrios de Cali.
                          </p>
                        </div>
                      </div>
                      <span data-testid="loc-matching-count" className="px-3 py-1 rounded-full font-black text-xs bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0">
                        {loadingCohort
                          ? 'Calculando cohorte...'
                          : `${effectiveTargetCount.toLocaleString('es-CO')} pacientes coincidentes`}
                      </span>
                    </div>

                    {/* NIVEL PRIMARIO: Todas / Rural / Urbano */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
                        Selección Primaria de Zona (Santiago de Cali)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          type="button"
                          data-testid="loc-zona-todas"
                          onClick={() => {
                            setUbicacionZona('todas');
                            setUbicacionCorregimiento('todos');
                            setUbicacionVereda('todas');
                            setUbicacionCentroPoblado('todos');
                            setUbicacionComuna('todas');
                            setUbicacionBarrio('todos');
                            setCohortPage(1);
                          }}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${
                            ubicacionZona === 'todas'
                              ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/30 shadow-sm'
                              : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-black text-xs text-slate-900 dark:text-white">
                            <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span>Todo Cali</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Incluye zona Urbana y Rural sin restricción
                          </div>
                        </button>

                        <button
                          type="button"
                          data-testid="loc-zona-rural"
                          onClick={() => {
                            setUbicacionZona('Rural');
                            setUbicacionComuna('todas');
                            setUbicacionBarrio('todos');
                            setCohortPage(1);
                          }}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${
                            ubicacionZona === 'Rural'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm'
                              : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-black text-xs text-slate-900 dark:text-white">
                            <Trees className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Rural</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Corregimiento → Vereda / Centro Poblado
                          </div>
                        </button>

                        <button
                          type="button"
                          data-testid="loc-zona-urbana"
                          onClick={() => {
                            setUbicacionZona('Urbana');
                            setUbicacionCorregimiento('todos');
                            setUbicacionVereda('todas');
                            setUbicacionCentroPoblado('todos');
                            setCohortPage(1);
                          }}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${
                            ubicacionZona === 'Urbana'
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/30 shadow-sm'
                              : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-black text-xs text-slate-900 dark:text-white">
                            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Urbano</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Comuna (1–22) → Barrio
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* DESPLIEGUE SECUNDARIO Y TERCIARIO: RURAL */}
                    {ubicacionZona === 'Rural' && (
                      <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/60 space-y-4">
                        <div>
                          <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block mb-1.5">
                            Corregimiento de Santiago de Cali (15 oficiales)
                          </label>
                          <select
                            data-testid="loc-select-corregimiento"
                            value={ubicacionCorregimiento}
                            onChange={(e) => {
                              setUbicacionCorregimiento(e.target.value);
                              setUbicacionVereda('todas');
                              setUbicacionCentroPoblado('todos');
                              setCohortPage(1);
                            }}
                            className="w-full text-xs p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="todos">Todos los Corregimientos Rurales de Cali</option>
                            {caliCorregimientosList.map((corr) => (
                              <option key={corr} value={corr}>
                                {corr}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Terciarios Rurales desplegados al seleccionar un Corregimiento */}
                        {ubicacionCorregimiento !== 'todos' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/70 dark:border-emerald-800/50">
                            <div>
                              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block mb-1.5">
                                Vereda ({ubicacionCorregimiento})
                              </label>
                              <select
                                data-testid="loc-select-vereda"
                                value={ubicacionVereda}
                                onChange={(e) => {
                                  setUbicacionVereda(e.target.value);
                                  setCohortPage(1);
                                }}
                                className="w-full text-xs p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold"
                              >
                                <option value="todas">Todas las Veredas de {ubicacionCorregimiento}</option>
                                {caliVeredasList.map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block mb-1.5">
                                Centro Poblado ({ubicacionCorregimiento})
                              </label>
                              <select
                                data-testid="loc-select-centro-poblado"
                                value={ubicacionCentroPoblado}
                                onChange={(e) => {
                                  setUbicacionCentroPoblado(e.target.value);
                                  setCohortPage(1);
                                }}
                                className="w-full text-xs p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold"
                              >
                                <option value="todos">Todos los Centros Poblados de {ubicacionCorregimiento}</option>
                                {caliCentrosPobladosList.map((cp) => (
                                  <option key={cp} value={cp}>
                                    {cp}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* DESPLIEGUE SECUNDARIO Y TERCIARIO: URBANO */}
                    {ubicacionZona === 'Urbana' && (
                      <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-800/60 space-y-4">
                        <div>
                          <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 block mb-1.5">
                            Comuna de Santiago de Cali (Comunas 1 a 22)
                          </label>
                          <select
                            data-testid="loc-select-comuna"
                            value={ubicacionComuna}
                            onChange={(e) => {
                              setUbicacionComuna(e.target.value);
                              setUbicacionBarrio('todos');
                              setCohortPage(1);
                            }}
                            className="w-full text-xs p-2.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="todas">Todas las Comunas Urbanas de Cali</option>
                            {caliComunasList.map((com) => (
                              <option key={com} value={com}>
                                {com}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Terciario Urbano desplegado al seleccionar una Comuna */}
                        {ubicacionComuna !== 'todas' && (
                          <div className="pt-2 border-t border-indigo-200/70 dark:border-indigo-800/50">
                            <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 block mb-1.5">
                              Barrio ({ubicacionComuna})
                            </label>
                            <select
                              data-testid="loc-select-barrio"
                              value={ubicacionBarrio}
                              onChange={(e) => {
                                setUbicacionBarrio(e.target.value);
                                setCohortPage(1);
                              }}
                              className="w-full text-xs p-2.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold"
                            >
                              <option value="todos">Todos los Barrios de {ubicacionComuna}</option>
                              {caliBarriosList.map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Datos complementarios de campaña y Sede IPS Cali */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                          Nombre de la Campaña
                        </label>
                        <input
                          type="text"
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value)}
                          className="w-full text-xs font-semibold p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                          IPS / Punto de Atención (Cali)
                        </label>
                        <select
                          value={sedeLugar}
                          onChange={(e) => setSedeLugar(e.target.value)}
                          className="w-full text-xs p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl font-medium"
                        >
                          {CALI_IPS_SEDES.map((sede) => (
                            <option key={sede} value={sede}>
                              {sede}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                        Directriz Clínica para el Agente IA (Opcional)
                      </label>
                      <textarea
                        rows={3}
                        value={promptDirectriz}
                        onChange={(e) => setPromptDirectriz(e.target.value)}
                        className="w-full text-xs p-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* PASO 5: RESUMEN, SALDO 500/DÍA Y LANZAMIENTO */}
                {wizardStep === 5 && (
                  <div className="space-y-4" data-testid="wizard-step5-resumen">
                    <div
                      className={`rounded-2xl p-4 text-xs border space-y-1.5 ${
                        liveCapacityCheck.hasOverflow
                          ? 'bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-100'
                          : 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <ShieldCheck className="w-5 h-5 shrink-0" />
                        <span>
                          {liveCapacityCheck.hasOverflow
                            ? `Tope ${DAILY_CALL_CAPACITY} llamadas/día aplicado con SMS Respaldo (R1-04)`
                            : `Campaña Validada Dentro del Cupo de ${DAILY_CALL_CAPACITY} Llamadas IA/Día`}
                        </span>
                      </div>
                      <p>{liveCapacityCheck.message}</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2.5">
                      <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <span className="text-slate-500 dark:text-slate-400">Campaña:</span>
                        <strong className="text-slate-900 dark:text-white text-right">{campaignName}</strong>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <span className="text-slate-500 dark:text-slate-400">Filtro de Ubicación (Cali):</span>
                        <strong className="text-emerald-700 dark:text-emerald-300 text-right">{locationFilterSummary}</strong>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <span className="text-slate-500 dark:text-slate-400">Frecuencia &amp; Fechas Hábiles:</span>
                        <strong className="text-slate-900 dark:text-white text-right">
                          {campaignSchedule.summary} ({effectiveScheduleDates.length} fecha(s))
                        </strong>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <span className="text-slate-500 dark:text-slate-400">Hora de Lanzamiento:</span>
                        <strong className="text-blue-700 dark:text-blue-300 text-right">
                          {CAMPAIGN_LAUNCH_TIME} (fija en los días dispuestos)
                        </strong>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <span className="text-slate-500 dark:text-slate-400">Capacidad Máxima Diaria:</span>
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {DAILY_CALL_CAPACITY} llamadas/día ({CALLS_PER_HOUR}/h • 08:00 AM - 06:00 PM)
                        </strong>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <span className="text-slate-500 dark:text-slate-400">Segmentación Cruzada:</span>
                        <strong className="text-slate-900 dark:text-white text-right">
                          {crossSegmentSelection.join(', ') || 'Todo el segmento seleccionado'}
                        </strong>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <span className="text-slate-500 dark:text-slate-400">Población Objetivo Real (BD):</span>
                        <strong className="text-blue-700 dark:text-blue-300">
                          {effectiveTargetCount.toLocaleString('es-CO')} paciente(s)
                        </strong>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <span className="text-slate-500 dark:text-slate-400">Seguimiento por Inasistencia:</span>
                        <strong className="text-cyan-700 dark:text-cyan-300 text-right">{NOSHOW_POLICY.resumenCorto}</strong>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">IPS asignada:</span>
                        <strong className="text-slate-900 dark:text-white text-right">{sedeLugar}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botones de Navegación del Wizard */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                  {wizardStep > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevStep}
                      className="text-xs gap-1.5 rounded-xl"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsModalOpen(false)}
                      className="text-xs text-slate-500"
                    >
                      Cancelar
                    </Button>
                  )}

                  <div className="flex items-center gap-2">
                    {wizardStep < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setWizardStep(5)}
                        className="text-xs rounded-xl border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                      >
                        Ir directo al Resumen
                      </Button>
                    )}

                    {wizardStep < 5 ? (
                      <Button
                        type="button"
                        onClick={handleNextStep}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 rounded-xl px-5"
                      >
                        Siguiente Paso <ArrowRight className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleLaunchCampaign}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-2 rounded-xl px-6 shadow-md"
                      >
                        <Send className="w-4 h-4" />
                        Confirmar y Lanzar Campaña
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL DE EXPEDIENTE DE DÍA (PACIENTES REALES CON NOMBRE, CC, CUPS, P1-P5) */}
      {/* ========================================================================= */}
      <Dialog open={isRoadmapDayOpen} onOpenChange={setIsRoadmapDayOpen}>
        <DialogContent className="w-[95%] sm:w-[92%] max-w-4xl max-h-[88vh] overflow-y-auto p-0 rounded-3xl">
          {selectedRoadmapDay && (
            <div>
              {/* Header del Día */}
              <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white rounded-t-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Ruta Preventiva Res. 3280 • Prioridad P1–P5
                    </span>
                    {selectedRoadmapDay.specificItem && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
                        Corte: {selectedRoadmapDay.specificItem.nombre}
                      </span>
                    )}
                  </div>
                  <DialogTitle className="text-lg sm:text-xl font-black flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Fecha: {selectedRoadmapDay.isoDate} ({selectedRoadmapDay.dayOfMonth} de{' '}
                    {MESES_TITULOS[Number(selectedRoadmapDay.isoDate.split('-')[1]) - 1]?.nombre}{' '}
                    {selectedRoadmapDay.isoDate.split('-')[0]})
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-300 mt-1">
                    <strong>{dayModalMeta.totalCount.toLocaleString('es-CO')}</strong> paciente(s) programado(s) en este corte •{' '}
                    <strong>{selectedRoadmapDay.campaigns?.length || 0}</strong> campaña(s) adicional(es)
                  </DialogDescription>
                </div>

                {/* Aforo exacto sobre 500 llamadas/día: SOLO visible en la fila global Ruta Res. 3280 */}
                {!selectedRoadmapDay.specificItem && (
                  <div
                    data-testid="day-modal-aforo-box"
                    className="bg-slate-800/90 border border-slate-700 rounded-2xl px-4 py-2.5 text-right shrink-0"
                  >
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Aforo Diario IA (Tope {DAILY_CALL_CAPACITY})
                    </div>
                    <div className="text-sm font-black text-emerald-400">
                      {dayModalMeta.llamadasIa || selectedRoadmapDay.llamadasAsignadas || 0} / {DAILY_CALL_CAPACITY} llamadas IA
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Saldo disponible:{' '}
                      <strong>
                        {Math.max(0, DAILY_CALL_CAPACITY - (dayModalMeta.llamadasIa || selectedRoadmapDay.llamadasAsignadas || 0))}
                      </strong>
                      {dayModalMeta.smsRespaldo > 0 && (
                        <span className="text-amber-300 font-bold"> • +{dayModalMeta.smsRespaldo} SMS respaldo</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Cuerpo del Día */}
              <div className="p-6 space-y-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {/* Resumen de Prioridades P1 - P5 del Día + Buscador */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((pNum) => {
                      const pm = getPriorityMeta(pNum);
                      const cnt = Number(dayModalMeta.priorityCounts?.[String(pNum)] || 0);
                      return (
                        <span
                          key={pNum}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${pm.badgeClass}`}
                        >
                          {pm.shortLabel}: {cnt.toLocaleString('es-CO')}
                        </span>
                      );
                    })}
                  </div>

                  <div className="relative w-full md:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={dayModalSearch}
                      onChange={(e) => setDayModalSearch(e.target.value)}
                      placeholder="Buscar nombre, CC o teléfono..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Campañas asignadas a este día */}
                {selectedRoadmapDay.campaigns && selectedRoadmapDay.campaigns.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Campañas Programadas ({selectedRoadmapDay.campaigns.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedRoadmapDay.campaigns.map((camp, i) => (
                        <div
                          key={i}
                          className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs space-y-1"
                        >
                          <div className="font-black text-amber-950 dark:text-amber-200">{camp.nombre}</div>
                          <div className="text-[11px] text-amber-800 dark:text-amber-300">
                            <strong>Ubicación/Sede:</strong> {camp.lugar || CALI_IPS_SEDES[0]}
                          </div>
                          <div className="text-[11px] text-amber-800 dark:text-amber-300">
                            <strong>Pacientes:</strong> {Number(camp.pacientes_asignados || 0).toLocaleString('es-CO')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Listado Paginado de Pacientes Reales del Día */}
                <div>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Llamadas Normativas Resolución 3280 ({dayModalMeta.totalCount.toLocaleString('es-CO')})
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      {selectedRoadmapDay.specificItem
                        ? `Corte específico: ${selectedRoadmapDay.specificItem.nombre}`
                        : `Horario: 08:00 AM a 06:00 PM (10h · ${CALLS_PER_HOUR} llam/h · Tope ${DAILY_CALL_CAPACITY}/día)`}
                    </span>
                  </div>

                  {loadingDayModal ? (
                    <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
                      Cargando pacientes priorizados del día...
                    </div>
                  ) : dayModalRows.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                      No hay citas programadas para los filtros seleccionados en esta fecha.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {dayModalRows.map((cItem, idx) => {
                        const isSelected = selectedPromptPatient?.id === cItem.id;
                        const prio = getPriorityMeta(cItem.prioridad);
                        return (
                          <div
                            key={`${cItem.id}-${idx}`}
                            className={`p-3.5 rounded-2xl border transition-all text-xs space-y-2 ${
                              isSelected
                                ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 ring-1 ring-blue-400 shadow-sm'
                                : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                              <div className="space-y-1.5 min-w-0 flex-1">
                                <div className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2 flex-wrap">
                                  <span>{cItem.nombre}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${prio.badgeClass}`}>
                                    {prio.shortLabel}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      cItem.canalAsignado.includes('SMS')
                                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                        : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    }`}
                                  >
                                    {cItem.canalAsignado}
                                  </span>
                                </div>

                                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                                  {cItem.tipo_documento || 'CC'}: <strong>{cItem.documento}</strong> • Tel:{' '}
                                  <strong>{cItem.telefono}</strong> • {cItem.edad} años
                                </div>

                                {/* Badges universales: Curso de Vida + Grupos de Riesgo reales */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  <CursoVidaBadge patient={cItem} />
                                  <GruposRiesgoBadges patient={cItem} maxVisible={4} />
                                </div>

                                <div className="text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <span className="font-semibold text-blue-700 dark:text-blue-400">{cItem.accion3280}</span>
                                  <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                    CUPS: {cItem.cups}
                                  </span>
                                </div>
                              </div>

                              <Button
                                size="sm"
                                variant={isSelected ? 'default' : 'outline'}
                                onClick={() => setSelectedPromptPatient(isSelected ? null : cItem)}
                                className="text-[11px] h-8 gap-1.5 rounded-xl font-bold shrink-0"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                {isSelected ? 'Ocultar Guion IA' : 'Ver Guion IA Completo'}
                              </Button>
                            </div>

                            {isSelected && (
                              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800/60">
                                {(() => {
                                  const promptData = generateIndividualClinicalPrompt(
                                    cItem,
                                    { nombre: cItem.accion3280, cups: cItem.cups },
                                    selectedRoadmapDay.specificType || 'curso_vida'
                                  );
                                  return (
                                    <div className="bg-slate-950 text-slate-100 rounded-2xl p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap shadow-inner border border-slate-800">
                                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-blue-300 font-bold">
                                        <span>{promptData.asunto}</span>
                                        <span className="text-[10px] text-emerald-400">Tope 500/día • Cali</span>
                                      </div>
                                      {promptData.promptCompleto}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Paginación del Modal de Día */}
                  {dayModalMeta.totalCount > 25 && (
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-200 dark:border-slate-800 mt-3">
                      <span>
                        Página <strong>{dayModalPage}</strong> de{' '}
                        <strong>{Math.max(1, Math.ceil(dayModalMeta.totalCount / 25)).toLocaleString('es-CO')}</strong> (
                        {dayModalMeta.totalCount.toLocaleString('es-CO')} pacientes programados este día)
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={dayModalPage <= 1}
                          onClick={() => setDayModalPage((p) => Math.max(1, p - 1))}
                          className="h-7 text-xs rounded-lg"
                        >
                          Anterior
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={dayModalPage >= Math.ceil(dayModalMeta.totalCount / 25)}
                          onClick={() => setDayModalPage((p) => p + 1)}
                          className="h-7 text-xs rounded-lg"
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Acciones inferiores del modal */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                  {!isMonthPast(
                    Number(selectedRoadmapDay.isoDate.split('-')[0]),
                    Number(selectedRoadmapDay.isoDate.split('-')[1]) - 1
                  ) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsRoadmapDayOpen(false);
                        const mIdx = Number(selectedRoadmapDay.isoDate.split('-')[1]) - 1;
                        handleCellClick(
                          selectedRoadmapDay.specificType === 'grupo_riesgo' ? 'grupo_riesgo' : 'curso_vida',
                          selectedRoadmapDay.specificItem || PROGRAMAS_3280[0],
                          mIdx,
                          'wizard',
                          selectedRoadmapDay.isoDate
                        );
                      }}
                      className="text-xs rounded-xl gap-1.5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                    >
                      + Programar Nueva Campaña en esta Fecha
                    </Button>
                  )}

                  <Button
                    onClick={() => setIsRoadmapDayOpen(false)}
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs rounded-xl px-5 ml-auto"
                  >
                    Cerrar Expediente
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* POPUPS INFORMATIVOS DEL ENCABEZADO (RIESGO REAL / PRIORIDAD / INASIST.)   */}
      {/* ========================================================================= */}
      <Dialog open={Boolean(activeInfoPopup)} onOpenChange={(open) => !open && setActiveInfoPopup(null)}>
        <DialogContent className="w-[94%] max-w-xl p-0 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {activeInfoPopup === 'prioridad' && (
            <div data-testid="popup-prioridad-cola">
              <div className="bg-gradient-to-r from-slate-900 via-amber-950/90 to-slate-900 p-5 text-white">
                <DialogTitle className="text-lg font-black flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-amber-400" />
                  Prioridad de Cola de Voz (P1 – P5) • {activeYear}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-1">
                  Orden en el que se asignan las llamadas diarias (tope {DAILY_CALL_CAPACITY}/día; excedente pasa a SMS respaldo) y pacientes elegibles por cada nivel.
                </DialogDescription>
              </div>
              <div className="p-5 space-y-2.5 text-xs">
                {[
                  {
                    id: 1,
                    desc: 'Gestantes, puerperio y cohorte Materno-Perinatal (RIAMP). Máxima urgencia clínica.',
                  },
                  {
                    id: 2,
                    desc: 'Pacientes con detección temprana o seguimiento oncológico (cáncer).',
                  },
                  {
                    id: 3,
                    desc: 'Primera Infancia (0–5 años) con riesgo clínico registrado y seguimiento prioritario.',
                  },
                  {
                    id: 4,
                    desc: 'Grupos de Riesgo Crónicos y Priorizados (cardiovascular, respiratorio, salud mental, infecciosas, nutricional, huérfanas, planificación, PAI y salud oral).',
                  },
                  {
                    id: 5,
                    desc: 'Valoración preventiva general Res. 3280 según periodicidad por edad (población sin grupo de riesgo clínico).',
                  },
                ].map((item) => {
                  const pm = getPriorityMeta(item.id);
                  const cnt = Number(priorityYearlyTotals[item.id] || 0);
                  const pct =
                    yearlyStats.totalEligible > 0
                      ? ((cnt / yearlyStats.totalEligible) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${pm.badgeClass}`}>
                            {pm.code}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{pm.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {cnt.toLocaleString('es-CO')}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                          pac. ({pct}%)
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span>Total elegibles {activeYear}</span>
                  <span className="font-mono text-sm text-emerald-700 dark:text-emerald-400">
                    {yearlyStats.totalEligible.toLocaleString('es-CO')} pacientes
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeInfoPopup === 'inasistencias' && (
            <div data-testid="popup-inasistencias">
              <div className="bg-gradient-to-r from-slate-900 via-cyan-950/90 to-slate-900 p-5 text-white">
                <DialogTitle className="text-lg font-black flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-cyan-400" />
                  Reglas de Seguimiento por Inasistencia
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-1">
                  Protocolo automático que ejecuta SADI cuando un paciente falta a su cita programada.
                </DialogDescription>
              </div>
              <div className="p-5 space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl border border-cyan-200 dark:border-cyan-800/60 bg-cyan-50/70 dark:bg-cyan-950/35 space-y-1">
                  <div className="font-black text-cyan-950 dark:text-cyan-200 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-600 text-white">Paso 1 · Día +3</span>
                    <span>Primer SMS de recordatorio</span>
                  </div>
                  <p className="text-cyan-900 dark:text-cyan-300/90 leading-relaxed">
                    Si un paciente falta a su cita, a los <strong>{NOSHOW_POLICY.sms1DelayDays} días</strong> después de la fecha originalmente programada se le envía automáticamente un <strong>SMS</strong> para invitarlo a reagendar.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/35 space-y-1">
                  <div className="font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-600 text-white">Paso 2 · +2 días (Día +5)</span>
                    <span>Insistencia con SMS + E-Mail</span>
                  </div>
                  <p className="text-indigo-900 dark:text-indigo-300/90 leading-relaxed">
                    Si el paciente <strong>no responde</strong> al primer SMS, SADI insiste automáticamente <strong>{NOSHOW_POLICY.insistenciaDelayAfterSms1Days} días después</strong> (día +{NOSHOW_POLICY.totalInsistenciaDelayDays} desde la cita original) enviando un <strong>segundo SMS y un correo electrónico (E-Mail)</strong>.
                  </p>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                  Cuando el paciente responde o reagenda en cualquiera de las etapas, el seguimiento se cierra automáticamente y no se envían insistencias adicionales.
                </p>
              </div>
            </div>
          )}

          {activeInfoPopup === 'riesgo' && (
            <div data-testid="popup-riesgo-real">
              <div className="bg-gradient-to-r from-slate-900 via-purple-950/90 to-slate-900 p-5 text-white">
                <DialogTitle className="text-lg font-black flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  Pacientes con Riesgo Clínico Real
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-1">
                  Clasificación estricta basada únicamente en la información clínica real registrada en Supabase.
                </DialogDescription>
              </div>
              <div className="p-5 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/70 dark:bg-purple-950/35">
                    <div className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-300">
                      Con Riesgo Clínico
                    </div>
                    <div className="text-xl font-black text-purple-900 dark:text-purple-100 mt-0.5 font-mono">
                      {Math.max(0, Number(cronogramaSummary.totalPatients || 0) - Number(cronogramaSummary.noRiskCount || 0)).toLocaleString('es-CO')}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                    <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                      Sin Grupo de Riesgo
                    </div>
                    <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5 font-mono">
                      {Number(cronogramaSummary.noRiskCount || 0).toLocaleString('es-CO')}
                    </div>
                  </div>
                </div>

                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Corresponde a las personas del censo que tienen <strong>al menos un Grupo de Riesgo clínico comprobado</strong> en la base de datos (como materno-perinatal, riesgo cardiovascular, cáncer, enfermedades respiratorias crónicas, salud mental, infecciosas, nutricionales o huérfanas).
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Los demás pacientes no tienen ningún grupo de riesgo inventado ni asignado por defecto; continúan su atención únicamente por la ruta preventiva normal de su Curso de Vida (Res. 3280).
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ResolutionAnnualMatrix;
