import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BarChart3, Loader2, Paperclip, Send, Target, X } from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { segmentService } from '@/services/segmentService';
import { isPatientUniquelyAssignedToDoctor, normalizeText } from './doctorUtils';

const DoctorReportsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [segments, setSegments] = useState([]);
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [segmentsError, setSegmentsError] = useState(null);

  const [segmentId, setSegmentId] = useState('');
  const [recordType, setRecordType] = useState('Reporte médico');
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const hospitalIdForSegments = useMemo(() => {
    return user?.hospitalId || null;
  }, [user?.hospitalId]);

  const specialtyKey = useMemo(() => {
    return normalizeText(user?.doctor_specialty || user?.doctorSpecialty || '');
  }, [user?.doctor_specialty, user?.doctorSpecialty]);

  const loadSegments = useCallback(async () => {
    try {
      setLoadingSegments(true);
      setSegmentsError(null);

      const result = await segmentService.getAll(hospitalIdForSegments);
      if (!result.success) {
        throw new Error(result.error || 'No se pudieron cargar los segmentos');
      }

      setSegments(result.data || []);
    } catch (e) {
      setSegments([]);
      setSegmentsError(e?.message || 'No se pudieron cargar los segmentos');
    } finally {
      setLoadingSegments(false);
    }
  }, [hospitalIdForSegments]);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  const canSubmit = useMemo(() => {
    return Boolean(segmentId && notes.trim() && recordType.trim() && recordDate);
  }, [segmentId, notes, recordType, recordDate]);

  const uploadAttachmentIfNeeded = async () => {
    if (!attachmentFile) return null;

    const bucket = 'clinical_attachments';
    const hospitalId = hospitalIdForSegments || 'unknown-hospital';
    const doctorId = user?.doctor_id || user?.id || 'unknown-doctor';
    const safeName = String(attachmentFile.name || 'documento')
      .replaceAll('\\', '_')
      .replaceAll('/', '_')
      .replaceAll('..', '_')
      .trim();

    const random =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const path = `${hospitalId}/${doctorId}/${recordDate || 'sin-fecha'}/${random}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, attachmentFile, {
        upsert: false,
        contentType: attachmentFile.type || undefined,
      });

    if (uploadError) {
      const message = uploadError?.message || 'No se pudo subir el documento';
      const hint =
        message.toLowerCase().includes('bucket') ||
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('permission') ||
        message.toLowerCase().includes('row-level security');

      throw new Error(
        hint
          ? `No se pudo adjuntar el documento (Storage). Crea el bucket "${bucket}" y configura permisos/policies para subir y leer archivos. Detalle: ${message}`
          : message
      );
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicData?.publicUrl || null;
  };

  const createRecordsForSegment = async () => {
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      setLastResult(null);

      let attachmentUrl = null;
      if (attachmentFile) {
        try {
          attachmentUrl = await uploadAttachmentIfNeeded();
        } catch (e) {
          toast({
            title: "Adjunto no subido",
            description: `${e?.message || 'No se pudo subir el documento'}. El reporte se guardará sin adjunto.`,
            variant: "destructive",
          });
          attachmentUrl = null;
        }
      }

      const patientsResult = await segmentService.getPatientsInSegment(segmentId);
      if (!patientsResult.success) {
        throw new Error(patientsResult.error || 'No se pudieron obtener pacientes del segmento');
      }

      const segmentPatients = patientsResult.data || [];

      if (!hospitalIdForSegments) {
        throw new Error('No se pudo identificar el hospital para validar la asignación');
      }
      if (!specialtyKey) {
        throw new Error('Tu usuario no tiene especialidad asignada');
      }

      const { data: rosterData, error: rosterError } = await supabase
        .from('staff')
        .select('doctor_id')
        .eq('hospital_id', hospitalIdForSegments)
        .eq('doctor_specialty', specialtyKey)
        .eq('is_active', true);

      if (rosterError) {
        throw new Error(rosterError.message || 'No se pudo validar la asignación de pacientes');
      }

      const eligibleDoctorIds = (rosterData || [])
        .map((r) => String(r.doctor_id || '').trim())
        .filter(Boolean);

      const doctorId = String(user?.doctor_id || user?.id || '').trim();
      if (doctorId && !eligibleDoctorIds.includes(doctorId)) eligibleDoctorIds.push(doctorId);

      const assignedPatients = segmentPatients.filter((p) =>
        isPatientUniquelyAssignedToDoctor(p, user, eligibleDoctorIds)
      );

      if (assignedPatients.length === 0) {
        setLastResult({ inserted: 0, totalSegment: segmentPatients.length, filtered: 0 });
        toast({
          title: "Sin pacientes",
          description: "El segmento no contiene pacientes asignados a ti.",
          variant: "destructive",
        });
        return;
      }

      const insertRows = assignedPatients.map((p) => ({
        patient_id: p.patient_id,
        hospital_id: p.hospital_id || hospitalIdForSegments,
        doctor_id: user?.doctor_id || user?.id || null,
        doctor_name: user?.doctor_name || user?.nombre || user?.email || null,
        doctor_specialty: user?.doctor_specialty || user?.doctorSpecialty || null,
        record_type: recordType || 'Reporte médico',
        record_date: recordDate || new Date().toISOString().slice(0, 10),
        notes: notes.trim(),
        attachment_url: attachmentUrl
      }));

      const { error: insertError } = await supabase
        .from('clinical_records')
        .insert(insertRows);

      if (insertError) throw insertError;

      setLastResult({ inserted: insertRows.length, totalSegment: segmentPatients.length, filtered: assignedPatients.length });
      toast({
        title: "Reporte enviado",
        description: `Se agregó a historia clínica de ${insertRows.length} pacientes.`,
      });
      setNotes('');
      setAttachmentFile(null);
    } catch (e) {
      const message = String(e?.message || '');
      const isMissingTable =
        message.toLowerCase().includes('clinical_records') &&
        (message.toLowerCase().includes('does not exist') || message.toLowerCase().includes('no existe'));

      toast({
        title: "Error",
        description: isMissingTable
          ? 'Falta crear la tabla de Historia Clínica. Ejecute `SQLs/create_clinical_records_table.sql` en Supabase.'
          : (e?.message || 'No se pudo enviar el reporte'),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Reportes Doctor - SADI</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
            <p className="text-gray-500 mt-1">Crea reportes segmentados para tus pacientes</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="segment-id">Segmento</Label>
                <div className="relative mt-1">
                  <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    id="segment-id"
                    value={segmentId}
                    onChange={(e) => setSegmentId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    disabled={loadingSegments || segments.length === 0}
                  >
                    <option value="">
                      {loadingSegments ? 'Cargando segmentos...' : 'Selecciona un segmento'}
                    </option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {segmentsError && (
                  <p className="text-sm text-red-600 mt-2">{segmentsError}</p>
                )}
                {!loadingSegments && !segmentsError && segments.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">No hay segmentos creados para tu hospital.</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="report-type">Tipo</Label>
                  <div className="relative mt-1">
                    <BarChart3 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="report-type"
                      type="text"
                      value={recordType}
                      onChange={(e) => setRecordType(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="report-date">Fecha</Label>
                  <input
                    id="report-date"
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="w-full mt-1 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Contenido del reporte</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full mt-1 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-40"
                  placeholder="Escribe aquí el reporte. Se agregará a la Historia Clínica de pacientes del segmento asignados a ti."
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    className="hidden"
                    id="clinical-attachment"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setAttachmentFile(file);
                    }}
                    disabled={submitting}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('clinical-attachment')?.click()}
                    disabled={submitting}
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Adjuntar documento
                  </Button>
                  {attachmentFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setAttachmentFile(null)}
                      disabled={submitting}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Quitar
                    </Button>
                  )}
                </div>

                <Button onClick={createRecordsForSegment} disabled={!canSubmit || submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" /> Enviar a Historia Clínica
                    </>
                  )}
                </Button>
              </div>

              {attachmentFile && (
                <div className="text-sm text-gray-600">
                  Archivo: {attachmentFile.name}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900">Reglas</h2>
                <ul className="mt-2 text-sm text-gray-700 space-y-1">
                  <li>El reporte se agrega como registro en `Historia Clínica`.</li>
                  <li>Solo se envía a pacientes del segmento asignados a ti.</li>
                  <li>La asignación se calcula por programa/especialidad.</li>
                </ul>
              </div>

              {lastResult && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h2 className="font-semibold text-gray-900">Último envío</h2>
                  <div className="mt-2 text-sm text-gray-700 space-y-1">
                    <div>Pacientes en segmento: {lastResult.totalSegment}</div>
                    <div>Pacientes asignados a ti: {lastResult.filtered}</div>
                    <div>Registros creados: {lastResult.inserted}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DoctorReportsPage;
