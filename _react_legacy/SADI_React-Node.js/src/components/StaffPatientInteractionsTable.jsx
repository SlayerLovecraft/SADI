import React, { useState, useEffect } from 'react';
import { 
  Phone, MessageSquare, Mail, Smartphone, Volume2, VolumeX, Play, Pause, 
  FileText, Clock, Calendar, CheckCircle2, AlertTriangle, User, Search,
  Download, Copy, Check, Headphones, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// Helper para generar una transcripción clínica realista según el paciente y la enfermera
const generateTranscriptForPatient = (patient, staffName) => {
  const pName = patient.nombre || 'Paciente';
  const cVida = patient.grupo_vida || patient.curso_vida || 'Primera Infancia';
  const phone = patient.telefono || '+57 300 000 0000';
  const dateStr = '2026-11-08 10:15 AM';

  if (cVida.toLowerCase().includes('infancia') || cVida.toLowerCase().includes('primera')) {
    return {
      duracion: '2m 14s',
      duracionSegundos: 134,
      fechaHora: dateStr,
      enfermera: staffName || 'Enfermera Asistencial SADI',
      resultado: 'Llamada Exitosa · Cita Confirmada',
      resumen: `Llamada preventiva de Demanda Inducida (Res. 3280). Se verificó estado de salud del menor, esquema PAI y se concertó cita presencial con pediatría.`,
      dialogo: [
        { emisor: 'Agente IA SADI', tiempo: '00:03', texto: `Buenos días. Me comunico del Hospital Central con el acudiente de ${pName}.` },
        { emisor: 'Acudiente', tiempo: '00:08', texto: `Buenos días, sí señorita, habla la mamá. ¿En qué le puedo servir?` },
        { emisor: 'Agente IA SADI', tiempo: '00:13', texto: `Le habla el Asistente Clínico de Demanda Inducida coordinado por la ${staffName || 'Enfermera a cargo'}. En el marco de la Ruta de Primera Infancia de la Resolución 3280, verificamos que ${pName} tiene programado su control de crecimiento y desarrollo. ¿Ha presentado algún malestar en estos días?` },
        { emisor: 'Acudiente', tiempo: '00:26', texto: `Tuvo un poco de congestión nasal el fin de semana pero ya está mucho mejor comiendo bien y activo.` },
        { emisor: 'Agente IA SADI', tiempo: '00:34', texto: `Excelente. Hemos apartado su cita para este jueves a las 9:30 AM en el consultorio 4. Le enviaremos confirmación con código de acceso por WhatsApp y SMS.` },
        { emisor: 'Acudiente', tiempo: '00:45', texto: `Perfecto, muchísimas gracias. Allá estaremos muy cumplidos.` },
        { emisor: 'Agente IA SADI', tiempo: '00:52', texto: `Con gusto. Que tengan un excelente día.` }
      ]
    };
  }

  if (cVida.toLowerCase().includes('mujer') || cVida.toLowerCase().includes('materno') || cVida.toLowerCase().includes('planificac')) {
    return {
      duracion: '1m 58s',
      duracionSegundos: 118,
      fechaHora: dateStr,
      enfermera: staffName || 'Enfermera Asistencial SADI',
      resultado: 'Llamada Exitosa · Tamizaje Validado',
      resumen: `Control de Ruta Materno-Perinatal / RIAMP. Verificación de signos de alarma obstétrica y monitoreo de presión arterial domiciliaria.`,
      dialogo: [
        { emisor: 'Agente IA SADI', tiempo: '00:04', texto: `Hola ${pName}, te habla el Agente de Telemonitoreo de SADI y de tu IPS.` },
        { emisor: 'Paciente', tiempo: '00:09', texto: `Hola, buenos días.` },
        { emisor: 'Agente IA SADI', tiempo: '00:14', texto: `Nos comunicamos bajo la supervisión de ${staffName || 'Enfermería Jefe'} para verificar tu control prenatal y las tomas de presión de esta semana. ¿Has sentido dolores de cabeza intensos o zumbidos en los oídos?` },
        { emisor: 'Paciente', tiempo: '00:27', texto: `No señorita, la presión ha estado en 118/76 y me he sentido muy tranquila.` },
        { emisor: 'Agente IA SADI', tiempo: '00:36', texto: `Excelente noticia. Tu registro ya quedó actualizado en la historia clínica. Recuerda tu ecografía programada para la próxima semana.` },
        { emisor: 'Paciente', tiempo: '00:46', texto: `Listo, muchas gracias por estar tan pendientes.` }
      ]
    };
  }

  // Adulto / Vejez / Crónicos
  return {
    duracion: '2m 05s',
    duracionSegundos: 125,
    fechaHora: dateStr,
    enfermera: staffName || 'Enfermera Asistencial SADI',
    resultado: 'Llamada Exitosa · Adherencia Farmacológica',
    resumen: `Seguimiento de riesgo cardiovascular y metabólico. Confirmación de adherencia a tratamiento y agendamiento de laboratorio de control.`,
    dialogo: [
      { emisor: 'Agente IA SADI', tiempo: '00:03', texto: `Buenos días don/doña ${pName}, le saluda el Agente Clínico de SADI por solicitud de ${staffName || 'el equipo asistencial'}.` },
      { emisor: 'Paciente', tiempo: '00:09', texto: `Buenos días señorita, dígame.` },
      { emisor: 'Agente IA SADI', tiempo: '00:15', texto: `Le llamamos para hacer seguimiento a sus medicamentos para la tensión y el azúcar. ¿Ha podido tomar sus dosis sin inconvenientes esta semana?` },
      { emisor: 'Paciente', tiempo: '00:28', texto: `Sí señora, me tomo el losartán en la mañana y la metformina con el almuerzo como me indicó el doctor.` },
      { emisor: 'Agente IA SADI', tiempo: '00:38', texto: `Muy bien. Tenemos programada su orden de perfil lipídico y glicemia para el próximo martes en el laboratorio central. Le compartimos la preparación vía mensaje.` },
      { emisor: 'Paciente', tiempo: '00:50', texto: `Ah caray, muchas gracias. Ya lo anoto en el calendario.` }
    ]
  };
};

export default function StaffPatientInteractionsTable({
  patients = [],
  staff = null,
  emptyMessage = "No se encontraron pacientes para este personal."
}) {
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [activeAudioPatient, setActiveAudioPatient] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const staffName = staff?.nombre || 'Enfermera Asistencial';

  // Manejador de Reproducción de Audio
  const handleToggleAudio = (patient) => {
    if (activeAudioPatient?.id === patient.id && isPlayingAudio) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setActiveAudioPatient(patient);
    setIsPlayingAudio(true);
    setAudioProgress(0);

    const transcriptData = generateTranscriptForPatient(patient, staffName);
    const textToSpeak = transcriptData.dialogo
      .map(d => `${d.emisor}: ${d.texto}`)
      .join('. ');

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'es-CO';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsPlayingAudio(true);
      };
      utterance.onend = () => {
        setIsPlayingAudio(false);
        setAudioProgress(100);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // Simulación visual
      let p = 0;
      const interval = setInterval(() => {
        p += 5;
        setAudioProgress(p);
        if (p >= 100) {
          clearInterval(interval);
          setIsPlayingAudio(false);
        }
      }, 500);
    }
  };

  // Detener audio al desmontar
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopyTranscript = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const filteredPatients = patients.filter(p => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.nombre || '').toLowerCase().includes(term) ||
      (p.cc || '').includes(term) ||
      (p.telefono || '').includes(term)
    );
  });

  return (
    <div className="w-full space-y-3">
      {/* Barra de Filtro Rápido */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar paciente por nombre o documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>
        <div className="text-xs font-bold text-gray-500">
          Total: <span className="text-blue-600 font-black">{filteredPatients.length}</span> pacientes
        </div>
      </div>

      {/* TABLA PRINCIPAL DE LLAMADAS Y MENSAJES */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-white font-bold text-[11px] tracking-wider uppercase">
            <tr>
              <th className="p-3.5 whitespace-nowrap">Nombre del Paciente</th>
              <th className="p-3.5 whitespace-nowrap">Ciclos de Vida</th>
              <th className="p-3.5 whitespace-nowrap">Mensajes Enviados (SMS, E-mails, Whatsapps)</th>
              <th className="p-3.5 text-center whitespace-nowrap">Llamadas Realizadas</th>
              <th className="p-3.5 text-center whitespace-nowrap">Grabaciones de Audio</th>
              <th className="p-3.5 text-center whitespace-nowrap">Transcripciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredPatients.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <User className="w-8 h-8 text-gray-300" />
                    <p className="text-xs font-semibold">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPatients.map((patient) => {
                const cVida = patient.grupo_vida || patient.curso_vida || 'Primera Infancia';
                const conteo = patient.conteo_canales || { whatsapp: 3, email: 1, call: 2, sms: 1 };
                
                const isPlayingThis = (activeAudioPatient?.id === patient.id) && isPlayingAudio;
                const transcriptData = generateTranscriptForPatient(patient, staffName);

                return (
                  <tr key={patient.id} className="hover:bg-blue-50/40 transition-colors">
                    
                    {/* 1. Nombre del Paciente */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {patient.nombre ? patient.nombre.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                            {patient.nombre}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            CC: {patient.cc || patient.cedula || 'N/A'} {patient.telefono ? `· ${patient.telefono}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Ciclos de Vida */}
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-50 text-cyan-800 border border-cyan-200">
                        {cVida}
                      </span>
                    </td>

                    {/* 3. Mensajes Enviados (SMS, E-mails, Whatsapps) */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* WhatsApp */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <MessageSquare className="w-3 h-3 text-emerald-600" />
                          <span>{conteo.whatsapp || 0} Whatsapps</span>
                        </span>
                        
                        {/* E-mail */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          <Mail className="w-3 h-3 text-indigo-600" />
                          <span>{conteo.email || 0} E-mails</span>
                        </span>

                        {/* SMS */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Smartphone className="w-3 h-3 text-amber-600" />
                          <span>{conteo.sms || 0} SMS</span>
                        </span>
                      </div>
                    </td>

                    {/* 4. Llamadas Realizadas */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold ${
                        (conteo.call || 0) > 0
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                      }`}>
                        <Phone className={`w-3.5 h-3.5 ${(conteo.call || 0) > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{conteo.call || 0} Llamadas</span>
                      </span>
                    </td>

                    {/* 5. Grabaciones de Audio (Llamada del Agente lanzada por la Enfermera) */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {(conteo.call || 0) > 0 ? (
                        <button
                          onClick={() => handleToggleAudio(patient)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-xs ${
                            isPlayingThis
                              ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-md'
                          }`}
                          title="Escuchar audio de la llamada del Agente IA lanzada por esta enfermera"
                        >
                          {isPlayingThis ? (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pausar Audio</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Reproducir Audio</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/60 inline-flex items-center gap-1">
                          Sin audios
                        </span>
                      )}
                    </td>

                    {/* 6. Transcripciones */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {(conteo.call || 0) > 0 ? (
                        <button
                          onClick={() => setSelectedTranscript({ patient, data: transcriptData })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs hover:shadow-md"
                          title="Ver transcripción detallada de la llamada"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          <span>Ver Transcripción</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/60 inline-flex items-center gap-1">
                          Sin transcripción
                        </span>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* REPRODUCTOR FLOTANTE ACTIVO (SI HAY AUDIO EN REPRODUCCIÓN) */}
      {isPlayingAudio && activeAudioPatient && (
        <div className="bg-slate-950 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-lg border border-slate-800 animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center animate-pulse">
              <Headphones className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">
                Reproduciendo Audio de Agente IA · GSM Puerto 22
              </span>
              <p className="text-xs font-bold text-gray-100">
                Llamada con: {activeAudioPatient.nombre} · Coordinada por: {staffName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-1 h-4 bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-6 bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-3 bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              <div className="w-1 h-5 bg-emerald-400 animate-bounce" style={{ animationDelay: '450ms' }} />
            </div>

            <Button
              size="sm"
              onClick={() => {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                setIsPlayingAudio(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-7 px-2.5 rounded-lg"
            >
              Detener
            </Button>
          </div>
        </div>
      )}

      {/* MODAL: VISOR DE TRANSCRIPCIÓN DE LLAMADA */}
      <Dialog open={!!selectedTranscript} onOpenChange={() => setSelectedTranscript(null)}>
        <DialogContent className="max-w-2xl bg-white rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-gray-900">
                    Transcripción Oficial de Llamada Asistencial
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-500">
                    Llamada del Agente IA lanzada por <strong>{staffName}</strong> para <strong>{selectedTranscript?.patient?.nombre}</strong>
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {selectedTranscript && (
            <div className="mt-4 space-y-4 text-xs">
              
              {/* Metadatos de la llamada */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">FECHA Y HORA</span>
                  <span className="font-bold text-gray-800">{selectedTranscript.data.fechaHora}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">DURACIÓN</span>
                  <span className="font-bold text-blue-700">{selectedTranscript.data.duracion}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold block">ENFERMERA A CARGO</span>
                  <span className="font-bold text-emerald-800 truncate block">{staffName}</span>
                </div>
              </div>

              {/* Resumen clínico */}
              <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-blue-800 block mb-1">
                  Resumen de la Interacción:
                </span>
                <p className="text-xs text-blue-950 font-medium leading-relaxed">
                  {selectedTranscript.data.resumen}
                </p>
              </div>

              {/* Diálogo Transcrito */}
              <div className="space-y-2.5 bg-slate-900 text-slate-100 p-4 rounded-2xl max-h-72 overflow-y-auto font-mono text-[11px]">
                <div className="text-[10px] text-slate-400 font-bold pb-2 border-b border-slate-800 flex items-center justify-between">
                  <span>LOG AUDITABLE DE DIÁLOGO</span>
                  <span>CANAL: GSM PUERTO 22</span>
                </div>

                {selectedTranscript.data.dialogo.map((d, dIdx) => {
                  const isAgent = d.emisor.includes('Agente') || d.emisor.includes('SADI');
                  return (
                    <div 
                      key={dIdx} 
                      className={`p-2 rounded-xl ${
                        isAgent ? 'bg-slate-800/80 border-l-3 border-blue-500' : 'bg-slate-850 border-l-3 border-emerald-500'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className={`font-bold ${isAgent ? 'text-blue-400' : 'text-emerald-400'}`}>
                          {d.emisor}
                        </span>
                        <span className="text-slate-400">{d.tiempo}</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed font-sans text-xs">
                        {d.texto}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Acciones del Modal */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const fullText = selectedTranscript.data.dialogo.map(d => `[${d.tiempo}] ${d.emisor}: ${d.texto}`).join('\n');
                    handleCopyTranscript(fullText);
                  }}
                  className="text-xs font-bold gap-1.5"
                >
                  {copiedTranscript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTranscript ? '¡Copiado!' : 'Copiar Transcripción'}</span>
                </Button>

                <Button
                  onClick={() => setSelectedTranscript(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                >
                  Cerrar
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

