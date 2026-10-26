const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const wb = XLSX.utils.book_new();

// 1. HOJA: HOSPITALES Y ADMINISTRADORES
const hospitalesData = [
  {
    "Rol / Perfil": "Administrador Principal de Red Hospitalaria",
    "Institución / Entidad": "Hospital Universitario SADI / EPS SADI",
    "URL de Acceso": "/login",
    "Usuario / Correo Institucional": "admin@sadi.gov.co",
    "Contraseña de Acceso": "Admin123!",
    "Alcance y Permisos": "Control total de telemonitoreo, camas, alertas clínicas, triage, configuración de IA y gestión 3280",
    "Estado": "Activo"
  },
  {
    "Rol / Perfil": "Coordinación Médica IPS",
    "Institución / Entidad": "Clínica Regional Central",
    "URL de Acceso": "/login",
    "Usuario / Correo Institucional": "hospital@sadi.com.co",
    "Contraseña de Acceso": "Admin123!",
    "Alcance y Permisos": "Monitoreo hospitalario general y supervisión asistencial",
    "Estado": "Activo"
  }
];

const wsHospitales = XLSX.utils.json_to_sheet(hospitalesData);
wsHospitales['!cols'] = [
  { wch: 35 },
  { wch: 30 },
  { wch: 15 },
  { wch: 30 },
  { wch: 18 },
  { wch: 60 },
  { wch: 12 }
];
XLSX.utils.book_append_sheet(wb, wsHospitales, "Hospitales y Administradores");

