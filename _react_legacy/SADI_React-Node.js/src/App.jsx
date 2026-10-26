// ============================================
// App.jsx - VERSIÓN OPTIMIZADA CON CODE-SPLITTING (REACT.LAZY)
// ============================================
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { ToastProvider } from "@/components/ui/toaster";

import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Auth Pages (Lazy-loaded)
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const PatientLoginPage = lazy(() => import('@/pages/PatientLoginPage'));
const DoctorLoginPage = lazy(() => import('@/pages/DoctorLoginPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));

// Admin & Telemonitoring Pages (Lazy-loaded)
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TelemonitoringDashboardPage = lazy(() => import('@/pages/TelemonitoringDashboardPage'));
const Rias3280ManagementPage = lazy(() => import('@/pages/Rias3280ManagementPage'));
const VapiIntegrationPage = lazy(() => import('@/pages/VapiIntegrationPage'));
const PatientsPage = lazy(() => import('@/pages/PatientsPage'));
const DoctorsPage = lazy(() => import('@/pages/DoctorsPage'));
const SegmentationPage = lazy(() => import('@/pages/SegmentationPage'));
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage'));
const CampaignsPage = lazy(() => import('@/pages/CampaignsPage'));
const CampaignDetailsPage = lazy(() => import('@/pages/CampaignDetailsPage'));
const InteractionsPage = lazy(() => import('@/pages/InteractionsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));

// Doctor Portal Pages (Lazy-loaded)
const DoctorDashboardPage = lazy(() => import('@/pages/doctor/DoctorDashboardPage'));
const DoctorPatientsPage = lazy(() => import('@/pages/doctor/DoctorPatientsPage'));
const DoctorClinicalRecordsPage = lazy(() => import('@/pages/doctor/DoctorClinicalRecordsPage'));
const DoctorSchedulePage = lazy(() => import('@/pages/doctor/DoctorSchedulePage'));
const DoctorReportsPage = lazy(() => import('@/pages/doctor/DoctorReportsPage'));

// Patient Portal Pages (Lazy-loaded)
const PatientDashboard = lazy(() => import('@/pages/patient/PatientDashboard'));
const PatientProgramsPage = lazy(() => import('@/pages/patient/PatientProgramsPage'));
const PatientSchedulePage = lazy(() => import('@/pages/patient/PatientSchedulePage'));
const PatientHistoryPage = lazy(() => import('@/pages/patient/PatientHistoryPage'));
const PatientHealthPage = lazy(() => import('@/pages/patient/PatientHealthPage'));
const PatientInteractionsPage = lazy(() => import('@/pages/patient/PatientInteractionsPage'));

// Fallback ultraligero mientras se descarga el chunk solicitado
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50/80">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600"></div>
      <p className="text-xs font-semibold text-gray-500">Cargando SADI...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Helmet>
            <title>SADI - Sistema de Ayuda para Demanda Integrado</title>
          </Helmet>
          <div className="min-h-screen bg-gray-50">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ============================================ */}
                {/* AUTH ROUTES - Sin protección */}
                {/* ============================================ */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/patient/login" element={<PatientLoginPage />} />
                <Route path="/doctor/login" element={<DoctorLoginPage />} />
                {/* Registro público deshabilitado: redirige a login */}
                <Route path="/register-hospital" element={<Navigate to="/login" replace />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />

                {/* ============================================ */}
                {/* ADMIN & TELEMONITORING ROUTES */}
                {/* ============================================ */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin']}>
                      <DashboardPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="/telemonitoring" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin', 'doctor']}>
                      <TelemonitoringDashboardPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="/rias-3280" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin', 'doctor']}>
                      <Rias3280ManagementPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="/vapi-agent" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin', 'doctor']}>
                      <VapiIntegrationPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/patients" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin']}>
                      <PatientsPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="/doctors" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin']}>
                      <DoctorsPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/segmentation" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'hospital_admin']}>
                      <SegmentationPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/templates" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'hospital_admin']}>
                      <TemplatesPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/campaigns" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'hospital_admin']}>
                      <CampaignsPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/campaigns/:id" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'hospital_admin']}>
                      <CampaignDetailsPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/interactions" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'hospital_admin']}>
                      <InteractionsPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/reports" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'hospital_admin']}>
                      <ReportsPage />
                    </ProtectedRoute>
                  } 
                />

                {/* ============================================ */}
                {/* DOCTOR PORTAL ROUTES */}
                {/* ============================================ */}
                <Route
                  path="/doctor/dashboard"
                  element={
                    <ProtectedRoute roles={['doctor']}>
                      <DoctorDashboardPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/doctor/telemonitoring"
                  element={
                    <ProtectedRoute roles={['doctor']}>
                      <TelemonitoringDashboardPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/doctor/patients"
                  element={
                    <ProtectedRoute roles={['doctor']}>
                      <DoctorPatientsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/doctor/clinical-records"
                  element={
                    <ProtectedRoute roles={['doctor', 'super_admin', 'hospital_admin', 'operator']}>
                      <DoctorClinicalRecordsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/doctor/schedule"
                  element={
                    <ProtectedRoute roles={['doctor']}>
                      <DoctorSchedulePage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/doctor/reports"
                  element={
                    <ProtectedRoute roles={['doctor']}>
                      <DoctorReportsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/doctor/segmentation"
                  element={
                    <ProtectedRoute roles={['doctor']}>
                      <SegmentationPage />
                    </ProtectedRoute>
                  }
                />

                {/* ============================================ */}
                {/* PATIENT PORTAL ROUTES */}
                {/* ============================================ */}
                <Route 
                  path="/patient/dashboard" 
                  element={
                    <ProtectedRoute roles={['patient']}>
                      <PatientDashboard />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/patient/programs" 
                  element={
                    <ProtectedRoute roles={['patient']}>
                      <PatientProgramsPage />
                    </ProtectedRoute>
                  } 
                />

                <Route
                  path="/patient/schedule"
                  element={
                    <ProtectedRoute roles={['patient']}>
                      <PatientSchedulePage />
                    </ProtectedRoute>
                  }
                />
                
                <Route 
                  path="/patient/history" 
                  element={
                    <ProtectedRoute roles={['patient']}>
                      <PatientHistoryPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/patient/health" 
                  element={
                    <ProtectedRoute roles={['patient']}>
                      <PatientHealthPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/patient/interactions" 
                  element={
                    <ProtectedRoute roles={['patient']}>
                      <PatientInteractionsPage />
                    </ProtectedRoute>
                  } 
                />

                {/* ============================================ */}
                {/* DEFAULT REDIRECT */}
                {/* ============================================ */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;