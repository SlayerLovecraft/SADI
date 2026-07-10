import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Building2, Mail, User, ArrowLeft, Lock, MapPin, Home, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { authService } from '@/services/authService';

const RegisterHospitalPage = () => {
  const [formData, setFormData] = useState({
    hospitalName: '',
    email: '',
    password: '',
    confirmPassword: '',
    city: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState(''); // NUEVO: mensaje visible
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setErrorMessage(''); // Limpiar errores previos

    console.log('🔵 Iniciando registro de hospital:', {
      ...formData,
      password: '***',
      confirmPassword: '***'
    });

    // Validaciones
    const newErrors = {};
    
    // Validar correo institucional
    const isInstitutional = formData.email.includes('@') && 
      !formData.email.includes('@gmail.com') && 
      !formData.email.includes('@hotmail.com') && 
      !formData.email.includes('@yahoo.com') &&
      !formData.email.includes('@outlook.com');

    if (!isInstitutional) {
      newErrors.email = 'Debe usar un correo institucional (no Gmail, Hotmail, etc.)';
      setErrorMessage('⚠️ Debe usar un correo institucional del hospital/IPS');
    }
    
    if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }
    
    if (!formData.hospitalName.trim()) {
      newErrors.hospitalName = 'El nombre del hospital es requerido';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (!errorMessage) {
        setErrorMessage('⚠️ Por favor corrija los errores en el formulario');
      }
      setLoading(false);
      return;
    }

    try {
      console.log('🔵 Llamando a authService.registerHospital...');
      
      // Llamar al servicio de autenticación
      const result = await authService.registerHospital({
        email: formData.email,
        password: formData.password,
        name: formData.hospitalName,
        city: formData.city || 'No especificada',
        address: formData.address || 'No especificada'
      });
      
      console.log('🔵 Resultado del registro:', result);
      
      if (result.success) {
        console.log('✅ Registro exitoso');
        
        const successMsg = result.message || "Hospital registrado exitosamente. Por favor verifica tu correo electrónico.";
        
        toast({
          title: "✅ Registro exitoso",
          description: successMsg,
          variant: "success",
        });
        
        // Mostrar mensaje en pantalla también
        setErrorMessage(''); // Limpiar errores
        
        // Redirigir al login después de 3 segundos
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        console.log('❌ Error en registro:', result.error);
        
        let errorMsg = result.error || 'Error desconocido al registrar el hospital';
        
        // Mejorar mensajes de error específicos
        if (errorMsg.includes('23502')) {
          errorMsg = '⚠️ Error en la base de datos: Faltan campos requeridos. Contacte al administrador.';
        } else if (errorMsg.includes('User already registered')) {
          errorMsg = '⚠️ Este correo ya está registrado. Intente recuperar su contraseña.';
        } else if (errorMsg.includes('60 seconds')) {
          errorMsg = '⚠️ Por favor espere 60 segundos antes de intentar registrar otro hospital (límite de seguridad).';
        } else if (errorMsg.includes('rate limit')) {
          errorMsg = '⚠️ Demasiados intentos. Por favor espere unos minutos e intente nuevamente.';
        }
        
        setErrorMessage(errorMsg);
        
        toast({
          title: "Error de registro",
          description: errorMsg,
          variant: "destructive",
        });
        
        setErrors({ general: errorMsg });
      }
    } catch (error) {
      console.error('❌ Error inesperado:', error);
      
      const errorMsg = `⚠️ Error inesperado: ${error.message || 'No se pudo completar el registro'}`;
      setErrorMessage(errorMsg);
      
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar error del campo cuando el usuario escribe
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
    
    // Limpiar mensaje general de error
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  return (
    <>
      <Helmet>
        <title>Registro de Hospital - SADI</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8"
        >
          <Link to="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver al login
          </Link>

          <div className="mb-8">
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Registrar Nuevo Hospital</h1>
            <p className="text-gray-500">Únete a la red SADI y gestiona tus pacientes.</p>
          </div>

          {/* MENSAJE DE ERROR VISIBLE */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            </div>
          )}

          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre del Hospital */}
            <div>
              <Label htmlFor="hospitalName">Nombre del Hospital / IPS *</Label>
              <div className="relative mt-2">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="hospitalName"
                  name="hospitalName"
                  type="text"
                  value={formData.hospitalName}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.hospitalName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Hospital San José"
                  required
                />
              </div>
              {errors.hospitalName && (
                <p className="text-xs text-red-500 mt-1">{errors.hospitalName}</p>
              )}
            </div>

            {/* Correo Electrónico */}
            <div>
              <Label htmlFor="email">Correo Electrónico Institucional *</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="contacto@hospital.com"
                  required
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                ⚠️ Solo correos institucionales (no Gmail, Hotmail, Yahoo, Outlook)
              </p>
            </div>

            {/* Contraseña */}
            <div>
              <Label htmlFor="password">Contraseña *</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirmar Contraseña */}
            <div>
              <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Repite la contraseña"
                  required
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Ciudad (Opcional) */}
            <div>
              <Label htmlFor="city">Ciudad</Label>
              <div className="relative mt-2">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Medellín"
                />
              </div>
            </div>

            {/* Dirección (Opcional) */}
            <div>
              <Label htmlFor="address">Dirección</Label>
              <div className="relative mt-2">
                <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="address"
                  name="address"
                  type="text"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Calle 10 #20-30"
                />
              </div>
            </div>

            <Button type="submit" className="w-full py-3" disabled={loading}>
              {loading ? 'Registrando...' : 'Crear Cuenta de Hospital'}
            </Button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Al registrarte, recibirás un correo de verificación. Los campos marcados con * son obligatorios.
            </p>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-xs text-gray-600">
            <p className="font-bold mb-2">⚠️ Importante:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Use un correo institucional del hospital</li>
              <li>Verifique su correo después del registro</li>
              <li>Si tiene problemas, contacte: <a href="mailto:info.apropiatic@gmail.com" className="text-blue-600 hover:underline">info.apropiatic@gmail.com</a></li>
            </ul>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default RegisterHospitalPage;