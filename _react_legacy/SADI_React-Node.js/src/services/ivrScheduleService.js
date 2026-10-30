// ==============================================================================
// IVR SCHEDULE SERVICE - MOTOR AUTOMÁTICO DE TANDAS SADI 3280
// Programación de llamadas salientes automáticas por tandas de 32 pacientes cada 30 minutos
// Horario operativo: 10:00 AM a 06:00 PM
// Reglas:
// 1. Asignación automática por programa de Resolución 3280 y hospital.
// 2. Si no contesta en una tanda, se reasigna a la tanda siguiente.
// 3. Si no contesta en ninguna tanda del día, se envía a "Casos Aislados / Gestión Humana".
// 4. Modo de emisión: Standby (seguro) o Automático Activo.
// ==============================================================================

import { supabase } from '@/lib/supabase';
import { telemonitoringService } from './telemonitoringService';
import { getCursoVida3280, getRequiredRIASAppointments } from './rias3280Engine';

// Slots oficiales de tandas (cada 30 min entre 10:00 AM y 06:00 PM)
export const IVR_TIME_SLOTS = [
  { id: 't1',  hora: '10:00 AM', label: 'Tanda 1 (10:00 AM)', horaNum: 10.0 },
  { id: 't2',  hora: '10:30 AM', label: 'Tanda 2 (10:30 AM)', horaNum: 10.5 },
  { id: 't3',  hora: '11:00 AM', label: 'Tanda 3 (11:00 AM)', horaNum: 11.0 },
  { id: 't4',  hora: '11:30 AM', label: 'Tanda 4 (11:30 AM)', horaNum: 11.5 },
  { id: 't5',  hora: '12:00 M',  label: 'Tanda 5 (12:00 M)',  horaNum: 12.0 },
  { id: 't6',  hora: '12:30 PM', label: 'Tanda 6 (12:30 PM)', horaNum: 12.5 },
  { id: 't7',  hora: '01:00 PM', label: 'Tanda 7 (01:00 PM)', horaNum: 13.0 },
  { id: 't8',  hora: '01:30 PM', label: 'Tanda 8 (01:30 PM)', horaNum: 13.5 },
  { id: 't9',  hora: '02:00 PM', label: 'Tanda 9 (02:00 PM)', horaNum: 14.0 },
  { id: 't10', hora: '02:30 PM', label: 'Tanda 10 (02:30 PM)', horaNum: 14.5 },
  { id: 't11', hora: '03:00 PM', label: 'Tanda 11 (03:00 PM)', horaNum: 15.0 },
  { id: 't12', hora: '03:30 PM', label: 'Tanda 12 (03:30 PM)', horaNum: 15.5 },
  { id: 't13', hora: '04:00 PM', label: 'Tanda 13 (04:00 PM)', horaNum: 16.0 },
  { id: 't14', hora: '04:30 PM', label: 'Tanda 14 (04:30 PM)', horaNum: 16.5 },
  { id: 't15', hora: '05:00 PM', label: 'Tanda 15 (05:00 PM)', horaNum: 17.0 },
  { id: 't16', hora: '05:30 PM', label: 'Tanda 16 (05:30 PM)', horaNum: 17.5 },
  { id: 't17', hora: '06:00 PM', label: 'Tanda 17 (06:00 PM)', horaNum: 18.0 }
];

export const MAX_PATIENTS_PER_BATCH = 32;

const STORAGE_KEY_SCHEDULE = 'sadi_ivr_daily_schedule';
const STORAGE_KEY_CONFIG = 'sadi_ivr_config';

