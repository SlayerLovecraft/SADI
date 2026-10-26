// ==============================================================================
// TELEMONITORING SERVICE - SADI CARE ENGINE
// Gestión de datos de equipos caseros, alertas clínicas, curvas y enlaces con Supabase
// Con 35 Pacientes Reales (5 por cada caso/curso de vida) y 8 Doctores Especialistas
// ==============================================================================
import { supabase } from '@/lib/supabase';
import { evaluateVitalSigns3280, generateAIAgentScript, getCursoVida3280 } from './rias3280Engine';
import { getAssignedDoctorEmailForPatient } from '@/pages/doctor/doctorUtils';

const LOCAL_STORAGE_KEY_MEASUREMENTS = 'sadi_3280_measurements_v2';
const LOCAL_STORAGE_KEY_ALERTS = 'sadi_3280_alerts_v2';
const LOCAL_STORAGE_KEY_EVIDENCE = 'sadi_3280_evidence_v2';
const LOCAL_STORAGE_KEY_PATIENTS = 'sadi_3280_patients_v2';

// 8 DOCTORES ESPECIALISTAS (UNO POR CADA ÁREA CLÍNICA DE LA RES. 3280)
export const SEED_DOCTORS_3280 = [
  {
    id: 'd1111111-1111-1111-1111-111111111111',
    doctor_id: 'd1111111-1111-1111-1111-111111111111',
    name: 'Dra. Paola Andrea Gil Restrepo',
    email: 'paola.gil@sadi.med.co',
    specialty: 'Pediatría y Puericultura',
    area_3280: 'Primera Infancia e Infancia (0 a 11 años)',
    telefono: '+57 311 445 5601',
    registro_medico: 'RM-ANT-89234',
    is_active: true
  },
  {
    id: 'd2222222-2222-2222-2222-222222222222',
    doctor_id: 'd2222222-2222-2222-2222-222222222222',
    name: 'Dr. Juan Camilo Bermúdez Orozco',
    email: 'juan.bermudez@sadi.med.co',
    specialty: 'Medicina Familiar y Hebiatría',
    area_3280: 'Adolescencia (12 a 17 años)',
    telefono: '+57 313 778 8902',
    registro_medico: 'RM-CUN-45120',
    is_active: true
  },
  {
    id: 'd3333333-3333-3333-3333-333333333333',
    doctor_id: 'd3333333-3333-3333-3333-333333333333',
    name: 'Dra. Sandra Milena Castaño Ríos',
    email: 'sandra.castano@sadi.med.co',
    specialty: 'Medicina General y Salud Sexual / Reproductiva',
    area_3280: 'Juventud (18 a 28 años)',
    telefono: '+57 314 990 0103',
    registro_medico: 'RM-VAL-78932',
    is_active: true
  },
  {
    id: 'd4444444-4444-4444-4444-444444444444',
    doctor_id: 'd4444444-4444-4444-4444-444444444444',
    name: 'Dr. Fernando Rincón Velásquez',
    email: 'fernando.rincon@sadi.med.co',
    specialty: 'Medicina Interna y Riesgo Cardiovascular',
    area_3280: 'Adultez (29 a 59 años)',
    telefono: '+57 301 223 3404',
    registro_medico: 'RM-BOG-12908',
    is_active: true
  },
  {
    id: 'd5555555-5555-5555-5555-555555555555',
    doctor_id: 'd5555555-5555-5555-5555-555555555555',
    name: 'Dra. Beatriz Elena Arango Salazar',
    email: 'beatriz.arango@sadi.med.co',
    specialty: 'Geriatría y Envejecimiento Activo',
    area_3280: 'Vejez (60 años o más)',
    telefono: '+57 320 334 4505',
    registro_medico: 'RM-CAL-67123',
    is_active: true
  },
  {
    id: 'd6666666-6666-6666-6666-666666666666',
    doctor_id: 'd6666666-6666-6666-6666-666666666666',
    name: 'Dr. Mauricio Villa Cardona',
    email: 'mauricio.villa@sadi.med.co',
    specialty: 'Ginecobstetricia y Medicina Materno Fetal',
    area_3280: 'Ruta Materno Perinatal (RIAMP)',
    telefono: '+57 312 889 9106',
    registro_medico: 'RM-ANT-34891',
    is_active: true
  },
  {
    id: 'd7777777-7777-7777-7777-777777777777',
    doctor_id: 'd7777777-7777-7777-7777-777777777777',
    name: 'Dra. Natalia Ocampo Henao',
    email: 'natalia.ocampo@sadi.med.co',
    specialty: 'Odontología Integral y Salud Oral 3280',
    area_3280: 'Salud Bucal Transversal Res. 3280',
    telefono: '+57 317 665 5407',
    registro_medico: 'OD-ANT-19402',
    is_active: true
  },
  {
    id: 'd8888888-8888-8888-8888-888888888888',
    doctor_id: 'd8888888-8888-8888-8888-888888888888',
    name: 'Dr. Carlos Eduardo Salazar Montoya',
    email: 'carlos.salazar@sadi.med.co',
    specialty: 'Oncología Clínica y Detección Temprana',
    area_3280: 'Tamizaje Oncológico Res. 3280 (Mama, Cérvix, Próstata, Colon)',
    telefono: '+57 318 443 3208',
    registro_medico: 'RM-BOG-98214',
    is_active: true
  },
  // ==============================================================================
  // 3 MÉDICOS GENERALES DE PRUEBA (ATENCIÓN GENERAL Y ADMISIÓN PRIMARIA)
  // ==============================================================================
  {
    id: 'd0100000-0000-0000-0000-000000000001',
    doctor_id: 'd0100000-0000-0000-0000-000000000001',
    name: 'Dr. Alejandro Morales Restrepo',
    email: 'alejandro.morales@sadi.med.co',
    specialty: 'Medicina General (Admisión & Atención Primaria)',
    area_3280: 'Atención Médica General y Triaje Integral',
    telefono: '+57 310 882 1001',
    registro_medico: 'RM-MED-10492',
    is_general: true,
    is_active: true
  },
  {
    id: 'd0200000-0000-0000-0000-000000000002',
    doctor_id: 'd0200000-0000-0000-0000-000000000002',
    name: 'Dra. Valentina Gómez Salazar',
    email: 'valentina.gomez@sadi.med.co',
    specialty: 'Medicina General (Admisión & Consulta Externa)',
    area_3280: 'Atención Médica General y Triaje Integral',
    telefono: '+57 312 773 2002',
    registro_medico: 'RM-ANT-66120',
    is_general: true,
    is_active: true
  },
  {
    id: 'd0300000-0000-0000-0000-000000000003',
    doctor_id: 'd0300000-0000-0000-0000-000000000003',
    name: 'Dr. Daniel Felipe Vargas Ruiz',
    email: 'daniel.vargas@sadi.med.co',
    specialty: 'Medicina General (Admisión & Demanda Inducida)',
    area_3280: 'Atención Médica General y Triaje Integral',
    telefono: '+57 314 991 3003',
    registro_medico: 'RM-CUN-88931',
    is_general: true,
    is_active: true
  }
];

