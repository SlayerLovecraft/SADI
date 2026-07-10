// ============================================
//  LoginPage.jsx - USA loginHospital() ESPECÍFICO
// ============================================
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { authService } from '@/services/authService';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showReportProblem, setShowReportProblem] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const { loginHospital, user, loading: authLoading } = useAuth(); // ✅ USA loginHospital
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'patient' || user.role === 'paciente') {
        navigate('/patient/login', { replace: true });
      } else if (user.role === 'doctor') {
        navigate('/doctor/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    
    console.log('🔵 Iniciando login con:', { email, password: '***' });

    // Validar que sea correo institucional
    const isInstitutional = email.includes('@') && 
      !email.includes('@gmail.com') && 
      !email.includes('@hotmail.com') && 
      !email.includes('@yahoo.com') &&
      !email.includes('@outlook.com');

    console.log('🔵 ¿Es institucional?', isInstitutional);

    if (!isInstitutional) {
      console.log('❌ Correo rechazado - No es institucional');
      const errorMsg = "Debe usar un correo institucional (EPS/IPS). No se aceptan Gmail, Hotmail, Yahoo u Outlook.";
      
      setErrorMessage(errorMsg);
      
      toast({
        title: "Correo no válido",
        description: "Debe usar un correo institucional (EPS/IPS)",
        variant: "destructive",
      });
      
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('🔵 Llamando a loginHospital()...');
      
      // ✅ USA loginHospital en lugar de login genérico
      const result = await loginHospital(email, password);
      
      console.log('🔵 Resultado del login:', result);
      
      if (result.success) {
        console.log('✅ Login exitoso');
        
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);
      } else {
        console.log('❌ Login fallido:', result.error);
        const errorMsg = result.error || "Verifique sus credenciales";
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
      const errorMsg = error.message || "Ocurrió un error inesperado";
      setErrorMessage(errorMsg);
      
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!resetEmail) {
      setErrorMessage("Por favor ingrese su correo institucional");
      toast({
        title: "Campo requerido",
        description: "Por favor ingrese su correo institucional",
        variant: "destructive",
      });
      return;
    }

    const isInstitutional = resetEmail.includes('@') && 
      !resetEmail.includes('@gmail.com') && 
      !resetEmail.includes('@hotmail.com');
    
    if (!isInstitutional) {
      setErrorMessage("Debe usar su correo institucional");
      toast({
        title: "Correo no válido",
        description: "Debe usar su correo institucional",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await authService.forgotPassword(resetEmail, 'staff');
      
      if (result.success) {
        toast({
          title: "Correo enviado",
          description: `Se ha enviado un enlace a ${resetEmail}`,
        });
        setResetEmail('');
        setShowForgotPassword(false);
      } else {
        setErrorMessage(result.error || "No se pudo enviar el correo");
        toast({
          title: "Error",
          description: result.error || "No se pudo enviar el correo",
          variant: "destructive",
        });
      }
    } catch (error) {
      setErrorMessage("No se pudo enviar el correo");
      toast({
        title: "Error",
        description: "No se pudo enviar el correo",
        variant: "destructive",
      });
    }
  };

  const handleReportProblem = async (e) => {
    e.preventDefault();
    
    if (!email || !problemDescription) {
      setErrorMessage("Complete todos los campos");
      toast({
        title: "Campos requeridos",
        description: "Complete todos los campos",
        variant: "destructive",
      });
      return;
    }

    const emailSubject = `Problema de acceso - Staff/Hospital`;
    const emailBody = `
Tipo de Usuario: Staff/Hospital
Email: ${email}
Descripción:
${problemDescription}

---
Generado desde SADI
    `.trim();

    window.location.href = `mailto:info.apropiatic@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    toast({
      title: "Cliente de correo abierto",
      description: "Complete y envíe el mensaje",
    });

    setProblemDescription('');
    setShowReportProblem(false);
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

  if (showForgotPassword) {
    return (
      <>
        <Helmet>
          <title>Recuperar Contraseña - Portal Administrativo</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
                  Ingrese su correo institucional
                </p>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div>
                  <Label htmlFor="reset-email">Correo Institucional</Label>
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
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="admin@hospital.com"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full py-3">
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
          <title>Reportar Problema</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleReportProblem} className="space-y-6">
                <div>
                  <Label htmlFor="problem-email">Correo Institucional</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="problem-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMessage('');
                      }}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="admin@hospital.com"
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
                    className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="5"
                    placeholder="Describa su problema..."
                    required
                  />
                </div>

                <Button type="submit" className="w-full py-3">
                  Enviar reporte
                </Button>
              </form>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-700">
                <p className="font-semibold mb-2">Contacto de soporte:</p>
                <a href="mailto:info.apropiatic@gmail.com" className="text-blue-600 hover:underline break-all">
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
        <title>Portal Administrativo - SADI</title>
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
                <img src='/images/SADI_logo.png' alt="SADI Logo" className="h-20 w-auto"/>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Portal Administrativo</h1>
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
                <Label htmlFor="email">Correo Institucional</Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="admin@hospital.com"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Solo correos institucionales de EPS/IPS
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-blue-600 hover:underline"
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
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full py-3" disabled={isSubmitting}>
                {isSubmitting ? 'Validando...' : 'Ingresar al Portal Admin'}
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

              <div className="border-t pt-3 text-center space-y-2">
                <Link to="/patient/login" className="block text-sm text-blue-600 hover:underline">
                  ¿Es paciente? Ingrese aquí
                </Link>
                <Link to="/doctor/login" className="block text-sm text-blue-600 hover:underline">
                  ¿Es doctor? Ingrese aquí
                </Link>
                <Link to="/register-hospital" className="block text-sm text-blue-600 hover:underline">
                  ¿Hospital nuevo? Regístrese aquí
                </Link>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg text-xs text-gray-600 space-y-1">
              <p className="font-bold">Información de Ubicación:</p>
              <p>Colombia | Cali, Valle del Cauca</p>
              <p>Carrera 1, Calle 19N | Oficina 01B</p>
              <p>Torre de Cali | Piso 23</p>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;
