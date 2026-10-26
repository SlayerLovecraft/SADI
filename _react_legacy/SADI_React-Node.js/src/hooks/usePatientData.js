// ============================================
//  usePatientData.js - VERSIÓN CORREGIDA
// ============================================
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export const usePatientData = () => {
  const { user } = useAuth();
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPatientData = async () => {
    console.log('🔍 usePatientData - Iniciando...');
    
    // Si no hay usuario o no es paciente, no hacer nada
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      setError('No hay sesión activa');
      setPatientData(null);
      setLoading(false);
      return;
    }

    if (user.role !== 'patient') {
      console.log('❌ Usuario no es paciente, rol:', user.role);
      setError('El usuario no es un paciente');
      setPatientData(null);
      setLoading(false);
      return;
    }

    console.log('✅ Usuario paciente detectado:', user.email);

    try {
      setLoading(true);
      setError(null);

      // Buscar el paciente completo en la BD usando el patient_id
      console.log('🔍 Buscando paciente con ID:', user.id);
      
      const { data: patients, error: dbError } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_id', user.id);

      if (dbError) {
        console.error('❌ Error de BD:', dbError);
        throw dbError;
      }

      // Verificar que se encontró al menos un paciente
      if (!patients || patients.length === 0) {
        throw new Error('No se encontró el perfil del paciente');
      }

      // Tomar el primer paciente del array
      const patient = patients[0];
      
      console.log('✅ Paciente encontrado:', patient.name);
      setPatientData(patient);
      setError(null);

    } catch (err) {
      console.error('❌ Error cargando datos del paciente:', err);
      setError(err.message || 'Error al cargar datos del paciente');
      setPatientData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, [user]);

  return {
    patientData,
    loading,
    error,
    refetch: fetchPatientData
  };
};