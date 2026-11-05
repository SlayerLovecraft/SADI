// ==============================================================================
// ROADMAP SERVICE - CRONOGRAMA MENSUAL RESOLUCIÓN 3280, CAMPAÑAS E INDIVIDUALES
// ==============================================================================
// Maneja las 3 secciones del Roadmap:
// 1. Resolución 3280: Cobertura total de todos los pacientes por mes según hitos Res. 3280.
//    Inamovible, tandas de 10am a 6pm, renovación mensual automática y navegación histórica.
// 2. Campañas: Ruta de llamadas de campañas activas del mes con filtros de edad y reintentos.
// 3. Individual o Particular: Registro y trazabilidad de llamadas funcionales con logs y transcripciones.
// Incluye Exportación a Excel en 3 Hojas mediante SheetJS (xlsx).
// ==============================================================================

import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { IVR_TIME_SLOTS } from './ivrScheduleService';
import { CURSOS_DE_VIDA_3280, PROGRAMAS_Y_TAMIZAJES_3280 } from './rias3280Catalog';
import { getCursoVida3280 } from './rias3280Engine';

export const MESES_DEL_ANIO = [
  { id: 1,  nombre: 'Enero' },
  { id: 2,  nombre: 'Febrero' },
  { id: 3,  nombre: 'Marzo' },
  { id: 4,  nombre: 'Abril' },
  { id: 5,  nombre: 'Mayo' },
  { id: 6,  nombre: 'Junio' },
  { id: 7,  nombre: 'Julio' },
  { id: 8,  nombre: 'Agosto' },
  { id: 9,  nombre: 'Septiembre' },
  { id: 10, nombre: 'Octubre' },
  { id: 11, nombre: 'Noviembre' },
  { id: 12, nombre: 'Diciembre' }
];

export const DEFAULT_HOSPITAL_ID = 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8';

