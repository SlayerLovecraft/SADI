// ============================================
// src/pages/PatientsPage.jsx - USANDO EDGE FUNCTION
// ============================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import CSVUploadDialog from '@/components/CSVUploadDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Plus, User, Users, Phone, MapPin, Edit, Trash2, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { patientService } from '@/services/patientService';
import { staffService } from '@/services/staffService';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [bulkDoctorId, setBulkDoctorId] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const [syntheticLoading, setSyntheticLoading] = useState(false);

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
    loadPatients();
  }, [user]);

  const loadPatients = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      console.log('🔄 Cargando pacientes...');
      const result = await patientService.getAll();
      
      if (result.success && result.data) {
        setPatients(result.data);
        console.log(`✅ ${result.data.length} pacientes cargados`);
      } else {
        toast({
          title: "Error al cargar pacientes",
          description: result.error || "No se pudieron cargar los datos",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Error loading patients:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con la base de datos",
        variant: "destructive"
      });
    } finally {
      if (showLoading) setLoading(false);
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

  const filteredPatients = patients.filter(p =>
    p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.telefono?.includes(searchTerm) ||
    p.ciudad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cc?.includes(searchTerm)
  );

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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Cargando pacientes...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Pacientes - SADI</title>
      </Helmet>

      <div className="space-y-6">
        {/* Cabecera Principal Homogénea SADI */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Pacientes
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Censo oficial y telemonitoreo clínico de pacientes registrados en el hospital •{' '}
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {patients.length} pacientes vinculados
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(user.role === 'hospital_admin' || user.role === 'operator') && (
              <CSVUploadDialog 
                hospitalId={user.hospitalId}
                onUploadComplete={loadPatients}
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
                  <p className="text-sm text-gray-500 mt-2">
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
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
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
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
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
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Esta será la contraseña temporal</p>
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
                        className="w-full mt-1 pl-10 px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="paciente@email.com"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Se enviará verificación a este correo</p>
                  </div>

                  <div>
                    <Label htmlFor="telefono">Teléfono *</Label>
                    <input
                      id="telefono"
                      type="tel"
                      value={newPatient.telefono}
                      onChange={(e) => setNewPatient({ ...newPatient, telefono: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
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
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="genero">Género *</Label>
                      <select
                        id="genero"
                        value={newPatient.genero}
                        onChange={(e) => setNewPatient({ ...newPatient, genero: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
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
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <Label htmlFor="direccion">Dirección</Label>
                    <input
                      id="direccion"
                      type="text"
                      value={newPatient.direccion}
                      onChange={(e) => setNewPatient({ ...newPatient, direccion: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800">
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
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
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
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
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
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
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
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-sexo">Género</Label>
                      <select
                        id="edit-sexo"
                        value={editPatient.sexo}
                        onChange={(e) => setEditPatient({ ...editPatient, sexo: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
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
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-direccion">Dirección</Label>
                    <input
                      id="edit-direccion"
                      type="text"
                      value={editPatient.direccion}
                      onChange={(e) => setEditPatient({ ...editPatient, direccion: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-cc">Cédula/Documento</Label>
                    <input
                      id="edit-cc"
                      type="text"
                      value={editPatient.cc}
                      onChange={(e) => setEditPatient({ ...editPatient, cc: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      readOnly
                      disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">El documento no se puede editar</p>
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="mb-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono, ciudad o CC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-700">
                  Seleccionar todo (vista)
                </span>
                {selectedCount > 0 && (
                  <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-200">
                    Seleccionados: {selectedCount}
                  </span>
                )}
                {selectedCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-800">
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
                  className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
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

          <div className="mt-4">
            <PatientTelemetryTable
              patients={filteredPatients}
              selectable={true}
              selectedPatientIds={selectedPatientIds}
              onToggleSelect={togglePatientSelection}
              onEditPatient={openEditDialog}
              onDeletePatient={setPatientToDelete}
              emptyMessage={searchTerm ? 'No se encontraron pacientes que coincidan con la búsqueda.' : 'No hay pacientes registrados en este hospital.'}
            />
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
            <p className="text-sm text-gray-500 mt-2">
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
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
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
