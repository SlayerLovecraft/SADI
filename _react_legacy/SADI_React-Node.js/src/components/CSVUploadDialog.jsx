import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { patientService } from '@/services/patientService';
import { staffService } from '@/services/staffService';

// --- Helpers CSV ---
const splitCSVLine = (line) => {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result.map(v => v.trim());
};

const normalizeHeader = (h) =>
  h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');

const mapCSVRowWithHeaders = (headers, values) => {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = values[i] ?? '';
  }
  return obj;
};

const getField = (row, ...keys) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '';
};

const CSVUploadDialog = ({ entity = 'patients', hospitalId, onUploadComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const [failedRows, setFailedRows] = useState([]);
  const { toast } = useToast();
  const dropRef = useRef(null);

  const isDoctors = entity === 'doctors';
  const title = isDoctors ? 'Carga Masiva de Doctores' : 'Carga Masiva de Pacientes';
  const entityLabelPlural = isDoctors ? 'doctores' : 'pacientes';
  const handleOpenChange = (open) => {
    if (isProcessing) return;
    setIsOpen(open);
  };

  // --- File handling ---
  const handleFileSelected = async (f) => {
    if (!f) return;
    
    if (!f.type && !f.name?.toLowerCase().endsWith('.csv')) {
      toast({ 
        title: 'Archivo inválido', 
        description: 'Seleccione un CSV (.csv)', 
        variant: 'destructive' 
      });
      return;
    }

    setFile(f);
    setUploadResults(null);
    setFailedRows([]);
    setProgress(0);

    try {
      const text = await f.text();
      const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
      
      if (lines.length === 0) {
        toast({ 
          title: 'CSV vacío', 
          description: 'El archivo no contiene filas', 
          variant: 'destructive' 
        });
        return;
      }

      const rawHeaders = splitCSVLine(lines[0]);
      const headers = rawHeaders.map(normalizeHeader);

      const previewRows = [];
      for (let i = 1; i < Math.min(lines.length, 21); i++) {
        const vals = splitCSVLine(lines[i]);
        previewRows.push(mapCSVRowWithHeaders(headers, vals));
      }

      setPreview({ 
        headers, 
        rawHeaders, 
        previewRows, 
        rowCount: lines.length - 1 
      });
      
      toast({ 
        title: 'Archivo listo', 
        description: `${f.name} (${lines.length - 1} filas)` 
      });
    } catch (e) {
      console.error('❌ Error leyendo CSV:', e);
      toast({ 
        title: 'Error leyendo CSV', 
        description: String(e), 
        variant: 'destructive' 
      });
    }
  };

  const handleInputChange = (e) => {
    const f = e.target.files && e.target.files[0];
    handleFileSelected(f);
  };

  // drag handlers
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    handleFileSelected(f);
    if (dropRef.current) dropRef.current.classList.remove('ring-2');
  };
  
  const onDragOver = (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    if (dropRef.current) dropRef.current.classList.add('ring-2'); 
  };
  
  const onDragLeave = (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    if (dropRef.current) dropRef.current.classList.remove('ring-2'); 
  };

  // parse full CSV into rows (normalized headers)
  const parseFullCSV = async () => {
    if (!file) return { headers: [], rows: [] };
    
    const text = await file.text();
    const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
    
    if (lines.length <= 1) return { headers: [], rows: [] };
    
    const headers = splitCSVLine(lines[0]).map(normalizeHeader);
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const vals = splitCSVLine(lines[i]);
      const row = mapCSVRowWithHeaders(headers, vals);
      rows.push({ __rowNum: i + 1, ...row });
    }
    
    return { headers, rows };
  };

  // Mapear CSV a formato de patientService
  const mapToPatient = (row) => {
    // Extraer nombre completo
    const fullName = getField(row, 'nombre', 'name', 'full_name', 'nombre_completo');
    
    // Extraer fecha de nacimiento
    const fechaNacimiento = getField(row, 'fecha_nacimiento', 'birthdate', 'fecha', 'date_of_birth', 'nacimiento');
    
    // Extraer sexo/género
    const sexoRaw = getField(row, 'sexo', 'genero', 'sex', 'gender');
    let sexo = 'M'; // Default
    if (sexoRaw) {
      const s = sexoRaw.toString().toUpperCase();
      if (s.startsWith('F')) sexo = 'F';
      else if (s.startsWith('M')) sexo = 'M';
    }

    return {
      nombre: fullName,
      email: String(getField(row, 'email', 'correo', 'mail') || '').trim().toLowerCase(),
      cc: String(getField(row, 'cc', 'cedula', 'documento', 'document', 'identificacion') || '').trim(),
      telefono: String(getField(row, 'telefono', 'phone', 'tel') || '').trim(),
      fechaNacimiento: fechaNacimiento,
      sexo: sexo,
      direccion: String(getField(row, 'direccion', 'address') || '').trim(),
      ciudad: String(getField(row, 'ciudad', 'city') || '').trim(),
      programa: String(getField(row, 'programa', 'program') || '').trim(),
      __rowNum: row.__rowNum
    };
  };

  const mapToDoctor = (row) => {
    return {
      nombre: getField(row, 'nombre', 'doctor_name', 'name', 'full_name', 'nombre_completo'),
      email: getField(row, 'email', 'correo', 'mail', 'doctor_email').toString().trim(),
      password: getField(row, 'password', 'contrasena', 'contraseña', 'doctor_password').toString(),
      especialidad: getField(row, 'especialidad', 'specialty', 'doctor_specialty').toString().trim(),
      __rowNum: row.__rowNum,
    };
  };

  // Upload usando patientService.createBulk
  const handleUpload = async () => {
    console.log("🚀 Iniciando carga CSV directa a Supabase");

    if (!file) {
      toast({ 
        title: "No hay archivo", 
        description: "Selecciona un archivo CSV antes de subir.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      // 1. Parse CSV completo
      console.log("📄 Parseando CSV completo...");
      const { rows } = await parseFullCSV();
      setProgress(25);

      if (rows.length === 0) {
        toast({
          title: "CSV vacío",
          description: "No se encontraron filas válidas",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      const validEntities = [];
      const errors = [];

      rows.forEach(row => {
        try {
          const entityRow = isDoctors ? mapToDoctor(row) : mapToPatient(row);

          if (!entityRow.email) {
            errors.push({
              row: row.__rowNum,
              [isDoctors ? 'doctor' : 'patient']: isDoctors
                ? { nombre: entityRow.nombre || 'Desconocido', email: entityRow.email, especialidad: entityRow.especialidad }
                : { nombre: entityRow.nombre || 'Desconocido', cc: entityRow.cc },
              error: 'Falta email (campo obligatorio)',
            });
            return;
          }

          if (!isDoctors && !entityRow.nombre) {
            errors.push({
              row: row.__rowNum,
              patient: { email: entityRow.email, cc: entityRow.cc },
              error: 'Falta nombre (campo obligatorio)',
            });
            return;
          }

          if (!isDoctors && !entityRow.cc) {
            errors.push({
              row: row.__rowNum,
              patient: { nombre: entityRow.nombre, email: entityRow.email },
              error: 'Falta cédula/documento (campo obligatorio)',
            });
            return;
          }

          if (isDoctors && !entityRow.password) {
            errors.push({
              row: row.__rowNum,
              doctor: { nombre: entityRow.nombre, email: entityRow.email, especialidad: entityRow.especialidad },
              error: 'Falta contraseña (campo obligatorio)',
            });
            return;
          }

          if (isDoctors && !entityRow.especialidad) {
            errors.push({
              row: row.__rowNum,
              doctor: { nombre: entityRow.nombre, email: entityRow.email, especialidad: entityRow.especialidad },
              error: 'Falta especialidad (campo obligatorio)',
            });
            return;
          }

          // Validar formato de email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(entityRow.email)) {
            errors.push({
              row: row.__rowNum,
              [isDoctors ? 'doctor' : 'patient']: isDoctors
                ? { nombre: entityRow.nombre, email: entityRow.email, especialidad: entityRow.especialidad }
                : { nombre: entityRow.nombre, cc: entityRow.cc },
              error: `Email inválido: ${entityRow.email}`,
            });
            return;
          }

          validEntities.push(entityRow);
        } catch (error) {
          errors.push({
            row: row.__rowNum,
            [isDoctors ? 'doctor' : 'patient']: { nombre: row.nombre || 'Desconocido' },
            error: error.message
          });
        }
      });

      console.log(`✅ Registros válidos: ${validEntities.length}`);
      console.log(`❌ Errores de validación: ${errors.length}`);
      setProgress(40);

      if (validEntities.length === 0) {
        setUploadResults({
          total: rows.length,
          successful: 0,
          failed: errors.length,
          errors
        });
        setFailedRows(errors);
        toast({
          title: `Ningún ${isDoctors ? 'doctor' : 'paciente'} válido`,
          description: "Todos los registros tienen errores de validación",
          variant: "destructive"
        });
        setIsProcessing(false);
        setProgress(100);
        return;
      }

      console.log(`📤 Creando ${validEntities.length} ${entityLabelPlural}...`);
      setProgress(50);

      const result = isDoctors
        ? await staffService.createBulk(validEntities, {
          batchSize: 50,
          onProgress: (current, total) => {
            const batchProgress = 50 + ((current / total) * 40);
            setProgress(Math.min(batchProgress, 90));
          }
        })
        : await patientService.createBulk(validEntities, {
        batchSize: 50,
        onProgress: (current, total) => {
          const batchProgress = 50 + ((current / total) * 40);
          setProgress(Math.min(batchProgress, 90));
        }
        });

      setProgress(90);

      // 4. Procesar resultados
      const totalErrors = [
        ...errors,
        ...((result.failed || []).map((f) => ({
          row: (validEntities?.[f.index]?.__rowNum ?? 'desconocida'),
          [isDoctors ? 'doctor' : 'patient']: isDoctors ? (f.doctor || {}) : (f.patient || {}),
          error: f.error,
        }))),
      ];
      
      setUploadResults({
        total: rows.length,
        successful: result.successCount || 0,
        failed: totalErrors.length,
        errors: totalErrors
      });

      setFailedRows(totalErrors);

      if (result.successCount > 0) {
        const attempted = rows.length;
        const successful = result.successCount || 0;
        const failed = totalErrors.length;
        toast({
          title: "Carga completada",
          description: `Intentados: ${attempted} — Exitosos: ${successful} — Fallidos: ${failed}`,
        });

        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        const attempted = rows.length;
        const failed = totalErrors.length;
        toast({
          title: "Carga fallida",
          description: `Intentados: ${attempted} — Exitosos: 0 — Fallidos: ${failed}`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error("💥 ERROR EN handleUpload:", error);
      toast({
        title: "Error inesperado",
        description: error.message || "Ocurrió un error al procesar el archivo",
        variant: "destructive"
      });
      
      setUploadResults({
        total: 0,
        successful: 0,
        failed: 1,
        errors: [{ row: 'general', [isDoctors ? 'doctor' : 'patient']: {}, error: error.message }]
      });
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  // Reintentar filas fallidas
  const handleRetryFailed = async () => {
    if (!failedRows || failedRows.length === 0) {
      toast({ title: 'Nada que reintentar' });
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      const retryEntities = isDoctors
        ? failedRows
          .filter((f) => f.doctor?.email && f.doctor?.password && f.doctor?.especialidad)
          .map((f) => f.doctor)
        : failedRows
          .filter((f) => f.patient?.nombre && f.patient?.cc && f.patient?.email)
          .map((f) => f.patient);

      if (retryEntities.length === 0) {
        toast({
          title: `Sin ${entityLabelPlural} para reintentar`,
          description: 'Todos los errores son de validación',
          variant: 'destructive'
        });
        setIsProcessing(false);
        return;
      }

      console.log(`🔄 Reintentando ${retryEntities.length} ${entityLabelPlural}...`);
      setProgress(20);

      const result = isDoctors
        ? await staffService.createBulk(retryEntities, {
          batchSize: 25,
          onProgress: (current, total) => {
            const retryProgress = 20 + ((current / total) * 70);
            setProgress(Math.min(retryProgress, 90));
          }
        })
        : await patientService.createBulk(retryEntities, {
        batchSize: 25,
        onProgress: (current, total) => {
          const retryProgress = 20 + ((current / total) * 70);
          setProgress(Math.min(retryProgress, 90));
        }
        });

      setProgress(90);

      const newErrors = (result.failed || []).map((f) => ({
        row: (retryEntities?.[f.index]?.__rowNum ?? 'desconocida'),
        [isDoctors ? 'doctor' : 'patient']: isDoctors ? (f.doctor || {}) : (f.patient || {}),
        error: f.error,
      }));
      
      setFailedRows(newErrors);
      setUploadResults(prev => ({
        ...prev,
        successful: (prev?.successful || 0) + (result.successCount || 0),
        failed: newErrors.length,
        errors: newErrors
      }));

      toast({
        title: 'Reintento completado',
        description: `Intentados: ${retryEntities.length} — Exitosos: ${result.successCount || 0} — Fallidos: ${newErrors.length}`,
      });

      if (result.successCount > 0 && onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      toast({
        title: 'Error en reintento',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const downloadErrorsCSV = (errors) => {
    if (!errors?.length) {
      toast({ title: 'Sin errores para descargar' });
      return;
    }

    const header = isDoctors ? 'row,nombre,email,especialidad,error\n' : 'row,nombre,email,cedula,error\n';
    const lines = errors.map((e) => {
      const item = isDoctors ? e.doctor : e.patient;
      if (isDoctors) {
        return `${e.row},"${(item?.nombre || '').replace(/"/g, '""')}","${(item?.email || '').replace(/"/g, '""')}","${(item?.especialidad || '').replace(/"/g, '""')}","${(e.error || '').replace(/"/g, '""')}"`;
      }
      return `${e.row},"${(item?.nombre || '').replace(/"/g, '""')}","${(item?.email || '').replace(/"/g, '""')}","${(item?.cc || '').replace(/"/g, '""')}","${(e.error || '').replace(/"/g, '""')}"`;
    });
    const csv = header + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = isDoctors ? 'errores_carga_doctores.csv' : 'errores_carga_pacientes.csv';
    link.click();
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setUploadResults(null);
    setFailedRows([]);
    setProgress(0);
    setIsProcessing(false);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center">
          <Upload className="h-4 w-4 mr-2" /> Cargar CSV
        </Button>
      </DialogTrigger>

      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={(e) => {
          if (isProcessing) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isProcessing) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold">Formato del CSV</p>
                <p className="text-xs mt-1">
                  {isDoctors ? (
                    <>Campos obligatorios: <strong>email</strong>, <strong>contraseña</strong> y <strong>especialidad</strong></>
                  ) : (
                    <>Campos obligatorios: <strong>nombre</strong>, <strong>email</strong> y <strong>cédula</strong></>
                  )}
                </p>
                <p className="text-xs mt-1">
                  {isDoctors ? (
                    <>Campos opcionales: nombre</>
                  ) : (
                    <>Campos opcionales: teléfono, fecha_nacimiento, sexo, dirección, ciudad, programa</>
                  )}
                </p>
                {hospitalId && (
                  <p className="text-xs mt-2 text-green-700">
                    ✅ Los {entityLabelPlural} se asociarán automáticamente a tu hospital
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Drag zone */}
          <div
            ref={dropRef}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className="relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition"
          >
            <div className="flex items-center justify-center gap-3">
              <div className="p-3 bg-white rounded-full shadow-sm">
                <FileText className="h-6 w-6 text-gray-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Arrastra tu CSV aquí o haz clic en "Seleccionar archivo"</p>
                <p className="text-xs text-gray-500">Acepta .csv — soporta comillas y comas internas.</p>
              </div>
            </div>

            <div className="mt-4 flex justify-center gap-3 items-center">
              <label
                htmlFor="csv-file"
                className="inline-flex items-center px-4 py-2 bg-white border rounded-md cursor-pointer text-sm hover:bg-gray-50"
              >
                Seleccionar archivo
              </label>
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleInputChange}
                className="hidden"
              />

              {file && (
                <div className="text-sm text-gray-600">
                  {file.name} — {(file.size / 1024).toFixed(2)} KB
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="text-sm font-semibold">Vista previa (primeras 20 filas)</p>
                  <p className="text-xs text-gray-500">
                    Headers detectados: {preview.rawHeaders.join(', ')}
                  </p>
                </div>
                <div className="text-xs text-gray-500">Total: {preview.rowCount} filas</div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="text-left text-gray-600">
                    <tr>
                      <th className="pr-4">#</th>
                      {preview.headers.slice(0, 8).map((h, i) => (
                        <th key={i} className="pr-4">{h}</th>
                      ))}
                      {preview.headers.length > 8 && <th>...</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="pr-4">{i + 1}</td>
                        {preview.headers.slice(0, 8).map((h, j) => (
                          <td key={j} className="pr-4">{r[h]}</td>
                        ))}
                        {preview.headers.length > 8 && <td>...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  style={{ width: `${progress}%` }}
                  className="h-3 bg-green-500 transition-all duration-300"
                />
              </div>
              <p className="text-xs text-center text-gray-600">
                {progress < 30 ? 'Validando datos...' : 
                 progress < 90 ? `Creando ${entityLabelPlural}...` : 
                 'Finalizando...'}
              </p>
            </div>
          )}

          {/* Results */}
          {uploadResults && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded text-center">
                <p className="text-2xl font-bold">{uploadResults.total}</p>
                <p className="text-sm text-gray-600">Procesados</p>
              </div>
              <div className="bg-green-50 p-4 rounded text-center">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-2xl font-bold text-green-900">{uploadResults.successful}</p>
                </div>
                <p className="text-sm text-green-600">Exitosos</p>
              </div>
              <div className="bg-red-50 p-4 rounded text-center">
                <div className="flex items-center justify-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <p className="text-2xl font-bold text-red-900">{uploadResults.failed}</p>
                </div>
                <p className="text-sm text-red-600">Fallidos</p>
              </div>
            </div>
          )}

          {/* Errors */}
          {uploadResults?.errors && uploadResults.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-56 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-red-900">Errores encontrados</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadErrorsCSV(uploadResults.errors)}
                  >
                    <Download className="h-3 w-3 mr-1" /> Descargar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRetryFailed}
                    disabled={isProcessing || failedRows.length === 0}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Reintentar
                  </Button>
                </div>
              </div>

              {uploadResults.errors.slice(0, 50).map((e, idx) => (
                <div key={idx} className="text-xs text-red-800 mb-1">
                  <strong>Fila {e.row}</strong> — {(isDoctors ? e.doctor?.nombre : e.patient?.nombre) || 'sin nombre'} ({(isDoctors ? e.doctor?.email : e.patient?.email) || 'sin email'}): {e.error}
                </div>
              ))}

              {uploadResults.errors.length > 50 && (
                <p className="text-xs text-red-600 italic mt-2">
                  ... y {uploadResults.errors.length - 50} errores más
                </p>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={reset} disabled={isProcessing}>
              Cancelar
            </Button>
            {!uploadResults ? (
              <Button onClick={handleUpload} disabled={!file || isProcessing}>
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" /> Cargar {isDoctors ? 'Doctores' : 'Pacientes'}
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={reset}>Cerrar</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CSVUploadDialog;
