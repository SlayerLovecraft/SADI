import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const errorDescription = hashParams.get('error_description');
    
    if (errorDescription) {
      setErrorMessage(decodeURIComponent(errorDescription));
      setHasRecoverySession(false);
      setCheckingLink(false);
      return;
    }
    
    supabase.auth.getSession().then(({ data, error }) => {
      if (!error && data?.session) {
        setHasRecoverySession(true);
      }
      setCheckingLink(false);
    }).catch(() => {
      setCheckingLink(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setHasRecoverySession(true);
        setErrorMessage('');
      }
      if (event === 'SIGNED_OUT') {
        setHasRecoverySession(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    if (!hasRecoverySession) {
      setErrorMessage('El enlace ha expirado o es inválido. Por favor solicita uno nuevo desde el login.');
      setIsSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres');
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden');
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      toast({
        title: "✅ Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada exitosamente.",
        variant: "success",
      });

      // Redirigir al login después de 3 segundos
      setTimeout(() => {
        // Cerramos la sesión temporal para obligar al usuario a loguearse con su nueva clave
        supabase.auth.signOut().then(() => {
          navigate('/login', { replace: true });
        });
      }, 3000);

    } catch (error) {
      console.error('❌ Error actualizando contraseña:', error);
      let errorMsg = error.message || "No se pudo actualizar la contraseña";
      
      if (errorMsg.includes('Auth session missing')) {
         errorMsg = "El enlace ha expirado o es inválido. Por favor solicita uno nuevo.";
      }
      
      setErrorMessage(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Contraseña Actualizada!</h2>
          <p className="text-gray-600 mb-6">Serás redirigido al inicio de sesión en unos segundos...</p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Ir al Login Ahora
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Restablecer Contraseña - SADI</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <img src='../images/SADI_logo.png' alt="SADI Logo" className="h-16 w-auto" onError={(e) => e.target.style.display='none'}/>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Crear nueva contraseña</h1>
              <p className="text-sm text-gray-500 mt-2">
                Ingresa y confirma tu nueva contraseña
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="password">Nueva Contraseña</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Mínimo 6 caracteres"
                    required
                    disabled={checkingLink || !hasRecoverySession}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Repite la contraseña"
                    required
                    disabled={checkingLink || !hasRecoverySession}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full py-3" disabled={isSubmitting || checkingLink || !hasRecoverySession}>
                {checkingLink ? 'Validando enlace...' : (isSubmitting ? 'Actualizando...' : 'Actualizar Contraseña')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/login')}
                className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 mx-auto"
              >
                <ArrowLeft size={16} />
                Volver al Login
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default ResetPasswordPage;
