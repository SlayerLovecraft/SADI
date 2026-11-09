import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  Activity,
  Send,
  Calendar,
  LogOut,
  Building2,
  Settings,
  Shield,
  UserCheck,
  Radio,
  FileText,
  BarChart3,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const Layout = ({ children }) => {
  // Por requerimiento expreso del usuario, el menú es un burger plegable oculto (hide) por defecto
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navigation = [
    { name: 'Dashboard Hospital', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Demanda Res. 3280', path: '/demanda-resolucion', icon: Shield },
    { name: 'Cronograma IVR 3280', path: '/ivr-schedule', icon: Calendar },
    { name: 'Pacientes', path: '/patients', icon: Users },
    { name: 'Doctores', path: '/doctors', icon: UserCheck },
    { name: 'Campañas', path: '/campaigns', icon: Send },
    { name: 'Reportes Hospital', path: '/reports', icon: BarChart3 }
  ];

  function MessageSquareIcon(props) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getPageTitle = () => {
    const current = navigation.find(item => item.path === location.pathname);
    return current ? current.name : 'SADI - Sistema de Demanda Inducida';
  };

  const initials = user?.nombre
    ? user.nombre
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'U';

  const SidebarContent = ({ closeOnNavigate = true }) => (
    <div className="flex flex-col h-full bg-white">
      {/* Brand & Hospital Header */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="/images/SADI_logo.png" 
            alt="Logo SADI" 
            className="h-10 w-auto object-contain"
          />
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 leading-none">
              SADI
            </h1>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(false)}
          className="rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Hospital Badge */}
      <div className="px-5 py-3 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border-b border-blue-100/50">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-bold text-gray-900 block truncate">
              {user?.hospital_name || 'Hospital Central SADI'}
            </span>
            <span className="text-[10px] text-blue-700 font-semibold block">
              Red Hospitalaria Integrada
            </span>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                if (closeOnNavigate) setSidebarOpen(false);
              }}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-600/30'
                  : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/70">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-xs font-black shadow-sm shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">
                {user?.nombre || 'Personal Médico'}
              </p>
              <p className="text-[10px] text-gray-500 capitalize truncate">
                {user?.role?.replace('_', ' ') || 'Coordinador Clínico'}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full rounded-xl text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-2 h-9"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{isLoggingOut ? 'Cerrando...' : 'Cerrar Sesión'}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden flex flex-col">
      {/* MENÚ BURGER PLEGABLE (OFF-CANVAS DRAWER) - OCULTO POR DEFECTO EN TODAS LAS PANTALLAS */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop con desenfoque suave */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50"
              onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar Drawer que se desliza desde la izquierda */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white border-r border-gray-200 shadow-2xl z-50 flex flex-col"
            >
              <SidebarContent closeOnNavigate />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* CONTENEDOR PRINCIPAL - 100% ANCHO DE PANTALLA */}
      <main className="w-full min-h-screen min-w-0 flex flex-col">
        {/* Cabecera superior compacta con botón burger siempre visible */}
        <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/95 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between px-3 sm:px-5 py-2.5">
            {/* Botón Burger + Título */}
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 shadow-xs shrink-0 h-9 w-9"
                aria-label="Abrir Menú de Navegación"
                title="Menú de Navegación"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 hidden sm:inline-block">
                    {user?.hospital_name || 'Hospital SADI'}
                  </span>
                  <span className="text-[11px] text-gray-400 hidden sm:inline-block">•</span>
                  <h2 className="text-sm sm:text-base font-extrabold text-gray-900 truncate">
                    {getPageTitle()}
                  </h2>
                </div>
              </div>
            </div>

            {/* Acciones de Cabecera (Usuario & Salida) */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-gray-900 truncate max-w-[180px]">
                  {user?.nombre || 'Personal Médico'}
                </span>
                <span className="text-[10px] text-gray-500 capitalize">
                  {user?.role?.replace('_', ' ') || 'Coordinador'}
                </span>
              </div>

              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                {initials}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 sm:h-9 sm:w-9"
                aria-label="Cerrar sesión"
                title="Cerrar Sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* CONTENIDO DE LA PÁGINA: Ocupa todo el ancho disponible */}
        <div className="flex-1 w-full min-w-0 p-2 sm:p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
