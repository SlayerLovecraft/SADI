import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const DoctorLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { loginDoctor, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'doctor') {
        navigate('/doctor/dashboard', { replace: true });
        return;
      }
      if (user.role === 'patient') {
        navigate('/patient/dashboard', { replace: true });
        return;
      }
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const result = await loginDoctor(email, password);
      if (result.success) {
        navigate('/doctor/dashboard', { replace: true });
        return;
      }

      setErrorMessage(result.error || 'Verifique sus credenciales');
      toast({
        title: "Error de autenticación",
        description: result.error || 'Verifique sus credenciales',
        variant: "destructive",
      });
    } catch (error) {
      setErrorMessage(error?.message || 'Ocurrió un error inesperado');
      toast({
        title: "Error",
        description: error?.message || 'Ocurrió un error inesperado',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Portal Doctores - SADI</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8"
        >
          <div className="mb-6">
            <Link to="/login" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Link>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Portal Doctores</h1>
            <p className="text-gray-600 mt-2">Accede con tus credenciales</p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="doctor-email">Correo</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="doctor-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="doctor1@sadi.com.co"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="doctor-password">Contraseña</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="doctor-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="passwordstaff01"
                  required
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-700">8 Doctores Especialistas 3280 (Clic para autocompletar):</p>
                <span className="text-[10px] text-gray-400">Clave: password123</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] max-h-48 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('paola.gil@sadi.med.co');
                    setPassword('password123');
                  }}
                  className="p-1.5 text-left bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg border border-emerald-200 transition-colors"
                >
                  <span className="font-bold block truncate">👶 Dra. Paola Gil</span>
                  <span className="text-[10px] text-emerald-700 block truncate">Pediatría (0-11 años)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('juan.bermudez@sadi.med.co');
                    setPassword('password123');
                  }}
                  className="p-1.5 text-left bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg border border-blue-200 transition-colors"
                >
                  <span className="font-bold block truncate">🧑 Dr. Juan C. Bermúdez</span>
                  <span className="text-[10px] text-blue-700 block truncate">Adolescencia (12-17 años)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('sandra.castano@sadi.med.co');
                    setPassword('password123');
                  }}
                  className="p-1.5 text-left bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-lg border border-indigo-200 transition-colors"
                >
                  <span className="font-bold block truncate">👩 Dra. Sandra Castaño</span>
                  <span className="text-[10px] text-indigo-700 block truncate">Juventud (18-28 años)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('fernando.rincon@sadi.med.co');
                    setPassword('password123');
                  }}
                  className="p-1.5 text-left bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-lg border border-purple-200 transition-colors"
                >
                  <span className="font-bold block truncate">🩺 Dr. Fernando Rincón</span>
                  <span className="text-[10px] text-purple-700 block truncate">Adultez & Cardiovascular</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('beatriz.arango@sadi.med.co');
                    setPassword('password123');
                  }}
                  className="p-1.5 text-left bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-200 transition-colors"
                >
                  <span className="font-bold block truncate">👵 Dra. Beatriz Arango</span>
                  <span className="text-[10px] text-amber-700 block truncate">Geriatría & Vejez (60+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('mauricio.villa@sadi.med.co');
                    setPassword('password123');
                  }}
                  className="p-1.5 text-left bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-lg border border-rose-200 transition-colors"
                >
                  <span className="font-bold block truncate">🤰 Dr. Mauricio Villa</span>
                  <span className="text-[10px] text-rose-700 block truncate">Materno Perinatal (RIAMP)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('natalia.ocampo@sadi.med.co');
                    setPassword('password123');
                  }}
                  className="p-1.5 text-left bg-teal-50 hover:bg-teal-100 text-teal-900 rounded-lg border border-teal-200 transition-colors"
                >
                  <span className="font-bold block truncate">🦷 Dra. Natalia Ocampo</span>
                  <span className="text-[10px] text-teal-700 block truncate">Salud Oral Transversal</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('carlos.salazar@sadi.med.co');
                    setPassword('password123');
                  }}
                  className="p-1.5 text-left bg-cyan-50 hover:bg-cyan-100 text-cyan-900 rounded-lg border border-cyan-200 transition-colors"
                >
                  <span className="font-bold block truncate">🎗️ Dr. Carlos Salazar</span>
                  <span className="text-[10px] text-cyan-700 block truncate">Oncología & Tamizajes</span>
                </button>
              </div>

              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('doctor1@sadi.com.co');
                    setPassword('passwordstaff01');
                  }}
                  className="text-[10px] text-gray-500 hover:text-blue-600 underline"
                >
                  O usar cuenta staff: doctor1@sadi.com.co (passwordstaff01)
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <Link to="/patient/login" className="text-blue-600 hover:text-blue-700">
              Ir al portal de pacientes
            </Link>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default DoctorLoginPage;

