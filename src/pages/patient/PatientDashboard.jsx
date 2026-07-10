import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import PatientLayout from '@/layouts/PatientLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Activity, Heart, User, Calendar, MapPin, AlertTriangle, Plus, RefreshCw, HeartPulse, Thermometer, Gauge, Droplet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

const PatientDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const reduceMotion = useReducedMotion();
  
  const [patientData, setPatientData] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [patientError, setPatientError] = useState(null);
  
  const [vitalSigns, setVitalSigns] = useState([]);
  const [healthStatus, setHealthStatus] = useState({ status: 'Sin datos', alerts: [] });
  const [monthlyAverage, setMonthlyAverage] = useState(null);
  const [latestVitals, setLatestVitals] = useState(null);
  const [loadingVitals, setLoadingVitals] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.role === 'patient') {
      loadPatientData();
    }
  }, [user]);

  useEffect(() => {
    if (patientData?.patient_id) {
      loadVitalSigns(patientData.patient_id);
    }
  }, [patientData]);

  useEffect(() => {
    if (!patientData?.patient_id) return;
    
    const subscription = supabase
      .channel('signos_vitales_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'signos_vitales',
          filter: `paciente_id=eq.${patientData.patient_id}`
        },
        () => {
          loadVitalSigns(patientData.patient_id);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [patientData?.patient_id]);

  const loadPatientData = async () => {
    try {
      setLoadingPatient(true);
      setPatientError(null);

      if (!user.id) {
        throw new Error('El usuario no tiene un ID válido');
      }

      const { data: patients, error } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_id', user.id);

      if (error) {
        throw error;
      }

      if (!patients || patients.length === 0) {
        const { data: altPatients, error: altError } = await supabase
          .from('patients')
          .select('*')
          .or(`email.eq.${user.email},document.eq.${user.documento}`);
        
        if (altError) throw altError;

        if (altPatients && altPatients.length > 0) {
          const patient = altPatients[0];
          setPatientData(patient);
          return;
        }
        
        throw new Error('No se encontró tu perfil de paciente');
      }

      const patient = patients[0];
      setPatientData(patient);

    } catch (error) {
      setPatientError(error.message);
    } finally {
      setLoadingPatient(false);
    }
  };

const loadVitalSigns = async (patientId) => {
  try {
    setLoadingVitals(true);

    const { data: vitalsData, error: vitalsError } = await supabase
      .from('signos_vitales')
      .select('*')
      .eq('paciente_id', patientId)
      .order('fecha', { ascending: false });

    if (vitalsError) {
      throw vitalsError;
    }

    const vitals = vitalsData || [];
    setVitalSigns(vitals);

    if (vitals.length === 0) {
      setLatestVitals({
        temperatura: 0,
        ritmo_cardiaco: 0,
        glucometria: 0,
        presion_sistolica: 0,
        presion_diastolica: 0,
        fecha: new Date().toISOString()
      });
      setHealthStatus({ status: 'Sin datos', alerts: ['No hay registros'] });
      setMonthlyAverage(null);
    } else {
      const latest = vitals[0];
      setLatestVitals(latest);

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const recentVitals = vitals.filter(v => {
        const vitalDate = new Date(v.fecha);
        const isRecent = vitalDate >= oneMonthAgo;
        
        const hasValidData = 
          Number(v.temperatura || 0) > 0 ||
          Number(v.ritmo_cardiaco || 0) > 0 ||
          Number(v.glucometria || 0) > 0 ||
          Number(v.presion_sistolica || 0) > 0;
        
        return isRecent && hasValidData;
      });
      
      if (recentVitals.length > 0) {
        const calcAverage = (field) => {
          const validValues = recentVitals
            .map(v => Number(v[field] || 0))
            .filter(val => val > 0);
          
          if (validValues.length === 0) return 0;
          
          const sum = validValues.reduce((acc, val) => acc + val, 0);
          return sum / validValues.length;
        };
        
        const avg = {
          heartRate: Math.round(calcAverage('ritmo_cardiaco')),
          temperature: calcAverage('temperatura').toFixed(1),
          glucometry: Math.round(calcAverage('glucometria')),
          bloodPressureSys: Math.round(calcAverage('presion_sistolica')),
          bloodPressureDia: Math.round(calcAverage('presion_diastolica'))
        };
        
        setMonthlyAverage(avg);
      } else {
        setMonthlyAverage(null);
      }

      const alerts = checkHealthAlerts(latest);
      setHealthStatus(alerts);
    }
  } catch (error) {
    setHealthStatus({ status: 'Sin datos', alerts: ['No fue posible cargar signos vitales'] });
  } finally {
    setLoadingVitals(false);
  }
};

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPatientData();
    if (patientData?.patient_id) {
      await loadVitalSigns(patientData.patient_id);
    }
    setRefreshing(false);
  };

  const calculateAge = (birthdate) => {
    if (!birthdate) return null;
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const checkHealthAlerts = (vitals) => {
    const alerts = [];
    let status = 'Saludable';

    const temp = Number(vitals.temperatura || 0);
    const hr = Number(vitals.ritmo_cardiaco || 0);
    const sys = Number(vitals.presion_sistolica || 0);
    const dia = Number(vitals.presion_diastolica || 0);
    const gluc = Number(vitals.glucometria || 0);

    if (temp === 0 && hr === 0 && sys === 0 && dia === 0 && gluc === 0) {
      return { status: 'Sin datos', alerts: ['Registra tus primeros signos vitales'] };
    }

    if (temp > 37.5) {
      alerts.push('Fiebre detectada');
      status = 'Fiebre';
    } else if (temp < 35) {
      alerts.push('Hipotermia');
      status = 'Hipotermia';
    }

    if (sys > 140 || dia > 90) {
      alerts.push('Presión arterial alta');
      status = 'Hipertensión';
    } else if (sys < 90 || dia < 60) {
      alerts.push('Presión arterial baja');
      status = 'Hipotensión';
    }

    if (hr > 100) {
      alerts.push('Taquicardia');
      status = 'Taquicardia';
    } else if (hr < 60) {
      alerts.push('Bradicardia');
      status = 'Bradicardia';
    }

    if (gluc > 140) {
      alerts.push('Glucosa elevada');
      status = 'Hiperglucemia';
    } else if (gluc < 70) {
      alerts.push('Glucosa baja');
      status = 'Hipoglucemia';
    }

    return { status, alerts };
  };

  if (authLoading || loadingPatient || loadingVitals) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando...</p>
          </div>
        </div>
      </PatientLayout>
    );
  }

  if (patientError || !patientData) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No se encontró tu perfil</h2>
            <p className="text-gray-600 mb-4">{patientError || 'Error desconocido'}</p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => window.location.href = '/patient/login'}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cerrar sesión
              </button>
              <button 
                onClick={handleRefresh}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </PatientLayout>
    );
  }

  const hasAlerts = healthStatus.alerts.length > 0 && healthStatus.status !== 'Sin datos';
  const hasNoData = vitalSigns.length === 0 || (latestVitals && 
    latestVitals.temperatura === 0 && 
    latestVitals.ritmo_cardiaco === 0);

  const vitalsActive = Boolean(latestVitals) && !hasNoData;
  const hr = Number(latestVitals?.ritmo_cardiaco || 0);
  const sys = Number(latestVitals?.presion_sistolica || 0);
  const dia = Number(latestVitals?.presion_diastolica || 0);
  const temp = Number(latestVitals?.temperatura || 0);
  const gluc = Number(latestVitals?.glucometria || 0);

  const avgHr = Number(monthlyAverage?.heartRate || 0);
  const avgSys = Number(monthlyAverage?.bloodPressureSys || 0);
  const avgDia = Number(monthlyAverage?.bloodPressureDia || 0);
  const avgTemp = Number(monthlyAverage?.temperature || 0);
  const avgGluc = Number(monthlyAverage?.glucometry || 0);

  const heartPeriodSeconds = (() => {
    const bpm = Math.max(0, Math.min(220, hr));
    if (!vitalsActive || bpm <= 0) return 1.2;
    return Math.max(0.35, Math.min(1.6, 60 / bpm));
  })();

  const avgHeartPeriodSeconds = (() => {
    const bpm = Math.max(0, Math.min(220, avgHr));
    if (!monthlyAverage || bpm <= 0) return 1.25;
    return Math.max(0.4, Math.min(1.8, 60 / bpm));
  })();

  const hrLabel = hr === 0 ? 'Sin datos' : hr < 60 ? 'Bajo' : hr > 100 ? 'Alto' : 'Normal';
  const bpLabel = sys === 0 && dia === 0 ? 'Sin datos' : sys > 140 || dia > 90 ? 'Alta' : sys < 90 || dia < 60 ? 'Baja' : 'Normal';
  const tempLabel = temp === 0 ? 'Sin datos' : temp > 37.5 ? 'Fiebre' : temp < 35 ? 'Baja' : 'Normal';
  const glucLabel = gluc === 0 ? 'Sin datos' : gluc > 140 ? 'Alta' : gluc < 70 ? 'Baja' : 'Normal';

  const bpNeedleDeg = (() => {
    if (!vitalsActive || !sys) return -70;
    const clamped = Math.max(70, Math.min(180, sys));
    const t = (clamped - 70) / (180 - 70);
    return -90 + t * 180;
  })();

  const avgBpNeedleDeg = (() => {
    if (!monthlyAverage || !avgSys) return -70;
    const clamped = Math.max(70, Math.min(180, avgSys));
    const t = (clamped - 70) / (180 - 70);
    return -90 + t * 180;
  })();

  const tempFillPct = (() => {
    if (!vitalsActive || !temp) return 0;
    const clamped = Math.max(34, Math.min(40, temp));
    return ((clamped - 34) / (40 - 34)) * 100;
  })();

  const avgTempFillPct = (() => {
    if (!monthlyAverage || !avgTemp) return 0;
    const clamped = Math.max(34, Math.min(40, avgTemp));
    return ((clamped - 34) / (40 - 34)) * 100;
  })();

  const glucFillPct = (() => {
    if (!vitalsActive || !gluc) return 0;
    const clamped = Math.max(50, Math.min(220, gluc));
    return ((clamped - 50) / (220 - 50)) * 100;
  })();

  const avgGlucFillPct = (() => {
    if (!monthlyAverage || !avgGluc) return 0;
    const clamped = Math.max(50, Math.min(220, avgGluc));
    return ((clamped - 50) / (220 - 50)) * 100;
  })();

  return (
    <PatientLayout>
      <Helmet>
        <title>Mi Salud - Dashboard</title>
      </Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className={`${hasAlerts ? 'bg-gradient-to-r from-red-600 to-red-800' : 'bg-gradient-to-r from-teal-600 to-teal-800'} rounded-2xl p-8 text-white shadow-lg`}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Hola, {patientData.name?.split(' ')[0]}</h1>
              <p className={`${hasAlerts ? 'text-red-100' : 'text-teal-100'} mt-2`}>
                {hasAlerts ? '⚠️ Alertas de salud detectadas' : 'Bienvenido a tu portal de salud'}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2 rounded-lg ${hasAlerts ? 'bg-red-700 hover:bg-red-600' : 'bg-teal-700 hover:bg-teal-600'}`}
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* No Data Warning */}
        {hasNoData && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-800">Registra tus signos vitales</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Comienza a monitorear tu salud
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/patient/health')}
                className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Registrar
              </button>
            </div>
          </div>
        )}

        {/* Health Alerts */}
        {hasAlerts && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800">Alertas de Salud</h3>
                <ul className="mt-2 space-y-1">
                  {healthStatus.alerts.map((alert, idx) => (
                    <li key={idx} className="text-sm text-red-700">• {alert}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="flex items-center space-x-4 mb-6">
              <div className={`${hasAlerts ? 'bg-red-100' : 'bg-teal-100'} p-3 rounded-full`}>
                <User className={`h-6 w-6 ${hasAlerts ? 'text-red-700' : 'text-teal-700'}`} />
              </div>
              <div>
                <h3 className="font-semibold">Mis Datos</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  healthStatus.status === 'Saludable' 
                    ? 'bg-green-100 text-green-700'
                    : healthStatus.status === 'Sin datos'
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {healthStatus.status}
                </span>
              </div>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2"/> 
                {calculateAge(patientData.birthdate) || '--'} Años
              </div>
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2"/> 
                {patientData.address || 'No especificada'}
              </div>
              <div className="flex items-center">
                <Activity className="h-4 w-4 mr-2"/> 
                {patientData.program || 'No asignado'}
              </div>
            </div>
          </div>

          {/* Latest Vital Signs */}
          <div className="bg-white p-6 rounded-xl shadow-sm border md:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold flex items-center">
                <Heart className="h-5 w-5 text-red-500 mr-2" />
                Últimos Signos Vitales
              </h3>
              <span className="text-xs text-gray-400">
                {latestVitals && !hasNoData ? new Date(latestVitals.fecha).toLocaleDateString() : 'Sin registros'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="relative min-h-[140px] overflow-hidden rounded-xl border border-pink-100 bg-gradient-to-br from-pink-50 via-white to-pink-100/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Ritmo Cardíaco</p>
                    <div className="mt-1 flex items-end gap-2">
                      <p className="text-xl font-bold text-pink-700 tabular-nums">
                        {hr} <span className="text-sm font-semibold text-pink-500">bpm</span>
                      </p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        hrLabel === 'Normal'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : hrLabel === 'Sin datos'
                          ? 'bg-gray-50 text-gray-600 border-gray-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {hrLabel}
                      </span>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-full">
                    <motion.div
                      className="absolute -inset-2 rounded-full bg-pink-300/30 blur-md"
                      animate={
                        reduceMotion || !vitalsActive
                          ? { opacity: 0.25 }
                          : { opacity: [0.15, 0.35, 0.15] }
                      }
                      transition={
                        reduceMotion || !vitalsActive
                          ? undefined
                          : { duration: heartPeriodSeconds, repeat: Infinity, ease: 'easeInOut' }
                      }
                    />
                    <motion.div
                      className="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-pink-200"
                      animate={
                        reduceMotion || !vitalsActive
                          ? { scale: 1 }
                          : { scale: [1, 1.08, 1] }
                      }
                      transition={
                        reduceMotion || !vitalsActive
                          ? undefined
                          : { duration: heartPeriodSeconds, repeat: Infinity, ease: 'easeInOut' }
                      }
                    >
                      <HeartPulse className="h-5 w-5 text-pink-600" />
                    </motion.div>
                  </div>
                </div>

                <div className="mt-3 flex items-end gap-1">
                  {Array.from({ length: 18 }).map((_, i) => {
                    const base = 20 + ((i * 37) % 55);
                    const active = vitalsActive && hr > 0;
                    const intensity = hrLabel === 'Normal' ? 1 : hrLabel === 'Sin datos' ? 0.4 : 1.2;
                    return (
                      <motion.div
                        key={i}
                        className="w-1 rounded-full bg-pink-400/70"
                        style={{ height: `${base}%` }}
                        animate={
                          reduceMotion || !active
                            ? { opacity: 0.35 }
                            : { opacity: [0.25, 1, 0.25] }
                        }
                        transition={
                          reduceMotion || !active
                            ? undefined
                            : {
                              duration: Math.max(0.6, heartPeriodSeconds * 1.4),
                              repeat: Infinity,
                              delay: (i * 0.03) / intensity,
                              ease: 'easeInOut'
                            }
                        }
                      />
                    );
                  })}
                </div>
              </div>

              <div className="relative min-h-[140px] overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-100/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Presión</p>
                    <div className="mt-1 flex items-end gap-2">
                      <p className="text-xl font-bold text-blue-700 tabular-nums">
                        {sys}/{dia}
                      </p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        bpLabel === 'Normal'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : bpLabel === 'Sin datos'
                          ? 'bg-gray-50 text-gray-600 border-gray-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {bpLabel}
                      </span>
                    </div>
                  </div>

                  <div className="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-blue-200">
                    <Gauge className="h-5 w-5 text-blue-600" />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="relative h-10 w-20">
                    <div className="absolute inset-x-0 bottom-0 h-10 overflow-hidden rounded-t-full border border-blue-200 bg-white/70">
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            'conic-gradient(from 180deg, rgba(34,197,94,0.45), rgba(59,130,246,0.45), rgba(239,68,68,0.45))'
                        }}
                      />
                      <div className="absolute inset-0 bg-white/55" />
                    </div>
                    <motion.div
                      className="absolute left-1/2 bottom-1 h-9 w-0.5 origin-bottom rounded-full bg-blue-700 shadow-sm"
                      style={{ translateX: '-50%' }}
                      animate={reduceMotion ? { rotate: bpNeedleDeg } : { rotate: bpNeedleDeg }}
                      transition={reduceMotion ? undefined : { type: 'spring', stiffness: 140, damping: 18 }}
                    />
                    <div className="absolute left-1/2 bottom-0 h-2 w-2 -translate-x-1/2 rounded-full bg-blue-700" />
                  </div>

                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500"
                        animate={
                          reduceMotion || !vitalsActive
                            ? { width: `${Math.max(0, Math.min(100, ((sys - 70) / (180 - 70)) * 100))}%` }
                            : { width: `${Math.max(0, Math.min(100, ((sys - 70) / (180 - 70)) * 100))}%` }
                        }
                        transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                      <span>70</span>
                      <span>180</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative min-h-[140px] overflow-hidden rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-100/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Temperatura</p>
                    <div className="mt-1 flex items-end gap-2">
                      <p className="text-xl font-bold text-orange-700 tabular-nums">
                        {temp} <span className="text-sm font-semibold text-orange-500">°C</span>
                      </p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        tempLabel === 'Normal'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : tempLabel === 'Sin datos'
                          ? 'bg-gray-50 text-gray-600 border-gray-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {tempLabel}
                      </span>
                    </div>
                  </div>

                  <div className="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-orange-200">
                    <Thermometer className="h-5 w-5 text-orange-600" />
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="relative h-14 w-7 overflow-hidden rounded-full border border-orange-200 bg-white/75 p-1">
                    <div className="absolute bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-orange-500 shadow-sm" />
                    <motion.div
                      className="absolute bottom-2 left-1/2 w-2 -translate-x-1/2 rounded-full bg-gradient-to-t from-orange-500 to-red-500"
                      animate={{ height: `${Math.max(10, (tempFillPct / 100) * 42)}px` }}
                      transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
                      style={{ height: `${Math.max(10, (tempFillPct / 100) * 42)}px` }}
                    />
                    {!reduceMotion && vitalsActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)' }}
                        animate={{ x: ['-120%', '120%'] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"
                        animate={{ width: `${tempFillPct}%` }}
                        transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
                        style={{ width: `${tempFillPct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                      <span>34°</span>
                      <span>40°</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative min-h-[140px] overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-fuchsia-100/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Glucometría</p>
                    <div className="mt-1 flex items-end gap-2">
                      <p className="text-xl font-bold text-purple-700 tabular-nums">
                        {gluc} <span className="text-sm font-semibold text-purple-500">mg/dL</span>
                      </p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        glucLabel === 'Normal'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : glucLabel === 'Sin datos'
                          ? 'bg-gray-50 text-gray-600 border-gray-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {glucLabel}
                      </span>
                    </div>
                  </div>

                  <motion.div
                    className="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-purple-200"
                    animate={
                      reduceMotion || !vitalsActive
                        ? { y: 0 }
                        : { y: [0, -2, 0] }
                    }
                    transition={
                      reduceMotion || !vitalsActive
                        ? undefined
                        : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                    }
                  >
                    <Droplet className="h-5 w-5 text-purple-600" />
                  </motion.div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full">
                    <motion.div
                      className="absolute inset-0 rounded-full bg-purple-300/35 blur-md"
                      animate={
                        reduceMotion || !vitalsActive
                          ? { opacity: 0.2 }
                          : { opacity: [0.1, 0.35, 0.1] }
                      }
                      transition={
                        reduceMotion || !vitalsActive
                          ? undefined
                          : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                      }
                    />
                    <div className="absolute inset-0 rounded-full border border-purple-200 bg-white/70" />
                    <motion.div
                      className="absolute inset-1 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500"
                      animate={{ scale: vitalsActive && !reduceMotion ? [0.98, 1.02, 0.98] : 1 }}
                      transition={vitalsActive && !reduceMotion ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
                      style={{ clipPath: `inset(${100 - glucFillPct}% 0 0 0 round 999px)` }}
                    />
                  </div>

                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-purple-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500"
                        animate={{ width: `${glucFillPct}%` }}
                        transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
                        style={{ width: `${glucFillPct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                      <span>50</span>
                      <span>220</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Average */}
        {monthlyAverage && !hasNoData && (
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-semibold mb-6 flex items-center">
              <Activity className="h-5 w-5 text-teal-500 mr-2" />
              Promedio Mensual
            </h3>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="relative min-h-[120px] overflow-hidden rounded-xl border border-pink-100 bg-gradient-to-br from-pink-50 via-white to-pink-100/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Ritmo Cardíaco</p>
                    <p className="mt-1 text-xl font-bold text-pink-700 tabular-nums">
                      {avgHr} <span className="text-sm font-semibold text-pink-500">bpm</span>
                    </p>
                  </div>
                  <div className="relative overflow-hidden rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-pink-200">
                    <motion.div
                      className="absolute inset-0 bg-pink-300/25 blur-md"
                      animate={
                        reduceMotion
                          ? { opacity: 0.2 }
                          : { opacity: [0.12, 0.28, 0.12] }
                      }
                      transition={
                        reduceMotion
                          ? undefined
                          : { duration: avgHeartPeriodSeconds, repeat: Infinity, ease: 'easeInOut' }
                      }
                    />
                    <motion.div
                      className="relative"
                      animate={reduceMotion ? { scale: 1 } : { scale: [1, 1.06, 1] }}
                      transition={reduceMotion ? undefined : { duration: avgHeartPeriodSeconds, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <HeartPulse className="h-5 w-5 text-pink-600" />
                    </motion.div>
                  </div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-pink-100">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-red-500"
                    animate={{ width: `${Math.max(0, Math.min(100, (avgHr / 140) * 100))}%` }}
                    transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
                    style={{ width: `${Math.max(0, Math.min(100, (avgHr / 140) * 100))}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                  <span>0</span>
                  <span>140</span>
                </div>
              </div>

              <div className="relative min-h-[120px] overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-100/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Presión</p>
                    <p className="mt-1 text-xl font-bold text-blue-700 tabular-nums">
                      {avgSys}/{avgDia}
                    </p>
                  </div>
                  <div className="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-blue-200">
                    <Gauge className="h-5 w-5 text-blue-600" />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="relative h-10 w-20">
                    <div className="absolute inset-x-0 bottom-0 h-10 overflow-hidden rounded-t-full border border-blue-200 bg-white/70">
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            'conic-gradient(from 180deg, rgba(34,197,94,0.45), rgba(59,130,246,0.45), rgba(239,68,68,0.45))'
                        }}
                      />
                      <div className="absolute inset-0 bg-white/55" />
                    </div>
                    <motion.div
                      className="absolute left-1/2 bottom-1 h-9 w-0.5 origin-bottom rounded-full bg-blue-700 shadow-sm"
                      style={{ translateX: '-50%' }}
                      animate={{ rotate: avgBpNeedleDeg }}
                      transition={reduceMotion ? undefined : { type: 'spring', stiffness: 140, damping: 18 }}
                    />
                    <div className="absolute left-1/2 bottom-0 h-2 w-2 -translate-x-1/2 rounded-full bg-blue-700" />
                  </div>

                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500"
                        animate={{ width: `${Math.max(0, Math.min(100, ((avgSys - 70) / (180 - 70)) * 100))}%` }}
                        transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
                        style={{ width: `${Math.max(0, Math.min(100, ((avgSys - 70) / (180 - 70)) * 100))}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                      <span>70</span>
                      <span>180</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative min-h-[120px] overflow-hidden rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-100/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Temperatura</p>
                    <p className="mt-1 text-xl font-bold text-orange-700 tabular-nums">
                      {avgTemp} <span className="text-sm font-semibold text-orange-500">°C</span>
                    </p>
                  </div>
                  <div className="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-orange-200">
                    <Thermometer className="h-5 w-5 text-orange-600" />
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="relative h-14 w-7 overflow-hidden rounded-full border border-orange-200 bg-white/75 p-1">
                    <div className="absolute bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-orange-500 shadow-sm" />
                    <motion.div
                      className="absolute bottom-2 left-1/2 w-2 -translate-x-1/2 rounded-full bg-gradient-to-t from-orange-500 to-red-500"
                      animate={{ height: `${Math.max(10, (avgTempFillPct / 100) * 42)}px` }}
                      transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
                      style={{ height: `${Math.max(10, (avgTempFillPct / 100) * 42)}px` }}
                    />
                  </div>

                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"
                        animate={{ width: `${avgTempFillPct}%` }}
                        transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
                        style={{ width: `${avgTempFillPct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                      <span>34°</span>
                      <span>40°</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative min-h-[120px] overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-fuchsia-100/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Glucometría</p>
                    <p className="mt-1 text-xl font-bold text-purple-700 tabular-nums">
                      {avgGluc} <span className="text-sm font-semibold text-purple-500">mg/dL</span>
                    </p>
                  </div>
                  <motion.div
                    className="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-purple-200"
                    animate={
                      reduceMotion
                        ? { y: 0 }
                        : { y: [0, -2, 0] }
                    }
                    transition={
                      reduceMotion
                        ? undefined
                        : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                    }
                  >
                    <Droplet className="h-5 w-5 text-purple-600" />
                  </motion.div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full">
                    <div className="absolute inset-0 rounded-full border border-purple-200 bg-white/70" />
                    <motion.div
                      className="absolute inset-1 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500"
                      style={{ clipPath: `inset(${100 - avgGlucFillPct}% 0 0 0 round 999px)` }}
                      animate={reduceMotion ? undefined : { scale: [0.99, 1.01, 0.99] }}
                      transition={reduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>

                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-purple-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500"
                        animate={{ width: `${avgGlucFillPct}%` }}
                        transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
                        style={{ width: `${avgGlucFillPct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                      <span>50</span>
                      <span>220</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PatientLayout>
  );
};

export default PatientDashboard;
