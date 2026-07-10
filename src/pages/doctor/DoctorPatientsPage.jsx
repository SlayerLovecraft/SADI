import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { AlertTriangle, Loader2, Search, User } from 'lucide-react';
import Layout from '@/components/Layout';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { isPatientUniquelyAssignedToDoctor, normalizeText, programToSpecialty } from './doctorUtils';

const DoctorPatientsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [patients, setPatients] = useState([]);

  const specialtyKey = useMemo(() => {
    return normalizeText(user?.doctor_specialty || user?.doctorSpecialty || '');
  }, [user?.doctor_specialty, user?.doctorSpecialty]);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('patients')
        .select('patient_id, name, phone, email, document, birthdate, sex, city, program, address, hospital_id, created_at')
        .order('created_at', { ascending: false });

      if (user?.hospitalId) {
        query = query.eq('hospital_id', user.hospitalId);
      }

      const doctorId = String(user?.doctor_id || user?.id || '').trim();
      const rosterQuery =
        user?.hospitalId && specialtyKey
          ? supabase
            .from('staff')
            .select('doctor_id')
            .eq('hospital_id', user.hospitalId)
            .eq('doctor_specialty', specialtyKey)
            .eq('is_active', true)
          : null;

      const [{ data: rosterData, error: rosterError }, { data, error: patientsError }] = await Promise.all([
        rosterQuery ? rosterQuery : Promise.resolve({ data: [], error: null }),
        query,
      ]);
      if (patientsError) throw patientsError;
      if (rosterError) throw rosterError;

      const eligibleDoctorIds = (rosterData || []).map((r) => String(r.doctor_id || '').trim()).filter(Boolean);
      if (doctorId && !eligibleDoctorIds.includes(doctorId)) eligibleDoctorIds.push(doctorId);

      const assigned = (data || []).filter((p) => isPatientUniquelyAssignedToDoctor(p, user, eligibleDoctorIds));
      setPatients(assigned);
    } catch (e) {
      setPatients([]);
      setError(e?.message || 'No se pudieron cargar los pacientes');
    } finally {
      setLoading(false);
    }
  }, [specialtyKey, user]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filteredPatients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const phone = String(p.phone || '');
      const city = (p.city || '').toLowerCase();
      const doc = String(p.document || '');
      const email = (p.email || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || city.includes(q) || doc.includes(q) || email.includes(q);
    });
  }, [patients, searchTerm]);

  return (
    <Layout>
      <Helmet>
        <title>Mis Pacientes - SADI</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mis Pacientes</h1>
            <p className="text-gray-500 mt-1">{patients.length} pacientes asignados</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono, ciudad, CC o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-gray-600">Cargando pacientes...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-gray-900">No se pudieron cargar los pacientes</h2>
                  <p className="text-sm text-gray-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {searchTerm ? 'No se encontraron pacientes' : 'No hay pacientes asignados'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.patient_id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{patient.name || 'Paciente'}</p>
                      <p className="text-xs text-gray-400">CC: {patient.document || 'N/A'}</p>
                      <p className="text-xs text-gray-400">Programa: {patient.program || 'Sin programa'}</p>
                      <p className="text-xs text-gray-400">Especialidad: {programToSpecialty(patient.program)}</p>
                    </div>
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

export default DoctorPatientsPage;
