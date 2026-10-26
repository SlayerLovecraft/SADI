export const normalizeText = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

export const calculateAgeFromBirthdate = (birthdate) => {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) {
    age--;
  }
  return age;
};

export const getCursoVidaFromPatient = (patient) => {
  if (!patient) return 'adultez';
  if (patient.curso_vida) return patient.curso_vida;
  if (patient.es_gestante === true) return 'materno_perinatal';

  const pProg = (patient.program || '').toLowerCase();
  if (pProg.includes('embarazo') || pProg.includes('materno') || pProg.includes('gestan') || pProg.includes('preeclampsia')) {
    return 'materno_perinatal';
  }

  const age = calculateAgeFromBirthdate(patient.birthdate || patient.fecha_nacimiento);
  if (age === null) return 'adultez';

  if (age <= 5) return 'primera_infancia';
  if (age <= 11) return 'infancia';
  if (age <= 17) return 'adolescencia';
  if (age <= 28) return 'juventud';
  if (age <= 59) return 'adultez';
  return 'vejez';
};

export const GENERAL_DOCTORS = [
  {
    id: 'd0100000-0000-0000-0000-000000000001',
    name: 'Dr. Alejandro Morales Restrepo',
    email: 'alejandro.morales@sadi.med.co',
    staff_email: 'doctor9@sadi.com.co',
    specialty: 'Medicina General (Admisión & Consulta Externa)'
  },
  {
    id: 'd0200000-0000-0000-0000-000000000002',
    name: 'Dra. Valentina Gómez Salazar',
    email: 'valentina.gomez@sadi.med.co',
    staff_email: 'doctor10@sadi.com.co',
    specialty: 'Medicina General (Admisión & Triage Clínico)'
  },
  {
    id: 'd0300000-0000-0000-0000-000000000003',
    name: 'Dr. Daniel Felipe Vargas Ruiz',
    email: 'daniel.vargas@sadi.med.co',
    staff_email: 'doctor11@sadi.com.co',
    specialty: 'Medicina General (Admisión & Demanda Inducida)'
  }
];

export const GENERAL_DOCTORS_EMAILS = GENERAL_DOCTORS.map(d => d.email);

export const isPatientGeneralCharacter = (patient) => {
  if (!patient) return true;
  if (patient.es_general === true) return true;

  const prog = normalizeText(patient.program || patient.programa || '');
  if (!prog || prog === 'sin programa' || prog === 'general' || 
      prog.includes('consulta general') || prog.includes('medicina general') || 
      prog.includes('admision') || prog.includes('triage') || prog.includes('atencion primaria')) {
    return true;
  }

  // Si tiene un programa explícito de la 3280 o patología específica, no es de carácter general
  const is3280 = prog.includes('infan') || prog.includes('crecimiento') || prog.includes('adolesc') || 
                 prog.includes('sexual') || prog.includes('reprod') || prog.includes('hiperten') || 
                 prog.includes('cardio') || prog.includes('diabet') || prog.includes('vejez') || 
                 prog.includes('geriatr') || prog.includes('materno') || prog.includes('prenatal') || 
                 prog.includes('gestan') || prog.includes('oral') || prog.includes('odont') || 
                 prog.includes('onco') || prog.includes('cancer') || prog.includes('tamizaje') ||
                 prog.includes('asma') || prog.includes('3280');

  return !is3280;
};

export const getGeneralDoctorForPatient = (patient) => {
  if (!patient) return GENERAL_DOCTORS_EMAILS[0];

  const docId = String(patient.doctor_asignado_id || patient.doctor_id || '');
  if (docId === 'd0100000-0000-0000-0000-000000000001') return 'alejandro.morales@sadi.med.co';
  if (docId === 'd0200000-0000-0000-0000-000000000002') return 'valentina.gomez@sadi.med.co';
  if (docId === 'd0300000-0000-0000-0000-000000000003') return 'daniel.vargas@sadi.med.co';

  // Distribución balanceada entre los 3 médicos generales
  const key = String(patient.document || patient.documento || patient.patient_id || patient.id || '');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % GENERAL_DOCTORS_EMAILS.length;
  return GENERAL_DOCTORS_EMAILS[idx];
};

