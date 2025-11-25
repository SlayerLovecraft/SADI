import api from './api';

export const patientService = {
  // Obtener todos los pacientes
  getAll: async (filters = {}) => {
    try {
      const response = await api.get('/patients', { params: filters });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al obtener pacientes' 
      };
    }
  },

  // Obtener un paciente por ID
  getById: async (id) => {
    try {
      const response = await api.get(`/patients/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al obtener paciente' 
      };
    }
  },

  // Crear paciente
  create: async (patientData) => {
    try {
      const response = await api.post('/patients', patientData);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al crear paciente' 
      };
    }
  },

  // Actualizar paciente
  update: async (id, patientData) => {
    try {
      const response = await api.put(`/patients/${id}`, patientData);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al actualizar paciente' 
      };
    }
  },

  // Eliminar paciente
  delete: async (id) => {
    try {
      await api.delete(`/patients/${id}`);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al eliminar paciente' 
      };
    }
  }
};