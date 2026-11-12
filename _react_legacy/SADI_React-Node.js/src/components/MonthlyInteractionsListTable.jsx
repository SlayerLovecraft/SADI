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
import { vapiIntegrationService } from '@/services/vapiIntegrationService';
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
  const [loading, setLoading] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modal de Detalle / Llamada
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [callingId, setCallingId] = useState(null);

  // Carga inicial y por cambio de mes/año
  const fetchInteractions = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await demanda3280Service.getMonthlyInteractionsList({
        year: currentYear,
        month: currentMonth
      });
      setInteractions(data);
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
  }, [currentYear, currentMonth]);

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
  }, [currentYear, currentMonth]);

  // Extraer opciones dinámicas para los selects
  const filterOptions = useMemo(() => {
    return demanda3280Service.extractFilterOptions(interactions);
  }, [interactions]);

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
    setCurrentPage(1);
  };

  // Filtrado de la lista
  const filteredInteractions = useMemo(() => {
    let list = demanda3280Service.filterInteractions(interactions, {
      zona: filterZona,
      comuna: filterComuna,
      barrio: filterBarrio,
      centroPoblado: filterCentroPoblado,
      corregimiento: filterCorregimiento,
      vereda: filterVereda,
      grupoRiesgo: filterGrupoRiesgo,
      tipoUsuario: filterTipoUsuario
    });

    // Restricción por rol de Enfermera / Personal Clínico:
    // Solo ve los pacientes correspondientes a los Cursos de Vida asignados por el Hospital
    if (user?.role === 'doctor') {
      const cursos = normalizeCursosArray(user?.cursos_vida_asignados);
      if (!cursos.includes('todos')) {
        list = list.filter(i => {
          const cv = i.cursoVida === 'materno_perinatal' ? 'preventivo_mujer' : i.cursoVida;
          return cursos.includes(cv);
        });
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(i => 
        i.pacienteNombre.toLowerCase().includes(term) ||
        i.pacienteDoc.toLowerCase().includes(term) ||
        (i.historiaClinica && i.historiaClinica.toLowerCase().includes(term)) ||
        i.protocoloNombre.toLowerCase().includes(term) ||
        i.telefono.includes(term)
      );
    }

    return list;
  }, [
    interactions,
    filterZona,
    filterComuna,
    filterBarrio,
    filterCentroPoblado,
    filterCorregimiento,
    filterVereda,
    filterGrupoRiesgo,
    filterTipoUsuario,
    searchTerm,
    user
  ]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredInteractions.length / itemsPerPage));
  const paginatedInteractions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInteractions.slice(start, start + itemsPerPage);
  }, [filteredInteractions, currentPage]);

  // Disparar llamada inmediata por Puerto 22 con validación de permisos
  const handleDirectCall = async (item) => {
    // Verificar restricción de permisos del personal
    if (user?.role === 'doctor' && user?.solo_lectura && !user?.puede_lanzar_llamadas) {
      toast({
        title: "🔒 Permiso Restringido por el Hospital",
        description: "Su usuario tiene permisos de 'Solo Lectura'. No está autorizada para emitir llamadas salientes a los pacientes.",
        variant: "destructive"
      });
      return;
    }

    setCallingId(item.id);
    toast({
      title: "📞 Conectando Llamada en Vivo (Puerto 22)...",
      description: `Marcando a ${item.pacienteNombre} (${item.telefono}) por Gateway GSM...`
    });

    try {
      await vapiIntegrationService.triggerLiveCall(item.telefono, {
        nombre: item.pacienteNombre,
        cedula: item.pacienteDoc,
        programa: item.protocoloNombre,
        direccion: item.barrio ? `${item.barrio}, ${item.zona}` : 'Caldas, Antioquia'
      });

      toast({
        title: "🟢 Llamada Conectada con Éxito",
        description: `Canal GSM Puerto 22 enlazado para ${item.pacienteNombre}. Se actualizó el estado a 'Confirmada'.`
      });

      // Actualizar estado local
      setInteractions(prev => prev.map(it => it.id === item.id ? { ...it, estado: 'Confirmada', intentos: (it.intentos || 0) + 1 } : it));
      if (onExecuteCallSuccess) onExecuteCallSuccess();
    } catch (e) {
      toast({
        title: "Fallo de conexión",
        description: e.message || 'Error al conectar la llamada por Puerto 22.',
        variant: "destructive"
      });
    } finally {
      setCallingId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-6 space-y-6">

      {/* ========================================================================= */}
      {/* CABECERA: TÍTULO, TIEMPO REAL (60s) Y NAVEGACIÓN MENSUAL */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Tiempo Real • Sincronización cada 60s
            </span>
            <span className="text-[11px] font-mono text-gray-400">
              Próxima en: <strong className="text-gray-700">{secondsRemaining}s</strong>
            </span>
          </div>

          <h2 className="text-xl font-black text-gray-900 mt-1 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            Lista Mensual Unificada de Interacciones Programadas
          </h2>
          <p className="text-xs text-gray-500">
            Resolución 3280, Campañas Activas y Salidas Individuales ordenadas cronológicamente de la más próxima a la última del mes.
          </p>
        </div>

        {/* Selector de Mes / Año & Botón Actualizar */}
        <div className="flex items-center gap-2.5 self-start lg:self-auto">
          <div className="flex items-center bg-gray-50 rounded-2xl border border-gray-200 p-1">
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
              className="h-8 w-8 p-0 rounded-xl"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-xs font-black text-gray-800">
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
              className="h-8 w-8 p-0 rounded-xl"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInteractions(false)}
            disabled={loading}
            className="text-xs font-bold rounded-2xl gap-1.5 h-10 border-gray-200 hover:bg-gray-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            Actualizar Ahora
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANEL FLOTANTE DE FILTROS SEGÚN EL BOCETO EXACTO DEL USUARIO */}
      {/* ========================================================================= */}
      <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filtros Dinámicos del Mes</span>
            <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {filteredInteractions.length} de {interactions.length} programadas
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar paciente, cédula, HC..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors"
            >
              Restablecer
            </button>
          </div>
        </div>

        {/* Cuadrícula de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">

          {/* 1. FILTRO DE UBICACIÓN Y TERRITORIO */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
            <label className="font-black text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              1. Ubicación / Territorio:
            </label>

            {/* Select Zona: Urbana o Rural */}
            <select
              value={filterZona}
              onChange={(e) => handleZonaChange(e.target.value)}
              className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-slate-50 font-bold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todas">Todas las Ubicaciones (Urbano y Rural)</option>
              <option value="Urbana">🏙️ Urbano (Comuna y Barrio)</option>
              <option value="Rural">🌾 Rural (Centro Poblado, Corregimiento y Vereda)</option>
            </select>

            {/* Sub-opciones Urbanas: Comuna y Barrio */}
            {filterZona === 'Urbana' && (
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Comuna:</span>
                  <select
                    value={filterComuna}
                    onChange={(e) => {
                      setFilterComuna(e.target.value);
                      setFilterBarrio('todos');
                      setCurrentPage(1);
                    }}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="todas">Todas las Comunas</option>
                    {filterOptions.comunas.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Barrio:</span>
                  <select
                    value={filterBarrio}
                    onChange={(e) => { setFilterBarrio(e.target.value); setCurrentPage(1); }}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="todos">Todos los Barrios</option>
                    {(filterComuna !== 'todas' && filterOptions.barriosPorComuna[filterComuna] 
                      ? filterOptions.barriosPorComuna[filterComuna] 
                      : Object.values(filterOptions.barriosPorComuna).flat()
                    ).map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Sub-opciones Rurales: Centro Poblado, Corregimiento y Vereda */}
            {filterZona === 'Rural' && (
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Centro Poblado:</span>
                  <select
                    value={filterCentroPoblado}
                    onChange={(e) => { setFilterCentroPoblado(e.target.value); setCurrentPage(1); }}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="todos">Todos los Centros Poblados</option>
                    {filterOptions.centrosPoblados.map(cp => (
                      <option key={cp} value={cp}>{cp}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Corregimiento:</span>
                  <select
                    value={filterCorregimiento}
                    onChange={(e) => { setFilterCorregimiento(e.target.value); setCurrentPage(1); }}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="todos">Todos los Corregimientos</option>
                    {filterOptions.corregimientos.map(cr => (
                      <option key={cr} value={cr}>{cr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Vereda:</span>
                  <select
                    value={filterVereda}
                    onChange={(e) => { setFilterVereda(e.target.value); setCurrentPage(1); }}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="todas">Todas las Veredas</option>
                    {filterOptions.veredas.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 2. FILTRO DE GRUPOS DE RIESGO PRIORIZADO */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
            <label className="font-black text-slate-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              2. Grupos de Riesgo Priorizado:
            </label>

            <select
              value={filterGrupoRiesgo}
              onChange={(e) => { setFilterGrupoRiesgo(e.target.value); setCurrentPage(1); }}
              className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-slate-50 font-bold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todos">Todos los Grupos de Riesgo (1 a 7)</option>
              {GRUPOS_RIESGO_3280.map(g => (
                <option key={g.id} value={g.label}>{g.label}</option>
              ))}
            </select>

            <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-100 text-[11px] text-blue-900 leading-relaxed">
              <span className="font-bold block mb-0.5">Criterio Clínico Res. 3280:</span>
              Focaliza la demanda inducida según patologías prevalentes, factores de riesgo cardiovascular, oncológico, materno o salud mental.
            </div>
          </div>

          {/* 3. FILTRO DE TIPO DE USUARIO */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
            <label className="font-black text-slate-800 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-purple-600" />
              3. Tipo de Usuario (Reglas Clínicas):
            </label>

            <select
              value={filterTipoUsuario}
              onChange={(e) => { setFilterTipoUsuario(e.target.value); setCurrentPage(1); }}
              className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-slate-50 font-bold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todos">
                Todos ({interactions.length})
              </option>
              <option value="Activo">
                🟢 Activos ({filterOptions.conteoPorTipo.Activo || 0}) • &gt;2 visitas HC o &gt;1 año
              </option>
              <option value="Nuevo">
                🔵 Nuevos ({filterOptions.conteoPorTipo.Nuevo || 0}) • &lt;1 mes o 1 visita HC
              </option>
              <option value="Inactivo">
                🟠 Inactivos ({filterOptions.conteoPorTipo.Inactivo || 0}) • &gt;6 meses sin visitas
              </option>
            </select>

            <div className="space-y-1 text-[10px] text-slate-600 pt-1">
              <div className="flex items-center justify-between">
                <span><strong>Activo:</strong> &gt;2 visitas o &gt;1 año en BD</span>
                <span className="font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                  {filterOptions.conteoPorTipo.Activo || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span><strong>Nuevo:</strong> &lt;1 mes o 1 visita en HC</span>
                <span className="font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">
                  {filterOptions.conteoPorTipo.Nuevo || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span><strong>Inactivo:</strong> &gt;6 meses sin visitas</span>
                <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                  {filterOptions.conteoPorTipo.Inactivo || 0}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABLA TIPO LISTA MENSUAL: ORDEN DE LA MÁS PRÓXIMA A LA ÚLTIMA */}
      {/* ========================================================================= */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-white font-bold tracking-wider text-[11px]">
            <tr>
              <th className="p-3 whitespace-nowrap">Fecha / Hora</th>
              <th className="p-3">Paciente / Documento</th>
              <th className="p-3">Origen</th>
              <th className="p-3">Procedimiento / Protocolo 3280</th>
              <th className="p-3">Ubicación Territorial</th>
              <th className="p-3 text-center">Tipo Usuario</th>
              <th className="p-3">Canal</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    <span className="text-xs font-semibold text-gray-500">Cargando lista mensual de interacciones...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedInteractions.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-gray-400">
                  No se encontraron interacciones programadas que coincidan con los filtros seleccionados para este mes.
                </td>
              </tr>
            ) : (
              paginatedInteractions.map((item, idx) => {
                const isCalling = callingId === item.id;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">

                    {/* Fecha y Hora */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-black text-gray-900">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{item.diaNumero} {MESES[currentMonth - 1]?.slice(0, 3)}</span>
                        <span className="text-[10px] text-gray-400 font-normal">({item.diaNombre})</span>
                      </div>
                      <div className="text-[11px] font-mono text-gray-600 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {item.horaProgramada}
                      </div>
                    </td>

                    {/* Paciente y Documento */}
                    <td className="p-3">
                      <div className="font-bold text-gray-900 flex items-center gap-1.5">
                        <span>{item.pacienteNombre}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {item.pacienteTipoDoc} {item.pacienteDoc} • <strong className="text-slate-700">{item.historiaClinica}</strong>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {item.edadFormato} • Tel: {item.telefono}
                      </div>
                    </td>

                    {/* Origen */}
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        item.origenTipo === 'res3280'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : item.origenTipo === 'campana'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}>
                        {item.origenBadge}
                      </span>
                      {item.campanaNombre && (
                        <p className="text-[10px] text-blue-700 font-bold truncate max-w-[120px] mt-0.5" title={item.campanaNombre}>
                          {item.campanaNombre}
                        </p>
                      )}
                    </td>

                    {/* Procedimiento / Protocolo */}
                    <td className="p-3 max-w-xs">
                      <div className="font-bold text-gray-900 line-clamp-1" title={item.protocoloNombre}>
                        {item.protocoloNombre}
                      </div>
                      <div className="text-[11px] text-gray-500 line-clamp-1" title={item.hitoClinico}>
                        {item.hitoClinico}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-700 mt-0.5">
                        CUPS: {item.codigoCups}
                      </div>
                    </td>

                    {/* Ubicación Territorial */}
                    <td className="p-3">
                      <div className="flex items-center gap-1 font-bold text-gray-800 text-[11px]">
                        {item.zona === 'Urbana' ? (
                          <>
                            <Building2 className="w-3 h-3 text-blue-500 shrink-0" />
                            <span>Urbana • {item.comuna}</span>
                          </>
                        ) : (
                          <>
                            <Trees className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Rural • {item.centroPoblado || item.corregimiento}</span>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[160px]">
                        {item.zona === 'Urbana' ? `Barrio: ${item.barrio}` : `Vereda: ${item.vereda || item.barrio}`}
                      </div>
                    </td>

                    {/* Tipo de Usuario */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                        item.tipoUsuario === 'Activo'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : item.tipoUsuario === 'Nuevo'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {item.tipoUsuario === 'Activo' && <UserCheck className="w-3 h-3" />}
                        {item.tipoUsuario === 'Nuevo' && <UserPlus className="w-3 h-3" />}
                        {item.tipoUsuario === 'Inactivo' && <UserX className="w-3 h-3" />}
                        {item.tipoUsuario}
                      </span>
                      <p className="text-[9px] text-gray-400 mt-0.5">
                        {item.totalVisitasHospital} visitas HC
                      </p>
                    </td>

                    {/* Canal */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-gray-700 font-semibold text-[11px]">
                        {item.canalId === 'sms' && <Send className="w-3 h-3 text-emerald-600" />}
                        {item.canalId === 'email' && <Mail className="w-3 h-3 text-blue-600" />}
                        {item.canalId === 'whatsapp' && <MessageSquare className="w-3 h-3 text-green-600" />}
                        {(!item.canalId || item.canalId === 'call_ia') && <PhoneCall className="w-3 h-3 text-purple-600" />}
                        <span>{item.canal}</span>
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.estado === 'Confirmada'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.estado === 'Reagendada'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : item.estado === 'No Contesta'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-gray-100 text-gray-700'
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
                          className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleDirectCall(item)}
                          disabled={isCalling}
                          className="h-7 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] gap-1 shadow-sm"
                        >
                          <PhoneCall className="w-3 h-3" />
                          {isCalling ? 'Marcando...' : 'Llamar (P. 22)'}
                        </Button>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500 pt-2 border-t border-gray-100">
        <div>
          Mostrando página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredInteractions.length} interacciones encontradas)
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-xs font-bold rounded-xl h-8"
          >
            Anterior
          </Button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = i + 1;
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(pageNum)}
                className={`text-xs font-bold rounded-xl h-8 w-8 p-0 ${
                  currentPage === pageNum ? 'bg-emerald-600 text-white' : ''
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
            className="text-xs font-bold rounded-xl h-8"
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
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <PhoneForwarded className="w-5 h-5 text-emerald-600" />
              Detalle de Interacción Programada • Demanda Res. 3280
            </DialogTitle>
            <DialogDescription>
              {selectedItemForModal?.pacienteNombre} • {selectedItemForModal?.pacienteTipoDoc} {selectedItemForModal?.pacienteDoc} • HC: {selectedItemForModal?.historiaClinica}
            </DialogDescription>
          </DialogHeader>

          {selectedItemForModal && (
            <div className="space-y-4 pt-2 text-xs">

              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
                <div>
                  <span className="text-gray-500 block">Fecha y Hora Programada:</span>
                  <span className="font-bold text-gray-900">
                    {selectedItemForModal.fechaProgramada} a las {selectedItemForModal.horaProgramada}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Origen y Canal:</span>
                  <span className="font-bold text-emerald-700">
                    {selectedItemForModal.origen} • {selectedItemForModal.canal}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="font-bold text-gray-800 block">Protocolo Clínico Asignado:</span>
                <p className="font-semibold text-gray-900">{selectedItemForModal.protocoloNombre}</p>
                <p className="text-gray-600">{selectedItemForModal.hitoClinico}</p>
                <p className="font-mono text-emerald-700">CUPS: {selectedItemForModal.codigoCups}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                  <span className="text-blue-700 font-bold block mb-1">Territorio y Localización:</span>
                  <p className="font-bold text-blue-900">Zona: {selectedItemForModal.zona}</p>
                  {selectedItemForModal.zona === 'Urbana' ? (
                    <p className="text-blue-800">{selectedItemForModal.comuna} - {selectedItemForModal.barrio}</p>
                  ) : (
                    <p className="text-blue-800">
                      {selectedItemForModal.centroPoblado || selectedItemForModal.corregimiento} - {selectedItemForModal.vereda}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                  <span className="text-purple-700 font-bold block mb-1">Clasificación Hospitalaria:</span>
                  <p className="font-bold text-purple-900">Tipo: {selectedItemForModal.tipoUsuario}</p>
                  <p className="text-purple-800">Visitas previas: {selectedItemForModal.totalVisitasHospital}</p>
                  <p className="text-[10px] text-purple-600">Ingreso: {selectedItemForModal.fechaIngresoHospital}</p>
                </div>
              </div>

              {selectedItemForModal.transcripcion && (
                <div>
                  <span className="font-bold text-gray-800 block mb-1">Transcripción de Llamada Previa:</span>
                  <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {selectedItemForModal.transcripcion}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button
                  onClick={() => {
                    handleDirectCall(selectedItemForModal);
                    setSelectedItemForModal(null);
                  }}
                  disabled={callingId === selectedItemForModal.id}
                  className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 gap-2 shadow-md"
                >
                  <PhoneCall className="h-4 w-4" />
                  Ejecutar Llamada Ahora por GSM Puerto 22
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

