import React, { useState, useMemo } from 'react';
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
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const BillingPage = () => {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(1); // Enero por defecto
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCursoVida, setSelectedCursoVida] = useState('todos');
  const [selectedPatientModal, setSelectedPatientModal] = useState(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Obtener datos del mes seleccionado
  const monthData = useMemo(() => {
    return billingService.getMonthlyBillingData(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Filtrar pacientes
  const filteredPatients = useMemo(() => {
    return monthData.pacientes.filter(p => {
      const matchSearch =
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.documento.includes(searchTerm) ||
        p.telefono.includes(searchTerm);

      const matchCurso =
        selectedCursoVida === 'todos' || p.cursoVida?.id === selectedCursoVida;

      return matchSearch && matchCurso;
    });
  }, [monthData.pacientes, searchTerm, selectedCursoVida]);

  // Manejador descarga RIPS JSON Mensual
  const handleDownloadMonthlyRips = () => {
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
    billingService.exportMonthlyExcel(monthData, {
      nombre: user?.hospital_name || 'HOSPITAL CENTRAL SADI'
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <Layout>
      <Helmet>
        <title>Facturación y RIPS JSON - SADI</title>
        <meta name="description" content="Módulo de Cobro, Facturación Mensual y Generador de RIPS JSON bajo Resolución 2275 de 2023" />
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
                  Facturación, Costos y RIPS JSON
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Liquidación mensual de consumos por paciente • Resolución 2275 de 2023 • Código CUPS:{' '}
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
              <span>Año:</span>
              <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md font-bold">{selectedYear}</span>
            </div>
          </div>

          {/* Carrusel de los 12 Meses */}
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

        {/* Tarjetas KPI de Resumen Financiero del Mes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Facturado Hospital</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              ${monthData.totales.totalFacturado.toLocaleString('es-CO')} COP
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Periodo: {monthData.mesNombre} {selectedYear}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Costo Operativo Real SADI</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 mt-2">
              ${monthData.totales.totalCosto.toLocaleString('es-CO')} COP
            </div>
            <p className="text-xs text-amber-600 font-medium mt-1">
              Vapi ($6.04/s) + WhatsApp + SMS + Email
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ganancia Neta SADI</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-2">
              ${monthData.totales.totalUtilidad.toLocaleString('es-CO')} COP
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                Margen: {monthData.totales.margenGlobalPct}%
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pacientes Inducidos</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {monthData.totales.pacientesCount} Pacientes
            </div>
            <p className="text-xs text-indigo-600 font-medium mt-1">
              100% con registro RIPS CUPS 890201
            </p>
          </div>
        </div>

        {/* Cuadro de Canales: Consumos del Mes */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span>Desglose Operativo y Tarifario por Canal ({monthData.mesNombre})</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Llamadas IA */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-700">Llamadas IA (Vapi + GSM)</span>
                </div>
                <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  $12.00 / seg
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {monthData.desgloseCanales.llamadas.segundos.toLocaleString('es-CO')} seg
              </div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between">
                <span>Facturado: <strong>${monthData.desgloseCanales.llamadas.facturado.toLocaleString('es-CO')}</strong></span>
                <span>Costo: ${monthData.desgloseCanales.llamadas.costo.toLocaleString('es-CO')}</span>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">WhatsApp Verificado</span>
                </div>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  $80 / $180 msg
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {monthData.desgloseCanales.whatsapp.mensajesCount.toLocaleString('es-CO')} mensajes
              </div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between">
                <span>Facturado: <strong>${monthData.desgloseCanales.whatsapp.facturado.toLocaleString('es-CO')}</strong></span>
                <span>Costo: ${monthData.desgloseCanales.whatsapp.costo.toLocaleString('es-CO')}</span>
              </div>
            </div>

            {/* SMS */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-700">Mensajes SMS</span>
                </div>
                <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                  $40 / msg
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {monthData.desgloseCanales.sms.mensajesCount.toLocaleString('es-CO')} SMS
              </div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between">
                <span>Facturado: <strong>${monthData.desgloseCanales.sms.facturado.toLocaleString('es-CO')}</strong></span>
                <span>Costo: ${monthData.desgloseCanales.sms.costo.toLocaleString('es-CO')}</span>
              </div>
            </div>

            {/* E-mails */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-cyan-600" />
                  <span className="text-xs font-bold text-slate-700">E-mails Automatizados</span>
                </div>
                <span className="text-[10px] font-semibold bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded">
                  $25 / correo
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {monthData.desgloseCanales.email.correosCount.toLocaleString('es-CO')} envíos
              </div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between">
                <span>Facturado: <strong>${monthData.desgloseCanales.email.facturado.toLocaleString('es-CO')}</strong></span>
                <span>Costo: ${monthData.desgloseCanales.email.costo.toLocaleString('es-CO')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla Detallada: Costo y Facturación por Paciente Individual */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Detalle de Pacientes Atendidos en {monthData.mesNombre} ({filteredPatients.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conoce exactamente cuánto costó cada paciente al hospital y descarga su RIPS JSON individual.
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
                    placeholder="Buscar por paciente, cédula..."
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
                  <th className="py-3 px-3">Interacciones Mes</th>
                  <th className="py-3 px-3 text-right">Costo Real SADI</th>
                  <th className="py-3 px-3 text-right">Cobro al Hospital</th>
                  <th className="py-3 px-3 text-right">Ganancia Neta</th>
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

                      {/* Interacciones */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-100">
                            <PhoneCall className="h-3 w-3" />
                            {p.segundosLlamada}s
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100" title="WhatsApp">
                            <MessageSquare className="h-3 w-3" />
                            {p.waUtilityCount + p.waMarketingCount}
                          </span>
                          {p.smsCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100" title="SMS">
                              <Send className="h-3 w-3" />
                              {p.smsCount}
                            </span>
                          )}
                          {p.emailCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-100" title="E-mail">
                              <Mail className="h-3 w-3" />
                              {p.emailCount}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Costo Real SADI */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-slate-700">
                          ${p.costoDesglose.total.toLocaleString('es-CO')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Llamada: ${p.costoDesglose.llamadas}
                        </div>
                      </td>

                      {/* Cobro al Hospital */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-blue-700">
                          ${p.cobroDesglose.total.toLocaleString('es-CO')}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          CUPS 890201
                        </div>
                      </td>

                      {/* Ganancia Neta */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-emerald-600">
                          +${p.utilidad.toLocaleString('es-CO')}
                        </div>
                        <div className="text-[10px] text-emerald-500 font-medium">
                          {p.margenPct}%
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
                            title="Ver desglose detallado de cobro y RIPS"
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
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No se encontraron pacientes para los filtros seleccionados en este mes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DETALLE DE FACTURACIÓN INDIVIDUAL Y VISOR RIPS */}
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
                      Comprobante Individual de Costos y RIPS
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
                {/* Resumen Superior */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Costo Operativo SADI</span>
                    <p className="text-base font-black text-slate-800 mt-0.5">
                      ${selectedPatientModal.costoDesglose.total.toLocaleString('es-CO')} COP
                    </p>
                    <span className="text-[10px] text-slate-500">Costo real de salida</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total Facturado Hospital</span>
                    <p className="text-base font-black text-blue-700 mt-0.5">
                      ${selectedPatientModal.cobroDesglose.total.toLocaleString('es-CO')} COP
                    </p>
                    <span className="text-[10px] text-blue-600">Tarifa pactada SADI</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Ganancia Neta</span>
                    <p className="text-base font-black text-emerald-600 mt-0.5">
                      ${selectedPatientModal.utilidad.toLocaleString('es-CO')} COP
                    </p>
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      Margen: {selectedPatientModal.margenPct}%
                    </span>
                  </div>
                </div>

                {/* Desglose por concepto */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Liquidación de Canales Utilizados
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Concepto</th>
                          <th className="py-2.5 px-3">Cantidad</th>
                          <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                          <th className="py-2.5 px-3 text-right">Tarifa Cobro</th>
                          <th className="py-2.5 px-3 text-right">Subtotal Facturado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-2.5 px-3 font-medium">Llamada IA Vapi + OpenVox GSM</td>
                          <td className="py-2.5 px-3">{selectedPatientModal.segundosLlamada} segundos</td>
                          <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.COST_CALL_PER_SECOND.toFixed(2)}/s</td>
                          <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.PRICE_CALL_PER_SECOND.toFixed(2)}/s</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">${selectedPatientModal.cobroDesglose.llamadas.toLocaleString('es-CO')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 font-medium">WhatsApp Recordatorio (Utility)</td>
                          <td className="py-2.5 px-3">{selectedPatientModal.waUtilityCount} mensaje</td>
                          <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.COST_WA_UTILITY.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.PRICE_WA_UTILITY.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">${(selectedPatientModal.waUtilityCount * PRICING_CONSTANTS.PRICE_WA_UTILITY).toLocaleString('es-CO')}</td>
                        </tr>
                        {selectedPatientModal.waMarketingCount > 0 && (
                          <tr>
                            <td className="py-2.5 px-3 font-medium">WhatsApp Campaña (Marketing)</td>
                            <td className="py-2.5 px-3">{selectedPatientModal.waMarketingCount} mensaje</td>
                            <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.COST_WA_MARKETING.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.PRICE_WA_MARKETING.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">${(selectedPatientModal.waMarketingCount * PRICING_CONSTANTS.PRICE_WA_MARKETING).toLocaleString('es-CO')}</td>
                          </tr>
                        )}
                        {selectedPatientModal.smsCount > 0 && (
                          <tr>
                            <td className="py-2.5 px-3 font-medium">Mensaje de Texto SMS</td>
                            <td className="py-2.5 px-3">{selectedPatientModal.smsCount} SMS</td>
                            <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.COST_SMS.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.PRICE_SMS.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">${selectedPatientModal.cobroDesglose.sms.toLocaleString('es-CO')}</td>
                          </tr>
                        )}
                        {selectedPatientModal.emailCount > 0 && (
                          <tr>
                            <td className="py-2.5 px-3 font-medium">Correo Electrónico Informativo</td>
                            <td className="py-2.5 px-3">{selectedPatientModal.emailCount} correo</td>
                            <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.COST_EMAIL.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right">${PRICING_CONSTANTS.PRICE_EMAIL.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">${selectedPatientModal.cobroDesglose.email.toLocaleString('es-CO')}</td>
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
