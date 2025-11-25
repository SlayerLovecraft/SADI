import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Target, 
  FileText, 
  Send, 
  MessageSquare, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/patients', icon: Users, label: 'Pacientes', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/segmentation', icon: Target, label: 'Segmentación', roles: ['super_admin', 'hospital_admin'] },
    { path: '/templates', icon: FileText, label: 'Plantillas SMS', roles: ['super_admin', 'hospital_admin'] },
    { path: '/campaigns', icon: Send, label: 'Campañas', roles: ['super_admin', 'hospital_admin'] },
    { path: '/interactions', icon: MessageSquare, label: 'Interacciones', roles: ['super_admin', 'hospital_admin'] },
    { path: '/reports', icon: BarChart3, label: 'Reportes', roles: ['super_admin', 'hospital_admin'] },
  ];

  // Filter menu based on user role
  const menuItems = allMenuItems.filter(item => item.roles.includes(user?.role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-white shadow-md"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <AnimatePresence>
        {(sidebarOpen || window.innerWidth >= 1024) && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 shadow-lg z-40 lg:translate-x-0"
          >
            <div className="p-6">
              <h1 className="text-2xl font-bold text-blue-600">SADI</h1>
              <p className="text-xs text-gray-500 mt-1">Sistema de Apoyo para Demanda Inducida</p>
              {user?.hospitalId && (
                 <div className="mt-2 px-2 py-1 bg-blue-50 rounded text-xs text-blue-700 flex items-center gap-1">
                   <Building2 className="h-3 w-3" />
                   <span className="truncate max-w-[140px]">
                     {JSON.parse(localStorage.getItem('sadi_hospitals') || '[]').find(h => h.id === user.hospitalId)?.name || 'Hospital'}
                   </span>
                 </div>
              )}
            </div>

            <nav className="px-4 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
              <div className="mb-3 px-4">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.nombre}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;