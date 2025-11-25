import React from 'react';
import { Helmet } from 'react-helmet';
import PatientLayout from '@/layouts/PatientLayout';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PatientHistoryPage = () => {
  const history = [
    { id: 1, date: '2025-11-10', type: 'Consulta General', notes: 'Revisión rutinaria, presión estable.', doctor: 'Dr. Ramírez' },
    { id: 2, date: '2025-10-15', type: 'Examen Laboratorio', notes: 'Cuadro hemático completo.', doctor: 'Lab Central' }
  ];

  return (
    <PatientLayout>
      <Helmet>
        <title>Historia Clínica - SADI</title>
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Historia Clínica</h1>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {history.map((item, i) => (
             <div key={item.id} className={`p-6 ${i !== history.length - 1 ? 'border-b border-gray-100' : ''}`}>
               <div className="flex justify-between items-start">
                 <div className="flex items-start space-x-4">
                   <div className="mt-1">
                     <FileText className="h-5 w-5 text-gray-400" />
                   </div>
                   <div>
                     <h3 className="font-semibold text-gray-900">{item.type}</h3>
                     <p className="text-sm text-gray-500 mb-2">{item.date} - {item.doctor}</p>
                     <p className="text-gray-700 text-sm">{item.notes}</p>
                   </div>
                 </div>
                 <Button variant="ghost" size="sm">
                   <Download className="h-4 w-4 mr-2" /> Descargar
                 </Button>
               </div>
             </div>
          ))}
        </div>
      </div>
    </PatientLayout>
  );
};

export default PatientHistoryPage;