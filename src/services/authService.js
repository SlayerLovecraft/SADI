// ============================================
//  authService.js - CORRECCIÓN DEL ROL DE PACIENTES
// ============================================

import { supabase } from '../lib/supabase.js'

export const authService = {
  /**
   * Login para HOSPITALES (staff administrativo)
   */
  async loginHospital(email, password) {
    try {
      console.log('🏥 authService.loginHospital - Iniciando...');
      console.log('📧 Email:', email);

      // 1. Verificar que el email existe en hospitals
      const { data: hospitalCheck } = await supabase
        .from('hospitals')
        .select('hospital_id, name')
        .eq('email', email)
        .maybeSingle();

      if (!hospitalCheck) {
        console.error('❌ Hospital no encontrado en BD');
        return { 
          success: false, 
          error: 'No existe un hospital registrado con este correo' 
        };
      }

      // 2. Autenticar con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('❌ Error en Supabase Auth:', authError);
        const rawMessage = String(authError?.message || '').toLowerCase();
        if (rawMessage.includes('email not confirmed') || rawMessage.includes('not confirmed')) {
          return {
            success: false,
            error: 'Tu cuenta aún no ha sido confirmada. Revisa tu correo y haz clic en el enlace de verificación.'
          };
        }
        return { 
          success: false, 
          error: 'Contraseña incorrecta o cuenta no verificada' 
        };
      }

      console.log('✅ Auth exitosa, obteniendo datos completos...');

      // 3. Obtener datos completos del hospital
      const { data: hospital, error: hospitalError } = await supabase
        .from('hospitals')
        .select('*')
        .eq('email', email)
        .single();

      if (hospitalError || !hospital) {
        console.error('❌ Error obteniendo datos del hospital:', hospitalError);
        return { 
          success: false, 
          error: 'Error al obtener datos del hospital' 
        };
      }

      console.log('✅ Login exitoso para hospital:', hospital.name);

      // 4. ⚠️ IMPORTANTE: Retornar con rol 'hospital_admin' (NO 'hospital')
      return {
        success: true,
        user: {
          id: authData.user.id,
          email: email,
          role: 'hospital_admin', // ✅ ROL CORRECTO
          nombre: hospital.name,
          hospitalId: hospital.hospital_id,
          hospital_name: hospital.name,
          ciudad: hospital.city,
          direccion: hospital.address
        }
      };

    } catch (error) {
      console.error('💥 Error inesperado en loginHospital:', error);
      return { 
        success: false, 
        error: 'Error del servidor: ' + error.message 
      };
    }
  },

  /**
   * Login para PACIENTES
   * ⚠️ CRÍTICO: Siempre debe retornar role: 'patient'
   */
  async loginPatient(identifier, password) {
    try {
      console.log('👤 authService.loginPatient - Iniciando...');
      console.log('🔍 Identifier:', identifier);

      let patient = null;

      // Buscar por documento o email
      if (!identifier.includes('@')) {
        console.log('🔍 Buscando por documento...');
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('document', identifier)
          .maybeSingle();
        
        if (error) {
          console.error('❌ Error buscando paciente:', error);
          return { 
            success: false, 
            error: 'Error del servidor al buscar paciente' 
          };
        }
        
        patient = data;
      } else {
        console.log('🔍 Buscando por email...');
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('email', identifier)
          .maybeSingle();
        
        if (error) {
          console.error('❌ Error buscando paciente:', error);
          return { 
            success: false, 
            error: 'Error del servidor al buscar paciente' 
          };
        }
        
        patient = data;
      }

      if (!patient) {
        console.error('❌ Paciente no encontrado');
        return { 
          success: false, 
          error: 'Documento/correo no encontrado en el sistema' 
        };
      }

      console.log('✅ Paciente encontrado:', patient.name);

      // Validar contraseña
      // TODO: Implementar hash de contraseñas
      // Por ahora acepta: 'password123' o el documento del paciente
      if (password !== 'password123' && password !== patient.document) {
        console.error('❌ Contraseña incorrecta');
        return { 
          success: false, 
          error: 'Contraseña incorrecta' 
        };
      }

      console.log('✅ Login exitoso para paciente:', patient.name);

      // ⚠️ CRÍTICO: Retornar con role: 'patient' (EXACTAMENTE esta cadena)
      return {
        success: true,
        user: {
          id: patient.patient_id,
          email: patient.email,
          role: 'patient', // ✅ ROL CORRECTO PARA PACIENTES
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

  async loginDoctor(email, password) {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { data: rpcData, error: rpcError } = await supabase
        .rpc('doctor_login', {
          p_email: normalizedEmail,
          p_password: String(password || '')
        });

      if (rpcError) {
        const message = rpcError?.message || '';
        const isMissingFn =
          message.toLowerCase().includes('function') &&
          message.toLowerCase().includes('doctor_login') &&
          message.toLowerCase().includes('does not exist');

        const isAmbiguousDoctorId =
          message.toLowerCase().includes('doctor_id') &&
          message.toLowerCase().includes('ambiguous');

        const isResultShapeMismatch = message
          .toLowerCase()
          .includes('structure of query does not match function result type');

        if (isMissingFn || isAmbiguousDoctorId || isResultShapeMismatch) {
          const { data: doctor, error } = await supabase
            .from('staff')
            .select('doctor_id, doctor_name, doctor_email, doctor_password, doctor_specialty, hospital_id, is_active')
            .eq('doctor_email', normalizedEmail)
            .maybeSingle();

          if (!error && doctor) {
            if (doctor.is_active === false) return { success: false, error: 'Doctor inactivo' };
            if ((doctor.doctor_password || '') !== String(password || '')) {
              return { success: false, error: 'Contraseña incorrecta' };
            }

            let hospitalName = null;
            if (doctor.hospital_id) {
              const { data: hospital, error: hospitalError } = await supabase
                .from('hospitals')
                .select('hospital_id, name')
                .eq('hospital_id', doctor.hospital_id)
                .maybeSingle();

              if (!hospitalError) {
                hospitalName = hospital?.name || null;
              }
            }

            return {
              success: true,
              user: {
                id: doctor.doctor_id,
                doctor_id: doctor.doctor_id,
                email: doctor.doctor_email,
                role: 'doctor',
                nombre: doctor.doctor_name,
                doctor_specialty: doctor.doctor_specialty,
                hospitalId: doctor.hospital_id || null,
                hospital_name: hospitalName
              }
            };
          }

          if (isAmbiguousDoctorId) {
            return { success: false, error: 'Error en la función doctor_login (doctor_id ambiguo). Aplique el script SQL corregido.' };
          }

          if (isResultShapeMismatch) {
            return { success: false, error: 'Error en la función doctor_login (estructura no coincide). Aplique el script SQL corregido.' };
          }

          return { success: false, error: 'Falta configurar la función doctor_login en la base de datos' };
        }

        return { success: false, error: rpcError.message || 'Error consultando doctores' };
      }

      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!row?.success) {
        return { success: false, error: row?.message || 'No se pudo iniciar sesión' };
      }

      return {
        success: true,
        user: {
          id: row.doctor_id,
          doctor_id: row.doctor_id,
          email: row.doctor_email,
          role: 'doctor',
          nombre: row.doctor_name,
          doctor_specialty: row.doctor_specialty,
          hospitalId: row.hospital_id || null,
          hospital_name: row.hospital_name || null
        }
      };
    } catch (error) {
      return { success: false, error: error.message || 'Error del servidor: ' + error.message };
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