/**
 * DETERMINACIÓN EXCLUSIVA Y DETERMINÍSTICA DE DOCTOR ASIGNADO
 * Regla: 1 Paciente pertenece a EXACTAMENTE 1 Doctor.
 * - Si es de carácter general: Se asigna a uno de los 3 Médicos Generales.
 * - Si ingresa/pertenece a un programa de la Res. 3280: Se asigna al especialista según edad/área clínica.
 */
export const getAssignedDoctorEmailForPatient = (patient) => {
  if (!patient) return null;

  // 1. Si el paciente ya tiene un ID explícito de doctor asignado
  if (patient.doctor_asignado_id || patient.doctor_id) {
    const targetId = patient.doctor_asignado_id || patient.doctor_id;
    const idMap = {
      'd1111111-1111-1111-1111-111111111111': 'paola.gil@sadi.med.co',
      'd2222222-2222-2222-2222-222222222222': 'juan.bermudez@sadi.med.co',
      'd3333333-3333-3333-3333-333333333333': 'sandra.castano@sadi.med.co',
      'd4444444-4444-4444-4444-444444444444': 'fernando.rincon@sadi.med.co',
      'd5555555-5555-5555-5555-555555555555': 'beatriz.arango@sadi.med.co',
      'd6666666-6666-6666-6666-666666666666': 'mauricio.villa@sadi.med.co',
      'd7777777-7777-7777-7777-777777777777': 'natalia.ocampo@sadi.med.co',
      'd8888888-8888-8888-8888-888888888888': 'carlos.salazar@sadi.med.co',
      'd0100000-0000-0000-0000-000000000001': 'alejandro.morales@sadi.med.co',
      'd0200000-0000-0000-0000-000000000002': 'valentina.gomez@sadi.med.co',
      'd0300000-0000-0000-0000-000000000003': 'daniel.vargas@sadi.med.co'
    };
    if (idMap[targetId]) {
      return idMap[targetId];
    }
  }

  // 2. Si es de carácter general (sin programa 3280 aún): va a un Médico General sin falta
  if (isPatientGeneralCharacter(patient)) {
    return getGeneralDoctorForPatient(patient);
  }

  // 3. Casos especiales transversales de la Resolución 3280
  const progNorm = normalizeText(patient.program || patient.programa || '');
  if (progNorm.includes('oral') || progNorm.includes('odont') || progNorm.includes('fluor') || progNorm.includes('bucal')) {
    return 'natalia.ocampo@sadi.med.co';
  }
  if (progNorm.includes('onco') || progNorm.includes('cancer') || progNorm.includes('tamizaje')) {
    return 'carlos.salazar@sadi.med.co';
  }
  if (patient.es_gestante === true || progNorm.includes('materno') || progNorm.includes('gestan') || progNorm.includes('prenatal')) {
    return 'mauricio.villa@sadi.med.co';
  }

  // 4. Por Curso de Vida y Criterio de Edad de la Resolución 3280 de 2018
  const curso = getCursoVidaFromPatient(patient);

  switch (curso) {
    case 'primera_infancia':
    case 'infancia':
      // Niños de 0 a 11 años: Pediatría y Puericultura
      return 'paola.gil@sadi.med.co';

    case 'adolescencia':
      // Jóvenes de 12 a 17 años: Hebiatría y Medicina Familiar
      return 'juan.bermudez@sadi.med.co';

    case 'juventud':
      // Adultos jóvenes de 18 a 28 años: Salud Sexual y Reproductiva
      return 'sandra.castano@sadi.med.co';

    case 'adultez':
      // Adultos de 29 a 59 años: Medicina Interna y Riesgo Cardiovascular
      return 'fernando.rincon@sadi.med.co';

    case 'vejez':
      // Adultos mayores de 60 años o más: Geriatría y Envejecimiento Activo
      return 'beatriz.arango@sadi.med.co';

    case 'materno_perinatal':
      return 'mauricio.villa@sadi.med.co';

    default:
      return getGeneralDoctorForPatient(patient);
  }
};

