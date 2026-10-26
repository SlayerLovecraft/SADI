export const normalizeText = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

const normalizeSpecialty = (value) => {
  const s = normalizeText(value);
  if (!s) return '';

  if (s === 'general' || s.includes('general')) return 'general';
  if (s === 'cardiologo' || s.includes('cardio')) return 'cardiologo';
  if (s === 'obstetra' || s.includes('obstet')) return 'obstetra';
  if (s === 'radiologo' || s.includes('radiolog')) return 'radiologo';
  if (s === 'neurologico' || s.includes('neurolog')) return 'neurologico';
  if (s === 'pediatra' || s.includes('pediatr')) return 'pediatra';
  if (s === 'traumatologo' || s.includes('trauma') || s.includes('ortoped')) return 'traumatologo';
  if (s === 'ginecologo' || s.includes('ginecolog')) return 'ginecologo';
  if (s === 'oncologo' || s.includes('onco')) return 'oncologo';
  if (s === 'dermatologo' || s.includes('dermatolog')) return 'dermatologo';

  return s;
};

const hasToken = (text, token) => {
  const t = normalizeText(text);
  const tok = normalizeText(token);
  if (!t || !tok) return false;
  const re = new RegExp(`(^|[^a-z0-9])${tok}([^a-z0-9]|$)`);
  return re.test(t);
};

export const programToSpecialty = (program) => {
  const p = normalizeText(program);

  if (!p) return 'general';

  if (
    p.includes('hipertension') ||
    p.includes('hipertensi') ||
    p.includes('presion alta') ||
    p.includes('presion arterial') ||
    hasToken(p, 'hta')
  ) return 'cardiologo';
  if (p.includes('asma')) return 'general';

  if (p.includes('embarazo') || p.includes('obstetr')) return 'obstetra';
  if (p.includes('radiolog')) return 'radiologo';
  if (p.includes('neurolog')) return 'neurologico';
  if (p.includes('pediatr')) return 'pediatra';
  if (p.includes('trauma') || p.includes('ortoped')) return 'traumatologo';
  if (p.includes('ginecolog')) return 'ginecologo';
  if (p.includes('onco')) return 'oncologo';
  if (p.includes('dermatolog')) return 'dermatologo';

  return 'general';
};

export const hashStringToInt = (input) => {
  const str = String(input || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const pickDoctorIdForPatient = (patientId, doctorIds) => {
  const ids = (doctorIds || [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  if (ids.length === 0) return null;
  const idx = hashStringToInt(String(patientId || '')) % ids.length;
  return ids[idx] || null;
};

export const specialtiesOrder = [
  'cardiologo',
  'obstetra',
  'general',
  'radiologo',
  'neurologico',
  'pediatra',
  'traumatologo',
  'ginecologo',
  'oncologo',
  'dermatologo'
];

export const getDoctorSlot = (doctor) => {
  const specialty = normalizeText(doctor?.doctor_specialty || doctor?.doctorSpecialty || '');
  const doctorId = Number(doctor?.doctor_id || doctor?.doctorId || doctor?.id);
  if (!Number.isFinite(doctorId) || doctorId <= 0) return null;

  const specialtyIndex = specialtiesOrder.indexOf(specialty);
  if (specialtyIndex === -1) return (doctorId - 1) % 100;

  return (doctorId - 1) % 100;
};

export const isPatientAssignedToDoctor = (patient, doctor) => {
  const doctorSpecialty = normalizeSpecialty(doctor?.doctor_specialty || doctor?.doctorSpecialty || '');
  if (!doctorSpecialty) return false;

  const patientSpecialty = normalizeSpecialty(programToSpecialty(patient?.program));
  if (patientSpecialty !== doctorSpecialty) return false;

  const doctorHospitalId = doctor?.hospitalId || doctor?.hospital_id || null;
  const patientHospitalId = patient?.hospital_id || patient?.hospitalId || null;
  if (doctorHospitalId && patientHospitalId && String(doctorHospitalId) !== String(patientHospitalId)) return false;

  return true;
};

export const isPatientUniquelyAssignedToDoctor = (patient, doctor, eligibleDoctorIds) => {
  if (!isPatientAssignedToDoctor(patient, doctor)) return false;
  const chosen = pickDoctorIdForPatient(patient?.patient_id, eligibleDoctorIds);
  if (!chosen) return true;
  const doctorId = String(doctor?.doctor_id || doctor?.doctorId || doctor?.id || '').trim();
  if (!doctorId) return true;
  return chosen === doctorId;
};
