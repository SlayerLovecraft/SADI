import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { 
  UserCheck, Plus, Search, Trash2, Edit3, Shield, Key, Lock, Unlock,
  PhoneCall, MessageSquare, Send, CheckCircle2, AlertCircle, HeartPulse,
  Baby, Sparkles, Eye, UserX, Check, X, ShieldAlert, Award
} from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { staffService } from '@/services/staffService';
import { CURSOS_DE_VIDA_3280 } from '@/services/rias3280Catalog';
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

// Catálogo ampliado de los 10 Cursos de Vida (A a J) de la Resolución 3280
const CURSOS_VIDA_OPTIONS = [
  { id: 'todos', letra: '★', nombre: 'Todos los Cursos de Vida', edad: 'Acceso Total' },
  { id: 'primera_infancia', letra: 'A', nombre: 'Primera Infancia', edad: '7 días a 5 años' },
  { id: 'infancia', letra: 'B', nombre: 'Infancia', edad: '6 a 11 años' },
  { id: 'adolescencia', letra: 'C', nombre: 'Adolescencia', edad: '12 a 17 años' },
  { id: 'juventud', letra: 'D', nombre: 'Juventud', edad: '18 a 28 años' },
  { id: 'adultez', letra: 'E', nombre: 'Adultez', edad: '29 a 59 años' },
  { id: 'vejez', letra: 'F', nombre: 'Vejez', edad: '60 años o más' },
  { id: 'preventivo_mujer', letra: 'G', nombre: 'Preventivo de la Mujer', edad: 'Ruta RIAMP & Ca Cuello/Mama' },
  { id: 'planificacion_familiar', letra: 'H', nombre: 'Planificación Familiar', edad: 'Salud Reproductiva' },
  { id: 'vacunacion', letra: 'I', nombre: 'Vacunación', edad: 'Esquema PAI Permanente' },
  { id: 'salud_oral', letra: 'J', nombre: 'Salud Oral', edad: 'Fluorización & Control Bucal' }
];

const ROLES_PERSONAL = [
  { value: 'Enfermera', label: 'Enfermera Asistencial (Demanda Inducida)' },
  { value: 'Enfermera Jefe', label: 'Enfermera Jefe (Coordinación de Ruta)' },
  { value: 'Médico General', label: 'Médico General (Consulta & Triage)' },
  { value: 'Especialista', label: 'Médico Especialista (Pediatría, Gineco, etc.)' }
];

