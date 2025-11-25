// ============================================
// src/pages/LoginPage.jsx - CON API INTEGRADA
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authService } from '@/services/authService';

const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showReportProblem, setShowReportProblem] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [currentTab, setCurrentTab] = useState('staff');
  
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'patient') {
        navigate('/patient/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Llamada real a la API a través del AuthContext
    const result = await login(identifier, password);
    
    if (result.success) {
      toast({
        title: "Inicio de sesión exitoso",
        description: "Bienvenido a SADI",
      });
      // Navigation handled by useEffect
    } else {
      toast({
        title: "Error de autenticación",
        description: result.error || "Verifique sus credenciales",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast({
        title: "Campo requerido",
        description: "Por favor ingrese su correo electrónico",
        variant: "destructive",
      });
      return;
    }

    // Validar que el correo coincida con el tipo de usuario
    const isInstitutionalEmail = resetEmail.includes('@') && 
      !resetEmail.includes('@gmail.com') && 
      !resetEmail.includes('@hotmail.com') && 
      !resetEmail.includes('@yahoo.com');
    
    if (currentTab === 'staff' && !isInstitutionalEmail) {
      toast({
        title: "Correo no válido",
        description: "Para recuperar contraseña administrativa, use su correo institucional",
        variant: "destructive",
      });
      return;
    }

    // Llamada real a la API
    try {
      const result = await authService.forgotPassword(resetEmail, currentTab);
      
      if (result.success) {
        toast({
          title: "Correo enviado",
          description: `Se ha enviado un enlace de recuperación a ${resetEmail}`,
        });
        
        setResetEmail('');
        setShowForgotPassword(false);
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo enviar el correo. Intente nuevamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar el correo. Intente nuevamente.",
        variant: "destructive",
      });
    }
  };

  const handleReportProblem = async (e) => {
    e.preventDefault();
    
    if (!identifier || !problemDescription) {
      toast({
        title: "Campos requeridos",
        description: "Complete todos los campos para reportar el problema",
        variant: "destructive",
      });
      return;
    }

    const userType = currentTab === 'staff' ? 'Hospital/Administrativo' : 'Paciente';
    const emailSubject = `Problema de acceso - ${userType}`;
    const emailBody = `
Tipo de Usuario: ${userType}
Identificador: ${identifier}
Descripción del problema:
${problemDescription}

---
Este mensaje fue generado desde el sistema SADI
    `.trim();

    // Crear el mailto link
    const mailtoLink = `mailto:info.apropiatic@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    // Abrir el cliente de correo
    window.location.href = mailtoLink;

    toast({
      title: "Cliente de correo abierto",
      description: "Complete y envíe el correo desde su aplicación de email",
    });

    setProblemDescription('');
    setShowReportProblem(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Vista de Olvidé mi contraseña
  if (showForgotPassword) {
    return (
      <>
        <Helmet>
          <title>Recuperar Contraseña - SADI</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <button
                onClick={() => setShowForgotPassword(false)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
              >
                <ArrowLeft size={20} />
                Volver al inicio de sesión
              </button>

              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <img src='../images/SADI_logo.png' alt="SADI Logo" className="h-20 w-auto"/>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Recuperar Contraseña</h1>
                <p className="text-sm text-gray-500 mt-2">
                  Ingrese su correo {currentTab === 'staff' ? 'institucional' : 'electrónico'} y le enviaremos instrucciones
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div>
                  <Label htmlFor="reset-email">
                    {currentTab === 'staff' ? 'Correo Institucional' : 'Correo Electrónico'}
                  </Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={currentTab === 'staff' ? 'admin@hospital.com' : 'paciente@email.com'}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full py-3">
                  Enviar enlace de recuperación
                </Button>
              </form>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Nota importante:</p>
                    <p>El enlace de recuperación será válido por 24 horas. Revise su bandeja de spam si no lo encuentra.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  // Vista de Reportar Problema
  if (showReportProblem) {
    return (
      <>
        <Helmet>
          <title>Reportar Problema - SADI</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <button
                onClick={() => setShowReportProblem(false)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
              >
                <ArrowLeft size={20} />
                Volver al inicio de sesión
              </button>

              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <img src='../images/SADI_logo.png' alt="SADI Logo" className="h-20 w-auto"/>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Reportar Problema</h1>
                <p className="text-sm text-gray-500 mt-2">
                  Describa su problema y nos comunicaremos con usted
                </p>
              </div>

              <form onSubmit={handleReportProblem} className="space-y-6">
                <div>
                  <Label htmlFor="problem-identifier">
                    {currentTab === 'staff' ? 'Correo Institucional' : 'Documento / Correo'}
                  </Label>
                  <div className="relative mt-2">
                    {currentTab === 'staff' ? (
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    ) : (
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    )}
                    <input
                      id="problem-identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={currentTab === 'staff' ? 'admin@hospital.com' : '1006010518 o correo'}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="problem-description">Descripción del problema</Label>
                  <textarea
                    id="problem-description"
                    value={problemDescription}
                    onChange={(e) => setProblemDescription(e.target.value)}
                    className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="5"
                    placeholder="Describa detalladamente el problema que está experimentando..."
                    required
                  />
                </div>

                <Button type="submit" className="w-full py-3">
                  Enviar reporte a soporte
                </Button>
              </form>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-700">
                <p className="font-semibold mb-2">Contacto de soporte:</p>
                <a href="mailto:info.apropiatic@gmail.com" className="text-blue-600 hover:underline break-all">
                  info.apropiatic@gmail.com
                </a>
                <p className="text-xs text-gray-500 mt-2">
                  Tiempo de respuesta: 24-48 horas hábiles
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  // Vista principal de Login
  return (
    <>
      <Helmet>
        <title>Iniciar Sesión - SADI</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <img src='../images/SADI_logo.jpg' alt="SADI Logo" className="h-20 w-auto"/>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">SADI</h1>
              <p className="text-sm text-gray-500 mt-2">Sistema de Apoyo para Demanda Inducida</p>
            </div>

            <Tabs 
              defaultValue="staff" 
              className="w-full mb-6"
              onValueChange={(value) => setCurrentTab(value)}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="staff">Administrativo</TabsTrigger>
                <TabsTrigger value="patient">Paciente</TabsTrigger>
              </TabsList>

              <TabsContent value="staff">
                <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                  <div>
                    <Label htmlFor="email">Correo Institucional</Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="email"
                        type="email"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
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
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        ¿Olvidó su contraseña?
                      </button>
                  </div>
                  <Button type="submit" className="w-full py-3" disabled={isSubmitting}>
                    {isSubmitting ? 'Validando...' : 'Ingresar al Portal Admin'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="patient">
                <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                  <div>
                    <Label htmlFor="cc">Número de Documento / Correo</Label>
                    <div className="relative mt-2">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="cc"
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="1006010518 o correo"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Use su número de documento o correo personal
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label htmlFor="password-patient">Contraseña</Label>
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
                        id="password-patient"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700" disabled={isSubmitting}>
                    {isSubmitting ? 'Validando...' : 'Ingresar al Portal Paciente'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="text-center space-y-3">
              <button
                onClick={() => setShowReportProblem(true)}
                className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 mx-auto"
              >
                <AlertCircle size={16} />
                ¿Problemas para iniciar sesión?
              </button>

              <div className="border-t pt-3">
                <Link to="/register-hospital" className="text-sm text-blue-600 hover:underline">
                  ¿Es un hospital nuevo? Regístrese aquí
                </Link>
                <p className="text-xs text-gray-500 mt-1">
                  Solo para EPS/IPS - Se enviará código de verificación
                </p>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg text-xs text-gray-600 space-y-1">
              <p className="font-bold">Credenciales Demo:</p>
              <p>Hospital Admin: admin@esperanza.com / sadisalud2025!</p>
              <p>Super Admin: admin@sadi.com / admin123</p>
              <p>Paciente: andresds2001@gmail.com / password123</p>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;