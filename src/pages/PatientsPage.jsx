// ============================================
// src/pages/PatientsPage.jsx - CON API INTEGRADA
// ============================================
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Plus, User, Phone, MapPin, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { patientService } from '@/services/patientService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const PatientsPage = () => {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const [newPatient, setNewPatient] = useState({
    nombre: '',
    telefono: '',
    edad: '',
    sexo: 'M',
    ciudad: '',
    programa: '',
    email: ''
  });

  useEffect(() => {
    loadPatients();
  }, [user]);

  const loadPatients = async () => {
    setLoading(true);
    try {
      // Intentar cargar desde API
      const result = await patientService.getAll({
        hospitalId: user.role === 'hospital_admin' ? user.hospitalId : undefined
      });
      
      if (result.success && result.data) {
        setPatients(result.data);
      } else {
        // Fallback a localStorage
        loadPatientsLocal();
      }
    } catch (error) {
      console.error('Error loading patients:', error);
      // Fallback a localStorage
      loadPatientsLocal();
    } finally {
      setLoading(false);
    }
  };

  const loadPatientsLocal = () => {
    const stored = localStorage.getItem('sadi_patients');
    if (stored) {
      let allPatients = JSON.parse(stored);
      
      // Filter based on RBAC
      if (user.role === 'hospital_admin') {
        allPatients = allPatients.filter(p => p.hospitalId === user.hospitalId);
      }
      
      setPatients(allPatients);
    }
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    
    const patientData = {
      ...newPatient,
      hospitalId: user.hospitalId || 'h1',
      fechaRegistro: new Date().toISOString().split('T')[0]
    };
    
    try {
      // Intentar crear en API
      const result = await patientService.create(patientData);
      
      if (result.success) {
        toast({
          title: "Paciente agregado",
          description: "El paciente ha sido registrado exitosamente",
        });
        
        loadPatients(); // Recargar desde API
        setShowAddDialog(false);
        setNewPatient({ nombre: '', telefono: '', edad: '', sexo: 'M', ciudad: '', programa: '', email: '' });
      } else {
        // Fallback a localStorage
        addPatientLocal(patientData);
      }
    } catch (error) {
      console.error('Error adding patient:', error);
      // Fallback a localStorage
      addPatientLocal(patientData);
    }
  };

  const addPatientLocal = (patientData) => {
    const patient = {
      ...patientData,
      id: Date.now().toString()
    };
    
    const allPatients = JSON.parse(localStorage.getItem('sadi_patients') || '[]');
    const updatedPatients = [...allPatients, patient];
    localStorage.setItem('sadi_patients', JSON.stringify(updatedPatients));
    
    loadPatientsLocal();
    setShowAddDialog(false);
    setNewPatient({ nombre: '', telefono: '', edad: '', sexo: 'M', ciudad: '', programa: '', email: '' });
    
    toast({
      title: "Paciente agregado",
      description: "El paciente ha sido registrado exitosamente",
    });
  };

  const filteredPatients = patients.filter(p =>
    p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.telefono?.includes(searchTerm) ||
    p.ciudad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cc?.includes(searchTerm)
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Pacientes - SADI</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pacientes</h1>
            <p className="text-gray-500 mt-1">
              {user.role === 'hospital_admin' 
                ? 'Gestión de pacientes de tu hospital' 
                : 'Base de datos global de pacientes'}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Paciente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Agregar Nuevo Paciente</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddPatient} className="space-y-4">
                  <div>
                    <Label htmlFor="nombre">Nombre Completo</Label>
                    <input
                      id="nombre"
                      type="text"
                      value={newPatient.nombre}
                      onChange={(e) => setNewPatient({ ...newPatient, nombre: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                       <Label htmlFor="telefono">Teléfono</Label>
                       <input
                         id="telefono"
                         type="tel"
                         value={newPatient.telefono}
                         onChange={(e) => setNewPatient({ ...newPatient, telefono: e.target.value })}
                         className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                         required
                       />
                    </div>
                    <div>
                       <Label htmlFor="email">Email</Label>
                       <input
                         id="email"
                         type="email"
                         value={newPatient.email}
                         onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                         className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                       />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edad">Edad</Label>
                      <input
                        id="edad"
                        type="number"
                        value={newPatient.edad}
                        onChange={(e) => setNewPatient({ ...newPatient, edad: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="sexo">Sexo</Label>
                      <select
                        id="sexo"
                        value={newPatient.sexo}
                        onChange={(e) => setNewPatient({ ...newPatient, sexo: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <input
                      id="ciudad"
                      type="text"
                      value={newPatient.ciudad}
                      onChange={(e) => setNewPatient({ ...newPatient, ciudad: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="programa">Programa de Salud</Label>
                    <input
                      id="programa"
                      type="text"
                      value={newPatient.programa}
                      onChange={(e) => setNewPatient({ ...newPatient, programa: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">Agregar Paciente</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono, ciudad o CC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPatients.map((patient, index) => (
              <motion.div
                key={patient.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedPatient(patient)}
              >
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{patient.nombre}</p>
                    <p className="text-xs text-gray-400">CC: {patient.cc || 'N/A'}</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center text-sm text-gray-500">
                        <Phone className="h-3 w-3 mr-1" />
                        {patient.telefono}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-3 w-3 mr-1" />
                        {patient.ciudad}
                      </div>
                      {user.role === 'super_admin' && (
                        <div className="flex items-center text-sm text-gray-500">
                          <Building2 className="h-3 w-3 mr-1" />
                          {patient.hospitalId}
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        {patient.programa}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {selectedPatient && (
        <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalles del Paciente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-3 rounded-full">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{selectedPatient.nombre}</p>
                  <p className="text-sm text-gray-500">CC: {selectedPatient.cc}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Teléfono</p>
                  <p className="font-medium">{selectedPatient.telefono}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Edad</p>
                  <p className="font-medium">{selectedPatient.edad} años</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium truncate">{selectedPatient.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dirección</p>
                  <p className="font-medium">{selectedPatient.direccion || 'No registrada'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Programa</p>
                  <p className="font-medium">{selectedPatient.programa}</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
};

export default PatientsPage;