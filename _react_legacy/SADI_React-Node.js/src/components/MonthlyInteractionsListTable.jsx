import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, Clock, Filter, RefreshCw, PhoneCall, MessageSquare, Send, Mail,
  MapPin, UserCheck, UserPlus, UserX, Shield, Sparkles, ChevronLeft, ChevronRight,
  Search, CheckCircle2, AlertCircle, FileText, Building2, Trees, Eye, PhoneForwarded, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeCursosArray } from '@/services/cursoVidaConfig';
import { demanda3280Service, GRUPOS_RIESGO_3280 } from '@/services/demanda3280Service';
import { liveCallLifecycleService } from '@/services/liveCallLifecycleService';
import LiveCallButton, { useDailyCallQuota, DailyQuotaBadge } from '@/components/LiveCallButton';
import { CursoVidaBadge, GruposRiesgoBadges } from '@/components/PatientClinicalBadges';
import {
  getCaliComunas,
  getCaliBarriosForComuna,
  getCaliCorregimientos,
  getCaliVeredasForCorregimiento,
  getCaliCentrosPobladosForCorregimiento,
} from '@/services/caliDivipola';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function MonthlyInteractionsListTable({ onExecuteCallSuccess }) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(11); // Noviembre por defecto

  const [interactions, setInteractions] = useState([]);
  const [totalCohort, setTotalCohort] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [serverOptions, setServerOptions] = useState({
    comunas: [],
    barriosPorComuna: {},
    centrosPoblados: [],
    corregimientos: [],
    veredas: [],
    conteoPorTipo: { Activo: 0, Nuevo: 0, Inactivo: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Estados de Filtros según especificación:
  // 1. Ubicación (Urbano: Comuna, Barrio / Rural: Centro Poblado, Corregimiento, Vereda)
  const [filterZona, setFilterZona] = useState('todas'); // 'todas' | 'Urbana' | 'Rural'
  const [filterComuna, setFilterComuna] = useState('todas');
  const [filterBarrio, setFilterBarrio] = useState('todos');
  const [filterCentroPoblado, setFilterCentroPoblado] = useState('todos');
  const [filterCorregimiento, setFilterCorregimiento] = useState('todos');
  const [filterVereda, setFilterVereda] = useState('todas');

  // 2. Grupo de Riesgo Priorizado
  const [filterGrupoRiesgo, setFilterGrupoRiesgo] = useState('todos');

  // 3. Tipo de Usuario (Activos, Nuevos, Inactivos)
  const [filterTipoUsuario, setFilterTipoUsuario] = useState('todos');

  // Paginación servidor (100% sobre 142k+)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Modal de Detalle / Llamada
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const dailyQuota = useDailyCallQuota(user?.hospitalId || user?.hospital_id || null);

  const doctorCursosParam = useMemo(() => {
    if (user?.role !== 'doctor') return null;
    const raw = normalizeCursosArray(user?.cursos_vida_asignados);
    return raw.map((c) => (c === 'materno_perinatal' ? 'preventivo_mujer' : c));
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    demanda3280Service.getFilterOptions(user?.hospitalId || user?.hospital_id || null, doctorCursosParam)
      .then((opts) => {
        if (!active) return;
        setTotalCohort(Number(opts.totalCohort || 0));
        setServerOptions(opts);
      })
      .catch(() => null);
    return () => { active = false; };
  }, [user, doctorCursosParam]);

  // Carga paginada real (100% de pacientes sin límite 1,000)
  const fetchInteractions = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await demanda3280Service.getMonthlyInteractionsPage({
        year: currentYear,
        month: currentMonth,
        hospitalId: user?.hospitalId || user?.hospital_id || null,
        cursos: doctorCursosParam,
        zona: filterZona,
        comuna: filterComuna,
        barrio: filterBarrio,
        centroPoblado: filterCentroPoblado,
        corregimiento: filterCorregimiento,
        vereda: filterVereda,
        grupoRiesgo: filterGrupoRiesgo,
        tipoUsuario: filterTipoUsuario,
        search: debouncedSearch,
        page: currentPage,
        pageSize: itemsPerPage,
      });
      setInteractions(res.items || []);
      setFilteredCount(Number(res.filteredCount || 0));
    } catch (e) {
      console.error('Error cargando interacciones mensuales:', e);
      if (!silent) {
        toast({
          title: "Error al sincronizar interacciones",
          description: "No se pudieron obtener los datos de la base de datos.",
          variant: "destructive"
        });
      }
    } finally {
      if (!silent) setLoading(false);
      setSecondsRemaining(60);
    }
  };

  useEffect(() => {
    fetchInteractions();
  }, [
    user,
    doctorCursosParam,
    currentYear,
    currentMonth,
    filterZona,
    filterComuna,
    filterBarrio,
    filterCentroPoblado,
    filterCorregimiento,
    filterVereda,
    filterGrupoRiesgo,
    filterTipoUsuario,
    debouncedSearch,
    currentPage,
    itemsPerPage,
  ]);

  // Actualización en TIEMPO REAL cada 60 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          fetchInteractions(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [
    user,
    doctorCursosParam,
    currentYear,
    currentMonth,
    filterZona,
    filterComuna,
    filterBarrio,
    filterCentroPoblado,
    filterCorregimiento,
    filterVereda,
    filterGrupoRiesgo,
    filterTipoUsuario,
    debouncedSearch,
    currentPage,
    itemsPerPage,
  ]);

  const filterOptions = serverOptions;

  const caliComunas = useMemo(() => getCaliComunas(filterOptions.comunas), [filterOptions.comunas]);
  const caliBarrios = useMemo(() => {
    if (filterComuna !== 'todas') {
      return getCaliBarriosForComuna(filterComuna, filterOptions.barriosPorComuna);
    }
    const set = new Set();
    Object.values(filterOptions.barriosPorComuna || {}).forEach((arr) => (arr || []).forEach((b) => set.add(b)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [filterComuna, filterOptions.barriosPorComuna]);

  const caliCorregimientos = useMemo(() => getCaliCorregimientos(filterOptions.corregimientos), [filterOptions.corregimientos]);
  const caliVeredas = useMemo(() => {
    if (filterCorregimiento !== 'todos') {
      return getCaliVeredasForCorregimiento(filterCorregimiento);
    }
    return (filterOptions.veredas || []).slice().sort((a, b) => a.localeCompare(b, 'es'));
  }, [filterCorregimiento, filterOptions.veredas]);
  const caliCentrosPoblados = useMemo(() => {
    if (filterCorregimiento !== 'todos') {
      return getCaliCentrosPobladosForCorregimiento(filterCorregimiento);
    }
    return (filterOptions.centrosPoblados || []).slice().sort((a, b) => a.localeCompare(b, 'es'));
  }, [filterCorregimiento, filterOptions.centrosPoblados]);

  // Reset de sub-filtros al cambiar zona
  const handleZonaChange = (newZona) => {
    setFilterZona(newZona);
    setFilterComuna('todas');
    setFilterBarrio('todos');
    setFilterCentroPoblado('todos');
    setFilterCorregimiento('todos');
    setFilterVereda('todas');
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilterZona('todas');
    setFilterComuna('todas');
    setFilterBarrio('todos');
    setFilterCentroPoblado('todos');
    setFilterCorregimiento('todos');
    setFilterVereda('todas');
    setFilterGrupoRiesgo('todos');
    setFilterTipoUsuario('todos');
    setSearchTerm('');
    setDebouncedSearch('');
    setCurrentPage(1);
  };

  // Paginación servidor (100% sobre 142k+ pacientes en BD)
  const totalPages = Math.max(1, Math.ceil(filteredCount / itemsPerPage));
  const paginatedInteractions = interactions;

  // Disparar llamada inmediata REAL por Puerto 1 con ciclo de vida completo y descuento en cupo de 500/día
  const handleDirectCall = async (item) => {
    if (!item) return;
    // Verificar restricción de permisos del personal
    if (user?.role === 'doctor' && user?.solo_lectura && !user?.puede_lanzar_llamadas) {
      toast({
        title: "🔒 Permiso Restringido por el Hospital",
        description: "Su usuario tiene permisos de 'Solo Lectura'. No está autorizada para emitir llamadas salientes a los pacientes.",
        variant: "destructive"
      });
      return;
    }

    await liveCallLifecycleService.executeLiveCall({
      targetKey: item.id,
      phoneNumber: item.telefono,
      patientData: {
        patientId: item.pacienteId || null,
        hospitalId: user?.hospitalId || user?.hospital_id || null,
        doctorId: user?.doctor_id || null,
        nombre: item.pacienteNombre,
        cedula: item.pacienteDoc,
        programa: item.protocoloNombre,
        programa3280: item.protocoloNombre,
        hitoClinico: item.hitoClinico,
        motivoLlamada: item.protocoloNombre || 'Demanda Inducida Res. 3280',
        cursoVida: item.cursoVida || item.curso_vida,
        curso_vida: item.curso_vida || item.cursoVida,
        birthdate: item.birthdate || item.fechaNacimiento || null,
        edad: item.edad ?? null,
        direccion: item.barrio ? `${item.barrio}, ${item.zona}` : 'Santiago de Cali, Valle del Cauca',
      },
      onSuccess: (res) => {
        setInteractions((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, estado: 'Confirmada', intentos: (it.intentos || 0) + 1 } : it
          )
        );
        const rem = res?.quota?.remaining_today ?? res?.quota?.remainingToday ?? dailyQuota.remainingToday;
        const cap = res?.quota?.daily_cap ?? res?.quota?.dailyCap ?? dailyQuota.dailyCap;
        toast({
          title: "🟢 Llamada Exitosa y Registrada (Puerto 1)",
          description: `${item.pacienteNombre} fue contactado correctamente. Cupo diario restante: ${rem} / ${cap}.`,
        });
        if (onExecuteCallSuccess) onExecuteCallSuccess();
      },
      onFailure: (res) => {
        setInteractions((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, estado: 'No Contesta', intentos: (it.intentos || 0) + 1 } : it
          )
        );
        toast({
          title: "Fallo al Contactar",
          description: res?.message || `No se logró contactar a ${item.pacienteNombre} por Puerto 1.`,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm p-6 space-y-6">

      {/* ========================================================================= */}
      {/* CABECERA: TÍTULO, TIEMPO REAL (60s) Y NAVEGACIÓN MENSUAL */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
              Tiempo Real • Sincronización cada 60s
            </span>
            <span className="text-[11px] font-mono text-gray-400 dark:text-slate-400">
              Próxima en: <strong className="text-gray-700 dark:text-slate-200">{secondsRemaining}s</strong>
            </span>
            <DailyQuotaBadge
              quota={dailyQuota}
              testId="demanda-daily-quota-badge"
              variant="soft"
              className="text-[11px] py-0.5"
            />
          </div>

          <h2 className="text-xl font-black text-gray-900 dark:text-white mt-1 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Lista Mensual Unificada de Interacciones Programadas
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Resolución 3280, Campañas Activas y Salidas Individuales ordenadas cronológicamente de la más próxima a la última del mes.
          </p>
        </div>

        {/* Selector de Mes / Año & Botón Actualizar */}
        <div className="flex items-center gap-2.5 self-start lg:self-auto">
          <div className="flex items-center bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (currentMonth === 1) {
                  setCurrentMonth(12);
                  setCurrentYear(prev => prev - 1);
                } else {
                  setCurrentMonth(prev => prev - 1);
                }
              }}
              className="h-8 w-8 p-0 rounded-xl text-gray-700 dark:text-slate-200 hover:bg-gray-200/60 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-xs font-black text-gray-800 dark:text-slate-100">
              {MESES[currentMonth - 1]} {currentYear}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (currentMonth === 12) {
                  setCurrentMonth(1);
                  setCurrentYear(prev => prev + 1);
                } else {
                  setCurrentMonth(prev => prev + 1);
                }
              }}
              className="h-8 w-8 p-0 rounded-xl text-gray-700 dark:text-slate-200 hover:bg-gray-200/60 dark:hover:bg-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInteractions(false)}
            disabled={loading}
            className="text-xs font-bold rounded-2xl gap-1.5 h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            Actualizar Ahora
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANEL FLOTANTE DE FILTROS SEGÚN EL BOCETO EXACTO DEL USUARIO */}
      {/* ========================================================================= */}
      <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Filtros Dinámicos del Mes</span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              {filteredCount.toLocaleString('es-CO')} de {totalCohort.toLocaleString('es-CO')} programadas (100% BD)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Buscar paciente, cédula, HC..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            >
              Restablecer
            </button>
          </div>
        </div>

        {/* Cuadrícula de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">

          {/* 1. FILTRO DE UBICACIÓN Y TERRITORIO */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <label className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              1. Ubicación / Territorio:
            </label>

            {/* Select Zona: Urbana o Rural (DIVIPOLA Santiago de Cali) */}
            <select
              value={filterZona}
              onChange={(e) => handleZonaChange(e.target.value)}
              className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todas">Todo Santiago de Cali (Urbano y Rural)</option>
              <option value="Rural">🌾 Rural (Corregimiento, Vereda y Centro Poblado)</option>
              <option value="Urbana">🏙️ Urbano (Comuna y Barrio)</option>
            </select>

            {/* Sub-opciones Urbanas: Comuna -> Barrio */}
            {filterZona === 'Urbana' && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Comuna (Cali 1–22):</span>
                  <select
                    value={filterComuna}
                    onChange={(e) => {
                      setFilterComuna(e.target.value);
                      setFilterBarrio('todos');
                      setCurrentPage(1);
                    }}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <option value="todas">Todas las Comunas</option>
                    {caliComunas.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {filterComuna !== 'todas' && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Barrio ({filterComuna}):</span>
                    <select
                      value={filterBarrio}
                      onChange={(e) => { setFilterBarrio(e.target.value); setCurrentPage(1); }}
                      className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    >
                      <option value="todos">Todos los Barrios</option>
                      {caliBarrios.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Sub-opciones Rurales: Corregimiento -> Vereda / Centro Poblado */}
            {filterZona === 'Rural' && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Corregimiento (15 de Cali):</span>
                  <select
                    value={filterCorregimiento}
                    onChange={(e) => {
                      setFilterCorregimiento(e.target.value);
                      setFilterVereda('todas');
                      setFilterCentroPoblado('todos');
                      setCurrentPage(1);
                    }}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <option value="todos">Todos los Corregimientos</option>
                    {caliCorregimientos.map(cr => (
                      <option key={cr} value={cr}>{cr}</option>
                    ))}
                  </select>
                </div>

                {filterCorregimiento !== 'todos' && (
                  <>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Vereda ({filterCorregimiento}):</span>
                      <select
                        value={filterVereda}
                        onChange={(e) => { setFilterVereda(e.target.value); setCurrentPage(1); }}
                        className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      >
                        <option value="todas">Todas las Veredas</option>
                        {caliVeredas.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Centro Poblado ({filterCorregimiento}):</span>
                      <select
                        value={filterCentroPoblado}
                        onChange={(e) => { setFilterCentroPoblado(e.target.value); setCurrentPage(1); }}
                        className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      >
                        <option value="todos">Todos los Centros Poblados</option>
                        {caliCentrosPoblados.map(cp => (
                          <option key={cp} value={cp}>{cp}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 2. FILTRO DE GRUPOS DE RIESGO PRIORIZADO */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <label className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              2. Grupos de Riesgo Priorizado:
            </label>

            <select
              value={filterGrupoRiesgo}
              onChange={(e) => { setFilterGrupoRiesgo(e.target.value); setCurrentPage(1); }}
              className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todos">Todos los Grupos de Riesgo (1 a 11)</option>
              {GRUPOS_RIESGO_3280.map(g => (
                <option key={g.id} value={g.label}>{g.label}</option>
              ))}
            </select>

            <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-lg border border-blue-100 dark:border-blue-800/60 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
              <span className="font-bold block mb-0.5">Criterio Clínico Res. 3280:</span>
              Focaliza la demanda inducida según patologías prevalentes, factores de riesgo cardiovascular, oncológico, materno o salud mental.
            </div>
          </div>

          {/* 3. FILTRO DE TIPO DE USUARIO */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <label className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              3. Tipo de Usuario (Reglas Clínicas):
            </label>

            <select
              value={filterTipoUsuario}
              onChange={(e) => { setFilterTipoUsuario(e.target.value); setCurrentPage(1); }}
              className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todos">
                Todos ({totalCohort.toLocaleString('es-CO')})
              </option>
              <option value="Activo">
                🟢 Activos ({(filterOptions.conteoPorTipo.Activo || 0).toLocaleString('es-CO')}) • &gt;2 visitas HC o &gt;1 año
              </option>
              <option value="Nuevo">
                🔵 Nuevos ({(filterOptions.conteoPorTipo.Nuevo || 0).toLocaleString('es-CO')}) • &lt;1 mes o 1 visita HC
              </option>
              <option value="Inactivo">
                🟠 Inactivos ({(filterOptions.conteoPorTipo.Inactivo || 0).toLocaleString('es-CO')}) • &gt;6 meses sin visitas
              </option>
            </select>

            <div className="space-y-1 text-[10px] text-slate-600 dark:text-slate-400 pt-1">
              <div className="flex items-center justify-between">
                <span><strong className="dark:text-slate-200">Activo:</strong> &gt;2 visitas o &gt;1 año en BD</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded">
                  {(filterOptions.conteoPorTipo.Activo || 0).toLocaleString('es-CO')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span><strong className="dark:text-slate-200">Nuevo:</strong> &lt;1 mes o 1 visita en HC</span>
                <span className="font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.2 rounded">
                  {(filterOptions.conteoPorTipo.Nuevo || 0).toLocaleString('es-CO')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span><strong className="dark:text-slate-200">Inactivo:</strong> &gt;6 meses sin visitas</span>
                <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 rounded">
                  {(filterOptions.conteoPorTipo.Inactivo || 0).toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABLA TIPO LISTA MENSUAL: ORDEN DE LA MÁS PRÓXIMA A LA ÚLTIMA */}
      {/* ========================================================================= */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 dark:bg-slate-950 text-white font-bold tracking-wider text-[11px] border-b dark:border-slate-800">
            <tr>
              <th className="p-3 whitespace-nowrap">Fecha / Hora</th>
              <th className="p-3">Paciente / Documento</th>
              <th className="p-3">Curso de Vida &amp; Grupos de Riesgo</th>
              <th className="p-3">Origen</th>
              <th className="p-3">Procedimiento / Protocolo 3280</th>
              <th className="p-3">Ubicación Territorial</th>
              <th className="p-3 text-center">Tipo Usuario</th>
              <th className="p-3">Canal</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-gray-400 dark:text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Cargando lista mensual de interacciones...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedInteractions.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-gray-400 dark:text-slate-500">
                  No se encontraron interacciones programadas que coincidan con los filtros seleccionados para este mes.
                </td>
              </tr>
            ) : (
              paginatedInteractions.map((item) => {
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">

                    {/* Fecha y Hora */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-black text-gray-900 dark:text-white">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{item.diaNumero} {MESES[currentMonth - 1]?.slice(0, 3)}</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-400 font-normal">({item.diaNombre})</span>
                      </div>
                      <div className="text-[11px] font-mono text-gray-600 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                        {item.horaProgramada}
                      </div>
                    </td>

                    {/* Paciente y Documento */}
                    <td className="p-3">
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <span>{item.pacienteNombre}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-slate-400 font-mono mt-0.5">
                        {item.pacienteTipoDoc} {item.pacienteDoc} • <strong className="text-slate-700 dark:text-slate-200">{item.historiaClinica}</strong>
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-slate-400">
                        {item.edadFormato} • Tel: {item.telefono}
                      </div>
                    </td>

                    {/* Curso de Vida & Grupos de Riesgo Reales */}
                    <td className="p-3 max-w-[220px]">
                      <div className="flex flex-col items-start gap-1">
                        <CursoVidaBadge patient={{ curso_vida: item.cursoVida, edad: item.edad }} />
                        <GruposRiesgoBadges patient={{ grupo_riesgo: item.grupoRiesgo, grupos_riesgo: item.gruposRiesgo }} maxVisible={2} />
                      </div>
                    </td>

                    {/* Origen */}
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        item.origenTipo === 'res3280'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                          : item.origenTipo === 'campana'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                          : 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
                      }`}>
                        {item.origenBadge}
                      </span>
                      {item.campanaNombre && (
                        <p className="text-[10px] text-blue-700 dark:text-blue-400 font-bold truncate max-w-[120px] mt-0.5" title={item.campanaNombre}>
                          {item.campanaNombre}
                        </p>
                      )}
                    </td>

                    {/* Procedimiento / Protocolo */}
                    <td className="p-3 max-w-xs">
                      <div className="font-bold text-gray-900 dark:text-white line-clamp-1" title={item.protocoloNombre}>
                        {item.protocoloNombre}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-1" title={item.hitoClinico}>
                        {item.hitoClinico}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                        CUPS: {item.codigoCups}
                      </div>
                    </td>

                    {/* Ubicación Territorial */}
                    <td className="p-3">
                      <div className="flex items-center gap-1 font-bold text-gray-800 dark:text-slate-100 text-[11px]">
                        {item.zona === 'Urbana' ? (
                          <>
                            <Building2 className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0" />
                            <span>Urbana • {item.comuna}</span>
                          </>
                        ) : (
                          <>
                            <Trees className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Rural • {item.centroPoblado || item.corregimiento}</span>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-slate-400 truncate max-w-[160px]">
                        {item.zona === 'Urbana' ? `Barrio: ${item.barrio}` : `Vereda: ${item.vereda || item.barrio}`}
                      </div>
                    </td>

                    {/* Tipo de Usuario */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                        item.tipoUsuario === 'Activo'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60'
                          : item.tipoUsuario === 'Nuevo'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60'
                      }`}>
                        {item.tipoUsuario === 'Activo' && <UserCheck className="w-3 h-3" />}
                        {item.tipoUsuario === 'Nuevo' && <UserPlus className="w-3 h-3" />}
                        {item.tipoUsuario === 'Inactivo' && <UserX className="w-3 h-3" />}
                        {item.tipoUsuario}
                      </span>
                      <p className="text-[9px] text-gray-400 dark:text-slate-400 mt-0.5">
                        {item.totalVisitasHospital} visitas HC
                      </p>
                    </td>

                    {/* Canal */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-gray-700 dark:text-slate-300 font-semibold text-[11px]">
                        {item.canalId === 'sms' && <Send className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                        {item.canalId === 'email' && <Mail className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                        {item.canalId === 'whatsapp' && <MessageSquare className="w-3 h-3 text-green-600 dark:text-green-400" />}
                        {(!item.canalId || item.canalId === 'call_ia') && <PhoneCall className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
                        <span>{item.canal}</span>
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.estado === 'Confirmada'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                          : item.estado === 'Reagendada'
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                          : item.estado === 'No Contesta'
                          ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                      }`}>
                        {item.estado}
                      </span>
                    </td>

                    {/* Acción Rápida */}
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedItemForModal(item)}
                          className="h-7 px-2 text-xs text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white dark:hover:bg-slate-800"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        <LiveCallButton
                          callKey={item.id}
                          idleLabel="Llamar (P. 1)"
                          testId="demanda-call-btn"
                          onClick={() => handleDirectCall(item)}
                          size="sm"
                          variant="default"
                          className="h-7 px-2.5 rounded-xl font-bold text-[11px] gap-1 shadow-sm"
                          idleClassName="bg-emerald-600 hover:bg-emerald-700 text-white"
                          iconClassName="w-3 h-3 shrink-0"
                          title={`Llamar a ${item.pacienteNombre} (${item.telefono}) por Puerto 1`}
                        />
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* PAGINACIÓN */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500 dark:text-slate-400 pt-2 border-t border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <span>
            Mostrando página <strong className="dark:text-slate-200">{currentPage.toLocaleString('es-CO')}</strong> de <strong className="dark:text-slate-200">{totalPages.toLocaleString('es-CO')}</strong> ({filteredCount.toLocaleString('es-CO')} interacciones reales en BD)
          </span>
          <select
            aria-label="Filas por página Demanda 3280"
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 font-semibold"
          >
            <option value={25}>25 / pág.</option>
            <option value={50}>50 / pág.</option>
            <option value={100}>100 / pág.</option>
            <option value={250}>250 / pág.</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-xs font-bold rounded-xl h-8 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Anterior
          </Button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, currentPage - 2) + i;
            if (pageNum > totalPages) return null;
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(pageNum)}
                className={`text-xs font-bold rounded-xl h-8 w-8 p-0 ${
                  currentPage === pageNum
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {pageNum}
              </Button>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="text-xs font-bold rounded-xl h-8 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Siguiente
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DETALLADO DE INTERACCIÓN Y DISPARO */}
      {/* ========================================================================= */}
      <Dialog open={!!selectedItemForModal} onOpenChange={() => setSelectedItemForModal(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <PhoneForwarded className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Detalle de Interacción Programada • Demanda Res. 3280
            </DialogTitle>
            <DialogDescription>
              {selectedItemForModal?.pacienteNombre} • {selectedItemForModal?.pacienteTipoDoc} {selectedItemForModal?.pacienteDoc} • HC: {selectedItemForModal?.historiaClinica}
            </DialogDescription>
          </DialogHeader>

          {selectedItemForModal && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <CursoVidaBadge patient={{ curso_vida: selectedItemForModal.cursoVida, edad: selectedItemForModal.edad }} />
                <GruposRiesgoBadges patient={{ grupo_riesgo: selectedItemForModal.grupoRiesgo, grupos_riesgo: selectedItemForModal.gruposRiesgo }} maxVisible={4} />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-gray-200 dark:border-slate-700">
                <div>
                  <span className="text-gray-500 dark:text-slate-400 block">Fecha y Hora Programada:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {selectedItemForModal.fechaProgramada} a las {selectedItemForModal.horaProgramada}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-slate-400 block">Origen y Canal:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {selectedItemForModal.origen} • {selectedItemForModal.canal}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="font-bold text-gray-800 dark:text-slate-200 block">Protocolo Clínico Asignado:</span>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedItemForModal.protocoloNombre}</p>
                <p className="text-gray-600 dark:text-slate-300">{selectedItemForModal.hitoClinico}</p>
                <p className="font-mono text-emerald-700 dark:text-emerald-400">CUPS: {selectedItemForModal.codigoCups}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-800/60">
                  <span className="text-blue-700 dark:text-blue-300 font-bold block mb-1">Territorio y Localización:</span>
                  <p className="font-bold text-blue-900 dark:text-blue-200">Zona: {selectedItemForModal.zona}</p>
                  {selectedItemForModal.zona === 'Urbana' ? (
                    <p className="text-blue-800 dark:text-blue-300">{selectedItemForModal.comuna} - {selectedItemForModal.barrio}</p>
                  ) : (
                    <p className="text-blue-800 dark:text-blue-300">
                      {selectedItemForModal.centroPoblado || selectedItemForModal.corregimiento} - {selectedItemForModal.vereda}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-800/60">
                  <span className="text-purple-700 dark:text-purple-300 font-bold block mb-1">Clasificación Hospitalaria:</span>
                  <p className="font-bold text-purple-900 dark:text-purple-200">Tipo: {selectedItemForModal.tipoUsuario}</p>
                  <p className="text-purple-800 dark:text-purple-300">Visitas previas: {selectedItemForModal.totalVisitasHospital}</p>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400">Ingreso: {selectedItemForModal.fechaIngresoHospital}</p>
                </div>
              </div>

              {selectedItemForModal.transcripcion && (
                <div>
                  <span className="font-bold text-gray-800 dark:text-slate-200 block mb-1">Transcripción de Llamada Previa:</span>
                  <div className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap border border-transparent dark:border-slate-800">
                    {selectedItemForModal.transcripcion}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <LiveCallButton
                  callKey={selectedItemForModal.id}
                  idleLabel="Ejecutar Llamada Ahora por GSM Puerto 1"
                  testId="demanda-modal-call-btn"
                  onClick={() => handleDirectCall(selectedItemForModal)}
                  size="default"
                  variant="default"
                  className="w-full rounded-2xl font-bold text-xs py-3 gap-2 shadow-md"
                  idleClassName="bg-emerald-600 hover:bg-emerald-700 text-white"
                  iconClassName="h-4 w-4 shrink-0"
                />
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

