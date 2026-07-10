// ============================================
//  AuthContext.jsx - FLUJOS SEPARADOS PACIENTES/HOSPITALES
// ============================================
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { authService } from '@/services/authService';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const inactivityTimeoutIdRef = useRef(null);
  const sessionRefreshInFlightRef = useRef(false);

  useEffect(() => {
    console.log('🔄 AuthProvider: Verificando sesión...');
    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        console.log('🔔 Auth cambió:', event, session ? 'Con sesión' : 'Sin sesión');
        
        const storedUser = localStorage.getItem('sadi_user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            if (parsedUser.role === 'patient' || parsedUser.role === 'doctor') {
              console.log('ℹ️ Usuario es paciente, ignorando evento de auth');
              return;
            }
          } catch (e) {
            // Continuar con el procesamiento normal
          }
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('👋 Usuario cerró sesión');
          handleSignOut();
        } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          console.log('👤 Usuario inició sesión, cargando datos...');
          await loadUser(session);
        } else if (event === 'PASSWORD_RECOVERY') {
          console.log('🔑 Flujo de recuperación de contraseña detectado');
          // No cargamos los datos para no redirigir automáticamente fuera de la página de reseteo
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token renovado');
          if (!session) {
            console.warn('⚠️ Token renovado pero sin sesión - sesión expiró');
            handleSignOut();
          }
        } else if (event === 'USER_UPDATED' && session) {
          console.log('👤 Usuario actualizado');
          await loadUser(session);
        }
      } catch (e) {
        handleSignOut();
      } finally {
        setLoading(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role !== 'patient' && user.role !== 'doctor') return;

    const inactivityMs = 10 * 60 * 1000;
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

    const resetTimer = () => {
      if (inactivityTimeoutIdRef.current) {
        clearTimeout(inactivityTimeoutIdRef.current);
      }
      inactivityTimeoutIdRef.current = setTimeout(() => {
        logout({ reason: 'inactivity' });
      }, inactivityMs);
    };

    resetTimer();
    events.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (inactivityTimeoutIdRef.current) {
        clearTimeout(inactivityTimeoutIdRef.current);
        inactivityTimeoutIdRef.current = null;
      }
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [user, loading]);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === 'patient' || user.role === 'doctor') return;

    const refresh = async () => {
      if (sessionRefreshInFlightRef.current) return;
      sessionRefreshInFlightRef.current = true;
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          try {
            await supabase.auth.signOut();
          } catch (e) {}
          handleSignOut();
          return;
        }

        const expiresAtMs = (session.expires_at || 0) * 1000;
        const msToExpire = expiresAtMs ? expiresAtMs - Date.now() : 0;
        if (msToExpire > 2 * 60 * 1000) return;

        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data?.session) {
          try {
            await supabase.auth.signOut();
          } catch (e) {}
          handleSignOut();
        }
      } catch (e) {
        try {
          await supabase.auth.signOut();
        } catch (err) {}
        handleSignOut();
      } finally {
        sessionRefreshInFlightRef.current = false;
      }
    };

    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    const intervalId = setInterval(() => {
      refresh();
    }, 60 * 1000);

    refresh();

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(intervalId);
    };
  }, [user, loading]);

  const initializeAuth = async () => {
    try {
      console.log('🔐 Inicializando autenticación...');
      
      const storedUser = localStorage.getItem('sadi_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('📦 Usuario encontrado en localStorage:', parsedUser.email, 'Rol:', parsedUser.role);
          
          if (parsedUser.role === 'patient' || parsedUser.role === 'doctor') {
            console.log('✅ Restaurando sesión de paciente desde localStorage');
            setUser(parsedUser);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('⚠️ Error parseando usuario de localStorage');
          localStorage.removeItem('sadi_user');
        }
      }

      console.log('🔍 Verificando sesión de Supabase para usuario de hospital...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Error obteniendo sesión:', sessionError);
        setUser(null);
        setLoading(false);
        return;
      }

      if (!session) {
        console.log('ℹ️ No hay sesión activa de Supabase');
        localStorage.removeItem('sadi_user');
        localStorage.removeItem('authToken');
        setUser(null);
        setLoading(false);
        return;
      }

      console.log('✅ Sesión de Supabase válida:', session.user.email);
      await loadUser(session);
      
    } catch (error) {
      console.error('❌ Error inicializando auth:', error);
      setUser(null);
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem('sadi_user');
    localStorage.removeItem('authToken');
    setLoading(false);
  };

  const loadUser = async (sessionOverride = null) => {
    try {
      console.log('📖 Cargando usuario de hospital...');
      
      const sessionResult = sessionOverride
        ? { data: { session: sessionOverride }, error: null }
        : await supabase.auth.getSession();
      
      const session = sessionResult?.data?.session || null;
      const sessionError = sessionResult?.error || null;

      if (sessionError || !session) {
        console.log('⚠️ No hay sesión válida de Supabase');
        setUser(null);
        setLoading(false);
        return;
      }

      const sessionUser = session.user;
      const metadata = sessionUser?.user_metadata || {};
      let userRole = metadata?.role || 'hospital_admin';

      if (userRole === 'hospital') {
        userRole = 'hospital_admin';
        console.log('🔧 Rol normalizado de "hospital" a "hospital_admin"');
      }

      const sessionEmail = sessionUser?.email || null;
      const sessionUserId = sessionUser?.id || null;

      const { data: hospitalById } = sessionUserId
        ? await supabase
          .from('hospitals')
          .select('*')
          .eq('hospital_id', sessionUserId)
          .maybeSingle()
        : { data: null };

      const { data: hospitalByEmail } = !hospitalById && sessionEmail
        ? await supabase
          .from('hospitals')
          .select('*')
          .eq('email', sessionEmail)
          .maybeSingle()
        : { data: null };

      const hospital = hospitalById || hospitalByEmail || null;

      const resolvedHospitalId =
        hospital?.hospital_id ||
        metadata?.hospital_id ||
        sessionUserId ||
        null;

      const userData = {
        id: sessionUserId,
        email: sessionEmail,
        role: userRole,
        nombre: hospital?.name || metadata?.nombre || sessionEmail,
        hospitalId: resolvedHospitalId,
        hospital_name: hospital?.name || metadata?.hospital_name,
        ciudad: hospital?.city,
        direccion: hospital?.address,
        ...metadata
      };

      setUser(userData);
      localStorage.setItem('sadi_user', JSON.stringify(userData));
    } catch (error) {
      console.error('❌ Error cargando usuario:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // LOGIN PARA PACIENTES - FLUJO COMPLETAMENTE SEPARADO
  // ============================================
  const loginPatient = async (identifier, password) => {
    try {
      console.log('🏥 loginPatient - Iniciando login de PACIENTE con:', identifier);

      const isEmail = identifier.includes('@');
      console.log(`📋 Tipo de identificador: ${isEmail ? 'EMAIL' : 'DOCUMENTO'}`);

      // Verificar si existe el paciente
      console.log('🔍 Buscando paciente en base de datos...');
      
      const { data: patientCheck, error: patientCheckError } = await supabase
        .from('patients')
        .select('patient_id, name, email, document, password_hash, hospital_id')
        .or(isEmail 
          ? `email.eq.${identifier.trim().toLowerCase()}`
          : `document.eq.${identifier.trim()}`)
        .maybeSingle();

      if (patientCheckError) {
        console.error('❌ Error verificando paciente:', patientCheckError);
        throw new Error('Error al verificar el paciente');
      }

      if (!patientCheck) {
        console.log('❌ Paciente NO encontrado');
        return { 
          success: false, 
          error: 'Usuario no encontrado. Verifique su documento o correo.' 
        };
      }

      console.log('✅ Paciente encontrado:', patientCheck.name);

      // Autenticar paciente
      console.log('🔐 Autenticando paciente...');
      
      const { data: patientData, error: patientError } = await supabase
        .rpc('patient_login', {
          p_identifier: identifier.trim(),
          p_password: password
        });

      if (patientError) {
        console.error('❌ Error en autenticación:', patientError);
        throw new Error(patientError.message || 'Error en la autenticación');
      }

      if (!patientData) {
        throw new Error('La función de login no retornó datos');
      }

      const loginResult = Array.isArray(patientData) ? patientData[0] : patientData;

      if (loginResult.success === true) {
        console.log('✅ Autenticación de paciente EXITOSA');

        const normalizedUser = {
          id: loginResult.patient_id,
          email: loginResult.email,
          role: 'patient',
          nombre: loginResult.name,
          documento: loginResult.document,
          telefono: null,
          hospitalId: patientCheck?.hospital_id || loginResult?.hospital_id || null,
          hospital_name: null
        };

        setUser(normalizedUser);
        localStorage.setItem('sadi_user', JSON.stringify(normalizedUser));

        toast({
          title: "Bienvenido",
          description: `Hola ${normalizedUser.nombre}`,
        });

        return { 
          success: true, 
          role: 'patient', 
          user: normalizedUser 
        };
      } else {
        const errorMsg = loginResult.message || 'Contraseña incorrecta';
        console.log('❌ Autenticación falló:', errorMsg);
        
        return { success: false, error: errorMsg };
      }

    } catch (error) {
      console.error('💥 Error en loginPatient:', error);
      return { success: false, error: error.message || 'Error al procesar el inicio de sesión' };
    }
  };

  // ============================================
  // LOGIN PARA HOSPITALES - FLUJO COMPLETAMENTE SEPARADO
  // ============================================
  const loginHospital = async (email, password) => {
    try {
      console.log('🏥 loginHospital - Iniciando login de HOSPITAL con:', email);

      if (!email.includes('@')) {
        console.log('❌ No es un email válido');
        return { 
          success: false, 
          error: 'Debe ingresar un correo electrónico válido' 
        };
      }

      // Verificar si existe el hospital
      console.log('🔍 Buscando hospital en base de datos...');
      
      const { data: hospitalExists, error: checkError } = await supabase
        .from('hospitals')
        .select('hospital_id, name, email')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (checkError) {
        console.error('❌ Error verificando hospital:', checkError);
        return { 
          success: false, 
          error: 'Error del sistema al verificar el usuario' 
        };
      }

      if (!hospitalExists) {
        console.log('❌ Hospital NO encontrado');
        return { 
          success: false, 
          error: 'Hospital no registrado en el sistema' 
        };
      }

      console.log('✅ Hospital encontrado:', hospitalExists.name);

      // Autenticar hospital
      console.log('🔐 Autenticando hospital...');
      
      const result = await authService.login(email, password);

      if (!result.success) {
        console.error('❌ Login de hospital falló:', result.error);
        return result;
      }

      console.log('✅ Autenticación de hospital EXITOSA');

      if (result.data?.token) {
        localStorage.setItem('authToken', result.data.token);
      }

      const userData = result.user;
      let userRole = userData.role;
      
      if (userRole === 'hospital') {
        userRole = 'hospital_admin';
      }

      const normalizedUser = {
        id: userData.id,
        email: userData.email,
        role: userRole,
        nombre: userData.nombre || userData.hospital_name || 'Usuario',
        hospitalId: userData.hospitalId,
        hospital_name: userData.hospital_name,
        ciudad: userData.ciudad,
        direccion: userData.direccion,
        documento: userData.documento,
        telefono: userData.telefono,
        ...userData
      };

      setUser(normalizedUser);
      localStorage.setItem('sadi_user', JSON.stringify(normalizedUser));

      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido ${normalizedUser.nombre}`,
      });

      return { success: true, role: normalizedUser.role, user: normalizedUser };

    } catch (error) {
      console.error('💥 Error en loginHospital:', error);
      return { success: false, error: error.message || 'Error al procesar el inicio de sesión' };
    }
  };

  const loginDoctor = async (email, password) => {
    try {
      console.log('🩺 loginDoctor - Iniciando login de DOCTOR con:', email);

      if (!email.includes('@')) {
        return { success: false, error: 'Debe ingresar un correo electrónico válido' };
      }

      const result = await authService.loginDoctor(email, password);

      if (!result.success) {
        return result;
      }

      const doctor = result.user;

      const normalizedUser = {
        id: doctor.id,
        email: doctor.email,
        role: 'doctor',
        nombre: doctor.nombre || doctor.email,
        doctor_id: doctor.doctor_id,
        doctor_specialty: doctor.doctor_specialty,
        hospitalId: doctor.hospitalId || null,
        hospital_name: doctor.hospital_name || null,
        ...doctor
      };

      setUser(normalizedUser);
      localStorage.setItem('sadi_user', JSON.stringify(normalizedUser));

      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido ${normalizedUser.email}`,
      });

      return { success: true, role: normalizedUser.role, user: normalizedUser };
    } catch (error) {
      console.error('💥 Error en loginDoctor:', error);
      return { success: false, error: error.message || 'Error al procesar el inicio de sesión' };
    }
  };

  // ============================================
  // LOGIN GENÉRICO (DEPRECADO - Usa loginPatient o loginHospital)
  // ============================================
  const login = async (identifier, password) => {
    console.warn('⚠️ Usando login() genérico - Se recomienda usar loginPatient() o loginHospital()');
    
    // Determinar automáticamente si es paciente u hospital
    const isEmail = identifier.includes('@');
    
    if (isEmail) {
      // Si es email, intentar como hospital primero
      const hospitalResult = await loginHospital(identifier, password);
      if (hospitalResult.success) {
        return hospitalResult;
      }
      
      // Si falla, intentar como paciente
      return await loginPatient(identifier, password);
    } else {
      // Si es documento, solo puede ser paciente
      return await loginPatient(identifier, password);
    }
  };

  const registerHospital = async (hospitalData) => {
    try {
      console.log('📝 Registrando hospital:', hospitalData.email);

      const result = await authService.registerHospital(hospitalData);

      if (result.success) {
        toast({
          title: "Registro exitoso",
          description: result.message || `Se ha enviado un correo de verificación a ${hospitalData.email}`,
          duration: 10000,
        });
        return { success: true };
      }

      toast({
        title: "Error en el registro",
        description: result.error || "No se pudo completar el registro",
        variant: "destructive",
      });

      return result;

    } catch (error) {
      console.error('❌ Error registrando hospital:', error);
      
      toast({
        title: "Error en el registro",
        description: error.message || "Error al registrar hospital",
        variant: "destructive",
      });
      
      return { success: false, error: error.message };
    }
  };

  const logout = async (options = {}) => {
    try {
      console.log('🚪 Cerrando sesión...');
      
      if (user?.role !== 'patient' && user?.role !== 'doctor') {
        await authService.logout();
      }
      
      handleSignOut();
      
      console.log('✅ Sesión cerrada');

      const isInactivity = options?.reason === 'inactivity';
      toast({
        title: isInactivity ? "Sesión cerrada por inactividad" : "Sesión cerrada",
        description: isInactivity
          ? "Por seguridad, cerramos tu sesión tras 10 minutos sin actividad."
          : "Has cerrado sesión exitosamente",
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error en logout:', error);
      handleSignOut();
      return { success: false, error: error.message };
    }
  };

  const updatePassword = async (oldPassword, newPassword) => {
    try {
      if (user?.role === 'patient') {
        const { data, error } = await supabase
          .rpc('change_patient_password', {
            p_patient_id: user.id,
            p_old_password: oldPassword,
            p_new_password: newPassword
          });

        if (error) throw error;

        if (data && data.length > 0 && data[0].success) {
          toast({
            title: "Contraseña actualizada",
            description: "Tu contraseña ha sido cambiada exitosamente",
          });
          return { success: true };
        } else {
          const errorMsg = data?.[0]?.message || "No se pudo cambiar la contraseña";
          toast({
            title: "Error",
            description: errorMsg,
            variant: "destructive",
          });
          return { success: false, error: errorMsg };
        }
      }

      const result = await authService.updatePassword(newPassword);
      
      if (result.success) {
        toast({
          title: "Contraseña actualizada",
          description: "Tu contraseña ha sido cambiada exitosamente",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo cambiar la contraseña",
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error cambiando contraseña:', error);
      toast({
        title: "Error",
        description: error.message || "Error al cambiar la contraseña",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const hasRole = (role) => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };

  const isSuperAdmin = () => user?.role === 'super_admin';
  const isHospitalAdmin = () => user?.role === 'hospital_admin' || user?.role === 'operator';
  const isPatient = () => user?.role === 'patient';
  const isDoctor = () => user?.role === 'doctor';
  const getHospitalId = () => user?.hospitalId || null;
  const getHospitalName = () => user?.hospital_name || null;

  const value = {
    user,
    loading,
    login,              // Genérico (deprecado)
    loginPatient,       // ✅ NUEVO: Específico para pacientes
    loginHospital,      // ✅ NUEVO: Específico para hospitales
    loginDoctor,
    logout,
    registerHospital,
    updatePassword,
    hasRole,
    isSuperAdmin,
    isHospitalAdmin,
    isPatient,
    isDoctor,
    getHospitalId,
    getHospitalName,
    reload: loadUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
