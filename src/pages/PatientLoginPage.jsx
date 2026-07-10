// ============================================
//  PatientLoginPage.jsx - USA loginPatient() ESPECÍFICO
// ============================================
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { authService } from '@/services/authService';

const PatientLoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showReportProblem, setShowReportProblem] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const { loginPatient, user, loading: authLoading } = useAuth(); // ✅ USA loginPatient
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user) {
      console.log('👤 Usuario detectado en PatientLogin:', user);
      if (user.role === 'patient' || user.role === 'paciente') {
        navigate('/patient/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    console.log('🔵 PatientLogin - Intentando login con:', identifier);

    try {
      // ✅ USA loginPatient en lugar de login genérico
      const result = await loginPatient(identifier, password);
      
      console.log('🔵 PatientLogin - Resultado:', result);
      
      if (result.success) {
        console.log('✅ Login de paciente exitoso');
        
        setTimeout(() => {
          navigate('/patient/dashboard', { replace: true });
        }, 500);
      } else {
        console.log('❌ Login falló:', result.error);
        
        const errorMsg = result.error || "Verifique su documento/correo y contraseña";
        setErrorMessage(errorMsg);
        
        toast({
          title: "Error de autenticación",
          description: errorMsg,
          variant: "destructive",
        });
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('❌ Error en login:', error);
      
      const errorMsg = error.message || "Ocurrió un error inesperado. Intente nuevamente.";
      setErrorMessage(errorMsg);
      
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!resetEmail) {
      setErrorMessage("Por favor ingrese su correo electrónico");
      toast({
        title: "Campo requerido",
        description: "Por favor ingrese su correo electrónico",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await authService.forgotPassword(resetEmail, 'patient');
      
      if (result.success) {
        toast({
          title: "Correo enviado",
          description: `Se ha enviado un enlace de recuperación a ${resetEmail}`,
        });
        
        setResetEmail('');
        setShowForgotPassword(false);
        setErrorMessage('');
      } else {
        const errorMsg = result.error || "No se pudo enviar el correo";
        setErrorMessage(errorMsg);
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMsg = "No se pudo enviar el correo. Intente nuevamente.";
      setErrorMessage(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleReportProblem = async (e) => {
    e.preventDefault();
    
    if (!identifier || !problemDescription) {
      setErrorMessage("Complete todos los campos");
      toast({
        title: "Campos requeridos",
        description: "Complete todos los campos",
        variant: "destructive",
      });
      return;
    }

    const emailSubject = `Problema de acceso - Paciente`;
    const emailBody = `
Tipo de Usuario: Paciente
Identificador: ${identifier}
Descripción del problema:
${problemDescription}

---
Este mensaje fue generado desde el sistema SADI
    `.trim();

    const mailtoLink = `mailto:info.apropiatic@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoLink;

    toast({
      title: "Cliente de correo abierto",
      description: "Complete y envíe el correo desde su aplicación",
    });

    setProblemDescription('');
    setShowReportProblem(false);
    setErrorMessage('');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <>
        <Helmet>
          <title>Recuperar Contraseña - Portal Pacientes</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setErrorMessage('');
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
              >
                <ArrowLeft size={20} />
                Volver
              </button>

              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <img src='/images/SADI_logo.png' alt="SADI Logo" className="h-20 w-auto"/>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Recuperar Contraseña</h1>
                <p className="text-sm text-gray-500 mt-2">
                  Ingrese su correo electrónico
                </p>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{errorMessage}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div>
                  <Label htmlFor="reset-email">Correo Electrónico</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        setErrorMessage('');
                      }}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="paciente@email.com"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700">
                  Enviar enlace de recuperación
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  if (showReportProblem) {
    return (
      <>
        <Helmet>
          <title>Reportar Problema - Portal Pacientes</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <button
                onClick={() => {
                  setShowReportProblem(false);
                  setErrorMessage('');
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
              >
                <ArrowLeft size={20} />
                Volver
              </button>

              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <img src='/images/SADI_logo.png' alt="SADI Logo" className="h-20 w-auto"/>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Reportar Problema</h1>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{errorMessage}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleReportProblem} className="space-y-6">
                <div>
                  <Label htmlFor="problem-identifier">Documento / Correo</Label>
                  <div className="relative mt-2">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="problem-identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setErrorMessage('');
                      }}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="1000000000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="problem-description">Descripción del problema</Label>
                  <textarea
                    id="problem-description"
                    value={problemDescription}
                    onChange={(e) => {
                      setProblemDescription(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                    rows="5"
                    placeholder="Describa su problema..."
                    required
                  />
                </div>

                <Button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700">
                  Enviar reporte
                </Button>
              </form>

              <div className="mt-6 p-4 bg-teal-50 rounded-lg text-sm text-gray-700">
                <p className="font-semibold mb-2">Contacto de soporte:</p>
                <a href="mailto:info.apropiatic@gmail.com" className="text-teal-600 hover:underline break-all">
                  info.apropiatic@gmail.com
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Portal Pacientes - SADI</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <img src='/images/SADI_logo.png' alt="SADI Logo" className="h-20 w-auto"/>
              </div>
              <h1 className="text-3xl font-bold text-teal-700">Portal Pacientes</h1>
              <p className="text-sm text-gray-500 mt-2">Sistema de Apoyo para Demanda Inducida</p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="identifier">Número de Documento / Correo</Label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="1234567890 o correo@email.com"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use su número de cédula o correo electrónico
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-teal-600 hover:underline"
                  >
                    ¿Olvidó su contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Por defecto es su número de cédula
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full py-3 bg-teal-600 hover:bg-teal-700" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Validando...' : 'Ingresar'}
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => setShowReportProblem(true)}
                className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 mx-auto"
              >
                <AlertCircle size={16} />
                ¿Problemas para iniciar sesión?
              </button>

              <div className="border-t pt-3 text-center">
                <Link to="/login" className="text-sm text-teal-600 hover:underline">
                  ¿Es personal del hospital? Ingrese aquí
                </Link>
              </div>
            </div>

            <div className="mt-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-teal-800">
                  <p className="font-semibold mb-1">¿Primera vez aquí?</p>
                  <p>Su contraseña inicial es su número de cédula. Se le solicitará cambiarla en su primer acceso.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default PatientLoginPage;