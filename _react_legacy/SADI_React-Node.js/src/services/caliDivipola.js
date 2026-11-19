// ==============================================================================
// caliDivipola.js - CATÁLOGO OFICIAL DIVIPOLA SANTIAGO DE CALI (VALLE DEL CAUCA)
// Código DANE Municipio: 76001 | Departamento: 76 (Valle del Cauca)
// Jerarquía oficial solicitada para filtros de ubicación en SADI:
//   1. Rural  -> Corregimiento (15) -> Vereda / Centro Poblado
//   2. Urbano -> Comuna (1 a 22)    -> Barrio
// ==============================================================================

export const CALI_DANE_METADATA = {
  codDepartamento: '76',
  departamento: 'Valle del Cauca',
  codMunicipio: '76001',
  municipio: 'Santiago de Cali',
};

// Sedes reales de la Red de Salud del Centro ESE (según hoja BD_info de BD Usuarios.xlsx)
export const CALI_IPS_SEDES = [
  'Sede Principal - Santiago de Cali (Red Salud Centro)',
  'IPS 01 - Diego Lalinde (Comuna 8)',
  'IPS 02 - Primitivo Crespo (Comuna 8)',
  'IPS 17 - Primitivo Iglesias (Comuna 8)',
  'IPS 03 - Obrero (Comuna 9)',
  'IPS 04 - Belalcázar (Comuna 9)',
  'IPS 05 - Bretaña (Comuna 9)',
  'IPS 06 - Cristóbal Colón (Comuna 10)',
  'IPS 07 - Panamericano (Comuna 10)',
  'IPS 08 - Alfonso Young (Comuna 10)',
  'IPS 10 - Guabal Divino Niño (Comuna 10)',
  'IPS 11 - Luis H. Garcés (Comuna 11)',
  'IPS 12 - Aguablanca (Comuna 11)',
  'IPS 13 - Primavera (Comuna 11)',
  'IPS 09 - El Rodeo (Comuna 12)',
  'IPS 15 - Doce de Octubre (Comuna 12)',
  'IPS 16 - Santiago Rengifo (Comuna 12)',
];

