import React, { useState } from 'react';
import { X, Stethoscope, CheckCircle2, AlertTriangle, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { telemonitoringService } from '@/services/telemonitoringService';
import { useToast } from '@/components/ui/use-toast';

export const NursingInterventionModal = ({ alert, onClose, onInterventionSaved }) => {
  const { toast } = useToast();
  const [conducta, setConducta] = useState('reagendamiento_prioritario');
  const [observaciones, setObservaciones] = useState('');
  const [staffNombre, setStaffNombre] = useState('Enf. Jefe Claudia Morales');
  const [loading, setLoading] = useState(false);

  if (!alert) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!observaciones.trim()) {
      toast({
        title: "Observaciones requeridas",
        description: "Por favor describe la acción clínica ejecutada con el paciente.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const result = await telemonitoringService.registerNursingIntervention(alert.id, {
        staff_nombre: staffNombre,
        conducta,
        observaciones
      });

      if (result.success) {
        toast({
          title: "✅ Intervención de Enfermería Registrada",
          description: "La alerta ha sido clasificada y archivada en la bitácora clínica."
        });
        if (onInterventionSaved) onInterventionSaved();
        onClose();
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "No se pudo registrar la intervención",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-6">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl">
                <Stethoscope className="h-6 w-6 text-emerald-300" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-200">
                  Panel Clínico de Enfermería
                </span>
                <h3 className="text-lg font-bold">Registro de Intervención</h3>
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Resumen de la Alerta */}
        <div className="bg-emerald-50/50 p-4 border-b border-emerald-100 text-xs">
          <span className="font-bold text-emerald-900 block mb-0.5">Alerta Atendida:</span>
          <p className="text-emerald-800 font-medium">{alert.titulo}</p>
          <p className="text-gray-500 mt-1">{alert.criterio_res_3280}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Profesional que interviene
            </label>
            <input
              type="text"
              value={staffNombre}
              onChange={(e) => setStaffNombre(e.target.value)}
              className="w-full text-xs font-medium border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Conducta Clínica Adoptada
            </label>
            <select
              value={conducta}
              onChange={(e) => setConducta(e.target.value)}
              className="w-full text-xs font-medium border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white"
            >
              <option value="reagendamiento_prioritario">Reagendamiento Prioritario de Consulta Médica (&lt; 24h)</option>
              <option value="remision_urgencias">🚨 Remisión Inmediata a Servicio de Urgencias</option>
              <option value="educacion_paciente">Educación en Salud y Pautas de Alarma (Res. 3280)</option>
              <option value="ajuste_medicamento_ordenado">Ajuste de Adherencia Farmacológica / Refuerzo de Dosis</option>
              <option value="visita_domiciliaria">Programación de Visita Domiciliaria de Auxiliar</option>
              <option value="monitoreo_intensivo">Monitoreo Intensivo Casero (Toma cada 4-6 horas)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Observaciones Clínicas y Evolución
            </label>
            <textarea
              rows={4}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalla la comunicación con el paciente, confirmación de síntomas y plan acordado..."
              className="w-full text-xs border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              size="sm" 
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Guardar Intervención
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
};