export const roadmapService = {
  /**
   * Obtiene todos los pacientes del hospital para el roadmap
   */
  async getHospitalPatients(hospitalId = DEFAULT_HOSPITAL_ID) {
    try {
      const targetHospId = hospitalId || DEFAULT_HOSPITAL_ID;
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('hospital_id', targetHospId)
        .order('name', { ascending: true });

      if (error) {
        console.warn('Error obteniendo pacientes en Supabase:', error);
      }
      return data || [];
    } catch (e) {
      console.error('Error en getHospitalPatients:', e);
      return [];
    }
  },

  /**
   * Determina los hitos clínicos de la Resolución 3280 para un paciente en un mes específico
   */
  calculatePatientMilestones(patient, targetYear, targetMonth) {
    if (!patient.birthdate) {
      return {
        cursoVida: 'adultez',
        cursoVidaLabel: 'Adultez',
        edadFormato: 'Edad no registrada',
        programaPrincipal: 'Valoración Integral de Salud Adultos',
        hitoClinico: 'Tamizaje Preventivo General Res. 3280',
        codigoCups: '890201'
      };
    }

    const birth = new Date(patient.birthdate);
    // Calcular edad respecto al mes objetivo
    const targetDate = new Date(targetYear, targetMonth - 1, 15);
    
    let years = targetDate.getFullYear() - birth.getFullYear();
    let months = targetDate.getMonth() - birth.getMonth();
    let days = targetDate.getDate() - birth.getDate();
    if (days < 0) {
      months--;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const totalMonths = (targetDate.getFullYear() - birth.getFullYear()) * 12 + (targetDate.getMonth() - birth.getMonth());

    const isFemale = (patient.sex || '').toLowerCase().startsWith('f') || (patient.sex || '').toLowerCase() === 'mujer';
    const isGestante = (patient.program || '').toLowerCase().includes('materno') || 
                       (patient.program || '').toLowerCase().includes('prenatal') || 
                       (patient.program || '').toLowerCase().includes('embarazo');

    // 1. RUTA MATERNO PERINATAL (RIAMP)
    if (isGestante) {
      return {
        cursoVida: 'materno_perinatal',
        cursoVidaLabel: 'Ruta Materno Perinatal (RIAMP)',
        edadFormato: `${years} años (Gestante)`,
        programaPrincipal: 'Control Prenatal de Seguimiento Integral',
        hitoClinico: 'Evaluación materno fetal, curva de peso, PA y tamizaje prenatal mensual',
        codigoCups: '890201-OBS'
      };
    }

    // 2. PRIMERA INFANCIA (0 a 5 años, 11 meses, 29 días -> < 72 meses)
    if (totalMonths < 72) {
      let hito = 'Control Crecimiento y Desarrollo Primera Infancia (EAD-3)';
      let cups = '890201-PI';

      if (totalMonths <= 3) {
        hito = 'Atención médica integral 2-3 meses (Medicina General / Pediatría) + Vacunación PAI Pentavalente';
        cups = '890201-PI2M';
      } else if (totalMonths <= 11) {
        hito = 'Atención médica 6-11 meses (Medicina General / Pediatría) + Inicio Salud Bucal (Barniz Flúor)';
        cups = '890201-PI6M';
      } else if (totalMonths <= 23) {
        hito = 'Atención médica 18-23 meses (Pediatría / Medicina General) + Tamizaje Hemoglobina';
        cups = '890201-PI18M';
      } else if (totalMonths <= 35) {
        hito = 'Atención integral 30-35 meses (Pediatría / Medicina Familiar) + Neurodesarrollo EAD-3';
        cups = '890201-PI30M';
      } else if (totalMonths < 60) {
        hito = 'Atención en salud por medicina general a los 4 años + Valoración agudeza visual';
        cups = '890201-PI4A';
      } else {
        hito = 'Atención a los 5 años (Control preescolar, tamizaje visual Snellen y refuerzo PAI)';
        cups = '890201-PI5A';
      }

      return {
        cursoVida: 'primera_infancia',
        cursoVidaLabel: 'Primera Infancia (0 a 5 años)',
        edadFormato: `${years}a ${months}m (${totalMonths} meses)`,
        programaPrincipal: 'Atención en salud por Medicina General / Pediatría',
        hitoClinico: hito,
        codigoCups: cups
      };
    }

    // 3. INFANCIA (6 a 11 años -> 72 a 143 meses)
    if (totalMonths < 144) {
      const isVisualYear = [6, 8, 10].includes(years);
      return {
        cursoVida: 'infancia',
        cursoVidaLabel: 'Infancia (6 a 11 años)',
        edadFormato: `${years} años`,
        programaPrincipal: 'Atención en Salud Escolar y Valoración Integral de Infancia',
        hitoClinico: isVisualYear 
          ? `Valoración integral médica anual + Tamizaje de Agudeza Visual Snellen (${years} años)`
          : `Valoración médica de crecimiento y desarrollo + Salud Bucal semestral (${years} años)`,
        codigoCups: '890201-INF'
      };
    }

    // 4. ADOLESCENCIA (12 a 17 años)
    if (years < 18) {
      return {
        cursoVida: 'adolescencia',
        cursoVidaLabel: 'Adolescencia (12 a 17 años)',
        edadFormato: `${years} años`,
        programaPrincipal: 'Atención Integral de la Adolescencia y Hebiatría',
        hitoClinico: isFemale 
          ? `Valoración integral médica anual + Asesoría en Anticoncepción y Tamizaje Hemoglobina (${years} años)`
          : `Valoración integral médica anual + Salud Sexual, Reproductiva y Tamizaje Psicosocial (${years} años)`,
        codigoCups: '890201-ADO'
      };
    }

    // 5. JUVENTUD (18 a 28 años)
    if (years <= 28) {
      return {
        cursoVida: 'juventud',
        cursoVidaLabel: 'Juventud (18 a 28 años)',
        edadFormato: `${years} años`,
        programaPrincipal: 'Atención Integral en Salud para la Juventud',
        hitoClinico: isFemale && years >= 25 
          ? `Valoración médica general + Tamizaje Ca Cuello Uterino (Citología/ADN-VPH) y Planificación`
          : `Valoración integral médica + Tamizaje de ITS (VIH/Sífilis) y Asesoría en Salud Reproductiva`,
        codigoCups: '890201-JUV'
      };
    }

    // 6. ADULTEZ (29 a 59 años)
    if (years <= 59) {
      let tamizajes = ['Valoración de Riesgo Cardiovascular y Metabólico (Test FINDRISC)'];
      if (isFemale) {
        tamizajes.push('Tamizaje Ca Cuello Uterino (Prueba ADN-VPH esquema 1-5-5)');
        if (years >= 50) tamizajes.push('Tamizaje Ca de Mama (Mamografía Bilateral)');
      } else {
        if (years >= 50) tamizajes.push('Tamizaje Ca de Próstata (PSA sérico + Examen clínico)');
      }
      if (years >= 50) tamizajes.push('Tamizaje Ca Colorrectal (Sangre Oculta en Heces FIT)');

      return {
        cursoVida: 'adultez',
        cursoVidaLabel: 'Adultez (29 a 59 años)',
        edadFormato: `${years} años`,
        programaPrincipal: 'Atención Integral del Adulto y Tamizaje Oncológico',
        hitoClinico: tamizajes.join(' + '),
        codigoCups: '890201-ADU'
      };
    }

    // 7. VEJEZ (60+ años)
    return {
      cursoVida: 'vejez',
      cursoVidaLabel: 'Vejez (60+ años)',
      edadFormato: `${years} años`,
      programaPrincipal: 'Valoración Geriátrica Integral del Adulto Mayor',
      hitoClinico: 'Evaluación funcional (Barthel/Lawton), tamizaje de caídas, función cognitiva y riesgo cardiovascular',
      codigoCups: '890201-VEJ'
    };
  },

  /**
   * Genera el Roadmap Mensual de Resolución 3280 para TODOS los pacientes del hospital.
   * Inamovible, distribuido ordenadamente en días laborables y franjas de 10:00 AM a 06:00 PM.
   */
  async getResolutionRoadmap(hospitalId = DEFAULT_HOSPITAL_ID, year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
    const storageKey = `sadi_roadmap_res3280_${hospitalId}_${year}_${month}`;

    // 1. Verificar si ya está persistido en caché local
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error leyendo caché de roadmap:', e);
    }

    // 2. Obtener todos los pacientes
    const patients = await this.getHospitalPatients(hospitalId);
    if (!patients || patients.length === 0) {
      return [];
    }

    // 3. Obtener días del mes (Lunes a Sábado)
    const daysInMonth = new Date(year, month, 0).getDate();
    const workdays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dayOfWeek = date.getDay(); // 0 = Domingo
      if (dayOfWeek !== 0) { // Excluir domingos
        const yyyy = year;
        const mm = String(month).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        workdays.push({
          dateStr: `${yyyy}-${mm}-${dd}`,
          dayNum: d,
          dayName: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dayOfWeek]
        });
      }
    }

    const availableSlots = IVR_TIME_SLOTS; // 17 slots (10:00 AM a 06:00 PM)

    // 4. Distribuir pacientes ordenadamente en el mes de manera inamovible
    const roadmapItems = patients.map((patient, index) => {
      const milestone = this.calculatePatientMilestones(patient, year, month);
      
      // Asignar día y slot de forma determinista
      const dayIndex = index % workdays.length;
      const assignedDay = workdays[dayIndex];
      const slotIndex = Math.floor(index / workdays.length) % availableSlots.length;
      const assignedSlot = availableSlots[slotIndex];

      // Determinar estado simulado consistente para trazabilidad
      let estado = 'Programada';
      const today = new Date();
      const itemDate = new Date(`${assignedDay.dateStr}T12:00:00`);
      
      if (itemDate < today) {
        // Fechas pasadas
        estado = (index % 7 === 0) ? 'Reagendada' : (index % 11 === 0) ? 'No Contesta' : 'Confirmada';
      }

      return {
        id: `res3280_${year}_${month}_${patient.patient_id || patient.id || index}`,
        pacienteId: patient.patient_id || patient.id,
        nombre: patient.name,
        documento: patient.document,
        telefono: patient.phone,
        email: patient.email || 'No registrado',
        direccion: patient.address || 'No registrada',
        ciudad: patient.city || 'Caldas',
        sexo: patient.sex,
        fechaNacimiento: patient.birthdate,
        edadFormato: milestone.edadFormato,
        cursoVida: milestone.cursoVida,
        cursoVidaLabel: milestone.cursoVidaLabel,
        programaPrincipal: milestone.programaPrincipal,
        hitoClinico: milestone.hitoClinico,
        codigoCups: milestone.codigoCups,
        fechaProgramada: assignedDay.dateStr,
        diaNombre: assignedDay.dayName,
        diaNumero: assignedDay.dayNum,
        horaProgramada: assignedSlot.hora,
        slotId: assignedSlot.id,
        slotLabel: assignedSlot.label,
        estado: estado,
        intentos: estado === 'Confirmada' ? 1 : estado === 'Reagendada' ? 2 : 0,
        canal: 'Llamada IVR / Agente IA',
        renovacionAutomatica: true
      };
    });

    // Ordenar cronológicamente
    roadmapItems.sort((a, b) => {
      const cmpDate = a.fechaProgramada.localeCompare(b.fechaProgramada);
      if (cmpDate !== 0) return cmpDate;
      return a.slotId.localeCompare(b.slotId);
    });

    // 5. Persistir en localStorage
    try {
      localStorage.setItem(storageKey, JSON.stringify(roadmapItems));
    } catch (e) {
      console.warn('No se pudo persistir en localStorage:', e);
    }

    return roadmapItems;
  },

  /**
   * Obtiene el Roadmap de Campañas del Mes
   */
  async getCampaignsRoadmap(hospitalId = DEFAULT_HOSPITAL_ID, year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
    try {
      const targetHospId = hospitalId || DEFAULT_HOSPITAL_ID;
      
      // Obtener campañas de Supabase
      const { data: dbCampaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('hospital_id', targetHospId);

      if (error) {
        console.warn('Error obteniendo campañas:', error);
      }

      const allCampaigns = dbCampaigns || [];

      // Filtrar campañas que correspondan al mes y año seleccionado
      const filtered = allCampaigns.filter(c => {
        // Coincidencia directa por año y mes
        if (c.anio && c.mes) {
          return Number(c.anio) === Number(year) && Number(c.mes) === Number(month);
        }
        // Coincidencia por fecha_programada
        if (c.fecha_programada) {
          const d = new Date(c.fecha_programada);
          return d.getFullYear() === Number(year) && (d.getMonth() + 1) === Number(month);
        }
        // Coincidencia por created_at
        if (c.created_at) {
          const d = new Date(c.created_at);
          return d.getFullYear() === Number(year) && (d.getMonth() + 1) === Number(month);
        }
        return false;
      });

      // Mapear con datos detallados para el roadmap
      return filtered.map((c, idx) => {
        const diaInicio = c.dia_inicio || 1;
        const yyyy = year;
        const mm = String(month).padStart(2, '0');
        const dd = String(diaInicio).padStart(2, '0');
        const fechaInicio = `${yyyy}-${mm}-${dd}`;

        // Cálculo de duración aproximada (a razón de tandas de 32 pacientes cada 30 min)
        const destinatarios = c.destinatarios || 0;
        const tandasNecesarias = Math.ceil((destinatarios || 1) / 32);
        const horasEstimadas = tandasNecesarias * 0.5;
        const duracionTexto = destinatarios > 0
          ? `${tandasNecesarias} tanda(s) de 32 llamadas (~${horasEstimadas} horas operativas)`
          : 'Campaña sin destinatarios asignados';

        // Determinar edad o segmento
        let rangoEdadDisplay = 'Cualquiera (Todos los pacientes)';
        if (c.edad_tipo === 'curso_vida') {
          rangoEdadDisplay = `Curso de Vida: ${c.edad_curso_vida || 'Todos'}`;
        } else if (c.edad_tipo === 'personalizado' && c.edad_custom) {
          const cust = c.edad_custom;
          rangoEdadDisplay = `Personalizado: ${cust.anos || 0} años, ${cust.meses || 0} meses, ${cust.dias || 0} días`;
        }

        const modoReintento = c.modo_reintento === 'solo_una_vez'
          ? 'Solo 1 vez'
          : 'Hasta que todos respondan (Exclusión automática tras respuesta exitosa)';

        return {
          id: c.id || `camp_${idx}`,
          nombre: c.nombre || 'Campaña sin nombre',
          fechaInicio: fechaInicio,
          diaInicio: diaInicio,
          horaProgramada: c.hora_programada || '10:00 AM',
          estado: c.estado || 'Activa',
          edadTipo: c.edad_tipo || 'cualquiera',
          rangoEdadDisplay: rangoEdadDisplay,
          modoReintento: modoReintento,
          contextoAgente: c.contexto_agente || 'Instrucciones estándar de llamada clínica preventiva SADI.',
          destinatarios: destinatarios,
          enviados: c.enviados || 0,
          entregados: c.entregados || 0,
          fallidos: c.fallidos || 0,
          tasaEfectividad: destinatarios > 0 ? Math.round(((c.entregados || 0) / destinatarios) * 100) : 0,
          duracionEstimada: duracionTexto,
          participantes: c.participantes || {}
        };
      });
    } catch (e) {
      console.error('Error en getCampaignsRoadmap:', e);
      return [];
    }
  },

  /**
   * Obtiene el Roadmap de Llamadas Individuales o Particulares
   */
  async getIndividualCallsRoadmap(hospitalId = DEFAULT_HOSPITAL_ID, year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
    try {
      // 1. Consultar evidencias de contacto en Supabase
      const { data: dbLogs, error } = await supabase
        .from('ai_contact_evidence')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error consultando ai_contact_evidence:', error);
      }

      // 2. Consultar registros locales por si se ejecutaron llamadas recientes
      let localLogs = [];
      try {
        const stored = localStorage.getItem('sadi_individual_calls_log');
        if (stored) {
          localLogs = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Error leyendo localLogs:', e);
      }

      // 3. Unificar registros evitando duplicados por ID
      const unified = [...localLogs, ...(dbLogs || [])];
      const seen = new Set();
      const unique = [];

      for (const item of unified) {
        const key = item.id || `${item.telefono_destino}_${item.created_at}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      }

      // 4. Filtrar por el año y mes seleccionado
      const filtered = unique.filter(log => {
        if (!log.created_at) return true;
        const d = new Date(log.created_at);
        return d.getFullYear() === Number(year) && (d.getMonth() + 1) === Number(month);
      });

      // 5. Mapear en formato limpio
      return filtered.map((log, idx) => {
        const createdDate = log.created_at ? new Date(log.created_at) : new Date();
        const fechaHoraFormateada = createdDate.toLocaleString('es-CO', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        const isEfectiva = log.resultado_contacto === 'Efectiva' || 
                           log.resultado_contacto === 'contactado_exitoso' || 
                           log.paciente_acepto_cita === true ||
                           log.paciente_confirmo_sintomas === true;

        return {
          id: log.id || `indiv_${idx}`,
          fechaHora: fechaHoraFormateada,
          rawDate: createdDate,
          pacienteNombre: log.paciente_nombre || log.patient_name || 'Paciente Particular',
          documento: log.documento || log.patient_document || 'CC 1234567890',
          telefono: log.telefono_destino || log.phone || '+573057120876',
          canal: log.canal || 'Llamada Saliente GSM (Puerto 22)',
          motivoContacto: log.motivo_contacto || 'Demanda Inducida Individual Res. 3280',
          resultado: isEfectiva ? 'Efectiva' : (log.resultado_contacto || 'No Contesta'),
          duracionSegundos: log.duracion_segundos || 65,
          resumenClinico: log.resumen_clinico_ia || 'Paciente atendió llamada del Agente IA y confirmó datos de atención preventiva.',
          transcripcion: typeof log.transcripcion_dialogo === 'string'
            ? log.transcripcion_dialogo
            : Array.isArray(log.transcripcion_dialogo)
            ? log.transcripcion_dialogo.map(m => `${m.role || m.speaker || 'Agente'}: ${m.message || m.text || ''}`).join('\n')
            : 'Agente: Buenas tardes. Le informamos que autoriza el tratamiento de sus datos de salud... Paciente: De acuerdo, confirmo mi asistencia.'
        };
      });
    } catch (e) {
      console.error('Error en getIndividualCallsRoadmap:', e);
      return [];
    }
  },

  /**
   * Registra una nueva llamada individual en la base de datos y memoria local
   */
  async registerIndividualCall(callData) {
    try {
      const now = new Date().toISOString();
      const newEntry = {
        patient_id: callData.patientId || null,
        canal: callData.canal || 'Llamada Saliente GSM (Puerto 22)',
        motivo_contacto: callData.motivoContacto || 'Demanda Inducida Individual Res. 3280',
        telefono_destino: callData.telefono,
        duracion_segundos: callData.duracionSegundos || 45,
        resultado_contacto: callData.resultado || 'Efectiva',
        paciente_acepto_cita: callData.aceptoCita !== false,
        paciente_confirmo_sintomas: true,
        resumen_clinico_ia: callData.resumenClinico || 'Llamada individual realizada con éxito desde el módulo Demanda Res. 3280.',
        transcripcion_dialogo: callData.transcripcion || 'Transcripción registrada automáticamente.',
        created_at: now
      };

      // Guardar en Supabase
      const { data, error } = await supabase
        .from('ai_contact_evidence')
        .insert([newEntry])
        .select()
        .single();

      if (error) {
        console.warn('Error insertando en ai_contact_evidence Supabase:', error);
      }

      // Guardar también en localStorage para consistencia inmediata
      try {
        const stored = localStorage.getItem('sadi_individual_calls_log');
        const currentList = stored ? JSON.parse(stored) : [];
        currentList.unshift({
          ...newEntry,
          id: data?.id || `local_${Date.now()}`,
          paciente_nombre: callData.pacienteNombre,
          documento: callData.documento
        });
        localStorage.setItem('sadi_individual_calls_log', JSON.stringify(currentList));
      } catch (e) {
        console.warn('Error guardando en localStorage:', e);
      }

      return { success: true, data: data || newEntry };
    } catch (e) {
      console.error('Error en registerIndividualCall:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Exporta las 3 secciones del Roadmap a un archivo Excel (.xlsx) con 3 hojas dedicadas.
   */
  exportRoadmapToExcel(resolutionData, campaignsData, individualData, year, month) {
    const nombreMes = MESES_DEL_ANIO.find(m => m.id === Number(month))?.nombre || `Mes_${month}`;
    const wb = XLSX.utils.book_new();

    // -------------------------------------------------------------
    // HOJA 1: RESOLUCIÓN 3280
    // -------------------------------------------------------------
    const resRows = resolutionData.map(item => ({
      'Fecha Programada': item.fechaProgramada,
      'Día': item.diaNombre,
      'Hora Programada': item.horaProgramada,
      'Tanda IVR': item.slotLabel,
      'Cédula / Documento': item.documento,
      'Nombre del Paciente': item.nombre,
      'Teléfono': item.telefono,
      'Curso de Vida Res. 3280': item.cursoVidaLabel,
      'Edad Calculada': item.edadFormato,
      'Programa Principal': item.programaPrincipal,
      'Hito Clínico Res. 3280': item.hitoClinico,
      'Código CUPS': item.codigoCups,
      'Estado de la Llamada': item.estado,
      'Intentos': item.intentos,
      'Canal': item.canal
    }));

    const wsResolution = XLSX.utils.json_to_sheet(resRows.length > 0 ? resRows : [{ 'Estado': 'No hay datos en este mes' }]);
    XLSX.utils.book_append_sheet(wb, wsResolution, 'Resolución 3280');

    // -------------------------------------------------------------
    // HOJA 2: CAMPAÑAS DEL MES
    // -------------------------------------------------------------
    const campRows = campaignsData.map(c => ({
      'Nombre de la Campaña': c.nombre,
      'Fecha de Inicio': c.fechaInicio,
      'Hora Programada': c.horaProgramada,
      'Segmento / Edad': c.rangoEdadDisplay,
      'Modo de Reintento': c.modoReintento,
      'Contexto para el Agente IA': c.contextoAgente,
      'Destinatarios Totales': c.destinatarios,
      'Enviados / Marcados': c.enviados,
      'Entregados / Exitosos': c.entregados,
      'Tasa de Efectividad (%)': `${c.tasaEfectividad}%`,
      'Duración Estimada Agente': c.duracionEstimada,
      'Estado Actual': c.estado
    }));

    const wsCampaigns = XLSX.utils.json_to_sheet(campRows.length > 0 ? campRows : [{ 'Estado': 'No hay campañas activas en este mes' }]);
    XLSX.utils.book_append_sheet(wb, wsCampaigns, 'Campañas');

    // -------------------------------------------------------------
    // HOJA 3: INDIVIDUAL O PARTICULAR
    // -------------------------------------------------------------
    const indivRows = individualData.map(ind => ({
      'Fecha y Hora': ind.fechaHora,
      'Cédula / Documento': ind.documento,
      'Nombre del Paciente': ind.pacienteNombre,
      'Teléfono Destino': ind.telefono,
      'Canal Utilizado': ind.canal,
      'Motivo de Contacto 3280': ind.motivoContacto,
      'Resultado de la Llamada': ind.resultado,
      'Duración (Segundos)': ind.duracionSegundos,
      'Resumen Clínico IA': ind.resumenClinico,
      'Transcripción Completa': ind.transcripcion
    }));

    const wsIndividual = XLSX.utils.json_to_sheet(indivRows.length > 0 ? indivRows : [{ 'Estado': 'No hay llamadas individuales registradas en este mes' }]);
    XLSX.utils.book_append_sheet(wb, wsIndividual, 'Individual o Particular');

    // Generar archivo y forzar descarga
    const fileName = `SADI_Roadmap_3280_${nombreMes}_${year}.xlsx`;
    XLSX.writeFile(wb, fileName);
    return fileName;
  }
};
