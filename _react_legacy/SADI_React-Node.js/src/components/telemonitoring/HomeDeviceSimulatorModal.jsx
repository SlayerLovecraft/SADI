import React, { useState } from 'react';
import { 
  X, Activity, Heart, Droplet, Play, AlertTriangle, 
  CheckCircle2, RefreshCw, Send, Sparkles, PhoneCall 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { telemonitoringService, SEED_PATIENTS_3280 } from '@/services/telemonitoringService';
import { useToast } from '@/components/ui/use-toast';

export const HomeDeviceSimulatorModal = ({ onClose, onMeasurementSaved }) => {
  const { toast } = useToast();
  const [deviceType, setDeviceType] = useState('tensiometro'); // 'tensiometro' | 'glucometro'
  const [selectedPatientId, setSelectedPatientId] = useState(SEED_PATIENTS_3280[0].patient_id);
  const [loading, setLoading] = useState(false);

  // Estados de Tensión
  const [sistolica, setSistolica] = useState(120);
  const [diastolica, setDiastolica] = useState(80);
  const [pulso, setPulso] = useState(75);

  // Estados de Glucometría
  const [glucosa, setGlucosa] = useState(105);
  const [momentoGlucosa, setMomentoGlucosa] = useState('ayunas');

  const selectedPatient = SEED_PATIENTS_3280.find(p => p.patient_id === selectedPatientId) || SEED_PATIENTS_3280[0];

  // Presets rápidos para demostrar la detección de umbrales clínicos de la Res. 3280
  const applyPreset = (preset) => {
    if (preset === 'normal_bp') {
      setDeviceType('tensiometro');
      setSistolica(118);
      setDiastolica(78);
      setPulso(72);
    } else if (preset === 'preeclampsia_gestante') {
      setDeviceType('tensiometro');
      setSelectedPatientId('pat-gestante-001'); // Valentina Restrepo
      setSistolica(164);
      setDiastolica(112);
      setPulso(98);
    } else if (preset === 'crisis_adultez') {
      setDeviceType('tensiometro');
      setSelectedPatientId('pat-adulto-dm-002'); // Carlos Gómez
      setSistolica(188);
      setDiastolica(118);
      setPulso(102);
    } else if (preset === 'hipoglucemia') {
      setDeviceType('glucometro');
      setSelectedPatientId('pat-adulto-dm-002');
      setGlucosa(54);
      setMomentoGlucosa('ayunas');
    } else if (preset === 'hiperglucemia') {
      setDeviceType('glucometro');
      setSelectedPatientId('pat-adulto-dm-002');
      setGlucosa(290);
      setMomentoGlucosa('postprandial_2h');
    }
  };

  const handleSimulateSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        patient_id: selectedPatient.patient_id,
        pacienteNombre: selectedPatient.nombre,
        pacienteTelefono: selectedPatient.telefono,
        tipo_medicion: deviceType === 'tensiometro' ? 'presion_arterial' : 'glucometria',
        presion_sistolica: deviceType === 'tensiometro' ? sistolica : null,
        presion_diastolica: deviceType === 'tensiometro' ? diastolica : null,
        ritmo_cardiaco: deviceType === 'tensiometro' ? pulso : null,
        glucometria: deviceType === 'glucometro' ? glucosa : null,
        momento_glucometria: deviceType === 'glucometro' ? momentoGlucosa : null,
        dispositivo_modelo: deviceType === 'tensiometro' ? 'Tensiómetro Digital Doméstico' : 'Glucómetro Digital Casero',
        es_gestante: selectedPatient.es_gestante,
        semana_gestacional: selectedPatient.semana_gestacional
      };

      const result = await telemonitoringService.addHomeMeasurement(payload);

      if (result.success) {
        if (result.evaluacion.tieneAlerta) {
          toast({
            title: "🚨 ¡UMBRAL CLÍNICO CRÍTICO DETECTADO!",
            description: `${result.alert.titulo}. El Agente IA fue disparado inmediatamente.`,
            variant: "destructive"
          });
        } else {
          toast({
            title: "✅ Medición Casera Procesada",
            description: "Valores dentro de los parámetros esperados de la Resolución 3280.",
          });
        }

        if (onMeasurementSaved) {
          onMeasurementSaved(result);
        }
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "No se pudo procesar la medición simulada",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-6">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-400/30">
                <Activity className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-widest font-bold text-indigo-300">
                  Herramienta de Captura Casera (RPM)
                </span>
                <h3 className="text-xl font-bold mt-0.5">Simulador de Equipos Médicos Caseros</h3>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <p className="text-xs text-gray-300 mt-2">
            Prueba cómo reacciona el sistema SADI cuando un paciente se mide en casa con tensiómetro o glucómetro, y cómo los umbrales de la Res. 3280 disparan de inmediato al Agente IA y al Dashboard de Enfermería.
          </p>
        </div>

        {/* Selector de Presets de Prueba Rápida */}
        <div className="bg-indigo-50/70 p-4 border-b border-indigo-100">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-indigo-900">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            Casos de Prueba Rápida (Demostración de Umbrales Res. 3280):
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset('preeclampsia_gestante')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-100 text-red-800 hover:bg-red-200 border border-red-300 transition-all flex items-center gap-1.5"
            >
              🚨 Gestante 164/112 (Preeclampsia Severa)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('hipoglucemia')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 transition-all flex items-center gap-1.5"
            >
              🚨 Glucosa 54 mg/dL (Hipoglucemia Crítica)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('crisis_adultez')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-300 transition-all flex items-center gap-1.5"
            >
              ⚠️ Adulto 188/118 (Crisis HTA)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('normal_bp')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition-all flex items-center gap-1.5"
            >
              ✅ Normal (118/78 mmHg)
            </button>
          </div>
        </div>

        <form onSubmit={handleSimulateSubmit} className="p-6 space-y-6">
          {/* Selección de Paciente */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Paciente que reporta la medición
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full text-sm font-medium border border-gray-300 rounded-xl px-3.5 py-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              {SEED_PATIENTS_3280.map(p => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.nombre} — {p.es_gestante ? `🤰 Gestante (Semana ${p.semana_gestacional})` : p.es_diabetico ? '🩺 Diabético / Hipertenso' : '👤 Adulto'} ({p.telefono})
                </option>
              ))}
            </select>
          </div>

          {/* Selección de Dispositivo */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDeviceType('tensiometro')}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                deviceType === 'tensiometro'
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className={`p-2.5 rounded-xl ${deviceType === 'tensiometro' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900">Tensiómetro Digital</h4>
                <p className="text-xs text-gray-500">Sístole, Diástole, Pulso</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDeviceType('glucometro')}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                deviceType === 'glucometro'
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className={`p-2.5 rounded-xl ${deviceType === 'glucometro' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Droplet className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900">Glucómetro Digital</h4>
                <p className="text-xs text-gray-500">Glucosa en sangre (mg/dL)</p>
              </div>
            </button>
          </div>

          {/* Pantalla LCD Interactiva del Dispositivo */}
          {deviceType === 'tensiometro' ? (
            <div className="bg-slate-900 rounded-3xl p-6 text-white border-4 border-slate-700 shadow-inner">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-800 pb-2 mb-4">
                <span>DIGITAL BLOOD PRESSURE MONITOR</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  MANGUITO CONECTADO
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SYS (mmHg)</span>
                  <div className="text-4xl font-black font-mono text-emerald-400 mt-1">
                    {sistolica}
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="220"
                    value={sistolica}
                    onChange={(e) => setSistolica(Number(e.target.value))}
                    className="w-full mt-3 accent-emerald-500"
                  />
                </div>

                <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">DIA (mmHg)</span>
                  <div className="text-4xl font-black font-mono text-cyan-400 mt-1">
                    {diastolica}
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="140"
                    value={diastolica}
                    onChange={(e) => setDiastolica(Number(e.target.value))}
                    className="w-full mt-3 accent-cyan-500"
                  />
                </div>

                <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PULSO (BPM)</span>
                  <div className="text-4xl font-black font-mono text-amber-400 mt-1">
                    {pulso}
                  </div>
                  <input
                    type="range"
                    min="45"
                    max="150"
                    value={pulso}
                    onChange={(e) => setPulso(Number(e.target.value))}
                    className="w-full mt-3 accent-amber-500"
                  />
                </div>
              </div>

              <div className="mt-3 text-center text-xs text-slate-400 font-mono">
                Presión Arterial Media (PAM) calculada: <span className="font-bold text-white">{Math.round(((2 * diastolica) + sistolica) / 3 * 10) / 10} mmHg</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-3xl p-6 text-white border-4 border-slate-700 shadow-inner">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-800 pb-2 mb-4">
                <span>BLOOD GLUCOSE MONITORING SYSTEM</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  TIRA REACTIVA OK
                </span>
              </div>

              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/80 rounded-2xl border border-slate-700">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">GLUCOSA EN SANGRE</span>
                <div className="text-6xl font-black font-mono text-cyan-300 my-2">
                  {glucosa} <span className="text-xl font-normal text-slate-400">mg/dL</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="400"
                  value={glucosa}
                  onChange={(e) => setGlucosa(Number(e.target.value))}
                  className="w-full max-w-md mt-4 accent-cyan-400"
                />

                <div className="flex gap-2 mt-4">
                  {['ayunas', 'postprandial_1h', 'postprandial_2h', 'antes_dormir'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMomentoGlucosa(m)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all ${
                        momentoGlucosa === m 
                          ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400' 
                          : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      {m === 'ayunas' ? 'En Ayunas' : m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Botón de Enviar */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 font-semibold shadow-lg shadow-indigo-600/30"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Analizando Umbrales Res. 3280...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Emitir Medición a SADI
                </>
              )}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
};
