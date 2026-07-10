import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope,
  CalendarDays,
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const allMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/patients', icon: Users, label: 'Pacientes', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/doctors', icon: Stethoscope, label: 'Doctores', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/segmentation', icon: Target, label: 'Segmentación', roles: ['super_admin', 'hospital_admin'] },
    { path: '/templates', icon: FileText, label: 'Plantillas SMS', roles: ['super_admin', 'hospital_admin'] },
    { path: '/campaigns', icon: Send, label: 'Campañas', roles: ['super_admin', 'hospital_admin'] },
    { path: '/interactions', icon: MessageSquare, label: 'Interacciones', roles: ['super_admin', 'hospital_admin'] },
    { path: '/reports', icon: BarChart3, label: 'Reportes', roles: ['super_admin', 'hospital_admin'] },
    { path: '/doctor/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['doctor'] },
    { path: '/doctor/patients', icon: Users, label: 'Mis Pacientes', roles: ['doctor'] },
    { path: '/doctor/schedule', icon: CalendarDays, label: 'Mi Cronograma', roles: ['doctor'] },
    { path: '/doctor/segmentation', icon: Target, label: 'Segmentación', roles: ['doctor'] },
    { path: '/doctor/reports', icon: BarChart3, label: 'Reportes', roles: ['doctor'] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(user?.role));

  const pageTitle = (() => {
    const current = menuItems.find((i) => location.pathname === i.path) ||
      menuItems.find((i) => location.pathname.startsWith(i.path));
    return current?.label || 'SADI';
  })();

  const initials = (() => {
    const source = String(user?.nombre || user?.email || '').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    const first = parts[0]?.[0] || 'U';
    const second = parts.length > 1 ? (parts[1]?.[0] || '') : (parts[0]?.[1] || '');
    return (first + second).toUpperCase();
  })();

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      setTimeout(() => {
        navigate(user?.role === 'doctor' ? '/doctor/login' : '/login', { replace: true });
        setIsLoggingOut(false);
      }, 100);
    } catch (error) {
      navigate(user?.role === 'doctor' ? '/doctor/login' : '/login', { replace: true });
      setIsLoggingOut(false);
    }
  };

  const SidebarContent = ({ closeOnNavigate }) => (
    <div className="flex h-full flex-col">
      <div className="p-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-blue-600">SADI</h1>
          <p className="text-xs text-gray-500 mt-1">Sistema de Apoyo para Demanda Inducida</p>
          {user?.hospitalId && (
            <div className="mt-2 px-2 py-1 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              <span className="truncate max-w-[160px]">{user?.hospital_name || 'Hospital'}</span>
            </div>
          )}
        </div>
        {closeOnNavigate && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden rounded-xl"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="px-3 pb-4 space-y-1 flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => (closeOnNavigate ? setSidebarOpen(false) : null)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                isActive ? 'bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-100' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="mb-3 px-4">
          <p className="text-sm font-medium text-gray-900 truncate">{user?.nombre}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start rounded-xl"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isLoggingOut ? 'Cerrando...' : 'Cerrar Sesión'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <aside className="hidden lg:block fixed left-0 top-0 h-full w-72 bg-white border-r border-gray-200 shadow-sm z-40">
        <SidebarContent closeOnNavigate={false} />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 h-full w-72 bg-white border-r border-gray-200 shadow-lg z-40 lg:hidden"
          >
            <SidebarContent closeOnNavigate />
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="lg:ml-72 min-h-screen min-w-0">
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur">
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
                <p className="text-xs text-gray-500 truncate">{user?.hospital_name || 'Panel'}</p>
                <h2 className="text-base font-semibold text-gray-900 truncate">{pageTitle}</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[240px]">{user?.nombre}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
                {initials}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleLogout}
                disabled={isLoggingOut}
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

export default Layout;
