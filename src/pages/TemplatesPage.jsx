import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileText, Plus, Eye, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const { toast } = useToast();

  const [templateForm, setTemplateForm] = useState({
    nombre: '',
    contenido: ''
  });

  const mergeTags = [
    { tag: '{{nombre}}', description: 'Nombre del paciente' },
    { tag: '{{fecha_cita}}', description: 'Fecha de la cita' },
    { tag: '{{hora_cita}}', description: 'Hora de la cita' },
    { tag: '{{programa}}', description: 'Programa de salud' },
    { tag: '{{ciudad}}', description: 'Ciudad del paciente' }
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    const stored = localStorage.getItem('sadi_templates');
    if (stored) {
      setTemplates(JSON.parse(stored));
    }
  };

  const handleSaveTemplate = (e) => {
    e.preventDefault();
    
    let updatedTemplates;
    
    if (editingTemplate) {
      // Update existing
      updatedTemplates = templates.map(t => 
        t.id === editingTemplate.id ? { ...t, ...templateForm } : t
      );
      toast({ title: "Plantilla actualizada" });
    } else {
      // Create new
      const template = {
        ...templateForm,
        id: Date.now().toString(),
        fechaCreacion: new Date().toISOString().split('T')[0]
      };
      updatedTemplates = [...templates, template];
      toast({ title: "Plantilla creada" });
    }

    localStorage.setItem('sadi_templates', JSON.stringify(updatedTemplates));
    setTemplates(updatedTemplates);
    closeDialog();
  };

  const handleDelete = (id) => {
    // Fix: Explicitly use window.confirm to avoid ESLint no-restricted-globals error
    if (window.confirm('¿Estás seguro de eliminar esta plantilla?')) {
      const updated = templates.filter(t => t.id !== id);
      localStorage.setItem('sadi_templates', JSON.stringify(updated));
      setTemplates(updated);
      toast({ title: "Plantilla eliminada", variant: "destructive" });
    }
  };

  const openEdit = (template) => {
    setEditingTemplate(template);
    setTemplateForm({ nombre: template.nombre, contenido: template.contenido });
    setShowCreateDialog(true);
  };

  const closeDialog = () => {
    setShowCreateDialog(false);
    setEditingTemplate(null);
    setTemplateForm({ nombre: '', contenido: '' });
  };

  const insertMergeTag = (tag) => {
    setTemplateForm({
      ...templateForm,
      contenido: templateForm.contenido + tag
    });
  };

  const previewWithSampleData = (content) => {
    return content
      .replace(/{{nombre}}/g, 'Juan Pérez')
      .replace(/{{fecha_cita}}/g, '25/11/2025')
      .replace(/{{hora_cita}}/g, '10:00 AM')
      .replace(/{{programa}}/g, 'Hipertensión')
      .replace(/{{ciudad}}/g, 'Bogotá');
  };

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
              </DialogHeader>
              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre de la Plantilla</Label>
                  <input
                    id="nombre"
                    type="text"
                    value={templateForm.nombre}
                    onChange={(e) => setTemplateForm({ ...templateForm, nombre: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contenido">Contenido del Mensaje</Label>
                  <textarea
                    id="contenido"
                    value={templateForm.contenido}
                    onChange={(e) => setTemplateForm({ ...templateForm, contenido: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md h-32"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {templateForm.contenido.length}/160 caracteres
                  </p>
                </div>
                <div>
                  <Label>Etiquetas de Combinación</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {mergeTags.map((tag) => (
                      <Button
                        key={tag.tag}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertMergeTag(tag.tag)}
                        className="justify-start text-left"
                      >
                        <span className="font-mono text-xs">{tag.tag}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full">{editingTemplate ? 'Guardar Cambios' : 'Crear Plantilla'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

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
                    <p className="text-xs text-gray-500">Creada: {template.fechaCreacion}</p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 line-clamp-3">{template.contenido}</p>
                <p className="text-xs text-gray-400 mt-2">{template.contenido.length} caracteres</p>
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
                  onClick={() => handleDelete(template.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vista Previa - {previewTemplate.nombre}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Plantilla Original:</p>
                <p className="text-sm text-gray-600">{previewTemplate.contenido}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Vista Previa con Datos:</p>
                <p className="text-sm text-gray-900">{previewWithSampleData(previewTemplate.contenido)}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
};

export default TemplatesPage;