// ==============================================================================
// 1. ZONA RURAL: 15 CORREGIMIENTOS OFICIALES DE SANTIAGO DE CALI
//    Cada corregimiento despliega sus Veredas y Centros Poblados oficiales
// ==============================================================================
export const CALI_RURAL_CORREGIMIENTOS = [
  {
    id: 'la_buitrera',
    nombre: 'La Buitrera',
    veredas: [
      'Vereda Alto Rosario',
      'Vereda Callejón de las Chivas',
      'Vereda El Otoño',
      'Vereda El Rosario',
      'Vereda La Buitrera',
      'Vereda Las Palmas',
      'Vereda Pueblo Nuevo',
    ],
    centrosPoblados: [
      'La Buitrera (Cabecera)',
      'El Rosario',
      'Alto del Rosario',
    ],
  },
  {
    id: 'el_hormiguero',
    nombre: 'El Hormiguero',
    veredas: [
      'Vereda Cascajal',
      'Vereda Cauca Seco',
      'Vereda El Hormiguero',
      'Vereda Morgan',
      'Vereda Puerto Nuevo',
    ],
    centrosPoblados: [
      'El Hormiguero (Cabecera)',
      'Cascajal',
      'Cauca Seco',
      'Flamenco',
    ],
  },
  {
    id: 'el_saladito',
    nombre: 'El Saladito',
    veredas: [
      'Vereda El Carmelo',
      'Vereda El Saladito',
      'Vereda Montañuelas',
      'Vereda San Antonio',
      'Vereda San Miguel',
    ],
    centrosPoblados: [
      'El Saladito (Cabecera)',
      'San Antonio',
      'San Miguel',
      'El Palomar',
    ],
  },
  {
    id: 'felidia',
    nombre: 'Felidia',
    veredas: [
      'Vereda El Diamante',
      'Vereda Felidia',
      'Vereda La Esperanza',
      'Vereda La Soledad',
      'Vereda Las Nieves',
      'Vereda Santa Elena',
    ],
    centrosPoblados: [
      'Felidia (Cabecera)',
      'La Soledad',
      'Santa Elena',
    ],
  },
  {
    id: 'golondrinas',
    nombre: 'Golondrinas',
    veredas: [
      'Vereda El Filo',
      'Vereda Golondrinas',
      'Vereda La Reforma',
      'Vereda Las Minas',
    ],
    centrosPoblados: [
      'Golondrinas (Cabecera)',
      'La Reforma',
    ],
  },
  {
    id: 'la_castilla',
    nombre: 'La Castilla',
    veredas: [
      'Vereda El Futuro',
      'Vereda El Pinar',
      'Vereda La Castilla',
      'Vereda Las Brisas',
      'Vereda Los Limones',
      'Vereda Los Mangos',
      'Vereda Monte Frío',
    ],
    centrosPoblados: [
      'La Castilla (Cabecera)',
      'El Pinar',
      'Las Brisas',
    ],
  },
  {
    id: 'la_elvira',
    nombre: 'La Elvira',
    veredas: [
      'Vereda Alto Aguacatal',
      'Vereda La Elvira',
      'Vereda Los Laureles',
      'Vereda San Pablo',
    ],
    centrosPoblados: [
      'La Elvira (Cabecera)',
      'Alto Aguacatal',
      'Kilómetro 18',
    ],
  },
  {
    id: 'la_leonera',
    nombre: 'La Leonera',
    veredas: [
      'Vereda El Pato',
      'Vereda El Retiro',
      'Vereda La Leonera',
      'Vereda Las Nubes',
      'Vereda San Pablo',
    ],
    centrosPoblados: [
      'La Leonera (Cabecera)',
      'El Pato',
      'El Porvenir',
    ],
  },
  {
    id: 'la_paz',
    nombre: 'La Paz',
    veredas: [
      'Vereda El Rosario',
      'Vereda La Paz',
      'Vereda La Sultana',
      'Vereda Loma Gorda',
    ],
    centrosPoblados: [
      'La Paz (Cabecera)',
      'La Sultana',
    ],
  },
  {
    id: 'los_andes',
    nombre: 'Los Andes',
    veredas: [
      'Vereda Alto Los Mangos',
      'Vereda El Mango',
      'Vereda Los Andes',
      'Vereda Los Cárpatos',
      'Vereda Pueblo Nuevo',
      'Vereda Quebrada Honda',
      'Vereda Yanaconas',
    ],
    centrosPoblados: [
      'Los Andes (Cabecera)',
      'Pueblo Nuevo',
      'Yanaconas',
    ],
  },
  {
    id: 'montebello',
    nombre: 'Montebello',
    veredas: [
      'Vereda Campoalegre',
      'Vereda El Chocho',
      'Vereda La Fonda',
      'Vereda Montebello',
    ],
    centrosPoblados: [
      'Montebello (Cabecera)',
      'Campoalegre',
      'El Chocho',
    ],
  },
  {
    id: 'navarro',
    nombre: 'Navarro',
    veredas: [
      'Vereda El Estero',
      'Vereda La Aldea',
      'Vereda Navarro',
      'Vereda Paso de la Barca',
    ],
    centrosPoblados: [
      'Navarro (Cabecera)',
      'El Estero',
      'La Aldea',
    ],
  },
  {
    id: 'pance',
    nombre: 'Pance',
    veredas: [
      'Vereda Alto Pance',
      'Vereda El Banco',
      'Vereda La Vorágine',
      'Vereda Pico de Águila',
      'Vereda San Francisco',
      'Vereda San Pablo',
    ],
    centrosPoblados: [
      'Pance (Cabecera)',
      'La Vorágine',
      'San Francisco',
    ],
  },
  {
    id: 'pichinde',
    nombre: 'Pichindé',
    veredas: [
      'Vereda El Bosque',
      'Vereda La Honda',
      'Vereda Peñas Blancas',
      'Vereda Pichindé',
      'Vereda Piedras Blancas',
    ],
    centrosPoblados: [
      'Pichindé (Cabecera)',
      'Peñas Blancas',
      'Piedras Blancas',
    ],
  },
  {
    id: 'villacarmelo',
    nombre: 'Villacarmelo',
    veredas: [
      'Vereda Dos Quebradas',
      'Vereda El Carmen',
      'Vereda La Candelaria',
      'Vereda La Fonda',
      'Vereda Los Mangos',
      'Vereda Villacarmelo',
    ],
    centrosPoblados: [
      'Villacarmelo (Cabecera)',
      'El Carmen',
      'La Fonda',
    ],
  },
];