// 2. HOJA: DOCTORES ESPECIALISTAS (RESOLUCIÓN 3280)
const doctoresData = [
  {
    "Especialista": "Dra. Paola Gil",
    "Especialidad Médica": "Pediatría y Puericultura",
    "Área Clínica (Res. 3280)": "Primera Infancia (0-5 años) e Infancia (6-11 años)",
    "URL de Acceso": "/doctor/login",
    "Correo Electrónico Principal": "paola.gil@sadi.med.co",
    "Correo Staff Alternativo": "doctor1@sadi.com.co",
    "Contraseña Principal": "password123",
    "Contraseña Staff": "passwordstaff01",
    "Cantidad Pacientes Asignados": 0,
    "Pacientes Asignados en BD": "Ninguno (0 pacientes entre 0 y 11 años actualmente)",
    "Regla de Confidencialidad": "Aislamiento estricto: No puede ver pacientes de otros grupos etarios"
  },
  {
    "Especialista": "Dr. Juan Camilo Bermúdez",
    "Especialidad Médica": "Medicina Familiar y Hebiatría",
    "Área Clínica (Res. 3280)": "Adolescencia (12-17 años)",
    "URL de Acceso": "/doctor/login",
    "Correo Electrónico Principal": "juan.bermudez@sadi.med.co",
    "Correo Staff Alternativo": "doctor2@sadi.com.co",
    "Contraseña Principal": "password123",
    "Contraseña Staff": "passwordstaff01",
    "Cantidad Pacientes Asignados": 1,
    "Pacientes Asignados en BD": "Julio Cesar Marulanda (16 años - Doc: 1010101010)",
    "Regla de Confidencialidad": "Acceso EXCLUSIVO a Julio Cesar Marulanda. Ningún otro doctor puede verlo."
  },
  {
    "Especialista": "Dra. Sandra Milena Castaño",
    "Especialidad Médica": "Medicina General y Salud Sexual/Reproductiva",
    "Área Clínica (Res. 3280)": "Juventud (18-28 años)",
    "URL de Acceso": "/doctor/login",
    "Correo Electrónico Principal": "sandra.castano@sadi.med.co",
    "Correo Staff Alternativo": "doctor3@sadi.com.co",
    "Contraseña Principal": "password123",
    "Contraseña Staff": "passwordstaff01",
    "Cantidad Pacientes Asignados": 1,
    "Pacientes Asignados en BD": "Andrés Senon Dueñas Sánchez (24 años - Doc: 1006010518)",
    "Regla de Confidencialidad": "Acceso EXCLUSIVO a Andrés Senon Dueñas. Ningún otro doctor puede verlo."
  },
  {
    "Especialista": "Dr. Fernando Rincón",
    "Especialidad Médica": "Medicina Interna y Riesgo Cardiovascular",
    "Área Clínica (Res. 3280)": "Adultez (29-59 años)",
    "URL de Acceso": "/doctor/login",
    "Correo Electrónico Principal": "fernando.rincon@sadi.med.co",
    "Correo Staff Alternativo": "doctor4@sadi.com.co",
    "Contraseña Principal": "password123",
    "Contraseña Staff": "passwordstaff01",
    "Cantidad Pacientes Asignados": 2,
    "Pacientes Asignados en BD": "Dora Deisy Dueñas Sánchez (54 años - Doc: 66764315), Jimmy Romero (41 años - Doc: 1234567890)",
    "Regla de Confidencialidad": "Acceso EXCLUSIVO a Dora Deisy y Jimmy Romero. Ningún otro doctor puede verlos."
  },
  {
    "Especialista": "Dra. Beatriz Arango",
    "Especialidad Médica": "Geriatría y Envejecimiento Activo",
    "Área Clínica (Res. 3280)": "Vejez (60+ años)",
    "URL de Acceso": "/doctor/login",
    "Correo Electrónico Principal": "beatriz.arango@sadi.med.co",
    "Correo Staff Alternativo": "doctor5@sadi.com.co",
    "Contraseña Principal": "password123",
    "Contraseña Staff": "passwordstaff01",
    "Cantidad Pacientes Asignados": 0,
    "Pacientes Asignados en BD": "Ninguno (0 pacientes de 60 años o más actualmente)",
    "Regla de Confidencialidad": "Aislamiento estricto: Lista vacía garantizada sin filtraciones de datos"
  },
  {
    "Especialista": "Dr. Mauricio Villa",
    "Especialidad Médica": "Ginecobstetricia y Medicina Materno Fetal",
    "Área Clínica (Res. 3280)": "Ruta Materno Perinatal (RIAMP)",
    "URL de Acceso": "/doctor/login",
    "Correo Electrónico Principal": "mauricio.villa@sadi.med.co",
    "Correo Staff Alternativo": "doctor6@sadi.com.co",
    "Contraseña Principal": "password123",
    "Contraseña Staff": "passwordstaff01",
    "Cantidad Pacientes Asignados": 0,
    "Pacientes Asignados en BD": "Ninguno (0 pacientes gestantes activas actualmente)",
    "Regla de Confidencialidad": "Aislamiento estricto: Lista vacía garantizada sin filtraciones de datos"
  },
  {
    "Especialista": "Dra. Natalia Ocampo",
    "Especialidad Médica": "Odontología Integral y Salud Oral",
    "Área Clínica (Res. 3280)": "Salud Bucal Transversal",
    "URL de Acceso": "/doctor/login",
    "Correo Electrónico Principal": "natalia.ocampo@sadi.med.co",
    "Correo Staff Alternativo": "doctor7@sadi.com.co",
    "Contraseña Principal": "password123",
    "Contraseña Staff": "passwordstaff01",
    "Cantidad Pacientes Asignados": 0,
    "Pacientes Asignados en BD": "Ninguno",
    "Regla de Confidencialidad": "Aislamiento estricto: Lista vacía garantizada sin filtraciones de datos"
  },
  {
    "Especialista": "Dr. Carlos Salazar",
    "Especialidad Médica": "Oncología Clínica y Tamizajes 3280",
    "Área Clínica (Res. 3280)": "Detección Temprana Cáncer (Mama, Cuello Uterino, Próstata, Colon)",
    "URL de Acceso": "/doctor/login",
    "Correo Electrónico Principal": "carlos.salazar@sadi.med.co",
    "Correo Staff Alternativo": "doctor8@sadi.com.co",
    "Contraseña Principal": "password123",
    "Contraseña Staff": "passwordstaff01",
    "Cantidad Pacientes Asignados": 0,
    "Pacientes Asignados en BD": "Ninguno",
    "Regla de Confidencialidad": "Aislamiento estricto: Lista vacía garantizada sin filtraciones de datos"
  }
];

const wsDoctores = XLSX.utils.json_to_sheet(doctoresData);
wsDoctores['!cols'] = [
  { wch: 28 },
  { wch: 35 },
  { wch: 45 },
  { wch: 15 },
  { wch: 30 },
  { wch: 24 },
  { wch: 18 },
  { wch: 18 },
  { wch: 12 },
  { wch: 60 },
  { wch: 55 }
];
XLSX.utils.book_append_sheet(wb, wsDoctores, "Doctores Especialistas 3280");

