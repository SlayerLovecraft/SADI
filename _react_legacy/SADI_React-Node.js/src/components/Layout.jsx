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
  Building2,
  Activity,
  ShieldCheck,
  FolderArchive,
  Bot,
  Clock
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
    // Rutas Administrativas del Hospital (NO visibles para doctores)
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard Hospital', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/telemonitoring', icon: Activity, label: 'Telemonitoreo 3280', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/rias-3280', icon: ShieldCheck, label: 'Demanda Res. 3280', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/ivr-schedule', icon: Clock, label: 'Cronograma IVR 3280', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/patients', icon: Users, label: 'Pacientes', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/doctors', icon: Stethoscope, label: 'Doctores', roles: ['super_admin', 'operator', 'hospital_admin'] },
    { path: '/segmentation', icon: Target, label: 'Segmentación', roles: ['super_admin', 'hospital_admin'] },
    { path: '/templates', icon: FileText, label: 'Plantillas SMS', roles: ['super_admin', 'hospital_admin'] },
    { path: '/campaigns', icon: Send, label: 'Campañas', roles: ['super_admin', 'hospital_admin'] },
    { path: '/interactions', icon: MessageSquare, label: 'Interacciones', roles: ['super_admin', 'hospital_admin'] },
    { path: '/reports', icon: BarChart3, label: 'Reportes Hospital', roles: ['super_admin', 'hospital_admin'] },

    // Rutas Clínicas Exclusivas de Doctores (Restringidas y enfocadas a su área)
    { path: '/doctor/dashboard', icon: LayoutDashboard, label: 'Mi Panel Clínico', roles: ['doctor'] },
    { path: '/doctor/patients', icon: Users, label: 'Mis Pacientes Asignados', roles: ['doctor'] },
    { path: '/doctor/telemonitoring', icon: Activity, label: 'Telemonitoreo & Signos', roles: ['doctor'] },
    { path: '/doctor/clinical-records', icon: FolderArchive, label: 'Historias Clínicas 3280', roles: ['doctor'] },
    { path: '/doctor/schedule', icon: CalendarDays, label: 'Mi Cronograma de Citas', roles: ['doctor'] },
    { path: '/doctor/reports', icon: BarChart3, label: 'Reportes e Indicadores', roles: ['doctor'] },
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
      <div className="p-6 flex items-start justify-between gap-3 border-b border-gray-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-blue-600">SADI</h1>
            {user?.role === 'doctor' && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                Portal Médico
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {user?.role === 'doctor' ? 'Área Médica • Resolución 3280' : 'Sistema de Apoyo para Demanda Inducida'}
          </p>

          {user?.role === 'doctor' ? (
            <div className="mt-2.5 p-2 bg-blue-50/80 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 truncate">
                <Stethoscope className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="truncate">{user?.doctor_specialty || 'Especialista Asignado'}</span>
              </div>
              <p className="text-[10px] text-blue-600 mt-0.5 truncate">
                Acceso restringido a pacientes asignados
              </p>
            </div>
          ) : user?.hospitalId && (
            <div className="mt-2 px-2 py-1 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-1">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[160px]">{user?.hospital_name || 'Hospital'}</span>
            </div>
          )}
        </div>
        {closeOnNavigate && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="rounded-xl"
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
              onClick={() => setSidebarOpen(false)}
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
    <div className="min-h-screen bg-gray-50 overflow-x-hidden flex flex-col">
      {/* Drawer Plegable (Off-Canvas) - Oculto por defecto en todas las pantallas */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              className="fixed left-0 top-0 h-full w-80 bg-white border-r border-gray-200 shadow-2xl z-50 flex flex-col"
            >
              <SidebarContent closeOnNavigate />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="w-full min-h-screen min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-2.5 lg:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="rounded-xl border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-700 shadow-sm"
                aria-label="Alternar menú lateral"
                title="Menú de Navegación"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">{user?.hospital_name || 'Hospital SADI'}</p>
                <h2 className="text-base font-semibold text-gray-900 truncate">{pageTitle}</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[240px]">{user?.nombre}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold shadow-sm">
                {initials}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                aria-label="Cerrar sesión"
                title="Cerrar Sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-2 sm:p-4 lg:p-6 min-w-0 max-w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
