import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { 
  Activity, Heart, Droplet, AlertTriangle, PhoneCall, ShieldCheck, 
  Search, Filter, Plus, Eye, RefreshCw, Volume2, VolumeX, Stethoscope, Clock, CheckCircle2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { telemonitoringService, SEED_PATIENTS_3280 } from '@/services/telemonitoringService';
import { HomeDeviceSimulatorModal } from '@/components/telemonitoring/HomeDeviceSimulatorModal';
import { Patient360Modal } from '@/components/telemonitoring/Patient360Modal';
import { AIEvidenceModal } from '@/components/telemonitoring/AIEvidenceModal';
import { NursingInterventionModal } from '@/components/telemonitoring/NursingInterventionModal';

import { useAuth } from '@/contexts/AuthContext';
import { isPatientAssignedToDoctor } from './doctor/doctorUtils';

const TelemonitoringDashboardPage = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [showSimulator, setShowSimulator] = useState(false);
  const [selectedPatient360, setSelectedPatient360] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [selectedAlertToIntervene, setSelectedAlertToIntervene] = useState(null);

  useEffect(() => {
    loadData();
    // Polling ligero para actualizar alertas cada 15 segundos si se generan nuevas
    const interval = setInterval(() => {
      loadData(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [alertsData, patientsData] = await Promise.all([
        telemonitoringService.getAlerts(),
        telemonitoringService.getPatients()
      ]);

      if (user?.role === 'doctor') {
        const myPatients = (patientsData || []).filter(p => isPatientAssignedToDoctor(p, user));
        const myPatientIds = myPatients.map(p => p.patient_id || p.id);
        const myAlerts = (alertsData || []).filter(a => myPatientIds.includes(a.patient_id));

        setPatients(myPatients);
        setAlerts(myAlerts);
      } else {
        setAlerts(alertsData || []);
        setPatients(patientsData || []);
      }
    } catch (e) {
      console.error('Error cargando telemonitoreo:', e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleOpenEvidence = async (alert) => {
    try {
      const evidences = await telemonitoringService.getAIEvidences(alert.patient_id);
      const match = evidences.find(e => e.id === alert.ia_contact_id || e.alert_id === alert.id) || evidences[0];
      if (match) {
        setSelectedEvidence(match);
      } else {
        alert('No se encontró archivo de audio para esta alerta aún.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtrado
  const filteredAlerts = alerts.filter(a => {
    if (filterSeverity !== 'todas' && a.severidad !== filterSeverity) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const patient = patients.find(p => p.patient_id === a.patient_id);
      const name = (patient?.nombre || '').toLowerCase();
      const title = (a.titulo || '').toLowerCase();
      return name.includes(term) || title.includes(term);
    }
    return true;
  });

  const criticalCount = alerts.filter(a => a.severidad === 'critica_roja' && a.estado !== 'intervenida_enfermeria').length;
  const urgentCount = alerts.filter(a => a.severidad === 'urgente_naranja' && a.estado !== 'intervenida_enfermeria').length;
  const intervenedCount = alerts.filter(a => a.estado === 'intervenida_enfermeria').length;

  return (
    <Layout>
      <Helmet>
        <title>SADI - Telemonitoreo Casero & Alertas Res. 3280</title>
      </Helmet>

      <div className="space-y-6">
        
        {/* Encabezado Principal */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest">
              <Activity className="h-4 w-4" />
              SADI Care Telemonitoreo (RPM) • Resolución 3280 de 2018
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Centro de Telemonitoreo & Alertas Clínicas
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Captura continua de datos desde tensiómetros y glucómetros caseros. Activación automática del Agente IA y triage clínico de enfermería.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowSimulator(true)}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Simular Equipo Casero (Probar Umbral)
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => loadData(true)}
              className="rounded-xl"
              title="Refrescar datos"
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Tarjetas de Métricas de Triage Clínico */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pacientes Monitoreados</span>
              <div className="text-2xl font-black text-gray-900 mt-1">{patients.length}</div>
              <span className="text-[11px] font-semibold text-emerald-600 mt-1 block">
                Dispositivos caseros vinculados
              </span>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Activity className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-rose-50/50 rounded-2xl p-5 border border-red-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                Alertas Críticas (Rojas)
              </span>
              <div className="text-2xl font-black text-red-900 mt-1">{criticalCount}</div>
              <span className="text-[11px] text-red-700 mt-1 block font-medium">
                Preeclampsia / Crisis HTA / Hipo &lt; 70
              </span>
            </div>
            <div className="p-3 bg-red-600 text-white rounded-2xl shadow-md shadow-red-600/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-amber-50/50 rounded-2xl p-5 border border-orange-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">Alertas Urgentes (Naranja)</span>
              <div className="text-2xl font-black text-orange-900 mt-1">{urgentCount}</div>
              <span className="text-[11px] text-orange-800 mt-1 block font-medium">
                Descompensación / Agente IA en marcha
              </span>
            </div>
            <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-md shadow-orange-500/30">
              <PhoneCall className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Intervenidas por Enfermería</span>
              <div className="text-2xl font-black text-emerald-700 mt-1">{intervenedCount}</div>
              <span className="text-[11px] font-semibold text-gray-500 mt-1 block">
                Casos auditados y resueltos
              </span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Stethoscope className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Bandeja de Alertas Clínicas en Tiempo Real */}
        <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
          
          {/* Barra de Filtros */}
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por paciente o alerta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 text-xs font-medium border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 w-64 transition-all"
                />
              </div>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setFilterSeverity('todas')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    filterSeverity === 'todas' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Todas ({alerts.length})
                </button>
                <button
                  onClick={() => setFilterSeverity('critica_roja')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    filterSeverity === 'critica_roja' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:text-red-600'
                  }`}
                >
                  Críticas ({alerts.filter(a => a.severidad === 'critica_roja').length})
                </button>
                <button
                  onClick={() => setFilterSeverity('urgente_naranja')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    filterSeverity === 'urgente_naranja' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-orange-600'
                  }`}
                >
                  Urgentes ({alerts.filter(a => a.severidad === 'urgente_naranja').length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              Actualización en vivo cada 15 segundos
            </div>
          </div>

          {/* Tabla de Alertas */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-5">Paciente & Curso de Vida</th>
                  <th className="py-3.5 px-4">Alerta Clínica (Res. 3280)</th>
                  <th className="py-3.5 px-4">Severidad / Criterio</th>
                  <th className="py-3.5 px-4">Estado Agente IA</th>
                  <th className="py-3.5 px-4 text-right">Acciones Inmediatas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      No se encontraron alertas para los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert) => {
                    const patient = patients.find(p => p.patient_id === alert.patient_id) || SEED_PATIENTS_3280[0];
                    const isCritical = alert.severidad === 'critica_roja';
                    const isUrgent = alert.severidad === 'urgente_naranja';
                    const isIntervened = alert.estado === 'intervenida_enfermeria';

                    return (
                      <tr 
                        key={alert.id} 
                        className={`hover:bg-gray-50/70 transition-colors ${
                          isCritical && !isIntervened ? 'bg-red-50/30' : ''
                        }`}
                      >
                        {/* Paciente */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                              {patient.nombre ? patient.nombre.split(' ').map(n => n[0]).slice(0, 2).join('') : 'P'}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                {patient.nombre}
                                {patient.es_gestante && (
                                  <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-1.5 py-0.5 rounded-full">
                                    🤰 Gestante (Sem {patient.semana_gestacional})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {patient.documento} • {patient.telefono}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Alerta */}
                        <td className="py-4 px-4 max-w-xs">
                          <div className="font-bold text-gray-900">{alert.titulo}</div>
                          <div className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{alert.descripcion}</div>
                        </td>

                        {/* Severidad */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1">
                            {isCritical ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-300 w-fit">
                                <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                                CRÍTICA (CÓDIGO ROJO)
                              </span>
                            ) : isUrgent ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300 w-fit">
                                URGENTE (PRIORITARIA)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 w-fit">
                                VIGILANCIA
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 font-mono">
                              {alert.criterio_res_3280}
                            </span>
                          </div>
                        </td>

                        {/* Estado IA */}
                        <td className="py-4 px-4">
                          {isIntervened ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2.5 py-1 rounded-lg w-fit border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Intervenida por Enfermería
                            </div>
                          ) : alert.ia_contact_disparado ? (
                            <div className="flex items-center gap-1.5 text-indigo-700 font-semibold text-[11px] bg-indigo-50 px-2.5 py-1 rounded-lg w-fit border border-indigo-200 animate-pulse">
                              <PhoneCall className="h-3.5 w-3.5" />
                              Llamada IA Ejecutada
                            </div>
                          ) : (
                            <div className="text-gray-400 text-[11px]">En cola</div>
                          )}
                          <div className="text-[10px] text-gray-400 mt-1">
                            {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {alert.ia_contact_disparado && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEvidence(alert)}
                                className="text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                title="Escuchar llamada grabada y ver transcripción"
                              >
                                <PhoneCall className="h-3.5 w-3.5 mr-1" />
                                Evidencia IA
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPatient360(patient)}
                              className="text-xs"
                              title="Ver curvas de evolución y Ruta 3280"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Curva 360
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => setSelectedAlertToIntervene(alert)}
                              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            >
                              <Stethoscope className="h-3.5 w-3.5 mr-1" />
                              Intervenir
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
        </div>

        {/* Sección de Monitor de Pacientes con Equipos Caseros */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Pacientes Registrados con Telemonitoreo Activo</h3>
              <p className="text-xs text-gray-500">Equipos de medición asignados y conectados a la plataforma SADI.</p>
            </div>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {patients.length} Pacientes en Seguimiento
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {patients.map(p => (
              <div 
                key={p.patient_id || p.id} 
                onClick={() => setSelectedPatient360(p)}
                className="p-4 rounded-2xl border border-gray-200 hover:border-indigo-400 bg-gray-50/50 hover:bg-white hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                    {p.nombre ? p.nombre.split(' ').map(n => n[0]).slice(0, 2).join('') : 'P'}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    🟢 En Línea
                  </span>
                </div>

                <div className="font-bold text-gray-900 text-sm mt-3 truncate">{p.nombre}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {p.es_gestante ? `🤰 Gestante Sem ${p.semana_gestacional}` : p.es_diabetico ? '🩺 Diabético' : '👤 Adulto'}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200/80 text-[11px] text-gray-600 flex items-center justify-between">
                  <span>Equipos:</span>
                  <span className="font-semibold text-indigo-600 truncate max-w-[130px]">
                    {(p.dispositivos_caseros || ['Tensiómetro'])[0]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modales */}
      {showSimulator && (
        <HomeDeviceSimulatorModal
          onClose={() => setShowSimulator(false)}
          onMeasurementSaved={() => {
            loadData(false);
          }}
        />
      )}

      {selectedPatient360 && (
        <Patient360Modal
          patient={selectedPatient360}
          onClose={() => setSelectedPatient360(null)}
          onTriggerAICall={(p) => {
            alert(`Llamada del Agente IA programada para ${p.nombre}. Se generará el audio y la transcripción.`);
          }}
        />
      )}

      {selectedEvidence && (
        <AIEvidenceModal
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
          onIntervene={() => {
            const relatedAlert = alerts.find(a => a.id === selectedEvidence.alert_id);
            if (relatedAlert) {
              setSelectedAlertToIntervene(relatedAlert);
            }
          }}
        />
      )}

      {selectedAlertToIntervene && (
        <NursingInterventionModal
          alert={selectedAlertToIntervene}
          onClose={() => setSelectedAlertToIntervene(null)}
          onInterventionSaved={() => {
            loadData(false);
          }}
        />
      )}
    </Layout>
  );
};

export default TelemonitoringDashboardPage;