export default function DoctorsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [staffList, setStaffList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [loading, setLoading] = useState(true);

  // Modales
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [personToDelete, setPersonToDelete] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Formulario Nuevo Personal
  const [newStaff, setNewStaff] = useState({
    nombre: '',
    email: '',
    password: 'sadi' + Math.floor(1000 + Math.random() * 9000),
    rol: 'Enfermera',
    especialidad: 'Atención Primaria y Demanda Inducida 3280',
    cursos_vida_asignados: ['primera_infancia'],
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

  // Formulario "Mejorar Permisos & Cursos de Vida"
  const [permissionsForm, setPermissionsForm] = useState({
    cursos_vida_asignados: ['todos'],
    solo_lectura: true,
    puede_lanzar_llamadas: false,
    puede_enviar_mensajes: false,
    puede_crear_campanas: false,
    puede_editar_pacientes: false
  });

  const [savingAction, setSavingAction] = useState(false);

  const loadStaff = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await staffService.getAll();
      if (res.success) {
        setStaffList(res.data || []);
      } else {
        toast({
          title: "Error al cargar personal",
          description: res.error || "No se pudo conectar con la base de datos.",
          variant: "destructive"
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
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
        cursos_vida_asignados: newStaff.cursos_vida_asignados,
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
          cursos_vida_asignados: ['primera_infancia'],
          solo_lectura: true,
          puede_lanzar_llamadas: false,
          puede_enviar_mensajes: false,
          puede_crear_campanas: false,
          puede_editar_pacientes: false
        });
        await loadStaff(false);
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
        await loadStaff(false);
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
    setPermissionsForm({
      cursos_vida_asignados: staff.cursos_vida_asignados || ['todos'],
      solo_lectura: staff.solo_lectura !== undefined ? staff.solo_lectura : true,
      puede_lanzar_llamadas: staff.puede_lanzar_llamadas || false,
      puede_enviar_mensajes: staff.puede_enviar_mensajes || false,
      puede_crear_campanas: staff.puede_crear_campanas || false,
      puede_editar_pacientes: staff.puede_editar_pacientes || false
    });
    setShowPermissionsDialog(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedStaff) return;
    setSavingAction(true);
    try {
      const res = await staffService.update(selectedStaff.id, {
        cursos_vida_asignados: permissionsForm.cursos_vida_asignados,
        solo_lectura: permissionsForm.solo_lectura,
        puede_lanzar_llamadas: permissionsForm.puede_lanzar_llamadas,
        puede_enviar_mensajes: permissionsForm.puede_enviar_mensajes,
        puede_crear_campanas: permissionsForm.puede_crear_campanas,
        puede_editar_pacientes: permissionsForm.puede_editar_pacientes
      });

      if (res.success) {
        toast({
          title: "🛡️ Permisos y Cursos de Vida actualizados",
          description: `Se han reconfigurado las restricciones de acceso para ${selectedStaff.nombre}.`
        });
        setShowPermissionsDialog(false);
        setSelectedStaff(null);
        await loadStaff(false);
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
        toast({ title: "🗑️ Personal eliminado", description: "Se ha removido el registro del sistema." });
        setPersonToDelete(null);
        await loadStaff(false);
      } else {
        toast({ title: "Error al eliminar", description: res.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Toggle de Cursos de Vida en el formulario
  const toggleCursoVida = (cursoId, formState, setFormState) => {
    let current = [...formState.cursos_vida_asignados];
    if (cursoId === 'todos') {
      current = ['todos'];
    } else {
      current = current.filter(c => c !== 'todos');
      if (current.includes(cursoId)) {
        current = current.filter(c => c !== cursoId);
        if (current.length === 0) current = ['todos'];
      } else {
        current.push(cursoId);
      }
    }
    setFormState({ ...formState, cursos_vida_asignados: current });
  };

  // Filtros de tabla
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

  return (
    <Layout>
      <Helmet>
        <title>SADI - Gestión de Personal y Enfermeras</title>
      </Helmet>

      <div className="space-y-6">

        {/* Cabecera Principal */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest">
              <UserCheck className="h-4 w-4" />
              Recurso Humano Clínico & Demanda Inducida
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Gestión de Personal y Enfermeras
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Asignación de Cursos de Vida (A a J), control de visibilidad de pacientes y administración de permisos de interacción (Solo Lectura, Llamadas GSM Puerto 22, Mensajería y Campañas).
            </p>
          </div>

          <Button
            onClick={() => setShowAddDialog(true)}
            className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 gap-2 shadow-md shrink-0"
          >
            <Plus className="h-4 w-4" />
            Agregar Personal / Enfermera
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

        {/* Tabla de Personal */}
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white font-bold text-[11px] tracking-wider">
                <tr>
                  <th className="p-4">Profesional</th>
                  <th className="p-4">Rol & Especialidad</th>
                  <th className="p-4">Cursos de Vida Asignados</th>
                  <th className="p-4 text-center">Permisos de Interacción</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-xs font-semibold">Cargando personal institucional...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-400">
                      No se encontró personal con los filtros indicados.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const isNurse = (staff.rol || '').toLowerCase().includes('enferm');
                    const cursos = staff.cursos_vida_asignados || ['todos'];
                    const isAllCursos = cursos.includes('todos');

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                        
                        {/* Profesional */}
                        <td className="p-4 whitespace-nowrap">
                          <div className="font-black text-gray-900 flex items-center gap-2">
                            <span>{staff.nombre}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                            {staff.email}
                          </div>
                        </td>

                        {/* Rol & Especialidad */}
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                            isNurse
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-purple-100 text-purple-800 border border-purple-300'
                          }`}>
                            <Award className="w-3 h-3" />
                            {staff.rol || 'Enfermera'}
                          </span>
                          <p className="text-[11px] text-gray-600 font-medium mt-1 truncate max-w-xs" title={staff.especialidad}>
                            {staff.especialidad}
                          </p>
                        </td>

                        {/* Cursos de Vida Asignados */}
                        <td className="p-4 max-w-xs">
                          {isAllCursos ? (
                            <span className="bg-blue-50 text-blue-800 px-2.5 py-1 rounded-xl text-[10px] font-bold border border-blue-200">
                              ★ Todos los Cursos de Vida (Censo Global)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {cursos.map(cId => {
                                const opt = CURSOS_VIDA_OPTIONS.find(o => o.id === cId);
                                return (
                                  <span key={cId} className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-200">
                                    {opt ? `${opt.letra}. ${opt.nombre}` : cId}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Permisos de Interacción */}
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {staff.solo_lectura ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" /> Solo Lectura
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <Unlock className="w-2.5 h-2.5" /> Interactivo
                              </span>
                            )}

                            {staff.puede_lanzar_llamadas && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                <PhoneCall className="w-2.5 h-2.5" /> Llamadas
                              </span>
                            )}

                            {staff.puede_enviar_mensajes && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                                <MessageSquare className="w-2.5 h-2.5" /> Mensajes
                              </span>
                            )}

                            {staff.puede_crear_campanas && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                <Send className="w-2.5 h-2.5" /> Campañas
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* Botón Mejorar Permisos */}
                            <Button
                              size="sm"
                              onClick={() => openPermissionsModal(staff)}
                              className="h-8 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] gap-1 shadow-xs"
                              title="Mejorar permisos y cambiar cursos de vida"
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
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>

                            {/* Botón Eliminar */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPersonToDelete(staff)}
                              className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                              title="Eliminar del personal"
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
      {/* MODAL 1: REGISTRAR NUEVO PERSONAL / ENFERMERA */}
      {/* ========================================================================= */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Agregar Personal Asistencial o Enfermera
            </DialogTitle>
            <DialogDescription>
              Configura los datos del profesional, asigna sus Cursos de Vida de atención y define sus permisos de Demanda Inducida.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStaff} className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bold text-gray-700">Nombre Completo:</Label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Enf. Sandra Milena Castaño"
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
                  placeholder="sandra.castano@sadi.med.co"
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
                  placeholder="Ej. Coordinación Primera Infancia Res. 3280"
                  value={newStaff.especialidad}
                  onChange={(e) => setNewStaff({ ...newStaff, especialidad: e.target.value })}
                  className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1 font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Asignación de Cursos de Vida */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-black text-slate-800 flex items-center gap-1.5">
                  <Baby className="w-4 h-4 text-emerald-600" />
                  Asignar Cursos de Vida (La enfermera solo verá a estos pacientes):
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {CURSOS_VIDA_OPTIONS.map(c => {
                  const isChecked = newStaff.cursos_vida_asignados.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      onClick={() => toggleCursoVida(c.id, newStaff, setNewStaff)}
                      className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-blue-600 pointer-events-none"
                      />
                      <div>
                        <span className="font-bold block text-[11px]">{c.letra}. {c.nombre}</span>
                        <span className="text-[10px] text-gray-400">{c.edad}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Permisos de Interacción */}
            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 space-y-2">
              <Label className="font-black text-amber-900 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-amber-600" />
                Permisos de Interacción con Pacientes:
              </Label>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Por defecto el personal tiene <strong>Solo Lectura</strong> para revisar citas y recepción de llamadas. Marca los permisos si deseas autorizarla a interactuar.
              </p>

              <div className="space-y-2 pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={newStaff.solo_lectura}
                    onChange={(e) => setNewStaff({ ...newStaff, solo_lectura: e.target.checked })}
                    className="rounded text-amber-600"
                  />
                  <span>Modo Solo Lectura (No puede modificar pacientes ni disparar campañas sin autorización)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-gray-800">
                  <input
                    type="checkbox"
                    checked={newStaff.puede_lanzar_llamadas}
                    onChange={(e) => setNewStaff({ ...newStaff, puede_lanzar_llamadas: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Autorizar a emitir <strong>Llamadas en Vivo (GSM Puerto 22)</strong></span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-gray-800">
                  <input
                    type="checkbox"
                    checked={newStaff.puede_enviar_mensajes}
                    onChange={(e) => setNewStaff({ ...newStaff, puede_enviar_mensajes: e.target.checked })}
                    className="rounded text-green-600"
                  />
                  <span>Autorizar envío de <strong>SMS, WhatsApp y E-mails</strong></span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-gray-800">
                  <input
                    type="checkbox"
                    checked={newStaff.puede_crear_campanas}
                    onChange={(e) => setNewStaff({ ...newStaff, puede_crear_campanas: e.target.checked })}
                    className="rounded text-purple-600"
                  />
                  <span>Autorizar a <strong>Crear y Despachar Campañas</strong></span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAction} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {savingAction ? 'Guardando...' : 'Crear Registro de Personal'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: MEJORAR PERMISOS & ASIGNACIÓN DE CURSOS DE VIDA */}
      {/* ========================================================================= */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Mejorar Permisos y Cursos de Vida • {selectedStaff?.nombre}
            </DialogTitle>
            <DialogDescription>
              Ajusta qué pacientes puede ver esta enfermera y qué canales de interacción tiene habilitados para operar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">

            {/* Selector de Cursos de Vida */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <Label className="font-black text-slate-800 flex items-center gap-1.5">
                <Baby className="w-4 h-4 text-emerald-600" />
                Cursos de Vida Asignados:
              </Label>
              <p className="text-[11px] text-slate-500">
                La enfermera <strong>únicamente verá</strong> en su portal a los pacientes pertenecientes a los grupos marcados:
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {CURSOS_VIDA_OPTIONS.map(c => {
                  const isChecked = permissionsForm.cursos_vida_asignados.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      onClick={() => toggleCursoVida(c.id, permissionsForm, setPermissionsForm)}
                      className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-blue-600 pointer-events-none"
                      />
                      <div>
                        <span className="font-bold block text-[11px]">{c.letra}. {c.nombre}</span>
                        <span className="text-[10px] text-gray-400">{c.edad}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Permisos de Interacción y Acciones */}
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-3">
              <Label className="font-black text-amber-900 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-600" />
                Privilegios de Operación Asistencial:
              </Label>

              <div className="space-y-2.5 text-xs">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-gray-800 bg-white p-2.5 rounded-xl border border-amber-200">
                  <input
                    type="checkbox"
                    checked={permissionsForm.solo_lectura}
                    onChange={(e) => setPermissionsForm({ ...permissionsForm, solo_lectura: e.target.checked })}
                    className="rounded text-amber-600"
                  />
                  <div>
                    <span className="block">Modo Solo Lectura</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                      Por defecto. Solo puede consultar citas, estados de llamadas y datos clínicos sin intervenir.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-gray-800 bg-white p-2.5 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    checked={permissionsForm.puede_lanzar_llamadas}
                    onChange={(e) => setPermissionsForm({ ...permissionsForm, puede_lanzar_llamadas: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold block text-blue-900">Permitir Llamadas en Vivo (GSM Puerto 22)</span>
                    <span className="text-[10px] text-gray-500 font-normal">
                      Habilita el botón de llamada individual y enlace con el Agente IA para sus pacientes asignados.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-gray-800 bg-white p-2.5 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    checked={permissionsForm.puede_enviar_mensajes}
                    onChange={(e) => setPermissionsForm({ ...permissionsForm, puede_enviar_mensajes: e.target.checked })}
                    className="rounded text-green-600"
                  />
                  <div>
                    <span className="font-bold block text-green-900">Permitir Envío de Mensajes (SMS, WhatsApp, E-mail)</span>
                    <span className="text-[10px] text-gray-500 font-normal">
                      Autoriza el despacho de notificaciones y recordatorios preventivos a los pacientes asignados.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-gray-800 bg-white p-2.5 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    checked={permissionsForm.puede_crear_campanas}
                    onChange={(e) => setPermissionsForm({ ...permissionsForm, puede_crear_campanas: e.target.checked })}
                    className="rounded text-purple-600"
                  />
                  <div>
                    <span className="font-bold block text-purple-900">Permitir Crear y Gestionar Campañas</span>
                    <span className="text-[10px] text-gray-500 font-normal">
                      Habilita el botón de crear campañas masivas para los cursos de vida que tiene asignados.
                    </span>
                  </div>
                </label>
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
      {/* MODAL 3: EDITAR INFORMACIÓN BÁSICA */}
      {/* ========================================================================= */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-gray-900">
              Editar Datos Básicos • {selectedStaff?.nombre}
            </DialogTitle>
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
              <Label className="font-bold text-gray-700">Especialidad / Área:</Label>
              <input
                type="text"
                value={editStaff.especialidad}
                onChange={(e) => setEditStaff({ ...editStaff, especialidad: e.target.value })}
                className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1"
              />
            </div>

            <div>
              <Label className="font-bold text-gray-700">Nueva Contraseña (Opcional):</Label>
              <input
                type="password"
                placeholder="Dejar en blanco si no se desea cambiar"
                value={editStaff.password}
                onChange={(e) => setEditStaff({ ...editStaff, password: e.target.value })}
                className="w-full p-2 text-xs rounded-xl border border-gray-200 mt-1 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAction} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {savingAction ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* ALERT DIALOG: CONFIRMAR ELIMINACIÓN */}
      {/* ========================================================================= */}
      <AlertDialog open={!!personToDelete} onOpenChange={() => setPersonToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black text-gray-900">
              ¿Eliminar a {personToDelete?.nombre}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-500">
              Esta acción revocará todos los permisos de acceso y desvinculará a este profesional del hospital.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStaff} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}
