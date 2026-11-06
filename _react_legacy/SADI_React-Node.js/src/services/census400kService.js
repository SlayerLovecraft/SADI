// ==============================================================================
// census400kService.js - MOTOR DE CENSO POBLACIONAL Y ROADMAP RESOLUCIÓN 3280
// Soporta 400.000 pacientes distribuidos congruentemente en los 10 Cursos de Vida (A a J)
// y los 12 meses del año. Un paciente puede pertenecer a múltiples grupos simultáneos.
// ==============================================================================

import { supabase } from '@/lib/supabase';

// Nombres y apellidos colombianos para síntesis realista y determinista
const NOMBRES_MASCULINOS = [
  'Carlos Alberto', 'Juan David', 'Andrés Felipe', 'Santiago', 'Mateo',
  'Alejandro', 'Diego Fernando', 'Luis Eduardo', 'Julián David', 'Sebastián',
  'Daniel Esteban', 'Gabriel José', 'Nicolás', 'Felipe', 'Jimmy', 'José Manuel',
  'Álvaro', 'Jorge Iván', 'Víctor Hugo', 'Leonardo', 'Fernando', 'Mauricio'
];

const NOMBRES_FEMENINOS = [
  'María Camila', 'Valentina', 'Sofía', 'Daniela', 'Mariana',
  'Paula Andrea', 'Laura Marcela', 'Catalina', 'Ana María', 'Diana Carolina',
  'Natalia', 'Valeria', 'Juliana', 'Andrea', 'Lina María', 'Adriana Lucía',
  'Gloria Inés', 'Claudia Patricia', 'Sandra Milena', 'Luz Marina', 'Esperanza'
];

