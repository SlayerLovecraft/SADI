// ============================================
//  ProtectedRoute.jsx - VERSIÓN CORREGIDA PARA PACIENTES
// ============================================

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  // ⏳ Mostrar spinner mientras está cargando
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // ❌ Si no hay usuario, redirigir al login apropiado
  if (!user) {
    // Si la ruta es solo para pacientes, redirigir a login de pacientes
    if (roles && roles.length === 1 && roles[0] === 'patient') {
      return <Navigate to="/patient/login" replace />;
    }

    if (roles && roles.length === 1 && roles[0] === 'doctor') {
      return <Navigate to="/doctor/login" replace />;
    }
    
    // Si no, redirigir a login general
    return <Navigate to="/login" replace />;
  }

  // ✅ Verificar roles si están especificados
  if (roles && roles.length > 0) {
    const userRole = user.role;

    // ⚠️ RUTAS EXCLUSIVAS DE PACIENTES
    const isPatientOnlyRoute = roles.length === 1 && roles[0] === 'patient';
    const isDoctorOnlyRoute = roles.length === 1 && roles[0] === 'doctor';
    
    if (isPatientOnlyRoute) {
      // Solo pacientes pueden acceder
      if (userRole !== 'patient') {
        if (userRole === 'doctor') return <Navigate to="/doctor/dashboard" replace />;
        return <Navigate to="/dashboard" replace />;
      }
      return children;
    }

    if (isDoctorOnlyRoute) {
      if (userRole !== 'doctor') {
        if (userRole === 'patient') return <Navigate to="/patient/dashboard" replace />;
        return <Navigate to="/dashboard" replace />;
      }
      return children;
    }

    // ⚠️ RUTAS ADMINISTRATIVAS (NO para pacientes)
    const isAdminRoute = !roles.includes('patient');
    
    if (isAdminRoute && userRole === 'patient') {
      return <Navigate to="/patient/dashboard" replace />;
    }

    // ✅ Verificar si el usuario tiene el rol permitido
    if (!roles.includes(userRole)) {
      // Redirigir según el rol
      if (userRole === 'patient') {
        return <Navigate to="/patient/dashboard" replace />;
      }
      if (userRole === 'doctor') {
        return <Navigate to="/doctor/dashboard" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
