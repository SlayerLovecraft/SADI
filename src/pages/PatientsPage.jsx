// ============================================
// src/pages/PatientsPage.jsx - USANDO EDGE FUNCTION
// ============================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import CSVUploadDialog from '@/components/CSVUploadDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Plus, User, Phone, MapPin, Edit, Trash2, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { patientService } from '@/services/patientService';
import { staffService } from '@/services/staffService';
import { programToSpecialty, pickDoctorIdForPatient } from '@/pages/doctor/doctorUtils';
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pacientes</h1>
            <p className="text-gray-500 mt-1">
              {user.role === 'super_admin' 
                ? `Base de datos global (${patients.length} pacientes)` 
                : `Pacientes de tu hospital (${patients.length})`}
            </p>
          </div>
          <div className="flex gap-2">
            {(user.role === 'hospital_admin' || user.role === 'operator') && (
              <CSVUploadDialog 
                hospitalId={user.hospitalId}
                onUploadComplete={loadPatients}
              />
            )}
            
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Paciente
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

        {/* Resto del código de la lista de pacientes permanece igual */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono, ciudad o CC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="mt-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">
                  Seleccionar todo (vista)
                </span>
                {selectedCount > 0 && (
                  <span className="text-sm text-gray-500">
                    Seleccionados: {selectedCount}
                  </span>
                )}
                {selectedCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Limpiar
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    await ensureDoctorsLoaded();
                    setShowBulkAssignDialog(true);
                  }}
                  disabled={selectedCount === 0 || bulkProcessing}
                >
                  Asignar doctor
                </Button>
                <Button
                  onClick={() => setShowBulkDeleteDialog(true)}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={selectedCount === 0 || bulkProcessing}
                >
                  Eliminar seleccionados
                </Button>
              </div>
            </div>

            {(user.role === 'hospital_admin' || user.role === 'operator') && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (!user?.hospitalId) {
                    toast({
                      title: "Hospital no identificado",
                      description: "Inicia sesión nuevamente para continuar.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setSyntheticLoading(true);
                  try {
                    const programs = [
                      'HTA - Hipertensión Arterial',
                      'Asma y Alergias',
                      'Embarazo control prenatal',
                      'Imagenología - Radiología',
                      'Neuroseguimiento',
                      'Pediatría integral',
                      'Trauma y Ortopedia',
                      'Ginecología',
                      'Oncología',
                      'Dermatología'
                    ];
                    const cities = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Manizales', 'Pereira', 'Santa Marta', 'Cúcuta'];
                    const streets = ['Calle', 'Carrera', 'Avenida', 'Transversal', 'Diagonal'];
                    const lastNames = ['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera'];
                    const firstNamesM = ['Juan', 'Carlos', 'Andrés', 'Luis', 'Jorge', 'Miguel', 'Sebastián', 'Diego', 'Daniel', 'Camilo'];
                    const firstNamesF = ['María', 'Laura', 'Ana', 'Paola', 'Natalia', 'Carolina', 'Andrea', 'Sofía', 'Valentina', 'Daniela'];

                    const N = 5000;
                    const patientsToCreate = Array.from({ length: N }, (_, i) => {
                      const sex = i % 2 === 0 ? 'M' : 'F';
                      const first = sex === 'M' ? firstNamesM[i % firstNamesM.length] : firstNamesF[i % firstNamesF.length];
                      const last = `${lastNames[i % lastNames.length]} ${lastNames[(i + 3) % lastNames.length]}`;
                      const nombre = `${first} ${last}`;
                      const doc = String(100000000 + i);
                      const email = `paciente${String(i + 1).padStart(4, '0')}@sadi.com.co`;
                      const phone = `300${String(1000000 + (i % 900000)).padStart(7, '0')}`;

                      const year = 1970 + (i % 40);
                      const month = (i % 12) + 1;
                      const day = ((i % 28) + 1);
                      const fechaNacimiento = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                      const ciudad = cities[i % cities.length];
                      const direccion = `${streets[i % streets.length]} ${1 + (i % 99)} #${(i % 50) + 1}-${(i % 20) + 1}`;
                      const programa = programs[i % programs.length];

                      return {
                        nombre,
                        email,
                        cc: doc,
                        telefono: phone,
                        fechaNacimiento,
                        sexo: sex,
                        direccion,
                        ciudad,
                        programa
                      };
                    });

                    toast({
                      title: "Generando pacientes",
                      description: `Creando ${N} registros para tu hospital...`,
                    });

                    const result = await patientService.createBulk(patientsToCreate, {
                      batchSize: 50,
                      onProgress: (processed, total) => {
                        // Optional: could update a local progress state
                      }
                    });

                    if (!result.success) {
                      toast({
                        title: "Error creando pacientes",
                        description: result.error || "No se pudo generar la data",
                        variant: "destructive",
                      });
                      return;
                    }

                    toast({
                      title: "✅ Pacientes creados",
                      description: `Se insertaron ${result.successCount} pacientes y se asignaron sus doctores automáticamente.`,
                    });

                    await loadPatients();
                  } catch (err) {
                    toast({
                      title: "Error",
                      description: err?.message || "Fallo al generar pacientes",
                      variant: "destructive",
                    });
                  } finally {
                    setSyntheticLoading(false);
                  }
                }}
                disabled={syntheticLoading}
              >
                {syntheticLoading ? 'Generando...' : 'Generar 5000 pacientes'}
              </Button>
            )}
          </div>

          {filteredPatients.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {searchTerm ? 'No se encontraron pacientes' : 'No hay pacientes registrados'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPatients.map((patient, index) => (
                <motion.div
                  key={patient.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{patient.nombre}</p>
                        <p className="text-xs text-gray-400">CC: {patient.cc || patient.cedula || 'N/A'}</p>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="h-3 w-3 mr-1" />
                            {patient.telefono}
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <MapPin className="h-3 w-3 mr-1" />
                            {patient.ciudad || 'N/A'}
                          </div>
                          {patient.email && (
                            <div className="flex items-center text-xs text-gray-500">
                              <Mail className="h-3 w-3 mr-1" />
                              {patient.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 ml-2">
                      <div className="flex justify-end">
                        <input
                          type="checkbox"
                          checked={selectedIdSet.has(patient.id)}
                          onChange={() => togglePatientSelection(patient.id)}
                          className="h-4 w-4"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(patient)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPatientToDelete(patient)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
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
