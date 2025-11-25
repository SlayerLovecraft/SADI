import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Allow patients to access only patient routes
  if (user.role === 'patient') {
    if (roles && !roles.includes('patient')) {
       return <Navigate to="/patient/dashboard" replace />;
    }
  } else {
    // If non-patient tries to access patient routes
    if (roles && roles.includes('patient') && !roles.includes('super_admin') && !roles.includes('hospital_admin') && !roles.includes('operator')) {
         return <Navigate to="/dashboard" replace />;
    }
  }

  if (roles && !roles.includes(user.role)) {
    if (user.role === 'patient') return <Navigate to="/patient/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;