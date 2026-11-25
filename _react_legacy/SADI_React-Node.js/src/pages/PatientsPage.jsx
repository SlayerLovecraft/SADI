// ============================================
// src/pages/PatientsPage.jsx - USANDO EDGE FUNCTION
// ============================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import CSVUploadDialog from '@/components/CSVUploadDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Plus, User, Users, Phone, MapPin, Edit, Trash2, Mail, ChevronLeft, ChevronRight, Sparkles, X, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { patientService } from '@/services/patientService';
import { staffService } from '@/services/staffService';
import { vapiIntegrationService } from '@/services/vapiIntegrationService';
import { ivrScheduleService } from '@/services/ivrScheduleService';
import { CURSOS_VIDA_LIST } from '@/services/cursoVidaConfig';
import { programToSpecialty, pickDoctorIdForPatient } from '@/pages/doctor/doctorUtils';
import PatientTelemetryTable from '@/components/PatientTelemetryTable';
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PatientsPage = () => {
  const [patients, setPatients] = useState([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [cursoFilter, setCursoFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [bulkDoctorId, setBulkDoctorId] = useState('');
  const [callingPatientId, setCallingPatientId] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [syntheticLoading, setSyntheticLoading] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const requestSeqRef = useRef(0);

  // Estado para nuevo paciente
  const [newPatient, setNewPatient] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    telefono: '',
    email: '',
    fecha_nacimiento: '',
    genero: 'M',
    ciudad: '',
    direccion: '',
    programa: ''
  });

  // Estado para editar paciente
  const [editPatient, setEditPatient] = useState({
    nombre: '',
    telefono: '',
    fechaNacimiento: '',
    sexo: 'M',
    ciudad: '',
    programa: '',
    email: '',
    cc: '',
    direccion: ''
  });

  useEffect(() => {
    const trimmed = searchTerm.trim();
    // Invalidar inmediatamente cualquier petición en vuelo previa al cambiar el texto
    if (trimmed !== debouncedSearch) {
      requestSeqRef.current += 1;
      if (hasLoadedOnceRef.current) setTableLoading(true);
    }
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(trimmed);
    }, 260);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    loadPatients(!hasLoadedOnceRef.current);
  }, [user, page, pageSize, cursoFilter, debouncedSearch]);

  const loadPatients = async (showFullSpinner = false, overrides = {}) => {
    const reqId = ++requestSeqRef.current;
    const effectivePage = overrides.page ?? page;
    const effectiveSearch = overrides.search !== undefined ? overrides.search : debouncedSearch;
    const effectiveCurso = overrides.cursoVida ?? cursoFilter;

    if (showFullSpinner && !hasLoadedOnceRef.current) setLoading(true);
    else setTableLoading(true);
    try {
      const result = await patientService.getPaginated({
        page: effectivePage,
        pageSize,
        search: effectiveSearch,
        cursoVida: effectiveCurso,
      });

      // Descartar respuestas antiguas si el usuario ya lanzó una búsqueda más reciente
      if (reqId !== requestSeqRef.current) return;

      if (result.success && result.data) {
        hasLoadedOnceRef.current = true;
        setPatients(result.data);
        setTotalPatients(Number(result.totalCount ?? result.data.length));
      } else {
        hasLoadedOnceRef.current = true;
        toast({
          title: "Error al cargar pacientes",
          description: result.error || "No se pudieron cargar los datos",
          variant: "destructive"
        });
      }
    } catch (error) {
      if (reqId !== requestSeqRef.current) return;
      hasLoadedOnceRef.current = true;
      console.error('❌ Error loading patients:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con la base de datos",
        variant: "destructive"
      });
    } finally {
      if (reqId === requestSeqRef.current) {
        setLoading(false);
        setTableLoading(false);
      }
    }
  };

  const handleCallPatient = async (patient) => {
    if (!patient) return;
    if (!patient.telefono) {
      toast({
        title: "Paciente sin teléfono",
        description: `${patient.nombre} no tiene un número telefónico registrado.`,
        variant: "destructive",
      });
      return;
    }

    setCallingPatientId(patient.id);
    toast({
      title: "📞 Iniciando llamada individual...",
      description: `Marcando a ${patient.nombre} (${patient.telefono}) vía Agente IA SADI...`,
    });

    try {
      const ivrCfg = ivrScheduleService.getConfig();
      const res = await vapiIntegrationService.triggerLiveCall(
        patient.telefono,
        {
          patientId: patient.patient_id || patient.id,
          hospitalId: patient.hospitalId || user?.hospitalId || user?.hospital_id || null,
          doctorId: user?.doctor_id || null,
          nombre: patient.nombre,
          documento: patient.cc || patient.documento || '',
          programa3280: patient.programa || patient.program || 'Valoración Preventiva Res. 3280',
          motivoLlamada: `Llamada Individual Res. 3280 · ${patient.curso_vida || 'Atención Preventiva'}`,
          cursoVida: patient.curso_vida || patient.grupo_vida || '',
          curso_vida: patient.curso_vida || patient.grupo_vida || '',
          curso_vida_key: patient.curso_vida_key || null,
          birthdate: patient.fechaNacimiento || patient.birthdate || null,
          edad: patient.edad ?? null,
          direccion: patient.direccion || 'Santiago de Cali',
        },
        ivrCfg
      );

      if (res.ok) {
        toast({
          title: "🟢 Llamada individual conectada",
          description: `Llamando a ${patient.nombre} (${patient.telefono}). ID: ${res.data?.id?.slice(0, 8) || 'VAPI'}`,
        });
      } else {
        toast({
          title: "No se pudo emitir la llamada",
          description: res.data?.message || res.data?.error || 'Verifica la configuración de Vapi / Gateway GSM.',
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error al iniciar llamada",
        description: err?.message || 'Error de conexión con el motor de llamadas.',
        variant: "destructive",
      });
    } finally {
      setCallingPatientId(null);
    }
  };

  const handleAutoAssignAll = async () => {
    setAutoAssigning(true);
    try {
      const res = await patientService.autoAssignDoctors(false);
      if (res.success) {
        toast({
          title: "✅ Clasificación y Asignación Automática 3280",
          description: `Pacientes clasificados y sincronizados con profesionales de staff (actualizados: ${(res.updated ?? 0).toLocaleString('es-CO')}).`,
        });
        await loadPatients(false);
      } else {
        toast({
          title: "No se pudo ejecutar asignación automática",
          description: res.error || "Verifica la migración SQL en Supabase",
          variant: "destructive",
        });
      }
    } finally {
      setAutoAssigning(false);
    }
  };

  // ✅ NUEVA FUNCIÓN: Crear paciente usando Edge Function
  const handleAddPatient = async (e) => {
    e.preventDefault();
    setCreatingPatient(true);
    
    try {
      console.log('🚀 Llamando a Edge Function create-patient...');
      
      // Validar campos obligatorios
      if (!newPatient.email || !newPatient.nombre || !newPatient.apellido || !newPatient.cedula) {
        toast({
          title: "Campos obligatorios",
          description: "Complete todos los campos requeridos",
          variant: "destructive"
        });
        setCreatingPatient(false);
        return;
      }

      // Timeout wrapper for Edge Function
      const timeoutMs = 25000; // 25s timeout
      const invokePromise = supabase.functions.invoke('create-patient', {
        body: {
          email: newPatient.email,
          nombre: newPatient.nombre,
          apellido: newPatient.apellido,
          cedula: newPatient.cedula,
          telefono: newPatient.telefono,
          fecha_nacimiento: newPatient.fecha_nacimiento,
          genero: newPatient.genero,
          direccion: newPatient.direccion,
          hospital_id: user.hospitalId
        }
      });

      const { data, error } = await Promise.race([
        invokePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
      ]);

      if (error) {
        console.error('❌ Error de Edge Function:', error);
        throw new Error(error.message || 'Error al crear paciente');
      }

      if (data && data.success) {
        console.log('✅ Paciente creado exitosamente:', data);
        
        toast({
          title: "✅ Paciente creado",
          description: (
            <div className="space-y-2">
              <p>Se ha enviado un email de verificación a <strong>{newPatient.email}</strong></p>
              <p className="text-xs bg-yellow-50 p-2 rounded border border-yellow-200">
                📧 Contraseña temporal: <strong>{data.temporary_password}</strong>
              </p>
              <p className="text-xs text-gray-600">
                El paciente debe verificar su email antes de poder iniciar sesión.
              </p>
            </div>
          ),
          duration: 8000,
        });
        
        setShowAddDialog(false);
        // Resetear formulario antes de recargar
        setNewPatient({
          nombre: '',
          apellido: '',
          cedula: '',
          telefono: '',
          email: '',
          fecha_nacimiento: '',
          genero: 'M',
          ciudad: '',
          direccion: '',
          programa: ''
        });

        // Recargar silenciosamente
        await loadPatients(false);
        
      } else {
        throw new Error(data?.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('💥 Error adding patient:', error);
      
      if (error.message === 'timeout') {
         toast({
          title: "Tiempo de espera agotado",
          description: "La creación está tardando demasiado. Por favor verifica si el paciente aparece en la lista en unos momentos.",
          variant: "warning"
        });
        setShowAddDialog(false);
        await loadPatients(false);
      } else {
        toast({
          title: "Error al crear paciente",
          description: error.message || "Ocurrió un error inesperado",
          variant: "destructive"
        });
      }
    } finally {
      setCreatingPatient(false);
    }
  };

  const handleEditPatient = async (e) => {
    e.preventDefault();
    
    if (!selectedPatient) return;
    
    try {
      const result = await patientService.update(selectedPatient.id, editPatient);
      
      if (result.success) {
        toast({
          title: "✅ Paciente actualizado",
          description: "Los datos se han actualizado exitosamente",
        });
        
        await loadPatients();
        setShowEditDialog(false);
        setSelectedPatient(null);
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo actualizar el paciente",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating patient:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al actualizar el paciente",
        variant: "destructive"
      });
    }
  };

  const handleDeletePatient = async () => {
    if (!patientToDelete) return;
    
    try {
      const result = await patientService.delete(patientToDelete.id);
      
      if (result.success) {
        toast({
          title: "✅ Paciente eliminado",
          description: "El paciente ha sido eliminado exitosamente",
        });
        
        await loadPatients();
        setPatientToDelete(null);
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar el paciente",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al eliminar el paciente",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (patient) => {
    setSelectedPatient(patient);
    setEditPatient({
      nombre: patient.nombre || '',
      telefono: patient.telefono || '',
      fechaNacimiento: patient.fechaNacimiento || '',
      sexo: patient.sexo || 'M',
      ciudad: patient.ciudad || '',
      programa: patient.programa || '',
      email: patient.email || '',
      cc: patient.cc || '',
      direccion: patient.direccion || ''
    });
    setShowEditDialog(true);
  };

  const filteredPatients = patients;
  const totalPages = Math.max(1, Math.ceil(totalPatients / pageSize));

  const filteredPatientIds = useMemo(() => filteredPatients.map((p) => p.id), [filteredPatients]);
  const selectedIdSet = useMemo(() => new Set(selectedPatientIds), [selectedPatientIds]);
  const selectedCount = selectedPatientIds.length;
  const allFilteredSelected = useMemo(() => {
    if (filteredPatientIds.length === 0) return false;
    return filteredPatientIds.every((id) => selectedIdSet.has(id));
  }, [filteredPatientIds, selectedIdSet]);
  const someFilteredSelected = useMemo(() => {
    if (filteredPatientIds.length === 0) return false;
    return filteredPatientIds.some((id) => selectedIdSet.has(id)) && !allFilteredSelected;
  }, [allFilteredSelected, filteredPatientIds, selectedIdSet]);

  const selectAllRef = useRef(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected;
    }
  }, [someFilteredSelected]);

  const togglePatientSelection = (patientId) => {
    const id = String(patientId || '').trim();
    if (!id) return;
    setSelectedPatientIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const toggleSelectAllFiltered = () => {
    if (filteredPatientIds.length === 0) return;
    setSelectedPatientIds((prev) => {
      const prevSet = new Set(prev);
      const shouldSelectAll = !filteredPatientIds.every((id) => prevSet.has(id));
      if (shouldSelectAll) {
        const merged = new Set([...prevSet, ...filteredPatientIds]);
        return Array.from(merged);
      }
      const filteredSet = new Set(filteredPatientIds);
      return prev.filter((id) => !filteredSet.has(id));
    });
  };

  const clearSelection = () => setSelectedPatientIds([]);

  const ensureDoctorsLoaded = async () => {
    if (loadingDoctors) return;
    if (doctors.length > 0) return;
    setLoadingDoctors(true);
    try {
      const res = await staffService.getAll();
      if (!res.success) {
        toast({
          title: "Error",
          description: res.error || "No se pudieron cargar los doctores",
          variant: "destructive",
        });
        setDoctors([]);
        return;
      }
      const active = (res.data || []).filter((d) => d?.is_active);
      setDoctors(active);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = selectedPatientIds.map((id) => String(id || '').trim()).filter(Boolean);
    if (ids.length === 0) {
      setShowBulkDeleteDialog(false);
      return;
    }

    setBulkProcessing(true);
    try {
      const settled = await Promise.allSettled(ids.map((id) => patientService.delete(id)));
      const failed = [];
      let successCount = 0;

      settled.forEach((res, i) => {
        if (res.status === 'fulfilled' && res.value?.success) {
          successCount += 1;
          return;
        }
        const reason =
          res.status === 'rejected'
            ? res.reason?.message || String(res.reason)
            : res.value?.error || 'No se pudo eliminar';
        failed.push({ id: ids[i], error: reason });
      });

      if (failed.length === 0) {
        toast({
          title: "✅ Eliminación completada",
          description: `Se eliminaron ${successCount} pacientes.`,
        });
        clearSelection();
      } else {
        toast({
          title: "Eliminación con errores",
          description: `Eliminados: ${successCount}. Fallidos: ${failed.length}.`,
          variant: "destructive",
        });
        setSelectedPatientIds(failed.map((f) => f.id));
      }

      await loadPatients(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error?.message || "Ocurrió un error al eliminar pacientes",
        variant: "destructive",
      });
    } finally {
      setBulkProcessing(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkAssignDoctor = async () => {
    const ids = selectedPatientIds.map((id) => String(id || '').trim()).filter(Boolean);
    if (ids.length === 0) {
      setShowBulkAssignDialog(false);
      return;
    }

    const normalizedDoctorId = bulkDoctorId === '__none__' ? null : String(bulkDoctorId || '').trim();
    if (normalizedDoctorId !== null && !normalizedDoctorId) {
      toast({
        title: "Selecciona un doctor",
        description: "Elige un doctor para asignar o selecciona 'Sin doctor'.",
        variant: "destructive",
      });
      return;
    }

    setBulkProcessing(true);
    try {
      const res = await patientService.assignDoctorBulk(ids, normalizedDoctorId);
      if (!res.success) {
        const msg = String(res.error || '');
        const missingColumn =
          msg.toLowerCase().includes('column') &&
          msg.toLowerCase().includes('doctor_id') &&
          (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('no existe'));

        toast({
          title: "No se pudo asignar doctor",
          description: missingColumn
            ? 'Falta la columna doctor_id en la tabla patients. Agrega doctor_id UUID (FK a staff.doctor_id).'
            : (res.error || 'Error asignando doctor'),
          variant: "destructive",
          duration: 7000,
        });
        return;
      }

      toast({
        title: "✅ Doctores asignados",
        description: `Se actualizó la asignación en ${res.updated} pacientes.`,
      });

      clearSelection();
      setBulkDoctorId('');
      setShowBulkAssignDialog(false);
      await loadPatients(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error?.message || "Ocurrió un error al asignar doctor",
        variant: "destructive",
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <p className="text-gray-600 dark:text-slate-400">Cargando pacientes...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const modalInputClass =
    'w-full mt-1 px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Layout>
      <Helmet>
        <title>Pacientes - SADI</title>
      </Helmet>

      <div className="space-y-6">
        {/* Cabecera Principal Homogénea SADI */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Pacientes
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Censo oficial y telemonitoreo clínico de pacientes registrados en el hospital •{' '}
                  <span className="font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
                    {totalPatients.toLocaleString('es-CO')} pacientes vinculados
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(user.role === 'hospital_admin' || user.role === 'operator') && (
              <Button
                variant="outline"
                onClick={handleAutoAssignAll}
                disabled={autoAssigning}
                className="bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-semibold flex items-center gap-2"
                title="Clasifica por edad Res. 3280 y asigna automáticamente un médico/enfermero por paciente"
              >
                <Sparkles className="h-4 w-4" />
                <span>{autoAssigning ? 'Asignando...' : 'Auto-Asignar 3280'}</span>
              </Button>
            )}
            {(user.role === 'hospital_admin' || user.role === 'operator') && (
              <CSVUploadDialog 
                hospitalId={user.hospitalId}
                onUploadComplete={() => loadPatients(false)}
              />
            )}
            
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-600/20 flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Agregar Paciente</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Agregar Nuevo Paciente</DialogTitle>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                    Se enviará un email de verificación al paciente
                  </p>
                </DialogHeader>
                <form onSubmit={handleAddPatient} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nombre">Nombre *</Label>
                      <input
                        id="nombre"
                        type="text"
                        value={newPatient.nombre}
                        onChange={(e) => setNewPatient({ ...newPatient, nombre: e.target.value })}
                        className={modalInputClass}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="apellido">Apellido *</Label>
                      <input
                        id="apellido"
                        type="text"
                        value={newPatient.apellido}
                        onChange={(e) => setNewPatient({ ...newPatient, apellido: e.target.value })}
                        className={modalInputClass}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="cedula">Cédula/Documento *</Label>
                    <input
                      id="cedula"
                      type="text"
                      value={newPatient.cedula}
                      onChange={(e) => setNewPatient({ ...newPatient, cedula: e.target.value })}
                      className={modalInputClass}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Esta será la contraseña temporal</p>
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="email"
                        type="email"
                        value={newPatient.email}
                        onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                        className={`${modalInputClass} pl-10`}
                        placeholder="paciente@email.com"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Se enviará verificación a este correo</p>
                  </div>

                  <div>
                    <Label htmlFor="telefono">Teléfono *</Label>
                    <input
                      id="telefono"
                      type="tel"
                      value={newPatient.telefono}
                      onChange={(e) => setNewPatient({ ...newPatient, telefono: e.target.value })}
                      className={modalInputClass}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento *</Label>
                      <input
                        id="fecha_nacimiento"
                        type="date"
                        value={newPatient.fecha_nacimiento}
                        onChange={(e) => setNewPatient({ ...newPatient, fecha_nacimiento: e.target.value })}
                        className={modalInputClass}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="genero">Género *</Label>
                      <select
                        id="genero"
                        value={newPatient.genero}
                        onChange={(e) => setNewPatient({ ...newPatient, genero: e.target.value })}
                        className={modalInputClass}
                        required
                      >
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <input
                      id="ciudad"
                      type="text"
                      value={newPatient.ciudad}
                      onChange={(e) => setNewPatient({ ...newPatient, ciudad: e.target.value })}
                      className={modalInputClass}
                    />
                  </div>

                  <div>
                    <Label htmlFor="direccion">Dirección</Label>
                    <input
                      id="direccion"
                      type="text"
                      value={newPatient.direccion}
                      onChange={(e) => setNewPatient({ ...newPatient, direccion: e.target.value })}
                      className={modalInputClass}
                    />
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 rounded-lg p-3">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      ℹ️ <strong>Importante:</strong> Se enviará un correo de verificación al paciente. 
                      Debe confirmar su email antes de poder iniciar sesión.
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={creatingPatient}>
                    {creatingPatient ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creando y enviando email...
                      </span>
                    ) : (
                      'Crear Paciente y Enviar Email'
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Editar Paciente</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEditPatient} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-nombre">Nombre</Label>
                      <input
                        id="edit-nombre"
                        type="text"
                        value={editPatient.nombre}
                        onChange={(e) => setEditPatient({ ...editPatient, nombre: e.target.value })}
                        className={modalInputClass}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-telefono">Teléfono</Label>
                      <input
                        id="edit-telefono"
                        type="tel"
                        value={editPatient.telefono}
                        onChange={(e) => setEditPatient({ ...editPatient, telefono: e.target.value })}
                        className={modalInputClass}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit-email">Email</Label>
                    <input
                      id="edit-email"
                      type="email"
                      value={editPatient.email}
                      onChange={(e) => setEditPatient({ ...editPatient, email: e.target.value })}
                      className={modalInputClass}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-fecha">Fecha de Nacimiento</Label>
                      <input
                        id="edit-fecha"
                        type="date"
                        value={editPatient.fechaNacimiento}
                        onChange={(e) => setEditPatient({ ...editPatient, fechaNacimiento: e.target.value })}
                        className={modalInputClass}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-sexo">Género</Label>
                      <select
                        id="edit-sexo"
                        value={editPatient.sexo}
                        onChange={(e) => setEditPatient({ ...editPatient, sexo: e.target.value })}
                        className={modalInputClass}
                        required
                      >
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit-ciudad">Ciudad</Label>
                    <input
                      id="edit-ciudad"
                      type="text"
                      value={editPatient.ciudad}
                      onChange={(e) => setEditPatient({ ...editPatient, ciudad: e.target.value })}
                      className={modalInputClass}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-direccion">Dirección</Label>
                    <input
                      id="edit-direccion"
                      type="text"
                      value={editPatient.direccion}
                      onChange={(e) => setEditPatient({ ...editPatient, direccion: e.target.value })}
                      className={modalInputClass}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-cc">Cédula/Documento</Label>
                    <input
                      id="edit-cc"
                      type="text"
                      value={editPatient.cc}
                      onChange={(e) => setEditPatient({ ...editPatient, cc: e.target.value })}
                      className={`${modalInputClass} opacity-70`}
                      readOnly
                      disabled
                    />
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">El documento no se puede editar</p>
                  </div>

                  <Button type="submit" className="w-full">
                    Guardar Cambios
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Contenedor Principal de Pacientes y Telemetría */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors">
          <div className="mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  data-testid="patients-search-input"
                  placeholder="Buscar en BD por nombre (con o sin tildes), CC, teléfono o barrio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const clean = searchTerm.trim();
                      setPage(1);
                      setDebouncedSearch(clean);
                      loadPatients(false, { page: 1, search: clean });
                    }
                  }}
                  className="w-full pl-10 pr-20 py-2.5 text-sm border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1.5">
                  {tableLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                  {searchTerm && (
                    <button
                      type="button"
                      data-testid="patients-search-clear"
                      onClick={() => {
                        setSearchTerm('');
                        setPage(1);
                        setDebouncedSearch('');
                      }}
                      className="p-0.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
                      title="Limpiar búsqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <select
                value={cursoFilter}
                onChange={(e) => {
                  setCursoFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrar por Curso de Vida"
                className="px-3.5 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los Cursos de Vida (Res. 3280)</option>
                {CURSOS_VIDA_LIST.filter((c) => c.id !== 'todos' && c.id !== 'sin_asignacion').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.letra}. {c.nombre} ({c.rango})
                  </option>
                ))}
              </select>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Registros por página"
                className="px-3 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value={25}>25 / pág.</option>
                <option value={50}>50 / pág.</option>
                <option value={100}>100 / pág.</option>
                <option value={250}>250 / pág.</option>
                <option value={500}>500 / pág.</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Seleccionar todo (vista)
                </span>
                {selectedCount > 0 && (
                  <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800/60">
                    Seleccionados: {selectedCount}
                  </span>
                )}
                {selectedCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white">
                    Limpiar
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await ensureDoctorsLoaded();
                    setShowBulkAssignDialog(true);
                  }}
                  disabled={selectedCount === 0 || bulkProcessing}
                  className="text-xs bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
                >
                  Asignar doctor
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-sm"
                  disabled={selectedCount === 0 || bulkProcessing}
                >
                  Eliminar seleccionados
                </Button>
              </div>
            </div>
          </div>

          <div className={`mt-4 transition-opacity ${tableLoading ? 'opacity-60' : 'opacity-100'}`}>
            <PatientTelemetryTable
              patients={filteredPatients}
              selectable={true}
              selectedPatientIds={selectedPatientIds}
              onToggleSelect={togglePatientSelection}
              onCallPatient={handleCallPatient}
              callingPatientId={callingPatientId}
              onEditPatient={openEditDialog}
              onDeletePatient={setPatientToDelete}
              emptyMessage={searchTerm || cursoFilter !== 'todos' ? 'No se encontraron pacientes que coincidan con la búsqueda o curso de vida.' : 'No hay pacientes registrados en este hospital.'}
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Mostrando{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {totalPatients === 0 ? 0 : ((page - 1) * pageSize + 1).toLocaleString('es-CO')}
              </span>
              {' – '}
              <span className="font-bold text-slate-900 dark:text-white">
                {Math.min(page * pageSize, totalPatients).toLocaleString('es-CO')}
              </span>
              {' de '}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {totalPatients.toLocaleString('es-CO')}
              </span>
              {' pacientes'}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || tableLoading}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 h-8 px-3"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="font-semibold px-2 text-slate-800 dark:text-slate-200">
                Página {page.toLocaleString('es-CO')} de {totalPages.toLocaleString('es-CO')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || tableLoading}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 h-8 px-3"
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* AlertDialog de eliminación permanece igual */}
      <AlertDialog open={!!patientToDelete} onOpenChange={() => setPatientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a <strong>{patientToDelete?.nombre}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePatient} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pacientes seleccionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente {selectedCount} pacientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={bulkProcessing}
            >
              {bulkProcessing ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar doctor</DialogTitle>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
              Se asignará el mismo doctor a {selectedCount} pacientes seleccionados.
            </p>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="bulk-doctor">Doctor</Label>
              <select
                id="bulk-doctor"
                value={bulkDoctorId}
                onChange={(e) => setBulkDoctorId(e.target.value)}
                className={modalInputClass}
                disabled={loadingDoctors || bulkProcessing}
              >
                <option value="">Selecciona un doctor</option>
                <option value="__none__">Sin doctor (quitar asignación)</option>
                {(doctors || []).map((d) => {
                  const label = (d?.nombre || d?.email || 'Doctor').trim();
                  const extra = [d?.especialidad ? String(d.especialidad).trim() : null, d?.email ? String(d.email).trim() : null]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <option key={d.id} value={d.id}>
                      {extra ? `${label} · ${extra}` : label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowBulkAssignDialog(false)}
              disabled={bulkProcessing}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200"
            >
              Cancelar
            </Button>
            <Button onClick={handleBulkAssignDoctor} disabled={bulkProcessing || loadingDoctors}>
              {bulkProcessing ? 'Asignando...' : 'Asignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default PatientsPage;
