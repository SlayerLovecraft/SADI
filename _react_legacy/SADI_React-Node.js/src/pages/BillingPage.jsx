import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import {
  billingService,
  PRICING_CONSTANTS,
  MESES_ANO
} from '@/services/billingService';
import {
  Receipt,
  Download,
  FileSpreadsheet,
  FileCode,
  DollarSign,
  TrendingUp,
  Users,
  PhoneCall,
  MessageSquare,
  Mail,
  Send,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  Copy,
  ChevronRight,
  ShieldCheck,
  Building2,
  X,
  Check,
  Activity,
  Filter,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const BillingPage = () => {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(11); // Noviembre por defecto
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCursoVida, setSelectedCursoVida] = useState('todos');
  const [selectedPatientModal, setSelectedPatientModal] = useState(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [loading, setLoading] = useState(true);
  const [monthData, setMonthData] = useState(null);

  // Filtros del Panel de LOGs de Entregabilidad
  const [logChannelFilter, setLogChannelFilter] = useState('todos');
  const [logStatusFilter, setLogStatusFilter] = useState('todos');
  const [activeTab, setActiveTab] = useState('pacientes'); // 'pacientes' | 'logs'

  // Cargar datos reales de Supabase para el mes seleccionado
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const hospitalId = user?.hospital_id || user?.id || null;
        const data = await billingService.getMonthlyBillingData(selectedYear, selectedMonth, hospitalId);
        if (isMounted) {
          setMonthData(data);
        }
      } catch (err) {
        console.error('Error cargando datos de facturación:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedYear, selectedMonth, user]);

  // Filtrar pacientes
  const filteredPatients = useMemo(() => {
    if (!monthData?.pacientes) return [];
    return monthData.pacientes.filter(p => {
      const matchSearch =
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.documento).includes(searchTerm) ||
        p.telefono.includes(searchTerm);

      const matchCurso =
        selectedCursoVida === 'todos' || p.cursoVida?.id === selectedCursoVida;

      return matchSearch && matchCurso;
    });
  }, [monthData, searchTerm, selectedCursoVida]);

  // Filtrar LOGs de entregabilidad
  const filteredLogs = useMemo(() => {
    if (!monthData?.logsAuditoria) return [];
    return monthData.logsAuditoria.filter(l => {
      const matchChannel =
        logChannelFilter === 'todos' ||
        (logChannelFilter === 'llamada' && l.canal === 'Llamada IA') ||
        (logChannelFilter === 'whatsapp' && l.canal === 'WhatsApp') ||
        (logChannelFilter === 'sms' && l.canal === 'SMS') ||
        (logChannelFilter === 'email' && l.canal === 'E-mail');

      const matchStatus =
        logStatusFilter === 'todos' ||
        (logStatusFilter === 'exitoso' && l.exito) ||
        (logStatusFilter === 'fallido' && !l.exito);

      return matchChannel && matchStatus;
    });
  }, [monthData, logChannelFilter, logStatusFilter]);

  // Manejador descarga RIPS JSON Mensual
  const handleDownloadMonthlyRips = () => {
    if (!monthData) return;
    const hospitalInfo = {
      nombre: user?.hospital_name || 'HOSPITAL CENTRAL SADI',
      nit: '890102030-4',
      codHabilitacion: '170010012301'
    };
    const ripsJson = billingService.generateMonthlyRipsJSON(monthData, hospitalInfo);
    const filename = `RIPS_SADI_${selectedYear}_M${String(selectedMonth).padStart(2, '0')}_${monthData.mesAbrev}_Consolidado.json`;
    billingService.downloadJSON(filename, ripsJson);
  };

  // Manejador descarga RIPS JSON Individual
  const handleDownloadIndividualRips = (patient) => {
    if (!monthData) return;
    const hospitalInfo = {
      nombre: user?.hospital_name || 'HOSPITAL CENTRAL SADI',
      nit: '890102030-4',
      codHabilitacion: '170010012301'
    };
    const ripsJson = billingService.generateIndividualPatientRipsJSON(patient, monthData, hospitalInfo);
    const filename = `RIPS_SADI_${selectedYear}_M${String(selectedMonth).padStart(2, '0')}_PAC_${patient.documento}.json`;
    billingService.downloadJSON(filename, ripsJson);
  };

  // Manejador exportar Excel mensual
  const handleExportExcel = () => {
    if (!monthData) return;
    billingService.exportMonthlyExcel(monthData, {
      nombre: user?.hospital_name || 'HOSPITAL CENTRAL SADI'
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  if (loading || !monthData) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-600">
            Conectando a Supabase y calculando entregabilidad de facturación...
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Facturación y RIPS JSON - SADI</title>
        <meta name="description" content="Módulo de Cobro Hospitalario, Entregabilidad y RIPS JSON bajo Resolución 2275 de 2023" />
      </Helmet>

      <div className="space-y-6">
        {/* Cabecera Principal */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Facturación, Entregabilidad y RIPS JSON
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Liquidación oficial al Hospital por envíos exitosos • Resolución 2275 de 2023 • Código CUPS:{' '}
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {PRICING_CONSTANTS.CODIGO_CUPS} (Medicina General / Teleorientación)
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Botones de Descarga Global del Mes */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleDownloadMonthlyRips}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md shadow-emerald-600/20 flex items-center gap-2"
            >
              <FileCode className="h-4 w-4" />
              <span>Descargar RIPS JSON Mensual ({monthData.mesNombre})</span>
            </Button>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="border-slate-300 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar Excel (.xlsx)</span>
            </Button>
          </div>
        </div>

        {/* Selector de Meses y Año */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Seleccionar Periodo de Facturación:</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Año Contable:</span>
              <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md font-bold">{selectedYear}</span>
            </div>
          </div>

          {/* Selector de los 12 Meses */}
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {MESES_ANO.map((m) => {
              const isSelected = selectedMonth === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMonth(m.id)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/70'
                  }`}
                >
                  <div>{m.abrev}</div>
                  <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                    Mes {m.id}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tarjetas KPI de Facturación Oficial (Sin márgenes ni costos internos SADI) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* TOTAL FACTURADO HOSPITAL - Exacto y transparente */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 rounded-2xl shadow-lg shadow-blue-600/15 border border-blue-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">Total Facturado Hospital</span>
              <div className="p-2 bg-white/10 rounded-lg text-white">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-black mt-2 tracking-tight">
              ${monthData.totales.totalFacturado.toLocaleString('es-CO')} COP
            </div>
            <p className="text-xs text-blue-100 mt-1.5 font-medium">
              Periodo: {monthData.mesNombre} {selectedYear} • Liquidación exacta
            </p>
          </div>

          {/* INTERVENCIONES ENTREGADAS CON ÉXITO */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Intervenciones Exitosas</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {monthData.totales.totalEnviosExitosos.toLocaleString('es-CO')} Atenciones
            </div>
            <p className="text-xs text-emerald-600 font-semibold mt-1">
              Solo se cobra lo recibido por el paciente
            </p>
          </div>

          {/* TASA DE EFECTIVIDAD GLOBAL */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tasa de Efectividad Global</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-indigo-600 mt-2">
              {monthData.totales.tasaExitoGlobalPct}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {monthData.totales.totalEnviosFallidos} envíos fallidos exentos ($0 COP)
            </p>
          </div>

          {/* PACIENTES ATENDIDOS E INDUCIDOS */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pacientes de la BD</span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {monthData.totales.pacientesCount} Pacientes
            </div>
            <p className="text-xs text-purple-600 font-medium mt-1">
              Registros verificados en Supabase
            </p>
          </div>
        </div>

        {/* Desglose Operativo y Tarifario por Canal (Basado en el Excel del Usuario) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span>Desglose Operativo y Tarifario por Canal ({monthData.mesNombre})</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              * Facturación calculada exclusivamente sobre eventos efectivos
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Llamadas IA */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">Llamadas IA (Vapi + GSM)</span>
                </div>
                <span className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  {monthData.desgloseCanales.llamadas.tarifa}
                </span>
              </div>
              <div className="text-xl font-black text-slate-900">
                {monthData.desgloseCanales.llamadas.segundos.toLocaleString('es-CO')} seg contestados
              </div>
              <div className="mt-2 text-xs flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">
                  {monthData.desgloseCanales.llamadas.exitosas} de {monthData.desgloseCanales.llamadas.intentos} ({monthData.desgloseCanales.llamadas.tasaExito}%)
                </span>
                <span className="font-bold text-blue-700">
                  ${monthData.desgloseCanales.llamadas.facturado.toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">WhatsApp Verificado</span>
                </div>
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  {monthData.desgloseCanales.whatsapp.tarifa}
                </span>
              </div>
              <div className="text-xl font-black text-slate-900">
                {monthData.desgloseCanales.whatsapp.exitosos.toLocaleString('es-CO')} mensajes entregados
              </div>
              <div className="mt-2 text-xs flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">
                  Efectividad: {monthData.desgloseCanales.whatsapp.tasaExito}%
                </span>
                <span className="font-bold text-emerald-700">
                  ${monthData.desgloseCanales.whatsapp.facturado.toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>

            {/* SMS */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-800">Mensajes SMS</span>
                </div>
                <span className="text-[11px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                  {monthData.desgloseCanales.sms.tarifa}
                </span>
              </div>
              <div className="text-xl font-black text-slate-900">
                {monthData.desgloseCanales.sms.exitosos.toLocaleString('es-CO')} SMS recibidos
              </div>
              <div className="mt-2 text-xs flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">
                  Efectividad: {monthData.desgloseCanales.sms.tasaExito}%
                </span>
                <span className="font-bold text-purple-700">
                  ${monthData.desgloseCanales.sms.facturado.toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>

            {/* E-mails */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-cyan-600" />
                  <span className="text-xs font-bold text-slate-800">E-mails Remitidos</span>
                </div>
                <span className="text-[11px] font-bold bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded">
                  {monthData.desgloseCanales.email.tarifa}
                </span>
              </div>
              <div className="text-xl font-black text-slate-900">
                {monthData.desgloseCanales.email.exitosos.toLocaleString('es-CO')} correos en bandeja
              </div>
              <div className="mt-2 text-xs flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">
                  Efectividad: {monthData.desgloseCanales.email.tasaExito}%
                </span>
                <span className="font-bold text-cyan-700">
                  ${monthData.desgloseCanales.email.facturado.toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pestañas de Vista: Detalle de Pacientes vs LOGs de Entregabilidad */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('pacientes')}
            className={`pb-3 px-4 text-sm font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'pacientes'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Facturación Individual por Paciente ({filteredPatients.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-4 text-sm font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Panel de LOGs de Entregabilidad ({filteredLogs.length})</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
              Auditoría
            </span>
          </button>
        </div>

        {/* VISTA 1: TABLA DE PACIENTES */}
        {activeTab === 'pacientes' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pacientes Atendidos en {monthData.mesNombre} ({filteredPatients.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Valor exacto facturado al Hospital por cada paciente contactado de forma exitosa.
                  </p>
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px]">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar paciente, documento..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <select
                    value={selectedCursoVida}
                    onChange={(e) => setSelectedCursoVida(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  >
                    <option value="todos">Todos los Cursos de Vida (A - J)</option>
                    <option value="A">A. Primera Infancia</option>
                    <option value="B">B. Infancia</option>
                    <option value="C">C. Adolescencia</option>
                    <option value="D">D. Juventud</option>
                    <option value="E">E. Adultez</option>
                    <option value="F">F. Vejez</option>
                    <option value="G">G. Preventivo de la Mujer</option>
                    <option value="H">H. Planificación Familiar</option>
                    <option value="I">I. Vacunación</option>
                    <option value="J">J. Salud Oral</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tabla Responsive */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-3">Curso de Vida & Hito</th>
                    <th className="py-3 px-3">Envíos Efectivos</th>
                    <th className="py-3 px-3">Llamada Contestada</th>
                    <th className="py-3 px-3 text-right">Total Facturado Hospital</th>
                    <th className="py-3 px-4 text-center">Acciones y RIPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Paciente */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{p.nombre}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{p.tipoDocumento}: {p.documento}</span>
                            <span>•</span>
                            <span>{p.edad} años ({p.generoTexto})</span>
                          </div>
                        </td>

                        {/* Curso de Vida & Hito */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${p.cursoVida?.badgeColor || 'bg-slate-100'}`}>
                              {p.cursoVida?.id}. {p.cursoVida?.nombre}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 truncate max-w-[220px]" title={p.hito3280}>
                            {p.hito3280}
                          </div>
                        </td>

                        {/* Envíos Efectivos */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100" title="WhatsApp Entregado">
                              <MessageSquare className="h-3 w-3" />
                              {p.waExitosos} WA
                            </span>
                            {p.smsExitosos > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100" title="SMS Recibido">
                                <Send className="h-3 w-3" />
                                {p.smsExitosos} SMS
                              </span>
                            )}
                            {p.emailExitosos > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-100" title="E-mail en Bandeja">
                                <Mail className="h-3 w-3" />
                                {p.emailExitosos} Mail
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Llamada */}
                        <td className="py-3 px-3">
                          {p.contactadoExitoso ? (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">
                              <PhoneCall className="h-3 w-3 text-blue-600" />
                              {p.segundosLlamada}s (${p.cobroDesglose.llamadas.toLocaleString('es-CO')})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium border border-slate-200">
                              <XCircle className="h-3 w-3 text-slate-400" />
                              No contestó ($0 COP)
                            </span>
                          )}
                        </td>

                        {/* Total Facturado */}
                        <td className="py-3 px-3 text-right">
                          <div className="font-black text-blue-700 text-sm">
                            ${p.cobroDesglose.total.toLocaleString('es-CO')} COP
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            CUPS {PRICING_CONSTANTS.CODIGO_CUPS}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadIndividualRips(p)}
                              title="Descargar RIPS JSON individual de este paciente"
                              className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-1 font-medium"
                            >
                              <FileCode className="h-3.5 w-3.5" />
                              <span>RIPS JSON</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPatientModal(p)}
                              title="Ver detalle del cobro y comprobante"
                              className="h-8 px-2 text-xs text-slate-700 border-slate-200 hover:bg-slate-100"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No se encontraron pacientes para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 2: PANEL DE LOGS DE ENTREGABILIDAD */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <span>Registro Oficial de Envíos y Entregabilidad ({filteredLogs.length} eventos)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Auditoría de contactabilidad en tiempo real. Solo los eventos confirmados como exitosos generan cobro al Hospital.
                  </p>
                </div>

                {/* Filtros de LOGs */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={logChannelFilter}
                    onChange={(e) => setLogChannelFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  >
                    <option value="todos">Todos los Canales</option>
                    <option value="llamada">Llamadas IA</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">E-mail</option>
                  </select>

                  <select
                    value={logStatusFilter}
                    onChange={(e) => setLogStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  >
                    <option value="todos">Todos los Estados</option>
                    <option value="exitoso">Solo Exitosos (Facturables)</option>
                    <option value="fallido">Solo Fallidos (Exentos $0 COP)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tabla de LOGs */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Fecha / Hora</th>
                    <th className="py-3 px-3">Paciente</th>
                    <th className="py-3 px-3">Canal</th>
                    <th className="py-3 px-3">Resultado de Entrega</th>
                    <th className="py-3 px-3">Detalle Técnico</th>
                    <th className="py-3 px-4 text-right">Cobro Hospital</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                          {log.paciente} ({log.documento})
                        </td>
                        <td className="py-2.5 px-3 font-sans font-medium">
                          {log.canal}
                        </td>
                        <td className="py-2.5 px-3">
                          {log.exito ? (
                            <span className="inline-flex items-center gap-1 font-sans font-bold px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle className="h-3 w-3" />
                              {log.estado}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-sans font-bold px-2 py-0.5 rounded text-[11px] bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="h-3 w-3" />
                              {log.estado}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600">
                          {log.detalle}
                        </td>
                        <td className="py-2.5 px-4 text-right font-sans">
                          {log.facturable ? (
                            <span className="font-bold text-blue-700">
                              +${log.valorCobrado.toLocaleString('es-CO')} COP
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">
                              $0 COP (Exento)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                        No hay registros que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALLE DE FACTURACIÓN INDIVIDUAL Y COMPROBANTE */}
      <AnimatePresence>
        {selectedPatientModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header Modal */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 text-white rounded-xl">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Liquidación Individual de Cobro al Hospital
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedPatientModal.nombre} • {selectedPatientModal.tipoDocumento}: {selectedPatientModal.documento}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPatientModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Contenido Modal */}
              <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
                {/* Resumen Total Facturado */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-700">Total Facturado por este Paciente</span>
                    <p className="text-2xl font-black text-blue-900 mt-0.5">
                      ${selectedPatientModal.cobroDesglose.total.toLocaleString('es-CO')} COP
                    </p>
                    <span className="text-[11px] text-blue-600 font-medium">
                      Atención asistencial • Código CUPS: {PRICING_CONSTANTS.CODIGO_CUPS}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha y Hora Atención</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {selectedPatientModal.fechaHoraAtencion}
                    </span>
                    <span className="text-[11px] text-emerald-600 block font-semibold mt-0.5">
                      ✓ Soporte para RIPS JSON
                    </span>
                  </div>
                </div>

                {/* Desglose por concepto */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Desglose de Servicios Entregados con Éxito
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Servicio / Canal</th>
                          <th className="py-2.5 px-3">Resultado de Entrega</th>
                          <th className="py-2.5 px-3 text-right">Tarifa Unitaria</th>
                          <th className="py-2.5 px-3 text-right">Total Facturado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-2.5 px-3 font-medium">Llamada IA Vapi + OpenVox GSM</td>
                          <td className="py-2.5 px-3">
                            {selectedPatientModal.contactadoExitoso ? (
                              <span className="text-emerald-700 font-bold">
                                ✓ Contestada ({selectedPatientModal.segundosLlamada} seg)
                              </span>
                            ) : (
                              <span className="text-rose-600 font-medium">
                                ✗ No contestó (0 seg)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.PRICE_CALL_PER_SECOND.toFixed(2)}/s</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            ${selectedPatientModal.cobroDesglose.llamadas.toLocaleString('es-CO')}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 font-medium">WhatsApp Recordatorio (Utility)</td>
                          <td className="py-2.5 px-3">
                            {selectedPatientModal.waExitosos > 0 ? (
                              <span className="text-emerald-700 font-bold">✓ Entregado al dispositivo</span>
                            ) : (
                              <span className="text-rose-600 font-medium">✗ No entregado</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.PRICE_WA_UTILITY.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            ${selectedPatientModal.cobroDesglose.whatsapp.toLocaleString('es-CO')}
                          </td>
                        </tr>
                        {selectedPatientModal.smsIntentos > 0 && (
                          <tr>
                            <td className="py-2.5 px-3 font-medium">Mensaje de Texto SMS</td>
                            <td className="py-2.5 px-3">
                              {selectedPatientModal.smsExitosos > 0 ? (
                                <span className="text-emerald-700 font-bold">✓ Recibido (DELIVRD)</span>
                              ) : (
                                <span className="text-rose-600 font-medium">✗ Fallo de entrega</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.PRICE_SMS.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              ${selectedPatientModal.cobroDesglose.sms.toLocaleString('es-CO')}
                            </td>
                          </tr>
                        )}
                        {selectedPatientModal.emailIntentos > 0 && (
                          <tr>
                            <td className="py-2.5 px-3 font-medium">Correo Electrónico Informativo</td>
                            <td className="py-2.5 px-3">
                              {selectedPatientModal.emailExitosos > 0 ? (
                                <span className="text-emerald-700 font-bold">✓ Entregado en bandeja</span>
                              ) : (
                                <span className="text-rose-600 font-medium">✗ Rebotado (Bounce)</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.PRICE_EMAIL.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              ${selectedPatientModal.cobroDesglose.email.toLocaleString('es-CO')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Visor RIPS JSON Oficial */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCode className="h-4 w-4 text-emerald-600" />
                      <span>Estructura Oficial RIPS JSON (Resolución 2275 de 2023)</span>
                    </h4>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(
                            billingService.generateIndividualPatientRipsJSON(
                              selectedPatientModal,
                              monthData,
                              { nombre: user?.hospital_name }
                            ),
                            null,
                            2
                          )
                        )
                      }
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copiedJson ? '¡Copiado!' : 'Copiar JSON'}</span>
                    </button>
                  </div>

                  <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl text-[11px] overflow-x-auto font-mono max-h-56 leading-relaxed border border-slate-800">
                    {JSON.stringify(
                      billingService.generateIndividualPatientRipsJSON(
                        selectedPatientModal,
                        monthData,
                        { nombre: user?.hospital_name }
                      ),
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                <span className="text-xs text-slate-500">
                  Código CUPS: <strong>{PRICING_CONSTANTS.CODIGO_CUPS}</strong> • Finalidad: <strong>01 Detección temprana</strong>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedPatientModal(null)}
                  >
                    Cerrar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleDownloadIndividualRips(selectedPatientModal)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                  >
                    <Download className="h-4 w-4" />
                    <span>Descargar RIPS JSON Paciente</span>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default BillingPage;