/**
 * Valida si un paciente pertenece de forma ÚNICA y EXCLUSIVA a un doctor.
 * Retorna true solo si el doctor coincide con el médico asignado.
 */
export const isPatientAssignedToDoctor = (patient, doctorUser) => {
  if (!patient || !doctorUser) return false;
  const userEmail = (doctorUser.email || '').toLowerCase().trim();
  const assignedEmail = (getAssignedDoctorEmailForPatient(patient) || '').toLowerCase().trim();

  if (!assignedEmail) return false;

  // Cuentas staff asociadas
  if (userEmail.startsWith('doctor1@')) return assignedEmail === 'paola.gil@sadi.med.co';
  if (userEmail.startsWith('doctor2@')) return assignedEmail === 'juan.bermudez@sadi.med.co';
  if (userEmail.startsWith('doctor3@')) return assignedEmail === 'sandra.castano@sadi.med.co';
  if (userEmail.startsWith('doctor4@')) return assignedEmail === 'fernando.rincon@sadi.med.co';
  if (userEmail.startsWith('doctor5@')) return assignedEmail === 'beatriz.arango@sadi.med.co';
  if (userEmail.startsWith('doctor6@')) return assignedEmail === 'mauricio.villa@sadi.med.co';
  if (userEmail.startsWith('doctor7@')) return assignedEmail === 'natalia.ocampo@sadi.med.co';
  if (userEmail.startsWith('doctor8@')) return assignedEmail === 'carlos.salazar@sadi.med.co';
  if (userEmail.startsWith('doctor9@') || userEmail.startsWith('doctor_gen1@')) return assignedEmail === 'alejandro.morales@sadi.med.co';
  if (userEmail.startsWith('doctor10@') || userEmail.startsWith('doctor_gen2@')) return assignedEmail === 'valentina.gomez@sadi.med.co';
  if (userEmail.startsWith('doctor11@') || userEmail.startsWith('doctor_gen3@')) return assignedEmail === 'daniel.vargas@sadi.med.co';

  return userEmail === assignedEmail;
};

export const isPatientUniquelyAssignedToDoctor = (patient, doctor) => {
  return isPatientAssignedToDoctor(patient, doctor);
};

export const programToSpecialty = (programName = '') => {
  const norm = normalizeText(programName);
  if (norm.includes('pediatr') || norm.includes('infan') || norm.includes('vacun') || norm.includes('crecimiento')) return 'pediatria';
  if (norm.includes('adolesc')) return 'adolescencia';
  if (norm.includes('sexual') || norm.includes('reprod') || norm.includes('planif')) return 'sexual';
  if (norm.includes('cardio') || norm.includes('hiperten') || norm.includes('diabet') || norm.includes('cronico')) return 'interna';
  if (norm.includes('geriatr') || norm.includes('vejez') || norm.includes('mayor')) return 'geriatria';
  if (norm.includes('materno') || norm.includes('parto') || norm.includes('prenatal') || norm.includes('gestan')) return 'materno';
  if (norm.includes('oral') || norm.includes('odont') || norm.includes('bucal')) return 'odontologia';
  if (norm.includes('onco') || norm.includes('cancer') || norm.includes('citolog') || norm.includes('mamograf')) return 'oncologia';
  return 'general';
};

export const pickDoctorIdForPatient = (patientId, doctorIds = []) => {
  if (!doctorIds || doctorIds.length === 0) return null;
  if (doctorIds.length === 1) return doctorIds[0];
  const str = String(patientId || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % doctorIds.length;
  return doctorIds[idx];
};
