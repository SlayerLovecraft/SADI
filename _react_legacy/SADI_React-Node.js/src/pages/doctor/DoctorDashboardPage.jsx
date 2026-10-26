import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { 
  Users, Stethoscope, RefreshCw, Activity, FolderArchive, CalendarDays, 
  ShieldCheck, AlertTriangle, ChevronRight, Phone, CheckCircle2, HeartPulse, HardDrive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { telemonitoringService, SEED_DOCTORS_3280 } from '@/services/telemonitoringService';
import { isPatientAssignedToDoctor } from './doctorUtils';

const DoctorDashboardPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [alertsCount, setAlertsCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Obtener perfil del doctor
      const doctors = await telemonitoringService.getDoctors();
      const currentDoc = doctors.find(d => 
        (d.email && user?.email && d.email.toLowerCase() === user.email.toLowerCase()) ||
        d.id === user?.id || 
        d.doctor_id === user?.doctor_id
      ) || {
        id: user?.id || user?.doctor_id,
        doctor_id: user?.doctor_id || user?.id,
        name: user?.nombre || 'Dr. Especialista SADI',
        email: user?.email,
        specialty: user?.doctor_specialty || 'Medicina Especializada',
        area_3280: user?.doctor_specialty || 'Área Clínica Asignada',
        telefono: '+57 300 000 0000',
        registro_medico: 'RM-SADI-3280'
      };
      setDoctorProfile(currentDoc);

      // 2. Obtener pacientes asignados (Estricto 1 a 1 según Resolución 3280, sin fallbacks cruzados)
      const allPatients = await telemonitoringService.getPatients();
      const myPatients = allPatients.filter(p => isPatientAssignedToDoctor(p, currentDoc));
      setAssignedPatients(myPatients);

      // 3. Alertas de estos pacientes
      const allAlerts = await telemonitoringService.getAlerts();
      const myAlerts = (allAlerts || []).filter(a => finalPatients.some(p => p.patient_id === a.patient_id || p.id === a.patient_id));
      setAlertsCount(myAlerts.length);

    } catch (e) {
      setError(e?.message || 'Error cargando panel del doctor');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deviceCount = useMemo(() => {
    return assignedPatients.filter(p => p.dispositivos_caseros && p.dispositivos_caseros.length > 0).length;
  }, [assignedPatients]);

  return (
    <Layout>
      <Helmet>
        <title>Mi Panel Clínico - SADI Portal Médico</title>
      </Helmet>

      <div className="space-y-6">
        {/* Banner de Bienvenida y Perfil Clínico */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-blue-100 mb-3 border border-white/20">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Portal Médico Especializado • Resolución 3280</span>
                <span className="bg-emerald-500/30 text-emerald-200 px-2 py-0.2 rounded-full text-[10px]">
                  🔒 Restringido
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black">
                {doctorProfile?.name || user?.nombre}
              </h1>
              <p className="text-blue-100 text-sm mt-1 max-w-xl">
                {doctorProfile?.specialty || user?.doctor_specialty} • {doctorProfile?.area_3280 || 'Atención Primaria en Salud'}
              </p>
              {doctorProfile?.registro_medico && (
                <p className="text-xs text-blue-200 mt-0.5">
                  Registro Médico: <span className="font-semibold text-white">{doctorProfile.registro_medico}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="bg-white/10 hover:bg-white/20 text-white border-white/30 rounded-xl text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Actualizar Datos
              </Button>
            </div>
          </div>
        </div>

        {/* Tarjetas KPI Médicas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mis Pacientes</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{assignedPatients.length}</p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Bajo su custodia</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Telemonitoreo</p>
              <p className="text-2xl font-black text-indigo-600 mt-1">{deviceCount}</p>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">Con equipos caseros</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Activity className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Alertas Clínicas</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{alertsCount}</p>
              <p className="text-[11px] text-rose-600 font-medium mt-0.5">En su población asignada</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <HeartPulse className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Expedientes 3280</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{assignedPatients.length}</p>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Historias habilitadas</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <FolderArchive className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Accesos Rápidos a Módulos Médicos Autorizados */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/doctor/patients"
            className="group bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Mis Pacientes Asignados</h3>
                <p className="text-xs text-gray-500">Listado, datos de contacto y cursos 3280</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </Link>

          <Link
            to="/doctor/telemonitoring"
            className="group bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Telemonitoreo & Signos Vitales</h3>
                <p className="text-xs text-gray-500">Curvas de evolución de equipos caseros</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
          </Link>

          <Link
            to="/doctor/clinical-records"
            className="group bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <FolderArchive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Historias Clínicas 3280</h3>
                <p className="text-xs text-gray-500">Expedientes multiformato y carga segura</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
          </Link>
        </div>

        {/* Tabla / Lista de Pacientes Asignados Recientes */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Población Asignada a {doctorProfile?.name || 'su perfil'}
              </h2>
              <p className="text-xs text-gray-500">
                Solo usted tiene acceso de edición y gestión clínica sobre estos pacientes
              </p>
            </div>
            <Link
              to="/doctor/patients"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Ver todos ({assignedPatients.length}) <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {assignedPatients.slice(0, 6).map((patient) => (
              <div key={patient.id || patient.patient_id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0">
                    {(patient.nombre || patient.name || 'P')[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">
                      {patient.nombre || patient.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {patient.tipo_documento || 'CC'}: {patient.documento || patient.document} • {patient.telefono || 'Sin teléfono'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to="/doctor/clinical-records"
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs rounded-lg transition-colors"
                  >
                    Expediente
                  </Link>
                  <Link
                    to="/doctor/telemonitoring"
                    className="px-3 py-1.5 bg-gray-50 text-gray-700 hover:bg-gray-100 font-semibold text-xs rounded-lg transition-colors"
                  >
                    Signos
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DoctorDashboardPage;
