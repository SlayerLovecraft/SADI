import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Activity, 
  FileText, 
  Heart, 
  AlertOctagon,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

const PatientLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();

  const menuItems = [
    { path: '/patient/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/patient/programs', icon: Activity, label: 'Mis Programas' },
    { path: '/patient/history', icon: FileText, label: 'Historia Clínica' },
    { path: '/patient/health', icon: Heart, label: 'Mi Salud' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSOS = () => {
    toast({
      title: "Servicio no disponible",
      description: "El botón SOS no está habilitado para tu EPS/IPS actualmente.",
      variant: "destructive"
    });
  };

  return (
    <div className="min-h-screen bg-teal-50">
      {/* Mobile menu button */}
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

      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || window.innerWidth >= 1024) && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="fixed left-0 top-0 h-full w-64 bg-white border-r border-teal-200 shadow-lg z-40 lg:translate-x-0"
          >
            <div className="p-6 bg-teal-600">
              <h1 className="text-2xl font-bold text-white">SADI Salud</h1>
              <p className="text-xs text-teal-100 mt-1">Portal del Paciente</p>
            </div>

            <nav className="px-4 py-6 space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-teal-50 text-teal-700 font-medium'
                        : 'text-gray-600 hover:bg-teal-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              
              <button
                onClick={handleSOS}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 text-red-600 hover:bg-red-50 font-medium"
              >
                <AlertOctagon className="h-5 w-5" />
                <span>SOS</span>
              </button>
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
              <div className="mb-3 px-4">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.nombre}</p>
                <p className="text-xs text-gray-500">Paciente</p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-red-50 hover:text-red-600 border-red-100"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="lg:ml-64 min-h-screen p-4 lg:p-8">
        {children}
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

export default PatientLayout;