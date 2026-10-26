# SADI - Sistema de Ayuda para Demanda Integrado

SADI es una plataforma integral de gestión de salud diseñada para conectar hospitales, médicos y pacientes. Permite a los hospitales administrar pacientes de manera eficiente, segmentarlos, crear plantillas de comunicación y ejecutar campañas dirigidas. Además, proporciona portales especializados para que los médicos gestionen sus horarios y pacientes, y para que los pacientes visualicen sus datos de salud, historial de interacciones y programas médicos.

## 🚀 Tecnologías Principales

- **Frontend:** React 19, Vite
- **Estilos y UI:** Tailwind CSS, Radix UI, Framer Motion, Lucide React
- **Enrutamiento:** React Router DOM
- **Backend & Base de Datos:** Supabase, PostgreSQL
- **Generación de Reportes:** jsPDF, xlsx
- **Gestión de Peticiones HTTP:** Axios

## 👥 Roles y Accesos

El sistema cuenta con un control de acceso basado en roles (RBAC) que define diferentes vistas y permisos:

1. **Super Admin / Hospital Admin:** Acceso completo al panel administrativo. Gestión de hospitales, campañas, reportes y plantillas.
2. **Operator:** Acceso limitado dentro del panel administrativo (gestión básica de pacientes).
3. **Doctor:** Acceso al portal médico para gestionar citas, pacientes asignados y reportes de salud.
4. **Patient:** Acceso al portal de paciente para ver su historial médico, programas de salud y próximas citas.

## 🌟 Funcionalidades Clave

### Panel Administrativo (Hospital)
- **Dashboard:** Visión general de métricas clave y estadísticas del hospital.
- **Gestión de Pacientes y Médicos:** Alta, baja y modificación de usuarios.
- **Segmentación:** Creación de reglas dinámicas para segmentar pacientes según criterios de salud o demográficos.
- **Campañas y Plantillas:** Creación de plantillas de mensajes y programación de campañas dirigidas a segmentos específicos de pacientes.
- **Interacciones y Reportes:** Historial de comunicaciones y exportación de datos a PDF o Excel.

### Portal Médico
- **Mi Agenda (Schedule):** Visualización y gestión de citas programadas.
- **Mis Pacientes:** Listado de pacientes asignados y visualización de sus historias clínicas.
- **Reportes de Salud:** Seguimiento y registro de indicadores de salud de los pacientes.

### Portal del Paciente
- **Programas de Salud:** Seguimiento de los programas en los que el paciente está inscrito.
- **Historial Médico:** Visualización de consultas y diagnósticos pasados.
- **Mis Datos de Salud:** Métricas e indicadores de bienestar.
- **Próximas Citas y Notificaciones:** Agenda personal y registro de comunicaciones recibidas.

## 📁 Estructura del Proyecto

```text
SADI_React-Node.js/
├── src/
│   ├── components/       # Componentes UI reutilizables (Botones, Modales, Tablas)
│   ├── contexts/         # Contextos de React (ej. AuthContext para autenticación)
│   ├── hooks/            # Custom hooks para lógica reutilizable
│   ├── layouts/          # Estructuras de diseño base (Navbar, Sidebar)
│   ├── lib/              # Utilidades y configuración de librerías
│   ├── pages/            # Páginas de la aplicación organizadas por módulos (admin, doctor, patient)
│   ├── services/         # Servicios de integración con Supabase y APIs
│   ├── App.jsx           # Configuración principal de enrutamiento (React Router)
│   └── main.jsx          # Punto de entrada de la aplicación
├── supabase/             # Configuraciones y migraciones de Supabase
├── public/               # Archivos estáticos
├── package.json          # Dependencias y scripts del proyecto
├── tailwind.config.js    # Configuración de Tailwind CSS
└── vite.config.js        # Configuración de Vite
```

## 🛠️ Instalación y Uso Local

### Prerrequisitos

- **Node.js** (v18 o superior)
- **npm** o **yarn**

### 1. Clonar el repositorio

\`\`\`bash
git clone <url-del-repositorio>
cd SADI_React-Node.js
\`\`\`

### 2. Instalar dependencias

\`\`\`bash
npm install
\`\`\`

### 3. Configurar variables de entorno

Crea un archivo \`.env\` en la raíz del proyecto basándote en un archivo de ejemplo (si existe) o agrega las siguientes credenciales de Supabase:

\`\`\`env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
\`\`\`

### 4. Iniciar el servidor de desarrollo

\`\`\`bash
npm run dev
\`\`\`

La aplicación estará disponible en `http://localhost:5173` (o el puerto que indique Vite en la consola).

## 📄 Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo en modo local.
- `npm run build`: Construye la aplicación para producción.
- `npm run preview`: Previsualiza la build de producción localmente.

## 🗄️ Esquema de Base de Datos Principal

El sistema utiliza un modelo relacional en PostgreSQL (gestionado vía Supabase) que incluye entidades como:
- `USER`, `HOSPITAL`, `PATIENT`
- `SEGMENTATION_RULE`, `TEMPLATE`, `CAMPAIGN`, `CAMPAIGN_MESSAGE`
- `INTERACTION_HISTORY`, `PATIENT_PROGRAM`, `PATIENT_HEALTH_DATA`

*(Un diagrama Entidad-Relación completo se encuentra definido en el archivo `SADI.xml`)*
