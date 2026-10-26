// ==============================================================================
// CLINICAL RECORDS SERVICE - SADI CARE ENGINE
// Gestión de Historias Clínicas y Documentos de Pacientes
// Distribución rigurosa por carpetas:
// HISTORIAS_CLÍNICAS/NOMBRE_PACIENTE/<PDF | EXCEL | WORD | JPG/JPEG/PNG | POWERPOINT | POWER BI | PROJECT | ZIP/RAR | OTROS>
// ==============================================================================
import { supabase } from '@/lib/supabase';

const LOCAL_STORAGE_KEY_DOCUMENTS = 'sadi_3280_clinical_documents_v1';

export const FOLDER_CATEGORIES = [
  { id: 'PDF', label: 'PDF', icon: 'FileText', color: 'red', extensions: ['.pdf'] },
  { id: 'EXCEL', label: 'EXCEL', icon: 'FileSpreadsheet', color: 'emerald', extensions: ['.xlsx', '.xls', '.csv'] },
  { id: 'WORD', label: 'WORD', icon: 'FileText', color: 'blue', extensions: ['.docx', '.doc', '.rtf', '.odt'] },
  { id: 'JPG/JPEG/PNG', label: 'JPG/JPEG/PNG', icon: 'Image', color: 'amber', extensions: ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.svg', '.gif'] },
  { id: 'POWERPOINT', label: 'POWERPOINT', icon: 'Presentation', color: 'orange', extensions: ['.pptx', '.ppt', '.pps'] },
  { id: 'POWER BI', label: 'POWER BI', icon: 'BarChart2', color: 'yellow', extensions: ['.pbix'] },
  { id: 'PROJECT', label: 'PROJECT', icon: 'Calendar', color: 'indigo', extensions: ['.mpp'] },
  { id: 'ZIP/RAR', label: 'ZIP/RAR', icon: 'Archive', color: 'purple', extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'] },
  { id: 'OTROS', label: 'OTROS', icon: 'Folder', color: 'gray', extensions: [] }
];

/**
 * Clasifica automáticamente un archivo en la carpeta correspondiente
 * según su extensión y tipo MIME.
 */
export const classifyFileToFolder = (fileName = '') => {
  const lower = fileName.toLowerCase().trim();
  const ext = lower.slice(lower.lastIndexOf('.'));

  if (ext === '.pdf') return 'PDF';
  if (['.xlsx', '.xls', '.csv'].includes(ext)) return 'EXCEL';
  if (['.docx', '.doc', '.rtf', '.odt'].includes(ext)) return 'WORD';
  if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.svg', '.gif'].includes(ext)) return 'JPG/JPEG/PNG';
  if (['.pptx', '.ppt', '.pps'].includes(ext)) return 'POWERPOINT';
  if (ext === '.pbix') return 'POWER BI';
  if (ext === '.mpp') return 'PROJECT';
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return 'ZIP/RAR';
  return 'OTROS';
};

/**
 * Normaliza el nombre del paciente para la ruta de almacenamiento
 * Ejemplo: "Valentina Restrepo Morales" -> "VALENTINA_RESTREPO_MORALES"
 */
export const sanitizePatientFolder = (patientName = 'PACIENTE_DESCONOCIDO') => {
  return patientName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_');
};

/**
 * Genera la ruta rigurosa solicitada por el usuario:
 * HISTORIAS_CLÍNICAS/<NOMBRE_PACIENTE>/<CARPETA_DISCRIMINADA>/<NOMBRE_ARCHIVO>
 */
export const buildRigorousStoragePath = (patientName, category, fileName) => {
  const patientFolder = sanitizePatientFolder(patientName);
  return `HISTORIAS_CLÍNICAS/${patientFolder}/${category}/${fileName}`;
};

// Documentos iniciales de prueba pre-cargados
const SEED_DOCUMENTS = [
  // Valentina Restrepo (Gestante)
  {
    id: 'doc-001',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    patient_name: 'Valentina Restrepo Morales',
    doctor_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_name: 'Dr. Mauricio Villa Cardona',
    nombre_archivo: 'ecografia_detalle_anatomico_sem21.pdf',
    carpeta_clasificada: 'PDF',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/VALENTINA_RESTREPO_MORALES/PDF/ecografia_detalle_anatomico_sem21.pdf',
    tamano_bytes: 3450200,
    tipo_mime: 'application/pdf',
    descripcion_clinica: 'Informe ecográfico morfológico fetal sem 21 sin anomalías mayores.',
    subido_por_nombre: 'Dr. Mauricio Villa Cardona',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 'doc-002',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    patient_name: 'Valentina Restrepo Morales',
    doctor_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_name: 'Dr. Mauricio Villa Cardona',
    nombre_archivo: 'curva_monitoreo_tensional_semanal.xlsx',
    carpeta_clasificada: 'EXCEL',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/VALENTINA_RESTREPO_MORALES/EXCEL/curva_monitoreo_tensional_semanal.xlsx',
    tamano_bytes: 152400,
    tipo_mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    descripcion_clinica: 'Registro de tensiometría ambulatoria con cálculo de Presión Arterial Media (PAM).',
    subido_por_nombre: 'Dr. Mauricio Villa Cardona',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'doc-003',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    patient_name: 'Valentina Restrepo Morales',
    doctor_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_name: 'Dr. Mauricio Villa Cardona',
    nombre_archivo: 'epicrisis_control_obstetrico_alta_complejidad.docx',
    carpeta_clasificada: 'WORD',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/VALENTINA_RESTREPO_MORALES/WORD/epicrisis_control_obstetrico_alta_complejidad.docx',
    tamano_bytes: 84000,
    tipo_mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    descripcion_clinica: 'Nota médica de seguimiento por cifras de hipertensión gestacional y manejo con alfametildopa.',
    subido_por_nombre: 'Dr. Mauricio Villa Cardona',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'doc-004',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    patient_name: 'Valentina Restrepo Morales',
    doctor_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_name: 'Dr. Mauricio Villa Cardona',
    nombre_archivo: 'foto_doppler_arterias_uterinas.jpg',
    carpeta_clasificada: 'JPG/JPEG/PNG',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/VALENTINA_RESTREPO_MORALES/JPG/JPEG/PNG/foto_doppler_arterias_uterinas.jpg',
    tamano_bytes: 1890000,
    tipo_mime: 'image/jpeg',
    descripcion_clinica: 'Captura ecográfica de espectro Doppler de arterias uterinas con notch bilateral.',
    subido_por_nombre: 'Dr. Mauricio Villa Cardona',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString()
  },
  {
    id: 'doc-005',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    patient_name: 'Valentina Restrepo Morales',
    doctor_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_name: 'Dr. Mauricio Villa Cardona',
    nombre_archivo: 'educacion_preeclampsia_curso_maternidad.pptx',
    carpeta_clasificada: 'POWERPOINT',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/VALENTINA_RESTREPO_MORALES/POWERPOINT/educacion_preeclampsia_curso_maternidad.pptx',
    tamano_bytes: 4500000,
    tipo_mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    descripcion_clinica: 'Diapositivas explicativas sobre signos de alarma obstétrica de la Res. 3280 para la paciente.',
    subido_por_nombre: 'Dr. Mauricio Villa Cardona',
    created_at: new Date(Date.now() - 86400000 * 6).toISOString()
  },
  {
    id: 'doc-006',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    patient_name: 'Valentina Restrepo Morales',
    doctor_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_name: 'Dr. Mauricio Villa Cardona',
    nombre_archivo: 'tablero_analitico_riesgo_materno.pbix',
    carpeta_clasificada: 'POWER BI',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/VALENTINA_RESTREPO_MORALES/POWER BI/tablero_analitico_riesgo_materno.pbix',
    tamano_bytes: 8900000,
    tipo_mime: 'application/octet-stream',
    descripcion_clinica: 'Tablero dinámico Power BI de correlación de biomarcadores y evolución tensional.',
    subido_por_nombre: 'Dr. Mauricio Villa Cardona',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString()
  },
  {
    id: 'doc-007',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    patient_name: 'Valentina Restrepo Morales',
    doctor_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_name: 'Dr. Mauricio Villa Cardona',
    nombre_archivo: 'cronograma_atenciones_gestante_3280.mpp',
    carpeta_clasificada: 'PROJECT',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/VALENTINA_RESTREPO_MORALES/PROJECT/cronograma_atenciones_gestante_3280.mpp',
    tamano_bytes: 340000,
    tipo_mime: 'application/vnd.ms-project',
    descripcion_clinica: 'Cronograma MS Project de atenciones, ecografías y paraclínicos trimestrales de la RIAMP.',
    subido_por_nombre: 'Dr. Mauricio Villa Cardona',
    created_at: new Date(Date.now() - 86400000 * 8).toISOString()
  },
  {
    id: 'doc-008',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    patient_name: 'Valentina Restrepo Morales',
    doctor_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_name: 'Dr. Mauricio Villa Cardona',
    nombre_archivo: 'estudios_geneticos_completos_prenatales.zip',
    carpeta_clasificada: 'ZIP/RAR',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/VALENTINA_RESTREPO_MORALES/ZIP/RAR/estudios_geneticos_completos_prenatales.zip',
    tamano_bytes: 14500000,
    tipo_mime: 'application/zip',
    descripcion_clinica: 'Paquete comprimido con informes citogenéticos, ADN fetal libre y cariotipo prenatal.',
    subido_por_nombre: 'Dr. Mauricio Villa Cardona',
    created_at: new Date(Date.now() - 86400000 * 9).toISOString()
  },

  // Carlos Alberto Gómez (Adulto HTA + DM2)
  {
    id: 'doc-009',
    patient_id: 'p5050000-0000-0000-0000-000000000021',
    patient_name: 'Carlos Alberto Gómez Pineda',
    doctor_id: 'd4444444-4444-4444-4444-444444444444',
    doctor_name: 'Dr. Fernando Rincón Velásquez',
    nombre_archivo: 'laboratorio_hemoglobina_glicosilada_perfil_lipidico.pdf',
    carpeta_clasificada: 'PDF',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/CARLOS_ALBERTO_GOMEZ_PINEDA/PDF/laboratorio_hemoglobina_glicosilada_perfil_lipidico.pdf',
    tamano_bytes: 890000,
    tipo_mime: 'application/pdf',
    descripcion_clinica: 'HbA1c 8.2%, Creatinina 1.1 mg/dL, Colesterol LDL 145 mg/dL, Triglicéridos 210 mg/dL.',
    subido_por_nombre: 'Dr. Fernando Rincón Velásquez',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString()
  },
  {
    id: 'doc-010',
    patient_id: 'p5050000-0000-0000-0000-000000000021',
    patient_name: 'Carlos Alberto Gómez Pineda',
    doctor_id: 'd4444444-4444-4444-4444-444444444444',
    doctor_name: 'Dr. Fernando Rincón Velásquez',
    nombre_archivo: 'registro_glucometrias_ambulatorias_30dias.xlsx',
    carpeta_clasificada: 'EXCEL',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/CARLOS_ALBERTO_GOMEZ_PINEDA/EXCEL/registro_glucometrias_ambulatorias_30dias.xlsx',
    tamano_bytes: 95000,
    tipo_mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    descripcion_clinica: 'Curva diaria de glucometrías en ayunas y postprandiales 2h con promedios.',
    subido_por_nombre: 'Dr. Fernando Rincón Velásquez',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'doc-011',
    patient_id: 'p5050000-0000-0000-0000-000000000021',
    patient_name: 'Carlos Alberto Gómez Pineda',
    doctor_id: 'd4444444-4444-4444-4444-444444444444',
    doctor_name: 'Dr. Fernando Rincón Velásquez',
    nombre_archivo: 'electrocardiograma_12_derivaciones.jpg',
    carpeta_clasificada: 'JPG/JPEG/PNG',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/CARLOS_ALBERTO_GOMEZ_PINEDA/JPG/JPEG/PNG/electrocardiograma_12_derivaciones.jpg',
    tamano_bytes: 2100000,
    tipo_mime: 'image/jpeg',
    descripcion_clinica: 'Trazado de EKG con ritmo sinusal y signos de sobrecarga ventricular izquierda.',
    subido_por_nombre: 'Dr. Fernando Rincón Velásquez',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },

  // Mateo Benítez (Primera Infancia)
  {
    id: 'doc-012',
    patient_id: 'p1010000-0000-0000-0000-000000000002',
    patient_name: 'Mateo Benítez Valencia',
    doctor_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_name: 'Dra. Paola Andrea Gil Restrepo',
    nombre_archivo: 'escala_abreviada_desarrollo_ead3_evaluacion.pdf',
    carpeta_clasificada: 'PDF',
    ruta_almacenamiento: 'HISTORIAS_CLÍNICAS/MATEO_BENITEZ_VALENCIA/PDF/escala_abreviada_desarrollo_ead3_evaluacion.pdf',
    tamano_bytes: 620000,
    tipo_mime: 'application/pdf',
    descripcion_clinica: 'Hoja de registro de EAD-3 con percentiles adecuados en las 4 áreas del desarrollo.',
    subido_por_nombre: 'Dra. Paola Andrea Gil Restrepo',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString()
  }
];

const getStoredDocuments = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_DOCUMENTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error leyendo documentos de localStorage:', e);
  }
  localStorage.setItem(LOCAL_STORAGE_KEY_DOCUMENTS, JSON.stringify(SEED_DOCUMENTS));
  return SEED_DOCUMENTS;
};