// ==============================================================================
// 2. ZONA URBANA: 22 COMUNAS OFICIALES DE SANTIAGO DE CALI Y SUS BARRIOS
// ==============================================================================
export const CALI_URBANO_COMUNAS = [
  {
    id: 'Comuna 1',
    nombre: 'Comuna 1',
    barrios: ['Aguacatal', 'Terrón Colorado', 'Vista Hermosa', 'Patio Bonito'],
  },
  {
    id: 'Comuna 2',
    nombre: 'Comuna 2',
    barrios: [
      'Centenario', 'Chipichape', 'El Bosque', 'Granada', 'Juanambú', 'La Campiña',
      'La Flora', 'La Merced', 'Menga', 'Prados del Norte', 'San Vicente',
      'Santa Mónica Residencial', 'Versalles', 'Vipasa',
    ],
  },
  {
    id: 'Comuna 3',
    nombre: 'Comuna 3',
    barrios: [
      'El Calvario', 'El Nacional', 'El Peñón', 'La Merced', 'Libertadores',
      'Navarro La Chanca', 'San Antonio', 'San Cayetano', 'San Nicolás',
      'San Pascual', 'San Pedro', 'Santa Rosa', 'Sucre',
    ],
  },
  {
    id: 'Comuna 4',
    nombre: 'Comuna 4',
    barrios: [
      'Berlín', 'Bolivariano', 'Bueno Madrid', 'Calima', 'Evaristo García',
      'Fátima', 'Flora Industrial', 'Jorge Isaacs', 'La Isla', 'La Sultana',
      'Manzanares', 'Olaya Herrera', 'Paseo de los Almendros', 'Popular',
      'Salomia', 'Santander', 'Sultana - Berlín - San Francisco',
    ],
  },
  {
    id: 'Comuna 5',
    nombre: 'Comuna 5',
    barrios: [
      'Barranquilla', 'Chiminangos I', 'Chiminangos II', 'El Sena',
      'La Rivera', 'Los Andes', 'Los Guayacanes', 'Metropolitano del Norte',
      'Paseo de los Almendros', 'Torres de Comfandi', 'Villa del Prado',
    ],
  },
  {
    id: 'Comuna 6',
    nombre: 'Comuna 6',
    barrios: [
      'Alcázares', 'Calimio', 'Ciudadela Floralia', 'Fonaviemcali',
      'Jorge Eliécer Gaitán', 'Los Guaduales', 'Paso del Comercio',
      'Petecuy I', 'Petecuy II', 'Petecuy III', 'San Luis', 'San Luis II',
    ],
  },
  {
    id: 'Comuna 7',
    nombre: 'Comuna 7',
    barrios: [
      'Alfonso López I', 'Alfonso López II', 'Alfonso López III',
      'Fepicol', 'Las Ceibas', 'Puerto Mallarino', 'Puerto Nuevo',
      'San Marino', 'Siete de Agosto', 'Urbanización Base Aérea',
    ],
  },
  {
    id: 'Comuna 8',
    nombre: 'Comuna 8',
    barrios: [
      'Atanasio Girardot', 'Benjamín Herrera', 'Chapinero', 'El Troncal',
      'Industrial', 'La Base', 'La Floresta', 'Las Américas', 'Municipal',
      'Primitivo Crespo', 'Rafael Uribe Uribe', 'Saavedra Galindo',
      'Santa Fe', 'Santa Mónica Popular', 'Simón Bolívar', 'Villanueva',
      'Villacolombia',
    ],
  },
  {
    id: 'Comuna 9',
    nombre: 'Comuna 9',
    barrios: [
      'Alameda', 'Aranjuez', 'Belalcázar', 'Bretaña', 'Guayaquil',
      'Junín', 'Manuel María Buenaventura', 'Obrero', 'Santa Mónica Belalcázar',
      'Sucre',
    ],
  },
  {
    id: 'Comuna 10',
    nombre: 'Comuna 10',
    barrios: [
      'Cristóbal Colón', 'Departamento', 'El Dorado', 'El Guabal',
      'Jorge Zawadzky', 'La Selva', 'Las Acacias', 'Las Granjas',
      'Olímpico', 'Panamericano', 'Pasoancho', 'San Judas Tadeo I',
      'San Judas Tadeo II', 'Santa Elena', 'Santo Domingo',
    ],
  },
  {
    id: 'Comuna 11',
    nombre: 'Comuna 11',
    barrios: [
      'Aguablanca', 'Ciudad Modelo', 'El Jardín', 'El Recuerdo',
      'José Holguín Garcés', 'José María Córdoba', 'La Esperanza',
      'La Fortaleza', 'La Gran Colombia', 'La Independencia', 'La Primavera',
      'León XIII', 'Los Conquistadores', 'Prados de Oriente', 'San Benito',
      'San Carlos', 'San Pedro Claver', 'Veinte de Julio', 'Villanueva',
    ],
  },
  {
    id: 'Comuna 12',
    nombre: 'Comuna 12',
    barrios: [
      'Alfonso Barberena A.', 'Asturias', 'Bello Horizonte', 'Doce de Octubre',
      'Eduardo Santos', 'El Paraíso', 'El Rodeo', 'Fenacoven',
      'Julio Rincón', 'Nueva Floresta', 'Santa Mónica Popular', 'Sindical',
      'Villanueva',
    ],
  },
  {
    id: 'Comuna 13',
    nombre: 'Comuna 13',
    barrios: [
      'Calipso', 'Charco Azul', 'Comuneros II', 'El Diamante', 'El Poblado I',
      'El Poblado II', 'El Pondaje', 'El Vergel', 'La Paz', 'Lleras Restrepo',
      'Los Lagos', 'Marroquín III', 'Ricardo Balcázar', 'Rodrigo Lara Bonilla',
      'Ulpiano Lloreda', 'Villa Blanca', 'Yira Castro',
    ],
  },
  {
    id: 'Comuna 14',
    nombre: 'Comuna 14',
    barrios: [
      'Alfonso Bonilla Aragón', 'Alirio Mora Beltrán', 'José Manuel Marroquín I',
      'José Manuel Marroquín II', 'Las Orquídeas', 'Los Naranjos I',
      'Los Naranjos II', 'Manuela Beltrán', 'Promociones Populares B',
      'Puerta del Sol',
    ],
  },
  {
    id: 'Comuna 15',
    nombre: 'Comuna 15',
    barrios: [
      'Ciudad Córdoba', 'Comuneros I', 'El Morichal', 'El Retiro',
      'El Vallado', 'Laureano Gómez', 'Llano Verde', 'Mojica',
    ],
  },
  {
    id: 'Comuna 16',
    nombre: 'Comuna 16',
    barrios: [
      'Antonio Nariño', 'Brisas del Limonar', 'Ciudad 2000', 'La Alborada',
      'Mariano Ramos', 'República de Israel', 'Unión de Vivienda Popular',
    ],
  },
  {
    id: 'Comuna 17',
    nombre: 'Comuna 17',
    barrios: [
      'Bochalema', 'Caney', 'Ciudad Capri', 'El Gran Limonar', 'El Ingenio',
      'La Hacienda', 'Lili', 'Mayapán - Las Vegas', 'Primero de Mayo',
      'Quintas de Don Simón', 'Santa Anita', 'Unicentro Cali', 'Valle del Lili',
    ],
  },
  {
    id: 'Comuna 18',
    nombre: 'Comuna 18',
    barrios: [
      'Alto Jordán', 'Buenos Aires', 'Caldas', 'El Jordán', 'Francisco Eladio Ramírez',
      'Horizontes', 'Los Chorros', 'Los Farallones', 'Lourdes', 'Mario Correa Rengifo',
      'Meléndez', 'Nápoles', 'Polvorines', 'Prados del Sur',
    ],
  },
  {
    id: 'Comuna 19',
    nombre: 'Comuna 19',
    barrios: [
      'Alférez Real', 'Bella Suiza', 'Camino Real', 'Cañaverales',
      'Cañaveral', 'Champagnat', 'Cuarto de Legua', 'El Lido', 'El Refugio',
      'La Cascada', 'Miraflores', 'Nueva Tequendama', 'Pampalinda',
      'San Fernando Nuevo', 'San Fernando Viejo', 'Santa Isabel', 'Tequendama',
    ],
  },
  {
    id: 'Comuna 20',
    nombre: 'Comuna 20',
    barrios: [
      'Belén', 'Belisario Caicedo', 'Brisas de Mayo', 'Cortijo',
      'La Sultana', 'Lleras Camargo', 'Pueblo Joven', 'Siloé',
      'Tierra Blanca', 'Venezuela',
    ],
  },
  {
    id: 'Comuna 21',
    nombre: 'Comuna 21',
    barrios: [
      'Calimio Desepaz', 'Compartir', 'Decepaz Invicali', 'El Remanso',
      'Pízamos I', 'Pízamos II', 'Pízamos III', 'Potrero Grande',
      'Sol de Oriente', 'Talanga', 'Tercer Milenio', 'Vallegrande',
    ],
  },
  {
    id: 'Comuna 22',
    nombre: 'Comuna 22',
    barrios: [
      'Ciudad Jardín', 'Club Campestre', 'Parcelaciones Pance',
      'Urbanización Ciudad Jardín', 'Urbanización Río Lili',
    ],
  },
];

