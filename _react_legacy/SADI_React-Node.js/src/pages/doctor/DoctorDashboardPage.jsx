import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { 
  getDoctorLifeCourseTheme, 
  formatCursosVidaLabel, 
  CURSO_VIDA_CONFIG 
} from '@/services/cursoVidaConfig';
import { isPatientAssignedToDoctor } from './doctorUtils';

const DoctorDashboardPage = () => {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const lastProfileSyncRef = useRef(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Sincronizar sesión del doctor con public.staff (evitando bucle por re-render)
      const now = Date.now();
      if (refreshProfile && now - lastProfileSyncRef.current > 2000) {
        lastProfileSyncRef.current = now;
        await refreshProfile();
      }

      // 1. Obtener perfil del doctor desde Supabase / Servicio
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
        area_3280: 'Sin Asignación',
        cursos_vida_asignados: user?.cursos_vida_asignados || [],
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
      const myAlerts = (allAlerts || []).filter(a => myPatients.some(p => p.patient_id === a.patient_id || p.id === a.patient_id));
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

  const theme = useMemo(() => {
    return getDoctorLifeCourseTheme(doctorProfile?.cursos_vida_asignados);
  }, [doctorProfile?.cursos_vida_asignados]);

  const cursosLabel = useMemo(() => {
    return formatCursosVidaLabel(doctorProfile?.cursos_vida_asignados);
  }, [doctorProfile?.cursos_vida_asignados]);

  const isSinAsignacion = useMemo(() => {
    return !doctorProfile?.cursos_vida_asignados || doctorProfile.cursos_vida_asignados.length === 0;
  }, [doctorProfile?.cursos_vida_asignados]);

  return (
    <Layout>
      <Helmet>
        <title>Mi Panel Clínico - SADI Portal Médico</title>
      </Helmet>

      <div className="space-y-6">
        {/* Banner de Bienvenida y Perfil Clínico con Color Psicológico del Curso de Vida */}
        <div className={`bg-gradient-to-r ${theme.gradient} rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden transition-all duration-300 border ${theme.bannerBorder || 'border-white/10'}`}>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-semibold text-white/90 mb-3 border border-white/20">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span>Portal Médico Especializado • Resolución 3280</span>
                <span className="bg-black/25 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                  {isSinAsignacion ? '⚪ Sin Asignación' : `● ${cursosLabel}`}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                {doctorProfile?.name || user?.nombre}
              </h1>
              <p className="text-white/90 text-sm mt-1 max-w-xl font-medium">
                {doctorProfile?.specialty || user?.doctor_specialty || 'Atención Primaria y Demanda 3280'} •{' '}
                <span className="font-extrabold underline decoration-white/40">
                  {isSinAsignacion ? 'Sin Asignación' : cursosLabel}
                </span>
              </p>
              {doctorProfile?.registro_medico && (
                <p className="text-xs text-white/80 mt-1">
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
                className="bg-white/15 hover:bg-white/25 text-white border-white/30 rounded-xl text-xs backdrop-blur-md"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Actualizar Datos
              </Button>
            </div>
          </div>
        </div>

        {/* Notificación informativa si el doctor está Sin Asignación */}
        {isSinAsignacion && (
          <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Estado Actual: Sin Curso de Vida Asignado</h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Actualmente tu usuario no tiene asignado ningún Curso de Vida en la plataforma (0 pacientes).
                Una vez la administración asigne tu Curso de Vida en el módulo de personal, este panel adoptará automáticamente su color oficial y se habilitará el acceso a tu población asignada.
              </p>
            </div>
          </div>
        )}

        {/* Tarjetas KPI Médicas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mis Pacientes</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{assignedPatients.length}</p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                {assignedPatients.length === 0 ? '0 bajo custodia' : 'Bajo su custodia'}
              </p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/doctor/patients"
            className="group bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Mis Pacientes</h3>
                <p className="text-xs text-gray-500">{assignedPatients.length} pacientes</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </Link>

          <Link
            to="/ivr-schedule"
            className="group bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:border-amber-300 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Cronograma 3280</h3>
                <p className="text-xs text-gray-500">Roadmap IVR y llamadas</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-amber-600 transition-colors" />
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
                <h3 className="font-bold text-gray-900 text-sm">Telemonitoreo</h3>
                <p className="text-xs text-gray-500">Signos y equipos caseros</p>
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
                <h3 className="font-bold text-gray-900 text-sm">Historias 3280</h3>
                <p className="text-xs text-gray-500">Expedientes clínicos</p>
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

          {assignedPatients.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No hay pacientes asignados bajo su custodia</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {isSinAsignacion 
                  ? 'Su cuenta se encuentra actualmente en estado "Sin Asignación". Espere a que la coordinación le asigne un Curso de Vida.'
                  : 'No se encontraron pacientes para su Curso de Vida asignado en este momento.'}
              </p>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </Layout>
  );
};

export default DoctorDashboardPage;
