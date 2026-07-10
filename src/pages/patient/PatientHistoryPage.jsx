import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import PatientLayout from '@/layouts/PatientLayout';
import { AlertTriangle, Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePatientData } from '@/hooks/usePatientData';
import { supabase } from '@/lib/supabase';

const PatientHistoryPage = () => {
  const { patientData, loading: loadingPatient, error: patientError } = usePatientData();
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [history, setHistory] = useState([]);

  const downloadRecord = (item) => {
    if (!item) return;
    if (item.attachment_url) {
      window.open(item.attachment_url, '_blank', 'noopener,noreferrer');
      return;
    }

    const text = [
      `Tipo: ${item.record_type || 'Registro clínico'}`,
      `Fecha: ${item.record_date ? new Date(item.record_date).toLocaleDateString('es-CO') : ''}`,
      `Doctor: ${item.doctor_name || ''}`,
      '',
      String(item.notes || '')
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const datePart = item.record_date ? new Date(item.record_date).toISOString().slice(0, 10) : 'sin-fecha';
    a.href = url;
    a.download = `reporte_${datePart}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const patientId = patientData?.patient_id;
    if (!patientId) return;

    const loadHistory = async () => {
      try {
        setLoadingHistory(true);
        setHistoryError(null);

        const { data, error } = await supabase
          .from('clinical_records')
          .select('*')
          .eq('patient_id', patientId)
          .order('record_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        const message = err?.message || '';
        if (message.toLowerCase().includes('clinical_records') && message.toLowerCase().includes('does not exist')) {
          setHistory([]);
          setHistoryError('La historia clínica aún no está configurada en el sistema.');
          return;
        }
        setHistory([]);
        setHistoryError(err?.message || 'Error cargando historia clínica');
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, [patientData?.patient_id]);

  return (
    <PatientLayout>
      <Helmet>
        <title>Historia Clínica - SADI</title>
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Historia Clínica</h1>

        {loadingPatient || loadingHistory ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-teal-600 mx-auto mb-3" />
              <p className="text-gray-600">Cargando historia clínica...</p>
            </div>
          </div>
        ) : patientError || historyError ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
              <div>
                <h2 className="font-semibold text-gray-900">No se pudo cargar tu historia clínica</h2>
                <p className="text-sm text-gray-600 mt-1">{patientError || historyError}</p>
              </div>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <p className="text-gray-600">Aún no hay registros en tu historia clínica.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {history.map((item, i) => (
              <div key={item.id} className={`p-6 ${i !== history.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start space-x-4 min-w-0">
                    <div className="mt-1">
                      <FileText className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900">{item.record_type || 'Registro clínico'}</h3>
                      <p className="text-sm text-gray-500 mb-2">
                        {(item.record_date ? new Date(item.record_date).toLocaleDateString('es-CO') : '')}
                        {item.doctor_name ? ` - ${item.doctor_name}` : ''}
                      </p>
                      <p className="text-gray-700 text-sm break-words">{item.notes || ''}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!item.attachment_url && !item.notes}
                    onClick={() => downloadRecord(item)}
                  >
                    <Download className="h-4 w-4 mr-2" /> Descargar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PatientLayout>
  );
};

export default PatientHistoryPage;