const setStoredDocuments = (docs) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_DOCUMENTS, JSON.stringify(docs));
  } catch (e) {
    console.error('Error guardando documentos en localStorage:', e);
  }
};

export const clinicalRecordsService = {
  // Obtener documentos de un paciente o todos
  async getDocuments(patientId = null) {
    try {
      const { data, error } = await supabase
        .from('patient_clinical_documents')
        .select('*');
      if (!error && data && data.length > 0) {
        return patientId ? data.filter(d => d.patient_id === patientId) : data;
      }
    } catch (e) {
      // fallback
    }

    const docs = getStoredDocuments();
    if (patientId) {
      return docs.filter(d => d.patient_id === patientId);
    }
    return docs;
  },

  // Obtener el conteo de archivos agrupados por carpeta para un paciente
  async getFolderSummaryForPatient(patientId) {
    const docs = await this.getDocuments(patientId);
    const summary = {};
    FOLDER_CATEGORIES.forEach(f => {
      summary[f.id] = {
        category: f.id,
        label: f.label,
        count: 0,
        totalBytes: 0,
        files: []
      };
    });

    docs.forEach(doc => {
      const cat = doc.carpeta_clasificada || 'OTROS';
      if (!summary[cat]) {
        summary[cat] = { category: cat, label: cat, count: 0, totalBytes: 0, files: [] };
      }
      summary[cat].count += 1;
      summary[cat].totalBytes += (doc.tamano_bytes || 0);
      summary[cat].files.push(doc);
    });

    return summary;
  },

  /**
   * Subir un nuevo documento a la historia clínica del paciente
   * Sin límite de tamaño ni de tipo de archivo
   */
  async uploadClinicalDocument({
    patient_id,
    patient_name,
    doctor_id,
    doctor_name,
    file, // Objeto File nativo del navegador
    descripcion_clinica = '',
    customFileName = null
  }) {
    if (!file) throw new Error('No se ha suministrado ningún archivo para la historia clínica.');

    const fileName = customFileName || file.name;
    const category = classifyFileToFolder(fileName);
    const storagePath = buildRigorousStoragePath(patient_name, category, fileName);
    const docId = 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

    // Leer archivo como DataURL o Blob para permitir vista previa y descarga directa en el navegador
    let filePreviewUrl = null;
    try {
      filePreviewUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        // Si el archivo es muy grande (> 15MB), no saturar la memoria local con base64, usar object URL
        if (file.size > 15 * 1024 * 1024) {
          resolve(URL.createObjectURL(file));
        } else {
          reader.readAsDataURL(file);
        }
      });
    } catch (e) {
      filePreviewUrl = URL.createObjectURL(file);
    }

    const newDoc = {
      id: docId,
      patient_id,
      patient_name,
      doctor_id: doctor_id || 'd1111111-1111-1111-1111-111111111111',
      doctor_name: doctor_name || 'Dr. Especialista SADI',
      nombre_archivo: fileName,
      carpeta_clasificada: category,
      ruta_almacenamiento: storagePath,
      tamano_bytes: file.size,
      tipo_mime: file.type || 'application/octet-stream',
      descripcion_clinica: descripcion_clinica || `Documento clínico subido a la carpeta ${category}`,
      subido_por_nombre: doctor_name || 'Médico Tratante',
      preview_url: filePreviewUrl,
      created_at: new Date().toISOString()
    };

    // Intentar persistir en Supabase si está disponible
    try {
      await supabase.from('patient_clinical_documents').insert({
        id: newDoc.id,
        patient_id: newDoc.patient_id,
        doctor_id: newDoc.doctor_id,
        nombre_archivo: newDoc.nombre_archivo,
        carpeta_clasificada: newDoc.carpeta_clasificada,
        ruta_almacenamiento: newDoc.ruta_almacenamiento,
        tamano_bytes: newDoc.tamano_bytes,
        tipo_mime: newDoc.tipo_mime,
        descripcion_clinica: newDoc.descripcion_clinica,
        subido_por_nombre: newDoc.subido_por_nombre
      });
    } catch (e) {
      // Ignora error de red con Supabase y persiste local
    }

    const currentDocs = getStoredDocuments();
    setStoredDocuments([newDoc, ...currentDocs]);

    return newDoc;
  },

  // Eliminar un documento de la historia clínica
  async deleteDocument(documentId) {
    try {
      await supabase.from('patient_clinical_documents').delete().eq('id', documentId);
    } catch (e) {}

    const docs = getStoredDocuments();
    const filtered = docs.filter(d => d.id !== documentId);
    setStoredDocuments(filtered);
    return true;
  }
};
