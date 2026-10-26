import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileText, Plus, Eye, Edit2, Trash2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { templateService } from '@/services/templateService';
import { useAuth } from '@/contexts/AuthContext';

const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteTemplate, setDeleteTemplate] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [templateForm, setTemplateForm] = useState({
    nombre: '',
    mensaje: '',
    categoria: 'General'
  });

  const mergeTags = [
    { tag: '{nombre}', description: 'Nombre del paciente' },
    { tag: '{fecha_cita}', description: 'Fecha de la cita' },
    { tag: '{hora_cita}', description: 'Hora de la cita' },
    { tag: '{programa}', description: 'Programa de salud' },
    { tag: '{ciudad}', description: 'Ciudad del paciente' },
    { tag: '{hospital}', description: 'Nombre del hospital' }
  ];

  const categorias = ['General', 'Recordatorios', 'Bienvenida', 'Seguimiento', 'Urgente'];

  useEffect(() => {
    if (user?.hospitalId) {
      loadTemplates();
    }
  }, [user]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando plantillas...');
      
      const result = await templateService.getAll(user.hospitalId);
      
      if (result.success) {
        setTemplates(result.data);
        console.log('✅ Plantillas cargadas:', result.data.length);
      } else {
        console.error('❌ Error cargando plantillas:', result.error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las plantillas",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('💥 Error inesperado:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al cargar las plantillas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    console.log('🚀 handleSaveTemplate INICIADO');
    
    try {
      setSaving(true);
      console.log('⏳ Estado saving activado');
      
      console.log('🔍 Datos del usuario:', user);
      console.log('🔍 Hospital ID:', user?.hospitalId);
      
      // Validar que tengamos hospitalId
      if (!user?.hospitalId) {
        console.error('❌ No hay hospitalId');
        toast({
          title: "Error",
          description: "No se encontró el ID del hospital. Por favor, cierra sesión e inicia sesión nuevamente.",
          variant: "destructive"
        });
        setSaving(false);
        return;
      }
      
      console.log('✅ hospitalId validado');
      
      // Validar plantilla
      console.log('🔍 Validando formulario...');
      const validation = templateService.validate(templateForm);
      console.log('📋 Resultado validación:', validation);
      
      if (!validation.valid) {
        console.error('❌ Validación falló:', validation.errors);
        toast({
          title: "Error de validación",
          description: validation.errors.join(', '),
          variant: "destructive"
        });
        setSaving(false);
        return;
      }

      console.log('✅ Formulario validado');

      // Extraer variables del mensaje
      console.log('🔍 Extrayendo variables...');
      const { variables } = templateService.extractVariables(templateForm.mensaje);
      console.log('📝 Variables extraídas:', variables);
      
      const templateData = {
        ...templateForm,
        variables,
        hospitalId: user.hospitalId
      };

      console.log('📤 Datos de la plantilla a guardar:', templateData);

      let result;
      
      if (editingTemplate) {
        // Actualizar existente
        console.log('✏️ Actualizando plantilla existente...');
        result = await templateService.update(editingTemplate.id, templateData);
        console.log('📊 Resultado update:', result);
        
        if (result.success) {
          toast({ title: "Plantilla actualizada exitosamente" });
        }
      } else {
        // Crear nueva
        console.log('➕ Creando nueva plantilla...');
        result = await templateService.create(templateData);
        console.log('📊 Resultado create:', result);
        
        if (result.success) {
          toast({ title: "Plantilla creada exitosamente" });
        }
      }

      if (!result.success) {
        console.error('❌ Error del servicio:', result.error);
        throw new Error(result.error);
      }

      console.log('✅ Operación exitosa, recargando plantillas...');

      // Recargar plantillas
      await loadTemplates();
      
      console.log('✅ Plantillas recargadas, cerrando diálogo...');
      closeDialog();
      
    } catch (error) {
      console.error('💥 ERROR CAPTURADO en handleSaveTemplate:', error);
      console.error('💥 Stack trace:', error.stack);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la plantilla",
        variant: "destructive"
      });
    } finally {
      console.log('🏁 Finalizando, desactivando estado saving');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSaving(true);
      
      const result = await templateService.delete(deleteTemplate.id);
      
      if (result.success) {
        toast({ 
          title: "Plantilla eliminada",
          description: "La plantilla se eliminó correctamente"
        });
        await loadTemplates(false);
      } else {
        throw new Error(result.error);
      }
      
      setDeleteTemplate(null);
    } catch (error) {
      console.error('❌ Error eliminando plantilla:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la plantilla",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (template) => {
    setEditingTemplate(template);
    setTemplateForm({ 
      nombre: template.nombre, 
      mensaje: template.mensaje,
      categoria: template.categoria || 'General'
    });
    setShowCreateDialog(true);
  };

  const closeDialog = () => {
    setShowCreateDialog(false);
    setEditingTemplate(null);
    setTemplateForm({ nombre: '', mensaje: '', categoria: 'General' });
  };

  const insertMergeTag = (tag) => {
    setTemplateForm({
      ...templateForm,
      mensaje: templateForm.mensaje + tag
    });
  };

  const previewWithSampleData = (content) => {
    return content
      .replace(/\{+nombre\}+/g, 'Juan Pérez')
      .replace(/\{+fecha_cita\}+/g, '25/11/2025')
      .replace(/\{+hora_cita\}+/g, '10:00 AM')
      .replace(/\{+programa\}+/g, 'Hipertensión')
      .replace(/\{+ciudad\}+/g, 'Medellín')
      .replace(/\{+hospital\}+/g, user?.hospital_name || 'Hospital');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Plantillas SMS - SADI</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Plantillas SMS</h1>
            <p className="text-gray-500 mt-1">Crea y gestiona plantillas de mensajes</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={(open) => !open && closeDialog()}>
            <DialogTrigger asChild>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Plantilla
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? 'Editar Plantilla' : 'Crear Nueva Plantilla'}</DialogTitle>
                <DialogDescription>
                  Completa el formulario para {editingTemplate ? 'editar' : 'crear'} una plantilla de mensaje SMS
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre de la Plantilla</Label>
                  <input
                    id="nombre"
                    type="text"
                    value={templateForm.nombre}
                    onChange={(e) => setTemplateForm({ ...templateForm, nombre: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ej: Recordatorio de Cita"
                    disabled={saving}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="categoria">Categoría</Label>
                  <select
                    id="categoria"
                    value={templateForm.categoria}
                    onChange={(e) => setTemplateForm({ ...templateForm, categoria: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={saving}
                  >
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="mensaje">Contenido del Mensaje</Label>
                  <textarea
                    id="mensaje"
                    value={templateForm.mensaje}
                    onChange={(e) => setTemplateForm({ ...templateForm, mensaje: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md h-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Escribe tu mensaje aquí. Usa {variables} para personalizar."
                    disabled={saving}
                    required
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-sm text-gray-500">
                      {templateForm.mensaje.length}/160 caracteres
                    </p>
                    {templateForm.mensaje.length > 160 && (
                      <p className="text-xs text-orange-600">
                        SMS largo ({Math.ceil(templateForm.mensaje.length / 160)} mensajes)
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Variables Disponibles</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {mergeTags.map((tag) => (
                      <Button
                        key={tag.tag}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertMergeTag(tag.tag)}
                        className="justify-start text-left"
                        title={tag.description}
                      >
                        <span className="font-mono text-xs">{tag.tag}</span>
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Haz clic en una variable para insertarla en el mensaje
                  </p>
                </div>

                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDialog}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={saving}
                    onClick={(e) => {
                      console.log('🔘 Botón clickeado');
                    }}
                  >
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingTemplate ? 'Guardar Cambios' : 'Crear Plantilla'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {templates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay plantillas creadas</h3>
            <p className="text-gray-500 mb-4">Crea tu primera plantilla SMS</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Plantilla
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <FileText className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.nombre}</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {template.categoria || 'General'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 line-clamp-3">{template.mensaje}</p>
                  <p className="text-xs text-gray-400 mt-2">{template.mensaje.length} caracteres</p>
                  {template.variables && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.variables.map((variable, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono"
                        >
                          {`{${variable}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreviewTemplate(template)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(template)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteTemplate(template)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vista Previa - {previewTemplate.nombre}</DialogTitle>
              <DialogDescription>
                Visualiza cómo se verá tu mensaje SMS con datos reales
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Plantilla Original:</p>
                <p className="text-sm text-gray-600">{previewTemplate.mensaje}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Vista Previa con Datos:</p>
                <p className="text-sm text-gray-900">{previewWithSampleData(previewTemplate.mensaje)}</p>
              </div>
              {previewTemplate.variables && previewTemplate.variables.length > 0 && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Variables Detectadas:</p>
                  <div className="flex flex-wrap gap-2">
                    {previewTemplate.variables.map((variable, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-mono"
                      >
                        {`{${variable}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la plantilla
              "{deleteTemplate?.nombre}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default TemplatesPage;