// Helpers de fusión con datos reales de BD (para garantizar que todo valor real en Supabase aparezca seleccionable)
export function getCaliComunas(dbComunas = []) {
  const official = CALI_URBANO_COMUNAS.map((c) => c.nombre);
  const merged = new Set(official);
  (dbComunas || []).forEach((c) => {
    const clean = String(c || '').trim();
    if (clean && !clean.toLowerCase().includes('cumanday')) {
      merged.add(clean);
    }
  });
  return Array.from(merged).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ''), 10);
    const nb = parseInt(b.replace(/\D/g, ''), 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b, 'es');
  });
}

export function getCaliBarriosForComuna(comunaNombre, dbBarriosPorComuna = {}) {
  const officialObj = CALI_URBANO_COMUNAS.find(
    (c) => c.nombre.toLowerCase() === String(comunaNombre || '').trim().toLowerCase()
  );
  const merged = new Set(officialObj ? officialObj.barrios : []);
  const dbList = dbBarriosPorComuna?.[comunaNombre] || [];
  dbList.forEach((b) => {
    const clean = String(b || '').trim();
    if (clean) merged.add(clean);
  });
  return Array.from(merged).sort((a, b) => a.localeCompare(b, 'es'));
}

export function getCaliCorregimientos(dbCorregimientos = []) {
  const merged = new Set(CALI_RURAL_CORREGIMIENTOS.map((c) => c.nombre));
  (dbCorregimientos || []).forEach((c) => {
    const clean = String(c || '').trim();
    if (clean) merged.add(clean);
  });
  return Array.from(merged).sort((a, b) => a.localeCompare(b, 'es'));
}

