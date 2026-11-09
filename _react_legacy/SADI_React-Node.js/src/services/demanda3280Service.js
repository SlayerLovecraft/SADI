import { supabase } from '@/lib/supabase';
import { roadmapService } from '@/services/roadmapService';
import { CURSOS_DE_VIDA_3280, PROGRAMAS_Y_TAMIZAJES_3280 } from '@/services/rias3280Catalog';
import { IVR_TIME_SLOTS } from '@/services/ivrScheduleService';

const DEFAULT_HOSPITAL_ID = 'hosp-001';

export const GRUPOS_RIESGO_3280 = [
  { id: 'materno_perinatal', label: '1. Población Materno-Perinatal', desc: 'Mujeres gestantes, parto, puerperio y recién nacidos.' },
  { id: 'cardiovascular', label: '2. Riesgo Cardiovascular y Metabólico', desc: 'Hipertensión, diabetes, dislipidemias, obesidad y ERC.' },
  { id: 'cancer', label: '3. Cáncer (Detección temprana)', desc: 'Tamizaje cuello uterino, mama, próstata y colon/recto.' },
  { id: 'respiratorias', label: '4. Enfermedades Respiratorias Crónicas', desc: 'Pacientes con asma o EPOC.' },
  { id: 'salud_mental', label: '5. Salud Mental y Consumo de Sustancias', desc: 'Violencias, trastornos mentales, SPA, alcohol y tabaco.' },
  { id: 'infecciosas', label: '6. Enfermedades Infecciosas y Zoonóticas', desc: 'VIH/SIDA, tuberculosis, ITS, dengue, malaria, Chagas.' },
  { id: 'nutricionales', label: '7. Alteraciones Nutricionales', desc: 'Desnutrición aguda/crónica y deficiencias de micronutrientes.' }
];

