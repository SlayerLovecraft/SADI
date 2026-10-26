import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Users, Stethoscope, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { isPatientUniquelyAssignedToDoctor, normalizeText } from './doctorUtils';

const DoctorDashboardPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [patientsCount, setPatientsCount] = useState(0);

  const doctorLabel = useMemo(() => {
    const specialty = user?.doctor_specialty || user?.doctorSpecialty || '';
    return specialty ? `Especialidad: ${specialty}` : 'Especialidad: No asignada';
  }, [user?.doctor_specialty, user?.doctorSpecialty]);

  const specialtyKey = useMemo(() => {
    return normalizeText(user?.doctor_specialty || user?.doctorSpecialty || '');
  }, [user?.doctor_specialty, user?.doctorSpecialty]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const normalizedEmail = String(user?.email || '').trim().toLowerCase();
      let effectiveHospitalId = user?.hospitalId || user?.hospital_id || null;
      let effectiveDoctorId = String(user?.doctor_id || user?.id || '').trim();
      let effectiveSpecialtyKey = specialtyKey;

      if ((!effectiveHospitalId || !effectiveDoctorId || !effectiveSpecialtyKey) && normalizedEmail) {
        const { data: staffRow } = await supabase
          .from('staff')
          .select('doctor_id, doctor_specialty, hospital_id, is_active')
          .eq('doctor_email', normalizedEmail)
          .maybeSingle();

        if (staffRow?.is_active === false) {
          setPatientsCount(0);
          setError('Doctor inactivo');
          setLoading(false);
          return;
        }

        if (!effectiveHospitalId && staffRow?.hospital_id) effectiveHospitalId = staffRow.hospital_id;
        if (!effectiveDoctorId && staffRow?.doctor_id) effectiveDoctorId = String(staffRow.doctor_id || '').trim();
        if (!effectiveSpecialtyKey && staffRow?.doctor_specialty) {
          effectiveSpecialtyKey = normalizeText(staffRow.doctor_specialty);
        }
      }

      let query = supabase
        .from('patients')
        .select('patient_id, program, hospital_id');

      if (effectiveHospitalId) {
        query = query.eq('hospital_id', effectiveHospitalId);
      }

      const doctorId = effectiveDoctorId;
      const rosterQuery =
        effectiveHospitalId && effectiveSpecialtyKey
          ? supabase
            .from('staff')
            .select('doctor_id')
            .eq('hospital_id', effectiveHospitalId)
            .eq('doctor_specialty', effectiveSpecialtyKey)
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
      setPatientsCount(assigned.length);
    } catch (e) {
      setPatientsCount(0);
      setError(e?.message || 'No se pudo cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }, [specialtyKey, user]);

  useEffect(() => {
    load();
  }, [load]);

  const roleText = useMemo(() => {
    const specialty = normalizeText(user?.doctor_specialty || user?.doctorSpecialty || '');
    if (!specialty) return 'doctor';
    return `doctor (${specialty})`;
  }, [user?.doctor_specialty, user?.doctorSpecialty]);

  return (
    <Layout>
      <Helmet>
        <title>Dashboard Doctor - SADI</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">{doctorLabel}</p>
            <p className="text-xs text-gray-400 mt-1">{user?.email} · {roleText}</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {error ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pacientes asignados</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {loading ? '...' : patientsCount}
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-full">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Perfil</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {(() => {
                      const name =
                        user?.nombre ||
                        user?.doctor_name ||
                        user?.doctorName ||
                        '';
                      const fallback = user?.email || user?.doctor_email || '';
                      const label = String(name || fallback || '').trim();
                      return label ? `Doctor ${label}` : 'Doctor';
                    })()}
                  </p>
                </div>
                <div className="bg-teal-50 p-3 rounded-full">
                  <Stethoscope className="h-6 w-6 text-teal-600" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DoctorDashboardPage;
