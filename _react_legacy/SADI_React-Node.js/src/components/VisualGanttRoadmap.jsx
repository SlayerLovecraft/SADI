// ==============================================================================
// VisualGanttRoadmap.jsx - ROADMAP VISUAL CLÍNICO SADI (ESTILO GANTT SWIMLANES)
// Inspirado en el roadmap visual de producto para directores médicos y doctores
// ==============================================================================

import React, { useState } from 'react';
import { 
  ShieldCheck, Send, PhoneCall, Calendar, Users, CheckCircle2,
  AlertCircle, Clock, Sparkles, ChevronRight, Eye, Phone,
  FileSpreadsheet, Stethoscope, Baby, HeartPulse, UserCheck, Layers,
  ExternalLink, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function VisualGanttRoadmap({
  resolutionData = [],
  campaignsData = [],
  individualData = [],
  selectedYear = new Date().getFullYear(),
  selectedMonth = new Date().getMonth() + 1,
  onMakeCall = () => {},
  onViewTranscript = () => {}
}) {
  // Modal para ver pacientes de un bloque clínico seleccionado
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [viewScope, setViewScope] = useState('semestre'); // 'semestre' | 'mes'

  // Determinar semestre
  const isSecondSemester = selectedMonth > 6;
  const semestreTitle = isSecondSemester ? 'Semestre 2 (Julio - Diciembre)' : 'Semestre 1 (Enero - Junio)';

  // Columnas según la vista
  const columnsSemestre = isSecondSemester 
    ? [
        { id: 7, label: 'JUL', name: 'Julio' },
        { id: 8, label: 'AGO', name: 'Agosto' },
        { id: 9, label: 'SEP', name: 'Septiembre' },
        { id: 10, label: 'OCT', name: 'Octubre' },
        { id: 11, label: 'NOV', name: 'Noviembre' },
        { id: 12, label: 'DIC', name: 'Diciembre' }
      ]
    : [
        { id: 1, label: 'ENE', name: 'Enero' },
        { id: 2, label: 'FEB', name: 'Febrero' },
        { id: 3, label: 'MAR', name: 'Marzo' },
        { id: 4, label: 'ABR', name: 'Abril' },
        { id: 5, label: 'MAY', name: 'Mayo' },
        { id: 6, label: 'JUN', name: 'Junio' }
      ];

  const columnsMes = [
    { id: 1, label: 'SEM 1', name: 'Días 1 - 7' },
    { id: 2, label: 'SEM 2', name: 'Días 8 - 14' },
    { id: 3, label: 'SEM 3', name: 'Días 15 - 21' },
    { id: 4, label: 'SEM 4', name: 'Días 22 - 28' },
    { id: 5, label: 'SEM 5', name: 'Días 29 - 31' }
  ];

  const activeColumns = viewScope === 'semestre' ? columnsSemestre : columnsMes;

  // --------------------------------------------------------------------------
  // AGRUPACIÓN CLÍNICA PARA SWIMLANE 1: RESOLUCIÓN 3280
  // --------------------------------------------------------------------------
  const groupPatientsByMilestone = (cursoKey) => {
    return resolutionData.filter(p => p.cursoVida === cursoKey);
  };

  const piPatients = groupPatientsByMilestone('primera_infancia');
  const infPatients = groupPatientsByMilestone('infancia');
  const adoPatients = groupPatientsByMilestone('adolescencia');
  const juvPatients = groupPatientsByMilestone('juventud');
  const aduPatients = groupPatientsByMilestone('adultez');
  const vejPatients = groupPatientsByMilestone('vejez');
  const matPatients = groupPatientsByMilestone('materno_perinatal');

  // Bloques estructurados de Resolución 3280
  const resolutionBlocks = [
    {
      id: 'res_pi_1',
      title: 'Primera Infancia: Med. Gen. / Pediatría (2-3m & 6-11m)',
      subtitle: 'Control EAD-3 y Vacunación Pentavalente',
      curso: 'Primera Infancia',
      startCol: 1,
      spanCols: 2,
      patients: piPatients.slice(0, Math.ceil(piPatients.length / 2)),
      colorBg: 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-950',
      tagColor: 'bg-amber-200 text-amber-900'
    },
    {
      id: 'res_pi_2',
      title: 'Salud Bucal y Barniz Flúor (Semestral)',
      subtitle: 'Protección específica esmalte primario',
      curso: 'Primera Infancia',
      startCol: 2,
      spanCols: 2,
      patients: piPatients.slice(Math.ceil(piPatients.length / 2)),
      colorBg: 'bg-amber-200/90 hover:bg-amber-300 border-amber-400 text-amber-950',
      tagColor: 'bg-amber-300 text-amber-900'
    },
    {
      id: 'res_inf',
      title: 'Infancia: Valoración Escolar y Agudeza Visual',
      subtitle: 'Tamizaje Snellen y Salud Escolar',
      curso: 'Infancia',
      startCol: 3,
      spanCols: 2,
      patients: infPatients,
      colorBg: 'bg-orange-100 hover:bg-orange-200 border-orange-300 text-orange-950',
      tagColor: 'bg-orange-200 text-orange-900'
    },
    {
      id: 'res_mat',
      title: 'RIAMP: Control Prenatal y Ecografía Detalle',
      subtitle: 'Seguimiento materno fetal y curva Atalah',
      curso: 'Materno Perinatal',
      startCol: 1,
      spanCols: 3,
      patients: matPatients,
      colorBg: 'bg-rose-100 hover:bg-rose-200 border-rose-300 text-rose-950',
      tagColor: 'bg-rose-200 text-rose-900'
    },
    {
      id: 'res_adu',
      title: 'Adultez: Riesgo Cardiovascular (FINDRISC) y Ca. Cuello Uterino (ADN-VPH)',
      subtitle: 'Tamizaje metabólico, mamografía y PSA',
      curso: 'Adultez',
      startCol: 3,
      spanCols: 3,
      patients: aduPatients,
      colorBg: 'bg-amber-200/80 hover:bg-amber-300 border-amber-400 text-amber-950',
      tagColor: 'bg-amber-300 text-amber-900'
    },
    {
      id: 'res_vej',
      title: 'Vejez: Valoración Geriátrica Integral y Caídas',
      subtitle: 'Escala Barthel, Lawton y Fragilidad',
      curso: 'Vejez',
      startCol: 4,
      spanCols: 2,
      patients: vejPatients,
      colorBg: 'bg-orange-200 hover:bg-orange-300 border-orange-400 text-orange-950',
      tagColor: 'bg-orange-300 text-orange-900'
    }
  ];

  // --------------------------------------------------------------------------
  // BLOQUES SWIMLANE 2: CAMPAÑAS ACTIVAS (Color Celeste / Azul Suave)
  // --------------------------------------------------------------------------
  const campaignBlocks = campaignsData.length > 0
    ? campaignsData.map((c, i) => {
        const dia = Number(c.diaInicio) || 1;
        const startCol = viewScope === 'semestre' 
          ? Math.min(6, Math.max(1, ((Number(selectedMonth) - 1) % 6) + 1))
          : Math.min(5, Math.max(1, Math.ceil(dia / 7)));
        
        return {
          id: c.id || `camp_block_${i}`,
          title: c.nombre,
          subtitle: `${c.rangoEdadDisplay} • ${c.modoReintento}`,
          duracion: c.duracionEstimada,
          contexto: c.contextoAgente,
          destinatarios: c.destinatarios,
          startCol: startCol,
          spanCols: Math.min(activeColumns.length - startCol + 1, 2),
          colorBg: 'bg-sky-100 hover:bg-sky-200 border-sky-300 text-sky-950',
          tagColor: 'bg-sky-200 text-sky-900'
        };
      })
    : [
        {
          id: 'camp_def_1',
          title: 'Jornada Vacunación PAI y Nutrición Infantil',
          subtitle: 'Primera Infancia (0 a 5 años) • Hasta contestar',
          duracion: '2 tandas (~1 hora)',
          contexto: 'Invitación a padres de familia para completar esquema de vacunación y peso.',
          destinatarios: 28,
          startCol: 1,
          spanCols: 2,
          colorBg: 'bg-sky-100 hover:bg-sky-200 border-sky-300 text-sky-950',
          tagColor: 'bg-sky-200 text-sky-900'
        },
        {
          id: 'camp_def_2',
          title: 'Detección Temprana Cáncer Cuello Uterino (ADN-VPH)',
          subtitle: 'Mujeres 30 a 65 años • Agendamiento directo',
          duracion: '3 tandas (~1.5 horas)',
          contexto: 'Toma prioritaria de prueba ADN-VPH esquema 1-5-5 en puesto de salud.',
          destinatarios: 35,
          startCol: 2,
          spanCols: 3,
          colorBg: 'bg-sky-200/90 hover:bg-sky-300 border-sky-400 text-sky-950',
          tagColor: 'bg-sky-300 text-sky-900'
        },
        {
          id: 'camp_def_3',
          title: 'Tamizaje Hipertensión Gestacional y Control Prenatal',
          subtitle: 'Ruta Materno Perinatal (RIAMP)',
          duracion: '1 tanda (~30 min)',
          contexto: 'Verificación de cifras tensionales y síntomas de alarma en gestantes.',
          destinatarios: 15,
          startCol: 4,
          spanCols: 2,
          colorBg: 'bg-cyan-100 hover:bg-cyan-200 border-cyan-300 text-cyan-950',
          tagColor: 'bg-cyan-200 text-cyan-900'
        }
      ];

  // --------------------------------------------------------------------------
  // BLOQUES SWIMLANE 3: INDIVIDUAL O PARTICULAR (Color Púrpura / Lavanda)
  // --------------------------------------------------------------------------
  const individualBlocks = individualData.length > 0
    ? individualData.map((ind, i) => {
        const startCol = Math.min(activeColumns.length, (i % activeColumns.length) + 1);
        return {
          id: ind.id || `ind_block_${i}`,
          title: `Llamada Particular: ${ind.pacienteNombre}`,
          subtitle: `${ind.motivoContacto} • ${ind.resultado} (${ind.duracionSegundos}s)`,
          resumen: ind.resumenClinico,
          transcripcion: ind.transcripcion,
          telefono: ind.telefono,
          documento: ind.documento,
          startCol: startCol,
          spanCols: 1,
          colorBg: 'bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-950',
          tagColor: 'bg-purple-200 text-purple-900'
        };
      })
    : [
        {
          id: 'ind_def_1',
          title: 'Llamada Particular: Jimmy Romero',
          subtitle: 'Demanda Inducida Res. 3280 • Efectiva (68s)',
          resumen: 'Paciente confirmó asistencia para tamizaje preventivo y validó datos de contacto.',
          telefono: '+573057120876',
          documento: 'CC 1234567890',
          startCol: 1,
          spanCols: 2,
          colorBg: 'bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-950',
          tagColor: 'bg-purple-200 text-purple-900'
        },
        {
          id: 'ind_def_2',
          title: 'Llamada Particular: Andrés Senon Dueñas',
          subtitle: 'Control Crecimiento y Desarrollo • Efectiva (74s)',
          resumen: 'Autorizó datos y confirmó cita médica para medicina general.',
          telefono: '+573232052148',
          documento: 'CC 100518',
          startCol: 3,
          spanCols: 2,
          colorBg: 'bg-purple-200/90 hover:bg-purple-300 border-purple-400 text-purple-950',
          tagColor: 'bg-purple-300 text-purple-900'
        },
        {
          id: 'ind_def_3',
          title: 'Llamada Particular: Martha Cecilia Gómez',
          subtitle: 'Tamizaje Riesgo Cardiovascular • Efectiva (60s)',
          resumen: 'Confirmó toma de glicemia y perfil lipídico en laboratorio.',
          telefono: '+573104567890',
          documento: 'CC 43567890',
          startCol: 5,
          spanCols: 1,
          colorBg: 'bg-indigo-100 hover:bg-indigo-200 border-indigo-300 text-indigo-950',
          tagColor: 'bg-indigo-200 text-indigo-900'
        }
      ];

  return (
    <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm overflow-hidden p-6 space-y-6">

      {/* ===================================================================== */}
      {/* HEADER SUPERIOR IDÉNTICO AL DISEÑO DE REFERENCIA */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">
            <span>SADI EPS // HOSPITAL CENTRAL // CLINICAL ROADMAP {selectedYear}</span>
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight mt-0.5">
            Ruta Clínica Visual de Inducción y Cuidado Preventivo
          </h2>
          <p className="text-xs text-gray-500">
            Vista tipo Gantt / Swimlanes para supervisión médica clara e inmediata.
          </p>
        </div>

        {/* Toggle de Alcance de Vista y Leyenda */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Vista: Semestral vs Mensual */}
          <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200">
            <button
              onClick={() => setViewScope('semestre')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                viewScope === 'semestre'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Vista Semestral
            </button>
            <button
              onClick={() => setViewScope('mes')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                viewScope === 'mes'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Vista Mensual por Semanas
            </button>
          </div>

          {/* Leyenda de Puntos (Como en la esquina superior derecha de la imagen) */}
          <div className="flex items-center gap-4 text-xs font-bold text-gray-600 pl-2">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400"></span>
              Res. 3280
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-sky-400"></span>
              Campañas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-400"></span>
              Individuales
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TABLERO GANTT / SWIMLANES */}
      {/* ===================================================================== */}
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">

          {/* EJE TEMPORAL (CIRCULOS NEGROS/GRISES SOBRE LÍNEA DE TIEMPO) */}
          <div className="grid grid-cols-12 gap-0 items-center relative mb-6 pt-3">
            {/* Columna Izquierda (Vacía para alinear con los nombres de equipos) */}
            <div className="col-span-3 text-xs font-bold text-gray-400 uppercase tracking-wider pl-4">
              {viewScope === 'semestre' ? semestreTitle : `Mes Seleccionado (${selectedMonth}/${selectedYear})`}
            </div>

            {/* Línea horizontal continua que atraviesa los hitos */}
            <div className="col-span-9 relative flex items-center justify-between pr-4">
              <div className="absolute left-0 right-4 h-0.5 bg-gray-900 -z-0"></div>

              {activeColumns.map((col, idx) => (
                <div key={col.id} className="relative z-10 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-xs shadow-md border-2 border-white">
                    {col.label}
                  </div>
                  <span className="text-[10px] font-semibold text-gray-500 mt-1 whitespace-nowrap">
                    {col.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ================================================================= */}
          {/* SWIMLANE 1: RESOLUCIÓN 3280 (Estilo Web Team en Amarillo/Ocre) */}
          {/* ================================================================= */}
          <div className="grid grid-cols-12 border-t-2 border-gray-900 py-6 relative">
            {/* Fondo de columnas zebra vertical */}
            <div className="col-span-3 pr-6 flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mb-2 shadow-sm">
                <Stethoscope className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-gray-900 tracking-tight">
                RESOLUCIÓN 3280
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Cursos de Vida y Atenciones Obligatorias
              </p>
              <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full mt-2">
                {resolutionData.length} Pacientes en Total
              </span>
            </div>

            {/* Grid de Bloques Horizontales */}
            <div className="col-span-9 grid grid-cols-6 gap-2.5 relative pl-2 pr-2">
              {/* Líneas divisorias verticales de fondo */}
              <div className="absolute inset-0 grid grid-cols-6 pointer-events-none -z-0 opacity-40">
                {activeColumns.map((c, i) => (
                  <div key={i} className={`h-full border-r border-gray-200 ${i % 2 === 1 ? 'bg-gray-100/40' : ''}`}></div>
                ))}
              </div>

              {/* Fila 1 de Bloques */}
              <div className="col-span-6 grid grid-cols-6 gap-2 z-10 mb-2">
                {resolutionBlocks.slice(0, 2).map((block) => (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlock(block)}
                    style={{
                      gridColumnStart: block.startCol,
                      gridColumnEnd: `span ${block.spanCols}`
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md flex flex-col justify-between ${block.colorBg}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[10px] font-extrabold px-2 py-0.2 rounded-md ${block.tagColor}`}>
                        {block.curso}
                      </span>
                      <span className="text-[10px] font-bold opacity-75">
                        {block.patients.length} pacientes
                      </span>
                    </div>
                    <h4 className="text-xs font-bold leading-tight">{block.title}</h4>
                    <span className="text-[10px] opacity-70 mt-1 block truncate">{block.subtitle}</span>
                  </div>
                ))}
              </div>

              {/* Fila 2 de Bloques */}
              <div className="col-span-6 grid grid-cols-6 gap-2 z-10 mb-2">
                {resolutionBlocks.slice(2, 4).map((block) => (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlock(block)}
                    style={{
                      gridColumnStart: block.startCol,
                      gridColumnEnd: `span ${block.spanCols}`
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md flex flex-col justify-between ${block.colorBg}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[10px] font-extrabold px-2 py-0.2 rounded-md ${block.tagColor}`}>
                        {block.curso}
                      </span>
                      <span className="text-[10px] font-bold opacity-75">
                        {block.patients.length} pacientes
                      </span>
                    </div>
                    <h4 className="text-xs font-bold leading-tight">{block.title}</h4>
                    <span className="text-[10px] opacity-70 mt-1 block truncate">{block.subtitle}</span>
                  </div>
                ))}
              </div>

              {/* Fila 3 de Bloques */}
              <div className="col-span-6 grid grid-cols-6 gap-2 z-10">
                {resolutionBlocks.slice(4, 6).map((block) => (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlock(block)}
                    style={{
                      gridColumnStart: block.startCol,
                      gridColumnEnd: `span ${block.spanCols}`
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md flex flex-col justify-between ${block.colorBg}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[10px] font-extrabold px-2 py-0.2 rounded-md ${block.tagColor}`}>
                        {block.curso}
                      </span>
                      <span className="text-[10px] font-bold opacity-75">
                        {block.patients.length} pacientes
                      </span>
                    </div>
                    <h4 className="text-xs font-bold leading-tight">{block.title}</h4>
                    <span className="text-[10px] opacity-70 mt-1 block truncate">{block.subtitle}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* SWIMLANE 2: CAMPAÑAS ACTIVAS (Estilo Mobile Mockup en Celeste) */}
          {/* ================================================================= */}
          <div className="grid grid-cols-12 border-t-2 border-gray-900 py-6 relative">
            <div className="col-span-3 pr-6 flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-600 mb-2 shadow-sm">
                <Send className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-gray-900 tracking-tight">
                CAMPAÑAS ACTIVAS
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Inducción de Demanda Preventiva
              </p>
              <span className="text-[10px] font-extrabold text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full mt-2">
                {campaignsData.length} Campañas este Mes
              </span>
            </div>

            <div className="col-span-9 grid grid-cols-6 gap-2.5 relative pl-2 pr-2">
              <div className="absolute inset-0 grid grid-cols-6 pointer-events-none -z-0 opacity-40">
                {activeColumns.map((c, i) => (
                  <div key={i} className={`h-full border-r border-gray-200 ${i % 2 === 1 ? 'bg-gray-100/40' : ''}`}></div>
                ))}
              </div>

              {campaignBlocks.map((camp, idx) => (
                <div
                  key={camp.id}
                  onClick={() => setSelectedBlock({ ...camp, isCampaign: true })}
                  style={{
                    gridColumnStart: camp.startCol,
                    gridColumnEnd: `span ${camp.spanCols}`
                  }}
                  className={`col-span-6 p-3.5 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md flex flex-col justify-between z-10 mb-2 ${camp.colorBg}`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[10px] font-extrabold px-2 py-0.2 rounded-md ${camp.tagColor}`}>
                      Campaña IA
                    </span>
                    <span className="text-[10px] font-bold opacity-75">
                      {camp.destinatarios} destinatarios
                    </span>
                  </div>
                  <h4 className="text-xs font-bold leading-tight">{camp.title}</h4>
                  <span className="text-[10px] opacity-70 mt-1 block truncate">{camp.subtitle}</span>
                  <div className="mt-2 pt-1 border-t border-sky-200/60 flex items-center justify-between text-[10px] font-semibold text-sky-800">
                    <span>{camp.duracion}</span>
                    <span className="font-bold flex items-center gap-1">Ver detalles <ChevronRight className="w-3 h-3" /></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ================================================================= */}
          {/* SWIMLANE 3: INDIVIDUAL O PARTICULAR (Estilo Marketing en Morado) */}
          {/* ================================================================= */}
          <div className="grid grid-cols-12 border-t-2 border-gray-900 py-6 relative">
            <div className="col-span-3 pr-6 flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600 mb-2 shadow-sm">
                <HeartPulse className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-gray-900 tracking-tight">
                INDIVIDUAL O PARTICULAR
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Llamadas Bajo Demanda y Trazabilidad
              </p>
              <span className="text-[10px] font-extrabold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full mt-2">
                {individualData.length} Registros Auditados
              </span>
            </div>

            <div className="col-span-9 grid grid-cols-6 gap-2.5 relative pl-2 pr-2">
              <div className="absolute inset-0 grid grid-cols-6 pointer-events-none -z-0 opacity-40">
                {activeColumns.map((c, i) => (
                  <div key={i} className={`h-full border-r border-gray-200 ${i % 2 === 1 ? 'bg-gray-100/40' : ''}`}></div>
                ))}
              </div>

              {individualBlocks.map((indiv, idx) => (
                <div
                  key={indiv.id}
                  onClick={() => setSelectedBlock({ ...indiv, isIndividual: true })}
                  style={{
                    gridColumnStart: indiv.startCol,
                    gridColumnEnd: `span ${indiv.spanCols}`
                  }}
                  className={`col-span-6 p-3 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md flex flex-col justify-between z-10 mb-2 ${indiv.colorBg}`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[10px] font-extrabold px-2 py-0.2 rounded-md ${indiv.tagColor}`}>
                      Llamada Saliente GSM
                    </span>
                    <span className="text-[10px] font-bold opacity-75">
                      Puerto 22
                    </span>
                  </div>
                  <h4 className="text-xs font-bold leading-tight">{indiv.title}</h4>
                  <span className="text-[10px] opacity-70 mt-1 block truncate">{indiv.subtitle}</span>
                  <div className="mt-2 pt-1 border-t border-purple-200/60 flex items-center justify-between text-[10px] font-semibold text-purple-800">
                    <span>{indiv.telefono}</span>
                    <span className="font-bold flex items-center gap-1">Ver Transcripción <Eye className="w-3 h-3" /></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL DETALLE AL HACER CLIC EN UN BLOQUE DEL ROADMAP */}
      {/* ===================================================================== */}
      <Dialog open={!!selectedBlock} onOpenChange={() => setSelectedBlock(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              {selectedBlock?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedBlock?.subtitle || 'Detalle clínico del bloque programado en el Roadmap.'}
            </DialogDescription>
          </DialogHeader>

          {selectedBlock && (
            <div className="space-y-4 pt-2">
              {/* CASO: BLOQUE DE RESOLUCIÓN 3280 */}
              {selectedBlock.patients && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700">
                      Pacientes Asignados a este Hito Clínico ({selectedBlock.patients.length}):
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Horario: 10:00 AM - 06:00 PM
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-2xl bg-gray-50/50">
                    {selectedBlock.patients.length === 0 ? (
                      <p className="p-4 text-xs text-gray-400 text-center">
                        No hay pacientes registrados en este segmento en este momento.
                      </p>
                    ) : (
                      selectedBlock.patients.map((pat) => (
                        <div key={pat.id} className="p-3 flex items-center justify-between hover:bg-white transition-colors">
                          <div>
                            <div className="text-xs font-bold text-gray-900">{pat.nombre}</div>
                            <div className="text-[11px] text-gray-500">
                              CC: {pat.documento} • Tel: {pat.telefono} • {pat.edadFormato}
                            </div>
                            <div className="text-[10px] text-blue-700 font-semibold mt-0.5">
                              {pat.fechaProgramada} a las {pat.horaProgramada} ({pat.slotLabel})
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onMakeCall(pat);
                              setSelectedBlock(null);
                            }}
                            className="text-xs font-bold gap-1 rounded-xl text-blue-700 border-blue-200"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Llamar
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* CASO: BLOQUE DE CAMPAÑA */}
              {selectedBlock.isCampaign && (
                <div className="space-y-3">
                  <div className="p-3 bg-sky-50 rounded-2xl border border-sky-100 text-xs text-sky-950 space-y-1">
                    <div><strong>Duración Estimada:</strong> {selectedBlock.duracion}</div>
                    <div><strong>Destinatarios Totales:</strong> {selectedBlock.destinatarios} pacientes</div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-gray-700 block mb-1">
                      Directrices para el Agente IA:
                    </span>
                    <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200 italic leading-relaxed">
                      "{selectedBlock.contexto}"
                    </p>
                  </div>
                </div>
              )}

              {/* CASO: BLOQUE INDIVIDUAL */}
              {selectedBlock.isIndividual && (
                <div className="space-y-3">
                  <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 text-xs text-purple-950 space-y-1">
                    <div><strong>Paciente:</strong> {selectedBlock.title.replace('Llamada Particular: ', '')}</div>
                    <div><strong>Teléfono:</strong> {selectedBlock.telefono}</div>
                    <div><strong>Cédula:</strong> {selectedBlock.documento}</div>
                  </div>

                  {selectedBlock.resumen && (
                    <div>
                      <span className="text-xs font-bold text-gray-700 block mb-1">Resumen Clínico IA:</span>
                      <p className="text-xs text-gray-700 bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                        {selectedBlock.resumen}
                      </p>
                    </div>
                  )}

                  {selectedBlock.transcripcion && (
                    <div>
                      <span className="text-xs font-bold text-gray-700 block mb-1">Transcripción Completa:</span>
                      <div className="bg-slate-900 text-slate-100 p-3.5 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                        {selectedBlock.transcripcion}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
