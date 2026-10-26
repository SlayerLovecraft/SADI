import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Edit, Plus, Search, Stethoscope, Trash2, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import CSVUploadDialog from '@/components/CSVUploadDialog';
import { staffService } from '@/services/staffService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const specialtyOptions = [
  { value: 'cardiologo', label: 'Cardiólogo' },
  { value: 'obstetra', label: 'Obstetra' },
  { value: 'general', label: 'General' },
  { value: 'radiologo', label: 'Radiólogo' },
  { value: 'neurologico', label: 'Neurólogo' },
  { value: 'pediatra', label: 'Pediatra' },
  { value: 'traumatologo', label: 'Traumatólogo' },
  { value: 'ginecologo', label: 'Ginecólogo' },
  { value: 'oncologo', label: 'Oncólogo' },
  { value: 'dermatologo', label: 'Dermatólogo' },
];

const DEFAULT_SCHEDULE = {
  timezone: 'America/Bogota',
  slot_minutes: 30,
  workdays: [1, 2, 3, 4, 5],
  morning_start: '05:00',
  morning_end: '11:00',
  afternoon_start: '14:00',
  afternoon_end: '20:00',
};

const DoctorsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [doctors, setDoctors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const [newDoctor, setNewDoctor] = useState({
    nombre: '',
    email: '',
    password: '',
    especialidad: 'general',
  });

  const [editDoctor, setEditDoctor] = useState({
    nombre: '',
    email: '',
    password: '',
    especialidad: 'general',
  });

  const [editSchedule, setEditSchedule] = useState(DEFAULT_SCHEDULE);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [generatingDoctors, setGeneratingDoctors] = useState(false);

  const loadDoctors = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await staffService.getAll();
      if (result.success) {
        setDoctors(result.data || []);
      } else {
        toast({
          title: 'Error al cargar doctores',
          description: result.error || 'No se pudieron cargar los datos',
          variant: 'destructive',
        });
        setDoctors([]);
      }
    } catch (error) {
      toast({
        title: 'Error de conexión',
        description: error?.message || 'No se pudo conectar con la base de datos',
        variant: 'destructive',
      });
      setDoctors([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, [user?.role, user?.hospitalId]);

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await staffService.create(newDoctor);
      if (result.success) {
        toast({ title: '✅ Doctor creado', description: 'El doctor fue agregado a la tabla de staff.' });
        setShowAddDialog(false);
        setNewDoctor({ nombre: '', email: '', password: '', especialidad: 'general' });
        await loadDoctors(false);
      } else {
        toast({
          title: 'Error al crear doctor',
          description: result.error || 'No se pudo crear el doctor',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error al crear doctor',
        description: error?.message || 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (doctor) => {
    setSelectedDoctor(doctor);
    setEditDoctor({
      nombre: doctor?.nombre || '',
      email: doctor?.email || '',
      password: '',
      especialidad: doctor?.especialidad || 'general',
    });
    setEditSchedule(DEFAULT_SCHEDULE);
    setScheduleLoading(true);
    supabase
      .from('doctor_schedules')
      .select('timezone, slot_minutes, workdays, morning_start, morning_end, afternoon_start, afternoon_end')
      .eq('doctor_id', doctor?.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          setEditSchedule({
            timezone: data.timezone || DEFAULT_SCHEDULE.timezone,
            slot_minutes: data.slot_minutes || DEFAULT_SCHEDULE.slot_minutes,
            workdays: data.workdays || DEFAULT_SCHEDULE.workdays,
            morning_start: data.morning_start ? String(data.morning_start).slice(0, 5) : DEFAULT_SCHEDULE.morning_start,
            morning_end: data.morning_end ? String(data.morning_end).slice(0, 5) : DEFAULT_SCHEDULE.morning_end,
            afternoon_start: data.afternoon_start ? String(data.afternoon_start).slice(0, 5) : DEFAULT_SCHEDULE.afternoon_start,
            afternoon_end: data.afternoon_end ? String(data.afternoon_end).slice(0, 5) : DEFAULT_SCHEDULE.afternoon_end,
          });
        }
      })
      .finally(() => setScheduleLoading(false));
    setShowEditDialog(true);
  };

  const handleEditDoctor = async (e) => {
    e.preventDefault();
    if (!selectedDoctor) return;

    setUpdating(true);
    try {
      const result = await staffService.update(selectedDoctor.id, editDoctor);
      if (result.success) {
        const hospitalIdToPersist = user?.role === 'super_admin' ? selectedDoctor?.hospitalId || null : user?.hospitalId || null;
        setScheduleLoading(true);
        const { error: scheduleError } = await supabase
          .from('doctor_schedules')
          .upsert(
            [
              {
                doctor_id: selectedDoctor.id,
                hospital_id: hospitalIdToPersist,
                timezone: editSchedule.timezone || DEFAULT_SCHEDULE.timezone,
                slot_minutes: Number(editSchedule.slot_minutes || DEFAULT_SCHEDULE.slot_minutes),
                workdays: editSchedule.workdays || DEFAULT_SCHEDULE.workdays,
                morning_start: editSchedule.morning_start || DEFAULT_SCHEDULE.morning_start,
                morning_end: editSchedule.morning_end || DEFAULT_SCHEDULE.morning_end,
                afternoon_start: editSchedule.afternoon_start || DEFAULT_SCHEDULE.afternoon_start,
                afternoon_end: editSchedule.afternoon_end || DEFAULT_SCHEDULE.afternoon_end,
                updated_at: new Date().toISOString(),
              },
            ],
            { onConflict: 'doctor_id' }
          );
        setScheduleLoading(false);

        if (scheduleError) {
          toast({
            title: 'Error guardando horario',
            description: scheduleError.message || 'No se pudo guardar el horario del doctor',
            variant: 'destructive',
          });
          setUpdating(false);
          return;
        }

        toast({ title: '✅ Doctor actualizado', description: 'Los datos se han actualizado exitosamente.' });
        setShowEditDialog(false);
        setSelectedDoctor(null);
        await loadDoctors();
      } else {
        toast({
          title: 'Error al actualizar doctor',
          description: result.error || 'No se pudo actualizar el doctor',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error al actualizar doctor',
        description: error?.message || 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
      setScheduleLoading(false);
    }
  };

  const handleDeleteDoctor = async () => {
    if (!doctorToDelete) return;
    try {
      const result = await staffService.delete(doctorToDelete.id);
      if (result.success) {
        toast({ title: '✅ Doctor eliminado', description: 'El doctor ha sido eliminado exitosamente.' });
        setDoctorToDelete(null);
        await loadDoctors();
      } else {
        toast({
          title: 'Error al eliminar doctor',
          description: result.error || 'No se pudo eliminar el doctor',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error al eliminar doctor',
        description: error?.message || 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    }
  };

  const subtitle = useMemo(() => {
    if (!user) return '';
    if (user.role === 'super_admin') return `Base de datos global (${doctors.length} doctores)`;
    return `Doctores de tu hospital (${doctors.length})`;
  }, [user, doctors.length]);

  const filteredDoctors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((d) => {
      const email = (d.email || '').toLowerCase();
      const nombre = (d.nombre || '').toLowerCase();
      const especialidad = (d.especialidad || '').toLowerCase();
      const hospitalId = (d.hospitalId || '').toString().toLowerCase();
      return email.includes(q) || nombre.includes(q) || especialidad.includes(q) || hospitalId.includes(q);
    });
  }, [doctors, searchTerm]);

  const handleGenerateDoctors = async () => {
    setGeneratingDoctors(true);
    try {
      const N = 32;
      const lastNames = ['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera'];
      const firstNames = ['Juan', 'Carlos', 'Andrés', 'Luis', 'Jorge', 'Miguel', 'Sebastián', 'Diego', 'Daniel', 'Camilo', 'María', 'Laura', 'Ana', 'Paola', 'Natalia'];
      
      const newDoctors = Array.from({ length: N }, (_, i) => {
        const first = firstNames[i % firstNames.length];
        const last = `${lastNames[i % lastNames.length]} ${lastNames[(i + 5) % lastNames.length]}`;
        const nombre = `${first} ${last}`;
        const email = `doctor${String(i + 1).padStart(3, '0')}@sadi.com.co`;
        const especialidad = specialtyOptions[i % specialtyOptions.length].value;
        
        return {
          nombre,
          email,
          password: 'password123',
          especialidad,
          is_active: true
        };
      });

      toast({
        title: "Generando doctores",
        description: `Creando ${N} registros...`,
      });

      const result = await staffService.createBulk(newDoctors, { batchSize: 10 });
      
      if (result.success) {
        toast({
          title: "✅ Doctores generados",
          description: `Se crearon ${result.successCount} doctores exitosamente.`,
        });
        await loadDoctors(false);
      } else {
        toast({
          title: "Error generando doctores",
          description: result.error || "No se pudo completar la operación",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err?.message || "Fallo al generar doctores",
        variant: "destructive",
      });
    } finally {
      setGeneratingDoctors(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Cargando doctores...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Doctores - SADI</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Doctores</h1>
            <p className="text-gray-500 mt-1">{subtitle}</p>
          </div>

          <div className="flex gap-2">
            {(user?.role === 'hospital_admin' || user?.role === 'operator') && (
              <>
                <Button variant="outline" onClick={handleGenerateDoctors} disabled={generatingDoctors}>
                  <Target className="h-4 w-4 mr-2" />
                  {generatingDoctors ? 'Generando...' : 'Generar 32 Doctores'}
                </Button>
                <CSVUploadDialog entity="doctors" hospitalId={user?.hospitalId} onUploadComplete={loadDoctors} />
              </>
            )}

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Doctor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Agregar Nuevo Doctor</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddDoctor} className="space-y-4">
                  <div>
                    <Label htmlFor="doctor-nombre">Nombre</Label>
                    <input
                      id="doctor-nombre"
                      type="text"
                      value={newDoctor.nombre}
                      onChange={(e) => setNewDoctor({ ...newDoctor, nombre: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Opcional"
                    />
                  </div>

                  <div>
                    <Label htmlFor="doctor-email">Email *</Label>
                    <input
                      id="doctor-email"
                      type="email"
                      value={newDoctor.email}
                      onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="doctor@hospital.com"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="doctor-password">Contraseña *</Label>
                    <input
                      id="doctor-password"
                      type="text"
                      value={newDoctor.password}
                      onChange={(e) => setNewDoctor({ ...newDoctor, password: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Escribe una contraseña"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="doctor-especialidad">Especialidad *</Label>
                    <select
                      id="doctor-especialidad"
                      value={newDoctor.especialidad}
                      onChange={(e) => setNewDoctor({ ...newDoctor, especialidad: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      {specialtyOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? 'Creando...' : 'Crear Doctor'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email, especialidad o hospital..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {filteredDoctors.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {searchTerm ? 'No se encontraron doctores' : 'No hay doctores registrados'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDoctors.map((doctor, index) => (
                <motion.div
                  key={doctor.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <Stethoscope className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{doctor.nombre || 'Sin nombre'}</p>
                        <p className="text-xs text-gray-500 truncate">{doctor.email}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Especialidad: {doctor.especialidad || 'N/A'}
                        </p>
                        {user?.role === 'super_admin' && (
                          <p className="text-xs text-gray-400 mt-1 truncate">Hospital: {doctor.hospitalId || 'NULL'}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(doctor)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDoctorToDelete(doctor)}
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

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Doctor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditDoctor} className="space-y-4">
              <div>
                <Label htmlFor="edit-doctor-nombre">Nombre</Label>
                <input
                  id="edit-doctor-nombre"
                  type="text"
                  value={editDoctor.nombre}
                  onChange={(e) => setEditDoctor({ ...editDoctor, nombre: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <Label htmlFor="edit-doctor-email">Email *</Label>
                <input
                  id="edit-doctor-email"
                  type="email"
                  value={editDoctor.email}
                  onChange={(e) => setEditDoctor({ ...editDoctor, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-doctor-password">Contraseña (dejar vacío para no cambiar)</Label>
                <input
                  id="edit-doctor-password"
                  type="text"
                  value={editDoctor.password}
                  onChange={(e) => setEditDoctor({ ...editDoctor, password: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <Label htmlFor="edit-doctor-especialidad">Especialidad *</Label>
                <select
                  id="edit-doctor-especialidad"
                  value={editDoctor.especialidad}
                  onChange={(e) => setEditDoctor({ ...editDoctor, especialidad: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  {specialtyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-900">Horario laboral</div>
                <div className="text-xs text-gray-500 mt-1">Este horario se reflejará en “Mi Cronograma”</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-schedule-slot">Duración por cita (min)</Label>
                  <input
                    id="edit-schedule-slot"
                    type="number"
                    min={5}
                    max={180}
                    value={editSchedule.slot_minutes}
                    onChange={(e) => setEditSchedule({ ...editSchedule, slot_minutes: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-schedule-tz">Zona horaria</Label>
                  <input
                    id="edit-schedule-tz"
                    type="text"
                    value={editSchedule.timezone}
                    onChange={(e) => setEditSchedule({ ...editSchedule, timezone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-schedule-morning-start">Inicio mañana</Label>
                  <input
                    id="edit-schedule-morning-start"
                    type="time"
                    value={editSchedule.morning_start}
                    onChange={(e) => setEditSchedule({ ...editSchedule, morning_start: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-schedule-morning-end">Fin mañana</Label>
                  <input
                    id="edit-schedule-morning-end"
                    type="time"
                    value={editSchedule.morning_end}
                    onChange={(e) => setEditSchedule({ ...editSchedule, morning_end: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-schedule-afternoon-start">Inicio tarde</Label>
                  <input
                    id="edit-schedule-afternoon-start"
                    type="time"
                    value={editSchedule.afternoon_start}
                    onChange={(e) => setEditSchedule({ ...editSchedule, afternoon_start: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-schedule-afternoon-end">Fin tarde</Label>
                  <input
                    id="edit-schedule-afternoon-end"
                    type="time"
                    value={editSchedule.afternoon_end}
                    onChange={(e) => setEditSchedule({ ...editSchedule, afternoon_end: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <Label>Días laborales</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { d: 1, l: 'Lun' },
                    { d: 2, l: 'Mar' },
                    { d: 3, l: 'Mié' },
                    { d: 4, l: 'Jue' },
                    { d: 5, l: 'Vie' },
                    { d: 6, l: 'Sáb' },
                    { d: 7, l: 'Dom' },
                  ].map(({ d, l }) => {
                    const active = (editSchedule.workdays || []).includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          const current = new Set(editSchedule.workdays || []);
                          if (current.has(d)) current.delete(d);
                          else current.add(d);
                          const next = Array.from(current).sort((a, b) => a - b);
                          setEditSchedule({ ...editSchedule, workdays: next });
                        }}
                        className={`px-3 py-2 rounded-xl border text-xs transition-colors ${
                          active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={updating || scheduleLoading}>
                {updating || scheduleLoading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!doctorToDelete} onOpenChange={() => setDoctorToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente al doctor <strong>{doctorToDelete?.email}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteDoctor} className="bg-red-600 hover:bg-red-700">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default DoctorsPage;
