// ==============================================================================
// SERVICIO DE FACTURACIÓN, COSTOS POR PACIENTE Y RIPS JSON (RES. 2275 DE 2023)
// SADI - SISTEMA DE DEMANDA INDUCIDA • CÓDIGO CUPS OFICIAL: 890201
// ==============================================================================

import { PROGRAMAS_3280 } from './census400kService';
import * as XLSX from 'xlsx';

// Generador de números pseudoaleatorios deterministas por semilla
function pseudoRandom(seed) {
  let s = Math.abs(seed) || 123456789;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ------------------------------------------------------------------------------
// CONSTANTES OFICIALES DE COSTOS Y TARIFAS (COLOMBIA • TRM BASE $4.000 COP/USD)
// ------------------------------------------------------------------------------
export const PRICING_CONSTANTS = {
  // Código CUPS fijado por la institución
  CODIGO_CUPS: '890201',
  NOMBRE_CUPS: 'CONSULTA DE PRIMERA VEZ POR MEDICINA GENERAL (DEMANDA INDUCIDA / TELEORIENTACIÓN)',
  
  // Costos Reales de Infraestructura (Costo Neto Operativo)
  COST_CALL_PER_SECOND: 6.04,     // Vapi ($3.33) + Deepgram ($0.53) + OpenAI ($0.66) + ElevenLabs ($1.33) + Gateway SIM ($0.18)
  COST_WA_UTILITY: 3.20,          // Meta Cloud API Utility ($0.0008 USD)
  COST_WA_MARKETING: 50.00,       // Meta Cloud API Marketing ($0.0125 USD)
  COST_SMS: 18.00,                // OpenVox rotativo / SMS A2P
  COST_EMAIL: 0.40,               // Amazon SES ($0.10 USD / 1.000 correos)
  
  // Tarifas Sugeridas de Venta al Hospital (Facturación)
  PRICE_CALL_PER_SECOND: 12.00,   // Margen comercial ~50%
  PRICE_WA_UTILITY: 80.00,        // Confirmaciones y recordatorios
  PRICE_WA_MARKETING: 180.00,     // Campañas preventivas abiertas
  PRICE_SMS: 40.00,               // Confirmación inmediata por SMS
  PRICE_EMAIL: 25.00,             // Correo institucional estructurado
};

export const MESES_ANO = [
  { id: 1, nombre: 'Enero', abrev: 'Ene' },
  { id: 2, nombre: 'Febrero', abrev: 'Feb' },
  { id: 3, nombre: 'Marzo', abrev: 'Mar' },
  { id: 4, nombre: 'Abril', abrev: 'Abr' },
  { id: 5, nombre: 'Mayo', abrev: 'May' },
  { id: 6, nombre: 'Junio', abrev: 'Jun' },
  { id: 7, nombre: 'Julio', abrev: 'Jul' },
  { id: 8, nombre: 'Agosto', abrev: 'Ago' },
  { id: 9, nombre: 'Septiembre', abrev: 'Sep' },
  { id: 10, nombre: 'Octubre', abrev: 'Oct' },
  { id: 11, nombre: 'Noviembre', abrev: 'Nov' },
  { id: 12, nombre: 'Diciembre', abrev: 'Dic' }
];

export const billingService = {
  // ----------------------------------------------------------------------------
  // Genera el lote de pacientes y consumos específicos para un mes del año
  // ----------------------------------------------------------------------------
  getMonthlyBillingData(year = 2026, monthIndex = 1) {
    const safeMonth = Math.min(12, Math.max(1, parseInt(monthIndex) || 1));
    const mesObj = MESES_ANO.find(m => m.id === safeMonth) || MESES_ANO[0];
    
    // Semilla determinista para estabilidad de datos por mes
    const rng = pseudoRandom(year * 1000 + safeMonth * 88);
    
    // Nombres realistas colombianos
    const nombresM = ['Santiago', 'Mateo', 'Sebastián', 'Alejandro', 'Nicolás', 'Samuel', 'Diego', 'Gabriel', 'Daniel', 'Carlos', 'Andrés', 'Felipe', 'David', 'Javier', 'Esteban'];
    const nombresF = ['Valentina', 'Mariana', 'Camila', 'Isabella', 'Luciana', 'Daniela', 'Sofía', 'Gabriela', 'Natalia', 'Paula', 'Andrea', 'Carolina', 'Juliana', 'Valeria', 'Catalina'];
    const apellidos = ['Gómez', 'Rodríguez', 'López', 'Martínez', 'García', 'Pérez', 'González', 'Hernández', 'Sánchez', 'Ramírez', 'Torres', 'Díaz', 'Vargas', 'Castro', 'Ríos'];
    const municipiosCaldas = [
      { cod: '17001', nombre: 'Manizales' },
      { cod: '17013', nombre: 'Aguadas' },
      { cod: '17042', nombre: 'Anserma' },
      { cod: '17174', nombre: 'Chinchiná' },
      { cod: '17380', nombre: 'La Dorada' },
      { cod: '17873', nombre: 'Villamaría' }
    ];
    
    // Generar entre 40 y 60 registros asistenciales representativos para el mes
    const sampleSize = 48;
    const patients = [];
    
    for (let i = 0; i < sampleSize; i++) {
      const isFemale = rng() > 0.48;
      const nombre = isFemale ? nombresF[Math.floor(rng() * nombresF.length)] : nombresM[Math.floor(rng() * nombresM.length)];
      const ap1 = apellidos[Math.floor(rng() * apellidos.length)];
      const ap2 = apellidos[Math.floor(rng() * apellidos.length)];
      const nombreCompleto = `${nombre} ${ap1} ${ap2}`;
      
      // Asignar curso de vida (A a J)
      const prog = PROGRAMAS_3280[i % PROGRAMAS_3280.length];
      const milestone = prog.milestones[(safeMonth - 1) % prog.milestones.length] || prog.milestones[0];
      
      // Edad congruente con el curso de vida
      const edadSpan = Math.max(1, prog.edadMax - prog.edadMin);
      const edad = prog.edadMin + Math.floor(rng() * (edadSpan + 1));
      
      // Tipo y número de documento
      let tipoDoc = 'CC';
      if (edad < 7) tipoDoc = 'RC';
      else if (edad < 18) tipoDoc = 'TI';
      
      const docNum = 1000000000 + Math.floor(rng() * 900000000);
      const muni = municipiosCaldas[Math.floor(rng() * municipiosCaldas.length)];
      const isRural = rng() > 0.65;
      
      // Consumos individuales de este paciente en este mes
      // Duración de llamada entre 45 y 160 segundos
      const contactado = rng() > 0.12; // 88% contactabilidad
      const segundosLlamada = contactado ? Math.floor(45 + rng() * 115) : Math.floor(10 + rng() * 20);
      const llamadasCount = contactado ? 1 : Math.floor(1 + rng() * 3);
      const waUtilityCount = 1;
      const waMarketingCount = rng() > 0.5 ? 1 : 0;
      const smsCount = rng() > 0.4 ? 1 : 0;
      const emailCount = rng() > 0.3 ? 1 : 0;
      
      // Cálculo de costos unitarios reales para este paciente
      const costoLlamadas = segundosLlamada * PRICING_CONSTANTS.COST_CALL_PER_SECOND;
      const costoWa = (waUtilityCount * PRICING_CONSTANTS.COST_WA_UTILITY) + (waMarketingCount * PRICING_CONSTANTS.COST_WA_MARKETING);
      const costoSms = smsCount * PRICING_CONSTANTS.COST_SMS;
      const costoEmail = emailCount * PRICING_CONSTANTS.COST_EMAIL;
      const costoTotalPaciente = Math.round(costoLlamadas + costoWa + costoSms + costoEmail);
      
      // Facturación al hospital para este paciente
      const cobroLlamadas = segundosLlamada * PRICING_CONSTANTS.PRICE_CALL_PER_SECOND;
      const cobroWa = (waUtilityCount * PRICING_CONSTANTS.PRICE_WA_UTILITY) + (waMarketingCount * PRICING_CONSTANTS.PRICE_WA_MARKETING);
      const cobroSms = smsCount * PRICING_CONSTANTS.PRICE_SMS;
      const cobroEmail = emailCount * PRICING_CONSTANTS.PRICE_EMAIL;
      const cobroTotalPaciente = Math.round(cobroLlamadas + cobroWa + cobroSms + cobroEmail);
      
      const utilidadPaciente = cobroTotalPaciente - costoTotalPaciente;
      const margenPct = cobroTotalPaciente > 0 ? (utilidadPaciente / cobroTotalPaciente) * 100 : 0;
      
      const diaAtencion = Math.floor(1 + rng() * 27);
      const horaAtencion = `${String(Math.floor(8 + rng() * 9)).padStart(2, '0')}:${String(Math.floor(rng() * 60)).padStart(2, '0')}`;
      const fechaAtencion = `${year}-${String(safeMonth).padStart(2, '0')}-${String(diaAtencion).padStart(2, '0')}`;

      patients.push({
        id: `pac-${year}-${safeMonth}-${i + 1}`,
        nombre: nombreCompleto,
        primerNombre: nombre,
        primerApellido: ap1,
        segundoApellido: ap2,
        tipoDocumento: tipoDoc,
        documento: docNum.toString(),
        edad,
        genero: isFemale ? 'F' : 'M',
        generoTexto: isFemale ? 'Femenino' : 'Masculino',
        telefono: `+573${Math.floor(100000000 + rng() * 899999999)}`,
        email: `${nombre.toLowerCase()}.${ap1.toLowerCase()}@gmail.com`,
        cursoVida: prog,
        hito3280: milestone?.hito || 'Control Integral Res. 3280',
        cups: PRICING_CONSTANTS.CODIGO_CUPS,
        municipio: muni,
        zona: isRural ? 'Rural' : 'Urbana',
        codZona: isRural ? '02' : '01',
        tipoUsuario: '01', // Contributivo Cotizante / Régimen General
        fechaAtencion,
        horaAtencion,
        fechaHoraAtencion: `${fechaAtencion} ${horaAtencion}`,
        // Consumos
        contactado,
        segundosLlamada,
        llamadasCount,
        waUtilityCount,
        waMarketingCount,
        smsCount,
        emailCount,
        // Desglose financiero individual
        costoDesglose: {
          llamadas: Math.round(costoLlamadas),
          whatsapp: Math.round(costoWa),
          sms: Math.round(costoSms),
          email: Math.round(costoEmail),
          total: costoTotalPaciente
        },
        cobroDesglose: {
          llamadas: Math.round(cobroLlamadas),
          whatsapp: Math.round(cobroWa),
          sms: Math.round(cobroSms),
          email: Math.round(cobroEmail),
          total: cobroTotalPaciente
        },
        utilidad: utilidadPaciente,
        margenPct: parseFloat(margenPct.toFixed(1))
      });
    }

    // Totales agregados del mes
    const totalSegundos = patients.reduce((acc, p) => acc + p.segundosLlamada, 0);
    const totalLlamadas = patients.reduce((acc, p) => acc + p.llamadasCount, 0);
    const totalWa = patients.reduce((acc, p) => acc + p.waUtilityCount + p.waMarketingCount, 0);
    const totalSms = patients.reduce((acc, p) => acc + p.smsCount, 0);
    const totalEmail = patients.reduce((acc, p) => acc + p.emailCount, 0);
    
    const granTotalFacturado = patients.reduce((acc, p) => acc + p.cobroDesglose.total, 0);
    const granTotalCosto = patients.reduce((acc, p) => acc + p.costoDesglose.total, 0);
    const granTotalUtilidad = granTotalFacturado - granTotalCosto;
    const margenGlobalPct = granTotalFacturado > 0 ? ((granTotalUtilidad / granTotalFacturado) * 100).toFixed(1) : '0';

    return {
      year,
      month: safeMonth,
      mesNombre: mesObj.nombre,
      mesAbrev: mesObj.abrev,
      totales: {
        totalFacturado: granTotalFacturado,
        totalCosto: granTotalCosto,
        totalUtilidad: granTotalUtilidad,
        margenGlobalPct: parseFloat(margenGlobalPct),
        pacientesCount: patients.length,
        totalSegundos,
        totalLlamadas,
        totalWa,
        totalSms,
        totalEmail
      },
      desgloseCanales: {
        llamadas: {
          segundos: totalSegundos,
          llamadasCount: totalLlamadas,
          facturado: Math.round(totalSegundos * PRICING_CONSTANTS.PRICE_CALL_PER_SECOND),
          costo: Math.round(totalSegundos * PRICING_CONSTANTS.COST_CALL_PER_SECOND)
        },
        whatsapp: {
          mensajesCount: totalWa,
          facturado: patients.reduce((acc, p) => acc + p.cobroDesglose.whatsapp, 0),
          costo: patients.reduce((acc, p) => acc + p.costoDesglose.whatsapp, 0)
        },
        sms: {
          mensajesCount: totalSms,
          facturado: Math.round(totalSms * PRICING_CONSTANTS.PRICE_SMS),
          costo: Math.round(totalSms * PRICING_CONSTANTS.COST_SMS)
        },
        email: {
          correosCount: totalEmail,
          facturado: Math.round(totalEmail * PRICING_CONSTANTS.PRICE_EMAIL),
          costo: Math.round(totalEmail * PRICING_CONSTANTS.COST_EMAIL)
        }
      },
      pacientes: patients
    };
  },

  // ----------------------------------------------------------------------------
  // Construye el objeto oficial RIPS JSON de un usuario bajo Resolución 2275 de 2023
  // ----------------------------------------------------------------------------
  buildRipsUserObject(patient, hospitalInfo = {}) {
    const nitPrestador = hospitalInfo?.nit || '890102030';
    const codPrestadorHabilitado = hospitalInfo?.codHabilitacion || '170010012301';
    const numFactura = hospitalInfo?.numFactura || `FAC-${patient.fechaAtencion.replace(/-/g, '').slice(0, 6)}-SADI`;

    return {
      tipoDocumentoIdentificacion: patient.tipoDocumento || 'CC',
      numDocumentoIdentificacion: patient.documento,
      primerApellido: patient.primerApellido || 'GÓMEZ',
      segundoApellido: patient.segundoApellido || 'RODRÍGUEZ',
      primerNombre: patient.primerNombre || 'CARLOS',
      segundoNombre: '',
      tipoUsuario: patient.tipoUsuario || '01', // 01: Contributivo cotizante
      fechaNacimiento: `${2026 - patient.edad}-06-15`,
      codSexo: patient.genero || 'M',
      codPaisResidencia: '170', // Colombia
      codMunicipioResidencia: patient.municipio?.cod || '17001', // Manizales
      codZonaTerritorialResidencia: patient.codZona || '01', // 01: Urbana, 02: Rural
      incapacidad: 'NO',
      codPaisOrigen: '170',
      servicios: {
        consultas: [
          {
            codPrestador: codPrestadorHabilitado,
            fechaInicioAtencion: patient.fechaHoraAtencion,
            numAutorizacion: null,
            codConsulta: PRICING_CONSTANTS.CODIGO_CUPS, // 890201
            modalidadGrupoServicioTecSal: '02', // 02: Telemedicina / Teleorientación interactiva
            grupoServicios: '01', // 01: Consulta Externa
            codServicio: '328', // 328: Promoción y Mantenimiento de la Salud
            finalidadTecnologiaSalud: '01', // 01: Detección temprana - Promoción y prevención Res. 3280
            causaMotivoAtencion: '13', // 13: Enfermedad general / Promoción y prevención
            codDiagnosticoPrincipal: 'Z000', // Examen médico general de rutina / Control periódico
            codDiagnosticoRelacionado1: null,
            codDiagnosticoRelacionado2: null,
            codDiagnosticoRelacionado3: null,
            tipoDiagnosticoPrincipal: '01', // 01: Impresión diagnóstica
            tipoDocumentoIdentificacion: 'CC',
            numDocumentoIdentificacion: '75089123',
            vrServicio: patient.cobroDesglose?.total || 1500,
            conceptoRecaudo: '05', // 05: No aplica / Promoción y Detección temprana exento de cobro
            valorPagoModerador: 0,
            numFEVPagoModerador: null,
            numFEV: numFactura
          }
        ],
        procedimientos: [],
        urgencias: [],
        hospitalizacion: [],
        recienNacidos: [],
        medicamentos: [],
        otrosServicios: []
      }
    };
  },

  // ----------------------------------------------------------------------------
  // Genera el archivo completo RIPS JSON para todo el mes seleccionado
  // ----------------------------------------------------------------------------
  generateMonthlyRipsJSON(monthData, hospitalInfo = {}) {
    const nitPrestador = hospitalInfo?.nit || '890102030';
    const razonSocial = hospitalInfo?.nombre || 'HOSPITAL CENTRAL DEPARTAMENTAL SADI';
    const numFactura = `FAC-2026-M${String(monthData.month).padStart(2, '0')}-SADI`;

    const usuariosRips = monthData.pacientes.map(p => 
      this.buildRipsUserObject(p, { ...hospitalInfo, numFactura })
    );

    return {
      resolucion: 'Resolucion 2275 de 2023 - Ministerio de Salud y Proteccion Social de Colombia',
      tipoNorma: 'RIPS Unico en Formato JSON con soporte a Factura Electronica FEV',
      numDocumentoIdObligado: nitPrestador,
      razonSocialPrestador: razonSocial,
      numFactura: numFactura,
      tipoNota: null,
      numNota: null,
      periodo: {
        ano: monthData.year,
        mes: monthData.month,
        nombreMes: monthData.mesNombre
      },
      resumenLiquidacionSADI: {
        codigoCUPS: PRICING_CONSTANTS.CODIGO_CUPS,
        descripcionCUPS: PRICING_CONSTANTS.NOMBRE_CUPS,
        totalUsuariosReportados: usuariosRips.length,
        totalConsultasDemandaInducida: usuariosRips.length,
        valorTotalFacturadoHospitalCOP: monthData.totales.totalFacturado,
        costoOperativoRealSADICOP: monthData.totales.totalCosto,
        utilidadBrutaSADICOP: monthData.totales.totalUtilidad,
        totalSegundosVozIA: monthData.totales.totalSegundos,
        totalMensajesWhatsApp: monthData.totales.totalWa,
        totalMensajesSMS: monthData.totales.totalSms,
        totalEmails: monthData.totales.totalEmail
      },
      usuarios: usuariosRips
    };
  },

  // ----------------------------------------------------------------------------
  // Genera el RIPS JSON individual de UN solo paciente
  // ----------------------------------------------------------------------------
  generateIndividualPatientRipsJSON(patient, monthData, hospitalInfo = {}) {
    const nitPrestador = hospitalInfo?.nit || '890102030';
    const razonSocial = hospitalInfo?.nombre || 'HOSPITAL CENTRAL DEPARTAMENTAL SADI';
    const numFactura = `FAC-2026-M${String(monthData.month).padStart(2, '0')}-PAC-${patient.documento}`;

    const usuarioRips = this.buildRipsUserObject(patient, { ...hospitalInfo, numFactura });

    return {
      resolucion: 'Resolucion 2275 de 2023 - Ministerio de Salud y Proteccion Social de Colombia',
      tipoNorma: 'RIPS Individual de Atencion en Demanda Inducida (SADI)',
      numDocumentoIdObligado: nitPrestador,
      razonSocialPrestador: razonSocial,
      numFactura: numFactura,
      tipoNota: null,
      numNota: null,
      periodo: {
        ano: monthData.year,
        mes: monthData.month,
        nombreMes: monthData.mesNombre,
        fechaAtencion: patient.fechaAtencion
      },
      auditoriaCostosPaciente: {
        paciente: patient.nombre,
        documento: `${patient.tipoDocumento} ${patient.documento}`,
        cursoVida: patient.cursoVida?.nombre,
        hito3280: patient.hito3280,
        codigoCUPS: PRICING_CONSTANTS.CODIGO_CUPS,
        consumos: {
          segundosLlamadaIA: patient.segundosLlamada,
          llamadasCount: patient.llamadasCount,
          whatsAppUtilityCount: patient.waUtilityCount,
          whatsAppMarketingCount: patient.waMarketingCount,
          smsCount: patient.smsCount,
          emailCount: patient.emailCount
        },
        desgloseCostosRealesCOP: patient.costoDesglose,
        desgloseFacturadoHospitalCOP: patient.cobroDesglose,
        totalCostoRealPacienteCOP: patient.costoDesglose.total,
        totalFacturadoHospitalCOP: patient.cobroDesglose.total,
        utilidadNetaPacienteCOP: patient.utilidad,
        margenPct: patient.margenPct
      },
      usuarios: [usuarioRips]
    };
  },

  // ----------------------------------------------------------------------------
  // Descarga cualquier objeto de datos como archivo .json en el navegador
  // ----------------------------------------------------------------------------
  downloadJSON(filename, data) {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // ----------------------------------------------------------------------------
  // Exporta la liquidación mensual completa a un archivo Excel (.xlsx)
  // ----------------------------------------------------------------------------
  exportMonthlyExcel(monthData, hospitalInfo = {}) {
    const wb = XLSX.utils.book_new();

    // 1. Hoja Resumen
    const resumenRows = [
      ['SADI - LIQUIDACIÓN MENSUAL DE COSTOS Y FACTURACIÓN'],
      [`Periodo: ${monthData.mesNombre} ${monthData.year}`],
      [`Código CUPS Asistencial: ${PRICING_CONSTANTS.CODIGO_CUPS}`],
      [''],
      ['Indicador Global', 'Valor Consolidado'],
      ['Total Facturado al Hospital (COP)', monthData.totales.totalFacturado],
      ['Costo Operativo Real SADI (COP)', monthData.totales.totalCosto],
      ['Utilidad Bruta SADI (COP)', monthData.totales.totalUtilidad],
      ['Margen Operativo Bruto (%)', `${monthData.totales.margenGlobalPct}%`],
      ['Total Pacientes Atendidos', monthData.totales.pacientesCount],
      ['Total Segundos de Voz IA Vapi', monthData.totales.totalSegundos],
      ['Total Mensajes de WhatsApp', monthData.totales.totalWa],
      ['Total Mensajes SMS', monthData.totales.totalSms],
      ['Total Correos Electrónicos', monthData.totales.totalEmail]
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Mes');

    // 2. Hoja Pacientes Detalle
    const pacientesRows = monthData.pacientes.map((p, idx) => ({
      '#': idx + 1,
      'Paciente': p.nombre,
      'Tipo Doc': p.tipoDocumento,
      'Documento': p.documento,
      'Edad': p.edad,
      'Género': p.generoTexto,
      'Curso de Vida': p.cursoVida?.nombre,
      'Hito Res. 3280': p.hito3280,
      'Código CUPS': p.cups,
      'Municipio': p.municipio?.nombre,
      'Zona': p.zona,
      'Fecha Atención': p.fechaAtencion,
      'Segundos Llamada IA': p.segundosLlamada,
      'WhatsApp Recordatorios': p.waUtilityCount,
      'WhatsApp Campañas': p.waMarketingCount,
      'SMS Enviados': p.smsCount,
      'E-mails Enviados': p.emailCount,
      'Costo Operativo Real SADI (COP)': p.costoDesglose.total,
      'Total Facturado Hospital (COP)': p.cobroDesglose.total,
      'Ganancia Neta (COP)': p.utilidad,
      'Margen (%)': `${p.margenPct}%`
    }));
    const wsPacientes = XLSX.utils.json_to_sheet(pacientesRows);
    XLSX.utils.book_append_sheet(wb, wsPacientes, 'Detalle Pacientes');

    XLSX.writeFile(wb, `SADI_Facturacion_${monthData.year}_M${String(monthData.month).padStart(2, '0')}_${monthData.mesNombre}.xlsx`);
  }
};
