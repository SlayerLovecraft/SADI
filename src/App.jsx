import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// Auth Pages
import LoginPage from '@/pages/LoginPage';
import RegisterHospitalPage from '@/pages/RegisterHospitalPage';

// Admin Pages
import DashboardPage from '@/pages/DashboardPage';
import PatientsPage from '@/pages/PatientsPage';
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

function App() {
	return (
		<AuthProvider>
			<Router>
				<Helmet>
					<title>SADI - Sistema de Apoyo para Demanda Inducida</title>
				</Helmet>
				<div className="min-h-screen bg-gray-50">
					<Routes>
						<Route path="/login" element={<LoginPage />} />
						<Route path="/register-hospital" element={<RegisterHospitalPage />} />

						{/* Admin Routes */}
						<Route path="/dashboard" element={<ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin']}><DashboardPage /></ProtectedRoute>} />
						<Route path="/patients" element={<ProtectedRoute roles={['super_admin', 'operator', 'hospital_admin']}><PatientsPage /></ProtectedRoute>} />
						<Route path="/segmentation" element={<ProtectedRoute roles={['super_admin', 'hospital_admin']}><SegmentationPage /></ProtectedRoute>} />
						<Route path="/templates" element={<ProtectedRoute roles={['super_admin', 'hospital_admin']}><TemplatesPage /></ProtectedRoute>} />
						<Route path="/campaigns" element={<ProtectedRoute roles={['super_admin', 'hospital_admin']}><CampaignsPage /></ProtectedRoute>} />
						<Route path="/campaigns/:id" element={<ProtectedRoute roles={['super_admin', 'hospital_admin']}><CampaignDetailsPage /></ProtectedRoute>} />
						<Route path="/interactions" element={<ProtectedRoute roles={['super_admin', 'hospital_admin']}><InteractionsPage /></ProtectedRoute>} />
						<Route path="/reports" element={<ProtectedRoute roles={['super_admin', 'hospital_admin']}><ReportsPage /></ProtectedRoute>} />

						{/* Patient Portal Routes */}
						<Route path="/patient/dashboard" element={<ProtectedRoute roles={['patient']}><PatientDashboard /></ProtectedRoute>} />
						<Route path="/patient/programs" element={<ProtectedRoute roles={['patient']}><PatientProgramsPage /></ProtectedRoute>} />
						<Route path="/patient/history" element={<ProtectedRoute roles={['patient']}><PatientHistoryPage /></ProtectedRoute>} />
						<Route path="/patient/health" element={<ProtectedRoute roles={['patient']}><PatientHealthPage /></ProtectedRoute>} />

						{/* Default Redirect */}
						<Route path="/" element={<LoginPage />} />
					</Routes>
					<Toaster />
				</div>
			</Router>
		</AuthProvider>
	);
}

export default App;