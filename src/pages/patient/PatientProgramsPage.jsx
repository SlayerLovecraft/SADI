import React from 'react';
import { Helmet } from 'react-helmet';
import PatientLayout from '@/layouts/PatientLayout';
import { Activity, Calendar, ChevronRight } from 'lucide-react';

const PatientProgramsPage = () => {
  const programs = [
    { id: 1, name: 'Control Hipertensión', doctor: 'Dr. Ramírez', nextCheck: '2025-12-01', status: 'Activo' },
    { id: 2, name: 'Nutrición y Dieta', doctor: 'Dra. Solano', nextCheck: '2025-11-28', status: 'Activo' }
  ];

  return (
    <PatientLayout>
      <Helmet>
        <title>Mis Programas - SADI</title>
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis Programas de Salud</h1>
        
        <div className="space-y-4">
          {programs.map(program => (
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
                <div className="flex items-center text-sm text-orange-600 mb-1">
                  <Calendar className="h-4 w-4 mr-1" /> Próxima cita: {program.nextCheck}
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  {program.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PatientLayout>
  );
};

export default PatientProgramsPage;