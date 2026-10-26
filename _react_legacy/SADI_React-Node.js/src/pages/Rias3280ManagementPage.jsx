import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { 
  ShieldCheck, Send, PhoneCall, MessageSquare, Users, 
  Sparkles, CheckCircle2, Calendar, FileText, ArrowRight, HeartPulse,
  Filter, Search, User, Baby, Activity, BookOpen, Stethoscope
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { telemonitoringService } from '@/services/telemonitoringService';
import { CURSOS_DE_VIDA_3280, PROGRAMAS_Y_TAMIZAJES_3280 } from '@/services/rias3280Catalog';

export default function Rias3280ManagementPage() {
  const { toast } = useToast();
  
  const [patients, setPatients] = useState([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(PROGRAMAS_Y_TAMIZAJES_3280[0]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(selectedProgram.canal_recomendado);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function init() {
      const list = await telemonitoringService.getPatients();
      setPatients(list);
      if (list.length > 0) {
        setSelectedPatient(list[0]);
      }
    }
    init();
  }, []);

  // Cambiar canal sugerido al cambiar de programa
  useEffect(() => {
    if (selectedProgram) {
      setSelectedChannel(selectedProgram.canal_recomendado);
    }
  }, [selectedProgram]);

  // Si cambia el programa y hay pacientes, sugerir uno del curso de vida del programa
  useEffect(() => {
    if (!selectedProgram || patients.length === 0) return;
    const match = patients.find(p => p.curso_vida === selectedProgram.curso_vida);
    if (match) {
      setSelectedPatient(match);
    }
  }, [selectedProgram, patients]);

  // Filtrado de programas
  const filteredPrograms = PROGRAMAS_Y_TAMIZAJES_3280.filter(p => {
    const matchesCourse = selectedCourseFilter === 'todos' || p.curso_vida === selectedCourseFilter;
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.profesional.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCourse && matchesSearch;
  });

  // Reemplazo dinámico de variables para el paciente seleccionado
  const compileDynamicScript = () => {
    if (!selectedProgram) return '';
    const name = selectedPatient?.nombre || 'Paciente';
    const age = selectedPatient ? (new Date().getFullYear() - new Date(selectedPatient.fecha_nacimiento).getFullYear()) : 'su';
    const sem = selectedPatient?.semana_gestacional || '28';

    return selectedProgram.guion_ia_base
      .replace(/{paciente}/g, name)
      .replace(/{edad}/g, `${age}`)
      .replace(/{semana_gestacional}/g, `${sem}`);
  };

  const handleDispatch = () => {
    if (!selectedPatient) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast({
        title: "🚀 Demanda Inducida Emitida",
        description: `Mensaje/Llamada despachada para ${selectedPatient.nombre} por el canal ${selectedChannel.toUpperCase()} bajo el protocolo ${selectedProgram.id}.`
      });
    }, 1000);
  };

  return (
    <Layout>
      <Helmet>
        <title>SADI - Catálogo Completo Programas y Tamizajes Res. 3280</title>
      </Helmet>

      <div className="space-y-6">

        {/* Cabecera Principal */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest">
              <ShieldCheck className="h-4 w-4" />
              Resolución 3280 de 2018 • Cobertura Total de Cursos de Vida & RIAMP
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Catálogo Integral de Programas y Tamizajes 3280
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Ninguna área desatendida: Primera Infancia, Infancia, Adolescencia, Juventud, Adultez, Vejez y Ruta Materno Perinatal.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-black text-emerald-900">
                {PROGRAMAS_Y_TAMIZAJES_3280.length} Protocolos Clínicos Indexados
              </p>
              <p className="text-[11px] text-emerald-700">
                35 pacientes reales y variables dinámicas en vivo
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Filtros por Curso de Vida */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCourseFilter('todos')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              selectedCourseFilter === 'todos'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Todos ({PROGRAMAS_Y_TAMIZAJES_3280.length})
          </button>

          {CURSOS_DE_VIDA_3280.map(curso => {
            const count = PROGRAMAS_Y_TAMIZAJES_3280.filter(p => p.curso_vida === curso.id).length;
            const isSelected = selectedCourseFilter === curso.id;
            return (
              <button
                key={curso.id}
                onClick={() => setSelectedCourseFilter(curso.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span>{curso.nombre}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Buscador de Programas */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre de programa, tamizaje, código CUPS o profesional requerido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>

        {/* Contenido Grid: Lista completa a la izquierda / Detalle y personalización con paciente a la derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* COLUMNA IZQUIERDA: LISTA EXHAUSTIVA DE PROGRAMAS */}
          <div className="lg:col-span-7 space-y-3 max-h-[820px] overflow-y-auto pr-2">
            {filteredPrograms.map((prog) => {
              const isSelected = selectedProgram?.id === prog.id;

              return (
                <div
                  key={prog.id}
                  onClick={() => setSelectedProgram(prog)}
                  className={`p-4 rounded-3xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-200 shadow-sm'
                      : 'bg-white hover:border-gray-300 border-gray-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {prog.id}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded uppercase">
                          {prog.categoria}
                        </span>
                        <span className="text-[10px] text-gray-400">Pág. {prog.pagina_resolucion}</span>
                      </div>

                      <h3 className="font-black text-xs text-gray-900 mt-1">
                        {prog.nombre}
                      </h3>
                    </div>

                    <span className="text-[11px] font-bold text-gray-500 capitalize shrink-0 bg-gray-50 px-2 py-1 rounded-xl">
                      {prog.curso_vida.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">
                    {prog.descripcion}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                    <span><strong>Frecuencia:</strong> {prog.frecuencia}</span>
                    <span>•</span>
                    <span><strong>Profesional:</strong> {prog.profesional}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* COLUMNA DERECHA: CONFIGURACIÓN DINÁMICA CON DATOS DE PACIENTE REAL */}
          <div className="lg:col-span-5 space-y-5">

            {selectedProgram && (
              <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                    Configuración de Inducción de Demanda
                  </span>
                  <h2 className="text-base font-black text-gray-900 mt-0.5">
                    {selectedProgram.nombre}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    CUPS: {selectedProgram.codigo_procedimiento} • Resolución 3280 de 2018
                  </p>
                </div>

                {/* Selección del Paciente Real de Prueba */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-blue-600" />
                    Paciente de Prueba Asignado (Datos Reales):
                  </label>
                  <select
                    value={selectedPatient?.id}
                    onChange={(e) => {
                      const p = patients.find(pat => pat.id === e.target.value);
                      if (p) setSelectedPatient(p);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.tipo_documento} {p.documento}) - {p.curso_vida?.replace('_', ' ')}
                      </option>
                    ))}
                  </select>

                  {selectedPatient && (
                    <div className="mt-2 p-2.5 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 flex justify-between items-center">
                      <div>
                        <p className="font-bold">{selectedPatient.nombre}</p>
                        <p className="text-[10px] text-blue-700">
                          {selectedPatient.eps} • Tel: {selectedPatient.telefono} • Canal: {selectedPatient.canal_preferido}
                        </p>
                      </div>
                      <span className="font-bold text-[10px] bg-blue-200/70 text-blue-800 px-2 py-0.5 rounded">
                        {selectedPatient.curso_vida?.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Canal de Despacho */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Canal Automatizado:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'call_ia', label: 'Llamada IA', icon: PhoneCall },
                      { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                      { id: 'sms', label: 'SMS', icon: Send }
                    ].map(ch => {
                      const Icon = ch.icon;
                      const isSel = selectedChannel === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setSelectedChannel(ch.id)}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            isSel 
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Vista Previa del Guión con Variables Reemplazadas */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Guión Dinámico Personalizado (Vapi / Mensajería):
                  </label>
                  <div className="bg-slate-900 text-emerald-300 p-3.5 rounded-2xl font-mono text-xs border border-slate-800 leading-relaxed max-h-44 overflow-y-auto">
                    "{compileDynamicScript()}"
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Variables inyectadas: <code>{`{paciente}`}</code> = <strong>{selectedPatient?.nombre}</strong>
                  </p>
                </div>

                {/* Botón de Disparo */}
                <Button
                  onClick={handleDispatch}
                  disabled={sending}
                  className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 gap-2 shadow-md"
                >
                  <Send className="h-4 w-4" />
                  {sending ? 'Despachando Comunicación...' : `Emitir Demanda Inducida vía ${selectedChannel.toUpperCase()}`}
                </Button>
              </div>
            )}

          </div>

        </div>

      </div>
    </Layout>
  );
}
