// ==============================================================================
// census400kService.js - MOTOR DE CENSO POBLACIONAL Y RESOLUCIÓN 3280 DE 2018
// Censo de 400.000 pacientes distribuidos congruentemente en los 10 Cursos de Vida (A - J)
// y los 12 meses del año (Mes 1 - Mes 12). Un paciente pertenece a múltiples grupos.
// ==============================================================================

import { supabase } from '@/lib/supabase';

// Nombres y apellidos colombianos para síntesis determinista
const NOMBRES_MASCULINOS = [
  'Carlos Alberto', 'Juan David', 'Andrés Felipe', 'Santiago', 'Mateo',
  'Alejandro', 'Diego Fernando', 'Luis Eduardo', 'Julián David', 'Sebastián',
  'Daniel Esteban', 'Gabriel José', 'Nicolás', 'Felipe', 'Jimmy', 'José Manuel',
  'Álvaro', 'Jorge Iván', 'Víctor Hugo', 'Leonardo', 'Fernando', 'Mauricio',
  'Óscar', 'Héctor', 'Mario', 'Gonzalo', 'Camilo Andrés', 'Samuel', 'Martín'
];

const NOMBRES_FEMENINOS = [
  'María Camila', 'Valentina', 'Sofía', 'Daniela', 'Mariana',
  'Paula Andrea', 'Laura Marcela', 'Catalina', 'Ana María', 'Diana Carolina',
  'Natalia', 'Valeria', 'Juliana', 'Andrea', 'Lina María', 'Adriana Lucía',
  'Gloria Inés', 'Claudia Patricia', 'Sandra Milena', 'Luz Marina', 'Esperanza',
  'Camila', 'Luciana', 'Salomé', 'Isabella', 'Gabriela', 'Carmen Rosa'
];

const APELLIDOS = [
  'Rodríguez', 'González', 'Martínez', 'García', 'López',
  'Hernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres',
  'Flores', 'Díaz', 'Vásquez', 'Castro', 'Romero',
  'Morales', 'Gómez', 'Herrera', 'Medina', 'Ríos',
  'Cardona', 'Gutiérrez', 'Jaramillo', 'Ospina', 'Restrepo',
  'Montoya', 'Bedoya', 'Duque', 'Ceballos', 'Quintero'
];

const EPS_LIST = [
  'EPS Sanitas', 'SURA EPS', 'Nueva EPS', 'Salud Total EPS',
  'Compensar EPS', 'Famisanar EPS', 'Savia Salud', 'Capital Salud EPS',
  'Asmet Salud', 'Coosalud'
];

const CIUDADES = [
  'Bogotá D.C.', 'Medellín', 'Cali', 'Barranquilla', 'Manizales',
  'Pereira', 'Bucaramanga', 'Armenia', 'Ibagué', 'Cartagena'
];

