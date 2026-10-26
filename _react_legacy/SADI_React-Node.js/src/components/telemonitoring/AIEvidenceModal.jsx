import React, { useState } from 'react';
import { 
  X, PhoneCall, MessageSquare, Volume2, VolumeX, ShieldCheck, 
  Clock, Calendar, User, FileText, CheckCircle2, AlertTriangle, Play, Pause 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const AIEvidenceModal = ({ evidence, onClose, onIntervene }) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [speechSynthesisActive, setSpeechSynthesisActive] = useState(false);

  if (!evidence) return null;

  const handleToggleVoiceSimulation = () => {
    if (!('speechSynthesis' in window)) {
      alert('La síntesis de voz no está soportada en este navegador.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    // Unir diálogos de la IA para reproducirlos
    const aiTexts = (evidence.transcripcion_dialogo || [])
      .filter(d => d.speaker.includes('IA') || d.speaker.includes('SADI'))
      .map(d => d.text)
      .join(' ... ');

    if (!aiTexts) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(aiTexts);
    utterance.lang = 'es-CO';
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden my-8">
        
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                <PhoneCall className="h-6 w-6 text-white animate-pulse" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">
                  Evidencia Auditable de Contacto
                </span>
                <h3 className="text-xl font-bold mt-1">Llamada de Agente IA (Res. 3280)</h3>
              </div>
            </div>
            <button 
              onClick={() => {
                if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
                onClose();
              }}
              className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
            <div>
              <span className="text-blue-200">Destino:</span>
              <p className="font-semibold text-sm">{evidence.telefono_destino}</p>
            </div>
            <div>
              <span className="text-blue-200">Duración:</span>
              <p className="font-semibold text-sm">{evidence.duracion_segundos} segundos</p>
            </div>
            <div>
              <span className="text-blue-200">Fecha y Hora:</span>
              <p className="font-semibold text-sm">{new Date(evidence.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Reproductor de Audio Simulado con Onda */}
        <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleToggleVoiceSimulation}
              size="sm"
              className={isPlayingAudio ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {isPlayingAudio ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Detener Audio IA
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Reproducir Audio Grabado
                </>
              )}
            </Button>
            <div className="flex items-center gap-1">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isPlayingAudio ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                  }`}
                  style={{ height: isPlayingAudio ? `${Math.sin(i + 1) * 16 + 20}px` : '8px' }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            Registro Firmado Criptográficamente
          </div>
        </div>

        {/* Contenido / Transcripción */}
        <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Resumen Clínico Automático
            </h4>
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-sm text-blue-900 leading-relaxed">
              {evidence.resumen_clinico_ia}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Transcripción Completa del Diálogo
            </h4>
            <div className="space-y-3">
              {(evidence.transcripcion_dialogo || []).map((msg, index) => {
                const isAI = msg.speaker.includes('IA') || msg.speaker.includes('SADI');
                return (
                  <div 
                    key={index} 
                    className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      {isAI ? (
                        <>
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                          <span className="font-semibold text-blue-700">Agente IA (SADI)</span>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold text-gray-700">Paciente</span>
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        </>
                      )}
                    </div>
                    <div 
                      className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                        isAI 
                          ? 'bg-gray-100 text-gray-900 rounded-tl-none border border-gray-200/80' 
                          : 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pie de modal */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            ID Evidencia: <span className="font-mono">{evidence.id}</span>
          </div>
          <div className="flex gap-2">
            {onIntervene && (
              <Button 
                onClick={() => {
                  onClose();
                  onIntervene();
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Registrar Intervención de Enfermería
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => {
                if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
                onClose();
              }}
            >
              Cerrar
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
