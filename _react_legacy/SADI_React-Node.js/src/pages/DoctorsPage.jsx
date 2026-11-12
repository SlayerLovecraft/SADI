import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { 
  UserCheck, Plus, Search, Trash2, Edit3, Shield, Key, Lock, Unlock,
  PhoneCall, MessageSquare, Send, CheckCircle2, AlertCircle, HeartPulse,
  Baby, Sparkles, Eye, UserX, Check, X, ShieldAlert, Award, Users, Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { staffService } from '@/services/staffService';
import { patientService } from '@/services/patientService';
import { telemonitoringService } from '@/services/telemonitoringService';
import StaffPatientInteractionsTable from '@/components/StaffPatientInteractionsTable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
} from '@/components/ui/alert-dialog';
import { 
  CURSO_VIDA_CONFIG, 
  CURSOS_VIDA_LIST, 
  getDoctorLifeCourseTheme, 
  formatCursosVidaLabel 
} from '@/services/cursoVidaConfig';
import { 
  getCursoVidaFromPatient, 
  isPatientAssignedToDoctor 
} from './doctor/doctorUtils';

const ROLES_PERSONAL = [
  { value: 'Enfermera', label: 'Enfermera Asistencial (Demanda Inducida)' },
  { value: 'Enfermera Jefe', label: 'Enfermera Jefe (Coordinación de Ruta)' },
  { value: 'Médico General', label: 'Médico General (Consulta & Triage)' },
  { value: 'Especialista', label: 'Médico Especialista (Pediatría, Gineco, etc.)' }
];

// Lista oficial de IDs de los 10 Cursos de Vida de la Resolución 3280
const ALL_10_CURSOS_IDS = [
  'primera_infancia',
  'infancia',
  'adolescencia',
  'juventud',
  'adultez',
  'vejez',
  'preventivo_mujer',
  'planificacion_familiar',
  'vacunacion',
  'salud_oral'
];

