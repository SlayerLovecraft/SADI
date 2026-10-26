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

/**
 * DETERMINACIÓN EXCLUSIVA Y DETERMINÍSTICA DE DOCTOR ASIGNADO
 * Regla: 1 Paciente pertenece a EXACTAMENTE 1 Doctor.
 * Ningún otro doctor puede ver ni acceder a este paciente.
 */
export const getAssignedDoctorEmailForPatient = (patient) => {
  if (!patient) return null;

  // 1. Si el paciente ya tiene un ID explícito de doctor asignado en su registro
  if (patient.doctor_asignado_id) {
    const idMap = {
      'd1111111-1111-1111-1111-111111111111': 'paola.gil@sadi.med.co',
      'd2222222-2222-2222-2222-222222222222': 'juan.bermudez@sadi.med.co',
      'd3333333-3333-3333-3333-333333333333': 'sandra.castano@sadi.med.co',
      'd4444444-4444-4444-4444-444444444444': 'fernando.rincon@sadi.med.co',
      'd5555555-5555-5555-5555-555555555555': 'beatriz.arango@sadi.med.co',
      'd6666666-6666-6666-6666-666666666666': 'mauricio.villa@sadi.med.co',
      'd7777777-7777-7777-7777-777777777777': 'natalia.ocampo@sadi.med.co',
      'd8888888-8888-8888-8888-888888888888': 'carlos.salazar@sadi.med.co',
    };
    if (idMap[patient.doctor_asignado_id]) {
      return idMap[patient.doctor_asignado_id];
    }
  }

  // 2. Por Condición Clínica y Curso de Vida según Resolución 3280 de 2018
  const curso = getCursoVidaFromPatient(patient);

  switch (curso) {
    case 'primera_infancia':
    case 'infancia':
      // Niños de 0 a 11 años: Pediatría y Puericultura
      return 'paola.gil@sadi.med.co';

    case 'adolescencia':
      // Jóvenes de 12 a 17 años: Medicina Familiar y Hebiatría
      return 'juan.bermudez@sadi.med.co';

    case 'juventud':
      // Adultos jóvenes de 18 a 28 años: Medicina General y Salud Sexual/Reproductiva
      return 'sandra.castano@sadi.med.co';

    case 'adultez':
      // Adultos de 29 a 59 años: Medicina Interna y Riesgo Cardiovascular
      return 'fernando.rincon@sadi.med.co';

    case 'vejez':
      // Adultos mayores de 60 años o más: Geriatría y Envejecimiento Activo
      return 'beatriz.arango@sadi.med.co';

    case 'materno_perinatal':
      // Gestantes y puérperas: Ginecobstetricia y Medicina Materno Fetal
      return 'mauricio.villa@sadi.med.co';

    default:
      return 'fernando.rincon@sadi.med.co';
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