export const ivrScheduleService = {
  /**
   * Obtiene la configuración del motor IVR
   */
  getConfig() {
    const defaultCfg = {
      isLiveEnabled: false, // Por defecto en Standby seguro
      batchSize: 32,
      maxRetriesPerDay: 3,
      startSlot: '10:00 AM',
      endSlot: '06:00 PM',
      voiceId: 'pFZP5JQG7iQjIQuC4Bku',
      antiVoicemail: true,
      dtmfConfirmation: true
    };
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      return stored ? { ...defaultCfg, ...JSON.parse(stored) } : defaultCfg;
    } catch {
      return defaultCfg;
    }
  },

  /**
   * Guarda la configuración del motor
   */
  saveConfig(newConfig) {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
    return newConfig;
  },

  /**
   * Obtiene o genera el cronograma de llamadas del día actual
   */
  async getDailySchedule(hospitalId = null, forceRefresh = false) {
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(STORAGE_KEY_SCHEDULE);
        if (cached) {
          const parsed = JSON.parse(cached);
          const todayStr = new Date().toISOString().split('T')[0];
          if (parsed.fecha === todayStr) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Error leyendo caché de cronograma:', e);
      }
    }

    // Cargar pacientes de la base de datos
    let patients = [];
    try {
      const { data: dbPatients } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbPatients && dbPatients.length > 0) {
        patients = dbPatients;
      }
    } catch (e) {
      console.error('Error cargando pacientes de BD:', e);
    }

    if (patients.length === 0) {
      // Fallback a servicio de telemonitoreo
      patients = await telemonitoringService.getPatients();
    }

    // Construir la agenda de llamadas del día distribuyendo en tandas de 32
    const todayStr = new Date().toISOString().split('T')[0];
    const scheduleItems = [];

    // Distribuir los pacientes en las tandas
    let currentSlotIndex = 0;
    let slotCount = 0;

    patients.forEach((p, idx) => {
      const curso = getCursoVida3280(p.birthdate || p.fecha_nacimiento);
      const appts = getRequiredRIASAppointments(
        p.birthdate || p.fecha_nacimiento,
        p.sex || p.sexo,
        p.program === 'Maternidad' || p.es_gestante,
        p.semana_gestacional || 0
      );

      const targetAppt = appts[0] || {
        nombre: 'Valoración Integral de Salud y Prevención 3280',
        accion: 'Consulta médica preventiva anual'
      };

      const slot = IVR_TIME_SLOTS[currentSlotIndex] || IVR_TIME_SLOTS[0];

      // Estados posibles: 'programada', 'confirmada', 'reagendada', 'no_contesta', 'en_reintento', 'caso_aislado_humano'
      scheduleItems.push({
        id: `ivr-item-${p.patient_id || p.id || idx}`,
        patientId: p.patient_id || p.id,
        nombre: p.name || p.nombre,
        documento: p.document || p.documento,
        telefono: p.phone || p.telefono || '3001234567',
        direccion: p.address || p.direccion || 'Calle 15 #14-112',
        ciudad: p.city || p.ciudad || 'Palmira',
        email: p.email || '',
        cursoVida: curso.label,
        edad: curso.edad,
        programa3280: targetAppt.nombre,
        accion3280: targetAppt.accion,
        hospitalId: p.hospital_id || hospitalId,
        slotId: slot.id,
        slotHora: slot.hora,
        slotIndex: currentSlotIndex,
        estado: 'programada', // 'programada' | 'confirmada' | 'reagendada' | 'en_reintento' | 'caso_aislado_humano'
        intentos: 0,
        historialIntentos: [],
        ultimaInteraccion: null,
        resultadoDTMF: null, // '1_confirmo' | '2_reagendo' | 'no_contesto' | 'buzon'
        gestionHumana: {
          requerida: false,
          atendido: false,
          fechaGestion: null,
          responsable: null,
          notas: ''
        }
      });

      slotCount++;
      if (slotCount >= MAX_PATIENTS_PER_BATCH) {
        slotCount = 0;
        if (currentSlotIndex < IVR_TIME_SLOTS.length - 1) {
          currentSlotIndex++;
        }
      }
    });

    const scheduleData = {
      fecha: todayStr,
      hospitalId: hospitalId || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8',
      totalPacientes: scheduleItems.length,
      items: scheduleItems,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(scheduleData));
    return scheduleData;
  },

  /**
   * Simula la ejecución de una tanda específica.
   * Aplica las reglas:
   * 1. 75% contesta (marca 1 para confirmar o 2 para reagendar).
   * 2. 25% no contesta o da buzón:
   *    - Si hay tanda siguiente en el día -> SE REASIGNA A LA TANDA SIGUIENTE.
   *    - Si es la última tanda -> PASA A "CASOS AISLADOS / GESTIÓN HUMANA".
   */
  async simulateBatchExecution(slotId) {
    const currentSchedule = await this.getDailySchedule();
    const slotIdx = IVR_TIME_SLOTS.findIndex(s => s.id === slotId);
    if (slotIdx === -1) return currentSchedule;

    const currentSlot = IVR_TIME_SLOTS[slotIdx];
    const nextSlot = IVR_TIME_SLOTS[slotIdx + 1] || null;

    let updatedCount = 0;
    let reassignedCount = 0;
    let failedToHumanCount = 0;

    currentSchedule.items = currentSchedule.items.map(item => {
      if (item.slotId === slotId && (item.estado === 'programada' || item.estado === 'en_reintento')) {
        updatedCount++;
        item.intentos = (item.intentos || 0) + 1;
        const nowStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        // Simulación determinista basada en el ID
        const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + item.intentos;
        const randomRoll = hash % 10;

        if (randomRoll <= 5) {
          // 60% Confirma asistencia presionando tecla 1
          item.estado = 'confirmada';
          item.resultadoDTMF = '1_confirmo';
          item.ultimaInteraccion = `${nowStr} - Confirmó asistencia pulsando tecla 1`;
          item.historialIntentos.push({
            tanda: currentSlot.hora,
            hora: nowStr,
            resultado: 'Llamada exitosa: Marcó 1 (Confirma asistencia)'
          });
        } else if (randomRoll <= 7) {
          // 20% Reagenda presionando tecla 2
          item.estado = 'reagendada';
          item.resultadoDTMF = '2_reagendo';
          item.ultimaInteraccion = `${nowStr} - Solicitó reagendamiento pulsando tecla 2`;
          item.historialIntentos.push({
            tanda: currentSlot.hora,
            hora: nowStr,
            resultado: 'Llamada exitosa: Marcó 2 (Reagenda)'
          });
        } else {
          // 20% No contesta o detecta buzón (Anti-voicemail)
          const esBuzon = randomRoll === 8;
          const causaFallo = esBuzon ? 'Detección de buzón de voz (Llamada colgada)' : 'No contesta / Línea ocupada';

          item.historialIntentos.push({
            tanda: currentSlot.hora,
            hora: nowStr,
            resultado: `Intento ${item.intentos} fallido: ${causaFallo}`
          });

          if (nextSlot && item.intentos < 3) {
            // REASIGNAR AUTOMÁTICAMENTE A LA TANDA SIGUIENTE
            item.estado = 'en_reintento';
            item.slotId = nextSlot.id;
            item.slotHora = nextSlot.hora;
            item.slotIndex = slotIdx + 1;
            item.ultimaInteraccion = `${nowStr} - ${causaFallo}. Reasignado a tanda ${nextSlot.hora}`;
            reassignedCount++;
          } else {
            // NO CONTESTÓ EN NINGUNA TANDA -> CASO AISLADO / GESTIÓN HUMANA
            item.estado = 'caso_aislado_humano';
            item.gestionHumana.requerida = true;
            item.gestionHumana.atendido = false;
            item.ultimaInteraccion = `${nowStr} - Agotó intentos del día sin contestar. Derivado a Gestión Humana`;
            failedToHumanCount++;
          }
        }
      }
      return item;
    });

    currentSchedule.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(currentSchedule));

    return {
      schedule: currentSchedule,
      stats: {
        processed: updatedCount,
        reassigned: reassignedCount,
        sentToHuman: failedToHumanCount
      }
    };
  },

  /**
   * Registra una gestión manual humana sobre un caso aislado
   */
  async recordHumanIntervention(itemId, { responsable, notas, resultado }) {
    const currentSchedule = await this.getDailySchedule();
    const item = currentSchedule.items.find(i => i.id === itemId);

    if (item) {
      item.gestionHumana.atendido = true;
      item.gestionHumana.fechaGestion = new Date().toISOString();
      item.gestionHumana.responsable = responsable || 'Personal de Enfermería / Trabajo Social';
      item.gestionHumana.notas = notas;
      item.gestionHumana.resultado = resultado;
      item.estado = resultado === 'contactado_exitoso' ? 'confirmada' : 'gestion_manual_completada';
      item.ultimaInteraccion = `Gestión Humana: ${notas} (${resultado})`;

      localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(currentSchedule));
    }

    return currentSchedule;
  },

  /**
   * Resetea el cronograma de prueba
   */
  async resetSchedule() {
    localStorage.removeItem(STORAGE_KEY_SCHEDULE);
    return await this.getDailySchedule(null, true);
  }
};