// 35 PACIENTES REALES: 5 POR CADA CURSO DE VIDA Y RUTA MATERNO PERINATAL
export const SEED_PATIENTS_3280 = [
  // ==========================================================================
  // CASO 1: PRIMERA INFANCIA (0 A 5 AÑOS) - Asignados a Dra. Paola Gil
  // ==========================================================================
  {
    id: 'p1010000-0000-0000-0000-000000000001',
    patient_id: 'p1010000-0000-0000-0000-000000000001',
    nombre: 'Luciana Ospina Castro',
    tipo_documento: 'RC',
    documento: '1198450123',
    telefono: '+573104567801',
    email: 'madre.luciana@gmail.com',
    fecha_nacimiento: '2026-07-15',
    sexo: 'femenino',
    curso_vida: 'primera_infancia',
    es_gestante: false,
    doctor_asignado_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_nombre: 'Dra. Paola Andrea Gil Restrepo',
    dispositivos_caseros: ['Termómetro Infrarrojo Digital'],
    direccion: 'Carrera 45 # 12-34, Medellín',
    regimen: 'Contributivo',
    eps: 'Sura EPS',
    canal_preferido: 'whatsapp',
    notas_clinicas: 'Lactante menor. Evaluación EAD-3 con adecuada motricidad. Esquema PAI al día.'
  },
  {
    id: 'p1010000-0000-0000-0000-000000000002',
    patient_id: 'p1010000-0000-0000-0000-000000000002',
    nombre: 'Mateo Benítez Valencia',
    tipo_documento: 'RC',
    documento: '1198345091',
    telefono: '+573186671122',
    email: 'madre.mateo@gmail.com',
    fecha_nacimiento: '2025-11-20',
    sexo: 'masculino',
    curso_vida: 'primera_infancia',
    es_gestante: false,
    doctor_asignado_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_nombre: 'Dra. Paola Andrea Gil Restrepo',
    dispositivos_caseros: ['Termómetro Infrarrojo Digital', 'Báscula Pesa Bebé'],
    direccion: 'Calle 10 # 5-60, Cali',
    regimen: 'Subsidiado',
    eps: 'Salud Total',
    canal_preferido: 'call_ia',
    notas_clinicas: 'Control de crecimiento y desarrollo con curvas OMS. Pendiente barniz de flúor.'
  },
  {
    id: 'p1010000-0000-0000-0000-000000000003',
    patient_id: 'p1010000-0000-0000-0000-000000000003',
    nombre: 'Salomé Caicedo Mejía',
    tipo_documento: 'RC',
    documento: '1197892341',
    telefono: '+573153344503',
    email: 'padres.salome@gmail.com',
    fecha_nacimiento: '2024-04-10',
    sexo: 'femenino',
    curso_vida: 'primera_infancia',
    es_gestante: false,
    doctor_asignado_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_nombre: 'Dra. Paola Andrea Gil Restrepo',
    dispositivos_caseros: ['Termómetro Infrarrojo Digital'],
    direccion: 'Transversal 28 # 78-19, Manizales',
    regimen: 'Contributivo',
    eps: 'Sanitas EPS',
    canal_preferido: 'whatsapp',
    notas_clinicas: 'Tamizaje visual inicial a los 3 años programado en optometría pediátrica.'
  },
  {
    id: 'p1010000-0000-0000-0000-000000000004',
    patient_id: 'p1010000-0000-0000-0000-000000000004',
    nombre: 'Samuel David Rengifo Morales',
    tipo_documento: 'RC',
    documento: '1196781294',
    telefono: '+573128899104',
    email: 'familia.rengifo@gmail.com',
    fecha_nacimiento: '2023-01-25',
    sexo: 'masculino',
    curso_vida: 'primera_infancia',
    es_gestante: false,
    doctor_asignado_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_nombre: 'Dra. Paola Andrea Gil Restrepo',
    dispositivos_caseros: ['Termómetro Infrarrojo Digital'],
    direccion: 'Avenida 6N # 42-10, Pereira',
    regimen: 'Subsidiado',
    eps: 'Nueva EPS',
    canal_preferido: 'sms',
    notas_clinicas: 'Desparasitación periódica con albendazol y suplementación con micronutrientes.'
  },
  {
    id: 'p1010000-0000-0000-0000-000000000005',
    patient_id: 'p1010000-0000-0000-0000-000000000005',
    nombre: 'Valeria Jaramillo Duque',
    tipo_documento: 'RC',
    documento: '1195670185',
    telefono: '+573017788205',
    email: 'madre.valeria@gmail.com',
    fecha_nacimiento: '2022-03-14',
    sexo: 'femenino',
    curso_vida: 'primera_infancia',
    es_gestante: false,
    doctor_asignado_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_nombre: 'Dra. Paola Andrea Gil Restrepo',
    dispositivos_caseros: ['Termómetro Infrarrojo Digital'],
    direccion: 'Calle 50 # 33-12, Medellín',
    regimen: 'Contributivo',
    eps: 'Sura EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: 'Próxima a transición al curso de Infancia. Refuerzos PAI de los 5 años listos.'
  },

  // ==========================================================================
  // CASO 2: INFANCIA (6 A 11 AÑOS) - Asignados a Dra. Paola Gil / Dra. Natalia Ocampo
  // ==========================================================================
  {
    id: 'p2020000-0000-0000-0000-000000000006',
    patient_id: 'p2020000-0000-0000-0000-000000000006',
    nombre: 'Dylan Santiago Pardo Ruiz',
    tipo_documento: 'TI',
    documento: '1098234561',
    telefono: '+573142233406',
    email: 'madre.dylan@gmail.com',
    fecha_nacimiento: '2020-09-12',
    sexo: 'masculino',
    curso_vida: 'infancia',
    es_gestante: false,
    doctor_asignado_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_nombre: 'Dra. Paola Andrea Gil Restrepo',
    dispositivos_caseros: ['Báscula Digital de Piso'],
    direccion: 'Carrera 78 # 45-20, Bogotá',
    regimen: 'Contributivo',
    eps: 'Compensar',
    canal_preferido: 'call_ia',
    notas_clinicas: 'Tamizaje Snellen a los 6 años con 20/20 bilateral. Aplicación de sellantes en molares.'
  },
  {
    id: 'p2020000-0000-0000-0000-000000000007',
    patient_id: 'p2020000-0000-0000-0000-000000000007',
    nombre: 'Isabella Gómez Restrepo',
    tipo_documento: 'TI',
    documento: '1097345672',
    telefono: '+573205566707',
    email: 'acudiente.isabella@gmail.com',
    fecha_nacimiento: '2018-05-30',
    sexo: 'femenino',
    curso_vida: 'infancia',
    es_gestante: false,
    doctor_asignado_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_nombre: 'Dra. Paola Andrea Gil Restrepo',
    dispositivos_caseros: ['Báscula Digital de Piso'],
    direccion: 'Circular 4 # 73-10, Medellín',
    regimen: 'Contributivo',
    eps: 'Sura EPS',
    canal_preferido: 'whatsapp',
    notas_clinicas: '8 años. Vacuna VPH programada para los 9 años. Evaluación de salud escolar normal.'
  },
  {
    id: 'p2020000-0000-0000-0000-000000000008',
    patient_id: 'p2020000-0000-0000-0000-000000000008',
    nombre: 'Jerónimo Londoño Zapata',
    tipo_documento: 'TI',
    documento: '1096456783',
    telefono: '+573116677808',
    email: 'familia.londono@gmail.com',
    fecha_nacimiento: '2017-08-18',
    sexo: 'masculino',
    curso_vida: 'infancia',
    es_gestante: false,
    doctor_asignado_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_nombre: 'Dra. Paola Andrea Gil Restrepo',
    dispositivos_caseros: ['Báscula Digital de Piso'],
    direccion: 'Calle 14 # 23-45, Bucaramanga',
    regimen: 'Subsidiado',
    eps: 'Coosalud',
    canal_preferido: 'sms',
    notas_clinicas: 'Monitoreo de sobrepeso infantil. Recomendación de actividad física estructurada.'
  },
  {
    id: 'p2020000-0000-0000-0000-000000000009',
    patient_id: 'p2020000-0000-0000-0000-000000000009',
    nombre: 'Mariana Duque Cárdenas',
    tipo_documento: 'TI',
    documento: '1095567894',
    telefono: '+573178899009',
    email: 'padres.mariana@gmail.com',
    fecha_nacimiento: '2016-02-14',
    sexo: 'femenino',
    curso_vida: 'infancia',
    es_gestante: false,
    doctor_asignado_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_nombre: 'Dra. Paola Andrea Gil Restrepo',
    dispositivos_caseros: ['Báscula Digital de Piso'],
    direccion: 'Carrera 15 # 6-32, Armenia',
    regimen: 'Contributivo',
    eps: 'Sanitas EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: 'Dosis aplicada de vacuna VPH a los 9 años. Tamizaje auditivo y visual sin alteraciones.'
  },
  {
    id: 'p2020000-0000-0000-0000-000000000010',
    patient_id: 'p2020000-0000-0000-0000-000000000010',
    nombre: 'Emmanuel Vargas Arias',
    tipo_documento: 'TI',
    documento: '1094678905',
    telefono: '+573199900110',
    email: 'madre.emmanuel@gmail.com',
    fecha_nacimiento: '2015-10-05',
    sexo: 'masculino',
    curso_vida: 'infancia',
    es_gestante: false,
    doctor_asignado_id: 'd1111111-1111-1111-1111-111111111111',
    doctor_nombre: 'Dra. Paola Andrea Gil Restrepo',
    dispositivos_caseros: ['Báscula Digital de Piso'],
    direccion: 'Avenida Bolivariana # 32-15, Barranquilla',
    regimen: 'Subsidiado',
    eps: 'Mutual Ser',
    canal_preferido: 'whatsapp',
    notas_clinicas: '11 años. Valoración integral de culminación de infancia y transición a hebiatría.'
  },

  // ==========================================================================
  // CASO 3: ADOLESCENCIA (12 A 17 AÑOS) - Asignados a Dr. Juan Camilo Bermúdez
  // ==========================================================================
  {
    id: 'p3030000-0000-0000-0000-000000000011',
    patient_id: 'p3030000-0000-0000-0000-000000000011',
    nombre: 'Juan José Morales Marín',
    tipo_documento: 'TI',
    documento: '1088123451',
    telefono: '+573133344511',
    email: 'juanjose.morales@gmail.com',
    fecha_nacimiento: '2013-11-04',
    sexo: 'masculino',
    curso_vida: 'adolescencia',
    es_gestante: false,
    doctor_asignado_id: 'd2222222-2222-2222-2222-222222222222',
    doctor_nombre: 'Dr. Juan Camilo Bermúdez Orozco',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Calle 100 # 19-40, Bogotá',
    regimen: 'Contributivo',
    eps: 'Compensar',
    canal_preferido: 'whatsapp',
    notas_clinicas: '13 años. Estadio Tanner II. Tamizaje de presión arterial normal (105/65 mmHg).'
  },
  {
    id: 'p3030000-0000-0000-0000-000000000012',
    patient_id: 'p3030000-0000-0000-0000-000000000012',
    nombre: 'Sofía Restrepo Cardona',
    tipo_documento: 'TI',
    documento: '1087234562',
    telefono: '+573004455612',
    email: 'sofia.restrepo.c@gmail.com',
    fecha_nacimiento: '2012-07-22',
    sexo: 'femenino',
    curso_vida: 'adolescencia',
    es_gestante: false,
    doctor_asignado_id: 'd2222222-2222-2222-2222-222222222222',
    doctor_nombre: 'Dr. Juan Camilo Bermúdez Orozco',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo', 'Báscula Digital'],
    direccion: 'Carrera 25 # 8-60, Manizales',
    regimen: 'Contributivo',
    eps: 'Sura EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: '14 años. Asesoría en derechos sexuales y reproductivos. Tamizaje PHQ-9 negativo.'
  },
  {
    id: 'p3030000-0000-0000-0000-000000000013',
    patient_id: 'p3030000-0000-0000-0000-000000000013',
    nombre: 'Tomás Quintero Gallego',
    tipo_documento: 'TI',
    documento: '1086345673',
    telefono: '+573165566713',
    email: 'tomas.quintero@gmail.com',
    fecha_nacimiento: '2011-03-15',
    sexo: 'masculino',
    curso_vida: 'adolescencia',
    es_gestante: false,
    doctor_asignado_id: 'd2222222-2222-2222-2222-222222222222',
    doctor_nombre: 'Dr. Juan Camilo Bermúdez Orozco',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Avenida El Poblado # 15-20, Medellín',
    regimen: 'Contributivo',
    eps: 'Sanitas EPS',
    canal_preferido: 'sms',
    notas_clinicas: '15 años. Tamizaje de SPA (CRAFFT) negativo. Salud visual Snellen 20/20.'
  },
  {
    id: 'p3030000-0000-0000-0000-000000000014',
    patient_id: 'p3030000-0000-0000-0000-000000000014',
    nombre: 'Camila Andrea Rojas Bernal',
    tipo_documento: 'TI',
    documento: '1085456784',
    telefono: '+573216677814',
    email: 'camila.rojas.b@gmail.com',
    fecha_nacimiento: '2010-09-08',
    sexo: 'femenino',
    curso_vida: 'adolescencia',
    es_gestante: false,
    doctor_asignado_id: 'd2222222-2222-2222-2222-222222222222',
    doctor_nombre: 'Dr. Juan Camilo Bermúdez Orozco',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Calle 48 # 20-31, Ibagué',
    regimen: 'Subsidiado',
    eps: 'Salud Total',
    canal_preferido: 'whatsapp',
    notas_clinicas: '16 años. Asesoría en anticoncepción de larga duración. Refuerzo de toxoide tetánico.'
  },
  {
    id: 'p3030000-0000-0000-0000-000000000015',
    patient_id: 'p3030000-0000-0000-0000-000000000015',
    nombre: 'Sebastián Beltrán Muñoz',
    tipo_documento: 'TI',
    documento: '1084567895',
    telefono: '+573157788915',
    email: 'sebastian.beltran@gmail.com',
    fecha_nacimiento: '2009-01-19',
    sexo: 'masculino',
    curso_vida: 'adolescencia',
    es_gestante: false,
    doctor_asignado_id: 'd2222222-2222-2222-2222-222222222222',
    doctor_nombre: 'Dr. Juan Camilo Bermúdez Orozco',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Carrera 12 # 34-56, Neiva',
    regimen: 'Subsidiado',
    eps: 'Nueva EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: '17 años. Valoración pre-universitaria y orientación vocacional y de hábitos de vida.'
  },

  // ==========================================================================
  // CASO 4: JUVENTUD (18 A 28 AÑOS) - Asignados a Dra. Sandra Milena Castaño
  // ==========================================================================
  {
    id: 'p4040000-0000-0000-0000-000000000016',
    patient_id: 'p4040000-0000-0000-0000-000000000016',
    nombre: 'Andrea Paola Mendoza Cruz',
    tipo_documento: 'CC',
    documento: '1053123451',
    telefono: '+573101122316',
    email: 'andrea.mendoza@gmail.com',
    fecha_nacimiento: '2007-06-14',
    sexo: 'femenino',
    curso_vida: 'juventud',
    es_gestante: false,
    doctor_asignado_id: 'd3333333-3333-3333-3333-333333333333',
    doctor_nombre: 'Dra. Sandra Milena Castaño Ríos',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Carrera 7 # 120-15, Bogotá',
    regimen: 'Contributivo',
    eps: 'Sanitas EPS',
    canal_preferido: 'whatsapp',
    notas_clinicas: '19 años. Citología cervicovaginal 1-1-3 realizada. Método anticonceptivo activo.'
  },
  {
    id: 'p4040000-0000-0000-0000-000000000017',
    patient_id: 'p4040000-0000-0000-0000-000000000017',
    nombre: 'Daniel Esteban Ruiz Ocampo',
    tipo_documento: 'CC',
    documento: '1052234562',
    telefono: '+573022233417',
    email: 'daniel.esteban.r@gmail.com',
    fecha_nacimiento: '2005-02-28',
    sexo: 'masculino',
    curso_vida: 'juventud',
    es_gestante: false,
    doctor_asignado_id: 'd3333333-3333-3333-3333-333333333333',
    doctor_nombre: 'Dra. Sandra Milena Castaño Ríos',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Calle 33 # 65-10, Medellín',
    regimen: 'Contributivo',
    eps: 'Sura EPS',
    canal_preferido: 'sms',
    notas_clinicas: '21 años. Tamizaje de ITS rápido (VIH y Sífilis) no reactivo. Score FINDRISC 4 pts (bajo).'
  },
  {
    id: 'p4040000-0000-0000-0000-000000000018',
    patient_id: 'p4040000-0000-0000-0000-000000000018',
    nombre: 'Daniela Henao Betancur',
    tipo_documento: 'CC',
    documento: '1051345673',
    telefono: '+573143344518',
    email: 'daniela.henao.b@gmail.com',
    fecha_nacimiento: '2003-12-05',
    sexo: 'femenino',
    curso_vida: 'juventud',
    es_gestante: false,
    doctor_asignado_id: 'd3333333-3333-3333-3333-333333333333',
    doctor_nombre: 'Dra. Sandra Milena Castaño Ríos',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo', 'Báscula Digital'],
    direccion: 'Carrera 19 # 3-45, Pereira',
    regimen: 'Contributivo',
    eps: 'Compensar',
    canal_preferido: 'call_ia',
    notas_clinicas: '22 años. Implante subdérmico verificado. Control odontológico y profilaxis realizada.'
  },
  {
    id: 'p4040000-0000-0000-0000-000000000019',
    patient_id: 'p4040000-0000-0000-0000-000000000019',
    nombre: 'Nicolás Cárdenas Sierra',
    tipo_documento: 'CC',
    documento: '1050456784',
    telefono: '+573184455619',
    email: 'nicolas.cardenas@gmail.com',
    fecha_nacimiento: '2001-08-17',
    sexo: 'masculino',
    curso_vida: 'juventud',
    es_gestante: false,
    doctor_asignado_id: 'd3333333-3333-3333-3333-333333333333',
    doctor_nombre: 'Dra. Sandra Milena Castaño Ríos',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Calle 60 # 22-10, Manizales',
    regimen: 'Subsidiado',
    eps: 'Nueva EPS',
    canal_preferido: 'whatsapp',
    notas_clinicas: '25 años. Monitoreo de presión arterial por antecedente familiar de hipertensión precoz.'
  },
  {
    id: 'p4040000-0000-0000-0000-000000000020',
    patient_id: 'p4040000-0000-0000-0000-000000000020',
    nombre: 'Laura Valentina Soto Silva',
    tipo_documento: 'CC',
    documento: '1049567895',
    telefono: '+573225566720',
    email: 'laura.val.soto@gmail.com',
    fecha_nacimiento: '1999-04-23',
    sexo: 'femenino',
    curso_vida: 'juventud',
    es_gestante: false,
    doctor_asignado_id: 'd3333333-3333-3333-3333-333333333333',
    doctor_nombre: 'Dra. Sandra Milena Castaño Ríos',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Avenida Circunvalar # 18-40, Cali',
    regimen: 'Contributivo',
    eps: 'Sura EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: '27 años. Citología negativa para lesión intraepitelial. Asesoría preconcepcional abierta.'
  },

  // ==========================================================================
  // CASO 5: ADULTEZ (29 A 59 AÑOS) - Asignados a Dr. Fernando Rincón
  // ==========================================================================
  {
    id: 'p5050000-0000-0000-0000-000000000021',
    patient_id: 'p5050000-0000-0000-0000-000000000021',
    nombre: 'Carlos Alberto Gómez Pineda',
    tipo_documento: 'CC',
    documento: '71349821',
    telefono: '+573019876543',
    email: 'carlos.gomez@gmail.com',
    fecha_nacimiento: '1968-11-20',
    sexo: 'masculino',
    curso_vida: 'adultez',
    es_gestante: false,
    es_diabetico: true,
    es_hipertenso: true,
    doctor_asignado_id: 'd4444444-4444-4444-4444-444444444444',
    doctor_nombre: 'Dr. Fernando Rincón Velásquez',
    dispositivos_caseros: ['Glucómetro Accu-Chek Instant', 'Tensiómetro de Brazo Beurer'],
    direccion: 'Calle 67 # 89-10, Bogotá',
    regimen: 'Contributivo',
    eps: 'Sanitas EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: '57 años. HTA + DM2. En manejo con Metformina y Losartán. HbA1c 8.2%. PSA y FIT vigentes.'
  },
  {
    id: 'p5050000-0000-0000-0000-000000000022',
    patient_id: 'p5050000-0000-0000-0000-000000000022',
    nombre: 'Claudia Patricia Osorio Ríos',
    tipo_documento: 'CC',
    documento: '43567892',
    telefono: '+573112233422',
    email: 'claudia.osorio@gmail.com',
    fecha_nacimiento: '1984-07-11',
    sexo: 'femenino',
    curso_vida: 'adultez',
    es_gestante: false,
    doctor_asignado_id: 'd4444444-4444-4444-4444-444444444444',
    doctor_nombre: 'Dr. Fernando Rincón Velásquez',
    dispositivos_caseros: ['Tensiómetro Digital Omron'],
    direccion: 'Carrera 43A # 1-50, Medellín',
    regimen: 'Contributivo',
    eps: 'Sura EPS',
    canal_preferido: 'whatsapp',
    notas_clinicas: '42 años. Examen clínico de mama anual vigente. Prueba ADN-VPH negativa (próxima en 5 años).'
  },
  {
    id: 'p5050000-0000-0000-0000-000000000023',
    patient_id: 'p5050000-0000-0000-0000-000000000023',
    nombre: 'Jorge Eliécer Mejía Tabares',
    tipo_documento: 'CC',
    documento: '10234567',
    telefono: '+573153344523',
    email: 'jorge.mejia.t@gmail.com',
    fecha_nacimiento: '1974-03-29',
    sexo: 'masculino',
    curso_vida: 'adultez',
    es_gestante: false,
    es_hipertenso: true,
    doctor_asignado_id: 'd4444444-4444-4444-4444-444444444444',
    doctor_nombre: 'Dr. Fernando Rincón Velásquez',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Calle 12 # 4-20, Cali',
    regimen: 'Contributivo',
    eps: 'Coosalud',
    canal_preferido: 'call_ia',
    notas_clinicas: '52 años. Tamizaje de cáncer de próstata (PSA sérico: 1.2 ng/mL) y FIT de colon negativo.'
  },
  {
    id: 'p5050000-0000-0000-0000-000000000024',
    patient_id: 'p5050000-0000-0000-0000-000000000024',
    nombre: 'Diana Marcela Toro Agudelo',
    tipo_documento: 'CC',
    documento: '32456789',
    telefono: '+573174455624',
    email: 'diana.toro@gmail.com',
    fecha_nacimiento: '1992-10-15',
    sexo: 'femenino',
    curso_vida: 'adultez',
    es_gestante: false,
    doctor_asignado_id: 'd4444444-4444-4444-4444-444444444444',
    doctor_nombre: 'Dr. Fernando Rincón Velásquez',
    dispositivos_caseros: ['Tensiómetro Digital'],
    direccion: 'Avenida Santander # 65-12, Manizales',
    regimen: 'Contributivo',
    eps: 'Sanitas EPS',
    canal_preferido: 'whatsapp',
    notas_clinicas: '34 años. ADN-VPH triaje en curso. Evaluación de riesgo metabólico FINDRISC normal.'
  },
  {
    id: 'p5050000-0000-0000-0000-000000000025',
    patient_id: 'p5050000-0000-0000-0000-000000000025',
    nombre: 'Ricardo Antonio Marín Serna',
    tipo_documento: 'CC',
    documento: '98567123',
    telefono: '+573195566725',
    email: 'ricardo.marin@gmail.com',
    fecha_nacimiento: '1978-01-08',
    sexo: 'masculino',
    curso_vida: 'adultez',
    es_gestante: false,
    es_hipertenso: true,
    es_diabetico: true,
    doctor_asignado_id: 'd4444444-4444-4444-4444-444444444444',
    doctor_nombre: 'Dr. Fernando Rincón Velásquez',
    dispositivos_caseros: ['Tensiómetro Digital', 'Glucómetro Accu-Chek Guide'],
    direccion: 'Transversal 15 # 45-80, Pereira',
    regimen: 'Subsidiado',
    eps: 'Nueva EPS',
    canal_preferido: 'sms',
    notas_clinicas: '48 años. Síndrome metabólico. Telemonitoreo estricto de cifras tensionales y glucometría.'
  },

  // ==========================================================================
  // CASO 6: VEJEZ (60 AÑOS O MÁS) - Asignados a Dra. Beatriz Elena Arango
  // ==========================================================================
  {
    id: 'p6060000-0000-0000-0000-000000000026',
    patient_id: 'p6060000-0000-0000-0000-000000000026',
    nombre: 'Esperanza Duarte de Castro',
    tipo_documento: 'CC',
    documento: '28493012',
    telefono: '+573152239988',
    email: 'esperanza.duarte@gmail.com',
    fecha_nacimiento: '1952-03-08',
    sexo: 'femenino',
    curso_vida: 'vejez',
    es_gestante: false,
    es_hipertenso: true,
    doctor_asignado_id: 'd5555555-5555-5555-5555-555555555555',
    doctor_nombre: 'Dra. Beatriz Elena Arango Salazar',
    dispositivos_caseros: ['Tensiómetro Digital Automático', 'Oxímetro de Pulso'],
    direccion: 'Avenida Santander # 54-12, Manizales',
    regimen: 'Subsidiado',
    eps: 'Nueva EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: '74 años. Índice de Barthel 95/100 (independiente). Tamizaje de caídas TUG 11 seg. Mamografía al día.'
  },
  {
    id: 'p6060000-0000-0000-0000-000000000027',
    patient_id: 'p6060000-0000-0000-0000-000000000027',
    nombre: 'Bernardo de Jesús Hoyos Flórez',
    tipo_documento: 'CC',
    documento: '4321987',
    telefono: '+573103344527',
    email: 'bernardo.hoyos@gmail.com',
    fecha_nacimiento: '1958-09-24',
    sexo: 'masculino',
    curso_vida: 'vejez',
    es_gestante: false,
    es_hipertenso: true,
    es_diabetico: true,
    doctor_asignado_id: 'd5555555-5555-5555-5555-555555555555',
    doctor_nombre: 'Dra. Beatriz Elena Arango Salazar',
    dispositivos_caseros: ['Tensiómetro Digital', 'Glucómetro OneTouch'],
    direccion: 'Calle 52 # 42-18, Medellín',
    regimen: 'Contributivo',
    eps: 'Sura EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: '68 años. Minimental 28/30. Monitoreo domiciliario de PAM y glucosa posprandial. Vacunación Influenza ok.'
  },
  {
    id: 'p6060000-0000-0000-0000-000000000028',
    patient_id: 'p6060000-0000-0000-0000-000000000028',
    nombre: 'Cecilia Echeverri de Ramírez',
    tipo_documento: 'CC',
    documento: '24567812',
    telefono: '+573124455628',
    email: 'cecilia.echeverri@gmail.com',
    fecha_nacimiento: '1954-12-16',
    sexo: 'femenino',
    curso_vida: 'vejez',
    es_gestante: false,
    doctor_asignado_id: 'd5555555-5555-5555-5555-555555555555',
    doctor_nombre: 'Dra. Beatriz Elena Arango Salazar',
    dispositivos_caseros: ['Tensiómetro Digital', 'Oxímetro de Pulso'],
    direccion: 'Carrera 80 # 30-22, Bogotá',
    regimen: 'Contributivo',
    eps: 'Compensar',
    canal_preferido: 'whatsapp',
    notas_clinicas: '72 años. Escala de depresión geriátrica Yesavage 2/15 (normal). Salud oral: adaptación protésica.'
  },
  {
    id: 'p6060000-0000-0000-0000-000000000029',
    patient_id: 'p6060000-0000-0000-0000-000000000029',
    nombre: 'Humberto Zuluaga Rendón',
    tipo_documento: 'CC',
    documento: '3890123',
    telefono: '+573165566729',
    email: 'humberto.zuluaga@gmail.com',
    fecha_nacimiento: '1945-05-02',
    sexo: 'masculino',
    curso_vida: 'vejez',
    es_gestante: false,
    es_hipertenso: true,
    doctor_asignado_id: 'd5555555-5555-5555-5555-555555555555',
    doctor_nombre: 'Dra. Beatriz Elena Arango Salazar',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Calle 10 # 8-30, Pereira',
    regimen: 'Subsidiado',
    eps: 'Salud Total',
    canal_preferido: 'call_ia',
    notas_clinicas: '81 años. Evaluación de fragilidad FRAIL (1 criterio: pre-frágil). Programa de prevención de caídas.'
  },
  {
    id: 'p6060000-0000-0000-0000-000000000030',
    patient_id: 'p6060000-0000-0000-0000-000000000030',
    nombre: 'Teresa de Jesús Correa Soto',
    tipo_documento: 'CC',
    documento: '21345678',
    telefono: '+573206677830',
    email: 'teresa.correa@gmail.com',
    fecha_nacimiento: '1961-08-31',
    sexo: 'femenino',
    curso_vida: 'vejez',
    es_gestante: false,
    doctor_asignado_id: 'd5555555-5555-5555-5555-555555555555',
    doctor_nombre: 'Dra. Beatriz Elena Arango Salazar',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Carrera 14 # 25-10, Armenia',
    regimen: 'Contributivo',
    eps: 'Sanitas EPS',
    canal_preferido: 'whatsapp',
    notas_clinicas: '65 años. Transición reciente a curso de Vejez. Mamografía bilateral y FIT colorrectal coordinados.'
  },

  // ==========================================================================
  // CASO 7: RUTA MATERNO PERINATAL (RIAMP) - Asignados a Dr. Mauricio Villa
  // ==========================================================================
  {
    id: 'p7070000-0000-0000-0000-000000000031',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    nombre: 'Valentina Restrepo Morales',
    tipo_documento: 'CC',
    documento: '1020485923',
    telefono: '+573124567890',
    email: 'valentina.restrepo@gmail.com',
    fecha_nacimiento: '1998-05-14',
    sexo: 'femenino',
    curso_vida: 'materno_perinatal',
    es_gestante: true,
    semana_gestacional: 28,
    es_hipertenso: true,
    doctor_asignado_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_nombre: 'Dr. Mauricio Villa Cardona',
    dispositivos_caseros: ['Tensiómetro Digital Omron M3', 'Báscula Digital'],
    direccion: 'Carrera 45 # 12-34, Medellín',
    regimen: 'Contributivo',
    eps: 'Sura EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: 'Gestante 28 semanas. Alto riesgo obstétrico por cifras de preeclampsia. Monitoreo domiciliario de PAM.'
  },
  {
    id: 'p7070000-0000-0000-0000-000000000032',
    patient_id: 'p7070000-0000-0000-0000-000000000032',
    nombre: 'Yuliana Marcela Cardona Vélez',
    tipo_documento: 'CC',
    documento: '1017894561',
    telefono: '+573147788932',
    email: 'yuliana.cardona@gmail.com',
    fecha_nacimiento: '2002-09-03',
    sexo: 'femenino',
    curso_vida: 'materno_perinatal',
    es_gestante: true,
    semana_gestacional: 12,
    doctor_asignado_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_nombre: 'Dr. Mauricio Villa Cardona',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Calle 80 # 70-15, Bogotá',
    regimen: 'Contributivo',
    eps: 'Sanitas EPS',
    canal_preferido: 'whatsapp',
    notas_clinicas: '12 semanas. En ventana de ecografía genética 11-13.6 sem. Suplementación con ácido fólico y calcio iniciada.'
  },
  {
    id: 'p7070000-0000-0000-0000-000000000033',
    patient_id: 'p7070000-0000-0000-0000-000000000033',
    nombre: 'Manuela Cardona Hincapié',
    tipo_documento: 'CC',
    documento: '1036456782',
    telefono: '+573018899033',
    email: 'manuela.cardona@gmail.com',
    fecha_nacimiento: '1995-11-27',
    sexo: 'femenino',
    curso_vida: 'materno_perinatal',
    es_gestante: true,
    semana_gestacional: 21,
    doctor_asignado_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_nombre: 'Dr. Mauricio Villa Cardona',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Avenida Nutibara # 72-10, Medellín',
    regimen: 'Contributivo',
    eps: 'Sura EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: '21 semanas. Ecografía morfológica de detalle anatómico fetal programada para esta semana.'
  },
  {
    id: 'p7070000-0000-0000-0000-000000000034',
    patient_id: 'p7070000-0000-0000-0000-000000000034',
    nombre: 'Estefanía Arias Quintero',
    tipo_documento: 'CC',
    documento: '1054321983',
    telefono: '+573189900134',
    email: 'estefania.arias@gmail.com',
    fecha_nacimiento: '1993-02-18',
    sexo: 'femenino',
    curso_vida: 'materno_perinatal',
    es_gestante: true,
    semana_gestacional: 36,
    doctor_asignado_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_nombre: 'Dr. Mauricio Villa Cardona',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo'],
    direccion: 'Carrera 23 # 12-40, Manizales',
    regimen: 'Subsidiado',
    eps: 'Nueva EPS',
    canal_preferido: 'call_ia',
    notas_clinicas: '36 semanas. Tamizaje de estreptococo grupo B (EGB) tomado. Monitoreo semanal de trabajo de parto.'
  },
  {
    id: 'p7070000-0000-0000-0000-000000000035',
    patient_id: 'p7070000-0000-0000-0000-000000000035',
    nombre: 'Marcela Cano Castañeda',
    tipo_documento: 'CC',
    documento: '1024567894',
    telefono: '+573221122335',
    email: 'marcela.cano@gmail.com',
    fecha_nacimiento: '1997-06-09',
    sexo: 'femenino',
    curso_vida: 'materno_perinatal',
    es_gestante: false,
    semana_gestacional: null,
    es_puerpera: true,
    dias_puerperio: 8,
    doctor_asignado_id: 'd6666666-6666-6666-6666-666666666666',
    doctor_nombre: 'Dr. Mauricio Villa Cardona',
    dispositivos_caseros: ['Tensiómetro Digital de Brazo', 'Termómetro Infrarrojo'],
    direccion: 'Calle 18 # 5-60, Cali',
    regimen: 'Contributivo',
    eps: 'Coosalud',
    canal_preferido: 'whatsapp',
    notas_clinicas: 'Puerperio mediato día 8. Lactancia materna exclusiva establecida. Involución uterina adecuada.'
  }
];

