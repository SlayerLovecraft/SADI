// ==============================================================================
// census400kService.js - MOTOR DE CENSO POBLACIONAL Y RESOLUCIÓN 3280 DE 2018
// Censo de 400.000 pacientes distribuidos congruentemente en los 10 Cursos de Vida (A - J)
// y los 12 meses del año (Mes 1 - Mes 12). Un paciente pertenece a múltiples grupos.
// Incluye hitos clínicos inamovibles mensuales según la Resolución 3280.
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
// CON SUS 12 HITOS INAMOVIBLES DE LA RESOLUCIÓN 3280
export const PROGRAMAS_3280 = [
  {
    id: 'A',
    key: 'primera_infancia',
    nombre: 'Primera Infancia',
    rango: '7 días a 5 años',
    edadMin: 0,
    edadMax: 5,
    genero: 'ambos',
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-300',
    lightBg: 'bg-emerald-50/70',
    textColor: 'text-emerald-900',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    totalCenso: 34800,
    descripcion: 'Atención integral de 7 días a 5 años, 11 meses y 29 días. Controles a los 2-3m, 6-11m, 18-23m, 30-35m y a los 4 años. Tamizaje visual, auditivo y nutricional.',
    scheduledPattern: [2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900],
    milestones: [
      { mes: 1, label: 'Control Neonato (7-28d)', hito: 'Tamizaje Neonatal y Vacuna BCG/HepB', edadTarget: '7 a 28 días', cups: '890201' },
      { mes: 2, label: 'Control Pediatría (2-3m)', hito: 'Valoración Crecimiento y Vacuna Pentavalente 1', edadTarget: '2 a 3 meses', cups: '890205' },
      { mes: 3, label: 'Lactancia y Crianza (3m)', hito: 'Monitoreo Lactancia Materna Exclusiva', edadTarget: '3 meses', cups: '890203' },
      { mes: 4, label: 'Vacunación 4 Meses', hito: '2da dosis Pentavalente, Rotavirus y Neumococo', edadTarget: '4 meses', cups: '993120' },
      { mes: 5, label: 'Seguimiento Pediátrico 5m', hito: 'Monitoreo Pondoestatural y Neurodesarrollo', edadTarget: '5 meses', cups: '890205' },
      { mes: 6, label: 'Alimentación Compl. (6-8m)', hito: 'Inicio Alimentos, Micronutrientes y Hemoglobina', edadTarget: '6 a 8 meses', cups: '902204' },
      { mes: 7, label: 'Vacunación 7 Meses', hito: '2da dosis Influenza Estacional Pediátrica', edadTarget: '7 meses', cups: '993122' },
      { mes: 8, label: 'Salud Oral (8m)', hito: 'Primera Valoración Odontológica y Barniz Flúor', edadTarget: '8 meses', cups: '997102' },
      { mes: 9, label: 'Neurodesarrollo EAD-3 (9m)', hito: 'Escala Abreviada de Desarrollo y Tamizaje Visual', edadTarget: '9 meses', cups: '890208' },
      { mes: 10, label: 'Control Nutricional (10m)', hito: 'Curva de Crecimiento OMS y Prevención Accidentes', edadTarget: '10 meses', cups: '890205' },
      { mes: 11, label: 'Pre-Anual (11m)', hito: 'Preparación Transición Alimentaria 1er Año', edadTarget: '11 meses', cups: '890201' },
      { mes: 12, label: 'Control 1 Año (12m)', hito: 'Refuerzo Triple Viral (SRP), Varicela y Hepatitis A', edadTarget: '12 meses (1 año)', cups: '993125' }
    ]
  },
  {
    id: 'B',
    key: 'infancia',
    nombre: 'Infancia',
    rango: '6 a 11 años',
    edadMin: 6,
    edadMax: 11,
    genero: 'ambos',
    color: 'bg-teal-600',
    borderColor: 'border-teal-300',
    lightBg: 'bg-teal-50/70',
    textColor: 'text-teal-900',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    totalCenso: 41200,
    descripcion: 'Atención en salud para niños y niñas de 6 a 11 años. Valoración del desarrollo físico y puberal, tamizaje visual, agudeza auditiva y salud bucal.',
    scheduledPattern: [3430, 3430, 3430, 3440, 3430, 3430, 3430, 3440, 3430, 3440, 3430, 3470],
    milestones: [
      { mes: 1, label: 'Ingreso Escolar (6a)', hito: 'Valoración Médica Integral y Agudeza Visual', edadTarget: '6 años', cups: '890201' },
      { mes: 2, label: 'Tamizaje Auditivo (7a)', hito: 'Audiometría Tamiz y Rendimiento Escolar', edadTarget: '7 años', cups: '954100' },
      { mes: 3, label: 'Salud Bucal Escolar (8a)', hito: 'Profilaxis y Sellantes en Primeros Molares', edadTarget: '8 años', cups: '997101' },
      { mes: 4, label: 'Tamizaje Nutricional (8a)', hito: 'Evaluación IMC y Prevención de Obesidad', edadTarget: '8 años', cups: '890203' },
      { mes: 5, label: 'Vacunación VPH (9a)', hito: '1ra dosis VPH Niñas y Niños de 9 Años', edadTarget: '9 años', cups: '993130' },
      { mes: 6, label: 'Desarrollo Puberal (10a)', hito: 'Estadios de Tanner y Orientación Corporal', edadTarget: '10 años', cups: '890205' },
      { mes: 7, label: 'Estilos de Vida (10a)', hito: 'Actividad Física y Límite de Pantallas', edadTarget: '10 años', cups: '890208' },
      { mes: 8, label: 'Salud Oral Semestral (11a)', hito: 'Control de Barniz de Flúor y Caries', edadTarget: '11 años', cups: '997102' },
      { mes: 9, label: 'Salud Mental y Bullying', hito: 'Tamizaje Psicosocial Escolar y Convivencia', edadTarget: '11 años', cups: '890206' },
      { mes: 10, label: 'Dinámica Familiar (9-11a)', hito: 'Factores Protectores y Prevención Violencias', edadTarget: '9 a 11 años', cups: '890201' },
      { mes: 11, label: 'Agudeza Visual Snellen', hito: 'Tamizaje de Refracción y Salud Ocular', edadTarget: '6 a 11 años', cups: '950100' },
      { mes: 12, label: 'Consolidación PAI Escolar', hito: 'Revisión Carnet Vacunal y Crecimiento Final', edadTarget: '11 años', cups: '993100' }
    ]
  },
  {
    id: 'C',
    key: 'adolescencia',
    nombre: 'Adolescencia',
    rango: '12 a 17 años',
    edadMin: 12,
    edadMax: 17,
    genero: 'ambos',
    color: 'bg-cyan-600',
    borderColor: 'border-cyan-300',
    lightBg: 'bg-cyan-50/70',
    textColor: 'text-cyan-900',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    totalCenso: 37500,
    descripcion: 'Atención médica y psicosocial de 12 a 17 años. Salud sexual y reproductiva, prevención de consumo de sustancias y valoración nutricional.',
    scheduledPattern: [3125, 3125, 3125, 3125, 3125, 3125, 3125, 3125, 3125, 3125, 3125, 3125],
    milestones: [
      { mes: 1, label: 'Salud Integral Adolescente', hito: 'Valoración Médica y Psicosocial HEADSSS', edadTarget: '12 a 14 años', cups: '890201' },
      { mes: 2, label: 'Tamizaje Visual y Auditivo', hito: 'Optometría y Evaluación Hipoacusia', edadTarget: '12 a 17 años', cups: '950100' },
      { mes: 3, label: 'Salud Sexual y Reproductiva', hito: 'Asesoría Anticonceptiva Informada y Consentida', edadTarget: '14 a 17 años', cups: '890204' },
      { mes: 4, label: 'Tamizaje Sustancias CRAFFT', hito: 'Prevención Consumo Alcohol, Tabaco y Vaping', edadTarget: '13 a 17 años', cups: '890206' },
      { mes: 5, label: 'Salud Mental (PHQ-9)', hito: 'Tamizaje Depresión y Riesgo Autolesivo', edadTarget: '12 a 17 años', cups: '890208' },
      { mes: 6, label: 'Vacunación Td y VPH', hito: 'Refuerzo Toxoide Tetánico y VPH Adolescente', edadTarget: '12 a 17 años', cups: '993130' },
      { mes: 7, label: 'Salud Bucal y Detartraje', hito: 'Higiene Interproximal y Profilaxis Dental', edadTarget: '12 a 17 años', cups: '997101' },
      { mes: 8, label: 'Tamizaje Trastornos Nutric.', hito: 'Detección Anorexia, Bulimia y Obesidad', edadTarget: '12 a 17 años', cups: '890203' },
      { mes: 9, label: 'Prevención ITS y Preservativo', hito: 'Educación Prevención VIH y Entrega Barrera', edadTarget: '14 a 17 años', cups: '890204' },
      { mes: 10, label: 'Tamizaje Violencia Género', hito: 'Detección Violencia Intrafamiliar y Abuso', edadTarget: '12 a 17 años', cups: '890206' },
      { mes: 11, label: 'Proyecto de Vida', hito: 'Orientación Vocacional y Factores de Resiliencia', edadTarget: '15 a 17 años', cups: '890201' },
      { mes: 12, label: 'Cierre Integral Ruta 3280', hito: 'Consolidación Adherencia y Transición Juventud', edadTarget: '17 años', cups: '890205' }
    ]
  },
  {
    id: 'D',
    key: 'juventud',
    nombre: 'Juventud',
    rango: '18 a 28 años',
    edadMin: 18,
    edadMax: 28,
    genero: 'ambos',
    color: 'bg-blue-600',
    borderColor: 'border-blue-300',
    lightBg: 'bg-blue-50/70',
    textColor: 'text-blue-900',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    totalCenso: 76000,
    descripcion: 'Atención en salud para jóvenes. Tamizaje de riesgo cardiovascular, salud mental, tamizaje de ITS/VIH y hábitos de vida saludables.',
    scheduledPattern: [6330, 6330, 6330, 6340, 6330, 6330, 6340, 6330, 6340, 6330, 6340, 6400],
    milestones: [
      { mes: 1, label: 'Riesgo Cardiovascular Joven', hito: 'Presión Arterial, Perímetro Abdominal e IMC', edadTarget: '18 a 28 años', cups: '890201' },
      { mes: 2, label: 'Perfil Lipídico Basal', hito: 'Colesterol Total, HDL, Triglicéridos y Glicemia', edadTarget: '18 a 28 años', cups: '903825' },
      { mes: 3, label: 'Anticoncepción Larga Duración', hito: 'Asesoría e Inserción DIU o Implante Subdérmico', edadTarget: '18 a 28 años', cups: '890204' },
      { mes: 4, label: 'Pruebas Rápidas ITS', hito: 'Tamizaje Rápido VIH y Sífilis con Asesoría', edadTarget: '18 a 28 años', cups: '906249' },
      { mes: 5, label: 'Salud Mental y Ansiedad', hito: 'Tamizaje GAD-7 y Prevención Estrés Universitario/Laboral', edadTarget: '18 a 28 años', cups: '890206' },
      { mes: 6, label: 'Salud Oral Periodontal', hito: 'Detartraje Supragingival y Control Periodontal', edadTarget: '18 a 28 años', cups: '997101' },
      { mes: 7, label: 'Consumo Alcohol (AUDIT)', hito: 'Tamizaje Consumo Nocivo y Deshabituación Tabáquica', edadTarget: '18 a 28 años', cups: '890208' },
      { mes: 8, label: 'Tamizaje Cuello Uterino (25a+)', hito: 'Citología Cervicovaginal en Mujeres >= 25 años', edadTarget: '25 a 28 años (F)', cups: '892901' },
      { mes: 9, label: 'Consulta Preconcepcional', hito: 'Planificación Reproductiva y Suplementación Folatos', edadTarget: '18 a 28 años', cups: '890203' },
      { mes: 10, label: 'Vacunación Fiebre Amarilla', hito: 'Refuerzo Fiebre Amarilla, Hepatitis B y Td', edadTarget: '18 a 28 años', cups: '993120' },
      { mes: 11, label: 'Actividad Física Cardioprotectora', hito: 'Prescripción de Ejercicio y Alimentación Sana', edadTarget: '18 a 28 años', cups: '890205' },
      { mes: 12, label: 'Balance Anual Juventud', hito: 'Consolidación Tamizajes y Seguimiento Metas', edadTarget: '18 a 28 años', cups: '890201' }
    ]
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
    lightBg: 'bg-indigo-50/70',
    textColor: 'text-indigo-900',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    totalCenso: 128500,
    descripcion: 'Atención integral del adulto. Detección temprana de cáncer (mama, cuello uterino, próstata, colon), riesgo cardiovascular, metabólico y salud renal.',
    scheduledPattern: [10700, 10700, 10710, 10710, 10710, 10710, 10710, 10710, 10710, 10710, 10710, 10710],
    milestones: [
      { mes: 1, label: 'Riesgo Cardiovascular Framingham', hito: 'Evaluación Estratificada de Riesgo Coronario 10 años', edadTarget: '29 a 59 años', cups: '890201' },
      { mes: 2, label: 'Perfil Metabólico y Renal', hito: 'Glicemia, Creatinina y Microalbuminuria en Orina', edadTarget: '29 a 59 años', cups: '903841' },
      { mes: 3, label: 'Prueba ADN-VPH (30-59a)', hito: 'Tamizaje Molecular de VPH cada 5 años', edadTarget: '30 a 59 años (F)', cups: '906915' },
      { mes: 4, label: 'Cáncer Colon: Sangre Oculta', hito: 'Prueba Inmunoquímica en Materia Fecal (>= 50a)', edadTarget: '50 a 59 años', cups: '907008' },
      { mes: 5, label: 'Mamografía Bilateral (>=50a)', hito: 'Mamografía de Tamizaje Bienal y Examen de Mama', edadTarget: '50 a 59 años (F)', cups: '876801' },
      { mes: 6, label: 'Cáncer Próstata: PSA y Tacto', hito: 'Antígeno Prostático Específico y Examen Clínico', edadTarget: '50 a 59 años (M)', cups: '906422' },
      { mes: 7, label: 'Salud Oral y Periodoncia', hito: 'Tratamiento Periodontal Básico y Detartraje', edadTarget: '29 a 59 años', cups: '997101' },
      { mes: 8, label: 'Tamizaje EPOC (Espirometría)', hito: 'Espirometría Prequirúrgica o con Humo/Leña/Tabaco', edadTarget: '40 a 59 años', cups: '893805' },
      { mes: 9, label: 'Control Hipertensión / Diabetes', hito: 'Monitoreo de Metas de HbA1c y Presión Arterial', edadTarget: '29 a 59 años', cups: '890205' },
      { mes: 10, label: 'Tamizaje Visual y Tonometría', hito: 'Fondo de Ojo y Presión Intraocular (Glaucoma)', edadTarget: '40 a 59 años', cups: '950100' },
      { mes: 11, label: 'Salud Mental Ocupacional', hito: 'Prevención Síndrome de Agotamiento y Depresión', edadTarget: '29 a 59 años', cups: '890206' },
      { mes: 12, label: 'Plan de Cuidado Anual 3280', hito: 'Ajuste Farmacológico y Metas Terapéuticas', edadTarget: '29 a 59 años', cups: '890201' }
    ]
  },
  {
    id: 'F',
    key: 'vejez',
    nombre: 'Vejez',
    rango: '60 años o más',
    edadMin: 60,
    edadMax: 102,
    genero: 'ambos',
    color: 'bg-violet-600',
    borderColor: 'border-violet-300',
    lightBg: 'bg-violet-50/70',
    textColor: 'text-violet-900',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-300',
    totalCenso: 82000,
    descripcion: 'Atención médica integral al adulto mayor. Valoración geriátrica multidimensional, tamizaje de fragilidad, caídas, polifarmacia y deterioro cognitivo.',
    scheduledPattern: [6830, 6830, 6830, 6840, 6830, 6830, 6840, 6830, 6840, 6830, 6840, 6860],
    milestones: [
      { mes: 1, label: 'Valoración Geriátrica Multidim.', hito: 'Evaluación Física, Funcional, Afectiva y Social', edadTarget: '60+ años', cups: '890201' },
      { mes: 2, label: 'Tamizaje Fragilidad y Caídas', hito: 'Test Timed Up and Go y Marcha Geriátrica', edadTarget: '60+ años', cups: '890208' },
      { mes: 3, label: 'Tamizaje Cognitivo (Minimental)', hito: 'Detección Temprana Deterioro Cognitivo y Demencia', edadTarget: '60+ años', cups: '890206' },
      { mes: 4, label: 'Vacuna Neumococo e Influenza', hito: 'Neumococo 23 Polisacárido e Influenza Anual', edadTarget: '60+ años', cups: '993122' },
      { mes: 5, label: 'Revisión Polifarmacia Beers', hito: 'Conciliación Farmacológica y Deprescripción', edadTarget: '60+ años', cups: '890205' },
      { mes: 6, label: 'Riesgo Cardiovascular Geriátrico', hito: 'Control Estricto Presión y Tasa Filtración Renal', edadTarget: '60+ años', cups: '903841' },
      { mes: 7, label: 'Tamizaje Visual (Cataratas)', hito: 'Agudeza Visual, Fondo de Ojo y Audiometría', edadTarget: '60+ años', cups: '950100' },
      { mes: 8, label: 'Salud Oral Geriátrica', hito: 'Adaptación de Prótesis y Detección de Neoplasias', edadTarget: '60+ años', cups: '997101' },
      { mes: 9, label: 'Depresión Geriátrica Yesavage', hito: 'Tamizaje Estado de Ánimo y Redes Comunitarias', edadTarget: '60+ años', cups: '890206' },
      { mes: 10, label: 'Salud Digestiva e Incontinencia', hito: 'Evaluación Tránsito Intestinal y Continencia', edadTarget: '60+ años', cups: '890203' },
      { mes: 11, label: 'Evaluación Red de Cuidador', hito: 'Prevención Claudicación del Cuidador Primario', edadTarget: '60+ años', cups: '890208' },
      { mes: 12, label: 'Plan Envejecimiento Activo', hito: 'Autonomía Funcional y Prescripción Nutricional', edadTarget: '60+ años', cups: '890201' }
    ]
  },
  {
    id: 'G',
    key: 'preventivo_mujer',
    nombre: 'Preventivo de la Mujer',
    rango: 'Mujeres 14 a 69 años',
    edadMin: 14,
    edadMax: 69,
    genero: 'femenino',
    color: 'bg-rose-600',
    borderColor: 'border-rose-300',
    lightBg: 'bg-rose-50/70',
    textColor: 'text-rose-900',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    totalCenso: 145000,
    descripcion: 'Ruta de protección específica y detección temprana: citología cervicovaginal, ADN-VPH, mamografía bilateral (50-69 años) y examen clínico de mama.',
    scheduledPattern: [12080, 12080, 12080, 12090, 12080, 12080, 12090, 12080, 12090, 12080, 12090, 12180],
    milestones: [
      { mes: 1, label: 'Citología Cervicovaginal (25-29a)', hito: 'Esquema 1-1-3 para Detección Lesión Intraepitelial', edadTarget: '25 a 29 años (F)', cups: '892901' },
      { mes: 2, label: 'Prueba Molecular ADN-VPH (30-65a)', hito: 'Tamizaje Molecular VPH Alto Riesgo Oncogénico', edadTarget: '30 a 65 años (F)', cups: '906915' },
      { mes: 3, label: 'Examen Clínico Mama (>=40a)', hito: 'Palpación Profesional Cuadrantes y Axila Anual', edadTarget: '40 a 69 años (F)', cups: '890201' },
      { mes: 4, label: 'Mamografía Tamizaje (50-69a)', hito: 'Mamografía Bilateral Dos Proyecciones (Bienal)', edadTarget: '50 a 69 años (F)', cups: '876801' },
      { mes: 5, label: 'Salud Sexual y Derechos Femeninos', hito: 'Atención Integral sin Barreras Administrativas', edadTarget: '14 a 49 años (F)', cups: '890204' },
      { mes: 6, label: 'Colposcopia de Oportunidad', hito: 'Ruta de Seguimiento Citología / VPH Positivo', edadTarget: '25 a 65 años (F)', cups: '892902' },
      { mes: 7, label: 'Riesgo Cardiovascular Menopáusico', hito: 'Evaluación Metabólica Postmenopausia', edadTarget: '45 a 65 años (F)', cups: '890205' },
      { mes: 8, label: 'Tamizaje Violencia Género', hito: 'Activación Código Rosa y Apoyo Psicosocial', edadTarget: '14 a 69 años (F)', cups: '890206' },
      { mes: 9, label: 'Asesoría Preconcepcional', hito: 'Evaluación Riesgo Gestacional y Ácido Fólico', edadTarget: '14 a 45 años (F)', cups: '890203' },
      { mes: 10, label: 'Tamizaje Osteoporosis y Caídas', hito: 'Densitometría y Calcio en Postmenopausia', edadTarget: '50 a 69 años (F)', cups: '881601' },
      { mes: 11, label: 'Rescate de Mamografías Pendientes', hito: 'Llamada Asertiva Puerto 22 a Mujeres Sin Tamizaje', edadTarget: '50 a 69 años (F)', cups: '876801' },
      { mes: 12, label: 'Consolidación Coberturas Cáncer', hito: 'Cumplimiento Indicadores Ruta Materno y Oncológica', edadTarget: '14 a 69 años (F)', cups: '890201' }
    ]
  },
  {
    id: 'H',
    key: 'planificacion_familiar',
    nombre: 'Planificación Familiar',
    rango: 'Población 14 a 49 años',
    edadMin: 14,
    edadMax: 49,
    genero: 'ambos',
    color: 'bg-amber-600',
    borderColor: 'border-amber-300',
    lightBg: 'bg-amber-50/70',
    textColor: 'text-amber-900',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    totalCenso: 162000,
    descripcion: 'Asesoría y provisión de métodos anticonceptivos (orales, inyectables, DIU, implantes subdérmicos, vasectomía y ligadura). Consulta preconcepcional.',
    scheduledPattern: [13500, 13500, 13500, 13500, 13500, 13500, 13500, 13500, 13500, 13500, 13500, 13500],
    milestones: [
      { mes: 1, label: 'Asesoría Anticonceptiva Libre', hito: 'Elección Informada y Criterios Médicos Elegibilidad', edadTarget: '14 a 49 años', cups: '890204' },
      { mes: 2, label: 'Implante Subdérmico (3-5a)', hito: 'Inserción Gratuita de Implante Liberador Levonorgestrel', edadTarget: '14 a 49 años', cups: '861201' },
      { mes: 3, label: 'Dispositivo Intrauterino (DIU)', hito: 'Inserción T de Cobre o DIU Medicado', edadTarget: '14 a 49 años', cups: '697100' },
      { mes: 4, label: 'Anticonceptivos Inyectables', hito: 'Aplicación Mensual / Trimestral con Trazabilidad', edadTarget: '14 a 49 años', cups: '993120' },
      { mes: 5, label: 'Métodos de Doble Protección', hito: 'Preservativo + Método Hormonal contra ITS y Embarazo', edadTarget: '14 a 49 años', cups: '890204' },
      { mes: 6, label: 'Vasectomía Quirúrgica', hito: 'Procedimiento Ambulatorio sin Bisturí para Hombres', edadTarget: '18 a 49 años (M)', cups: '637300' },
      { mes: 7, label: 'Ligadura de Trompas (Pomeroy)', hito: 'Anticoncepción Quirúrgica Definitiva Femenina', edadTarget: '18 a 49 años (F)', cups: '662200' },
      { mes: 8, label: 'Control Tolerancia y Adherencia', hito: 'Manejo de Spotting y Verificación de Continuidad', edadTarget: '14 a 49 años', cups: '890205' },
      { mes: 9, label: 'Consulta Preconcepcional', hito: 'Planificación Familiar Deseada y Factores de Riesgo', edadTarget: '14 a 45 años', cups: '890203' },
      { mes: 10, label: 'Anticoncepción Post-Parto (AESP)', hito: 'Inicio Método antes del Alta Hospitalaria', edadTarget: 'Gestantes / Puérperas', cups: '890204' },
      { mes: 11, label: 'Suministro Píldoras Orales', hito: 'Dispensación Regular Anticonceptivos Combinados', edadTarget: '14 a 49 años', cups: '993120' },
      { mes: 12, label: 'Satisfacción y Retención Método', hito: 'Evaluación Anual de Cobertura y Bienestar Reproductivo', edadTarget: '14 a 49 años', cups: '890201' }
    ]
  },
  {
    id: 'I',
    key: 'vacunacion',
    nombre: 'Vacunación',
    rango: 'Todas las edades priorizadas',
    edadMin: 0,
    edadMax: 102,
    genero: 'ambos',
    color: 'bg-emerald-700',
    borderColor: 'border-emerald-400',
    lightBg: 'bg-emerald-50/70',
    textColor: 'text-emerald-950',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
    totalCenso: 215000,
    descripcion: 'Esquema Nacional PAI (Pentavalente, Triple Viral, Neumococo, Rotavirus, VPH en niñas y niños, Influenza estacional, Tétanos y COVID-19).',
    scheduledPattern: [17910, 17910, 17920, 17910, 17920, 17910, 17920, 17910, 17920, 17910, 17920, 17980],
    milestones: [
      { mes: 1, label: 'Vacuna Recién Nacido', hito: 'BCG y Hepatitis B Pediátrica en primeras 24 horas', edadTarget: '0 a 28 días', cups: '993101' },
      { mes: 2, label: 'Esquema 2 Meses', hito: 'Pentavalente 1, Polio IPV 1, Rotavirus 1 y Neumococo 1', edadTarget: '2 meses', cups: '993120' },
      { mes: 3, label: 'Búsqueda Activa Susceptibles', hito: 'Monitoreo Pacientes Retrasados en Esquema PAI', edadTarget: '0 a 5 años', cups: '890208' },
      { mes: 4, label: 'Esquema 4 Meses', hito: 'Pentavalente 2, Polio IPV 2, Rotavirus 2 y Neumococo 2', edadTarget: '4 meses', cups: '993120' },
      { mes: 5, label: 'Carnet Digital PAIweb', hito: 'Verificación Nominal y Validación de Dosis', edadTarget: 'Todas las edades', cups: '890201' },
      { mes: 6, label: 'Esquema 6 Meses', hito: 'Pentavalente 3, Polio 3 e Influenza Pediátrica 1', edadTarget: '6 meses', cups: '993122' },
      { mes: 7, label: 'Refuerzo Influenza 7m', hito: 'Influenza Pediátrica 2da dosis obligatoria', edadTarget: '7 meses', cups: '993122' },
      { mes: 8, label: 'Jornada Nacional Vacunación', hito: 'Intensificación de Dosis Faltantes en el Hospital', edadTarget: 'Todas las edades', cups: '993100' },
      { mes: 9, label: 'Vacuna VPH Escolar', hito: 'VPH Niñas 9-17 años y Niños 9-14 años', edadTarget: '9 a 17 años', cups: '993130' },
      { mes: 10, label: 'Refuerzos de 18 Meses', hito: 'Fiebre Amarilla, DPT 1er Refuerzo y Polio Oral', edadTarget: '18 meses', cups: '993125' },
      { mes: 11, label: 'Refuerzo Escolar 5 Años', hito: 'DPT 2do Refuerzo, Polio y Triple Viral SRP', edadTarget: '5 años', cups: '993125' },
      { mes: 12, label: 'Vacunación Adulto Mayor y Tdap', hito: 'Influenza Adultos, Neumococo 23 y Tdap Gestantes', edadTarget: '60+ años y Gestantes', cups: '993122' }
    ]
  },
  {
    id: 'J',
    key: 'salud_oral',
    nombre: 'Salud Oral',
    rango: 'Toda la población (Censo completo)',
    edadMin: 0,
    edadMax: 102,
    genero: 'ambos',
    color: 'bg-sky-700',
    borderColor: 'border-sky-300',
    lightBg: 'bg-sky-50/70',
    textColor: 'text-sky-950',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
    totalCenso: 400000,
    descripcion: 'Atención odontológica preventiva general y por curso de vida: aplicación de barniz de flúor, sellantes, detartraje supragingival y control de placa bacteriana.',
    scheduledPattern: [33333, 33333, 33334, 33333, 33333, 33334, 33333, 33333, 33334, 33333, 33333, 33338],
    milestones: [
      { mes: 1, label: 'Valoración Odontológica Inicial', hito: 'Examen Estomatológico e Índice de Placa O\'Leary', edadTarget: 'Todas las edades', cups: '890203' },
      { mes: 2, label: 'Barniz de Flúor Semestre 1', hito: 'Aplicación Tópica de Barniz de Flúor (1-17 años)', edadTarget: '1 a 17 años', cups: '997102' },
      { mes: 3, label: 'Sellantes Fosas y Fisuras', hito: 'Protección Mecánica en Molares Permanentes', edadTarget: '3 a 15 años', cups: '997101' },
      { mes: 4, label: 'Detartraje Supragingival', hito: 'Eliminación Ultrasonido de Cálculo y Sarro Dental', edadTarget: '12+ años', cups: '997105' },
      { mes: 5, label: 'Profilaxis y Remoción Manchas', hito: 'Limpieza Dental con Pasta Profiláctica Profesional', edadTarget: 'Todas las edades', cups: '997100' },
      { mes: 6, label: 'Control Periodontal Crónicos', hito: 'Monitoreo de Encías en Hipertensos y Diabéticos', edadTarget: 'Adultos / Vejez', cups: '890205' },
      { mes: 7, label: 'Técnica Cepillado e Hilo', hito: 'Educación Personalizada en Higiene Bucal', edadTarget: 'Todas las edades', cups: '890208' },
      { mes: 8, label: 'Barniz de Flúor Semestre 2', hito: 'Segunda Dosis Semestral Obligatoria Barniz Flúor', edadTarget: '1 a 17 años', cups: '997102' },
      { mes: 9, label: 'Tamizaje Lesiones Premalignas', hito: 'Detección Leucoplasias y Neoplasias de Mucosa Oral', edadTarget: 'Adultos / Vejez', cups: '890206' },
      { mes: 10, label: 'Terapia Básica Periodontal', hito: 'Raspaje y Alisado Radicular Localizado', edadTarget: 'Adultos', cups: '997105' },
      { mes: 11, label: 'Ajuste Prótesis Geriátrica', hito: 'Evaluación Mucosa de Soporte y Oclusión en Vejez', edadTarget: '60+ años', cups: '890201' },
      { mes: 12, label: 'Cierre Anual Población Cero Caries', hito: 'Consolidación Índice COP/ceo Comunitario', edadTarget: 'Censo 400.000', cups: '997100' }
    ]
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

  // Retorna los 10 programas A a J con sus hitos
  getPrograms() {
    return PROGRAMAS_3280;
  },

  // Retorna un programa por ID (A a J)
  getProgramById(id) {
    return PROGRAMAS_3280.find(p => p.id === id) || PROGRAMAS_3280[0];
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
    const milestone = programa.milestones[monthIndex - 1] || programa.milestones[0];
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
          edadTexto: programa.id === 'A' ? `${Math.max(1, Math.min(11, monthIndex))} meses` : `${edad} años`,
          genero: isFemale ? 'Femenino' : 'Masculino',
          eps: p.eps || 'EPS Sanitas',
          ciudad: CIUDADES[Math.floor(Math.random() * CIUDADES.length)],
          programaActual: programa,
          milestoneActual: milestone,
          grupos: grupos,
          estadoTratamiento: ESTADOS_TRATAMIENTO[0],
          fechaProgramada: `2026-${String(monthIndex).padStart(2, '0')}-15`,
          horaProgramada: '08:30 AM',
          historiaClinica: this.generateClinicalHistory(p.nombre, edad, isFemale, programa, ESTADOS_TRATAMIENTO[0], milestone)
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

      // Texto de edad fiel a la Resolución
      let edadTexto = `${edad} años`;
      if (programa.id === 'A') {
        const mesesNac = Math.max(1, (monthIndex % 12));
        edadTexto = `${mesesNac} meses de nacido`;
      }

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
        edadTexto: edadTexto,
        genero: isFemale ? 'Femenino' : 'Masculino',
        eps: eps,
        ciudad: ciudad,
        programaActual: programa,
        milestoneActual: milestone,
        grupos: grupos,
        estadoTratamiento: estadoTratamiento,
        fechaProgramada: `2026-${String(monthIndex).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
        horaProgramada: `${String(hora12).padStart(2, '0')}:${horaM} ${ampm}`,
        historiaClinica: this.generateClinicalHistory(nombre, edad, isFemale, programa, estadoTratamiento, milestone)
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
      milestone: milestone,
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

  // Genera historia clínica basada en la Resolución 3280 de 2018 y el hito del mes
  generateClinicalHistory(nombre, edad, isFemale, programaActual, estado, milestone) {
    let antecedentes = 'Sin antecedentes patológicos crónicos conocidos. Vacunación completa para la edad.';
    let tamizajesCumplidos = [];
    let tamizajesPendientes = [];
    let motivo = `Ruta Integral de Promoción y Mantenimiento de la Salud - ${programaActual.nombre}: ${milestone?.hito || 'Control Periódico'}.`;

    if (edad <= 5) {
      antecedentes = 'Nacido a término (39 semanas). Peso adecuado al nacer (3.250g). Lactancia materna exclusiva reportada.';
      tamizajesCumplidos = ['Tamizaje visual neonatal', 'Evaluación auditiva inicial'];
      tamizajesPendientes = [milestone?.hito || 'Control Pediátrico 3280', 'Aplicación Barniz de Flúor'];
    } else if (edad >= 60) {
      antecedentes = 'Hipertensión arterial estadio 1 controlada con Losartán 50mg/día. Riesgo cardiovascular moderado (Framingham 12%).';
      tamizajesCumplidos = ['Electrocardiograma basal', 'Creatinina sérica', 'Glicemia en ayunas'];
      tamizajesPendientes = [milestone?.hito || 'Valoración Geriátrica Multidimensional', 'Vacuna Neumococo'];
    } else if (isFemale && edad >= 25) {
      antecedentes = 'Gesta 1, Para 1, Abortos 0. Planificación con método de barrera / implante subdérmico.';
      tamizajesCumplidos = ['Citología cervicovaginal 2024 (Negativa para lesión intraepitelial)'];
      tamizajesPendientes = [milestone?.hito || 'Tamizaje ADN-VPH Preventivo'];
    } else {
      antecedentes = 'Sedentarismo leve. Sin alergias medicamentosas conocidas. Presión arterial dentro de rangos normales.';
      tamizajesCumplidos = ['Medición de IMC', 'Tamizaje de colesterol total'];
      tamizajesPendientes = [milestone?.hito || 'Consulta de Salud Oral Semestral', 'Valoración Estilos de Vida'];
    }

    return {
      motivoConsulta: motivo,
      antecedentes: antecedentes,
      tamizajesCumplidos: tamizajesCumplidos,
      tamizajesPendientes: tamizajesPendientes,
      hitoAsignado: milestone?.hito || 'Consulta Periódica Res. 3280',
      codigoCups: milestone?.cups || '890201',
      edadTarget: milestone?.edadTarget || 'Edad acorde al curso de vida',
      ultimaConsulta: '2026-03-12 • Medicina General / Promoción y Prevención',
      proximaCita: '2026-05-20 • Control Programado IVR SADI',
      notasEvolucion: `Paciente citado a través de la plataforma SADI de Demanda Inducida en el marco de la Resolución 3280 de 2018 para cumplir el hito obligatorio: "${milestone?.hito}". Presenta adherencia activa al programa institucional. Llamada programada e inamovible por canal telefónico (Puerto 22).`
    };
  }
};
