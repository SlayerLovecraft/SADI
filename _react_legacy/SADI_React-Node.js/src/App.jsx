// ============================================
// App.jsx - VERSIÓN OPTIMIZADA CON CODE-SPLITTING (REACT.LAZY)
// ============================================
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { ToastProvider } from "@/components/ui/toaster";

import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import CallTraceFallbackDock from "@/components/CallTraceFallbackDock";

// Auth Pages (Lazy-loaded)
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));

// Admin & Telemonitoring Pages (Lazy-loaded)
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TelemonitoringDashboardPage = lazy(() => import('@/pages/TelemonitoringDashboardPage'));
const Rias3280ManagementPage = lazy(() => import('@/pages/Rias3280ManagementPage'));
const VapiIntegrationPage = lazy(() => import('@/pages/VapiIntegrationPage'));
const IvrSchedulePage = lazy(() => import('@/pages/IvrSchedulePage'));
const PatientsPage = lazy(() => import('@/pages/PatientsPage'));
const DoctorsPage = lazy(() => import('@/pages/DoctorsPage'));
const SegmentationPage = lazy(() => import('@/pages/SegmentationPage'));
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage'));
const CampaignsPage = lazy(() => import('@/pages/CampaignsPage'));
const CampaignDetailsPage = lazy(() => import('@/pages/CampaignDetailsPage'));
const InteractionsPage = lazy(() => import('@/pages/InteractionsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const BillingPage = lazy(() => import('@/pages/BillingPage'));

// Doctor Portal Pages (Lazy-loaded)
const DoctorDashboardPage = lazy(() => import('@/pages/doctor/DoctorDashboardPage'));
const DoctorPatientsPage = lazy(() => import('@/pages/doctor/DoctorPatientsPage'));
const DoctorClinicalRecordsPage = lazy(() => import('@/pages/doctor/DoctorClinicalRecordsPage'));
const DoctorSchedulePage = lazy(() => import('@/pages/doctor/DoctorSchedulePage'));
const DoctorReportsPage = lazy(() => import('@/pages/doctor/DoctorReportsPage'));

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
                <Route path="/login" element={<LoginPage initialMode="hospital" />} />
                <Route path="/doctor/login" element={<LoginPage initialMode="doctor" />} />
                {/* Acceso de pacientes disponible únicamente en la aplicación móvil */}
                <Route path="/patient/*" element={<Navigate to="/login" replace />} />
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
                  element={<Navigate to="/demanda-resolucion" replace />}
                />
                <Route 
                  path="/telemonitoreo" 
                  element={<Navigate to="/demanda-resolucion" replace />}
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
                  path="/demanda-resolucion" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin', 'doctor']}>
                      <Rias3280ManagementPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="/vapi-agent" 
                  element={<Navigate to="/rias-3280" replace />}
                />

                <Route 
                  path="/cronograma" 
                  element={<Navigate to="/ivr-schedule" replace />} 
                />

                <Route 
                  path="/ivr-schedule" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin', 'doctor']}>
                      <IvrSchedulePage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/campaign-schedule" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin', 'doctor']}>
                      <IvrSchedulePage />
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
                  path="/staff" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin']}>
                      <DoctorsPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="/doctors" 
                  element={<Navigate to="/staff" replace />}
                />
                
                <Route 
                  path="/segmentation" 
                  element={<Navigate to="/campaigns" replace />}
                />
                
                <Route 
                  path="/templates" 
                  element={<Navigate to="/campaigns" replace />}
                />
                
                <Route 
                  path="/campaigns" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'hospital_admin', 'doctor', 'operator']}>
                      <CampaignsPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/campaigns/:id" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'hospital_admin', 'doctor', 'operator']}>
                      <CampaignDetailsPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/interactions" 
                  element={<Navigate to="/demanda-resolucion" replace />}
                />
                
                <Route 
                  path="/reports" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'hospital_admin', 'doctor', 'operator']}>
                      <ReportsPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="/billing" 
                  element={
                    <ProtectedRoute roles={['super_admin', 'hospital_admin', 'doctor']}>
                      <BillingPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/facturacion" 
                  element={<Navigate to="/billing" replace />}
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
                {/* DEFAULT REDIRECT */}
                {/* ============================================ */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
            <CallTraceFallbackDock />
          </div>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;