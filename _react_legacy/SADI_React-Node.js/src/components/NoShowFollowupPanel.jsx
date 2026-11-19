// ==============================================================================
// NoShowFollowupPanel.jsx - PANEL DE SEGUIMIENTO AUTOMÁTICO A INASISTENTES
// Regla oficial:
//   - Falta a la cita (fecha original) -> +3 días envío automático de SMS
//   - Si NO responde al primer SMS -> +2 días (+5 desde cita original)
//     insistencia automática con 2° SMS + E-Mail
// ==============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  BellRing, Calendar, CheckCircle2, Mail, MessageSquare,
  Plus, RefreshCw, Search, Send, UserX, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  noShowFollowupService,
  NOSHOW_POLICY,
  computeNoShowSchedule,
} from '@/services/noShowFollowupService';
import { patientService } from '@/services/patientService';
import { CursoVidaBadge, GruposRiesgoBadges } from '@/components/PatientClinicalBadges';

const ESTADO_META = {
  pendiente_sms_3d: {
    label: 'Pendiente SMS (+3d)',
    cls: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
  },
  sms_3d_enviado: {
    label: 'SMS #1 Enviado · Esperando respuesta',
    cls: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800',
  },
  respondio_reagendado: {
    label: 'Respondió SMS · Reagendado',
    cls: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
  },
  insistencia_enviada: {
    label: 'Insistencia (+2d): 2° SMS + E-Mail Enviados',
    cls: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800',
  },
};

