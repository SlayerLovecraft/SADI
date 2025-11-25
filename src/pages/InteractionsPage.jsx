import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { MessageSquare, Search, Filter, CheckCircle, XCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const InteractionsPage = () => {
  const [interactions, setInteractions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const { user } = useAuth();

  useEffect(() => {
    loadInteractions();
  }, [user]); // Reload when user context changes

  const loadInteractions = () => {
    const stored = localStorage.getItem('sadi_interactions');
    if (stored) {
      let allInteractions = JSON.parse(stored);

      // FILTERING LOGIC: 
      // If user is a hospital admin, ONLY show interactions where hospitalId matches their ID.
      if (user.role === 'hospital_admin') {
        allInteractions = allInteractions.filter(i => i.hospitalId === user.hospitalId);
      }
      
      setInteractions(allInteractions);
    }
  };

  const getStatusIcon = (estado) => {
    switch (estado) {
      case 'Entregado':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'Fallido':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'Pendiente':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'Entregado':
        return 'bg-green-100 text-green-800';
      case 'Fallido':
        return 'bg-red-100 text-red-800';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredInteractions = interactions.filter(i => {
    const matchesSearch = 
      i.pacienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.pacienteTelefono.includes(searchTerm) ||
      i.campañaNombre.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'Todos' || i.estado === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <Layout>
      <Helmet>
        <title>Interacciones - SADI</title>
        <meta name="description" content="Historial de comunicaciones con pacientes" />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Historial de Interacciones</h1>
          <p className="text-gray-500 mt-1">
            {user.role === 'hospital_admin' 
              ? 'Registro de comunicaciones de tu hospital' 
              : 'Registro global de comunicaciones'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por paciente, teléfono o campaña..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Todos">Todos los estados</option>
                <option value="Entregado">Entregado</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Fallido">Fallido</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredInteractions.map((interaction, index) => (
              <motion.div
                key={interaction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="bg-blue-100 p-2 rounded-full mt-1">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{interaction.pacienteNombre}</p>
                          <p className="text-sm text-gray-500">{interaction.pacienteTelefono}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full flex items-center space-x-1 ${getStatusColor(interaction.estado)}`}>
                          {getStatusIcon(interaction.estado)}
                          <span className="ml-1">{interaction.estado}</span>
                        </span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg mb-2">
                        <p className="text-sm text-gray-700">{interaction.contenido}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Campaña: {interaction.campañaNombre}</span>
                        <span>{interaction.fecha} a las {interaction.hora}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredInteractions.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No se encontraron interacciones</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default InteractionsPage;