// Semilla de mediciones históricas iniciales
const SEED_MEASUREMENTS = [
  // Curva de Valentina (Gestante - Riesgo Preeclampsia)
  {
    id: 'meas-001',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    tipo_medicion: 'presion_arterial',
    presion_sistolica: 118,
    presion_diastolica: 76,
    pulso_bpm: 78,
    pam_calculada: 90,
    dispositivo_modelo: 'Tensiómetro Digital Omron M3',
    alerta_generada: false,
    nivel_alerta: 'normal',
    medido_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'meas-002',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    tipo_medicion: 'presion_arterial',
    presion_sistolica: 124,
    presion_diastolica: 82,
    pulso_bpm: 82,
    pam_calculada: 96,
    dispositivo_modelo: 'Tensiómetro Digital Omron M3',
    alerta_generada: false,
    nivel_alerta: 'normal',
    medido_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'meas-003',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    tipo_medicion: 'presion_arterial',
    presion_sistolica: 162,
    presion_diastolica: 112,
    pulso_bpm: 96,
    pam_calculada: 128.7,
    dispositivo_modelo: 'Tensiómetro Digital Omron M3',
    alerta_generada: true,
    nivel_alerta: 'critica_roja',
    medido_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  // Curva de Carlos Gómez (Adulto HTA + DM2)
  {
    id: 'meas-004',
    patient_id: 'p5050000-0000-0000-0000-000000000021',
    tipo_medicion: 'glucometria',
    glucosa_mgdl: 135,
    momento_glucometria: 'ayunas',
    dispositivo_modelo: 'Accu-Chek Instant',
    alerta_generada: false,
    nivel_alerta: 'normal',
    medido_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'meas-005',
    patient_id: 'p5050000-0000-0000-0000-000000000021',
    tipo_medicion: 'glucometria',
    glucosa_mgdl: 195,
    momento_glucometria: 'postprandial_2h',
    dispositivo_modelo: 'Accu-Chek Instant',
    alerta_generada: true,
    nivel_alerta: 'alerta_amarilla',
    medido_at: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: 'meas-006',
    patient_id: 'p5050000-0000-0000-0000-000000000021',
    tipo_medicion: 'glucometria',
    glucosa_mgdl: 58,
    momento_glucometria: 'ayunas',
    dispositivo_modelo: 'Accu-Chek Instant',
    alerta_generada: true,
    nivel_alerta: 'critica_roja',
    medido_at: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  // Esperanza Duarte (Adulta Mayor)
  {
    id: 'meas-007',
    patient_id: 'p6060000-0000-0000-0000-000000000026',
    tipo_medicion: 'presion_arterial',
    presion_sistolica: 148,
    presion_diastolica: 92,
    pulso_bpm: 72,
    pam_calculada: 110.7,
    dispositivo_modelo: 'Tensiómetro Digital Automático',
    alerta_generada: true,
    nivel_alerta: 'alerta_amarilla',
    medido_at: new Date(Date.now() - 3600000 * 8).toISOString()
  }
];

// Semilla de alertas clínicas iniciales
const SEED_ALERTS = [
  {
    id: 'alert-001',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    measurement_id: 'meas-003',
    tipo_alerta: 'preeclampsia_severa_crisis',
    severidad: 'critica_roja',
    titulo: '🚨 CRISIS HIPERTENSIVA DEL EMBARAZO (Preeclampsia Severa)',
    descripcion: 'Gestante en semana 28 con cifras tensionales de 162/112 mmHg (PAM 128.7). Riesgo inminente materno perinatal según Código Azul.',
    criterio_res_3280: 'Res. 3280 RIAMP Pág. 293 (Código Azul Obstétrico - Criterios de Severidad)',
    estado: 'contacto_ia_iniciado',
    ia_contact_disparado: true,
    ia_contact_id: 'evid-001',
    notas_enfermeria: 'Agente IA realizó llamada de triage. Paciente refiere cefalea holocraneana leve. Dr. Mauricio Villa ordenó valoración urgente en clínica de alta complejidad.',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'alert-002',
    patient_id: 'p5050000-0000-0000-0000-000000000021',
    measurement_id: 'meas-006',
    tipo_alerta: 'hipoglucemia_severa',
    severidad: 'critica_roja',
    titulo: '🚨 HIPOGLUCEMIA CLÍNICA AGUDA (58 mg/dL)',
    descripcion: 'Paciente diabético con glucometría en ayunas de 58 mg/dL. Riesgo agudo de neuroglucopenia.',
    criterio_res_3280: 'Res. 3280 Pág. 144 (Manejo Agudo en DM)',
    estado: 'intervenida_enfermeria',
    ia_contact_disparado: true,
    ia_contact_id: 'evid-002',
    notas_enfermeria: 'Agente IA instruyó toma de carbohidrato simple. A los 20 min el paciente registró 98 mg/dL. Dr. Fernando Rincón reajustó dosis de metformina.',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

// Semilla de evidencias de contacto IA iniciales
const SEED_EVIDENCE = [
  {
    id: 'evid-001',
    patient_id: 'p7070000-0000-0000-0000-000000000031',
    tipo_canal: 'call_ia',
    duracion_segundos: 142,
    resultado: 'completada_exitosa',
    resumen: 'Llamada automática por crisis hipertensiva (162/112 mmHg). Gestante atendió llamada, refiere visión borrosa leve y dolor de cabeza.',
    transcripcion: 'AGENTE SADI: "Hola Valentina, te habla el Agente de Telemonitoreo de SADI y de tu IPS. Registramos que tu tensiómetro reportó 162/112 mmHg. Por estar en tu semana 28, esto requiere atención inmediata. ¿Sientes dolor de cabeza, lucecitas en los ojos o zumbidos?" \nPACIENTE: "Sí, me siento un poco mareada y me duele la cabeza desde hace dos horas." \nAGENTE SADI: "Por favor siéntate, no tomes ningún medicamento no formulado. Ya le notificamos al Dr. Mauricio Villa y al equipo de urgencias obstétricas. Una ambulancia o familiar debe acompañarte ahora mismo."',
    audio_simulado_url: '/audio-samples/call_preeclampsia_sample.mp3',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'evid-002',
    patient_id: 'p5050000-0000-0000-0000-000000000021',
    tipo_canal: 'call_ia',
    duracion_segundos: 98,
    resultado: 'completada_exitosa',
    resumen: 'Llamada de alerta por hipoglucemia (58 mg/dL). Paciente fue asistido en regla de los 15g de glucosa.',
    transcripcion: 'AGENTE SADI: "Hola Carlos, tu glucómetro reportó 58 mg/dL en ayunas. Tienes una baja de azúcar que debemos corregir ya. ¿Tienes temblor o sudoración fría?" \nPACIENTE: "Sí, tengo bastante temblor." \nAGENTE SADI: "Toma de inmediato medio vaso de jugo o agua con dos cucharadas de azúcar. En 15 minutos vuelve a tomarte la muestra. Tu internista Dr. Fernando Rincón ya recibió tu reporte."',
    audio_simulado_url: '/audio-samples/call_hipoglucemia_sample.mp3',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

// Helper para leer/escribir en localStorage
const getLocal = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};

const setLocal = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Error guardando en localStorage:', e);
  }
};

export const telemonitoringService = {
  // Obtener todos los doctores
  async getDoctors() {
    try {
      const { data, error } = await supabase.from('staff').select('*');
      if (!error && data && data.length > 0) return data;
    } catch (e) {
      // fallback
    }
    return SEED_DOCTORS_3280;
  },

  // Obtener lista completa de pacientes
  async getPatients() {
    try {
      const { data, error } = await supabase.from('patients').select('*');
      if (!error && data && data.length > 0) {
        return data.map(p => {
          const birthdate = p.birthdate || p.birth_date || p.fecha_nacimiento;
          let curso = p.curso_vida || 'adultez';
          if (birthdate) {
            const b = new Date(birthdate);
            if (!isNaN(b.getTime())) {
              const now = new Date();
              let age = now.getFullYear() - b.getFullYear();
              const m = now.getMonth() - b.getMonth();
              if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
              if (age <= 5) curso = 'primera_infancia';
              else if (age <= 11) curso = 'infancia';
              else if (age <= 17) curso = 'adolescencia';
              else if (age <= 28) curso = 'juventud';
              else if (age <= 59) curso = 'adultez';
              else curso = 'vejez';
            }
          }
          if (p.program?.toLowerCase().includes('embarazo') || p.program?.toLowerCase().includes('materno') || p.es_gestante) {
            curso = 'materno_perinatal';
          }

          const assignedEmail = getAssignedDoctorEmailForPatient(p);
          const docInfoMap = {
            'paola.gil@sadi.med.co': { id: 'd1111111-1111-1111-1111-111111111111', name: 'Dra. Paola Andrea Gil Restrepo', email: 'paola.gil@sadi.med.co' },
            'juan.bermudez@sadi.med.co': { id: 'd2222222-2222-2222-2222-222222222222', name: 'Dr. Juan Camilo Bermúdez Orozco', email: 'juan.bermudez@sadi.med.co' },
            'sandra.castano@sadi.med.co': { id: 'd3333333-3333-3333-3333-333333333333', name: 'Dra. Sandra Milena Castaño Ríos', email: 'sandra.castano@sadi.med.co' },
            'fernando.rincon@sadi.med.co': { id: 'd4444444-4444-4444-4444-444444444444', name: 'Dr. Fernando Rincón Velásquez', email: 'fernando.rincon@sadi.med.co' },
            'beatriz.arango@sadi.med.co': { id: 'd5555555-5555-5555-5555-555555555555', name: 'Dra. Beatriz Elena Arango Salazar', email: 'beatriz.arango@sadi.med.co' },
            'mauricio.villa@sadi.med.co': { id: 'd6666666-6666-6666-6666-666666666666', name: 'Dr. Mauricio Villa Cardona', email: 'mauricio.villa@sadi.med.co' },
            'natalia.ocampo@sadi.med.co': { id: 'd7777777-7777-7777-7777-777777777777', name: 'Dra. Natalia Ocampo Henao', email: 'natalia.ocampo@sadi.med.co' },
            'carlos.salazar@sadi.med.co': { id: 'd8888888-8888-8888-8888-888888888888', name: 'Dr. Carlos Eduardo Salazar Montoya', email: 'carlos.salazar@sadi.med.co' },
            'alejandro.morales@sadi.med.co': { id: 'd0100000-0000-0000-0000-000000000001', name: 'Dr. Alejandro Morales Restrepo', email: 'alejandro.morales@sadi.med.co' },
            'valentina.gomez@sadi.med.co': { id: 'd0200000-0000-0000-0000-000000000002', name: 'Dra. Valentina Gómez Salazar', email: 'valentina.gomez@sadi.med.co' },
            'daniel.vargas@sadi.med.co': { id: 'd0300000-0000-0000-0000-000000000003', name: 'Dr. Daniel Felipe Vargas Ruiz', email: 'daniel.vargas@sadi.med.co' }
          };

          const assignedDoc = docInfoMap[assignedEmail] || docInfoMap['alejandro.morales@sadi.med.co'];

          return {
            ...p,
            id: p.patient_id || p.id,
            nombre: p.name || p.nombre,
            documento: p.document || p.documento,
            tipo_documento: p.tipo_documento || 'CC',
            telefono: p.phone || p.telefono,
            fecha_nacimiento: birthdate,
            curso_vida: curso,
            doctor_asignado_id: assignedDoc.id,
            doctor_nombre: assignedDoc.name,
            doctor_email: assignedDoc.email,
            dispositivos_caseros: p.program?.toLowerCase().includes('hipertension')
              ? ['Tensiómetro Digital de Brazo']
              : p.program?.toLowerCase().includes('asma')
              ? ['Flujómetro Digital']
              : ['Equipo de Telemonitoreo 3280'],
            notas_clinicas: p.program ? `Programa activo: ${p.program}. Seguimiento Res. 3280.` : 'Seguimiento por curso de vida Res. 3280.',
            regimen: 'Contributivo',
            eps: 'EPS SADI Salud'
          };
        });
      }
    } catch (e) {
      // Fallback
    }
    const local = getLocal(LOCAL_STORAGE_KEY_PATIENTS, null);
    if (local && local.length >= 4) return local;
    return SEED_PATIENTS_3280;
  },

  // Obtener un paciente específico por ID
  async getPatientById(patientId) {
    const list = await this.getPatients();
    return list.find(p => p.id === patientId || p.patient_id === patientId) || list[0];
  },

  // Obtener mediciones de un paciente o de todos
  async getMeasurements(patientId = null) {
    let measurements = getLocal(LOCAL_STORAGE_KEY_MEASUREMENTS, SEED_MEASUREMENTS);
    if (patientId) {
      measurements = measurements.filter(m => m.patient_id === patientId);
    }
    return measurements.sort((a, b) => new Date(b.medido_at) - new Date(a.medido_at));
  },

  // Registrar nueva medición tomada en equipo casero
  async recordHomeMeasurement({
    patient_id,
    tipo_medicion,
    presion_sistolica = null,
    presion_diastolica = null,
    pulso_bpm = null,
    glucometria = null,
    momento_glucometria = 'ayunas',
    spo2 = null,
    ritmo_cardiaco = null,
    dispositivo_modelo = 'Equipo Casero Bluetooth / Manual',
    notas_paciente = ''
  }) {
    const patient = await this.getPatientById(patient_id);
    
    // Evaluar reglas y umbrales de la Res. 3280
    const evaluation = evaluateVitalSigns3280({
      presion_sistolica,
      presion_diastolica,
      glucometria,
      momento_glucometria,
      spo2,
      ritmo_cardiaco,
      es_gestante: patient?.es_gestante || false,
      semana_gestacional: patient?.semana_gestacional || null,
      es_hipertenso: patient?.es_hipertenso || false,
      es_diabetico: patient?.es_diabetico || false
    });

    const newMeasId = 'meas-' + Date.now();
    const newMeasurement = {
      id: newMeasId,
      patient_id,
      tipo_medicion,
      presion_sistolica: Number(presion_sistolica) || null,
      presion_diastolica: Number(presion_diastolica) || null,
      pulso_bpm: Number(pulso_bpm) || null,
      pam_calculada: evaluation.pam,
      glucosa_mgdl: Number(glucometria) || null,
      momento_glucometria,
      spo2: Number(spo2) || null,
      ritmo_cardiaco: Number(ritmo_cardiaco) || null,
      dispositivo_modelo,
      notas_paciente,
      alerta_generada: evaluation.hasAlert,
      nivel_alerta: evaluation.maxSeverity,
      medido_at: new Date().toISOString()
    };

    // Guardar medición local
    const currentMeasurements = getLocal(LOCAL_STORAGE_KEY_MEASUREMENTS, SEED_MEASUREMENTS);
    setLocal(LOCAL_STORAGE_KEY_MEASUREMENTS, [newMeasurement, ...currentMeasurements]);

    let generatedAlert = null;

    // Si se violó un umbral clínico, generar alerta y disparar agente IA
    if (evaluation.hasAlert) {
      const topAlert = evaluation.alerts[0];
      const newAlertId = 'alert-' + Date.now();
      const evidenceId = 'evid-' + Date.now();

      // Guion clínico personalizado
      const aiPlan = generateAIAgentScript({
        patient,
        alerta: topAlert
      });

      generatedAlert = {
        id: newAlertId,
        patient_id,
        measurement_id: newMeasId,
        tipo_alerta: topAlert.tipo,
        severidad: topAlert.severidad,
        titulo: topAlert.titulo,
        descripcion: topAlert.mensaje,
        criterio_res_3280: topAlert.criterio_res_3280,
        estado: 'contacto_ia_iniciado',
        ia_contact_disparado: true,
        ia_contact_id: evidenceId,
        notas_enfermeria: `Disparado agente IA de seguimiento a las ${new Date().toLocaleTimeString()}. Canal: ${aiPlan.canalRecomendado.toUpperCase()}. Objetivo: ${aiPlan.objetivo}`,
        created_at: new Date().toISOString()
      };

      const currentAlerts = getLocal(LOCAL_STORAGE_KEY_ALERTS, SEED_ALERTS);
      setLocal(LOCAL_STORAGE_KEY_ALERTS, [generatedAlert, ...currentAlerts]);

      // Guardar evidencia de la interacción del agente IA
      const newEvidence = {
        id: evidenceId,
        patient_id,
        tipo_canal: aiPlan.canalRecomendado,
        duracion_segundos: Math.floor(60 + Math.random() * 80),
        resultado: 'completada_exitosa',
        resumen: `Llamada automática por ${topAlert.titulo}. Guión: ${aiPlan.objetivo}.`,
        transcripcion: `AGENTE SADI: ${aiPlan.guionLlamada[0]}\nPACIENTE: "Sí, acabo de tomarme la muestra porque no me sentía muy bien."\nAGENTE SADI: ${aiPlan.guionLlamada[1]}\nPACIENTE: "Entendido, muchas gracias por estar pendientes de mí."\nAGENTE SADI: ${aiPlan.guionLlamada[2]}`,
        audio_simulado_url: '/audio-samples/call_alert_simulation.mp3',
        created_at: new Date().toISOString()
      };

      const currentEvidence = getLocal(LOCAL_STORAGE_KEY_EVIDENCE, SEED_EVIDENCE);
      setLocal(LOCAL_STORAGE_KEY_EVIDENCE, [newEvidence, ...currentEvidence]);
    }

    return {
      measurement: newMeasurement,
      evaluation,
      alert: generatedAlert
    };
  },

  // Obtener alertas activas
  async getAlerts(patientId = null) {
    let alerts = getLocal(LOCAL_STORAGE_KEY_ALERTS, SEED_ALERTS);
    if (patientId) {
      alerts = alerts.filter(a => a.patient_id === patientId);
    }
    return alerts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  // Actualizar nota o estado de enfermería en una alerta
  async updateAlertStatus(alertId, newStatus, notasEnfermeria = '') {
    const alerts = getLocal(LOCAL_STORAGE_KEY_ALERTS, SEED_ALERTS);
    const updated = alerts.map(a => {
      if (a.id === alertId) {
        return {
          ...a,
          estado: newStatus,
          notas_enfermeria: notasEnfermeria || a.notas_enfermeria,
          updated_at: new Date().toISOString()
        };
      }
      return a;
    });
    setLocal(LOCAL_STORAGE_KEY_ALERTS, updated);
    return updated.find(a => a.id === alertId);
  },

  // Obtener evidencias de contacto del agente IA
  async getEvidence(patientId = null) {
    let evidence = getLocal(LOCAL_STORAGE_KEY_EVIDENCE, SEED_EVIDENCE);
    if (patientId) {
      evidence = evidence.filter(e => e.patient_id === patientId);
    }
    return evidence.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
};
