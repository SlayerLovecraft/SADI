import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import PatientLayout from '@/layouts/PatientLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Activity, Heart, User, Calendar, MapPin } from 'lucide-react';

const PatientDashboard = () => {
  const { user } = useAuth();
  const [patientData, setPatientData] = useState(null);
  const [vitalSigns, setVitalSigns] = useState([]);

  useEffect(() => {
    // Load patient specific data
    const patients = JSON.parse(localStorage.getItem('sadi_patients') || '[]');
    const myself = patients.find(p => p.email === user.email);
    setPatientData(myself);

    const vitals = JSON.parse(localStorage.getItem('sadi_vital_signs') || '[]');
    setVitalSigns(vitals.filter(v => v.patientId === 'p1')); // Using static ID for demo match
  }, [user]);

  if (!patientData) return <div>Cargando...</div>;

  return (
    <PatientLayout>
      <Helmet>
        <title>Mi Salud - Dashboard</title>
      </Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-2xl p-8 text-white shadow-lg">
          <h1 className="text-3xl font-bold">Hola, {patientData.nombre.split(' ')[0]}</h1>
          <p className="text-teal-100 mt-2">Bienvenido a tu portal de salud personal.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-1">
            <div className="flex items-center space-x-4 mb-6">
              <div className="bg-teal-100 p-3 rounded-full">
                <User className="h-6 w-6 text-teal-700" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Mis Datos</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${patientData.estadoSalud === 'Saludable' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {patientData.estadoSalud || 'Activo'}
                </span>
              </div>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center"><Calendar className="h-4 w-4 mr-2"/> {patientData.edad} Años</div>
              <div className="flex items-center"><MapPin className="h-4 w-4 mr-2"/> {patientData.direccion}</div>
              <div className="flex items-center"><Activity className="h-4 w-4 mr-2"/> {patientData.programa}</div>
            </div>
          </div>

          {/* Vital Signs Summary */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
             <div className="flex items-center justify-between mb-6">
               <h3 className="font-semibold text-gray-900 flex items-center">
                 <Heart className="h-5 w-5 text-red-500 mr-2" />
                 Signos Vitales Recientes
               </h3>
               <span className="text-xs text-gray-400">Últimos 5 días</span>
             </div>
             
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               <div className="bg-pink-50 p-4 rounded-lg text-center">
                 <p className="text-xs text-gray-500">Ritmo Cardíaco</p>
                 <p className="text-xl font-bold text-pink-600">{vitalSigns[vitalSigns.length-1]?.heartRate || '--'} bpm</p>
               </div>
               <div className="bg-blue-50 p-4 rounded-lg text-center">
                 <p className="text-xs text-gray-500">Presión</p>
                 <p className="text-xl font-bold text-blue-600">{vitalSigns[vitalSigns.length-1]?.bloodPressure || '--'}</p>
               </div>
               <div className="bg-orange-50 p-4 rounded-lg text-center">
                 <p className="text-xs text-gray-500">Temperatura</p>
                 <p className="text-xl font-bold text-orange-600">{vitalSigns[vitalSigns.length-1]?.temperature || '--'}°C</p>
               </div>
               <div className="bg-purple-50 p-4 rounded-lg text-center">
                 <p className="text-xs text-gray-500">Glucometría</p>
                 <p className="text-xl font-bold text-purple-600">{vitalSigns[vitalSigns.length-1]?.glucometry || '--'}</p>
               </div>
             </div>
          </div>
        </div>

        {/* Simple CSS Graph for Heart Rate */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-6">Tendencia Ritmo Cardíaco</h3>
          <div className="h-48 flex items-end justify-between space-x-2 px-4">
            {vitalSigns.map((sign, i) => (
              <div key={i} className="flex flex-col items-center flex-1 group">
                <div 
                  className="w-full bg-teal-400 rounded-t-md transition-all duration-500 hover:bg-teal-600 relative"
                  style={{ height: `${(sign.heartRate / 120) * 100}%` }}
                >
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {sign.heartRate}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">{sign.date.slice(8)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PatientLayout>
  );
};

export default PatientDashboard;