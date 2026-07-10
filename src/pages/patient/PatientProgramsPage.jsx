import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import PatientLayout from '@/layouts/PatientLayout';
import { Activity, AlertTriangle, Calendar, Loader2 } from 'lucide-react';
import { usePatientData } from '@/hooks/usePatientData';
import { supabase } from '@/lib/supabase';

const PatientProgramsPage = () => {
  const { patientData, loading: loadingPatient, error: patientError } = usePatientData();
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [programsError, setProgramsError] = useState(null);
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    const patientId = patientData?.patient_id;
    if (!patientId) return;

    const loadPrograms = async () => {
      try {
        setLoadingPrograms(true);
        setProgramsError(null);

        const { data, error } = await supabase
          .from('patient_programs')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPrograms(data || []);
      } catch (err) {
        const message = err?.message || '';
        if (message.toLowerCase().includes('patient_programs') && message.toLowerCase().includes('does not exist')) {
          setPrograms([]);
          setProgramsError(null);
          return;
        }
        setPrograms([]);
        setProgramsError(err?.message || 'Error cargando programas');
      } finally {
        setLoadingPrograms(false);
      }
    };

    loadPrograms();
  }, [patientData?.patient_id]);

  const programsForUI = useMemo(() => {
    if (programs.length > 0) {
      return programs.map((p) => ({
        id: p.id,
        name: p.program_name || 'Programa',
        doctor: p.doctor_name || 'Sin especialista',
        nextCheck: p.next_check_date || null,
        status: p.status || 'Activo'
      }));
    }

    if (patientData?.program) {
      return [{
        id: patientData.patient_id,
        name: patientData.program,
        doctor: 'Sin especialista',
        nextCheck: null,
        status: 'Activo'
      }];
    }

    return [];
  }, [patientData, programs]);

  return (
    <PatientLayout>
      <Helmet>
        <title>Mis Programas - SADI</title>
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis Programas de Salud</h1>

        {loadingPatient || loadingPrograms ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-teal-600 mx-auto mb-3" />
              <p className="text-gray-600">Cargando programas...</p>
            </div>
          </div>
        ) : patientError || programsError ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
              <div>
                <h2 className="font-semibold text-gray-900">No se pudieron cargar tus programas</h2>
                <p className="text-sm text-gray-600 mt-1">{patientError || programsError}</p>
              </div>
            </div>
          </div>
        ) : programsForUI.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <p className="text-gray-600">Aún no tienes programas asignados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {programsForUI.map(program => (
              <div key={program.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="bg-teal-50 p-3 rounded-full">
                    <Activity className="h-6 w-6 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{program.name}</h3>
                    <p className="text-sm text-gray-500">Especialista: {program.doctor}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center text-sm text-orange-600 mb-1 justify-end">
                    <Calendar className="h-4 w-4 mr-1" />
                    {program.nextCheck ? (
                      <>Próxima cita: {new Date(program.nextCheck).toLocaleDateString('es-CO')}</>
                    ) : (
                      <>Sin cita programada</>
                    )}
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    {program.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PatientLayout>
  );
};

export default PatientProgramsPage;
