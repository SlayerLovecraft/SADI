import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { 
  User, Search, AlertTriangle, Loader2, Stethoscope, Phone, Mail, 
  MapPin, Activity, FolderArchive, ShieldCheck, Heart, ChevronLeft, ChevronRight 
} from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { telemonitoringService, SEED_DOCTORS_3280 } from '@/services/telemonitoringService';
import { staffService } from '@/services/staffService';
import { getDoctorLifeCourseTheme, formatCursosVidaLabel, canonicalizeCursoKey } from '@/services/cursoVidaConfig';
import { CursoVidaBadge, GruposRiesgoBadges } from '@/components/PatientClinicalBadges';
import { isPatientAssignedToDoctor } from './doctorUtils';

const DoctorPatientsPage = () => {
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const [viewMode, setViewMode] = useState('scope'); // 'scope' | 'direct'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [patients, setPatients] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [scopeTotalCount, setScopeTotalCount] = useState(0);
  const [directTotalCount, setDirectTotalCount] = useState(0);
  const [doctorProfile, setDoctorProfile] = useState(null);

  const theme = useMemo(() => {
    return getDoctorLifeCourseTheme(doctorProfile?.cursos_vida_asignados);
  }, [doctorProfile?.cursos_vida_asignados]);

  const cursosLabel = useMemo(() => {
    return formatCursosVidaLabel(doctorProfile?.cursos_vida_asignados);
  }, [doctorProfile?.cursos_vida_asignados]);

  const isSinAsignacion = useMemo(() => {
    return !doctorProfile?.cursos_vida_asignados || doctorProfile.cursos_vida_asignados.length === 0;
  }, [doctorProfile?.cursos_vida_asignados]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Obtener perfil completo del doctor autenticado
      const doctors = await telemonitoringService.getDoctors();
      const currentDoc = doctors.find(d => 
        (d.email && user?.email && d.email.toLowerCase() === user.email.toLowerCase()) ||
        d.id === user?.id || 
        d.doctor_id === user?.doctor_id
      ) || {
        id: user?.id || user?.doctor_id,
        doctor_id: user?.doctor_id || user?.id,
        name: user?.nombre || 'Dr. Médico Especialista',
        email: user?.email,
        specialty: user?.doctor_specialty || 'Medicina Especializada',
        area_3280: user?.doctor_specialty || 'Área Clínica Asignada',
        cursos_vida_asignados: Array.isArray(user?.cursos_vida_asignados) ? user.cursos_vida_asignados : []
      };
      setDoctorProfile(currentDoc);

      const docCursos = Array.isArray(currentDoc?.cursos_vida_asignados) ? currentDoc.cursos_vida_asignados : [];
      const docId = currentDoc?.doctor_id || currentDoc?.id || null;
      const hospId = currentDoc?.hospital_id || currentDoc?.hospitalId || user?.hospitalId || null;

      // 2. Obtener página y conteos reales desde Postgres RPC (soporta 142k+)
      const [statsRes, pageRes] = await Promise.all([
        staffService.getAssignmentStats(hospId),
        staffService.getAssignedPatientsPaginated({
          doctorId: docId,
          cursos: docCursos,
          hospitalId: hospId,
          search: debouncedSearch,
          mode: viewMode,
          page,
          pageSize,
        }),
      ]);

      if (statsRes?.success) {
        let sTotal = 0;
        if (docCursos.includes('todos')) sTotal = Number(statsRes.totalPatients || 0);
        else {
          const seen = new Set();
          docCursos.forEach((rk) => {
            const ck = canonicalizeCursoKey(rk);
            if (ck && !seen.has(ck)) {
              seen.add(ck);
              sTotal += Number(statsRes.byCurso?.[ck] || 0);
            }
          });
        }
        setScopeTotalCount(sTotal);
        setDirectTotalCount(Number(statsRes.byDoctorDirect?.[String(docId)] || 0));
      }

      if (!pageRes.success) {
        throw new Error(pageRes.error || 'No se pudieron cargar los pacientes asignados');
      }

      setPatients(pageRes.data || []);
      setTotalCount(Number(pageRes.totalCount || 0));
    } catch (e) {
      setPatients([]);
      setTotalCount(0);
      setError(e?.message || 'No se pudieron cargar los pacientes asignados');
    } finally {
      setLoading(false);
    }
  }, [user, debouncedSearch, viewMode, page]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filteredPatients = patients;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <Layout>
      <Helmet>
        <title>Mis Pacientes Asignados - SADI Portal Médico</title>
      </Helmet>

      <div className="space-y-6">
        {/* Cabecera Principal */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest">
              <Stethoscope className="h-4 w-4" />
              Portal Médico • Control y Seguimiento Clínico
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Mis Pacientes Asignados (Res. 3280)
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Acceso exclusivo restringido a pacientes bajo el cuidado de {doctorProfile?.name || user?.nombre}.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-xl text-white flex items-center justify-center font-bold shadow-sm"
              style={{ backgroundColor: theme.colorHex || '#2563EB' }}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Curso de Vida Asignado:</p>
              <p className="font-extrabold text-slate-900 text-xs">
                {isSinAsignacion ? 'Sin Asignación' : cursosLabel}
              </p>
              <p className="text-[10px] text-slate-500">
                {scopeTotalCount.toLocaleString('es-CO')} en curso(s) · {directTotalCount.toLocaleString('es-CO')} asignados 1:1
              </p>
            </div>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre de paciente, documento, teléfono o curso de vida..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => { setViewMode('scope'); setPage(1); }}
              className={`px-3 py-2 rounded-lg transition-all ${viewMode === 'scope' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'}`}
            >
              Por Curso ({scopeTotalCount.toLocaleString('es-CO')})
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('direct'); setPage(1); }}
              className={`px-3 py-2 rounded-lg transition-all ${viewMode === 'direct' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'}`}
            >
              Asignados 1:1 ({directTotalCount.toLocaleString('es-CO')})
            </button>
          </div>
        </div>

        {/* Lista de Tarjetas de Pacientes */}
        {loading ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-gray-100">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">Cargando pacientes asignados...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-bold text-gray-800">No se encontraron pacientes asignados</p>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              {isSinAsignacion 
                ? 'Su usuario se encuentra en estado "Sin Asignación". No cuenta con pacientes bajo su cargo hasta que la administración le asigne un Curso de Vida.'
                : 'No se encontraron pacientes registrados para su Curso de Vida o término de búsqueda.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPatients.map((patient) => {
              return (
                <div
                  key={patient.id || patient.patient_id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header Paciente */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                          {(patient.nombre || patient.name || 'P')[0]}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">
                            {patient.nombre || patient.name}
                          </h3>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400">
                            {patient.tipo_documento || 'CC'}: {patient.documento || patient.document || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Curso de Vida (7 Rutas A-G) y Grupos de Riesgo Reales */}
                    <div className="mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Curso:</span>
                        <CursoVidaBadge patient={patient} />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Riesgo:</span>
                        <GruposRiesgoBadges patient={patient} maxVisible={3} />
                      </div>
                    </div>

                    {/* Dispositivos Caseros de Medición */}
                    {patient.dispositivos_caseros && patient.dispositivos_caseros.length > 0 && (
                      <div className="mb-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 mb-1">
                          <Activity className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Equipos Caseros de Telemonitoreo:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {patient.dispositivos_caseros.map((dev, i) => (
                            <span key={i} className="text-[10px] bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                              📟 {dev}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Datos de contacto y notas */}
                    <div className="space-y-1 text-xs text-gray-600 mb-4">
                      {patient.telefono && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-gray-400" />
                          <span>{patient.telefono}</span>
                        </p>
                      )}
                      {patient.email && (
                        <p className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{patient.email}</span>
                        </p>
                      )}
                      {patient.notas_clinicas && (
                        <p className="text-[11px] text-gray-500 bg-blue-50/50 p-2 rounded-lg italic line-clamp-2 mt-2">
                          "{patient.notas_clinicas}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                    <Link
                      to="/doctor/clinical-records"
                      className="flex-1 py-2 px-3 text-center bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <FolderArchive className="h-3.5 w-3.5" />
                      <span>Expediente</span>
                    </Link>
                    <Link
                      to="/doctor/telemonitoring"
                      className="flex-1 py-2 px-3 text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Activity className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Curvas RPM</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalCount > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              Mostrando{' '}
              <span className="font-bold text-gray-900">
                {((page - 1) * pageSize + 1).toLocaleString('es-CO')}
              </span>
              {' – '}
              <span className="font-bold text-gray-900">
                {Math.min(page * pageSize, totalCount).toLocaleString('es-CO')}
              </span>
              {' de '}
              <span className="font-bold text-blue-600">
                {totalCount.toLocaleString('es-CO')}
              </span>
              {' pacientes asignados'}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="font-bold text-gray-800 px-2">
                Pág. {page.toLocaleString('es-CO')} / {totalPages.toLocaleString('es-CO')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DoctorPatientsPage;
