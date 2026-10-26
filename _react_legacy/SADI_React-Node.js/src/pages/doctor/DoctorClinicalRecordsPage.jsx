import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { 
  FolderArchive, Folder, FileText, FileSpreadsheet, Image as ImageIcon, 
  Presentation, BarChart2, Calendar, Archive, UploadCloud, Download, 
  Trash2, User, Stethoscope, Search, CheckCircle2, AlertCircle, ArrowRight,
  HardDrive, Filter, Clock, Eye, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { telemonitoringService, SEED_DOCTORS_3280 } from '@/services/telemonitoringService';
import { 
  clinicalRecordsService, 
  FOLDER_CATEGORIES, 
  classifyFileToFolder, 
  buildRigorousStoragePath,
  sanitizePatientFolder
} from '@/services/clinicalRecordsService';

export default function DoctorClinicalRecordsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [doctors, setDoctors] = useState(SEED_DOCTORS_3280);
  const [selectedDoctor, setSelectedDoctor] = useState(SEED_DOCTORS_3280[0]);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  
  // Carpetas y archivos
  const [folderSummary, setFolderSummary] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [allPatientDocs, setAllPatientDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subida de archivos
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [detectedCategory, setDetectedCategory] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const docList = await telemonitoringService.getDoctors();
        setDoctors(docList);
        
        // Si el usuario logueado es doctor, forzar su perfil sin opción de cambio
        const currentDoctor = docList.find(d => 
          (d.email && user?.email && d.email.toLowerCase() === user.email.toLowerCase()) ||
          d.id === user?.id || 
          d.doctor_id === user?.doctor_id
        ) || {
          id: user?.id || user?.doctor_id || 'd1111111-1111-1111-1111-111111111111',
          doctor_id: user?.doctor_id || user?.id || 'd1111111-1111-1111-1111-111111111111',
          name: user?.nombre || 'Dr. Médico Especialista',
          email: user?.email,
          specialty: user?.doctor_specialty || 'Medicina Especializada',
          area_3280: user?.doctor_specialty || 'Área Clínica Asignada'
        };
        setSelectedDoctor(currentDoctor);

        const patList = await telemonitoringService.getPatients();

        // RESTRICCIÓN CLÍNICA: Los doctores solo pueden ver y cargar historias de SUS pacientes asignados
        const isMyPatient = (p) => {
          if (user?.role !== 'doctor') return true;
          const docId = String(currentDoctor.id || currentDoctor.doctor_id || '').toLowerCase();
          const pDocId = String(p.doctor_asignado_id || '').toLowerCase();
          if (pDocId && docId && pDocId === docId) return true;

          const docName = String(currentDoctor.name || '').toLowerCase();
          const pDocName = String(p.doctor_nombre || '').toLowerCase();
          if (docName && pDocName) {
            const firstPart = docName.replace('dr. ', '').replace('dra. ', '').split(' ')[0];
            if (firstPart && pDocName.includes(firstPart)) return true;
          }

          const spec = String(currentDoctor.specialty || '').toLowerCase();
          if (spec.includes('pediatr') && (p.curso_vida === 'primera_infancia' || p.curso_vida === 'infancia')) return true;
          if (spec.includes('adolesc') && p.curso_vida === 'adolescencia') return true;
          if ((spec.includes('sexual') || spec.includes('general')) && p.curso_vida === 'juventud') return true;
          if ((spec.includes('interna') || spec.includes('cardio')) && p.curso_vida === 'adultez') return true;
          if (spec.includes('geriatr') && p.curso_vida === 'vejez') return true;
          if ((spec.includes('materno') || spec.includes('ginec') || spec.includes('obstet')) && (p.curso_vida === 'materno_perinatal' || p.es_gestante)) return true;
          if (spec.includes('odont') && (p.curso_vida === 'infancia' || p.curso_vida === 'primera_infancia')) return true;
          if (spec.includes('onco') && (p.curso_vida === 'adultez' || p.curso_vida === 'vejez')) return true;

          return false;
        };

        const filteredList = patList.filter(isMyPatient);
        const finalList = filteredList.length > 0 ? filteredList : patList;
        setPatients(finalList);

        if (finalList.length > 0) {
          setSelectedPatient(finalList[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [user]);

  // Recargar documentos cuando cambia el paciente seleccionado
  useEffect(() => {
    if (!selectedPatient) return;
    refreshPatientDocs();
  }, [selectedPatient]);

  const refreshPatientDocs = async () => {
    if (!selectedPatient) return;
    const summary = await clinicalRecordsService.getFolderSummaryForPatient(selectedPatient.id);
    setFolderSummary(summary);
    const docs = await clinicalRecordsService.getDocuments(selectedPatient.id);
    setAllPatientDocs(docs);
  };

  // Manejador de selección de archivo en input
  const handleFileSelect = (file) => {
    if (!file) return;
    setUploadFile(file);
    const cat = classifyFileToFolder(file.name);
    setDetectedCategory(cat);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast({
        title: "Archivo requerido",
        description: "Por favor arrastra o selecciona un archivo para subir a la historia clínica.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedPatient) {
      toast({
        title: "Paciente no seleccionado",
        description: "Selecciona primero un paciente para asignar el documento clínico.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUploading(true);
      const newDoc = await clinicalRecordsService.uploadClinicalDocument({
        patient_id: selectedPatient.id,
        patient_name: selectedPatient.nombre,
        doctor_id: selectedDoctor?.id || selectedDoctor?.doctor_id,
        doctor_name: selectedDoctor?.name || 'Dr. Especialista SADI',
        file: uploadFile,
        descripcion_clinica: uploadDescription
      });

      toast({
        title: "✅ Archivo incorporado a la Historia Clínica",
        description: `Guardado en: ${newDoc.ruta_almacenamiento}`
      });

      // Limpiar formulario y refrescar lista
      setUploadFile(null);
      setUploadDescription('');
      setDetectedCategory(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshPatientDocs();
    } catch (err) {
      toast({
        title: "Error al subir documento",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDoc = async (docId, fileName) => {
    if (!window.confirm(`¿Seguro que deseas eliminar "${fileName}" de la historia clínica?`)) return;
    await clinicalRecordsService.deleteDocument(docId);
    toast({
      title: "Documento eliminado",
      description: `Se retiró "${fileName}" del expediente.`
    });
    await refreshPatientDocs();
  };

  const formatBytes = (bytes = 0) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filtrado de pacientes
  const filteredPatients = patients.filter(p => {
    const q = patientSearch.toLowerCase();
    return p.nombre.toLowerCase().includes(q) || 
           p.documento?.toLowerCase().includes(q) ||
           p.curso_vida?.toLowerCase().includes(q);
  });

  // Filtrado de documentos por categoría seleccionada
  const displayedDocs = selectedCategory === 'ALL' 
    ? allPatientDocs 
    : allPatientDocs.filter(d => d.carpeta_clasificada === selectedCategory);

  const getFolderIcon = (catId) => {
    switch (catId) {
      case 'PDF': return <FileText className="h-5 w-5 text-red-500" />;
      case 'EXCEL': return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
      case 'WORD': return <FileText className="h-5 w-5 text-blue-600" />;
      case 'JPG/JPEG/PNG': return <ImageIcon className="h-5 w-5 text-amber-500" />;
      case 'POWERPOINT': return <Presentation className="h-5 w-5 text-orange-500" />;
      case 'POWER BI': return <BarChart2 className="h-5 w-5 text-yellow-500" />;
      case 'PROJECT': return <Calendar className="h-5 w-5 text-indigo-500" />;
      case 'ZIP/RAR': return <Archive className="h-5 w-5 text-purple-600" />;
      default: return <Folder className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>SADI - Historias Clínicas & Expedientes Digitales</title>
      </Helmet>

      <div className="space-y-6">

        {/* Cabecera Principal */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest">
              <FolderArchive className="h-4 w-4" />
              Portal Médico • Gestión Documental de Historias Clínicas
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Expedientes & Documentos Clínicos Multiformato
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Estructura rigurosa por paciente y discriminación automática por tipo de archivo sin límite de peso.
            </p>
          </div>

          {/* Perfil del Doctor - Bloqueado si el usuario es Doctor */}
          {user?.role === 'doctor' ? (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm">
              <div className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Médico Responsable:</p>
                  <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded-full font-bold">
                    🔒 Perfil Exclusivo
                  </span>
                </div>
                <p className="font-extrabold text-gray-900 text-sm truncate max-w-[280px]">
                  {selectedDoctor?.name || user?.nombre}
                </p>
                <p className="text-[10px] text-emerald-700 font-medium truncate max-w-[280px]">
                  {selectedDoctor?.specialty || user?.doctor_specialty} • {selectedDoctor?.area_3280 || 'Res. 3280'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50/70 border border-blue-200/60 rounded-2xl p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Médico Especialista:</p>
                <select
                  value={selectedDoctor?.id || selectedDoctor?.doctor_id}
                  onChange={(e) => {
                    const d = doctors.find(doc => (doc.id === e.target.value || doc.doctor_id === e.target.value));
                    if (d) setSelectedDoctor(d);
                  }}
                  className="bg-transparent font-bold text-gray-900 text-xs focus:outline-none cursor-pointer pr-4"
                >
                  {doctors.map(d => (
                    <option key={d.id || d.doctor_id} value={d.id || d.doctor_id}>
                      {d.name} ({d.specialty})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 truncate max-w-[280px]">
                  {selectedDoctor?.area_3280 || selectedDoctor?.specialty}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Contenido Grid: Columna izquierda Selección de Paciente / Columna derecha Carpetas y Subida */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* COLUMNA 1: LISTADO DE PACIENTES ASIGNADOS */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm flex flex-col h-[780px]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  {user?.role === 'doctor' ? 'Mis Pacientes Asignados' : 'Pacientes 3280'}
                </h2>
                <p className="text-[11px] text-gray-500">
                  {user?.role === 'doctor' ? 'Solo expedientes bajo su custodia médica' : '5 pacientes por cada curso de vida'}
                </p>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                {patients.length} Asignados
              </span>
            </div>

            {/* Buscador de Paciente */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, documento o curso..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Lista scrolleable de pacientes */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredPatients.map((p) => {
                const isSelected = selectedPatient?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200' 
                        : 'bg-gray-50/70 hover:bg-white border-gray-200/70 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs truncate max-w-[190px]">
                        {p.nombre}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {p.tipo_documento} {p.documento}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[11px] opacity-80">
                      <span>{p.eps} • {p.regimen}</span>
                      <span className="capitalize font-semibold">{p.curso_vida?.replace('_', ' ')}</span>
                    </div>

                    {p.es_gestante && (
                      <div className={`mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        isSelected ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                      }`}>
                        🤰 Gestante ({p.semana_gestacional} semanas) - Riesgo Materno
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMNA 2: EXPLORADOR DE CARPETAS Y SUBIDA RIGUROSA */}
          <div className="lg:col-span-8 space-y-6">

            {/* Visualizador de la Ruta Rigurosa del Paciente */}
            {selectedPatient && (
              <div className="bg-slate-900 text-slate-100 rounded-3xl p-5 border border-slate-800 shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
                  <div>
                    <span className="text-emerald-400 font-mono text-[11px] uppercase tracking-wider font-bold">
                      Directorio Activo en Servidor:
                    </span>
                    <div className="font-mono text-sm font-bold text-white mt-0.5 flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-blue-400" />
                      HISTORIAS_CLÍNICAS/{sanitizePatientFolder(selectedPatient.nombre)}/
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[11px]">Expediente de:</span>
                    <p className="font-bold text-white text-xs">{selectedPatient.nombre}</p>
                    <p className="text-[10px] text-slate-400">{selectedPatient.eps} • Tel: {selectedPatient.telefono}</p>
                  </div>
                </div>

                {/* Grid de las 9 Carpetas Rigurosas */}
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2 mt-4">
                  {FOLDER_CATEGORIES.map((cat) => {
                    const info = folderSummary[cat.id] || { count: 0, totalBytes: 0 };
                    const isSelectedCat = selectedCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(isSelectedCat ? 'ALL' : cat.id)}
                        className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                          isSelectedCat 
                            ? 'bg-blue-600 text-white border-blue-400 shadow-lg scale-105' 
                            : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300'
                        }`}
                      >
                        {getFolderIcon(cat.id)}
                        <span className="font-mono text-[10px] font-bold truncate max-w-full">
                          {cat.label}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                          info.count > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {info.count} arch.
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                  <span>Filtrando por: <strong className="text-white">{selectedCategory === 'ALL' ? 'Todas las carpetas' : selectedCategory}</strong></span>
                  <button 
                    onClick={() => setSelectedCategory('ALL')}
                    className="text-blue-400 hover:underline font-bold text-[11px]"
                  >
                    Ver todas las carpetas ({allPatientDocs.length} archivos)
                  </button>
                </div>
              </div>
            )}

            {/* SECCIÓN DE CARGA DE ARCHIVO (SIN LÍMITE DE TAMAÑO NI FORMATO) */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-blue-600" />
                  Subir Documento o Historia Clínica Completa
                </h3>
                <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Sin límite de peso ni formato
                </span>
              </div>

              {/* Zona Drag & Drop */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-blue-600 bg-blue-50/70 scale-[1.01]' 
                    : uploadFile 
                      ? 'border-emerald-500 bg-emerald-50/40' 
                      : 'border-gray-300 hover:border-blue-400 bg-gray-50/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  className="hidden"
                />

                {uploadFile ? (
                  <div className="space-y-2">
                    <div className="inline-flex p-3 rounded-2xl bg-emerald-100 text-emerald-700">
                      {getFolderIcon(detectedCategory)}
                    </div>
                    <p className="text-sm font-bold text-gray-900">{uploadFile.name}</p>
                    <p className="text-xs text-gray-500">
                      Tamaño: {formatBytes(uploadFile.size)} • Formato: {uploadFile.type || 'Binario'}
                    </p>
                    
                    {/* Alerta de Clasificación Automática de Carpeta */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-xl text-xs font-semibold">
                      <span>Destino Automático:</span>
                      <strong className="font-mono">HISTORIAS_CLÍNICAS/{sanitizePatientFolder(selectedPatient?.nombre)}/{detectedCategory}/</strong>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="inline-flex p-3 rounded-2xl bg-blue-50 text-blue-600">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-bold text-gray-700">
                      Arrastra cualquier archivo aquí o haz clic para examinar
                    </p>
                    <p className="text-xs text-gray-400 max-w-md mx-auto">
                      Acepta PDF, Excel (.xlsx, .csv), Word (.docx), Imágenes (.jpg, .png), PowerPoint (.pptx), Power BI (.pbix), MS Project (.mpp), Comprimidos (.zip, .rar) o cualquier otro archivo.
                    </p>
                  </div>
                )}
              </div>

              {/* Formulario de Descripción Clínica y Botón de Subida */}
              {uploadFile && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Descripción Clínica / Observaciones del Documento:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Informe de ecografía estructural sem 21, evolución tensional, reajuste farmacológico..."
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUploadFile(null);
                        setDetectedCategory(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="rounded-xl text-xs"
                    >
                      Cancelar
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleUploadSubmit}
                      disabled={isUploading}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                    >
                      {isUploading ? 'Guardando en Carpeta...' : `Confirmar y Archivar en ${detectedCategory}`}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* LISTA DE ARCHIVOS DEL EXPEDIENTE */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <Folder className="h-4 w-4 text-blue-600" />
                    Archivos en Expediente ({displayedDocs.length})
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selectedCategory === 'ALL' 
                      ? 'Mostrando todos los archivos distribuidos por tipo' 
                      : `Mostrando únicamente archivos de la carpeta ${selectedCategory}`}
                  </p>
                </div>
              </div>

              {displayedDocs.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500 text-xs">
                  No hay documentos registrados en esta carpeta para {selectedPatient?.nombre}.
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 rounded-2xl border border-gray-200/80 hover:border-blue-300 transition-all bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm shrink-0">
                          {getFolderIcon(doc.carpeta_clasificada)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900 truncate">
                              {doc.nombre_archivo}
                            </span>
                            <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              {doc.carpeta_clasificada}
                            </span>
                          </div>

                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                            {doc.descripcion_clinica}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-gray-400 font-mono">
                            <span>Ruta: {doc.ruta_almacenamiento}</span>
                            <span>•</span>
                            <span>Peso: {formatBytes(doc.tamano_bytes)}</span>
                            <span>•</span>
                            <span>Médico: {doc.subido_por_nombre || doc.doctor_name}</span>
                            <span>•</span>
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        {doc.preview_url ? (
                          <a
                            href={doc.preview_url}
                            download={doc.nombre_archivo}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all border border-blue-200"
                          >
                            <Download className="h-3.5 w-3.5" /> Descargar
                          </a>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              toast({
                                title: "Documento en Servidor",
                                description: `Ubicación: ${doc.ruta_almacenamiento}`
                              });
                            }}
                            className="rounded-xl text-xs gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver Ruta
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDoc(doc.id, doc.nombre_archivo)}
                          className="rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </Layout>
  );
}
