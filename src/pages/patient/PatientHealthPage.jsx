import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import PatientLayout from '@/layouts/PatientLayout';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { usePatientData } from '@/hooks/usePatientData';
import { supabase } from '@/lib/supabase';
import { Heart, Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PatientHealthPage = () => {
  const { patientData, loading: loadingPatient, error: patientError } = usePatientData();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [submitting, setSubmitting] = useState(false);
  const [existingRecord, setExistingRecord] = useState(null);
  
  const [form, setForm] = useState({
    temperatura: '',
    presion_sistolica: '',
    presion_diastolica: '',
    ritmo_cardiaco: '',
    glucometria: '',
    peso: ''
  });

  const parseOptionalNumber = (value) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    const numberValue = Number(trimmed);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  // Cargar el registro más reciente cuando se obtiene patientData
  useEffect(() => {
    if (patientData?.patient_id) {
      loadLatestVitalSigns();
    }
  }, [patientData]);

  const loadLatestVitalSigns = async () => {
    try {
      // ✅ Para pacientes, usar el patient_id del contexto
      if (!patientData?.patient_id) {
        console.log('⚠️ No hay patient_id disponible');
        return;
      }

      console.log('🔍 Cargando signos vitales para paciente:', patientData.patient_id);

      const { data, error } = await supabase
        .from('signos_vitales')
        .select('*')
        .eq('paciente_id', patientData.patient_id)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error cargando signos vitales:', error);
        return;
      }

      if (data) {
        console.log('📊 Registro existente encontrado:', data);
        setExistingRecord(data);
      } else {
        console.log('📊 No hay registros previos');
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!patientData?.patient_id) {
      toast({
        title: "Error",
        description: "No se pudo identificar tu perfil de paciente",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      console.log('💾 Guardando signos vitales...');
      console.log('👤 Patient ID:', patientData.patient_id);
      console.log('📧 Email:', patientData.email);

      const inputTemperatura = parseOptionalNumber(form.temperatura);
      const inputPresionSistolica = parseOptionalNumber(form.presion_sistolica);
      const inputPresionDiastolica = parseOptionalNumber(form.presion_diastolica);
      const inputRitmoCardiaco = parseOptionalNumber(form.ritmo_cardiaco);
      const inputGlucometria = parseOptionalNumber(form.glucometria);
      const inputPeso = parseOptionalNumber(form.peso);

      const hasAnyInput = [
        inputTemperatura,
        inputPresionSistolica,
        inputPresionDiastolica,
        inputRitmoCardiaco,
        inputGlucometria,
        inputPeso,
      ].some((v) => v !== null);

      if (!hasAnyInput) {
        toast({
          title: "Faltan datos",
          description: "Registra al menos un signo vital para guardar",
          variant: "destructive"
        });
        return;
      }

      const base = existingRecord || {};

      // ✅ Preparar datos - usar el patient_id del contexto directamente
      const vitalSignsData = {
        paciente_id: patientData.patient_id,
        fecha: new Date().toISOString(),
        temperatura: inputTemperatura ?? (typeof base.temperatura === 'number' ? base.temperatura : 0),
        presion_sistolica:
          inputPresionSistolica ?? (typeof base.presion_sistolica === 'number' ? base.presion_sistolica : 0),
        presion_diastolica:
          inputPresionDiastolica ?? (typeof base.presion_diastolica === 'number' ? base.presion_diastolica : 0),
        ritmo_cardiaco: inputRitmoCardiaco ?? (typeof base.ritmo_cardiaco === 'number' ? base.ritmo_cardiaco : 0),
        glucometria: inputGlucometria ?? (typeof base.glucometria === 'number' ? base.glucometria : 0),
        peso: inputPeso ?? (base.peso ?? null)
      };

      console.log('📤 Datos a guardar:', vitalSignsData);

      // Si existe un registro con valores en 0, actualizarlo; si no, crear uno nuevo
      if (existingRecord && 
          existingRecord.temperatura === 0 && 
          existingRecord.ritmo_cardiaco === 0 &&
          existingRecord.glucometria === 0) {
        
        console.log('🔄 Actualizando registro inicial...');
        const { data, error } = await supabase
          .from('signos_vitales')
          .update(vitalSignsData)
          .eq('id', existingRecord.id)
          .eq('paciente_id', patientData.patient_id)
          .select();

        if (error) {
          console.error('❌ Error en UPDATE:', error);
          throw error;
        }
        console.log('✅ Registro actualizado:', data);
      } else {
        console.log('➕ Creando nuevo registro...');
        const { data, error } = await supabase
          .from('signos_vitales')
          .insert([vitalSignsData])
          .select();

        if (error) {
          console.error('❌ Error en INSERT:', error);
          throw error;
        }
        console.log('✅ Nuevo registro creado:', data);
      }

      toast({
        title: "✅ Registro guardado",
        description: "Tus signos vitales han sido registrados exitosamente"
      });

      // Limpiar formulario
      setForm({
        temperatura: '',
        presion_sistolica: '',
        presion_diastolica: '',
        ritmo_cardiaco: '',
        glucometria: '',
        peso: ''
      });

      // Redirigir al dashboard
      setTimeout(() => {
        navigate('/patient/dashboard');
      }, 1500);

    } catch (error) {
      console.error('❌ Error guardando:', error);
      
      let errorMessage = "No se pudieron guardar tus signos vitales";
      
      // Mensajes de error más específicos
      if (error.code === '42501') {
        errorMessage = "Error de permisos. Contacta al administrador.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error al guardar",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Estado de carga
  if (loadingPatient) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto" />
            <p className="mt-4 text-gray-600">Cargando...</p>
          </div>
        </div>
      </PatientLayout>
    );
  }

  // Error o sin datos
  if (patientError || !patientData) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{patientError || 'No se encontraron tus datos'}</p>
            <button 
              onClick={() => navigate('/patient/dashboard')}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <Helmet>
        <title>Mi Salud - Registro Diario</title>
      </Helmet>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-red-100 rounded-full mb-4">
            <Heart className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registro Diario de Salud</h1>
          <p className="text-gray-500">Registra tus signos vitales para un mejor seguimiento</p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="temperatura">Temperatura (°C)</Label>
              <input
                id="temperatura"
                type="number"
                step="0.1"
                value={form.temperatura}
                onChange={e => setForm({...form, temperatura: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Ej: 36.5"
                min="30"
                max="45"
              />
              <p className="text-xs text-gray-500 mt-1">Rango normal: 36.0 - 37.5°C</p>
            </div>

            <div>
              <Label htmlFor="ritmo_cardiaco">Ritmo Cardíaco (bpm)</Label>
              <input
                id="ritmo_cardiaco"
                type="number"
                value={form.ritmo_cardiaco}
                onChange={e => setForm({...form, ritmo_cardiaco: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Ej: 72"
                min="40"
                max="200"
              />
              <p className="text-xs text-gray-500 mt-1">Rango normal: 60 - 100 bpm</p>
            </div>

            <div>
              <Label htmlFor="presion_sistolica">Presión Sistólica (mmHg)</Label>
              <input
                id="presion_sistolica"
                type="number"
                value={form.presion_sistolica}
                onChange={e => setForm({...form, presion_sistolica: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Ej: 120"
                min="60"
                max="250"
              />
              <p className="text-xs text-gray-500 mt-1">Número superior</p>
            </div>

            <div>
              <Label htmlFor="presion_diastolica">Presión Diastólica (mmHg)</Label>
              <input
                id="presion_diastolica"
                type="number"
                value={form.presion_diastolica}
                onChange={e => setForm({...form, presion_diastolica: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Ej: 80"
                min="40"
                max="150"
              />
              <p className="text-xs text-gray-500 mt-1">Número inferior</p>
            </div>

            <div>
              <Label htmlFor="glucometria">Glucometría (mg/dL)</Label>
              <input
                id="glucometria"
                type="number"
                value={form.glucometria}
                onChange={e => setForm({...form, glucometria: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Ej: 90"
                min="40"
                max="500"
              />
              <p className="text-xs text-gray-500 mt-1">Rango normal: 70 - 140 mg/dL</p>
            </div>

            <div>
              <Label htmlFor="peso">Peso (kg)</Label>
              <input
                id="peso"
                type="number"
                step="0.1"
                value={form.peso}
                onChange={e => setForm({...form, peso: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Ej: 70.5"
                min="20"
                max="300"
              />
              <p className="text-xs text-gray-500 mt-1">Opcional</p>
            </div>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm text-blue-800">
              <strong>Importante:</strong> Puedes registrar solo un dato; los demás se mantienen
            </p>
          </div>
          
          <div className="flex gap-4">
            <Button 
              type="button"
              onClick={() => navigate('/patient/dashboard')}
              variant="outline"
              className="flex-1"
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 py-4 bg-teal-600 hover:bg-teal-700"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </div>
        </form>
      </div>
    </PatientLayout>
  );
};

export default PatientHealthPage;