const ESTADOS_TRATAMIENTO = [
  { id: 'en_tratamiento', label: 'En Tratamiento Activo', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'cita_confirmada', label: 'Cita Confirmada', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'pendiente_tamizaje', label: 'Pendiente Tamizaje 3280', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'control_al_dia', label: 'Control al Día', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { id: 'inasistente_reprogramar', label: 'Inasistente - Por Reprogramar', color: 'bg-rose-100 text-rose-800 border-rose-300' },
];

// LOS 10 CURSOS DE VIDA / PROGRAMAS ESTIPULADOS POR EL USUARIO (A - J)
export const PROGRAMAS_3280 = [
  {
    id: 'A',
    key: 'primera_infancia',
    nombre: 'Primera Infancia',
    rango: '7 días a 5 años',
    edadMin: 0,
    edadMax: 5,
    genero: 'ambos',
    color: 'bg-emerald-500',
    borderColor: 'border-emerald-300',
    lightBg: 'bg-emerald-50',
    textColor: 'text-emerald-800',
    totalCenso: 34800,
    descripcion: 'Atención integral en salud de 7 días hasta 5 años, 11 meses y 29 días. Controles a los 2-3m, 6-11m, 18-23m, 30-35m y a los 4 años. Tamizaje visual, auditivo y nutricional.',
    scheduledPattern: [2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900], // 34.800
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Control Pediátrico Continuo 3280' }
  },
  {
    id: 'B',
    key: 'infancia',
    nombre: 'Infancia',
    rango: '6 a 11 años',
    edadMin: 6,
    edadMax: 11,
    genero: 'ambos',
    color: 'bg-teal-500',
    borderColor: 'border-teal-300',
    lightBg: 'bg-teal-50',
    textColor: 'text-teal-800',
    totalCenso: 41200,
    descripcion: 'Atención en salud para niños y niñas de 6 a 11 años. Valoración del desarrollo físico y puberal, tamizaje visual, agudeza auditiva y salud bucal.',
    scheduledPattern: [3430, 3430, 3430, 3440, 3430, 3430, 3430, 3440, 3430, 3440, 3430, 3470],
    defaultBar: { startMonth: 2, endMonth: 11, label: 'Valoración Crecimiento y Desarrollo Escolar' }
  },
  {
    id: 'C',
    key: 'adolescencia',
    nombre: 'Adolescencia',
    rango: '12 a 17 años',
    edadMin: 12,
    edadMax: 17,
    genero: 'ambos',
    color: 'bg-cyan-500',
    borderColor: 'border-cyan-300',
    lightBg: 'bg-cyan-50',
    textColor: 'text-cyan-800',
    totalCenso: 37500,
    descripcion: 'Atención médica y psicosocial para adolescentes de 12 a 17 años. Salud sexual y reproductiva, prevención de consumo de sustancias y valoración nutricional.',
    scheduledPattern: [3125, 3125, 3125, 3125, 3125, 3125, 3125, 3125, 3125, 3125, 3125, 3125],
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Ruta Salud Integral del Adolescente' }
  },
  {
    id: 'D',
    key: 'juventud',
    nombre: 'Juventud',
    rango: '18 a 28 años',
    edadMin: 18,
    edadMax: 28,
    genero: 'ambos',
    color: 'bg-blue-500',
    borderColor: 'border-blue-300',
    lightBg: 'bg-blue-50',
    textColor: 'text-blue-800',
    totalCenso: 76000,
    descripcion: 'Atención en salud para la juventud. Tamizaje de riesgo cardiovascular, salud mental, tamizaje de ITS/VIH y hábitos de vida saludables.',
    scheduledPattern: [6330, 6330, 6330, 6340, 6330, 6330, 6340, 6330, 6340, 6330, 6340, 6400],
    defaultBar: { startMonth: 3, endMonth: 10, label: 'Tamizaje y Salud Integral Joven' }
  },
  {
    id: 'E',
    key: 'adultez',
    nombre: 'Adultez',
    rango: '29 a 59 años',
    edadMin: 29,
    edadMax: 59,
    genero: 'ambos',
    color: 'bg-indigo-500',
    borderColor: 'border-indigo-300',
    lightBg: 'bg-indigo-50',
    textColor: 'text-indigo-800',
    totalCenso: 128500,
    descripcion: 'Atención integral del adulto. Detección temprana de cáncer (mama, cuello uterino, próstata, colon), riesgo cardiovascular, metabólico y salud renal.',
    scheduledPattern: [10700, 10700, 10710, 10710, 10710, 10710, 10710, 10710, 10710, 10710, 10710, 10710],
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Control Cardiovascular y Metabólico del Adulto' }
  },
  {
    id: 'F',
    key: 'vejez',
    nombre: 'Vejez',
    rango: '60 años o más',
    edadMin: 60,
    edadMax: 102,
    genero: 'ambos',
    color: 'bg-violet-500',
    borderColor: 'border-violet-300',
    lightBg: 'bg-violet-50',
    textColor: 'text-violet-800',
    totalCenso: 82000,
    descripcion: 'Atención médica integral al adulto mayor. Valoración geriátrica multidimensional, tamizaje de fragilidad, caídas, polifarmacia y deterioro cognitivo.',
    scheduledPattern: [6830, 6830, 6830, 6840, 6830, 6830, 6840, 6830, 6840, 6830, 6840, 6860],
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Programa Geronto-Geriátrico Res. 3280' }
  },
  {
    id: 'G',
    key: 'preventivo_mujer',
    nombre: 'Preventivo de la Mujer',
    rango: 'Mujeres 14 a 69 años',
    edadMin: 14,
    edadMax: 69,
    genero: 'femenino',
    color: 'bg-rose-500',
    borderColor: 'border-rose-300',
    lightBg: 'bg-rose-50',
    textColor: 'text-rose-800',
    totalCenso: 145000,
    descripcion: 'Ruta de protección específica y detección temprana: citología cervicovaginal, ADN-VPH, mamografía bilateral (50-69 años) y examen clínico de mama.',
    scheduledPattern: [12080, 12080, 12080, 12090, 12080, 12080, 12090, 12080, 12090, 12080, 12090, 12180],
    defaultBar: { startMonth: 2, endMonth: 11, label: 'Tamizaje Cervicouterino y Detección Cáncer de Mama' }
  },
  {
    id: 'H',
    key: 'planificacion_familiar',
    nombre: 'Planificación Familiar',
    rango: 'Población 14 a 49 años',
    edadMin: 14,
    edadMax: 49,
    genero: 'ambos',
    color: 'bg-amber-500',
    borderColor: 'border-amber-300',
    lightBg: 'bg-amber-50',
    textColor: 'text-amber-800',
    totalCenso: 162000,
    descripcion: 'Asesoría y provisión de métodos anticonceptivos (orales, inyectables, DIU, implantes subdérmicos, vasectomía y ligadura). Consulta preconcepcional.',
    scheduledPattern: [13500, 13500, 13500, 13500, 13500, 13500, 13500, 13500, 13500, 13500, 13500, 13500],
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Jornada Continua Asesoría y Anticoncepción' }
  },
  {
    id: 'I',
    key: 'vacunacion',
    nombre: 'Vacunación',
    rango: 'Todas las edades priorizadas',
    edadMin: 0,
    edadMax: 102,
    genero: 'ambos',
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-400',
    lightBg: 'bg-emerald-50',
    textColor: 'text-emerald-900',
    totalCenso: 215000,
    descripcion: 'Esquema Nacional PAI (Pentavalente, Triple Viral, Neumococo, Rotavirus, VPH en niñas y niños, Influenza estacional, Tétanos y COVID-19).',
    scheduledPattern: [17910, 17910, 17920, 17910, 17920, 17910, 17920, 17910, 17920, 17910, 17920, 17980],
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Esquema Permanente PAI Nacional' }
  },
  {
    id: 'J',
    key: 'salud_oral',
    nombre: 'Salud Oral',
    rango: 'Toda la población (Censo completo)',
    edadMin: 0,
    edadMax: 102,
    genero: 'ambos',
    color: 'bg-sky-600',
    borderColor: 'border-sky-300',
    lightBg: 'bg-sky-50',
    textColor: 'text-sky-900',
    totalCenso: 400000,
    descripcion: 'Atención odontológica preventiva general y por curso de vida: aplicación de barniz de flúor, sellantes, detartraje supragingival y control de placa bacteriana.',
    scheduledPattern: [33333, 33333, 33334, 33333, 33333, 33334, 33333, 33333, 33334, 33333, 33333, 33338],
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Control Odontológico Preventivo 400k Pacientes' }
  }
];

export const MESES_TITULOS = [
  { id: 1, nombre: 'Enero', abreviatura: 'Ene', label: 'Mes 1' },
  { id: 2, nombre: 'Febrero', abreviatura: 'Feb', label: 'Mes 2' },
  { id: 3, nombre: 'Marzo', abreviatura: 'Mar', label: 'Mes 3' },
  { id: 4, nombre: 'Abril', abreviatura: 'Abr', label: 'Mes 4' },
  { id: 5, nombre: 'Mayo', abreviatura: 'May', label: 'Mes 5' },
  { id: 6, nombre: 'Junio', abreviatura: 'Jun', label: 'Mes 6' },
  { id: 7, nombre: 'Julio', abreviatura: 'Jul', label: 'Mes 7' },
  { id: 8, nombre: 'Agosto', abreviatura: 'Ago', label: 'Mes 8' },
  { id: 9, nombre: 'Septiembre', abreviatura: 'Sep', label: 'Mes 9' },
  { id: 10, nombre: 'Octubre', abreviatura: 'Oct', label: 'Mes 10' },
  { id: 11, nombre: 'Noviembre', abreviatura: 'Nov', label: 'Mes 11' },
  { id: 12, nombre: 'Diciembre', abreviatura: 'Dic', label: 'Mes 12' }
];

// 7 GRUPOS DE RIESGO PRIORIZADOS ESTIPULADOS POR EL USUARIO (PASO 1 DEL WIZARD)
export const GRUPOS_RIESGO_PRIORIZADOS = [
  {
    id: 1,
    codigo: 'materno_perinatal',
    titulo: 'Población Materno-Perinatal',
    descripcion: 'Mujeres gestantes, en parto, puerperio y recién nacidos (incluyendo seguimiento especial para prematuros o bajo peso al nacer).'
  },
  {
    id: 2,
    codigo: 'cardiovascular_metabolico',
    titulo: 'Riesgo Cardiovascular y Metabólico',
    descripcion: 'Personas con antecedentes o diagnóstico de hipertensión arterial, diabetes mellitus, dislipidemias (colesterol/triglicéridos altos), obesidad y enfermedad renal crónica.'
  },
  {
    id: 3,
    codigo: 'cancer_deteccion',
    titulo: 'Cáncer (Detección temprana)',
    descripcion: 'Población con factores de riesgo o en rangos de edad para tamizaje de cáncer de cuello uterino, mama, próstata y colon/recto.'
  },
  {
    id: 4,
    codigo: 'respiratorias_cronicas',
    titulo: 'Enfermedades Respiratorias Crónicas',
    descripcion: 'Pacientes con asma o Enfermedad Pulmonar Obstructiva Crónica (EPOC).'
  },
  {
    id: 5,
    codigo: 'salud_mental_sustancias',
    titulo: 'Salud Mental y Consumo de Sustancias',
    descripcion: 'Personas expuestas a violencias (intrafamiliar, de género, conflicto armado), trastornos mentales o consumo problemático de sustancias psicoactivas, alcohol y tabaco.'
  },
  {
    id: 6,
    codigo: 'infecciosas_zoonoticas',
    titulo: 'Enfermedades Infecciosas y Zoonóticas',
    descripcion: 'Población expuesta o diagnosticada con VIH/SIDA, tuberculosis, infecciones de transmisión sexual (ITS) o enfermedades transmitidas por vectores (dengue, malaria, Chagas).'
  },
  {
    id: 7,
    codigo: 'alteraciones_nutricionales',
    titulo: 'Alteraciones Nutricionales',
    descripcion: 'Niños, gestantes o adultos mayores con desnutrición aguda/crónica o deficiencias de micronutrientes.'
  }
];

// CANALES ESTIPULADOS POR EL USUARIO (PASO 2 DEL WIZARD)
export const CANALES_DISPONIBLES = [
  { id: 'sms', nombre: 'SMS', icon: 'MessageSquare', descripcion: 'Mensajería de texto OpenVox GSM masiva' },
  { id: 'email', nombre: 'EMAIL', icon: 'Mail', descripcion: 'Correo electrónico hospitalario con trazabilidad' },
  { id: 'call', nombre: 'LLAMADA', icon: 'Phone', descripcion: 'Llamada automatizada Agente IA vía OpenVox Puerto 22' },
  { id: 'whatsapp', nombre: 'WHATSAPP', icon: 'Send', descripcion: 'Mensaje interactivo vía canal WhatsApp verificado' }
];

// Generador pseudoaleatorio determinista (LCG)
function pseudoRandom(seed) {
  let s = Math.abs(seed) % 2147483647;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const census400kService = {
  // Retorna métricas globales del censo
  getCensusMetrics() {
    return {
      totalPacientesCenso: 400000,
      totalHospitales: 1,
      programasContador: PROGRAMAS_3280.length,
      resolucion: 'Resolución 3280 de 2018',
      coberturaPromedio: '94.2%',
      llamadasPorTanda: 32,
      minutosPorTanda: 30
    };
  },

  // Retorna las columnas mensuales
  getMonths() {
    return MESES_TITULOS;
  },

  // Retorna los 10 programas A a J
  getPrograms() {
    return PROGRAMAS_3280;
  },

  // Retorna los 7 grupos de riesgo
  getRiskGroups() {
    return GRUPOS_RIESGO_PRIORIZADOS;
  },

  // Retorna los canales
  getChannels() {
    return CANALES_DISPONIBLES;
  },

  // Obtiene pacientes reales de Supabase
  async getRealSupabasePatients(hospitalId) {
    try {
      let query = supabase.from('patients').select('*').limit(100);
      if (hospitalId) {
        query = query.eq('hospital_id', hospitalId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Advertencia al consultar pacientes de Supabase:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Excepción al consultar pacientes reales:', err);
      return [];
    }
  },

  // Obtiene campañas registradas en Supabase
  async getCampaignsFromSupabase(hospitalId) {
    try {
      let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (hospitalId) {
        query = query.eq('hospital_id', hospitalId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Advertencia al consultar campañas de Supabase:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Excepción al consultar campañas:', err);
      return [];
    }
  },

  // Guarda una nueva campaña en Supabase y crea registros de trazabilidad
  async createCampaignInSupabase({
    hospitalId = 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8',
    nombre,
    grupoRiesgo,
    canales,
    fechaLanzamiento,
    horaLanzamiento,
    duracionHoras,
    tipoMensaje,
    mensaje,
    frecuencia,
    reintentosDia,
    programaId,
    mesInicio
  }) {
    try {
      const channelString = Array.isArray(canales) ? canales.join(', ') : canales;
      const payload = {
        hospital_id: hospitalId,
        nombre: nombre,
        tipo: 'resolucion_3280',
        canal: channelString,
        estado: 'programada',
        mensaje_plantilla: mensaje,
        configuracion: {
          grupo_riesgo: grupoRiesgo,
          canales: canales,
          fecha_lanzamiento: fechaLanzamiento,
          hora_lanzamiento: horaLanzamiento,
          duracion_horas: duracionHoras,
          tipo_mensaje: tipoMensaje,
          frecuencia: frecuencia,
          reintentos_dia: reintentosDia,
          programa_id: programaId,
          mes_inicio: mesInicio,
          rate_limit: '32_llamadas_cada_30_min'
        },
        destinatarios_count: 2950,
        enviados_count: 0,
        efectivos_count: 0
      };

      const { data, error } = await supabase.from('campaigns').insert([payload]).select();
      if (error) {
        console.error('Error insertando campaña en Supabase:', error);
        throw error;
      }

      // Registro de interacción preliminar para trazabilidad en /interactions
      try {
        await supabase.from('interactions').insert([{
          hospital_id: hospitalId,
          campaign_id: data?.[0]?.id || null,
          tipo_canal: Array.isArray(canales) ? canales[0] : 'llamada',
          estado: 'programado',
          mensaje_enviado: mensaje,
          respuesta_paciente: 'Campaña agendada exitosamente en el cronograma anual.',
          duracion_segundos: 0,
          metadata: {
            grupo_riesgo: grupoRiesgo?.titulo,
            programa_3280: programaId,
            frecuencia: frecuencia,
            hora_lanzamiento: horaLanzamiento
          }
        }]);
      } catch (interError) {
        console.warn('Interacción log falló suavemente:', interError);
      }

      return data?.[0] || payload;
    } catch (err) {
      console.error('Fallo creando campaña:', err);
      throw err;
    }
  },

  // Obtiene cohort de pacientes para una intersección Programa (A-J) x Mes (1-12)
  async getCohortForCell({
    programId,
    monthIndex,
    page = 1,
    pageSize = 15,
    search = '',
    filterStatus = 'todos',
    hospitalId = null
  }) {
    const programa = PROGRAMAS_3280.find(p => p.id === programId) || PROGRAMAS_3280[0];
    const totalInCell = programa.scheduledPattern[monthIndex - 1] || 3000;

    // Obtener pacientes reales de Supabase
    const realPatientsRaw = await this.getRealSupabasePatients(hospitalId);

    // Mapear pacientes reales que apliquen al programa
    const realPatients = realPatientsRaw
      .filter(p => {
        const edad = p.edad || 30;
        const genero = (p.genero || 'M').toLowerCase();
        const isFemale = genero.startsWith('f') || genero.startsWith('m');
        if (programa.genero === 'femenino' && !isFemale) return false;
        if (edad < programa.edadMin || edad > programa.edadMax) return false;
        return true;
      })
      .map(p => {
        const edad = p.edad || 28;
        const isFemale = (p.genero || 'M').toLowerCase().startsWith('f');
        const grupos = this.calculatePatientGroups(edad, isFemale);
        return {
          id: p.id,
          isReal: true,
          nombre: `${p.nombre || 'Paciente'} ${p.apellido || ''}`.trim(),
          documento: p.cedula || '1234567890',
          telefono: p.telefono || '+573057120876',
          email: p.email || `${(p.nombre || 'paciente').toLowerCase().replace(/\s+/g, '')}@gmail.com`,
          direccion: p.direccion || 'Calle 100 # 15-20, Consultorio SADI',
          edad: edad,
          genero: isFemale ? 'Femenino' : 'Masculino',
          eps: p.eps || 'EPS Sanitas',
          ciudad: CIUDADES[Math.floor(Math.random() * CIUDADES.length)],
          programaActual: programa,
          grupos: grupos,
          estadoTratamiento: ESTADOS_TRATAMIENTO[0],
          fechaProgramada: `2026-${String(monthIndex).padStart(2, '0')}-15`,
          horaProgramada: '08:30 AM',
          historiaClinica: this.generateClinicalHistory(p.nombre, edad, isFemale, programa, ESTADOS_TRATAMIENTO[0])
        };
      });

    // Generar pacientes sintéticos deterministas para este mes y programa
    const simulatedCount = Math.min(200, totalInCell);
    const rng = pseudoRandom(programId.charCodeAt(0) * 1000 + monthIndex * 77);

    const simulatedPatients = [];
    for (let i = 0; i < simulatedCount; i++) {
      const isFemale = programa.genero === 'femenino' ? true : rng() > 0.48;
      const nombreList = isFemale ? NOMBRES_FEMENINOS : NOMBRES_MASCULINOS;
      const nombre = nombreList[Math.floor(rng() * nombreList.length)];
      const apellido1 = APELLIDOS[Math.floor(rng() * APELLIDOS.length)];
      const apellido2 = APELLIDOS[Math.floor(rng() * APELLIDOS.length)];

      const edadSpan = Math.max(1, programa.edadMax - programa.edadMin);
      const edad = programa.edadMin + Math.floor(rng() * (edadSpan + 1));

      const docNum = 1000000000 + Math.floor(rng() * 900000000);
      const telNum = `+573${Math.floor(100000000 + rng() * 899999999)}`;
      const eps = EPS_LIST[Math.floor(rng() * EPS_LIST.length)];
      const ciudad = CIUDADES[Math.floor(rng() * CIUDADES.length)];
      const estadoIdx = Math.floor(rng() * ESTADOS_TRATAMIENTO.length);
      const estadoTratamiento = ESTADOS_TRATAMIENTO[estadoIdx];

      const dia = 1 + Math.floor(rng() * 28);
      const horaH = 7 + Math.floor(rng() * 11);
      const horaM = rng() > 0.5 ? '30' : '00';
      const ampm = horaH >= 12 ? 'PM' : 'AM';
      const hora12 = horaH > 12 ? horaH - 12 : horaH;

      const grupos = this.calculatePatientGroups(edad, isFemale);

      simulatedPatients.push({
        id: `sim-${programId}-${monthIndex}-${i}`,
        isReal: false,
        nombre: `${nombre} ${apellido1} ${apellido2}`,
        documento: docNum.toString(),
        telefono: telNum,
        email: `${nombre.toLowerCase().replace(/\s+/g, '')}.${apellido1.toLowerCase()}@hospital.gov.co`,
        direccion: `Carrera ${10 + Math.floor(rng() * 80)} #${Math.floor(rng() * 100)}-${Math.floor(rng() * 90)}`,
        edad: edad,
        genero: isFemale ? 'Femenino' : 'Masculino',
        eps: eps,
        ciudad: ciudad,
        programaActual: programa,
        grupos: grupos,
        estadoTratamiento: estadoTratamiento,
        fechaProgramada: `2026-${String(monthIndex).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
        horaProgramada: `${String(hora12).padStart(2, '0')}:${horaM} ${ampm}`,
        historiaClinica: this.generateClinicalHistory(nombre, edad, isFemale, programa, estadoTratamiento)
      });
    }

    // Combinar reales y sintéticos
    let combined = [...realPatients, ...simulatedPatients];

    // Filtros de búsqueda
    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      combined = combined.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        p.documento.includes(q) ||
        p.telefono.includes(q)
      );
    }

    // Filtro de estado
    if (filterStatus && filterStatus !== 'todos') {
      combined = combined.filter(p => p.estadoTratamiento.id === filterStatus);
    }

    const totalFiltered = combined.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedData = combined.slice(startIndex, startIndex + pageSize);

    return {
      data: paginatedData,
      total: totalFiltered,
      totalCohortCenso: totalInCell,
      page,
      totalPages: Math.ceil(totalFiltered / pageSize) || 1
    };
  },

  // Calcula congruentemente todos los grupos de la Resolución 3280 a los que pertenece el paciente
  calculatePatientGroups(edad, isFemale) {
    const grupos = [];

    // 1. Grupo etario principal (A a F)
    if (edad <= 5) grupos.push(PROGRAMAS_3280.find(p => p.id === 'A'));
    else if (edad <= 11) grupos.push(PROGRAMAS_3280.find(p => p.id === 'B'));
    else if (edad <= 17) grupos.push(PROGRAMAS_3280.find(p => p.id === 'C'));
    else if (edad <= 28) grupos.push(PROGRAMAS_3280.find(p => p.id === 'D'));
    else if (edad <= 59) grupos.push(PROGRAMAS_3280.find(p => p.id === 'E'));
    else grupos.push(PROGRAMAS_3280.find(p => p.id === 'F'));

    // 2. Preventivo de la Mujer (G): Mujeres de 14 a 69 años
    if (isFemale && edad >= 14 && edad <= 69) {
      grupos.push(PROGRAMAS_3280.find(p => p.id === 'G'));
    }

    // 3. Planificación Familiar (H): Hombres y mujeres de 14 a 49 años
    if (edad >= 14 && edad <= 49) {
      grupos.push(PROGRAMAS_3280.find(p => p.id === 'H'));
    }

    // 4. Vacunación (I): Infancia, vejez y mujeres en edad fértil
    if (edad <= 12 || edad >= 60 || (isFemale && edad >= 15 && edad <= 49)) {
      grupos.push(PROGRAMAS_3280.find(p => p.id === 'I'));
    }

    // 5. Salud Oral (J): Toda la población (400k pacientes)
    grupos.push(PROGRAMAS_3280.find(p => p.id === 'J'));

    return grupos.filter(Boolean);
  },

  // Genera historia clínica basada en la Resolución 3280 de 2018
  generateClinicalHistory(nombre, edad, isFemale, programaActual, estado) {
    let antecedentes = 'Sin antecedentes patológicos crónicos conocidos. Vacunación completa para la edad.';
    let tamizajesCumplidos = [];
    let tamizajesPendientes = [];
    let motivo = `Ruta Integral de Promoción y Mantenimiento de la Salud - ${programaActual.nombre}.`;

    if (edad <= 5) {
      antecedentes = 'Nacido a término (39 semanas). Peso adecuado al nacer. Lactancia materna exclusiva hasta los 6 meses.';
      tamizajesCumplidos = ['Tamizaje visual 2 meses', 'Evaluación del neurodesarrollo'];
      tamizajesPendientes = ['Tamizaje auditivo 3 años', 'Aplicación Barniz de Flúor'];
    } else if (edad >= 60) {
      antecedentes = 'Hipertensión arterial estadio 1 controlada con Losartán 50mg/día. Riesgo cardiovascular moderado (Framingham 12%).';
      tamizajesCumplidos = ['Electrocardiograma basal', 'Creatinina sérica', 'Glicemia en ayunas'];
      tamizajesPendientes = ['Valoración de agudeza visual geriátrica', 'Vacuna Neumococo polisacárido'];
    } else if (isFemale && edad >= 25) {
      antecedentes = 'Gesta 1, Para 1, Abortos 0. Planificación con método de barrera / implante subdérmico.';
      tamizajesCumplidos = ['Citología cervicovaginal 2024 (Negativa para lesión intraepitelial)'];
      tamizajesPendientes = edad >= 50 ? ['Mamografía bilateral de tamizaje'] : ['ADN-VPH tamizaje preventivo'];
    } else {
      antecedentes = 'Sedentarismo leve. Sin alergias medicamentosas conocidas. Presión arterial dentro de rangos normales.';
      tamizajesCumplidos = ['Medición de IMC', 'Tamizaje de colesterol total'];
      tamizajesPendientes = ['Consulta de Salud Oral semestral', 'Valoración de Estilos de Vida Saludables'];
    }

    return {
      motivoConsulta: motivo,
      antecedentes: antecedentes,
      tamizajesCumplidos: tamizajesCumplidos,
      tamizajesPendientes: tamizajesPendientes,
      ultimaConsulta: '2026-03-12 • Medicina General / Promoción y Prevención',
      proximaCita: '2026-05-20 • Control Programado IVR SADI',
      notasEvolucion: `Paciente citado a través de la plataforma SADI de Demanda Inducida en el marco de la Resolución 3280 de 2018. Presenta adherencia activa al programa institucional. Diagnóstico principal Z000 (Examen médico general de rutina). Programado por canal telefónico (Puerto 22).`
    };
  }
};

