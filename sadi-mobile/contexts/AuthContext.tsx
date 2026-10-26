import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { kvStore } from '@/lib/kvStore';
import { authService } from '@/services/authService';

export type SadiRole = 'hospital_admin' | 'doctor' | 'patient';

export type SadiUser =
  | {
      role: 'hospital_admin';
      id: string;
      email: string;
      nombre: string | null;
      hospitalId: string;
      hospital_name: string | null;
    }
  | {
      role: 'doctor';
      id: string;
      email: string;
      nombre: string | null;
      doctor_specialty: string | null;
      hospitalId: string | null;
      hospital_name: string | null;
    }
  | {
      role: 'patient';
      id: string;
      email: string | null;
      nombre: string | null;
      documento: string;
      telefono: string | null;
      hospitalId: string | null;
    };

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  user: SadiUser | null;
  loginHospital: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginDoctor: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginPatient: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'sadi_custom_user_v1';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SadiUser | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');

    const hospital = await authService.restoreHospitalSession();
    if (hospital?.success && hospital.user) {
      setUser(hospital.user);
      setStatus('signedIn');
      return;
    }

    const stored = await kvStore.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SadiUser;
        if (parsed && typeof parsed === 'object' && typeof (parsed as any).role === 'string') {
          setUser(parsed);
          setStatus('signedIn');
          return;
        }
      } catch {
      }
    }

    setUser(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    load();

    const { data } = supabase.auth.onAuthStateChange(async () => {
      await load();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [load]);

  const loginHospital = useCallback(async (email: string, password: string) => {
    const res = await authService.loginHospital(email, password);
    if (!res.success || !res.user) {
      setUser(null);
      setStatus('signedOut');
      return { success: false, error: res.error || 'No fue posible iniciar sesión' };
    }
    await kvStore.deleteItem(STORAGE_KEY);
    setUser(res.user);
    setStatus('signedIn');
    return { success: true };
  }, []);

  const loginDoctor = useCallback(async (email: string, password: string) => {
    const res = await authService.loginDoctor(email, password);
    if (!res.success || !res.user) {
      setUser(null);
      setStatus('signedOut');
      return { success: false, error: res.error || 'No fue posible iniciar sesión' };
    }
    await kvStore.setItem(STORAGE_KEY, JSON.stringify(res.user));
    setUser(res.user);
    setStatus('signedIn');
    return { success: true };
  }, []);

  const loginPatient = useCallback(async (identifier: string, password: string) => {
    const res = await authService.loginPatient(identifier, password);
    if (!res.success || !res.user) {
      setUser(null);
      setStatus('signedOut');
      return { success: false, error: res.error || 'No fue posible iniciar sesión' };
    }
    await kvStore.setItem(STORAGE_KEY, JSON.stringify(res.user));
    setUser(res.user);
    setStatus('signedIn');
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await kvStore.deleteItem(STORAGE_KEY);
    await supabase.auth.signOut().catch(() => null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, loginHospital, loginDoctor, loginPatient, logout }),
    [status, user, loginHospital, loginDoctor, loginPatient, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