export default function DoctorsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [staffList, setStaffList] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [loading, setLoading] = useState(true);

  // Modales
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [personToDelete, setPersonToDelete] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Modal para ver Pacientes Asignados de un Personal específico
  const [viewingPatientsStaff, setViewingPatientsStaff] = useState(null);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');

  // Formulario Nuevo Personal (Sin asignación inicial)
  const [newStaff, setNewStaff] = useState({
    nombre: '',
    email: '',
    password: 'sadi' + Math.floor(1000 + Math.random() * 9000),
    rol: 'Enfermera',
    especialidad: 'Atención Primaria y Demanda Inducida 3280',
    cursos_vida_asignados: [], // Sin Asignación por defecto
    solo_lectura: true,
    puede_lanzar_llamadas: false,
    puede_enviar_mensajes: false,
    puede_crear_campanas: false,
    puede_editar_pacientes: false
  });

  // Formulario Edición Básica
  const [editStaff, setEditStaff] = useState({
    nombre: '',
    email: '',
    rol: 'Enfermera',
    especialidad: '',
    password: ''
  });

  // Formulario "Mejorar Permisos & Cursos de Vida" (Sin Asignación inicial)
  const [permissionsForm, setPermissionsForm] = useState({
    cursos_vida_asignados: [],
    solo_lectura: true,
    puede_lanzar_llamadas: false,
    puede_enviar_mensajes: false,
    puede_crear_campanas: false,
    puede_editar_pacientes: false
  });

  const [savingAction, setSavingAction] = useState(false);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [resStaff, resPatients] = await Promise.all([
        staffService.getAll(),
        patientService.getAll()
      ]);

      if (resStaff.success) {
        setStaffList(resStaff.data || []);
      }
      let pts = [];
      if (resPatients.success && Array.isArray(resPatients.data) && resPatients.data.length > 0) {
        pts = resPatients.data;
      } else {
        pts = await telemonitoringService.getPatients();
      }
      setAllPatients(pts || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.hospitalId]);

  // Manejador: Crear Nuevo Personal
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.nombre || !newStaff.email) {
      toast({ title: "Datos incompletos", description: "El nombre y correo son obligatorios.", variant: "destructive" });
      return;
    }

    setSavingAction(true);
    try {
      const res = await staffService.create({
        nombre: newStaff.nombre,
        email: newStaff.email,
        password: newStaff.password || 'sadi2026',
        especialidad: newStaff.especialidad,
        rol: newStaff.rol,
        cursos_vida_asignados: newStaff.cursos_vida_asignados || [],
        grupos_riesgo_asignados: [],
        solo_lectura: newStaff.solo_lectura,
        puede_lanzar_llamadas: newStaff.puede_lanzar_llamadas,
        puede_enviar_mensajes: newStaff.puede_enviar_mensajes,
        puede_crear_campanas: newStaff.puede_crear_campanas,
        puede_editar_pacientes: newStaff.puede_editar_pacientes,
        hospitalId: user?.hospitalId || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8'
      });

      if (res.success) {
        toast({ title: "✅ Personal registrado", description: `${newStaff.nombre} fue añadida al equipo asistencial.` });
        setShowAddDialog(false);
        setNewStaff({
          nombre: '',
          email: '',
          password: 'sadi' + Math.floor(1000 + Math.random() * 9000),
          rol: 'Enfermera',
          especialidad: 'Atención Primaria y Demanda Inducida 3280',
          cursos_vida_asignados: [],
          solo_lectura: true,
          puede_lanzar_llamadas: false,
          puede_enviar_mensajes: false,
          puede_crear_campanas: false,
          puede_editar_pacientes: false
        });
        await loadData(false);
      } else {
        toast({ title: "Error al registrar", description: res.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingAction(false);
    }
  };

  // Abrir Modal de Edición Básica
  const openEditModal = (staff) => {
    setSelectedStaff(staff);
    setEditStaff({
      nombre: staff.nombre,
      email: staff.email,
      rol: staff.rol || 'Enfermera',
      especialidad: staff.especialidad || '',
      password: ''
    });
    setShowEditDialog(true);
  };

  const handleUpdateStaffInfo = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setSavingAction(true);
    try {
      const payload = {
        nombre: editStaff.nombre,
        email: editStaff.email,
        rol: editStaff.rol,
        especialidad: editStaff.especialidad
      };
      if (editStaff.password) payload.password = editStaff.password;

      const res = await staffService.update(selectedStaff.id, payload);
      if (res.success) {
        toast({ title: "✅ Información actualizada", description: `Los datos de ${editStaff.nombre} fueron actualizados.` });
        setShowEditDialog(false);
        setSelectedStaff(null);
        await loadData(false);
      } else {
        toast({ title: "Error al actualizar", description: res.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingAction(false);
    }
  };

  // Abrir Modal "Mejorar Permisos & Cursos de Vida"
  const openPermissionsModal = (staff) => {
    setSelectedStaff(staff);
    const raw = staff.cursos_vida_asignados;
    let cursos = Array.isArray(raw) ? [...raw] : [];
    // Si contiene 'todos' o los 10, expandir explícitamente a los 10 cursos para que se visualicen todos seleccionados
    if (cursos.includes('todos') || cursos.length >= 10) {
      cursos = ['todos', ...ALL_10_CURSOS_IDS];
    }
    setPermissionsForm({
      cursos_vida_asignados: cursos,
      solo_lectura: staff.solo_lectura !== undefined ? Boolean(staff.solo_lectura) : true,
      puede_lanzar_llamadas: Boolean(staff.puede_lanzar_llamadas),
      puede_enviar_mensajes: Boolean(staff.puede_enviar_mensajes),
      puede_crear_campanas: Boolean(staff.puede_crear_campanas),
      puede_editar_pacientes: Boolean(staff.puede_editar_pacientes)
    });
    setShowPermissionsDialog(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedStaff) return;
    setSavingAction(true);
    try {
      let toSave = [...permissionsForm.cursos_vida_asignados];
      const hasAll = toSave.includes('todos') || (toSave.length >= 10 && ALL_10_CURSOS_IDS.every(id => toSave.includes(id)));
      if (hasAll) {
        toSave = ['todos', ...ALL_10_CURSOS_IDS];
      }

      const payload = {
        cursos_vida_asignados: toSave,
        grupos_riesgo_asignados: [],
        solo_lectura: Boolean(permissionsForm.solo_lectura),
        puede_lanzar_llamadas: Boolean(permissionsForm.puede_lanzar_llamadas),
        puede_enviar_mensajes: Boolean(permissionsForm.puede_enviar_mensajes),
        puede_crear_campanas: Boolean(permissionsForm.puede_crear_campanas),
        puede_editar_pacientes: Boolean(permissionsForm.puede_editar_pacientes)
      };

      const res = await staffService.update(selectedStaff.id, payload);

      if (res.success) {
        // Actualizar de inmediato en el estado local React para retroalimentación instantánea
        const updatedStaff = res.data || {
          ...selectedStaff,
          ...payload
        };

        setStaffList(prev => prev.map(s => (s.id === selectedStaff.id || s.doctor_id === selectedStaff.id) ? { ...s, ...updatedStaff } : s));

        toast({
          title: "🛡️ Permisos y Asignaciones actualizados",
          description: `Se han configurado las restricciones de Cursos de Vida para ${selectedStaff.nombre}.`
        });
        setShowPermissionsDialog(false);
        setSelectedStaff(null);
        await loadData(false);
      } else {
        toast({ title: "Error al guardar permisos", description: res.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingAction(false);
    }
  };

  // Eliminar Personal
  const handleDeleteStaff = async () => {
    if (!personToDelete) return;
    try {
      const res = await staffService.delete(personToDelete.id);
      if (res.success) {
        setStaffList(prev => prev.filter(s => s.id !== personToDelete.id && s.doctor_id !== personToDelete.id));
        toast({ title: "🗑️ Personal eliminado", description: "Se ha removido el registro del sistema." });
        setPersonToDelete(null);
        await loadData(false);
      } else {
        toast({ title: "Error al eliminar", description: res.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Toggle de Cursos de Vida en el formulario de Permisos
  const toggleCursoVida = (cursoId) => {
    setPermissionsForm(prev => {
      const current = Array.isArray(prev.cursos_vida_asignados) ? [...prev.cursos_vida_asignados] : [];
      const hasAll = current.includes('todos') || (current.length >= 10 && ALL_10_CURSOS_IDS.every(id => current.includes(id)));

      if (cursoId === 'todos') {
        return {
          ...prev,
          cursos_vida_asignados: hasAll ? [] : ['todos', ...ALL_10_CURSOS_IDS]
        };
      }

      if (hasAll) {
        // Si tenía todos, desmarcar el seleccionado y dejar los otros 9
        return {
          ...prev,
          cursos_vida_asignados: ALL_10_CURSOS_IDS.filter(id => id !== cursoId)
        };
      }

      if (current.includes(cursoId)) {
        return {
          ...prev,
          cursos_vida_asignados: current.filter(id => id !== cursoId && id !== 'todos')
        };
      } else {
        const next = [...current.filter(id => id !== 'todos'), cursoId];
        if (ALL_10_CURSOS_IDS.every(id => next.includes(id))) {
          return { ...prev, cursos_vida_asignados: ['todos', ...ALL_10_CURSOS_IDS] };
        }
        return { ...prev, cursos_vida_asignados: next };
      }
    });
  };

  const clearCursosVida = () => {
    setPermissionsForm(prev => ({ ...prev, cursos_vida_asignados: [] }));
  };

  const setAllCursosVida = () => {
    setPermissionsForm(prev => ({ ...prev, cursos_vida_asignados: ['todos', ...ALL_10_CURSOS_IDS] }));
  };

  // Acciones y Toggles de Privilegios Asistenciales
  const setAllPrivileges = () => {
    setPermissionsForm(prev => ({
      ...prev,
      solo_lectura: false,
      puede_lanzar_llamadas: true,
      puede_enviar_mensajes: true,
      puede_crear_campanas: true,
      puede_editar_pacientes: true
    }));
  };

  const setReadOnlyOnly = () => {
    setPermissionsForm(prev => ({
      ...prev,
      solo_lectura: true,
      puede_lanzar_llamadas: false,
      puede_enviar_mensajes: false,
      puede_crear_campanas: false,
      puede_editar_pacientes: false
    }));
  };

  const togglePrivilege = (key) => {
    setPermissionsForm(prev => {
      const nextVal = !prev[key];
      const nextState = { ...prev, [key]: nextVal };

      if (key === 'solo_lectura' && nextVal === true) {
        // Al pasar a Solo Lectura, desactiva automáticamente las acciones operativas
        nextState.puede_lanzar_llamadas = false;
        nextState.puede_enviar_mensajes = false;
        nextState.puede_crear_campanas = false;
        nextState.puede_editar_pacientes = false;
      } else if (key !== 'solo_lectura' && nextVal === true) {
        // Al otorgar cualquier privilegio activo, se desactiva Solo Lectura
        nextState.solo_lectura = false;
      }
      return nextState;
    });
  };

  // Toggle para formulario de crear nuevo personal
  const toggleNewStaffCursoVida = (cursoId) => {
    setNewStaff(prev => {
      const current = Array.isArray(prev.cursos_vida_asignados) ? [...prev.cursos_vida_asignados] : [];
      if (current.includes(cursoId)) {
        return { ...prev, cursos_vida_asignados: current.filter(id => id !== cursoId) };
      } else {
        return { ...prev, cursos_vida_asignados: [...current, cursoId] };
      }
    });
  };

  const clearNewStaffCursosVida = () => {
    setNewStaff(prev => ({ ...prev, cursos_vida_asignados: [] }));
  };

  // Filtros de tabla de personal
  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      const matchesSearch = 
        (s.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.especialidad || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.rol || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === 'todos' || (s.rol || 'Enfermera') === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [staffList, searchTerm, roleFilter]);

  // Cálculo estricto de pacientes asignados a un miembro de personal
  // REGLA CLÍNICA SADI: Si no tiene Cursos de Vida asignados ([]), tiene CERO pacientes (0).
  // Si tiene cursos asignados, tiene acceso a todos los pacientes de esos cursos, sin importar el grupo de riesgo.
  const getStaffAssignedPatients = (staff, patientsList = allPatients) => {
    if (!staff || !patientsList.length) return [];
    const cursos = Array.isArray(staff.cursos_vida_asignados) ? staff.cursos_vida_asignados : [];

    if (cursos.length === 0) return [];
    if (cursos.includes('todos')) return patientsList;

    return patientsList.filter(p => isPatientAssignedToDoctor(p, staff));
  };

  // Pacientes asignados al profesional seleccionado en el modal
  const assignedPatients = useMemo(() => {
    return getStaffAssignedPatients(viewingPatientsStaff, allPatients);
  }, [viewingPatientsStaff, allPatients]);

  const filteredAssignedPatients = useMemo(() => {
    if (!patientSearchTerm.trim()) return assignedPatients;
    const term = patientSearchTerm.toLowerCase();
    return assignedPatients.filter(p => 
      (p.nombre || '').toLowerCase().includes(term) ||
      (p.cc || '').includes(term) ||
      (p.telefono || '').includes(term)
    );
  }, [assignedPatients, patientSearchTerm]);

  return (
    <Layout>
      <Helmet>
        <title>SADI - Gestión de Personal y Enfermeras</title>
      </Helmet>

      <div className="space-y-6">

        {/* Cabecera Principal Homogénea SADI */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Gestión de Personal y Enfermeras
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Recurso humano clínico y demanda inducida •{' '}
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {staffList.length} profesionales vinculados (1 Enfermera Jefe)
                  </span>
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-600/20 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar Personal / Enfermera</span>
          </Button>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo, especialidad o rol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Filtrar por Rol:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos los Roles ({staffList.length})</option>
              <option value="Enfermera">Enfermeras Asistenciales</option>
              <option value="Enfermera Jefe">Enfermeras Jefes</option>
              <option value="Médico General">Médicos Generales</option>
              <option value="Especialista">Médicos Especialistas</option>
            </select>
          </div>
        </div>

        {/* Tabla de Personal en Lista: Nombre, Cursos de Vida Asignados y Alcance Clínico */}
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white font-bold text-[11px] tracking-wider uppercase">
                <tr>
                  <th className="p-4 whitespace-nowrap">Nombre / Profesional</th>
                  <th className="p-4 whitespace-nowrap">Cursos de Vida Asignados (Res. 3280)</th>
                  <th className="p-4 whitespace-nowrap">Alcance Clínico</th>
                  <th className="p-4 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-xs font-semibold">Cargando personal institucional...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-gray-400">
                      No se encontró personal con los filtros indicados.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const cursos = Array.isArray(staff.cursos_vida_asignados) ? staff.cursos_vida_asignados : [];
                    const isSinAsignacion = cursos.length === 0;
                    const isAllCursos = cursos.includes('todos');
                    const staffPatients = getStaffAssignedPatients(staff, allPatients);

                    return (
                      <tr key={staff.id} className="hover:bg-blue-50/40 transition-colors">
                        
                        {/* 1. Nombre (Clickeable -> Despliega lista de llamadas y transcripciones de sus pacientes) */}
                        <td className="p-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setViewingPatientsStaff(staff);
                              setPatientSearchTerm('');
                            }}
                            className="text-left group flex items-start gap-2.5 transition-transform active:scale-98"
                            title="Haz clic para ver los pacientes y llamadas de este profesional"
                          >
                            <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center font-black text-sm shrink-0 transition-colors shadow-xs">
                              {staff.nombre ? staff.nombre.charAt(0).toUpperCase() : 'P'}
                            </div>
                            <div>
                              <div className="font-black text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5 underline decoration-blue-200 group-hover:decoration-blue-500 text-xs">
                                <span>{staff.nombre}</span>
                                <Eye className="w-3.5 h-3.5 text-blue-500 opacity-60 group-hover:opacity-100" />
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black inline-flex items-center gap-1 ${
                                  staff.rol === 'Enfermera Jefe'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : staff.rol === 'Enfermera'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : staff.rol === 'Médico General'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-purple-100 text-purple-800 border border-purple-200'
                                }`}>
                                  {staff.rol || 'Enfermera'}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {staff.email}
                                </span>
                              </div>
                            </div>
                          </button>
                        </td>

                        {/* 2. Cursos de Vida Asignados (Clickeable -> Abre modal de Permisos) */}
                        <td 
                          className="p-4 max-w-sm cursor-pointer hover:bg-blue-50/70 transition-colors group"
                          onClick={() => openPermissionsModal(staff)}
                          title="Haz clic aquí para editar los Cursos de Vida y Permisos de este profesional"
                        >
                          {isSinAsignacion ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300 group-hover:border-blue-400 group-hover:text-blue-700 transition-colors">
                              <span className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-blue-500"></span>
                              <span>Sin Asignación (Clic para asignar)</span>
                            </span>
                          ) : isAllCursos ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black bg-blue-50 text-blue-900 border border-blue-300 group-hover:border-blue-500 transition-colors">
                              <span>★</span>
                              <span>Todos los Cursos de Vida (A - J)</span>
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {cursos.map(cId => {
                                const cfg = CURSO_VIDA_CONFIG[cId];
                                return (
                                  <span
                                    key={cId}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black border shadow-xs inline-flex items-center gap-1.5 transition-transform group-hover:scale-102 ${
                                      cfg ? cfg.badge : 'bg-gray-100 text-gray-800 border-gray-200'
                                    }`}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: cfg?.colorHex || '#64748B' }}
                                    />
                                    <span>{cfg ? `${cfg.letra}. ${cfg.nombre}` : cId}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* 3. Alcance Clínico */}
                        <td className="p-4 whitespace-nowrap">
                          {isSinAsignacion ? (
                            <div className="flex items-center gap-2 text-slate-400">
                              <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                              <span className="font-semibold text-xs text-slate-500">0 pacientes (Sin Asignación)</span>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span className="font-black text-slate-900 text-xs">{staffPatients.length} pacientes</span>
                              </div>
                              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 inline-block mt-0.5">
                                Universal a Grupos de Riesgo
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 4. Acciones */}
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* Botón Mejorar Permisos */}
                            <Button
                              size="sm"
                              onClick={() => openPermissionsModal(staff)}
                              className="h-8 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] gap-1 shadow-xs"
                              title="Configurar Cursos de Vida y Permisos"
                            >
                              <Shield className="w-3.5 h-3.5 text-amber-400" />
                              <span>Permisos</span>
                            </Button>

                            {/* Botón Editar Básico */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditModal(staff)}
                              className="h-8 px-2 text-gray-600 hover:text-gray-900 rounded-xl"
                              title="Editar datos básicos"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                            </Button>

                            {/* Botón Eliminar */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPersonToDelete(staff)}
                              className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                              title="Eliminar personal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL PRINCIPAL: PACIENTES, LLAMADAS, AUDIOS Y TRANSCRIPCIONES */}
      {/* ========================================================================= */}
      <Dialog open={!!viewingPatientsStaff} onOpenChange={() => setViewingPatientsStaff(null)}>
        <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] overflow-y-auto bg-slate-50 p-6 rounded-3xl">
          <DialogHeader className="border-b border-gray-200 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-md">
                  {viewingPatientsStaff?.nombre?.charAt(0) || 'P'}
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
                    Llamadas e Interacciones de {viewingPatientsStaff?.nombre}
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      assignedPatients.length === 0
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-blue-100 text-blue-800 border-blue-200'
                    }`}>
                      {assignedPatients.length === 0
                        ? '0 pacientes asignados (Sin Asignación)'
                        : `${assignedPatients.length} pacientes asignados`}
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-600 mt-0.5">
                    {viewingPatientsStaff?.rol} · {viewingPatientsStaff?.especialidad} · {viewingPatientsStaff?.email}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* TABLA DE PACIENTES: CICLOS DE VIDA, MENSAJES, LLAMADAS, GRABACIONES DE AUDIO Y TRANSCRIPCIONES */}
          <div className="mt-4">
            <StaffPatientInteractionsTable
              patients={assignedPatients}
              staff={viewingPatientsStaff}
              emptyMessage={`No hay pacientes asignados bajo los Cursos de Vida o Riesgos de ${viewingPatientsStaff?.nombre}.`}
            />
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-200 mt-4">
            <Button variant="outline" onClick={() => setViewingPatientsStaff(null)} className="text-xs font-bold">
              Cerrar Vista
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR NUEVO PERSONAL / ENFERMERA */}
      {/* ========================================================================= */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Agregar Personal Asistencial o Enfermera
            </DialogTitle>
            <DialogDescription>
              Configura los datos del profesional, asigna sus Cursos de Vida de la Resolución 3280 y define sus privilegios asistenciales.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStaff} className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bold text-gray-700">Nombre Completo:</Label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Enf. Luciana Ospina Castro"
                  value={newStaff.nombre}
                  onChange={(e) => setNewStaff({ ...newStaff, nombre: e.target.value })}
                  className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1 font-semibold focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <Label className="font-bold text-gray-700">Correo Institucional:</Label>
                <input
                  type="email"
                  required
                  placeholder="luciana.ospina@sadi.med.co"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1 font-semibold focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bold text-gray-700">Rol Institucional:</Label>
                <select
                  value={newStaff.rol}
                  onChange={(e) => setNewStaff({ ...newStaff, rol: e.target.value })}
                  className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1 font-bold focus:ring-2 focus:ring-blue-500"
                >
                  {ROLES_PERSONAL.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="font-bold text-gray-700">Especialidad / Área Asignada:</Label>
                <input
                  type="text"
                  placeholder="Ej. Demanda Inducida y Telemetría Primera Infancia"
                  value={newStaff.especialidad}
                  onChange={(e) => setNewStaff({ ...newStaff, especialidad: e.target.value })}
                  className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1 font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Asignación de Cursos de Vida */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
                  <Baby className="w-4 h-4 text-blue-600" />
                  Asignar Cursos de Vida (Res. 3280):
                </Label>
                <button
                  type="button"
                  onClick={clearNewStaffCursosVida}
                  className="text-[10px] text-slate-500 hover:text-slate-800 font-bold underline"
                >
                  Limpiar / Sin Asignación
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {CURSOS_VIDA_LIST.filter(c => c.id !== 'todos' && c.id !== 'sin_asignacion').map(c => {
                  const isChecked = newStaff.cursos_vida_asignados.includes('todos') || newStaff.cursos_vida_asignados.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleNewStaffCursoVida(c.id)}
                      className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all select-none ${
                        isChecked 
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-md text-white font-black text-[10px] flex items-center justify-center shrink-0"
                        style={{ backgroundColor: c.colorHex }}
                      >
                        {c.letra}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold block text-[11px] truncate">{c.nombre}</span>
                        <span className="text-[10px] text-gray-400 block truncate">{c.rango}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-blue-600 pointer-events-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAction} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {savingAction ? 'Registrando...' : 'Registrar Personal'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: EDITAR INFORMACIÓN BÁSICA */}
      {/* ========================================================================= */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900">Editar Datos de Personal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateStaffInfo} className="space-y-3 pt-2 text-xs">
            <div>
              <Label className="font-bold text-gray-700">Nombre:</Label>
              <input
                type="text"
                required
                value={editStaff.nombre}
                onChange={(e) => setEditStaff({ ...editStaff, nombre: e.target.value })}
                className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1 font-semibold"
              />
            </div>
            <div>
              <Label className="font-bold text-gray-700">Correo:</Label>
              <input
                type="email"
                required
                value={editStaff.email}
                onChange={(e) => setEditStaff({ ...editStaff, email: e.target.value })}
                className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1 font-semibold"
              />
            </div>
            <div>
              <Label className="font-bold text-gray-700">Rol:</Label>
              <select
                value={editStaff.rol}
                onChange={(e) => setEditStaff({ ...editStaff, rol: e.target.value })}
                className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1 font-bold"
              >
                {ROLES_PERSONAL.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="font-bold text-gray-700">Especialidad:</Label>
              <input
                type="text"
                value={editStaff.especialidad}
                onChange={(e) => setEditStaff({ ...editStaff, especialidad: e.target.value })}
                className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAction} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {savingAction ? 'Guardando...' : 'Actualizar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: MEJORAR PERMISOS & ASIGNACIÓN DE CURSOS DE VIDA */}
      {/* ========================================================================= */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Mejorar Permisos & Asignaciones: {selectedStaff?.nombre}
            </DialogTitle>
            <DialogDescription>
              Configura los Cursos de Vida que este profesional podrá visualizar y gestionar (Resolución 3280 de 2018). Tendrá acceso universal a todos los grupos de riesgo dentro de los cursos asignados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            
            {/* Cursos de Vida Asignados */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/80">
                <div>
                  <Label className="font-black text-slate-900 flex items-center gap-2 text-xs">
                    <Baby className="w-4 h-4 text-blue-600" />
                    Cursos de Vida Permitidos (Restricción de Pacientes):
                  </Label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Si no tiene cursos asignados, el profesional no tendrá pacientes bajo su cargo (0 pacientes).
                  </p>
                </div>

                {/* Acciones Rápidas */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={setAllCursosVida}
                    className="h-7 text-[10px] font-bold px-2.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    ★ Acceso Total (A - J)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={clearCursosVida}
                    className="h-7 text-[10px] font-bold px-2.5 border-slate-300 text-slate-600 hover:bg-slate-100"
                  >
                    ⚪ Dejar Sin Asignación (0 pac.)
                  </Button>
                </div>
              </div>

              {/* Estado actual de asignación */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Estado de Asignación:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[11px] ${
                  permissionsForm.cursos_vida_asignados.length === 0
                    ? 'bg-slate-100 text-slate-700 border border-slate-300'
                    : (permissionsForm.cursos_vida_asignados.includes('todos') || permissionsForm.cursos_vida_asignados.length >= 10)
                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}>
                  {formatCursosVidaLabel(permissionsForm.cursos_vida_asignados)}
                </span>
              </div>

              {/* Cuadrícula de Cursos de Vida */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Opción 1: ★ Todos los Cursos de Vida (Acceso Total) */}
                {(() => {
                  const isAllChecked = permissionsForm.cursos_vida_asignados.includes('todos') || 
                    (permissionsForm.cursos_vida_asignados.length >= 10 && ALL_10_CURSOS_IDS.every(id => permissionsForm.cursos_vida_asignados.includes(id)));
                  return (
                    <button
                      type="button"
                      onClick={() => toggleCursoVida('todos')}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-left select-none sm:col-span-2 ${
                        isAllChecked 
                          ? 'bg-blue-50/90 shadow-xs ring-2 ring-blue-600 border-transparent font-bold' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0 bg-blue-600">
                          ★
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold block text-xs text-slate-900 truncate">★. Todos los Cursos de Vida</span>
                          <span className="text-[10px] text-slate-500 font-medium block truncate">Acceso Total a las 10 Rutas Integrales de Atención (A - J)</span>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ml-2 ${
                        isAllChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isAllChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })()}

                {CURSOS_VIDA_LIST.filter(c => c.id !== 'todos' && c.id !== 'sin_asignacion').map(c => {
                  const isChecked = permissionsForm.cursos_vida_asignados.includes('todos') || permissionsForm.cursos_vida_asignados.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCursoVida(c.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-left select-none ${
                        isChecked 
                          ? 'bg-blue-50/70 shadow-xs ring-2 ring-blue-500 border-transparent font-bold' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0"
                          style={{ backgroundColor: c.colorHex }}
                        >
                          {c.letra}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold block text-xs text-slate-900 truncate">{c.nombre}</span>
                          <span className="text-[10px] text-slate-500 font-medium block truncate">{c.rango}</span>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ml-2 ${
                        isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permisos de Interacción y Acciones Asistenciales */}
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-amber-200/70">
                <div>
                  <Label className="font-black text-amber-900 flex items-center gap-1.5 text-xs">
                    <Key className="w-4 h-4 text-amber-600" />
                    Privilegios de Operación Asistencial:
                  </Label>
                  <p className="text-[11px] text-amber-800/80 mt-0.5">
                    Configura libremente las acciones que el profesional puede ejecutar sobre sus pacientes.
                  </p>
                </div>

                {/* Acciones Rápidas Privilegios */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={setAllPrivileges}
                    className="h-7 text-[10px] font-bold px-2.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 bg-white"
                  >
                    ★ Activar Todos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={setReadOnlyOnly}
                    className="h-7 text-[10px] font-bold px-2.5 border-amber-300 text-amber-800 hover:bg-amber-100 bg-white"
                  >
                    🔒 Solo Lectura
                  </Button>
                </div>
              </div>

              {/* Lista interactiva de privilegios */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                
                {/* 1. Modo Solo Lectura */}
                <button
                  type="button"
                  onClick={() => togglePrivilege('solo_lectura')}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-left select-none ${
                    permissionsForm.solo_lectura
                      ? 'bg-amber-100/80 border-amber-300 ring-2 ring-amber-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${permissionsForm.solo_lectura ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">Modo Solo Lectura (Consulta)</span>
                      <span className="text-[11px] text-slate-500 font-normal block leading-tight mt-0.5">
                        Solo puede consultar citas, expedientes y alertas clínicas sin realizar llamadas ni envíos.
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ml-3 ${
                    permissionsForm.solo_lectura ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 bg-white'
                  }`}>
                    {permissionsForm.solo_lectura && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </button>

                {/* 2. Permitir Llamadas en Vivo */}
                <button
                  type="button"
                  onClick={() => togglePrivilege('puede_lanzar_llamadas')}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-left select-none ${
                    permissionsForm.puede_lanzar_llamadas
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${permissionsForm.puede_lanzar_llamadas ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <PhoneCall className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">Permitir Llamadas en Vivo (GSM Puerto 22)</span>
                      <span className="text-[11px] text-slate-500 font-normal block leading-tight mt-0.5">
                        Habilita el botón de llamada individual y enlace con el Agente IA para sus pacientes.
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ml-3 ${
                    permissionsForm.puede_lanzar_llamadas ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                  }`}>
                    {permissionsForm.puede_lanzar_llamadas && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </button>

                {/* 3. Permitir Envío de Mensajes */}
                <button
                  type="button"
                  onClick={() => togglePrivilege('puede_enviar_mensajes')}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-left select-none ${
                    permissionsForm.puede_enviar_mensajes
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${permissionsForm.puede_enviar_mensajes ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">Permitir Envío de Mensajes (SMS, WhatsApp, Email)</span>
                      <span className="text-[11px] text-slate-500 font-normal block leading-tight mt-0.5">
                        Autoriza el despacho de notificaciones y recordatorios preventivos a los pacientes.
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ml-3 ${
                    permissionsForm.puede_enviar_mensajes ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                  }`}>
                    {permissionsForm.puede_enviar_mensajes && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </button>

                {/* 4. Permitir Crear y Gestionar Campañas */}
                <button
                  type="button"
                  onClick={() => togglePrivilege('puede_crear_campanas')}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-left select-none ${
                    permissionsForm.puede_crear_campanas
                      ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${permissionsForm.puede_crear_campanas ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">Permitir Crear y Gestionar Campañas</span>
                      <span className="text-[11px] text-slate-500 font-normal block leading-tight mt-0.5">
                        Habilita la creación y programación de campañas masivas para sus Cursos de Vida.
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ml-3 ${
                    permissionsForm.puede_crear_campanas ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                  }`}>
                    {permissionsForm.puede_crear_campanas && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </button>

                {/* 5. Permitir Modificar / Editar Pacientes */}
                <button
                  type="button"
                  onClick={() => togglePrivilege('puede_editar_pacientes')}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-left select-none ${
                    permissionsForm.puede_editar_pacientes
                      ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${permissionsForm.puede_editar_pacientes ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">Permitir Editar y Gestionar Pacientes</span>
                      <span className="text-[11px] text-slate-500 font-normal block leading-tight mt-0.5">
                        Autoriza la actualización de historias clínicas, datos demográficos y antecedentes.
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ml-3 ${
                    permissionsForm.puede_editar_pacientes ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 bg-white'
                  }`}>
                    {permissionsForm.puede_editar_pacientes && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </button>

              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowPermissionsDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSavePermissions} disabled={savingAction} className="bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                {savingAction ? 'Actualizando...' : 'Guardar y Aplicar Permisos'}
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 4: ALERTA ELIMINAR */}
      {/* ========================================================================= */}
      <AlertDialog open={!!personToDelete} onOpenChange={() => setPersonToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro de personal?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción revocará los accesos de <strong>{personToDelete?.nombre}</strong> ({personToDelete?.email}) al sistema asistencial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStaff} className="bg-red-600 hover:bg-red-700">
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}
