// ==============================================================================
// VAPI INTEGRATION SERVICE - SADI CARE ENGINE
// Conexión y alimentación automática del Agente de Voz IA (Vapi)
// con datos clínicos en tiempo real, alertas de la Res. 3280 y documentos de historias clínicas
// ==============================================================================
import { supabase } from '@/lib/supabase';
import { telemonitoringService } from './telemonitoringService';
import { clinicalRecordsService, sanitizePatientFolder } from './clinicalRecordsService';
import { getRequiredRIASAppointments, getCursoVida3280 } from './rias3280Engine';
import {
  isMinorCursoVidaABC,
  getTimeOfDayGreeting,
  buildMinorAcudienteOpening,
} from './cursoVidaConfig';
import {
  buildVapiVoicemailDetectionConfig,
  DEFAULT_ANTI_VOICEMAIL_CONFIG,
  isVoicemailOutcome,
} from './antiVoicemailConfig';

export const OPENVOX_INDIVIDUAL_PORT_CONFIG = {
  port: 1,
  label: 'Puerto 1',
  callerNumber: '+573106783338',
  vapiPhoneNumberId: '3e836f48-6110-410d-a340-fd625598b324',
  trunkName: 'Issabel PBX - NetGroup OpenVox',
};

function readStoredAntiVoicemailConfig() {
  try {
    const raw = localStorage.getItem('sadi_ivr_config');
    return raw ? { ...DEFAULT_ANTI_VOICEMAIL_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_ANTI_VOICEMAIL_CONFIG };
  } catch {
    return { ...DEFAULT_ANTI_VOICEMAIL_CONFIG };
  }
}

export function formatLast3DigitsInWords(doc) {
  const digits = String(doc || '').replace(/\D/g, '').slice(-3);
  if (digits.length < 3) return digits;

  const unidades = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const d1 = unidades[parseInt(digits[0], 10)] || digits[0];
  const dosUltimos = parseInt(digits.slice(1), 10);

  const numeros = {
    0: 'cero cero', 1: 'cero uno', 2: 'cero dos', 3: 'cero tres', 4: 'cero cuatro', 5: 'cero cinco',
    6: 'cero seis', 7: 'cero siete', 8: 'cero ocho', 9: 'cero nueve', 10: 'diez', 11: 'once',
    12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince', 16: 'dieciséis', 17: 'diecisiete',
    18: 'dieciocho', 19: 'diecinueve', 20: 'veinte', 21: 'veintiuno', 22: 'veintidós', 23: 'veintitrés',
    24: 'veinticuatro', 25: 'veinticinco', 26: 'veintiséis', 27: 'veintisiete', 28: 'veintiocho', 29: 'veintinueve',
    30: 'treinta', 31: 'treinta y uno', 32: 'treinta y dos', 33: 'treinta y tres', 34: 'treinta y cuatro',
    35: 'treinta y cinco', 36: 'treinta y seis', 37: 'treinta y siete', 38: 'treinta y ocho', 39: 'treinta y nueve',
    40: 'cuarenta', 41: 'cuarenta y uno', 42: 'cuarenta y dos', 43: 'cuarenta y tres', 44: 'cuarenta y cuatro',
    45: 'cuarenta y cinco', 46: 'cuarenta y seis', 47: 'cuarenta y siete', 48: 'cuarenta y ocho', 49: 'cuarenta y nueve',
    50: 'cincuenta', 51: 'cincuenta y uno', 52: 'cincuenta y dos', 53: 'cincuenta y tres', 54: 'cincuenta y cuatro',
    55: 'cincuenta y cinco', 56: 'cincuenta y seis', 57: 'cincuenta y siete', 58: 'cincuenta y ocho', 59: 'cincuenta y nueve',
    60: 'sesenta', 61: 'sesenta y uno', 62: 'sesenta y dos', 63: 'sesenta y tres', 64: 'sesenta y cuatro',
    65: 'sesenta y cinco', 66: 'sesenta y seis', 67: 'sesenta y siete', 68: 'sesenta y ocho', 69: 'sesenta y nueve',
    70: 'setenta', 71: 'setenta y uno', 72: 'setenta y dos', 73: 'setenta y tres', 74: 'setenta y cuatro',
    75: 'setenta y cinco', 76: 'setenta y seis', 77: 'setenta y siete', 78: 'setenta y ocho', 79: 'setenta y nueve',
    80: 'ochenta', 81: 'ochenta y uno', 82: 'ochenta y dos', 83: 'ochenta y tres', 84: 'ochenta y cuatro',
    85: 'ochenta y cinco', 86: 'ochenta y seis', 87: 'ochenta y siete', 88: 'ochenta y ocho', 89: 'ochenta y nueve',
    90: 'noventa', 91: 'noventa y uno', 92: 'noventa y dos', 93: 'noventa y tres', 94: 'noventa y cuatro',
    95: 'noventa y cinco', 96: 'noventa y seis', 97: 'noventa y siete', 98: 'noventa y ocho', 99: 'noventa y nueve'
  };

  const d2 = numeros[dosUltimos] || String(dosUltimos);
  return `${d1} ${d2}`;
}