const APELLIDOS = [
  'Rodríguez', 'González', 'Martínez', 'García', 'López',
  'Hernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres',
  'Flores', 'Díaz', 'Vásquez', 'Castro', 'Romero',
  'Morales', 'Gómez', 'Herrera', 'Medina', 'Ríos',
  'Cardona', 'Gutiérrez', 'Jaramillo', 'Ospina', 'Restrepo'
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

// Los 10 Cursos de Vida y Programas Estipulados por el Usuario (A a J)
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
    descripcion: 'Atención integral en salud de 7 días hasta los 5 años, 11 meses y 29 días. Controles a los 2-3 m, 6-11 m, 18-23 m, 30-35 m y 4 años. Tamizaje visual, auditivo y nutricional.',
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
    defaultBar: { startMonth: 3, endMonth: 10, label: 'Tamizaje y Salud Integral del Adolescente' }
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
    totalCenso: 54500,
    descripcion: 'Atención integral para jóvenes de 18 a 28 años. Asesoría en anticoncepción, tamizaje cardiovascular inicial, salud mental y prevención de ITS.',
    scheduledPattern: [4540, 4540, 4540, 4545, 4540, 4545, 4540, 4545, 4540, 4545, 4540, 4580],
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Atención Médica Integral del Joven' }
  },
  {
    id: 'E',
    key: 'adultez',
    nombre: 'Adultez',
    rango: '29 a 59 años',
    edadMin: 29,
    edadMax: 59,
    genero: 'ambos',
    color: 'bg-indigo-600',
    borderColor: 'border-indigo-300',
    lightBg: 'bg-indigo-50',
    textColor: 'text-indigo-900',
    totalCenso: 142000,
    descripcion: 'Atención médica en salud del adulto de 29 a 59 años. Tamizaje de riesgo cardiovascular, diabetes mellitus, lípidos, asesoría de estilos de vida saludables y detección temprana de cáncer.',
    scheduledPattern: [11833, 11833, 11833, 11833, 11834, 11834, 11833, 11833, 11833, 11834, 11834, 11865],
    defaultBar: { startMonth: 6, endMonth: 7, label: 'Campaña Intensiva Riesgo Cardiovascular y Metabólico' }
  },
  {
    id: 'F',
    key: 'vejez',
    nombre: 'Vejez',
    rango: '60+ años',
    edadMin: 60,
    edadMax: 98,
    genero: 'ambos',
    color: 'bg-purple-600',
    borderColor: 'border-purple-300',
    lightBg: 'bg-purple-50',
    textColor: 'text-purple-900',
    totalCenso: 90000,
    descripcion: 'Atención médica del adulto mayor de 60 años en adelante. Valoración geriátrica integral, riesgo de caídas, deterioro cognitivo, tamizaje visual/auditivo y vacunación antineumocócica.',
    scheduledPattern: [7500, 7500, 7500, 7500, 7500, 7500, 7500, 7500, 7500, 7500, 7500, 7500],
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Control Crónicos y Valoración Geriátrica' }
  },
  {
    id: 'G',
    key: 'preventivo_mujer',
    nombre: 'Preventivo de la Mujer',
    rango: 'Mujeres 14 a 69 años',
    edadMin: 14,
    edadMax: 69,
    genero: 'femenino',
    color: 'bg-pink-500',
    borderColor: 'border-pink-300',
    lightBg: 'bg-pink-50',
    textColor: 'text-pink-800',
    totalCenso: 112000,
    descripcion: 'Ruta Integral de Atención Materno-Perinatal y Cáncer Femenino. Citología cérvico-uterina (25-29 años), prueba ADN-VPH (30-65 años), tamizaje de cáncer de mama / mamografía bienal (50-69 años).',
    scheduledPattern: [9333, 9333, 9333, 9333, 9334, 9334, 9333, 9333, 9333, 9334, 9334, 9363],
    defaultBar: { startMonth: 5, endMonth: 5, label: 'Jornada Rosa: Citología y Mamografía' }
  },
  {
    id: 'H',
    key: 'planificacion_familiar',
    nombre: 'Planificación Familiar',
    rango: '14 a 49 años (Hombres y Mujeres)',
    edadMin: 14,
    edadMax: 49,
    genero: 'ambos',
    color: 'bg-rose-500',
    borderColor: 'border-rose-300',
    lightBg: 'bg-rose-50',
    textColor: 'text-rose-800',
    totalCenso: 78000,
    descripcion: 'Asesoría y suministro de métodos anticonceptivos temporales (orales, inyectables, implantes subdérmicos, DIU) y definitivos (vasectomía, ligadura de trompas) con enfoque de derechos.',
    scheduledPattern: [6500, 6500, 6500, 6500, 6500, 6500, 6500, 6500, 6500, 6500, 6500, 6500],
    defaultBar: { startMonth: 2, endMonth: 11, label: 'Asesoría y Entrega de Métodos Anticonceptivos' }
  },
  {
    id: 'I',
    key: 'vacunacion',
    nombre: 'Vacunación',
    rango: 'Todas las edades (PAI)',
    edadMin: 0,
    edadMax: 98,
    genero: 'ambos',
    color: 'bg-amber-500',
    borderColor: 'border-amber-300',
    lightBg: 'bg-amber-50',
    textColor: 'text-amber-800',
    totalCenso: 165000,
    descripcion: 'Esquema nacional de vacunación PAI: Pentavalente, Triple Viral, Neumococo, Rotavirus, VPH en niñas y niños, Influenza estacional y Toxoide tetánico en gestantes.',
    scheduledPattern: [13750, 13750, 13750, 13750, 13750, 13750, 13750, 13750, 13750, 13750, 13750, 13750],
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Jornada Nacional de Vacunación PAI Permanente' }
  },
  {
    id: 'J',
    key: 'salud_oral',
    nombre: 'Salud Oral',
    rango: 'Todas las edades',
    edadMin: 1,
    edadMax: 98,
    genero: 'ambos',
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-300',
    lightBg: 'bg-emerald-50',
    textColor: 'text-emerald-900',
    totalCenso: 195000,
    descripcion: 'Control y remoción de placa bacteriana, aplicación de barniz de flúor, profilaxis, sellantes de fosas y fisuras y detección oportuna de enfermedad periodontal.',
    scheduledPattern: [16250, 16250, 16250, 16250, 16250, 16250, 16250, 16250, 16250, 16250, 16250, 16250],
    defaultBar: { startMonth: 1, endMonth: 12, label: 'Programa Flúor y Control Periodontal Continuo' }
  }
];

export const MESES_TITULOS = [
  { id: 1, nombre: 'Enero', corto: 'ENE' },
  { id: 2, nombre: 'Febrero', corto: 'FEB' },
  { id: 3, nombre: 'Marzo', corto: 'MAR' },
  { id: 4, nombre: 'Abril', corto: 'ABR' },
  { id: 5, nombre: 'Mayo', corto: 'MAY' },
  { id: 6, nombre: 'Junio', corto: 'JUN' },
  { id: 7, nombre: 'Julio', corto: 'JUL' },
  { id: 8, nombre: 'Agosto', corto: 'AGO' },
  { id: 9, nombre: 'Septiembre', corto: 'SEP' },
  { id: 10, nombre: 'Octubre', corto: 'OCT' },
  { id: 11, nombre: 'Noviembre', corto: 'NOV' },
  { id: 12, nombre: 'Diciembre', corto: 'DIC' },
];

