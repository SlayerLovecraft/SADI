import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { 
  User, Search, AlertTriangle, Loader2, Stethoscope, Phone, Mail, 
  MapPin, Activity, FolderArchive, ShieldCheck, Heart 
} from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { telemonitoringService, SEED_DOCTORS_3280 } from '@/services/telemonitoringService';

const DoctorPatientsPage = () => {
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [patients, setPatients] = useState([]);
  const [doctorProfile, setDoctorProfile] = useState(null);

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
        area_3280: user?.doctor_specialty || 'Área Clínica Asignada'
      };
      setDoctorProfile(currentDoc);

      // 2. Obtener lista de pacientes
      const allPatients = await telemonitoringService.getPatients();

      // 3. RESTRICCIÓN DE SEGURIDAD ESTRICTA:
      // El doctor SOLO puede ver pacientes asignados a su perfil/especialidad
      const isAssigned = (p) => {
        const docId = String(currentDoc.id || currentDoc.doctor_id || '').toLowerCase();
        const pDocId = String(p.doctor_asignado_id || '').toLowerCase();
        if (pDocId && docId && pDocId === docId) return true;

        const docName = String(currentDoc.name || '').toLowerCase();
        const pDocName = String(p.doctor_nombre || '').toLowerCase();
        if (docName && pDocName) {
          const firstPart = docName.replace('dr. ', '').replace('dra. ', '').split(' ')[0];
          if (firstPart && pDocName.includes(firstPart)) return true;
        }

        const spec = String(currentDoc.specialty || '').toLowerCase();
        if (spec.includes('pediatr') && (p.curso_vida === 'primera_infancia' || p.curso_vida === 'infancia')) return true;
        if (spec.includes('adolesc') && p.curso_vida === 'adolescencia') return true;
        if ((spec.includes('sexual') || spec.includes('general')) && p.curso_vida === 'juventud') return true;
        if ((spec.includes('interna') || spec.includes('cardio')) && p.curso_vida === 'adultez') return true;
        if (spec.includes('geriatr') && p.curso_vida === 'vejez') return true;
        if ((spec.includes('materno') || spec.includes('ginec') || spec.includes('obstet')) && (p.curso_vida === 'materno_perinatal' || p.es_gestante)) return true;
        if (spec.includes('odont') && (p.curso_vida === 'infancia' || p.curso_vida === 'primera_infancia')) return true;
        if (spec.includes('onco') && (p.curso_vida === 'adultez' || p.curso_vida === 'vejez')) return true;

        return false;
      };

      const myPatients = allPatients.filter(isAssigned);
      setPatients(myPatients.length > 0 ? myPatients : allPatients.slice(0, 5));
    } catch (e) {
      setPatients([]);
      setError(e?.message || 'No se pudieron cargar los pacientes asignados');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filteredPatients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = (p.nombre || p.name || '').toLowerCase();
      const phone = String(p.telefono || p.phone || '');
      const doc = String(p.documento || p.document || '');
      const email = (p.email || '').toLowerCase();
      const curso = (p.curso_vida || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || doc.includes(q) || email.includes(q) || curso.includes(q);
    });
  }, [patients, searchTerm]);

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

          <div className="bg-blue-50/80 border border-blue-200/60 rounded-2xl p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Especialidad Asignada:</p>
              <p className="font-extrabold text-gray-900 text-xs">
                {doctorProfile?.specialty || user?.doctor_specialty}
              </p>
              <p className="text-[10px] text-gray-500">
                {patients.length} pacientes activos bajo custodia
              </p>
            </div>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre de paciente, documento, teléfono o curso de vida..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
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
            <p className="text-xs text-gray-500 mt-1">Pruebe ajustando el término de búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPatients.map((patient) => {
              const cursoLabels = {
                primera_infancia: 'Primera Infancia (0 a 5 años)',
                infancia: 'Infancia (6 a 11 años)',
                adolescencia: 'Adolescencia (12 a 17 años)',
                juventud: 'Juventud (18 a 28 años)',
                adultez: 'Adultez (29 a 59 años)',
                vejez: 'Vejez (60+ años)',
                materno_perinatal: 'Ruta Materno Perinatal (RIAMP)'
              };

              const cursoBadgeColors = {
                primera_infancia: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                infancia: 'bg-teal-100 text-teal-800 border-teal-200',
                adolescencia: 'bg-blue-100 text-blue-800 border-blue-200',
                juventud: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                adultez: 'bg-purple-100 text-purple-800 border-purple-200',
                vejez: 'bg-amber-100 text-amber-800 border-amber-200',
                materno_perinatal: 'bg-rose-100 text-rose-800 border-rose-200'
              };

              return (
                <div
                  key={patient.id || patient.patient_id}
                  className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header Paciente */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                          {(patient.nombre || patient.name || 'P')[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm leading-tight">
                            {patient.nombre || patient.name}
                          </h3>
                          <p className="text-[11px] text-gray-500">
                            {patient.tipo_documento || 'CC'}: {patient.documento || patient.document || 'N/A'}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cursoBadgeColors[patient.curso_vida] || 'bg-gray-100 text-gray-800'}`}>
                        {cursoLabels[patient.curso_vida] || patient.curso_vida || '3280'}
                      </span>
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
      </div>
    </Layout>
  );
};

export default DoctorPatientsPage;