// 3. HOJA: PACIENTES (BASE DE DATOS SUPABASE)
const pacientesData = [
  {
    "Nombre del Paciente": "Julio Cesar Marulanda",
    "Documento de Identidad (ID)": "1010101010",
    "Tipo Doc": "CC",
    "URL de Acceso": "/patient/login",
    "Usuario para Ingresar": "1010101010 (o correo)",
    "Contraseña de Ingreso": "password123 (o 1010101010)",
    "Fecha de Nacimiento": "2010-07-26",
    "Edad": 16,
    "Curso de Vida (Res. 3280)": "Adolescencia (12-17 años)",
    "Programa Clínico": "Control Integral de Salud del Adolescente",
    "Doctor Único Asignado": "Dr. Juan Camilo Bermúdez",
    "Correo Doctor Asignado": "juan.bermudez@sadi.med.co",
    "Privacidad de Acceso": "Visibilidad EXCLUSIVA para el Dr. Juan Camilo Bermúdez. Restringido para todos los demás."
  },
  {
    "Nombre del Paciente": "Dora Deisy Dueñas Sánchez",
    "Documento de Identidad (ID)": "66764315",
    "Tipo Doc": "CC",
    "URL de Acceso": "/patient/login",
    "Usuario para Ingresar": "66764315 (o correo)",
    "Contraseña de Ingreso": "password123 (o 66764315)",
    "Fecha de Nacimiento": "1972-03-07",
    "Edad": 54,
    "Curso de Vida (Res. 3280)": "Adultez (29-59 años)",
    "Programa Clínico": "Hipertensión Arterial y Riesgo Cardiovascular",
    "Doctor Único Asignado": "Dr. Fernando Rincón",
    "Correo Doctor Asignado": "fernando.rincon@sadi.med.co",
    "Privacidad de Acceso": "Visibilidad EXCLUSIVA para el Dr. Fernando Rincón. Restringido para todos los demás."
  },
  {
    "Nombre del Paciente": "Andrés Senon Dueñas Sánchez",
    "Documento de Identidad (ID)": "1006010518",
    "Tipo Doc": "CC",
    "URL de Acceso": "/patient/login",
    "Usuario para Ingresar": "1006010518 (o correo)",
    "Contraseña de Ingreso": "password123 (o 1006010518)",
    "Fecha de Nacimiento": "2001-12-16",
    "Edad": 24,
    "Curso de Vida (Res. 3280)": "Juventud (18-28 años)",
    "Programa Clínico": "Salud Integral Joven y Manejo de Asma",
    "Doctor Único Asignado": "Dra. Sandra Milena Castaño",
    "Correo Doctor Asignado": "sandra.castano@sadi.med.co",
    "Privacidad de Acceso": "Visibilidad EXCLUSIVA para la Dra. Sandra Milena Castaño. Restringido para todos los demás."
  },
  {
    "Nombre del Paciente": "Jimmy Romero",
    "Documento de Identidad (ID)": "1234567890",
    "Tipo Doc": "CC",
    "URL de Acceso": "/patient/login",
    "Usuario para Ingresar": "1234567890 (o correo)",
    "Contraseña de Ingreso": "password123 (o 1234567890)",
    "Fecha de Nacimiento": "1985-05-15",
    "Edad": 41,
    "Curso de Vida (Res. 3280)": "Adultez (29-59 años)",
    "Programa Clínico": "Hipertensión Arterial Primaria y Monitoreo Remoto",
    "Doctor Único Asignado": "Dr. Fernando Rincón",
    "Correo Doctor Asignado": "fernando.rincon@sadi.med.co",
    "Privacidad de Acceso": "Visibilidad EXCLUSIVA para el Dr. Fernando Rincón. Restringido para todos los demás."
  }
];

const wsPacientes = XLSX.utils.json_to_sheet(pacientesData);
wsPacientes['!cols'] = [
  { wch: 30 },
  { wch: 22 },
  { wch: 10 },
  { wch: 15 },
  { wch: 26 },
  { wch: 26 },
  { wch: 16 },
  { wch: 8 },
  { wch: 28 },
  { wch: 45 },
  { wch: 28 },
  { wch: 30 },
  { wch: 60 }
];
XLSX.utils.book_append_sheet(wb, wsPacientes, "Pacientes (Base de Datos)");

// Rutas de destino
const rootOut = path.resolve(__dirname, 'Credenciales_Acceso_SADI_3280.xlsx');
const publicOut = path.resolve(__dirname, '_react_legacy/SADI_React-Node.js/public/Credenciales_Acceso_SADI_3280.xlsx');

XLSX.writeFile(wb, rootOut);
console.log('Generado exitosamente en:', rootOut);

// Asegurar carpeta public
const publicDir = path.dirname(publicOut);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
XLSX.writeFile(wb, publicOut);
console.log('Generado exitosamente en:', publicOut);