export default function NoShowFollowupPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const hospitalId = user?.hospitalId || user?.hospital_id || null;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  // Registro manual/prueba de inasistencia con búsqueda real en los 142k pacientes
  const [patientQuery, setPatientQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [fechaCita, setFechaCita] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivoCita, setMotivoCita] = useState('Valoración Integral Resolución 3280');
  const [saving, setSaving] = useState(false);

  const loadFollowups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await noShowFollowupService.listFollowups({ hospitalId, limit: 100 });
      if (res.success) setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    loadFollowups();
  }, [loadFollowups]);

  useEffect(() => {
    const q = patientQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await patientService.getPaginated({ page: 1, pageSize: 8, search: q });
      if (res.success) setSearchResults(res.data || []);
    }, 280);
    return () => clearTimeout(t);
  }, [patientQuery]);

  const previewDates = computeNoShowSchedule(fechaCita);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast({
        title: 'Selecciona un paciente',
        description: 'Busca y selecciona un paciente real de la base de datos para registrar su inasistencia.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const res = await noShowFollowupService.registerNoShow({
        hospitalId,
        patientId: selectedPatient.patient_id || selectedPatient.id,
        fechaCitaOriginal: fechaCita,
        motivoCita,
      });
      if (!res.success) throw new Error(res.error || 'Error registrando inasistencia');
      toast({
        title: 'Seguimiento por inasistencia programado',
        description: `SMS #1 (+3d): ${previewDates.fechaSms1} • Insistencia (+2d si no responde): ${previewDates.fechaInsistencia2} (SMS + E-Mail).`,
      });
      setSelectedPatient(null);
      setPatientQuery('');
      setSearchResults([]);
      await loadFollowups();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (row, action) => {
    setBusyId(row.id);
    try {
      let res;
      if (action === 'sms1') {
        res = await noShowFollowupService.dispatchStep1Sms(row);
        if (res.success) {
          toast({
            title: 'SMS #1 (+3 días) enviado',
            description: `Enviado a ${row.patient_name}. Si no responde, el ${row.fecha_seguimiento_2} se insistirá con 2° SMS + E-Mail.`,
          });
        }
      } else if (action === 'responded') {
        res = await noShowFollowupService.markPatientResponded(row);
        if (res.success) {
          toast({
            title: 'Respuesta de paciente confirmada',
            description: `${row.patient_name} respondió al SMS #1. Se cancela la insistencia del día +5.`,
          });
        }
      } else if (action === 'step2') {
        res = await noShowFollowupService.dispatchStep2SmsAndEmail(row);
        if (res.success) {
          toast({
            title: 'Insistencia (+2d) enviada: 2° SMS + E-Mail',
            description: `Despachados 2° SMS y correo electrónico de reagendamiento a ${row.patient_name}.`,
          });
        }
      }
      if (!res?.success) throw new Error(res?.error || 'No se pudo ejecutar la acción');
      await loadFollowups();
    } catch (err) {
      toast({ title: 'Acción no completada', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5" data-testid="noshow-followup-panel">
      {/* Banner explicativo de la regla exacta */}
      <div className="bg-gradient-to-r from-cyan-900 via-blue-950 to-slate-900 rounded-2xl p-5 text-white shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
            <BellRing className="w-3.5 h-3.5" /> Regla Automática de Inasistencias Activa
          </div>
          <h3 className="text-lg font-black">Seguimiento a Pacientes Inasistentes a Citas</h3>
          <p className="text-xs text-slate-300 max-w-3xl">{NOSHOW_POLICY.descripcion}</p>
        </div>

        <div className="flex items-center gap-2 text-xs shrink-0 flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 font-bold">
            1. Cita perdida (Día 0)
          </span>
          <span className="text-cyan-300 font-black">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-blue-500/25 border border-blue-400/40 font-bold text-blue-100">
            2. Día +3: SMS
          </span>
          <span className="text-cyan-300 font-black">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-purple-500/25 border border-purple-400/40 font-bold text-purple-100">
            3. Sin respuesta (+2d): SMS + E-Mail
          </span>
        </div>
      </div>

      {/* Formulario rápido para registrar inasistencia real desde BD */}
      <form
        onSubmit={handleRegister}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Registrar Inasistencia a Cita (Programa SMS +3d y SMS + E-Mail +2d)
          </h4>
          <Button type="button" variant="ghost" size="sm" onClick={loadFollowups} className="text-xs gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="md:col-span-2 relative">
            <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
              Paciente (buscar en BD real por nombre o cédula)
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={selectedPatient ? `${selectedPatient.nombre} (${selectedPatient.cc})` : patientQuery}
                onChange={(e) => {
                  setSelectedPatient(null);
                  setPatientQuery(e.target.value);
                }}
                placeholder="Ej: 1006010518 o nombre del paciente..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            {searchResults.length > 0 && !selectedPatient && (
              <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatient(p);
                      setSearchResults([]);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs">{p.nombre}</div>
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {p.tipo_documento || 'CC'}: {p.cc} • {p.telefono || 'Sin tel.'}
                      </div>
                    </div>
                    <CursoVidaBadge patient={p} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
              Fecha original de la cita
            </label>
            <input
              type="date"
              value={fechaCita}
              onChange={(e) => setFechaCita(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
              Motivo / Programa
            </label>
            <input
              type="text"
              value={motivoCita}
              onChange={(e) => setMotivoCita(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>
              Programación automática calculada: <strong>SMS #1 (+3d): {previewDates.fechaSms1}</strong> •{' '}
              <strong>Insistencia SMS + E-Mail (+2d si no responde): {previewDates.fechaInsistencia2}</strong>
            </span>
          </div>
          <Button
            type="submit"
            disabled={saving || !selectedPatient}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {saving ? 'Registrando...' : 'Programar Seguimiento'}
          </Button>
        </div>
      </form>

      {/* Tabla de seguimientos activos */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-white font-bold uppercase text-[10.5px] tracking-wider">
            <tr>
              <th className="p-3">Paciente</th>
              <th className="p-3">Curso de Vida & Grupos de Riesgo</th>
              <th className="p-3">Cita Original</th>
              <th className="p-3">Paso 1: SMS (+3d)</th>
              <th className="p-3">Paso 2: SMS + E-Mail (+2d)</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  Cargando seguimientos por inasistencia...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No hay inasistencias registradas aún. Cuando un paciente falte a su cita (desde Agenda Médica o el formulario superior), aparecerá aquí con sus fechas exactas de SMS (+3 días) e insistencia SMS + E-Mail (+2 días).
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const st = ESTADO_META[r.estado] || ESTADO_META.pendiente_sms_3d;
                const patObj = {
                  curso_vida: r.patient_curso_vida,
                  grupo_riesgo: r.patient_grupo_riesgo,
                  grupos_riesgo: r.patient_grupos_riesgo,
                };
                const isBusy = busyId === r.id;
                return (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white">{r.patient_name}</div>
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {r.patient_tipo_documento || 'CC'}: {r.patient_document} • {r.patient_phone || 'Sin tel.'}
                      </div>
                      {r.patient_email && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{r.patient_email}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1 items-start">
                        <CursoVidaBadge patient={patObj} />
                        <GruposRiesgoBadges patient={patObj} maxVisible={2} />
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      <Calendar className="w-3 h-3 inline mr-1 text-slate-400" />
                      {r.fecha_cita_original}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-blue-700 dark:text-blue-300">{r.fecha_sms_1}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {r.sms_1_enviado_at ? 'SMS enviado' : 'Programado (+3 días)'}
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-purple-700 dark:text-purple-300">{r.fecha_seguimiento_2}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {r.respondio_sms_1
                          ? 'Cancelado (respondió)'
                          : r.sms_2_enviado_at
                          ? '2° SMS + E-Mail enviados'
                          : 'Si no responde (+2d)'}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {!r.sms_1_enviado_at && !r.respondio_sms_1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => handleAction(r, 'sms1')}
                            className="h-7 text-[10.5px] rounded-lg gap-1"
                          >
                            <MessageSquare className="w-3 h-3" /> Enviar SMS (+3d)
                          </Button>
                        )}
                        {!r.respondio_sms_1 && r.estado !== 'insistencia_enviada' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleAction(r, 'responded')}
                              className="h-7 text-[10.5px] rounded-lg gap-1 border-emerald-300 text-emerald-700 dark:text-emerald-300"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Respondió
                            </Button>
                            <Button
                              size="sm"
                              disabled={isBusy}
                              onClick={() => handleAction(r, 'step2')}
                              className="h-7 text-[10.5px] rounded-lg gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              <Mail className="w-3 h-3" /> Insistir (+2d SMS+Mail)
                            </Button>
                          </>
                        )}
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
  );
}
