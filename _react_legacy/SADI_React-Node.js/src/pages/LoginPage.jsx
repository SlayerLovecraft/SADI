import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Mail,
  Lock,
  AlertCircle,
  ArrowLeft,
  Building2,
  Stethoscope,
  Smartphone,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { authService } from '@/services/authService';

const LoginPage = ({ initialMode = 'hospital' }) => {
  const [mode, setMode] = useState(initialMode === 'doctor' ? 'doctor' : 'hospital');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { loginHospital, loginDoctor, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    setMode(initialMode === 'doctor' ? 'doctor' : 'hospital');
    setErrorMessage('');
  }, [initialMode]);

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'doctor') {
        navigate('/doctor/dashboard', { replace: true });
      } else if (user.role !== 'patient' && user.role !== 'paciente') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const result =
        mode === 'doctor'
          ? await loginDoctor(email, password)
          : await loginHospital(email, password);

      if (result.success) {
        navigate(mode === 'doctor' ? '/doctor/dashboard' : '/dashboard', { replace: true });
        return;
      }

      // Si el correo pertenece al otro perfil institucional, sugerir cambio con 1 clic
      if (result.portal === 'doctor' && mode !== 'doctor') {
        setErrorMessage('Este correo es de Médico / Personal. Cambia arriba a "Médico / Personal" para entrar.');
      } else if (result.portal === 'hospital' && mode !== 'hospital') {
        setErrorMessage('Este correo es de Hospital / Admin. Cambia arriba a "Hospital / Admin" para entrar.');
      } else {
        setErrorMessage(result.error || 'Correo o contraseña incorrectos.');
      }

      toast({
        title: 'No se pudo iniciar sesión',
        description: result.error || 'Verifica tu correo y contraseña',
        variant: 'destructive',
      });
    } catch (error) {
      const msg = error?.message || 'Ocurrió un error al intentar ingresar.';
      setErrorMessage(msg);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setErrorMessage('Escribe tu correo para enviarte el enlace de recuperación.');
      return;
    }

    try {
      const result = await authService.forgotPassword(resetEmail.trim(), 'staff');
      if (result.success) {
        toast({
          title: 'Enlace enviado',
          description: `Revisa tu correo ${resetEmail.trim()} para cambiar tu contraseña.`,
        });
        setResetEmail('');
        setShowForgotPassword(false);
        setErrorMessage('');
      } else {
        setErrorMessage(result.error || 'No se pudo enviar el correo de recuperación.');
      }
    } catch {
      setErrorMessage('No se pudo enviar el correo de recuperación.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="text-sm text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <>
        <Helmet>
          <title>Recuperar Contraseña - SADI</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/60 to-indigo-50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setErrorMessage('');
              }}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </button>

            <div className="text-center mb-6">
              <img src="/images/SADI_logo.png" alt="SADI" className="h-16 w-auto mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-slate-900">Recuperar contraseña</h1>
              <p className="text-sm text-slate-500 mt-1">
                Escribe tu correo institucional y te enviaremos los pasos.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <Label htmlFor="reset-email" className="text-slate-700 font-medium">
                  Correo electrónico
                </Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="tu.correo@hospital.com"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full py-3 rounded-xl text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white">
                Enviar enlace
              </Button>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{mode === 'doctor' ? 'Ingreso Médico - SADI' : 'Iniciar Sesión - SADI'}</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/60 to-indigo-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8">
          {/* Logo y bienvenida */}
          <div className="text-center mb-7">
            <img src="/images/SADI_logo.png" alt="SADI" className="h-16 w-auto mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-slate-900">Bienvenido a SADI</h1>
            <p className="text-sm text-slate-500 mt-1">
              Elige cómo deseas ingresar y escribe tus datos
            </p>
          </div>

          {/* Selector claro de perfil (solo Hospital o Médico) */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl mb-6" role="tablist" aria-label="Tipo de acceso">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'hospital'}
              onClick={() => handleModeChange('hospital')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                mode === 'hospital'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="h-4 w-4" />
              Hospital / Admin
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'doctor'}
              onClick={() => handleModeChange('doctor')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                mode === 'doctor'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="h-4 w-4" />
              Médico / Personal
            </button>
          </div>

          {/* Error claro */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Formulario simple */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-slate-700 font-medium">
                Correo electrónico
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage('');
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={mode === 'doctor' ? 'nombre@sadi.med.co' : 'correo@hospital.com'}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="password" className="text-slate-700 font-medium">
                  Contraseña
                </Label>
                {mode === 'hospital' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setErrorMessage('');
                    }}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  className="w-full pl-10 pr-11 py-3 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Escribe tu contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {isSubmitting
                ? 'Ingresando...'
                : mode === 'doctor'
                ? 'Entrar como Médico / Personal'
                : 'Entrar como Hospital / Admin'}
            </Button>
          </form>

          {/* Nota discreta sobre pacientes (solo app móvil) */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500 text-center">
            <Smartphone className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span>¿Eres paciente? Ingresa desde la aplicación móvil de SADI.</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