// Generador pseudo-aleatorio determinista para reproducibilidad rápida
function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export const census400kService = {
  // Retorna métricas generales del Censo (400.000 pacientes únicos)
  getCensusMetrics() {
    return {
      totalPacientesCenso: 400000,
      totalHospitales: 1,
      totalAsignacionesProgramas: PROGRAMAS_3280.reduce((acc, p) => acc + p.totalCenso, 0),
      programas: PROGRAMAS_3280
    };
  },

  // Retorna datos de una celda específica (Intersección Programa x Mes)
  getCellInfo(programId, monthIndex) {
    const prog = PROGRAMAS_3280.find(p => p.id === programId);
    if (!prog) return null;
    const count = prog.scheduledPattern[monthIndex - 1] || Math.round(prog.totalCenso / 12);
    const month = MESES_TITULOS.find(m => m.id === monthIndex);
    return {
      programa: prog,
      mes: month,
      pacientesEnMes: count,
    };
  },

  // Obtiene pacientes de la celda de forma paginada y con búsqueda
  async getCohortPatients(programId, monthIndex, page = 1, pageSize = 15, search = '', filterStatus = 'todos') {
    const prog = PROGRAMAS_3280.find(p => p.id === programId);
    if (!prog) return { data: [], total: 0, page, totalPages: 1 };

    const totalInCell = prog.scheduledPattern[monthIndex - 1] || Math.round(prog.totalCenso / 12);

    // 1. Obtener pacientes reales de Supabase que apliquen para enriquecer la celda
    let realPatients = [];
    try {
      const { data: dbPatients } = await supabase
        .from('patients')
        .select('*')
        .limit(30);

      if (dbPatients && dbPatients.length > 0) {
        realPatients = dbPatients.map((p, idx) => {
          const birthdate = p.birthdate || '1990-05-15';
          const age = new Date().getFullYear() - new Date(birthdate).getFullYear();
          const isFemale = p.sex === 'Femenino' || p.sex === 'F';
          
          // Calcular grupos concurrentes
          const grupos = this.calculatePatientGroups(age, isFemale);

          return {
            id: p.patient_id || `db-${idx}`,
            nombre: p.name || 'Paciente Registrado',
            documento: p.document || `12345678${idx}`,
            telefono: p.phone || '+573057120876',
            email: p.email || `${p.name?.toLowerCase().replace(/\s+/g, '.') || 'paciente'}@gmail.com`,
            direccion: p.address || 'Calle 100 # 15-20, Bogotá',
            ciudad: p.city || 'Bogotá D.C.',
            edad: age,
            sexo: isFemale ? 'Femenino' : 'Masculino',
            eps: 'EPS Sanitas',
            fechaNacimiento: birthdate,
            grupos: grupos,
            estadoTratamiento: ESTADOS_TRATAMIENTO[idx % ESTADOS_TRATAMIENTO.length],
            isRealDb: true,
            historiaClinica: {
              antecedentes: 'Hipertensión arterial estadio 1, Riego cardiovascular moderado.',
              motivoConsulta: `Control preventivo Resolución 3280 - ${prog.nombre}.`,
              tamizajesCumplidos: ['Tamizaje de Agudeza Visual (2025)', 'Perfil Lipídico'],
              tamizajesPendientes: [prog.nombre, 'Salud Oral Anual'],
              notasEvolucion: 'Paciente activo en el programa de Demanda Inducida IVR SADI 3280. Responde positivamente a controles de salud preventiva.'
            }
          };
        }).filter(p => p.grupos.some(g => g.id === programId));
      }
    } catch (e) {
      console.warn('No se pudieron leer pacientes de Supabase para este cohort:', e);
    }

    // 2. Generación determinista de pacientes simulados para completar la cuota de 400.000
    const seedBase = (programId.charCodeAt(0) * 1000) + (monthIndex * 97);
    const simulatedPoolSize = Math.min(totalInCell, 300); // Pool activo para visualización veloz en UI

    const simulatedPatients = [];
    for (let i = 0; i < simulatedPoolSize; i++) {
      const seed = seedBase + i;
      const isFemale = prog.genero === 'femenino' ? true : (prog.genero === 'ambos' ? pseudoRandom(seed * 2) > 0.48 : false);
      const nombresList = isFemale ? NOMBRES_FEMENINOS : NOMBRES_MASCULINOS;
      
      const primerNombre = nombresList[Math.floor(pseudoRandom(seed * 3) * nombresList.length)];
      const primerApellido = APELLIDOS[Math.floor(pseudoRandom(seed * 5) * APELLIDOS.length)];
      const segundoApellido = APELLIDOS[Math.floor(pseudoRandom(seed * 7) * APELLIDOS.length)];
      const nombreCompleto = `${primerNombre} ${primerApellido} ${segundoApellido}`;

      // Edad coherente con el programa
      const deltaEdad = prog.edadMax - prog.edadMin;
      const edad = prog.edadMin + Math.floor(pseudoRandom(seed * 11) * (deltaEdad + 1));
      const birthYear = new Date().getFullYear() - edad;
      const birthMonth = Math.floor(pseudoRandom(seed * 13) * 12) + 1;
      const birthDay = Math.floor(pseudoRandom(seed * 17) * 28) + 1;
      const fechaNacimiento = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

      // Documento y teléfono
      const docNum = 1000000000 + Math.floor(pseudoRandom(seed * 19) * 900000000);
      const phoneNum = `+573${Math.floor(100000000 + pseudoRandom(seed * 23) * 899999999)}`;
      const eps = EPS_LIST[Math.floor(pseudoRandom(seed * 29) * EPS_LIST.length)];
      const ciudad = CIUDADES[Math.floor(pseudoRandom(seed * 31) * CIUDADES.length)];
      const estado = ESTADOS_TRATAMIENTO[Math.floor(pseudoRandom(seed * 37) * ESTADOS_TRATAMIENTO.length)];

      // Calcular grupos múltiples de la Resolución 3280
      const grupos = this.calculatePatientGroups(edad, isFemale);

      simulatedPatients.push({
        id: `censo-400k-${programId}-${monthIndex}-${i}`,
        nombre: nombreCompleto,
        documento: String(docNum),
        telefono: phoneNum,
        email: `${primerNombre.toLowerCase().split(' ')[0]}.${primerApellido.toLowerCase()}${Math.floor(pseudoRandom(seed) * 99)}@gmail.com`,
        direccion: `Carrera ${Math.floor(pseudoRandom(seed * 41) * 120) + 1} # ${Math.floor(pseudoRandom(seed * 43) * 80) + 1}-${Math.floor(pseudoRandom(seed * 47) * 50) + 1}`,
        ciudad: ciudad,
        edad: edad,
        sexo: isFemale ? 'Femenino' : 'Masculino',
        eps: eps,
        fechaNacimiento: fechaNacimiento,
        grupos: grupos,
        estadoTratamiento: estado,
        isRealDb: false,
        historiaClinica: this.generateClinicalHistory(nombreCompleto, edad, isFemale, prog, estado)
      });
    }

    // Combinar reales y simulados
    let combined = [...realPatients, ...simulatedPatients];

    // Aplicar búsqueda por nombre o documento
    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      combined = combined.filter(p => 
        p.nombre.toLowerCase().includes(q) || 
        p.documento.includes(q) ||
        p.telefono.includes(q)
      );
    }

    // Aplicar filtro de estado
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

    // 4. Vacunación (I): Infancia, vejez y mujeres edad fértil
    if (edad <= 12 || edad >= 60 || (isFemale && edad >= 15 && edad <= 49)) {
      grupos.push(PROGRAMAS_3280.find(p => p.id === 'I'));
    }

    // 5. Salud Oral (J): Toda la población requiere control continuo según Res. 3280
    grupos.push(PROGRAMAS_3280.find(p => p.id === 'J'));

    return grupos.filter(Boolean);
  },

  // Genera historia clínica detallada basada en el marco clínico de la Resolución 3280
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
      notasEvolucion: `Paciente citado a través de la plataforma SADI de Demanda Inducida en el marco de la Resolución 3280 de 2018. Presenta adherencia activa al programa institucional. Diagnóstico principal Z000 (Examen médico general de rutina). Se programa recordatorio por canal telefónico (Puerto 22).`
    };
  }
};