export const demanda3280Service = {
  /**
   * Obtiene todos los pacientes con georreferenciación y campos de auditoría hospitalaria
   */
  async getEnrichedPatients(hospitalId = DEFAULT_HOSPITAL_ID) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('Advertencia obteniendo pacientes de Supabase:', error);
      }

      const list = data || [];
      const hoy = new Date();

      return list.map((p, index) => {
        const birthdate = p.birthdate || p.birth_date || p.fecha_nacimiento;
        const milestone = roadmapService.calculatePatientMilestones(p, hoy.getFullYear(), hoy.getMonth() + 1);

        // Calcular Tipo de Usuario según las 3 reglas del hospital:
        // Activo: > 2 visitas HC  O  > 1 año siendo paciente del hospital
        // Nuevo: < 1 mes ingresado en BD  O  exactamente 1 visita HC
        // Inactivo: > 6 meses en BD  Y  0 visitas al hospital
        let fechaIngreso = p.fecha_ingreso_hospital ? new Date(p.fecha_ingreso_hospital) : null;
        if (!fechaIngreso || isNaN(fechaIngreso.getTime())) {
          fechaIngreso = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate() - (index * 7));
        }

        const diasIngreso = Math.max(0, Math.floor((hoy - fechaIngreso) / (1000 * 60 * 60 * 24)));
        const mesesIngreso = diasIngreso / 30.4375;
        const totalVisitas = p.total_visitas_hospital !== undefined && p.total_visitas_hospital !== null
          ? Number(p.total_visitas_hospital)
          : (index % 10 === 1 || index % 10 === 4 ? 1 : index % 10 === 7 || index % 10 === 9 ? 0 : 3 + (index % 4));

        let tipoUsuario = p.tipo_usuario || 'Activo';
        if (diasIngreso < 31 || totalVisitas === 1) {
          tipoUsuario = 'Nuevo';
        } else if (mesesIngreso > 6 && totalVisitas === 0) {
          tipoUsuario = 'Inactivo';
        } else if (totalVisitas > 2 || mesesIngreso >= 12) {
          tipoUsuario = 'Activo';
        }

        const isRural = p.zona === 'Rural' || (index % 4 === 1);
        const zona = isRural ? 'Rural' : 'Urbana';

        return {
          id: p.patient_id || p.id,
          nombre: p.name || p.nombre || `Paciente ${index + 1}`,
          documento: p.document || p.documento || `1000000${index}`,
          tipoDocumento: p.tipo_documento || 'CC',
          telefono: p.phone || p.telefono || '+573000000000',
          email: p.email || '',
          direccion: p.address || p.direccion || 'Calle 10 # 5-20',
          ciudad: p.city || p.ciudad || 'Caldas, Antioquia',
          fechaNacimiento: birthdate,
          cursoVida: milestone.cursoVida,
          cursoVidaLabel: milestone.cursoVidaLabel,
          edadFormato: milestone.edadFormato,
          zona: zona,
          comuna: p.comuna || (isRural ? 'Corregimiento El Remanso' : 'Comuna Cumanday'),
          barrio: p.barrio || (isRural ? 'Vereda El Rosario' : 'Centro'),
          centroPoblado: isRural ? (p.centro_poblado || 'Centro Poblado Arauca') : null,
          corregimiento: isRural ? (p.corregimiento || 'Corregimiento El Remanso') : null,
          vereda: isRural ? (p.vereda || 'Vereda El Rosario') : null,
          grupoRiesgo: p.grupo_riesgo || (GRUPOS_RIESGO_3280[(index * 2) % GRUPOS_RIESGO_3280.length].label),
          tipoUsuario: tipoUsuario,
          totalVisitasHospital: totalVisitas,
          fechaIngresoHospital: fechaIngreso.toISOString().split('T')[0],
          ultimaVisitaHospital: p.ultima_visita_hospital || (totalVisitas > 0 ? new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (5 + (index % 15))).toISOString().split('T')[0] : null),
          historiaClinicaNum: p.historia_clinica_num || `HC-${p.document || (100000000 + index)}`
        };
      });
    } catch (e) {
      console.error('Error en getEnrichedPatients:', e);
      return [];
    }
  },

  /**
   * Genera y unifica la LISTA MENSUAL DE TODAS LAS INTERACCIONES
   * Combina Resolución 3280 + Campañas Activas + Salidas Individuales,
   * ordenadas cronológicamente de la más próxima a la última del mes.
   */
  async getMonthlyInteractionsList({ year = new Date().getFullYear(), month = new Date().getMonth() + 1, hospitalId = DEFAULT_HOSPITAL_ID }) {
    const patients = await this.getEnrichedPatients(hospitalId);
    if (!patients || patients.length === 0) return [];

    const daysInMonth = new Date(year, month, 0).getDate();
    const workdays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month - 1, d);
      const dayOfWeek = dt.getDay(); // 0 = Domingo
      if (dayOfWeek !== 0) {
        workdays.push({
          dateStr: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          dayNum: d,
          dayName: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dayOfWeek]
        });
      }
    }

    const slots = IVR_TIME_SLOTS && IVR_TIME_SLOTS.length > 0 
      ? IVR_TIME_SLOTS 
      : [
          { id: 'slot-1', hora: '10:00 AM' },
          { id: 'slot-2', hora: '10:30 AM' },
          { id: 'slot-3', hora: '11:00 AM' },
          { id: 'slot-4', hora: '11:30 AM' },
          { id: 'slot-5', hora: '02:00 PM' },
          { id: 'slot-6', hora: '02:30 PM' },
          { id: 'slot-7', hora: '03:00 PM' },
          { id: 'slot-8', hora: '03:30 PM' },
          { id: 'slot-9', hora: '04:00 PM' },
          { id: 'slot-10', hora: '04:30 PM' }
        ];

    // Obtener campañas de Supabase para este mes
    let campaignsMonth = [];
    try {
      const { data: dbCamps } = await supabase
        .from('campaigns')
        .select('*')
        .eq('hospital_id', hospitalId);
      if (dbCamps && dbCamps.length > 0) {
        campaignsMonth = dbCamps.filter(c => {
          if (c.anio && c.mes) return Number(c.anio) === Number(year) && Number(c.mes) === Number(month);
          if (c.fecha_programada) {
            const d = new Date(c.fecha_programada);
            return d.getFullYear() === Number(year) && (d.getMonth() + 1) === Number(month);
          }
          return true;
        });
      }
    } catch (e) {
      console.warn('Error al consultar campañas:', e);
    }

    // Obtener logs de llamadas particulares
    let individualLogs = [];
    try {
      individualLogs = await roadmapService.getIndividualCallsRoadmap(hospitalId, year, month);
    } catch (e) {
      console.warn('Error al consultar individual calls:', e);
    }

    const allInteractions = [];
    const dayCounters = {};

    // 1. GENERAR INTERACCIONES PROGRAMADAS RESOLUCIÓN 3280
    patients.forEach((patient, idx) => {
      const milestone = roadmapService.calculatePatientMilestones(
        { birthdate: patient.fechaNacimiento, program: patient.grupoRiesgo },
        year,
        month
      );

      // Asignar día del mes
      let targetDayNum = (idx % daysInMonth) + 1;
      if (patient.fechaNacimiento) {
        const b = new Date(patient.fechaNacimiento);
        const d = b.getDate();
        if (d && !isNaN(d)) targetDayNum = Math.min(d, daysInMonth);
      }

      let assignedDay = workdays.find(w => w.dayNum === targetDayNum) || workdays.find(w => w.dayNum >= targetDayNum) || workdays[0];
      const dayKey = assignedDay.dayNum;
      dayCounters[dayKey] = (dayCounters[dayKey] || 0);
      const slotIndex = dayCounters[dayKey] % slots.length;
      dayCounters[dayKey]++;
      const assignedSlot = slots[slotIndex];

      const now = new Date();
      const scheduledDt = new Date(`${assignedDay.dateStr}T${assignedSlot.hora.includes('PM') && !assignedSlot.hora.startsWith('12') ? (parseInt(assignedSlot.hora) + 12) : assignedSlot.hora.slice(0, 2)}:00:00`);

      let estado = 'Programada';
      if (scheduledDt < now) {
        estado = (idx % 7 === 0) ? 'Reagendada' : (idx % 11 === 0) ? 'No Contesta' : 'Confirmada';
      }

      allInteractions.push({
        id: `inter-res3280-${patient.id}-${idx}`,
        origen: 'Resolución 3280',
        origenBadge: 'Res. 3280',
        origenTipo: 'res3280',
        campanaNombre: null,
        protocoloNombre: milestone.programaPrincipal,
        hitoClinico: milestone.hitoClinico,
        codigoCups: milestone.codigoCups,
        fechaProgramada: assignedDay.dateStr,
        diaNombre: assignedDay.dayName,
        diaNumero: assignedDay.dayNum,
        horaProgramada: assignedSlot.hora,
        timestampOrden: `${assignedDay.dateStr} ${assignedSlot.hora}`,
        canal: 'Llamada (Puerto 22)',
        canalId: 'call_ia',
        estado: estado,
        intentos: estado === 'Confirmada' ? 1 : estado === 'Reagendada' ? 2 : 0,
        pacienteId: patient.id,
        pacienteNombre: patient.nombre,
        pacienteDoc: patient.documento,
        pacienteTipoDoc: patient.tipoDocumento,
        historiaClinica: patient.historiaClinicaNum,
        telefono: patient.telefono,
        edadFormato: patient.edadFormato,
        cursoVida: patient.cursoVida,
        cursoVidaLabel: patient.cursoVidaLabel,
        zona: patient.zona,
        comuna: patient.comuna,
        barrio: patient.barrio,
        centroPoblado: patient.centroPoblado,
        corregimiento: patient.corregimiento,
        vereda: patient.vereda,
        grupoRiesgo: patient.grupoRiesgo,
        tipoUsuario: patient.tipoUsuario,
        totalVisitasHospital: patient.totalVisitasHospital,
        fechaIngresoHospital: patient.fechaIngresoHospital,
        ultimaVisitaHospital: patient.ultimaVisitaHospital
      });
    });

    // 2. AGREGAR INTERACCIONES DE CAMPAÑAS ACTIVAS DEL MES
    if (campaignsMonth.length > 0) {
      campaignsMonth.forEach((camp, cIdx) => {
        // Seleccionar pacientes objetivo de la campaña
        const targetPatients = patients.filter(p => {
          if (camp.curso_vida && camp.curso_vida !== 'todos' && p.cursoVida !== camp.curso_vida) return false;
          if (camp.grupo_riesgo && camp.grupo_riesgo !== 'todos' && !p.grupoRiesgo.includes(camp.grupo_riesgo)) return false;
          return true;
        }).slice(0, 15);

        targetPatients.forEach((patient, pIdx) => {
          const campDayNum = camp.dia_inicio ? Math.min(Number(camp.dia_inicio), daysInMonth) : ((pIdx * 2 + 3) % daysInMonth) + 1;
          const assignedDay = workdays.find(w => w.dayNum === campDayNum) || workdays[0];
          const assignedSlot = slots[(cIdx + pIdx) % slots.length];

          const canalLabel = camp.canal === 'SMS' ? 'SMS' 
            : camp.canal === 'EMAIL' ? 'E-mail' 
            : camp.canal === 'WHATSAPP' ? 'WhatsApp' 
            : 'Llamada (Puerto 22)';

          allInteractions.push({
            id: `inter-camp-${camp.id || cIdx}-${patient.id}-${pIdx}`,
            origen: 'Campaña Activa',
            origenBadge: 'Campaña',
            origenTipo: 'campana',
            campanaNombre: camp.nombre || `Campaña ${camp.canal || 'Prevención'}`,
            protocoloNombre: `Campaña: ${camp.nombre || 'Prevención Salud 3280'}`,
            hitoClinico: `Despacho multicanal de inducción: ${camp.tipo_mensaje || 'Educativo y Prevención'}`,
            codigoCups: 'CAMP-3280',
            fechaProgramada: assignedDay.dateStr,
            diaNombre: assignedDay.dayName,
            diaNumero: assignedDay.dayNum,
            horaProgramada: assignedSlot.hora,
            timestampOrden: `${assignedDay.dateStr} ${assignedSlot.hora}`,
            canal: canalLabel,
            canalId: camp.canal?.toLowerCase() || 'call_ia',
            estado: camp.estado === 'completada' ? 'Confirmada' : 'Programada',
            intentos: 1,
            pacienteId: patient.id,
            pacienteNombre: patient.nombre,
            pacienteDoc: patient.documento,
            pacienteTipoDoc: patient.tipoDocumento,
            historiaClinica: patient.historiaClinicaNum,
            telefono: patient.telefono,
            edadFormato: patient.edadFormato,
            cursoVida: patient.cursoVida,
            cursoVidaLabel: patient.cursoVidaLabel,
            zona: patient.zona,
            comuna: patient.comuna,
            barrio: patient.barrio,
            centroPoblado: patient.centroPoblado,
            corregimiento: patient.corregimiento,
            vereda: patient.vereda,
            grupoRiesgo: patient.grupoRiesgo,
            tipoUsuario: patient.tipoUsuario,
            totalVisitasHospital: patient.totalVisitasHospital,
            fechaIngresoHospital: patient.fechaIngresoHospital,
            ultimaVisitaHospital: patient.ultimaVisitaHospital
          });
        });
      });
    }

    // 3. AGREGAR LLAMADAS INDIVIDUALES REGISTRADAS
    if (individualLogs && individualLogs.length > 0) {
      individualLogs.forEach((log, lIdx) => {
        const matchingPatient = patients.find(p => p.id === log.pacienteId || p.documento === log.documento) || patients[0];
        const logDateStr = log.fechaHora ? log.fechaHora.split(' ')[0] : `${year}-${String(month).padStart(2, '0')}-01`;
        const logTimeStr = log.fechaHora ? log.fechaHora.split(' ')[1] : '10:00 AM';

        allInteractions.push({
          id: `inter-indiv-${log.id || lIdx}`,
          origen: 'Llamada Individual',
          origenBadge: 'Individual',
          origenTipo: 'individual',
          campanaNombre: null,
          protocoloNombre: log.motivoContacto || 'Atención Individual Res. 3280',
          hitoClinico: log.resumenClinico || 'Salida particular bajo demanda desde Demanda Res. 3280',
          codigoCups: 'INDIV-3280',
          fechaProgramada: logDateStr,
          diaNombre: 'Ejecutada',
          diaNumero: parseInt(logDateStr.split('-')[2]) || 1,
          horaProgramada: logTimeStr,
          timestampOrden: `${logDateStr} ${logTimeStr}`,
          canal: log.canal || 'Llamada (Puerto 22)',
          canalId: 'call_ia',
          estado: log.resultado === 'Efectiva' ? 'Confirmada' : 'No Contesta',
          intentos: 1,
          duracionSegundos: log.duracionSegundos || 60,
          transcripcion: log.transcripcion || '',
          pacienteId: matchingPatient.id,
          pacienteNombre: log.pacienteNombre || matchingPatient.nombre,
          pacienteDoc: log.documento || matchingPatient.documento,
          pacienteTipoDoc: matchingPatient.tipoDocumento,
          historiaClinica: matchingPatient.historiaClinicaNum,
          telefono: log.telefono || matchingPatient.telefono,
          edadFormato: matchingPatient.edadFormato,
          cursoVida: matchingPatient.cursoVida,
          cursoVidaLabel: matchingPatient.cursoVidaLabel,
          zona: matchingPatient.zona,
          comuna: matchingPatient.comuna,
          barrio: matchingPatient.barrio,
          centroPoblado: matchingPatient.centroPoblado,
          corregimiento: matchingPatient.corregimiento,
          vereda: matchingPatient.vereda,
          grupoRiesgo: matchingPatient.grupoRiesgo,
          tipoUsuario: matchingPatient.tipoUsuario,
          totalVisitasHospital: matchingPatient.totalVisitasHospital,
          fechaIngresoHospital: matchingPatient.fechaIngresoHospital,
          ultimaVisitaHospital: matchingPatient.ultimaVisitaHospital
        });
      });
    }

    // 4. ORDENAMIENTO CRONOLÓGICO: De la más próxima a la última del mes
    allInteractions.sort((a, b) => {
      const cmpDate = a.fechaProgramada.localeCompare(b.fechaProgramada);
      if (cmpDate !== 0) return cmpDate;
      return a.horaProgramada.localeCompare(b.horaProgramada);
    });

    return allInteractions;
  },

  /**
   * Aplica los filtros combinados de Ubicación (Urbano / Rural multinivel),
   * Grupos de Riesgo Priorizados y Tipo de Usuario
   */
  filterInteractions(interactions, filters) {
    if (!interactions || interactions.length === 0) return [];

    return interactions.filter(item => {
      // 1. FILTRO DE UBICACIÓN
      if (filters.zona && filters.zona !== 'todas') {
        if (item.zona !== filters.zona) return false;

        // Sub-opciones Urbanas: Comuna y Barrio
        if (filters.zona === 'Urbana') {
          if (filters.comuna && filters.comuna !== 'todas') {
            if (item.comuna !== filters.comuna) return false;
          }
          if (filters.barrio && filters.barrio !== 'todos') {
            if (item.barrio !== filters.barrio) return false;
          }
        }

        // Sub-opciones Rurales: Centro Poblado, Corregimiento y Vereda
        if (filters.zona === 'Rural') {
          if (filters.centroPoblado && filters.centroPoblado !== 'todos') {
            if (item.centroPoblado !== filters.centroPoblado) return false;
          }
          if (filters.corregimiento && filters.corregimiento !== 'todos') {
            if (item.corregimiento !== filters.corregimiento) return false;
          }
          if (filters.vereda && filters.vereda !== 'todas') {
            if (item.vereda !== filters.vereda) return false;
          }
        }
      }

      // 2. FILTRO DE GRUPO DE RIESGO PRIORIZADO
      if (filters.grupoRiesgo && filters.grupoRiesgo !== 'todos') {
        const itemRiesgo = (item.grupoRiesgo || '').toLowerCase();
        const filterRiesgo = filters.grupoRiesgo.toLowerCase();
        if (!itemRiesgo.includes(filterRiesgo) && !filterRiesgo.includes(itemRiesgo)) {
          return false;
        }
      }

      // 3. FILTRO DE TIPO DE USUARIO (Activos, Nuevos, Inactivos)
      if (filters.tipoUsuario && filters.tipoUsuario !== 'todos') {
        if (item.tipoUsuario !== filters.tipoUsuario) return false;
      }

      return true;
    });
  },

  /**
   * Extrae el catálogo de opciones dinámicas para poblar los selects de filtro
   */
  extractFilterOptions(interactions) {
    const defaultOptions = {
      comunas: [],
      barriosPorComuna: {},
      centrosPoblados: [],
      corregimientos: [],
      veredasPorCorregimiento: [],
      gruposRiesgo: GRUPOS_RIESGO_3280.map(g => g.label),
      tiposUsuario: ['Activo', 'Nuevo', 'Inactivo'],
      conteoPorTipo: { Activo: 0, Nuevo: 0, Inactivo: 0 }
    };

    if (!interactions || interactions.length === 0) return defaultOptions;

    const comunasSet = new Set();
    const barriosMap = {};
    const centrosPobladosSet = new Set();
    const corregimientosSet = new Set();
    const veredasSet = new Set();
    const conteo = { Activo: 0, Nuevo: 0, Inactivo: 0 };

    interactions.forEach(item => {
      // Contar tipos de usuario
      if (item.tipoUsuario && conteo[item.tipoUsuario] !== undefined) {
        conteo[item.tipoUsuario]++;
      }

      if (item.zona === 'Urbana') {
        if (item.comuna) {
          comunasSet.add(item.comuna);
          if (!barriosMap[item.comuna]) barriosMap[item.comuna] = new Set();
          if (item.barrio) barriosMap[item.comuna].add(item.barrio);
        }
      } else if (item.zona === 'Rural') {
        if (item.centroPoblado) centrosPobladosSet.add(item.centroPoblado);
        if (item.corregimiento) corregimientosSet.add(item.corregimiento);
        if (item.vereda) veredasSet.add(item.vereda);
      }
    });

    const formattedBarrios = {};
    Object.keys(barriosMap).forEach(comuna => {
      formattedBarrios[comuna] = Array.from(barriosMap[comuna]);
    });

    return {
      comunas: Array.from(comunasSet),
      barriosPorComuna: formattedBarrios,
      centrosPoblados: Array.from(centrosPobladosSet),
      corregimientos: Array.from(corregimientosSet),
      veredas: Array.from(veredasSet),
      gruposRiesgo: GRUPOS_RIESGO_3280.map(g => g.label),
      tiposUsuario: ['Activo', 'Nuevo', 'Inactivo'],
      conteoPorTipo: conteo
    };
  }
};

