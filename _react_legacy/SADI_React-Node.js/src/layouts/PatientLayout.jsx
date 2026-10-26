import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Activity, 
  FileText, 
  Heart, 
  CalendarDays,
  AlertOctagon,
  MessageSquare,
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
    { path: '/patient/schedule', icon: CalendarDays, label: 'Mi Cronograma' },
    { path: '/patient/programs', icon: Activity, label: 'Mis Programas' },
    { path: '/patient/history', icon: FileText, label: 'Historia Clínica' },
    { path: '/patient/health', icon: Heart, label: 'Mi Salud' },
    { path: '/patient/interactions', icon: MessageSquare, label: 'Interacciones' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/patient/login');
  };

  const handleSOS = () => {
    toast({
      title: "Servicio no disponible",
      description: "El botón SOS no está habilitado para tu EPS/IPS actualmente.",
      variant: "destructive"
    });
  };

  const pageTitle = (() => {
    const current = menuItems.find((i) => location.pathname === i.path) ||
      menuItems.find((i) => location.pathname.startsWith(i.path));
    return current?.label || 'SADI Salud';
  })();

  const initials = (() => {
    const source = String(user?.nombre || user?.email || '').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    const first = parts[0]?.[0] || 'U';
    const second = parts.length > 1 ? (parts[1]?.[0] || '') : (parts[0]?.[1] || '');
    return (first + second).toUpperCase();
  })();

  const SidebarContent = ({ closeOnNavigate }) => (
    <div className="flex h-full flex-col">
      <div className="p-6 bg-gradient-to-br from-teal-700 to-teal-600 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">SADI Salud</h1>
          <p className="text-xs text-teal-100 mt-1">Portal del Paciente</p>
        </div>
        {closeOnNavigate && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => (closeOnNavigate ? setSidebarOpen(false) : null)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                isActive ? 'bg-teal-50 text-teal-800 font-semibold ring-1 ring-teal-100' : 'text-gray-700 hover:bg-teal-50'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          );
        })}

        <button
          onClick={handleSOS}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-red-700 hover:bg-red-50 font-semibold"
        >
          <AlertOctagon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 truncate">SOS</span>
        </button>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="mb-3 px-4">
          <p className="text-sm font-medium text-gray-900 truncate">{user?.nombre}</p>
          <p className="text-xs text-gray-500">Paciente</p>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start rounded-xl hover:bg-red-50 hover:text-red-700 border-red-100"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-teal-50 overflow-x-hidden">
      <aside className="hidden lg:block fixed left-0 top-0 h-full w-72 bg-white border-r border-teal-200 shadow-sm z-40">
        <SidebarContent closeOnNavigate={false} />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 h-full w-72 bg-white border-r border-teal-200 shadow-lg z-40 lg:hidden"
          >
            <SidebarContent closeOnNavigate />
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="lg:ml-72 min-h-screen min-w-0">
        <header className="sticky top-0 z-30 border-b border-teal-100 bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden rounded-xl"
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">Portal del paciente</p>
                <h2 className="text-base font-semibold text-gray-900 truncate">{pageTitle}</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[240px]">{user?.nombre}</p>
                <p className="text-xs text-gray-500">Paciente</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 text-white flex items-center justify-center text-sm font-semibold">
                {initials}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleLogout}
                className="rounded-xl"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 min-w-0 max-w-full">
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

export default PatientLayout;
