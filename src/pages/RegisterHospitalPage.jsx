import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Building2, Mail, User, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

const RegisterHospitalPage = () => {
  const [formData, setFormData] = useState({
    hospitalName: '',
    email: '',
    adminName: ''
  });
  const [loading, setLoading] = useState(false);
  const { registerHospital } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = registerHospital(formData);
    
    if (result.success) {
      navigate('/login');
    } else {
      toast({
        title: "Error de registro",
        description: result.error,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Registro de Hospital - SADI</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="hospitalName">Nombre del Hospital / IPS</Label>
              <div className="relative mt-2">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="hospitalName"
                  type="text"
                  value={formData.hospitalName}
                  onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="adminName">Nombre del Administrador</Label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="adminName"
                  type="text"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Correo Electrónico Institucional</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="contacto@hospital.com"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Enviaremos un enlace de verificación a este correo.</p>
            </div>

            <Button type="submit" className="w-full py-3" disabled={loading}>
              {loading ? 'Registrando...' : 'Crear Cuenta de Hospital'}
            </Button>
          </form>
        </motion.div>
      </div>
    </>
  );
};

export default RegisterHospitalPage;