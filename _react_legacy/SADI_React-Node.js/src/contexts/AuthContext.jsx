// ============================================
//  AuthContext.jsx - FLUJOS SEPARADOS PACIENTES/HOSPITALES
// ============================================
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { authService } from '@/services/authService';
import { supabase } from '@/lib/supabase';
import { runWithSupabaseAuthRecovery } from '@/lib/utils';
import { normalizeCursosArray } from '@/services/cursoVidaConfig';

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
            if (parsedUser.role === 'patient' || parsedUser.role === 'doctor' || parsedUser.role === 'hospital_admin' || parsedUser.role === 'super_admin' || parsedUser.role === 'operator') {
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
    if (user.role === 'patient' || user.role === 'doctor' || user.role === 'hospital_admin' || user.role === 'super_admin' || user.role === 'operator') return;

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

  const syncDoctorProfile = async (doctorUser) => {
    if (!doctorUser || doctorUser.role !== 'doctor') return doctorUser;
    const docId = doctorUser.doctor_id || doctorUser.id;
    const docEmail = (doctorUser.email || '').trim().toLowerCase();
    if (!docId && !docEmail) return doctorUser;

    try {
      const selectCols =
        'doctor_id, doctor_name, doctor_email, doctor_specialty, rol, cursos_vida_asignados, solo_lectura, puede_lanzar_llamadas, puede_enviar_mensajes, puede_crear_campanas, puede_editar_pacientes, hospital_id, is_active';

      let { data: staffDoc, error } = docId
        ? await runWithSupabaseAuthRecovery(
            supabase,
            () => supabase.from('staff').select(selectCols).eq('doctor_id', docId).maybeSingle(),
            8000,
            'Timeout sincronizando perfil médico'
          )
        : { data: null, error: null };

      if ((!staffDoc || error) && docEmail) {
        const resByEmail = await runWithSupabaseAuthRecovery(
          supabase,
          () => supabase.from('staff').select(selectCols).eq('doctor_email', docEmail).maybeSingle(),
          8000,
          'Timeout sincronizando perfil médico por correo'
        );
        if (resByEmail?.data && !resByEmail?.error) {
          staffDoc = resByEmail.data;
          error = null;
        }
      }

      if (error || !staffDoc) return doctorUser;
      if (staffDoc.is_active === false) {
        handleSignOut();
        return null;
      }

      const synced = {
        ...doctorUser,
        id: staffDoc.doctor_id || doctorUser.id,
        doctor_id: staffDoc.doctor_id || doctorUser.doctor_id,
        email: staffDoc.doctor_email || doctorUser.email,
        nombre: staffDoc.doctor_name || doctorUser.nombre,
        doctor_specialty: staffDoc.doctor_specialty || doctorUser.doctor_specialty,
        rol: staffDoc.rol || doctorUser.rol || 'Enfermera',
        cursos_vida_asignados: normalizeCursosArray(staffDoc.cursos_vida_asignados),
        solo_lectura: staffDoc.solo_lectura !== undefined ? Boolean(staffDoc.solo_lectura) : true,
        puede_lanzar_llamadas: Boolean(staffDoc.puede_lanzar_llamadas),
        puede_enviar_mensajes: Boolean(staffDoc.puede_enviar_mensajes),
        puede_crear_campanas: Boolean(staffDoc.puede_crear_campanas),
        puede_editar_pacientes: Boolean(staffDoc.puede_editar_pacientes),
        hospitalId: staffDoc.hospital_id || doctorUser.hospitalId,
      };

      localStorage.setItem('sadi_user', JSON.stringify(synced));
      return synced;
    } catch {
      return doctorUser;
    }
  };

  useEffect(() => {
    if (loading || !user || user.role !== 'doctor') return;

    const refreshDoctor = async () => {
      if (sessionRefreshInFlightRef.current) return;
      sessionRefreshInFlightRef.current = true;
      try {
        const synced = await syncDoctorProfile(user);
        if (synced && JSON.stringify(synced) !== JSON.stringify(user)) {
          setUser(synced);
        }
      } finally {
        sessionRefreshInFlightRef.current = false;
      }
    };

    const onFocus = () => refreshDoctor();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshDoctor();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
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
          
          if (parsedUser.role === 'doctor') {
            const syncedDoctor = await syncDoctorProfile(parsedUser);
            setUser(syncedDoctor);
            setLoading(false);
            return;
          }

          if (parsedUser.role === 'patient' || parsedUser.role === 'hospital_admin' || parsedUser.role === 'super_admin' || parsedUser.role === 'operator') {
            console.log('✅ Restaurando sesión desde localStorage');
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

      const result = await authService.loginPatient(identifier, password);

      if (!result.success) {
        return result;
      }

      const patient = result.user;

      const normalizedUser = {
        id: patient.id,
        email: patient.email,
        role: 'patient',
        nombre: patient.nombre || 'Paciente SADI',
        documento: patient.documento,
        telefono: patient.telefono || null,
        hospitalId: patient.hospitalId || null,
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

      const result = await authService.loginHospital(email, password);

      if (!result.success) {
        console.error('❌ Login de hospital falló:', result.error);
        return result;
      }

      console.log('✅ Autenticación de hospital EXITOSA');

      const userData = result.user;
      let userRole = userData.role;
      if (userRole === 'hospital') {
        userRole = 'hospital_admin';
      }

      const normalizedUser = {
        id: userData.id,
        email: userData.email,
        role: userRole,
        nombre: userData.nombre || userData.hospital_name || 'Personal Clínico SADI',
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
      if (!localStorage.getItem('authToken')) {
        localStorage.setItem('authToken', 'auth-token-' + (userData.id || 'admin'));
      }

      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido al Portal Administrativo`,
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

  const refreshProfile = async () => {
    if (user?.role === 'doctor') {
      const synced = await syncDoctorProfile(user);
      if (synced && JSON.stringify(synced) !== JSON.stringify(user)) {
        setUser(synced);
      }
      return synced;
    }
    return user;
  };

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
    refreshProfile,
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
