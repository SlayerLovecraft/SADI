// ============================================
//	App.jsx - VERSIÓN CORREGIDA
// ============================================
import React from 'react';
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { ToastProvider } from "@/components/ui/toaster";

import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ChangePasswordModal from '@/components/ChangePasswordModal';

// Auth Pages
import LoginPage from '@/pages/LoginPage';
import PatientLoginPage from '@/pages/PatientLoginPage';
import RegisterHospitalPage from '@/pages/RegisterHospitalPage';
import DoctorLoginPage from '@/pages/DoctorLoginPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import AuthCallbackPage from '@/pages/AuthCallbackPage';

// Admin Pages
import DashboardPage from '@/pages/DashboardPage';
import PatientsPage from '@/pages/PatientsPage';
import DoctorsPage from '@/pages/DoctorsPage';
import SegmentationPage from '@/pages/SegmentationPage';
import TemplatesPage from '@/pages/TemplatesPage';
import CampaignsPage from '@/pages/CampaignsPage';
import CampaignDetailsPage from '@/pages/CampaignDetailsPage';
import InteractionsPage from '@/pages/InteractionsPage';
import ReportsPage from '@/pages/ReportsPage';

// Patient Portal Pages
import PatientDashboard from '@/pages/patient/PatientDashboard';
import PatientProgramsPage from '@/pages/patient/PatientProgramsPage';
import PatientHistoryPage from '@/pages/patient/PatientHistoryPage';
import PatientHealthPage from '@/pages/patient/PatientHealthPage';
import PatientInteractionsPage from '@/pages/patient/PatientInteractionsPage';
import DoctorDashboardPage from '@/pages/doctor/DoctorDashboardPage';
import DoctorPatientsPage from '@/pages/doctor/DoctorPatientsPage';
import DoctorReportsPage from '@/pages/doctor/DoctorReportsPage';
import DoctorSchedulePage from '@/pages/doctor/DoctorSchedulePage';
import PatientSchedulePage from '@/pages/patient/PatientSchedulePage';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Helmet>
            <title>SADI - Sistema de Ayuda para Demanda Integrado</title>
          </Helmet>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              {/* ============================================ */}
              {/* AUTH ROUTES - Sin protección */}
              {/* ============================================ */}
              <Route path="/login" element={<LoginPage />} /> {/* Staff/Hospital */}
              <Route path="/patient/login" element={<PatientLoginPage />} /> {/* Pacientes */}
              <Route path="/doctor/login" element={<DoctorLoginPage />} />
              <Route path="/register-hospital" element={<RegisterHospitalPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* ============================================ */}
              {/* ADMIN ROUTES - Solo personal del hospital */}
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

              <Route
                path="/doctor/dashboard"
                element={
                  <ProtectedRoute roles={['doctor']}>
                    <DoctorDashboardPage />
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
              {/* PATIENT PORTAL ROUTES - Solo pacientes */}
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
              
              {/* Ruta 404 - Opcional */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;