export const vapiIntegrationService = {
  /**
   * Construye el contexto clínico en tiempo real de un paciente para alimentar a Vapi.
   * Se alimenta de:
   * 1. Datos demográficos y Curso de Vida Res. 3280.
   * 2. Mediciones caseras más recientes (tensión, glucosa, SpO2) y PAM.
   * 3. Alertas clínicas activas (Código Azul, crisis hipertensiva, etc.).
   * 4. Expediente de Historias Clínicas (documentos en HISTORIAS_CLÍNICAS/).
   * 5. Procedimientos y tamizajes pendientes según la Res. 3280.
   */
  async buildPatientVapiContext(patientId) {
    const patient = await telemonitoringService.getPatientById(patientId);
    if (!patient) return null;

    const curso = getCursoVida3280(patient.fecha_nacimiento);
    const measurements = await telemonitoringService.getMeasurements(patient.id);
    const alerts = await telemonitoringService.getAlerts(patient.id);
    const docs = await clinicalRecordsService.getDocuments(patient.id);
    const appointments3280 = getRequiredRIASAppointments(
      patient.fecha_nacimiento,
      patient.sexo,
      patient.es_gestante,
      patient.semana_gestacional
    );

    const latestMeas = measurements[0] || null;
    const activeAlert = alerts[0] || null;

    // Resumen de documentos en carpetas
    const docsSummary = docs.map(d => `- [${d.carpeta_clasificada}] ${d.nombre_archivo}: ${d.descripcion_clinica} (Subido por: ${d.subido_por_nombre})`).join('\n') || 'Sin documentos previos en el expediente.';

    // Resumen de atenciones 3280
    const atencionesSummary = appointments3280.map(a => `- ${a.nombre} (${a.frecuencia}) - ${a.accion}`).join('\n') || 'Valoración integral anual.';

    return {
      patient,
      curso,
      latestMeas,
      activeAlert,
      docsCount: docs.length,
      docsSummary,
      atencionesSummary,
      patientFolder: `HISTORIAS_CLÍNICAS/${sanitizePatientFolder(patient.nombre)}/`
    };
  },

  /**
   * Genera el System Prompt dinámico para Vapi.
   * Si cualquier dato cambia en la BD o en las mediciones caseras, este prompt
   * se actualiza instantáneamente con las variables exactas.
   */
  generateVapiDynamicPrompt(vapiContext) {
    if (!vapiContext) return '';

    const { patient, curso, latestMeas, activeAlert, docsSummary, atencionesSummary, patientFolder } = vapiContext;

    let vitalSignsText = 'No hay mediciones domiciliarias recientes.';
    if (latestMeas) {
      if (latestMeas.tipo_medicion === 'presion_arterial') {
        vitalSignsText = `Última Tensión Arterial: ${latestMeas.presion_sistolica}/${latestMeas.presion_diastolica} mmHg (PAM: ${latestMeas.pam_calculada} mmHg). Tomada con: ${latestMeas.dispositivo_modelo}.`;
      } else if (latestMeas.tipo_medicion === 'glucometria') {
        vitalSignsText = `Última Glucometría: ${latestMeas.glucosa_mgdl} mg/dL (${latestMeas.momento_glucometria}). Tomada con: ${latestMeas.dispositivo_modelo}.`;
      }
    }

    let alertDirective = 'El paciente se encuentra actualmente con signos dentro de metas terapéuticas.';
    if (activeAlert) {
      alertDirective = `ALERTA CLÍNICA CRÍTICA ACTIVA (${activeAlert.severidad.toUpperCase()}):
- Diagnóstico de Alerta: ${activeAlert.titulo}
- Detalle: ${activeAlert.descripcion}
- Fundamento: ${activeAlert.criterio_res_3280}
- INSTRUCCIÓN PRIORITARIA DE VOZ: Pregunta de inmediato por síntomas de alarma (dolor de cabeza pulsátil, lucecitas, zumbidos, mareo, dolor epigástrico en barra si es gestante; o temblor/palidez si es hipoglucemia). No alarmes innecesariamente pero mantén firme la instrucción médica de reposo o ingesta de glucosa según corresponda.`;
    }

    const isMinorABC = isMinorCursoVidaABC({
      ...patient,
      curso_vida_key: curso?.key,
      curso_vida: patient.curso_vida || curso?.label,
    });
    const tiempoSaludo = getTimeOfDayGreeting();
    const minorOpening = isMinorABC ? buildMinorAcudienteOpening(patient) : null;
    const saludoProtocolo = isMinorABC
      ? `"${minorOpening} Te habla Camila, tu asistente de salud del ${patient.hospital_name || 'Hospital Central SADI'} en convenio con tu EPS ${patient.eps}."\n   - REGLA OBLIGATORIA CURSOS DE VIDA A, B y C: SIEMPRE debes comenzar la llamada exactamente con la frase: "${minorOpening}" (usando 'Buenos Días', 'Buenas Tardes' o 'Buena Noche' según la hora actual) y dirigir la conversación a la persona o acudiente responsable del menor.`
      : `"Hola! ${tiempoSaludo}, ${patient.nombre.split(' ')[0]}, te habla Camila, tu asistente de salud del ${patient.hospital_name || 'Hospital Central SADI'} en convenio con tu EPS ${patient.eps}."`;

    return `Eres la Asistente Médica de Voz de SADI (Sistema de Apoyo para Demanda Inducida) y de la IPS asignada. Tu objetivo es brindar acompañamiento telefónico humanizado, cálido, empático y clínicamente riguroso basado en la Resolución 3280 de 2018 de Colombia.

=== DATOS EN TIEMPO REAL DEL PACIENTE ===
- Nombre Completo: ${patient.nombre}
- Documento de Identidad: ${patient.tipo_documento} ${patient.documento}
- Teléfono: ${patient.telefono}
- EPS y Régimen: ${patient.eps} (${patient.regimen})
- Curso de Vida Res. 3280: ${curso.label}
- Edad: ${curso.edad}
- Condición Especial: ${patient.es_gestante ? `GESTANTE EN SEMANA ${patient.semana_gestacional} (Ruta Materno Perinatal)` : (patient.es_diabetico || patient.es_hipertenso ? 'Paciente Crónico Cardiovascular / Metabólico' : 'Atención Preventiva General')}
- Médico Tratante Asignado: ${patient.doctor_nombre || 'Especialista SADI'}
- Directorio de Historias Clínicas: ${patientFolder}

=== TELEMONITOREO DOMICILIARIO Y SIGNOS VITALES ===
${vitalSignsText}

=== ESTADO DE ALERTA CLÍNICA ACTUAL ===
${alertDirective}

=== EXPEDIENTE CLÍNICO EN ARCHIVO (HISTORIAS CLÍNICAS) ===
${docsSummary}

=== ATENCIONES Y TAMIZAJES PENDIENTES (RESOLUCIÓN 3280) ===
${atencionesSummary}

=== PROTOCOLO IVR Y DIRECTRICES DE CONVERSACIÓN TELEFÓNICA (VAPI) ===
1. DETECCIÓN DUAL DE BUZÓN DE VOZ (PRE-ANSWER SIP 183 + VAPI AMD NATIVO):
   - Capa 1 (Gateway OpenVox / Asterisk SIP 183): Corta con SIP CANCEL antes del 200 OK si detecta locución o tono de buzón en Early Media ($0 COP de carrier).
   - Capa 2 (Motor nativo Vapi voicemailDetection): Activo en el payload de llamada con corte silencioso inmediato (voicemailMessage vacío); evita interactuar si responde un contestador automático.

2. SALUDO E IDENTIFICACIÓN INSTITUCIONAL:
   ${saludoProtocolo}

3. CONFIRMACIÓN Y NAVEGACIÓN POR TECLADO NUMÉRICO (DTMF):
   Para todas las decisiones y confirmaciones clave, solicita SIEMPRE pulsar teclas del teléfono para garantizar 100% de precisión y evitar malinterpretaciones por ruido:
   - "Te contactamos para tu cita prioritaria de la Ruta de Promoción y Mantenimiento de la Salud (Resolución 3280 de 2018)."
   - "Por favor marca 1 en tu teclado telefónico si confirmas tu asistencia, o marca 2 si necesitas reagendar para otra fecha."
   - Acepta tanto el dígito presionado (DTMF '1' o '2') como si el paciente te lo dice verbalmente ("uno" o "dos", "sí confirmo").

4. CAPTURA POR VOZ EXCLUSIVA (DIRECCIÓN Y SÍNTOMAS):
   Únicamente solicita respuesta hablada cuando se trate de información abierta:
   - "Para validar tu visita domiciliaria o entrega de medicamentos: ¿sigues residiendo en tu dirección registrada? Si cambió, dímela claramente después de mi señal."
   - Si el paciente reporta dolor de cabeza pulsátil, mareo, visión borrosa o dolor torácico, activa inmediatamente la herramienta 'reportPatientSymptom' y activa el código de prioridad clínica sin colgar.

5. TONO Y EMPATÍA:
   Voz pausada, cálida, colombiana profesional y humanizada. Respeta los silencios y no interrumpas si el paciente está marcando en su teclado.`;
  },

  /**
   * Genera el payload de configuración completa para el Asistente de Vapi
   * incluyendo detección nativa de buzón de voz (`voicemailDetection`) y webhook real.
   */
  generateVapiAssistantConfig(vapiContext, customAntiVoicemailCfg = null) {
    if (!vapiContext) return null;

    const dynamicPrompt = this.generateVapiDynamicPrompt(vapiContext);
    const { patient, curso, activeAlert } = vapiContext;
    const isMinorABC = isMinorCursoVidaABC({
      ...patient,
      curso_vida_key: curso?.key,
      curso_vida: patient.curso_vida || curso?.label,
    });
    const tiempoSaludo = getTimeOfDayGreeting();
    const minorOpening = isMinorABC ? buildMinorAcudienteOpening(patient) : null;
    const antiVoicemailCfg = customAntiVoicemailCfg || readStoredAntiVoicemailConfig();
    const { voicemailDetection, voicemailMessage } = buildVapiVoicemailDetectionConfig(antiVoicemailCfg);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const webhookUrl = supabaseUrl
      ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/vapi-webhook`
      : 'https://tu-proyecto.supabase.co/functions/v1/vapi-webhook';

    return {
      name: `SADI-3280-${patient.nombre.replace(/\s+/g, '-')}`,
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'es-419'
      },
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: dynamicPrompt
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'getPatientClinicalContext',
              description: 'Consulta en tiempo real la historia clínica, últimos signos vitales y alertas 3280 del paciente.',
              parameters: {
                type: 'object',
                properties: {
                  documento: {
                    type: 'string',
                    description: 'Número de documento de identidad del paciente'
                  }
                },
                required: ['documento']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'reportPatientSymptom',
              description: 'Registra un síntoma de alarma manifestado por el paciente durante la llamada (cefalea, fosfenos, tinitus, mareo, dolor torácico, sangrado).',
              parameters: {
                type: 'object',
                properties: {
                  sintoma: {
                    type: 'string',
                    description: 'Nombre del síntoma reportado por el paciente'
                  },
                  severidad: {
                    type: 'string',
                    enum: ['leve', 'moderada', 'severa_emergencia'],
                    description: 'Grado de severidad percibido'
                  },
                  detalles: {
                    type: 'string',
                    description: 'Comentarios adicionales del paciente'
                  }
                },
                required: ['sintoma', 'severidad']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'schedule3280Appointment',
              description: 'Agenda o confirma la fecha para el tamizaje o consulta médica de la Resolución 3280 requerida por el paciente.',
              parameters: {
                type: 'object',
                properties: {
                  programa_nombre: {
                    type: 'string',
                    description: 'Nombre del programa o tamizaje a agendar'
                  },
                  fecha_preferida: {
                    type: 'string',
                    description: 'Fecha sugerida (YYYY-MM-DD)'
                  },
                  jornada: {
                    type: 'string',
                    enum: ['manana', 'tarde']
                  }
                },
                required: ['programa_nombre']
              }
            }
          }
        ]
      },
      voice: {
        provider: '11labs',
        voiceId: 'pFZP5JQG7iQjIQuC4Bku', // Voz médica en español latino
        stability: 0.5,
        similarityBoost: 0.8
      },
      voicemailDetection,
      voicemailMessage,
      silenceTimeoutSeconds: 18,
      firstMessage: isMinorABC
        ? `${minorOpening} Te habla Camila del ${patient.hospital_name || 'Hospital Central SADI'}. ${activeAlert ? 'Me comunico de urgencia por la medición alterada registrada en su equipo domiciliario.' : 'Nos comunicamos para coordinar la cita preventiva de la Resolución 3280. Por favor marca 1 en tu teléfono si confirmas la asistencia, o marca 2 si deseas reagendar.'}`
        : `Hola ${patient.nombre.split(' ')[0]}, te habla Camila del ${patient.hospital_name || 'Hospital Central SADI'}. ${activeAlert ? 'Te contacto de urgencia por la medición alterada que registraste en tu equipo domiciliario.' : 'Te llamamos para coordinar tu cita preventiva de la Resolución 3280. Por favor marca 1 en tu teléfono si confirmas tu asistencia, o marca 2 si deseas reagendar.'}`,
      server: {
        url: webhookUrl
      },
      serverMessages: ['status-update', 'transcript', 'end-of-call-report'],
      variableValues: {
        patient_id: patient.id,
        patient_name: patient.nombre,
        documento: patient.documento,
        curso_vida: patient.curso_vida || curso?.label || '',
        es_menor_abc: isMinorABC ? 'true' : 'false',
        saludo_hora: tiempoSaludo,
        saludo_inicial: minorOpening || `Hola! ${tiempoSaludo}, me comunico con ${patient.nombre}.`,
        es_gestante: patient.es_gestante ? 'true' : 'false',
        semana_gestacional: patient.semana_gestacional || 0,
        doctor_asignado: patient.doctor_nombre || 'Especialista SADI',
        anti_voicemail: antiVoicemailCfg.antiVoicemail ? 'true' : 'false',
        early_media_pre_answer: antiVoicemailCfg.earlyMediaPreAnswer ? 'true' : 'false'
      }
    };
  },

  /**
   * Simulador del Webhook de Vapi y Detector SIP 183 Pre-Answer
   * Permite probar localmente respuestas de herramientas y cortes anti-buzón sin costo.
   */
  async simulateVapiWebhookCall(toolName, args, patientId) {
    const context = await this.buildPatientVapiContext(patientId);

    if (toolName === 'getPatientClinicalContext') {
      return {
        status: 'success',
        data: {
          paciente: context.patient.nombre,
          documento: context.patient.documento,
          ultimos_signos: context.latestMeas,
          alerta_activa: context.activeAlert ? context.activeAlert.titulo : 'Ninguna alerta crítica',
          atenciones_pendientes: context.atencionesSummary
        }
      };
    }

    if (toolName === 'reportPatientSymptom') {
      return {
        status: 'success',
        action_taken: 'Alerta de triaje registrada en SADI',
        mensaje: `Síntoma "${args.sintoma}" (${args.severidad}) guardado en el expediente de ${context.patient.nombre}. Se notificó a enfermería y al ${context.patient.doctor_nombre}.`
      };
    }

    if (toolName === 'schedule3280Appointment') {
      return {
        status: 'success',
        action_taken: 'Cita programada en agenda',
        mensaje: `Cita para "${args.programa_nombre}" reservada para ${context.patient.nombre} en jornada ${args.jornada || 'mañana'}. Se envió confirmación por WhatsApp.`
      };
    }

    if (toolName === 'simulatePreAnswerSip183Cancel') {
      const samplePhrase = args?.transcript || 'Claro te informa: su llamada está siendo transferida al correo de voz';
      const verdict = isVoicemailOutcome({
        endedReason: 'sip-183-voicemail-cancel',
        transcript: samplePhrase
      });
      return {
        status: 'cancelled_before_200_ok',
        phase: 'pre_answer_sip_183',
        sipCode: 183,
        carrierBilled: false,
        facturableIps: false,
        costoCop: 0,
        detectedVoicemail: verdict.isVoicemail,
        reason: verdict.reason,
        nextAction: 'Reasignado a siguiente tanda del día ($0 COP)'
      };
    }

    if (toolName === 'simulateVapiVoicemailReport') {
      const endedReason = args?.endedReason || 'voicemail-reached';
      const transcript = args?.transcript || 'Deje su mensaje después del tono.';
      const verdict = isVoicemailOutcome({ endedReason, transcript });
      return {
        status: verdict.isVoicemail ? 'buzon_cortado' : 'completada',
        capaDeteccion: 'vapi_amd_post_answer',
        voicemailDetected: verdict.isVoicemail,
        reason: verdict.reason,
        duracionFacturadaSeg: verdict.isVoicemail ? 0 : 75,
        facturableIps: !verdict.isVoicemail,
        costoCop: verdict.isVoicemail ? 0 : 900,
        nextAction: verdict.isVoicemail ? 'Corte silencioso inmediato + reintento en siguiente tanda' : 'Atención facturable CUPS 890201'
      };
    }

    return { status: 'unknown_tool', tool: toolName };
  },

  /**
   * Dispara una llamada saliente real con Protección Dual Anti-Buzón:
   * 1) Invoca la Edge Function segura `vapi-outbound-call` (que soporta puente Asterisk ARI SIP 183 y Vapi AMD nativo).
   * 2) Solo usa fallback directo en Vite si se configuró una clave explícita en variables de entorno de desarrollo.
   */
  async triggerLiveCall(phoneNumber, patientData = {}, customAntiVoicemailCfg = null) {
    const antiVoicemailCfg = customAntiVoicemailCfg || readStoredAntiVoicemailConfig();
    const { voicemailDetection, voicemailMessage } = buildVapiVoicemailDetectionConfig(antiVoicemailCfg);

    let formattedPhone = String(phoneNumber || '').trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.startsWith('57') ? `+${formattedPhone}` : `+57${formattedPhone}`;
    }

    const tiempoSaludo = getTimeOfDayGreeting();
    const nombreCompleto = String(patientData.nombre || patientData.name || 'Paciente').trim() || 'Paciente';
    const isMinorABC = isMinorCursoVidaABC(patientData);
    const minorOpening = isMinorABC ? buildMinorAcudienteOpening(nombreCompleto) : null;
    const hospitalNombre = patientData.hospital_nombre || patientData.hospitalName || 'Hospital Central SADI';
    const programaVoz = (patientData.programa3280 || patientData.programa || patientData.program || 'Valoración Preventiva').replace(/3280|Resolución 3280/gi, 'resolución treintaidos ochenta, del dos mil dieciocho');

    const variableValues = {
      name: nombreCompleto.split(' ')[0],
      nombre_completo: nombreCompleto,
      documento: String(patientData.documento || patientData.document || patientData.cedula || '1006010518'),
      cedula_ultimos_3: formatLast3DigitsInWords(patientData.documento || patientData.document || patientData.cedula || '518'),
      programa_3280: programaVoz,
      hospital_nombre: hospitalNombre,
      direccion: patientData.direccion || patientData.address || 'Calle 15 #14-112',
      curso_vida: patientData.cursoVida || patientData.curso_vida || '',
      es_menor_abc: isMinorABC ? 'true' : 'false',
      saludo_hora: tiempoSaludo,
      saludo_inicial: minorOpening || `Hola! ${tiempoSaludo}, me comunico con ${nombreCompleto}.`,
      anti_voicemail: antiVoicemailCfg.antiVoicemail ? 'true' : 'false'
    };

    const minorFirstMessageOverride = isMinorABC
      ? {
          firstMessage: `${minorOpening} Le habla el asistente clínico del ${hospitalNombre} para coordinar la atención preventiva de ${nombreCompleto} bajo la ${programaVoz}. Por favor marque 1 si confirma la asistencia o 2 si desea reagendar.`
        }
      : {};

    const targetPhoneNumberId =
      patientData.phoneNumberId ||
      import.meta.env.VITE_VAPI_PHONE_NUMBER_ID ||
      OPENVOX_INDIVIDUAL_PORT_CONFIG.vapiPhoneNumberId;

    // Camino principal seguro: Edge Function `vapi-outbound-call` (Puerto 1 vía Vapi + Issabel PBX con Vapi AMD activo)
    try {
      const { data, error } = await supabase.functions.invoke('vapi-outbound-call', {
        body: {
          phoneNumber: formattedPhone,
          phoneNumberId: targetPhoneNumberId,
          gsmPort: patientData.gsmPort || OPENVOX_INDIVIDUAL_PORT_CONFIG.port,
          callerNumber: patientData.callerNumber || OPENVOX_INDIVIDUAL_PORT_CONFIG.callerNumber,
          routeMode: patientData.routeMode || (antiVoicemailCfg.earlyMediaPreAnswer ? 'auto' : 'vapi_issabel_port1'),
          patientId: patientData.patientId || patientData.id || null,
          hospitalId: patientData.hospitalId || patientData.hospital_id || null,
          doctorId: patientData.doctorId || patientData.doctor_id || null,
          slotTanda: patientData.slotTanda || patientData.slotId || null,
          motivoLlamada: patientData.motivoLlamada || patientData.programa3280 || 'Demanda Inducida Res. 3280',
          patientData: {
            ...patientData,
            nombre: nombreCompleto,
            es_menor_abc: isMinorABC,
            saludo_hora: tiempoSaludo,
            gsm_port: patientData.gsmPort || OPENVOX_INDIVIDUAL_PORT_CONFIG.port,
            caller_number: patientData.callerNumber || OPENVOX_INDIVIDUAL_PORT_CONFIG.callerNumber,
          },
          antiVoicemailConfig: antiVoicemailCfg,
          assistantOverrides: {
            ...minorFirstMessageOverride,
            voicemailDetection,
            voicemailMessage,
            silenceTimeoutSeconds: 18,
            variableValues
          }
        }
      });

      if (!error && data) {
        return {
          ok: Boolean(data.ok ?? true),
          status: data.status || 200,
          mode: data.mode || 'vapi_edge_function',
          voicemailProtection: data.voicemailProtection || { postAnswerVapi: voicemailDetection },
          data: data.data || data
        };
      }
    } catch (edgeErr) {
      console.warn('Edge Function vapi-outbound-call no disponible aún, verificando env local:', edgeErr?.message);
    }

    // Fallback exclusivo para entorno de desarrollo si se definió una variable de entorno local explícita
    const devApiKey = import.meta.env.VITE_VAPI_PRIVATE_KEY || import.meta.env.VITE_VAPI_API_KEY;
    const defaultPhoneId = targetPhoneNumberId || OPENVOX_INDIVIDUAL_PORT_CONFIG.vapiPhoneNumberId;
    const defaultAssistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;

    if (!devApiKey || !defaultPhoneId || !defaultAssistantId) {
      return {
        ok: false,
        status: 503,
        data: {
          message: 'Despliega la Edge Function `vapi-outbound-call` con tus secretos VAPI/ASTERISK para emitir llamadas reales con corte anti-buzón sin exponer llaves en el navegador.'
        }
      };
    }

    const payload = {
      assistantId: defaultAssistantId,
      phoneNumberId: defaultPhoneId,
      customer: {
        number: formattedPhone,
        name: patientData.nombre || patientData.name || 'Paciente SADI'
      },
      assistantOverrides: {
        ...minorFirstMessageOverride,
        voicemailDetection,
        voicemailMessage,
        silenceTimeoutSeconds: 18,
        variableValues
      }
    };

    const res = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      mode: 'direct_dev_with_amd',
      voicemailProtection: { postAnswerVapi: voicemailDetection },
      data
    };
  },

  /**
   * Alias unificado usado desde CampaignsPage.jsx para despachar llamadas individuales de campaña
   * heredando la misma protección anti-buzón dual.
   */
  async makeOutboundCall(options = {}) {
    const phone = options.patientPhone || options.phoneNumber || options.telefono;
    return this.triggerLiveCall(
      phone,
      {
        nombre: options.patientName || options.nombre,
        documento: options.patientDoc || options.documento,
        patientId: options.patientId || null,
        hospitalId: options.hospitalId || null,
        doctorId: options.doctorId || null,
        motivoLlamada: options.motivoLlamada,
        programa3280: options.accion3280 || options.hitoClinico || options.motivoLlamada,
        cursoVida: options.cursoVida || options.curso_vida,
        curso_vida: options.curso_vida || options.cursoVida,
        cursoVidaId: options.cursoVidaId || options.curso_vida_key,
        birthdate: options.birthdate || options.fecha_nacimiento || null,
        edad: options.edad ?? null,
        direccion: options.direccion
      },
      options.antiVoicemailConfig || null
    );
  }
};
