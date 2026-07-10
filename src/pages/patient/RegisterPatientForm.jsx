import React, { useState } from 'react';
import { supabase } from './supabaseClient';

const RegisterPatientForm = ({ hospitalId }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    email: '',
    telefono: '',
    fecha_nacimiento: '',
    genero: '',
    direccion: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setTemporaryPassword(null);

    try {
      // Obtener el token del usuario actual
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setMessage({ type: 'error', text: 'No estás autenticado' });
        setLoading(false);
        return;
      }

      // Llamar a la Edge Function
      const { data, error } = await supabase.functions.invoke('create-patient', {
        body: {
          ...formData,
          hospital_id: hospitalId
        }
      });

      if (error) throw error;

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: data.message 
        });
        setTemporaryPassword(data.temporary_password);
        
        // Limpiar formulario
        setFormData({
          nombre: '',
          apellido: '',
          cedula: '',
          email: '',
          telefono: '',
          fecha_nacimiento: '',
          genero: '',
          direccion: ''
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Error al registrar paciente' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Registrar Nuevo Paciente</h2>
      
      {message && (
        <div className={`p-4 mb-4 rounded ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
          {temporaryPassword && (
            <div className="mt-2 font-semibold">
              Contraseña temporal: {temporaryPassword}
              <p className="text-sm font-normal mt-1">
                (Proporcione esta contraseña al paciente)
              </p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Apellido *</label>
            <input
              type="text"
              name="apellido"
              value={formData.apellido}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cédula *</label>
            <input
              type="text"
              name="cedula"
              value={formData.cedula}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono</label>
            <input
              type="tel"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Fecha de Nacimiento</label>
            <input
              type="date"
              name="fecha_nacimiento"
              value={formData.fecha_nacimiento}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Género</label>
          <select
            name="genero"
            value={formData.genero}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar...</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Dirección</label>
          <textarea
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
            rows="3"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Registrando...' : 'Registrar Paciente'}
        </button>
      </form>
    </div>
  );
};  

export default RegisterPatientForm;