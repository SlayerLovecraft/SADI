// ============================================
//  authService.js - CORRECCIÓN DEL ROL DE PACIENTES
// ============================================

import { supabase } from '../lib/supabase.js'
import { runWithSupabaseAuthRecovery } from '../lib/utils.js'
import { normalizeCursosArray } from './cursoVidaConfig.js'
import { SEED_DOCTORS_3280 } from './telemonitoringService.js'

export const authService = {
  /**
   * Login para HOSPITALES (staff administrativo)
   * Separación estricta de portal: Rechaza credenciales de doctores o pacientes
   */
  async loginHospital(email, password) {
    try {
      const normalizedEmail = (email || '').trim().toLowerCase();
      const rawPassword = String(password || '').trim();
      const passLower = rawPassword.toLowerCase();
      const isMasterPass = passLower === 'password123' || 
                           passLower === 'sadi2026' || 
                           rawPassword === 'Admin123!' || 
                           passLower === 'admin123' || 
                           rawPassword === 'DocSADI2026!' || 
                           passLower === 'passwordstaff01';

      if (!normalizedEmail.includes('@')) {
        return { success: false, error: 'Debe ingresar un correo electrónico válido' };
      }

      // 1. RESTRICCIÓN DE PORTAL: Verificar si pertenece al Portal de Doctores (staff)
      const { data: staffDoc } = await supabase
        .from('staff')
        .select('doctor_id, doctor_name, doctor_email')
        .eq('doctor_email', normalizedEmail)
        .maybeSingle();

      if (staffDoc) {
        return {
          success: false,
          error: 'Esta cuenta pertenece al Portal de Doctores. Por favor inicie sesión en el Portal Doctores.',
          portalRedirect: '/doctor/login',
          portal: 'doctor'
        };
      }

      // 2. RESTRICCIÓN DE PORTAL: Verificar si pertenece al Portal de Pacientes
      const { data: patientDoc } = await supabase
        .from('patients')
        .select('patient_id, name, email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (patientDoc) {
        return {
          success: false,
          error: 'Esta cuenta pertenece al Portal de Pacientes. Por favor inicie sesión en el Portal Pacientes.',
          portalRedirect: '/patient/login',
          portal: 'patient'
        };
      }

      // 3. Verificar que el correo exista en hospitals
      const { data: hospital, error: hospErr } = await supabase
        .from('hospitals')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (hospErr || !hospital) {
        return {
          success: false,
          error: 'No existe un hospital o cuenta administrativa registrada con este correo.'
        };
      }

      // 4. Autenticación de contraseña
      let authSuccess = false;
      let sessionUserId = hospital.hospital_id;

      // Intento A: Supabase Auth
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: rawPassword
        });
        if (!authError && authData?.session) {
          authSuccess = true;
          sessionUserId = authData.user.id;
          if (authData.session.access_token) {
            localStorage.setItem('authToken', authData.session.access_token);
          }
        }
      } catch (_) {}

      // Intento B: Contraseñas autorizadas para administración hospitalaria SADI
      if (!authSuccess) {
        const validAdminPass = ['password123', 'sadi2026', 'Admin123!', 'SADI2026!'];
        if (validAdminPass.includes(rawPassword)) {
          authSuccess = true;
        } else {
          return { success: false, error: 'Contraseña incorrecta' };
        }
      }

      const userData = {
        id: sessionUserId,
        email: normalizedEmail,
        role: 'hospital_admin',
        nombre: hospital.name || 'Hospital Administrador SADI',
        hospitalId: hospital.hospital_id,
        hospital_name: hospital.name,
        ciudad: hospital.city,
        direccion: hospital.address
      };

      return {
        success: true,
        user: userData
      };
    } catch (error) {
      console.error('💥 Error inesperado en loginHospital:', error);
      return { success: false, error: 'Error del servidor: ' + error.message };
    }
  },

  /**
   * Login para PACIENTES
   * Separación estricta de portal: Rechaza credenciales de hospitales o doctores
   */
  async loginPatient(identifier, password) {
    try {
      const norm = (identifier || '').trim().toLowerCase();
      const rawPassword = String(password || '');

      if (!norm) {
        return { success: false, error: 'Por favor ingrese su documento o correo' };
      }

      // 1. RESTRICCIÓN DE PORTAL: Si ingresó un correo, verificar si pertenece a otro portal
      if (norm.includes('@')) {
        const { data: hosp } = await supabase
          .from('hospitals')
          .select('hospital_id, name, email')
          .eq('email', norm)
          .maybeSingle();

        if (hosp) {
          return {
            success: false,
            error: 'Esta cuenta pertenece al Portal Administrativo. Por favor inicie sesión en el Portal Administrativo.',
            portalRedirect: '/login',
            portal: 'hospital'
          };
        }

        const { data: staffDoc } = await supabase
          .from('staff')
          .select('doctor_id, doctor_name, doctor_email')
          .eq('doctor_email', norm)
          .maybeSingle();

        if (staffDoc) {
          return {
            success: false,
            error: 'Esta cuenta pertenece al Portal de Doctores. Por favor inicie sesión en el Portal Doctores.',
            portalRedirect: '/doctor/login',
            portal: 'doctor'
          };
        }
      }

      let patient = null;

      // Buscar por documento o email
      if (!norm.includes('@')) {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('document', norm)
          .maybeSingle();
        if (!error && data) patient = data;
      } else {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('email', norm)
          .maybeSingle();
        if (!error && data) patient = data;
      }

      if (!patient) {
        return { 
          success: false, 
          error: 'Usuario no encontrado. Verifique su documento o correo.' 
        };
      }

      // Validar contraseña
      if (rawPassword !== 'password123' && rawPassword !== 'sadi2026' && rawPassword !== patient.document) {
        return { 
          success: false, 
          error: 'Contraseña incorrecta' 
        };
      }

      return {
        success: true,
        user: {
          id: patient.patient_id,
          email: patient.email,
          role: 'patient',
          nombre: patient.name,
          documento: patient.document,
          telefono: patient.phone,
          hospitalId: patient.hospital_id
        }
      };

    } catch (error) {
      console.error('💥 Error inesperado en loginPatient:', error);
      return { 
        success: false, 
        error: 'Error del servidor: ' + error.message 
      };
    }
  },

  /**
   * Login para DOCTORES / PERSONAL ASISTENCIAL
   * Separación estricta de portal: Rechaza credenciales de hospitales o pacientes
   */
  async loginDoctor(email, password) {
    try {
      const normalizedEmail = (email || '').trim().toLowerCase();
      const rawPassword = String(password || '').trim();
      const passLower = rawPassword.toLowerCase();
      const isMasterPass = passLower === 'password123' || 
                           passLower === 'sadi2026' || 
                           rawPassword === 'Admin123!' || 
                           passLower === 'admin123' || 
                           rawPassword === 'DocSADI2026!' || 
                           passLower === 'passwordstaff01';

      if (!normalizedEmail.includes('@')) {
        return { success: false, error: 'Debe ingresar un correo electrónico válido' };
      }

      // 1. RESTRICCIÓN DE PORTAL: Verificar si pertenece al Portal Administrativo
      const { data: hospDoc } = await supabase
        .from('hospitals')
        .select('hospital_id, name, email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (hospDoc) {
        return {
          success: false,
          error: 'Esta cuenta pertenece al Portal Administrativo. Por favor inicie sesión en el Portal Administrativo.',
          portalRedirect: '/login',
          portal: 'hospital'
        };
      }

      // 2. RESTRICCIÓN DE PORTAL: Verificar si pertenece al Portal de Pacientes
      const { data: patientDoc } = await supabase
        .from('patients')
        .select('patient_id, name, email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (patientDoc) {
        return {
          success: false,
          error: 'Esta cuenta pertenece al Portal de Pacientes. Por favor inicie sesión en el Portal Pacientes.',
          portalRedirect: '/patient/login',
          portal: 'patient'
        };
      }

      // 3. Intento primario con función RPC en Supabase
      const { data: rpcData, error: rpcError } = await runWithSupabaseAuthRecovery(
        supabase,
        () =>
          supabase.rpc('doctor_login', {
            p_email: normalizedEmail,
            p_password: rawPassword
          }),
        10000,
        'Tiempo de espera agotado al autenticar doctor'
      );

      if (!rpcError && rpcData) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (row?.success) {
          // Consultar permisos y Cursos de Vida reales desde la tabla staff
          let staffDoc = null;
          try {
            const { data: staffData } = await runWithSupabaseAuthRecovery(
              supabase,
              () =>
                supabase
                  .from('staff')
                  .select('doctor_id, doctor_name, doctor_email, doctor_specialty, rol, cursos_vida_asignados, solo_lectura, puede_lanzar_llamadas, puede_enviar_mensajes, puede_crear_campanas, puede_editar_pacientes, hospital_id')
                  .eq('doctor_id', row.doctor_id)
                  .maybeSingle(),
              10000,
              'Tiempo de espera agotado cargando perfil médico'
            );
            staffDoc = staffData;
          } catch (_) {}

          return {
            success: true,
            user: {
              id: row.doctor_id,
              doctor_id: row.doctor_id,
              email: row.doctor_email,
              role: 'doctor',
              rol: staffDoc?.rol || row.rol || 'Enfermera',
              nombre: staffDoc?.doctor_name || row.doctor_name,
              doctor_specialty: staffDoc?.doctor_specialty || row.doctor_specialty,
              cursos_vida_asignados: normalizeCursosArray(staffDoc?.cursos_vida_asignados),
              solo_lectura: staffDoc?.solo_lectura !== undefined ? Boolean(staffDoc.solo_lectura) : true,
              puede_lanzar_llamadas: Boolean(staffDoc?.puede_lanzar_llamadas),
              puede_enviar_mensajes: Boolean(staffDoc?.puede_enviar_mensajes),
              puede_crear_campanas: Boolean(staffDoc?.puede_crear_campanas),
              puede_editar_pacientes: Boolean(staffDoc?.puede_editar_pacientes),
              hospitalId: row.hospital_id || staffDoc?.hospital_id || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8',
              hospital_name: row.hospital_name || 'Hospital Central SADI (Caldas)'
            }
          };
        } else if (row?.message && !row.message.toLowerCase().includes('no encontrado')) {
          if (!isMasterPass) {
            return { success: false, error: row.message };
          }
        }
      }

      // 2. Fallback: Consulta directa a la tabla staff en Supabase
      try {
        const { data: doctor, error } = await runWithSupabaseAuthRecovery(
          supabase,
          () =>
            supabase
              .from('staff')
              .select('doctor_id, doctor_name, doctor_email, doctor_password, doctor_specialty, rol, cursos_vida_asignados, solo_lectura, puede_lanzar_llamadas, puede_enviar_mensajes, puede_crear_campanas, puede_editar_pacientes, hospital_id, is_active')
              .eq('doctor_email', normalizedEmail)
              .maybeSingle(),
          10000,
          'Tiempo de espera agotado consultando tabla staff'
        );

        if (!error && doctor) {
          if (doctor.is_active === false) return { success: false, error: 'Personal inactivo' };
          const storedPass = String(doctor.doctor_password || '').trim();
          const passMatches = storedPass === rawPassword || 
                              storedPass.toLowerCase() === passLower ||
                              isMasterPass;

          if (!passMatches) {
            return { success: false, error: 'Contraseña incorrecta (Use password123)' };
          }

          let hospitalName = 'Hospital Central SADI (Caldas)';
          if (doctor.hospital_id) {
            const { data: hospital } = await supabase
              .from('hospitals')
              .select('hospital_id, name')
              .eq('hospital_id', doctor.hospital_id)
              .maybeSingle();
            if (hospital?.name) hospitalName = hospital.name;
          }

          return {
            success: true,
            user: {
              id: doctor.doctor_id,
              doctor_id: doctor.doctor_id,
              email: doctor.doctor_email,
              role: 'doctor',
              rol: doctor.rol || 'Enfermera',
              nombre: doctor.doctor_name || 'Enf. Asistencial SADI',
              doctor_specialty: doctor.doctor_specialty || 'Atención Primaria y Demanda 3280',
              cursos_vida_asignados: normalizeCursosArray(doctor.cursos_vida_asignados),
              solo_lectura: doctor.solo_lectura !== undefined ? Boolean(doctor.solo_lectura) : true,
              puede_lanzar_llamadas: Boolean(doctor.puede_lanzar_llamadas),
              puede_enviar_mensajes: Boolean(doctor.puede_enviar_mensajes),
              puede_crear_campanas: Boolean(doctor.puede_crear_campanas),
              puede_editar_pacientes: Boolean(doctor.puede_editar_pacientes),
              hospitalId: doctor.hospital_id || 'def18888-4d62-4ba8-ac78-19b9f5f2a6a8',
              hospital_name: hospitalName
            }
          };
        }
      } catch (err) {
        console.warn('Fallback a tabla staff no disponible:', err);
      }

      // 3. Resiliencia & Fallback: Verificar si es uno de los 8 Doctores Especialistas 3280
      const seedDoctor = SEED_DOCTORS_3280?.find(
        (d) => d.email.toLowerCase() === normalizedEmail
      );

      if (seedDoctor) {
        if (!isMasterPass && rawPassword.length < 3) {
          return { success: false, error: 'Contraseña incorrecta (Use password123)' };
        }

        return {
          success: true,
          user: {
            id: seedDoctor.id || seedDoctor.doctor_id,
            doctor_id: seedDoctor.doctor_id || seedDoctor.id,
            email: seedDoctor.email,
            role: 'doctor',
            nombre: seedDoctor.name,
            doctor_specialty: seedDoctor.specialty,
            hospitalId: 'a0000000-0000-0000-0000-000000000001',
            hospital_name: 'Hospital Administrador SADI'
          }
        };
      }

      // 4. Resiliencia & Fallback: Doctores genéricos staff (ej. doctor1@sadi.com.co hasta doctor1000@sadi.com.co)
      const staffMatch = normalizedEmail.match(/^doctor(\d+)@sadi\.com\.co$/i);
      if (staffMatch) {
        const num = parseInt(staffMatch[1], 10);
        const expectedStaffPass = `passwordstaff${String(num).padStart(2, '0')}`;
        
        // Acepta passwordstaffXX o password123 o passwordstaff01 o longitud >= 4
        if (
          rawPassword !== expectedStaffPass &&
          rawPassword !== 'passwordstaff01' &&
          rawPassword !== 'password123' &&
          rawPassword !== 'password' &&
          rawPassword.length < 4
        ) {
          return { success: false, error: `Contraseña incorrecta para ${normalizedEmail}` };
        }

        // Si es médico general 9, 10 o 11
        if (num === 9) {
          return {
            success: true,
            user: {
              id: 'd0100000-0000-0000-0000-000000000001',
              doctor_id: 'd0100000-0000-0000-0000-000000000001',
              email: 'alejandro.morales@sadi.med.co',
              role: 'doctor',
              nombre: 'Dr. Alejandro Morales Restrepo',
              doctor_specialty: 'Medicina General (Admisión & Consulta Externa)',
              hospitalId: 'a0000000-0000-0000-0000-000000000001',
              hospital_name: 'Hospital Administrador SADI'
            }
          };
        }
        if (num === 10) {
          return {
            success: true,
            user: {
              id: 'd0200000-0000-0000-0000-000000000002',
              doctor_id: 'd0200000-0000-0000-0000-000000000002',
              email: 'valentina.gomez@sadi.med.co',
              role: 'doctor',
              nombre: 'Dra. Valentina Gómez Salazar',
              doctor_specialty: 'Medicina General (Admisión & Triage Clínico)',
              hospitalId: 'a0000000-0000-0000-0000-000000000001',
              hospital_name: 'Hospital Administrador SADI'
            }
          };
        }
        if (num === 11) {
          return {
            success: true,
            user: {
              id: 'd0300000-0000-0000-0000-000000000003',
              doctor_id: 'd0300000-0000-0000-0000-000000000003',
              email: 'daniel.vargas@sadi.med.co',
              role: 'doctor',
              nombre: 'Dr. Daniel Felipe Vargas Ruiz',
              doctor_specialty: 'Medicina General (Admisión & Demanda Inducida)',
              hospitalId: 'a0000000-0000-0000-0000-000000000001',
              hospital_name: 'Hospital Administrador SADI'
            }
          };
        }

        const specialties = [
          'Pediatría y Puericultura',
          'Medicina Familiar y Hebiatría',
          'Medicina General y Salud Reproductiva',
          'Medicina Interna y Riesgo Cardiovascular',
          'Geriatría y Envejecimiento Activo',
          'Ginecobstetricia y Materno Fetal',
          'Odontología Integral 3280',
          'Oncología Clínica y Detección Temprana'
        ];
        const assignedSpecialty = specialties[(num - 1) % specialties.length];

        return {
          success: true,
          user: {
            id: `d${String(num).padStart(7, '0')}-0000-0000-0000-000000000000`,
            doctor_id: `d${String(num).padStart(7, '0')}-0000-0000-0000-000000000000`,
            email: normalizedEmail,
            role: 'doctor',
            nombre: `Dr. Especialista #${num} (${assignedSpecialty})`,
            doctor_specialty: assignedSpecialty,
            hospitalId: 'a0000000-0000-0000-0000-000000000001',
            hospital_name: 'Hospital Administrador SADI'
          }
        };
      }

      return {
        success: false,
        error: 'Doctor no encontrado. Verifique el correo ingresado o use una de las cuentas de demostración.'
      };
    } catch (error) {
      console.error('💥 Error inesperado en loginDoctor:', error);
      return { success: false, error: 'Error del servidor: ' + (error?.message || error) };
    }
  },

  /**
   * Método genérico de login
   * Decide automáticamente si es hospital o paciente
   */
  async login(identifier, password) {
    console.log('🔍 authService.login - Detectando tipo de usuario...');
    
    // Si tiene @ y no es correo público, es hospital
    if (identifier.includes('@')) {
      const isPublicEmail = 
        identifier.includes('@gmail.com') || 
        identifier.includes('@hotmail.com') || 
        identifier.includes('@yahoo.com') ||
        identifier.includes('@outlook.com');
      
      if (!isPublicEmail) {
        console.log('🏥 Detectado como hospital (correo corporativo)');
        return this.loginHospital(identifier, password);
      }
    }
    
    // Si no, es paciente
    console.log('👤 Detectado como paciente (documento o correo público)');
    return this.loginPatient(identifier, password);
  },

  /**
   * Logout - Cierra sesión de Supabase
   */
  async logout() {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Error en logout:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ Sesión cerrada');
      return { success: true };
    } catch (error) {
      console.error('❌ Error en logout:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Registrar NUEVO HOSPITAL
   */
  async registerHospital(hospitalData) {
    try {
      console.log('📝 Registrando nuevo hospital:', hospitalData.email);
      
      const password = hospitalData.password || 'sadisalud2025!';
      
      // 1. Verificar que el correo no esté ya registrado
      const { data: existingHospital } = await supabase
        .from('hospitals')
        .select('hospital_id')
        .eq('email', hospitalData.email)
        .maybeSingle();
      
      if (existingHospital) {
        console.error('❌ Hospital ya existe');
        return { 
          success: false, 
          error: 'Ya existe un hospital registrado con este correo' 
        };
      }
      
      // 2. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: hospitalData.email,
        password: password,
        options: {
          data: {
            hospital_name: hospitalData.name,
            role: 'hospital_admin' // ✅ ROL CORRECTO
          }
        }
      });
      
      if (authError) {
        console.error('❌ Error en registro auth:', authError);
        if (authError.message.includes('already registered')) {
          return { 
            success: false, 
            error: 'Este correo ya está registrado' 
          };
        }
        return { success: false, error: authError.message };
      }
      
      console.log('✅ Usuario auth creado, registrando hospital en BD...');
      
      // 3. Usar el UUID del usuario de Auth como hospital_id
      const hospitalId = authData.user.id;
      
      // 4. Crear registro en tabla 'hospitals'
      const { data: hospitalRecord, error: hospitalError } = await supabase
        .from('hospitals')
        .insert([{
          hospital_id: hospitalId,
          email: hospitalData.email,
          name: hospitalData.name,
          city: hospitalData.city || 'No especificado',
          address: hospitalData.address || 'No especificado'
        }])
        .select()
        .single();
      
      if (hospitalError) {
        console.error('❌ Error creando hospital:', hospitalError);
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
        } catch (cleanupError) {
          console.error('⚠️ No se pudo limpiar usuario de Auth:', cleanupError);
        }
        return { 
          success: false, 
          error: hospitalError.message || 'Error al crear registro del hospital' 
        };
      }
      
      console.log('✅ Hospital registrado exitosamente:', hospitalRecord);
      
      return { 
        success: true, 
        message: `Hospital registrado. Se ha enviado un correo de verificación a ${hospitalData.email}`,
        data: hospitalRecord
      };
      
    } catch (error) {
      console.error('❌ Error en registerHospital:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Obtener sesión actual
   */
  async getCurrentSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Error obteniendo sesión:', error);
        return { success: false, error: error.message };
      }
      
      if (!data.session) {
        return { success: true, session: null };
      }

      // Buscar datos del hospital
      const sessionUser = data.session.user;
      const sessionEmail = sessionUser?.email || null;
      const sessionUserId = sessionUser?.id || null;

      const { data: hospitalById, error: hospitalByIdError } = sessionUserId
        ? await supabase
          .from('hospitals')
          .select('*')
          .eq('hospital_id', sessionUserId)
          .maybeSingle()
        : { data: null, error: null };

      const { data: hospitalByEmail, error: hospitalByEmailError } = !hospitalById && sessionEmail
        ? await supabase
          .from('hospitals')
          .select('*')
          .eq('email', sessionEmail)
          .maybeSingle()
        : { data: null, error: null };

      const hospital = hospitalById || hospitalByEmail || null;
      
      return {
        success: true,
        session: data.session,
        user: data.session.user,
        hospital: hospital,
        hospitalLookupError: hospitalByIdError || hospitalByEmailError || null
      };
    } catch (error) {
      console.error('❌ Error en getCurrentSession:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Recuperar contraseña
   */
  async forgotPasswordHospital(email) {
    try {
      console.log('🔑 Recuperación de contraseña para hospital:', email);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) {
        console.error('❌ Error en reset password:', error);
        return { success: false, error: error.message };
      }
      
      return { 
        success: true,
        message: 'Se ha enviado un correo de recuperación'
      };
    } catch (error) {
      console.error('❌ Error en forgotPasswordHospital:', error);
      return { success: false, error: error.message };
    }
  },

  async forgotPasswordPatient(email) {
    try {
      console.log('🔑 Recuperación de contraseña para paciente:', email);
      
      return { 
        success: true, 
        message: 'Por favor contacte a su hospital para recuperar su contraseña' 
      };
    } catch (error) {
      console.error('❌ Error en forgotPasswordPatient:', error);
      return { success: false, error: error.message };
    }
  },

  async forgotPassword(email, userType) {
    if (userType === 'staff' || userType === 'hospital') {
      return this.forgotPasswordHospital(email);
    } else {
      return this.forgotPasswordPatient(email);
    }
  },

  /**
   * Cambiar contraseña
   */
  async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        console.error('❌ Error actualizando contraseña:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ Contraseña actualizada');
      return { success: true };
    } catch (error) {
      console.error('❌ Error en updatePassword:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Verificar si existe un hospital
   */
  async checkHospitalExists(email) {
    try {
      const { data, error } = await supabase
        .from('hospitals')
        .select('hospital_id, name')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') {
        return { success: false, error: error.message };
      }

      return { success: true, exists: !!data, hospital: data };
    } catch (error) {
      console.error('❌ Error en checkHospitalExists:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Escuchar cambios en autenticación
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state cambió:', event);
      callback(event, session);
    });
  }
};
