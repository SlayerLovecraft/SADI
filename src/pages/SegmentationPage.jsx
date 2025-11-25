import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Target, Plus, Users, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
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
} from '@/components/ui/alert-dialog';

const SegmentationPage = () => {
  const [segments, setSegments] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [patients, setPatients] = useState([]);
  const { toast } = useToast();

  const [newSegment, setNewSegment] = useState({
    nombre: '',
    edadMin: '',
    edadMax: '',
    sexo: 'Todos',
    ciudad: '',
    programa: ''
  });

  const [editSegment, setEditSegment] = useState({
    nombre: '',
    edadMin: '',
    edadMax: '',
    sexo: 'Todos',
    ciudad: '',
    programa: ''
  });

  useEffect(() => {
    loadSegments();
    loadPatients();
  }, []);

  const loadSegments = () => {
    const stored = localStorage.getItem('sadi_segments');
    if (stored) {
      setSegments(JSON.parse(stored));
    }
  };

  const loadPatients = () => {
    const stored = localStorage.getItem('sadi_patients');
    if (stored) {
      setPatients(JSON.parse(stored));
    }
  };

  const calculateSegmentSize = (segment) => {
    return patients.filter(p => {
      let matches = true;
      
      if (segment.edadMin && p.edad < parseInt(segment.edadMin)) matches = false;
      if (segment.edadMax && p.edad > parseInt(segment.edadMax)) matches = false;
      if (segment.sexo !== 'Todos' && p.sexo !== segment.sexo) matches = false;
      if (segment.ciudad && p.ciudad.toLowerCase() !== segment.ciudad.toLowerCase()) matches = false;
      if (segment.programa && p.programa.toLowerCase() !== segment.programa.toLowerCase()) matches = false;
      
      return matches;
    }).length;
  };

  const handleCreateSegment = (e) => {
    e.preventDefault();
    
    const segment = {
      ...newSegment,
      id: Date.now().toString(),
      fechaCreacion: new Date().toISOString().split('T')[0]
    };
    
    const updatedSegments = [...segments, segment];
    localStorage.setItem('sadi_segments', JSON.stringify(updatedSegments));
    setSegments(updatedSegments);
    setShowCreateDialog(false);
    setNewSegment({ nombre: '', edadMin: '', edadMax: '', sexo: 'Todos', ciudad: '', programa: '' });
    
    toast({
      title: "Segmento creado",
      description: "El segmento ha sido creado exitosamente",
    });
  };

  const handleEditClick = (segment) => {
    setSelectedSegment(segment);
    setEditSegment({
      nombre: segment.nombre,
      edadMin: segment.edadMin || '',
      edadMax: segment.edadMax || '',
      sexo: segment.sexo || 'Todos',
      ciudad: segment.ciudad || '',
      programa: segment.programa || ''
    });
    setShowEditDialog(true);
  };

  const handleUpdateSegment = (e) => {
    e.preventDefault();
    
    const updatedSegments = segments.map(seg => 
      seg.id === selectedSegment.id 
        ? { ...seg, ...editSegment, fechaModificacion: new Date().toISOString().split('T')[0] }
        : seg
    );
    
    localStorage.setItem('sadi_segments', JSON.stringify(updatedSegments));
    setSegments(updatedSegments);
    setShowEditDialog(false);
    setSelectedSegment(null);
    
    toast({
      title: "Segmento actualizado",
      description: "Los cambios han sido guardados exitosamente",
    });
  };

  const handleDeleteClick = (segment) => {
    setSelectedSegment(segment);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    const updatedSegments = segments.filter(seg => seg.id !== selectedSegment.id);
    localStorage.setItem('sadi_segments', JSON.stringify(updatedSegments));
    setSegments(updatedSegments);
    setShowDeleteDialog(false);
    setSelectedSegment(null);
    
    toast({
      title: "Segmento eliminado",
      description: "El segmento ha sido eliminado correctamente",
      variant: "destructive",
    });
  };

  return (
    <Layout>
      <Helmet>
        <title>Segmentación - SADI</title>
        <meta name="description" content="Creación y gestión de segmentos de pacientes" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Segmentación</h1>
            <p className="text-gray-500 mt-1">Crea y gestiona filtros personalizados para tus campañas</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Crear Segmento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Segmento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSegment} className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre del Segmento</Label>
                  <input
                    id="nombre"
                    type="text"
                    value={newSegment.nombre}
                    onChange={(e) => setNewSegment({ ...newSegment, nombre: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Diabéticos mayores de 50"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edadMin">Edad Mínima</Label>
                    <input
                      id="edadMin"
                      type="number"
                      value={newSegment.edadMin}
                      onChange={(e) => setNewSegment({ ...newSegment, edadMin: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Opcional"
                      min="0"
                      max="120"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edadMax">Edad Máxima</Label>
                    <input
                      id="edadMax"
                      type="number"
                      value={newSegment.edadMax}
                      onChange={(e) => setNewSegment({ ...newSegment, edadMax: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Opcional"
                      min="0"
                      max="120"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="sexo">Sexo</Label>
                  <select
                    id="sexo"
                    value={newSegment.sexo}
                    onChange={(e) => setNewSegment({ ...newSegment, sexo: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Todos">Todos</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <input
                    id="ciudad"
                    type="text"
                    value={newSegment.ciudad}
                    onChange={(e) => setNewSegment({ ...newSegment, ciudad: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Bogotá"
                  />
                </div>
                <div>
                  <Label htmlFor="programa">Programa de Salud</Label>
                  <input
                    id="programa"
                    type="text"
                    value={newSegment.programa}
                    onChange={(e) => setNewSegment({ ...newSegment, programa: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Diabetes"
                  />
                </div>
                <Button type="submit" className="w-full">Crear Segmento</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {segments.map((segment, index) => (
            <motion.div
              key={segment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="bg-purple-100 p-2 rounded-full">
                    <Target className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{segment.nombre}</h3>
                    <p className="text-xs text-gray-500">Creado: {segment.fechaCreacion}</p>
                    {segment.fechaModificacion && (
                      <p className="text-xs text-gray-400">Modificado: {segment.fechaModificacion}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                {segment.edadMin && segment.edadMax && (
                  <div className="text-sm">
                    <span className="text-gray-500">Edad:</span>
                    <span className="ml-2 font-medium">{segment.edadMin} - {segment.edadMax} años</span>
                  </div>
                )}
                {segment.sexo !== 'Todos' && (
                  <div className="text-sm">
                    <span className="text-gray-500">Sexo:</span>
                    <span className="ml-2 font-medium">{segment.sexo === 'M' ? 'Masculino' : 'Femenino'}</span>
                  </div>
                )}
                {segment.ciudad && (
                  <div className="text-sm">
                    <span className="text-gray-500">Ciudad:</span>
                    <span className="ml-2 font-medium">{segment.ciudad}</span>
                  </div>
                )}
                {segment.programa && (
                  <div className="text-sm">
                    <span className="text-gray-500">Programa:</span>
                    <span className="ml-2 font-medium">{segment.programa}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center text-blue-600">
                  <Users className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">{calculateSegmentSize(segment)} pacientes</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditClick(segment)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar segmento"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(segment)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar segmento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {segments.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay segmentos creados</h3>
            <p className="text-gray-500 mb-4">Crea tu primer segmento para organizar tus pacientes</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primer Segmento
            </Button>
          </div>
        )}
      </div>

      {/* Dialog de Editar */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Segmento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateSegment} className="space-y-4">
            <div>
              <Label htmlFor="edit-nombre">Nombre del Segmento</Label>
              <input
                id="edit-nombre"
                type="text"
                value={editSegment.nombre}
                onChange={(e) => setEditSegment({ ...editSegment, nombre: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-edadMin">Edad Mínima</Label>
                <input
                  id="edit-edadMin"
                  type="number"
                  value={editSegment.edadMin}
                  onChange={(e) => setEditSegment({ ...editSegment, edadMin: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                  min="0"
                  max="120"
                />
              </div>
              <div>
                <Label htmlFor="edit-edadMax">Edad Máxima</Label>
                <input
                  id="edit-edadMax"
                  type="number"
                  value={editSegment.edadMax}
                  onChange={(e) => setEditSegment({ ...editSegment, edadMax: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                  min="0"
                  max="120"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-sexo">Sexo</Label>
              <select
                id="edit-sexo"
                value={editSegment.sexo}
                onChange={(e) => setEditSegment({ ...editSegment, sexo: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="Todos">Todos</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
            <div>
              <Label htmlFor="edit-ciudad">Ciudad</Label>
              <input
                id="edit-ciudad"
                type="text"
                value={editSegment.ciudad}
                onChange={(e) => setEditSegment({ ...editSegment, ciudad: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label htmlFor="edit-programa">Programa de Salud</Label>
              <input
                id="edit-programa"
                type="text"
                value={editSegment.programa}
                onChange={(e) => setEditSegment({ ...editSegment, programa: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Opcional"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmación de Eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              ¿Eliminar segmento?
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar el segmento "{selectedSegment?.nombre}"? 
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default SegmentationPage;