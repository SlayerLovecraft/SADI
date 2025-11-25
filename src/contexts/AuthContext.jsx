// ============================================
// src/contexts/AuthContext.jsx - CON API INTEGRADA
// ============================================
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import api from '@/services/api';
import { authService } from '@/services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Helper for safe JSON parsing (fallback a localStorage)
  const safeParse = (key, fallback) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (error) {
      console.error(`Error parsing ${key} from localStorage:`, error);
      localStorage.removeItem(key);
      return fallback;
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Verificar autenticación al cargar la app
  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (token) {
        // Intentar validar el token con el backend
        const response = await api.get('/auth/me');
        
        if (response.data && response.data.user) {
          setUser(response.data.user);
        } else {
          // Si no hay respuesta válida, limpiar token
          localStorage.removeItem('authToken');
          setUser(null);
        }
      } else {
        // Si no hay token, intentar cargar usuario de localStorage (modo fallback)
        const storedUser = safeParse('sadi_user', null);
        if (storedUser) {
          setUser(storedUser);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      // Si falla la validación con API, usar localStorage como fallback
      localStorage.removeItem('authToken');
      const storedUser = safeParse('sadi_user', null);
      if (storedUser) {
        setUser(storedUser);
      }
    } finally {
      setLoading(false);
    }
  };

  // Inicializar datos locales (fallback si no hay backend)
  const initializeLocalData = () => {
    try {
      if (!localStorage.getItem('sadi_hospitals')) {
        const hospitals = [
          { id: 'h1', name: 'Hospital Esperanza SADI', email: 'admin@esperanza.com', verified: true }
        ];
        localStorage.setItem('sadi_hospitals', JSON.stringify(hospitals));
      }

      if (!localStorage.getItem('sadi_users')) {
        const users = [
          { id: 'u1', email: 'admin@sadi.com', password: 'admin123', role: 'super_admin', nombre: 'Super Admin SADI' },
          { id: 'u2', email: 'operador@sadi.com', password: 'operador123', role: 'operator', nombre: 'Operador SADI' },
          { id: 'u3', email: 'admin@esperanza.com', password: 'sadisalud2025!', role: 'hospital_admin', nombre: 'Admin Hospital Esperanza', hospitalId: 'h1' },
          { id: 'p1', email: 'andresds2001@gmail.com', password: 'password123', role: 'patient', nombre: 'Andrés Senon Dueñas Sánchez', cc: '1006010518', hospitalId: 'h1' }
        ];
        localStorage.setItem('sadi_users', JSON.stringify(users));
      }

      if (!localStorage.getItem('sadi_patients')) {
        const patients = [
          { 
            id: 'p1', nombre: 'Andrés Senon Dueñas Sánchez', cc: '1006010518',
            fechaNacimiento: '2001-12-16', edad: 23, sexo: 'M', 
            direccion: 'Calle 15 #14-112 Palmira Valle', email: 'andresds2001@gmail.com',
            telefono: '323 2052148', ciudad: 'Palmira', programa: 'Cardiología', 
            estadoSalud: 'Saludable', hospitalId: 'h1', fechaRegistro: '2025-11-01' 
          }
        ];
        localStorage.setItem('sadi_patients', JSON.stringify(patients));
      }
    } catch (err) {
      console.error("Error initializing data:", err);
    }
  };

  const login = async (identifier, password) => {
    try {
      // Intentar login con API
      const result = await authService.login(identifier, password);
      
      if (result.success && result.data) {
        // Guardar token y usuario
        if (result.data.token) {
          localStorage.setItem('authToken', result.data.token);
        }
        
        const userData = result.data.user || result.data;
        setUser(userData);
        localStorage.setItem('sadi_user', JSON.stringify(userData));
        
        return { success: true, role: userData.role };
      }
      
      // Si falla la API, intentar con datos locales
      console.warn('API login failed, trying local fallback');
      return loginLocal(identifier, password);
      
    } catch (error) {
      console.error('Login error:', error);
      // Fallback a login local
      return loginLocal(identifier, password);
    }
  };

  // Login local (fallback)
  const loginLocal = (identifier, password) => {
    try {
      initializeLocalData();
      const users = safeParse('sadi_users', []);
      const foundUser = users.find(u => 
        (u.email === identifier || u.cc === identifier) && u.password === password
      );
      
      if (foundUser) {
        const { password, ...userWithoutPassword } = foundUser;
        setUser(userWithoutPassword);
        localStorage.setItem('sadi_user', JSON.stringify(userWithoutPassword));
        return { success: true, role: userWithoutPassword.role };
      }
      
      return { success: false, error: 'Credenciales inválidas' };
    } catch (error) {
      return { success: false, error: 'Error al procesar el inicio de sesión' };
    }
  };

  const registerHospital = async (data) => {
    try {
      // Intentar registro con API
      const result = await authService.registerHospital(data);
      
      if (result.success) {
        toast({
          title: "Registro exitoso",
          description: `Se ha enviado un correo de verificación a ${data.email}`,
          duration: 10000,
        });
        return { success: true };
      }
      
      return result;
      
    } catch (error) {
      console.error('Register error:', error);
      // Fallback a registro local
      return registerHospitalLocal(data);
    }
  };

  // Registro local (fallback)
  const registerHospitalLocal = (data) => {
    try {
      const hospitals = safeParse('sadi_hospitals', []);
      const users = safeParse('sadi_users', []);

      if (users.find(u => u.email === data.email)) {
        return { success: false, error: 'El correo ya está registrado' };
      }

      const newHospitalId = `h${Date.now()}`;
      const newHospital = {
        id: newHospitalId,
        name: data.hospitalName,
        email: data.email,
        verified: false
      };

      const newUser = {
        id: `u${Date.now()}`,
        email: data.email,
        password: 'sadisalud2025!',
        role: 'hospital_admin',
        nombre: data.adminName,
        hospitalId: newHospitalId
      };

      localStorage.setItem('sadi_hospitals', JSON.stringify([...hospitals, newHospital]));
      localStorage.setItem('sadi_users', JSON.stringify([...users, newUser]));

      toast({
        title: "Registro exitoso",
        description: `Se ha enviado un correo de verificación a ${data.email}. Contraseña temporal: sadisalud2025!`,
        duration: 10000,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Error al registrar hospital' };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('sadi_user');
      localStorage.removeItem('authToken');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, registerHospital, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};