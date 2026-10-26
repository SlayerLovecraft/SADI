import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const AuthCallbackPage = () => {
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('Verificando tu enlace...');
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const hashError = hashParams.get('error') || null;
        const hashErrorDescription = hashParams.get('error_description') || null;
        const hashType = hashParams.get('type') || null;

        if (hashError || hashErrorDescription) {
          setStatus('error');
          setMessage(decodeURIComponent(hashErrorDescription || hashError || 'El enlace es inválido o expiró.'));
          setTimeout(() => navigate('/login', { replace: true }), 4000);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (!session) {
          setStatus('error');
          setMessage('El enlace ha expirado o es inválido. Por favor intenta iniciar sesión de nuevo.');
          setTimeout(() => navigate('/login', { replace: true }), 4000);
          return;
        }

        if (hashType === 'recovery') {
          navigate('/reset-password', { replace: true });
          return;
        }

        setStatus('success');
        setMessage('¡Correo confirmado! Ya puedes iniciar sesión.');

        setTimeout(() => {
          supabase.auth.signOut().finally(() => {
            navigate('/login', { replace: true });
          });
        }, 2500);
      } catch (error) {
        console.error('Error en auth callback:', error);
        setStatus('error');
        setMessage(error.message || 'Hubo un problema al verificar tu cuenta.');
        
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 4000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <>
      <Helmet>
        <title>Autenticando... - SADI</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Procesando...</h2>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">¡Confirmado!</h2>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Ups, algo salió mal</h2>
            </>
          )}

          <p className="text-gray-600 mb-6">{message}</p>
          
          {status !== 'loading' && (
            <p className="text-sm text-gray-400">Serás redirigido automáticamente...</p>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default AuthCallbackPage;
