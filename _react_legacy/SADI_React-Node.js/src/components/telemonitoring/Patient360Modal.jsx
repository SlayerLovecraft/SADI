import React, { useState, useEffect } from 'react';
import { 
  X, User, Activity, Heart, Droplet, Calendar, ShieldCheck, 
  PhoneCall, AlertTriangle, TrendingUp, Clock, FileText, CheckCircle2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { telemonitoringService } from '@/services/telemonitoringService';
import { getRequiredRIASAppointments, getCursoVida3280 } from '@/services/rias3280Engine';

export const Patient360Modal = ({ patient, onClose, onTriggerAICall }) => {
  const [timeline, setTimeline] = useState([]);
  const [activeTab, setActiveTab] = useState('curvas'); // 'curvas' | 'rias' | 'historial'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (patient?.patient_id || patient?.id) {
      loadTimeline();
    }
  }, [patient]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const data = await telemonitoringService.getPatientTimeline(patient.patient_id || patient.id);
      setTimeline(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!patient) return null;

  const curso = getCursoVida3280(patient.fecha_nacimiento);
  const riasAppointments = getRequiredRIASAppointments(
    patient.fecha_nacimiento, 
    patient.sexo, 
    patient.es_gestante, 
    patient.semana_gestacional
  );

  // Filtrar datos para las curvas
  const bpData = timeline.filter(m => m.tipo_medicion === 'presion_arterial' && m.presion_sistolica);
  const glucoseData = timeline.filter(m => m.tipo_medicion === 'glucometria' && m.glucosa_mgdl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-6">
        
        {/* Banner Superior del Paciente */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-bold text-white shadow-inner">
                {patient.nombre ? patient.nombre.split(' ').map(n => n[0]).slice(0, 2).join('') : 'P'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{patient.nombre}</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                    {patient.tipo_documento || 'CC'}: {patient.documento}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300 mt-1.5">
                  <span className="font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    {curso.label}
                  </span>
                  {patient.es_gestante && (
                    <span className="font-semibold text-pink-300 bg-pink-950/60 px-2 py-0.5 rounded border border-pink-500/30 animate-pulse">
                      🤰 Gestante: Semana {patient.semana_gestacional || 28} (Ruta Materno Perinatal)
                    </span>
                  )}
                  {patient.es_diabetico && (
                    <span className="font-semibold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                      🩺 Diabetes Mellitus
                    </span>
                  )}
                  <span>📞 {patient.telefono}</span>
                  <span>🏥 {patient.eps || 'EPS Asignada'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onTriggerAICall && onTriggerAICall(patient)}
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-500/30"
              >
                <PhoneCall className="h-4 w-4" />
                Contactar con Agente IA
              </Button>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Navegación por Pestañas */}
          <div className="flex gap-2 mt-6 border-b border-white/10 pt-2">
            <button
              onClick={() => setActiveTab('curvas')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all flex items-center gap-2 ${
                activeTab === 'curvas' 
                  ? 'bg-white text-gray-900 border-t-2 border-indigo-600' 
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Curvas de Evolución (Telemonitoreo)
            </button>
            <button
              onClick={() => setActiveTab('rias')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all flex items-center gap-2 ${
                activeTab === 'rias' 
                  ? 'bg-white text-gray-900 border-t-2 border-indigo-600' 
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Ruta Res. 3280 & Tamizajes
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all flex items-center gap-2 ${
                activeTab === 'historial' 
                  ? 'bg-white text-gray-900 border-t-2 border-indigo-600' 
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock className="h-4 w-4 text-blue-600" />
              Historial de Mediciones ({timeline.length})
            </button>
          </div>
        </div>

        {/* Contenido de la Pestaña Activa */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {activeTab === 'curvas' && (
            <div className="space-y-6">
              
              {/* Curva de Tensiometría */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-red-100 text-red-700 rounded-lg">
                      <Heart className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Curva de Presión Arterial (Sistólica / Diastólica / PAM)</h4>
                      <p className="text-xs text-gray-500">Banda verde de seguridad: 90-120 mmHg Sistólica / 60-80 Diastólica</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-red-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Sistólica (PAS)
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-blue-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Diastólica (PAD)
                    </span>
                  </div>
                </div>

                {bpData.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No hay mediciones de tensiometría aún para este paciente.
                  </div>
                ) : (
                  <div className="relative h-48 w-full border-b border-l border-gray-300 pt-4">
                    {/* Banda de Seguridad Verde */}
                    <div className="absolute left-0 right-0 top-[35%] bottom-[40%] bg-emerald-500/10 border-y border-emerald-500/20 pointer-events-none flex items-center justify-end pr-2 text-[10px] text-emerald-700 font-bold">
                      Rango Seguro Res. 3280
                    </div>

                    {/* Gráfico SVG de Líneas Interactivo */}
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                      {/* Línea Sistólica */}
                      <polyline
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={bpData.map((d, i) => {
                          const x = (i / Math.max(bpData.length - 1, 1)) * 480 + 10;
                          const y = 150 - ((d.presion_sistolica - 60) / (200 - 60)) * 140;
                          return `${x},${Math.max(10, Math.min(140, y))}`;
                        }).join(' ')}
                      />

                      {/* Línea Diastólica */}
                      <polyline
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={bpData.map((d, i) => {
                          const x = (i / Math.max(bpData.length - 1, 1)) * 480 + 10;
                          const y = 150 - ((d.presion_diastolica - 40) / (140 - 40)) * 140;
                          return `${x},${Math.max(10, Math.min(140, y))}`;
                        }).join(' ')}
                      />

                      {/* Puntos y valores */}
                      {bpData.map((d, i) => {
                        const x = (i / Math.max(bpData.length - 1, 1)) * 480 + 10;
                        const ySys = 150 - ((d.presion_sistolica - 60) / (200 - 60)) * 140;
                        const isAlert = d.alerta_generada;
                        return (
                          <g key={i}>
                            <circle
                              cx={x}
                              cy={Math.max(10, Math.min(140, ySys))}
                              r={isAlert ? 6 : 4}
                              className={isAlert ? 'fill-red-600 stroke-white stroke-2 animate-bounce' : 'fill-red-500'}
                            />
                            <text
                              x={x}
                              y={Math.max(20, Math.min(130, ySys - 10))}
                              fontSize="10"
                              fontWeight="bold"
                              fill="#991b1b"
                              textAnchor="middle"
                            >
                              {d.presion_sistolica}/{d.presion_diastolica}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    <div className="flex justify-between text-[10px] text-gray-400 mt-2">
                      {bpData.map((d, i) => (
                        <span key={i}>{new Date(d.medido_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Curva de Glucometría */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-cyan-100 text-cyan-700 rounded-lg">
                      <Droplet className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Curva de Glucometría (mg/dL)</h4>
                      <p className="text-xs text-gray-500">Umbral de hipoglucemia: &lt; 70 mg/dL | Meta en ayunas: 70 - 130 mg/dL</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-cyan-100 text-cyan-800">
                    Glucosa Capilar
                  </span>
                </div>

                {glucoseData.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No hay registros de glucometría aún para este paciente.
                  </div>
                ) : (
                  <div className="relative h-44 w-full border-b border-l border-gray-300 pt-4">
                    {/* Línea roja punteada de Hipoglucemia */}
                    <div className="absolute left-0 right-0 bottom-[22%] border-b-2 border-dashed border-red-500 pointer-events-none flex items-center justify-end pr-2 text-[10px] text-red-600 font-bold">
                      Límite Crítico Hipoglucemia (70 mg/dL)
                    </div>

                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 130" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={glucoseData.map((d, i) => {
                          const x = (i / Math.max(glucoseData.length - 1, 1)) * 480 + 10;
                          const y = 130 - ((d.glucosa_mgdl - 40) / (300 - 40)) * 120;
                          return `${x},${Math.max(10, Math.min(120, y))}`;
                        }).join(' ')}
                      />

                      {glucoseData.map((d, i) => {
                        const x = (i / Math.max(glucoseData.length - 1, 1)) * 480 + 10;
                        const y = 130 - ((d.glucosa_mgdl - 40) / (300 - 40)) * 120;
                        const isCritical = d.glucosa_mgdl < 70 || d.glucosa_mgdl >= 250;
                        return (
                          <g key={i}>
                            <circle
                              cx={x}
                              cy={Math.max(10, Math.min(120, y))}
                              r={isCritical ? 6 : 4}
                              className={isCritical ? 'fill-red-600 stroke-white stroke-2 animate-ping' : 'fill-cyan-600'}
                            />
                            <text
                              x={x}
                              y={Math.max(20, Math.min(110, y - 10))}
                              fontSize="10"
                              fontWeight="bold"
                              fill={isCritical ? '#b91c1c' : '#0e7490'}
                              textAnchor="middle"
                            >
                              {d.glucosa_mgdl} mg/dL
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    <div className="flex justify-between text-[10px] text-gray-400 mt-2">
                      {glucoseData.map((d, i) => (
                        <span key={i}>{new Date(d.medido_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} ({d.momento_glucometria || 'ayunas'})</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === 'rias' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Atenciones y Tamizajes Obligatorios (Resolución 3280 de 2018)
                </h4>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                  {riasAppointments.length} Intervenciones Aplicables
                </span>
              </div>

              <div className="grid gap-3">
                {riasAppointments.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-gray-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/20 transition-all flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold">
                          {item.protocol_id}
                        </span>
                        <h5 className="font-bold text-gray-900 text-sm">{item.nombre}</h5>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{item.accion}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                        <span>Frecuencia: <b className="text-gray-700">{item.frecuencia}</b></span>
                        <span>Talento: <b className="text-gray-700">{item.profesional}</b></span>
                        <span>Pág. Res: <b className="text-indigo-600">{item.pagina}</b></span>
                      </div>
                    </div>

                    <Button size="sm" variant="outline" className="text-xs">
                      Inducir Demanda (SMS/IA)
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Bitácora de Mediciones Reportadas desde Casa
              </h4>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {timeline.map((m, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${m.alerta_generada ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {m.tipo_medicion === 'presion_arterial' ? <Heart className="h-4 w-4" /> : <Droplet className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">
                          {m.tipo_medicion === 'presion_arterial'
                            ? `PA: ${m.presion_sistolica}/${m.presion_diastolica} mmHg (PAM: ${m.pam_calculada || '-'})`
                            : `Glucosa: ${m.glucosa_mgdl} mg/dL (${m.momento_glucometria || 'ayunas'})`}
                        </div>
                        <div className="text-gray-400 text-[11px]">
                          Dispositivo: {m.dispositivo_modelo} • {new Date(m.medido_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div>
                      {m.alerta_generada ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                          Alerta Activada ({m.nivel_alerta})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700">
                          Normal
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cerrar Vista 360
          </Button>
        </div>

      </div>
    </div>
  );
};
