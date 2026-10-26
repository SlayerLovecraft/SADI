// ==============================================================================
// VAPI INTEGRATION SERVICE - SADI CARE ENGINE
// Conexión y alimentación automática del Agente de Voz IA (Vapi)
// con datos clínicos en tiempo real, alertas de la Res. 3280 y documentos de historias clínicas
// ==============================================================================
import { telemonitoringService } from './telemonitoringService';
import { clinicalRecordsService, sanitizePatientFolder } from './clinicalRecordsService';
import { getRequiredRIASAppointments, getCursoVida3280 } from './rias3280Engine';

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

=== DIRECTRICES DE CONVERSACIÓN DE VOZ (VAPI) ===
1. Saluda llamando al paciente por su nombre de pila ("Hola ${patient.nombre.split(' ')[0]}...").
2. Identifícate claramente: "Te habla Camila, tu asistente médica de SADI y de tu IPS".
3. Comunícale con claridad el motivo de la llamada: ${activeAlert ? 'hacer seguimiento inmediato a su medición registrada en su equipo casero' : 'coordinar sus atenciones y tamizajes de salud preventiva'}.
4. Si el paciente confirma síntomas de alarma, activa la herramienta 'reportPatientSymptom' y dale las indicaciones de Código de Emergencia sin colgar.
5. Escucha activamente sin interrumpir; habla con tono profesional, tranquilizador y pausado.
6. Si el paciente pregunta por sus exámenes, tienes acceso a los informes de su expediente clínico citado arriba.`;
  },

  /**
   * Genera el payload de configuración completa para el Asistente de Vapi
   * listo para ser enviado a la API de Vapi (POST https://api.vapi.ai/assistant)
   * o pegado en el panel de control de Vapi.
   */
  generateVapiAssistantConfig(vapiContext) {
    if (!vapiContext) return null;

    const dynamicPrompt = this.generateVapiDynamicPrompt(vapiContext);
    const { patient, activeAlert } = vapiContext;

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
      firstMessage: `Hola ${patient.nombre.split(' ')[0]}, te habla Camila de tu IPS y el programa SADI. ${activeAlert ? 'Te contacto por la medición que registraste hace unos momentos en tu equipo casero.' : 'Te contacto para coordinar tus chequeos preventivos de la Resolución 3280.'} ¿Cómo te encuentras en este momento?`,
      serverUrl: 'https://api.sadi.med.co/api/vapi/webhook',
      variableValues: {
        patient_id: patient.id,
        patient_name: patient.nombre,
        documento: patient.documento,
        curso_vida: patient.curso_vida,
        es_gestante: patient.es_gestante ? 'true' : 'false',
        semana_gestacional: patient.semana_gestacional || 0,
        doctor_asignado: patient.doctor_nombre || 'Especialista SADI'
      }
    };
  },

  /**
   * Simulador del Webhook de Vapi
   * Permite probar localmente cómo respondería nuestro servidor SADI
   * cuando el agente de Vapi hace un tool-call en vivo.
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

    return { status: 'unknown_tool', tool: toolName };
  }
};
