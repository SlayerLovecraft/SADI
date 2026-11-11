import React, { useState, useEffect } from 'react';
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
  Receipt,
  Bot,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('⚠️ Error capturado por PageErrorBoundary de SADI:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl border border-red-200 shadow-lg p-8 max-w-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Se detectó una discrepancia en los datos clínicos
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              El sistema protegió la interfaz para evitar visualizaciones incompletas. Puedes recargar la sección de forma segura.
            </p>
            {this.state.error?.message && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <div className="pt-2 flex justify-center gap-3">
              <Button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Recargar Sección
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Layout = ({ children }) => {
  // Por requerimiento expreso del usuario, el menú es un burger plegable oculto (hide) por defecto
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Estado y sincronización de Dark Mode persistido en localStorage
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('sadi_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('sadi_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('sadi_theme', 'light');
      }
    } catch (e) {
      console.warn('Error al guardar tema oscuro en localStorage:', e);
    }
  }, [darkMode]);

  const isStaffRole = user?.role === 'doctor';

  const allNavigation = [
    { name: isStaffRole ? 'Dashboard Clínico' : 'Dashboard Hospital', path: isStaffRole ? '/doctor/dashboard' : '/dashboard', icon: LayoutDashboard },
    { name: 'Demanda Res. 3280', path: '/demanda-resolucion', icon: Shield },
    { name: 'Cronograma IVR 3280', path: '/ivr-schedule', icon: Calendar },
    { name: 'Pacientes', path: isStaffRole ? '/doctor/patients' : '/patients', icon: Users },
    { name: 'Personal', path: '/staff', icon: UserCheck, hospitalOnly: true },
    { name: 'Campañas', path: '/campaigns', icon: Send },
    { name: 'Facturación y RIPS', path: '/billing', icon: Receipt },
    { name: 'Reportes Hospital', path: '/reports', icon: BarChart3 }
  ];

  const navigation = isStaffRole 
    ? allNavigation.filter(item => !item.hospitalOnly) 
    : allNavigation;

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
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
      {/* Brand & Hospital Header */}
      <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="/images/SADI_logo.png" 
            alt="Logo SADI" 
            className="h-10 w-auto object-contain"
          />
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
              SADI
            </h1>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">
              Demanda Inducida 3280
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(false)}
          className="rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Hospital Badge */}
      <div className="px-5 py-3 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 dark:from-slate-800/80 dark:to-blue-950/40 border-b border-blue-100/50 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
              {user?.hospital_name || 'Hospital Central SADI'}
            </span>
            <span className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold block">
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
                  : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100/80 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-500 dark:text-slate-400'}`} />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/80">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-xs font-black shadow-sm shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {user?.nombre || 'Personal Médico'}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 capitalize truncate">
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
          className="w-full rounded-xl text-xs font-bold text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 gap-2 h-9"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{isLoggingOut ? 'Cerrando...' : 'Cerrar Sesión'}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden flex flex-col transition-colors duration-200">
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
              className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col"
            >
              <SidebarContent closeOnNavigate />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* CABECERA SUPERIOR FIJA TODO EL TIEMPO EN TODA LA PANTALLA */}
      <header className="fixed top-0 left-0 right-0 w-full z-40 h-14 border-b border-gray-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-sm transition-colors duration-200">
        <div className="flex items-center justify-between px-3 sm:px-6 h-full w-full max-w-full">
          {/* Izquierda: Botón Burger Menú (Fijo) + Hospital + Título */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-xs shrink-0 h-9 w-9 transition-all hover:scale-105 active:scale-95"
              aria-label="Abrir Menú de Navegación"
              title="Abrir Menú SADI"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/60 hidden sm:inline-block shrink-0">
                {user?.hospital_name || 'Hospital SADI'}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-slate-600 hidden sm:inline-block">•</span>
              <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white truncate">
                {getPageTitle()}
              </h2>
            </div>
          </div>

          {/* Derecha: Dark Mode + Acciones de Usuario & Salida */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Botón de Dark Mode / Light Mode */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDarkMode(prev => !prev)}
              className="rounded-xl border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-amber-400 hover:bg-gray-100 dark:hover:bg-slate-700 h-8 w-8 sm:h-9 sm:w-9 shadow-xs transition-all hover:scale-105 active:scale-95 shrink-0"
              aria-label={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {darkMode ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700" />
              )}
            </Button>

            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate max-w-[180px]">
                {user?.nombre || 'Personal Médico'}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">
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
              className="rounded-xl text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 h-8 w-8 sm:h-9 sm:w-9"
              aria-label="Cerrar sesión"
              title="Cerrar Sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL - Con padding superior para compensar el header fijo */}
      <main className="w-full min-h-screen min-w-0 flex flex-col pt-14">
        {/* CONTENIDO DE LA PÁGINA: Ocupa todo el ancho disponible */}
        <div className="flex-1 w-full min-w-0 p-2 sm:p-4 lg:p-6">
          <PageErrorBoundary>
            {children}
          </PageErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default Layout;