export function getCaliVeredasForCorregimiento(corregimientoNombre, dbVeredasPorCorr = {}) {
  const officialObj = CALI_RURAL_CORREGIMIENTOS.find(
    (c) => c.nombre.toLowerCase() === String(corregimientoNombre || '').trim().toLowerCase()
  );
  const merged = new Set(officialObj ? officialObj.veredas : []);
  const dbList = dbVeredasPorCorr?.[corregimientoNombre] || [];
  dbList.forEach((v) => {
    const clean = String(v || '').trim();
    if (clean) merged.add(clean);
  });
  return Array.from(merged).sort((a, b) => a.localeCompare(b, 'es'));
}

export function getCaliCentrosPobladosForCorregimiento(corregimientoNombre, dbCpsPorCorr = {}) {
  const officialObj = CALI_RURAL_CORREGIMIENTOS.find(
    (c) => c.nombre.toLowerCase() === String(corregimientoNombre || '').trim().toLowerCase()
  );
  const merged = new Set(officialObj ? officialObj.centrosPoblados : []);
  const dbList = dbCpsPorCorr?.[corregimientoNombre] || [];
  dbList.forEach((cp) => {
    const clean = String(cp || '').trim();
    if (clean) merged.add(clean);
  });
  return Array.from(merged).sort((a, b) => a.localeCompare(b, 'es'));
}

export function formatLocationFilterSummary(loc = {}) {
  if (!loc || !loc.zona || loc.zona === 'todas') {
    return 'Todo Santiago de Cali (Urbano y Rural)';
  }
  if (loc.zona === 'Urbana') {
    const parts = ['Urbano (Cali)'];
    if (loc.comuna && loc.comuna !== 'todas') parts.push(loc.comuna);
    if (loc.barrio && loc.barrio !== 'todos') parts.push(`Barrio ${loc.barrio}`);
    return parts.join(' • ');
  }
  if (loc.zona === 'Rural') {
    const parts = ['Rural (Cali)'];
    if (loc.corregimiento && loc.corregimiento !== 'todos') parts.push(`Correg. ${loc.corregimiento}`);
    if (loc.vereda && loc.vereda !== 'todas' && loc.vereda !== 'todos') parts.push(loc.vereda);
    if (loc.centroPoblado && loc.centroPoblado !== 'todos') parts.push(`C.P. ${loc.centroPoblado}`);
    return parts.join(' • ');
  }
  return 'Santiago de Cali';
}
