// ==============================================================================
// SADI 3280 CARE ENGINE - MOTOR CLÍNICO DE RESOLUCIÓN 3280 DE 2018 (COLOMBIA)
// Módulo de Clasificación de Curso de Vida, Telemonitoreo, Umbrales y Agente IA
// ==============================================================================

/**
 * Determina el Curso de Vida según la edad en años o meses (Resolución 3280 de 2018)
 * - Primera Infancia: 0 a 5 años (0 a 71 meses)
 * - Infancia: 6 a 11 años (72 a 143 meses)
 * - Adolescencia: 12 a 17 años (144 a 215 meses)
 * - Juventud: 18 a 28 años (18 a 28 años)
 * - Adultez: 29 a 59 años (29 a 59 años)
 * - Vejez: 60 años o más
 */
export const getCursoVida3280 = (fechaNacimiento) => {
  if (!fechaNacimiento) return { id: 'adultez', label: 'Adultez (29 - 59 años)', color: 'blue' };
  
  const birth = new Date(fechaNacimiento);
  const now = new Date();
  
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
    years--;
  }

  const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

  if (totalMonths <= 71) {
    return { id: 'primera_infancia', label: 'Primera Infancia (0 - 5 años)', edad: `${years} años (${totalMonths} m)`, color: 'emerald' };
  } else if (totalMonths <= 143) {
    return { id: 'infancia', label: 'Infancia (6 - 11 años)', edad: `${years} años`, color: 'teal' };
  } else if (totalMonths <= 215) {
    return { id: 'adolescencia', label: 'Adolescencia (12 - 17 años)', edad: `${years} años`, color: 'indigo' };
  } else if (years <= 28) {
    return { id: 'juventud', label: 'Juventud (18 - 28 años)', edad: `${years} años`, color: 'cyan' };
  } else if (years <= 59) {
    return { id: 'adultez', label: 'Adultez (29 - 59 años)', edad: `${years} años`, color: 'blue' };
  } else {
    return { id: 'vejez', label: 'Vejez (60+ años)', edad: `${years} años`, color: 'purple' };
  }
};

/**
 * Evalúa los valores ingresados por equipos caseros de medición y determina
 * si se violan los umbrales clínicos de la Resolución 3280 de 2018.
 */
export const evaluateVitalSigns3280 = ({
  presion_sistolica,
  presion_diastolica,
  glucometria,
  momento_glucometria = 'ayunas',
  spo2,
  ritmo_cardiaco,
  es_gestante = false,
  semana_gestacional = null,
  es_hipertenso = false,
  es_diabetico = false
}) => {
  const alerts = [];
  const sistolica = Number(presion_sistolica) || null;
  const diastolica = Number(presion_diastolica) || null;
  const glucosa = Number(glucometria) || null;
  const o2 = Number(spo2) || null;
  const fc = Number(ritmo_cardiaco) || null;

  // Cálculo de Presión Arterial Media: PAM = (2*PAD + PAS)/3
  let pam = null;
  if (sistolica && diastolica) {
    pam = Math.round(((2 * diastolica) + sistolica) / 3 * 10) / 10;
  }

  // 1. EVALUACIÓN DE TENSIOMETRÍA CASERA
  if (sistolica && diastolica) {
    // Caso especial GESTANTE (Resolución 3280 - RIAMP, Pág. 293 / Código Azul Obstétrico)
    if (es_gestante) {
      if (sistolica >= 160 || diastolica >= 110) {
        alerts.push({
          tipo: 'preeclampsia_severa_crisis',
          severidad: 'critica_roja',
          parametro: 'Tensión Arterial en Gestante',
          valor: `${sistolica}/${diastolica} mmHg (PAM: ${pam})`,
          titulo: '🚨 CRISIS HIPERTENSIVA DEL EMBARAZO (Preeclampsia Severa)',
          descripcion: `Gestante (${semana_gestacional ? `Semana ${semana_gestacional}` : 'Activa'}) con cifras en rango de severidad (PAS ≥ 160 o PAD ≥ 110). Alto riesgo de eclampsia, hemorragia o desprendimiento prematuro de placenta.`,
          criterio_res_3280: 'Res. 3280 RIAMP Pág. 293 (Código Azul - Requiere Sulfato de Magnesio Zuspan y remisión inmediata a alto nivel obstétrico)',
          accion_inmediata: 'Disparo telefónico urgente del Agente IA y enlace prioritario con enfermera jefe de obstetricia.'
        });
      } else if (sistolica >= 140 || diastolica >= 90) {
        alerts.push({
          tipo: 'trastorno_hipertensivo_gestacional',
          severidad: 'urgente_naranja',
          parametro: 'Tensión Arterial en Gestante',
          valor: `${sistolica}/${diastolica} mmHg (PAM: ${pam})`,
          titulo: '⚠️ Hipertensión Gestacional Detectada',
          descripcion: `Presión arterial elevada en gestante (PAS ≥ 140 o PAD ≥ 90 mmHg). Requiere verificación inmediata de síntomas premonitorios (cefalea, fosfenos, dolor epigástrico).`,
          criterio_res_3280: 'Res. 3280 Pág. 269 (Tamizaje de Trastornos Hipertensivos del Embarazo)',
          accion_inmediata: 'Llamada de orientación por Agente IA y agenda prioritaria en menos de 24 horas.'
        });
      }
    } else {
      // Paciente general / Adulto
      if (sistolica >= 180 || diastolica >= 110) {
        alerts.push({
          tipo: 'crisis_hipertensiva',
          severidad: 'critica_roja',
          parametro: 'Presión Arterial',
          valor: `${sistolica}/${diastolica} mmHg (PAM: ${pam})`,
          titulo: '🚨 CRISIS HIPERTENSIVA (Riesgo Órgano Blanco)',
          descripcion: `Presión sistólica ≥ 180 o diastólica ≥ 110 mmHg. Peligro de evento cerebrovascular, síndrome coronario o falla renal aguda.`,
          criterio_res_3280: 'Res. 3280 Pág. 144 (Valoración de Riesgo Cardiovascular / Guía HTA)',
          accion_inmediata: 'Contacto de emergencia del Agente IA con verificación de síntomas y alerta a central de urgencias.'
        });
      } else if (sistolica >= 160 || diastolica >= 100) {
        alerts.push({
          tipo: 'hipertension_estadio_2',
          severidad: 'urgente_naranja',
          parametro: 'Presión Arterial',
          valor: `${sistolica}/${diastolica} mmHg (PAM: ${pam})`,
          titulo: '⚠️ Hipertensión Grado 2 Descompensada',
          descripcion: `Lectura casera persistentemente alta. Riesgo acumulativo cardiovascular y abandono o dosis insuficiente de tratamiento antihipertensivo.`,
          criterio_res_3280: 'Res. 3280 Pág. 62 (Adherencia farmacológica en riesgo cardiovascular)',
          accion_inmediata: 'Agente IA realiza llamada de adherencia y confirma si el paciente tomó su medicamento prescrito hoy.'
        });
      } else if (sistolica < 90 || diastolica < 55) {
        alerts.push({
          tipo: 'hipotension_severa',
          severidad: 'urgente_naranja',
          parametro: 'Presión Arterial',
          valor: `${sistolica}/${diastolica} mmHg (PAM: ${pam})`,
          titulo: '⚠️ Hipotensión / Posible Shock o Sobredosificación',
          descripcion: `Presión arterial por debajo de límites seguros de perfusión tisular (PAS < 90 mmHg).`,
          criterio_res_3280: 'Res. 3280 Anexo 5 y 6 (Escala de Alerta Temprana Obstétrica y Clasificación de Choque)',
          accion_inmediata: 'Agente IA orienta posición decúbito, hidratación y chequeo con enfermería.'
        });
      }
    }
  }

  // 2. EVALUACIÓN DE GLUCOMETRÍA CASERA
  if (glucosa) {
    if (glucosa < 70) {
      alerts.push({
        tipo: 'hipoglucemia_severa',
        severidad: 'critica_roja',
        parametro: 'Glucometría',
        valor: `${glucosa} mg/dL`,
        titulo: '🚨 HIPOGLUCEMIA CLÍNICA (< 70 mg/dL)',
        descripcion: `Nivel crítico de glucosa en sangre. Riesgo inminente de temblor, pérdida de conciencia, convulsión o daño neurológico si no se revierte en minutos.`,
        criterio_res_3280: 'Res. 3280 Pág. 144 (Complicaciones agudas de la Diabetes)',
        accion_inmediata: 'Agente IA instruye de inmediato la Regla de los 15 (ingerir 15g de carbohidratos rápidos: medio vaso de jugo o agua con azúcar) y reevaluar en 15 minutos.'
      });
    } else if (glucosa >= 250) {
      alerts.push({
        tipo: 'hiperglucemia_severa',
        severidad: 'critica_roja',
        parametro: 'Glucometría',
        valor: `${glucosa} mg/dL (${momento_glucometria})`,
        titulo: '🚨 HIPERGLUCEMIA SEVERA (Riesgo Cetoacidosis / Estado Hiperosmolar)',
        descripcion: `Nivel de glucosa marcadamente elevado (≥ 250 mg/dL). Indicio de descompensación metabólica severa, omisión de insulina o proceso infeccioso activo.`,
        criterio_res_3280: 'Res. 3280 Pág. 146 (Seguimiento del Paciente Diabético)',
        accion_inmediata: 'Llamada del Agente IA para verificar síntomas de alerta (polidipsia, aliento cetónico, vómito) y activación del personal de enfermería.'
      });
    } else if (es_gestante && ((momento_glucometria === 'ayunas' && glucosa >= 95) || (momento_glucometria.includes('postprandial') && glucosa >= 140))) {
      alerts.push({
        tipo: 'diabetes_gestacional_descontrol',
        severidad: 'urgente_naranja',
        parametro: 'Glucometría en Gestante',
        valor: `${glucosa} mg/dL (${momento_glucometria})`,
        titulo: '⚠️ Glucosa Gestacional Descompensada',
        descripcion: `Cifras por encima de metas estrictas en embarazo (Ayunas < 92-95, Postprandial < 140 mg/dL). Riesgo de macrosomía fetal y morbilidad perinatal.`,
        criterio_res_3280: 'Res. 3280 Pág. 268 (Tamizaje y Control de Diabetes Gestacional / PTOG)',
        accion_inmediata: 'Agente IA realiza consejería nutricional y cita prioritaria con nutrición y obstetricia.'
      });
    } else if (!es_gestante && glucosa >= 180 && momento_glucometria === 'ayunas') {
      alerts.push({
        tipo: 'diabetes_ayunas_elevada',
        severidad: 'alerta_amarilla',
        parametro: 'Glucometría en Ayunas',
        valor: `${glucosa} mg/dL`,
        titulo: '⚠️ Glucosa en Ayunas Fuera de Rango (> 180 mg/dL)',
        descripcion: `Control glucémico subóptimo en ayunas. Requiere revisión del esquema farmacológico y adherencia alimentaria.`,
        criterio_res_3280: 'Res. 3280 Pág. 145 (Educación para la salud y automonitoreo en DM2)',
        accion_inmediata: 'Mensaje interactivo de WhatsApp con refuerzo de plan nutricional.'
      });
    }
  }

  // 3. EVALUACIÓN DE OXIMETRÍA
  if (o2 && o2 < 90) {
    alerts.push({
      tipo: 'desaturacion_severa',
      severidad: 'critica_roja',
      parametro: 'Saturación SpO2',
      valor: `${o2}%`,
      titulo: '🚨 DESATURACIÓN DE OXÍGENO SEVERA (< 90%)',
      descripcion: `Hipoxemia aguda que compromete la oxigenación tisular. Posible insuficiencia respiratoria aguda o complicación pulmonar.`,
      criterio_res_3280: 'Res. 3280 Anexo 5 (Alerta Temprana de Deterioro Fisiológico)',
      accion_inmediata: 'Notificación de urgencia a enfermería y llamada para verificar disnea o cianosis.'
    });
  }

  // Determinar severidad global
  let severidadGlobal = 'normal';
  if (alerts.some(a => a.severidad === 'critica_roja')) {
    severidadGlobal = 'critica_roja';
  } else if (alerts.some(a => a.severidad === 'urgente_naranja')) {
    severidadGlobal = 'urgente_naranja';
  } else if (alerts.some(a => a.severidad === 'alerta_amarilla')) {
    severidadGlobal = 'alerta_amarilla';
  }

  return {
    tieneAlerta: alerts.length > 0,
    severidadGlobal,
    pam,
    alerts,
    resumen: alerts.length === 0 
      ? 'Valores dentro de rangos normales de seguridad según la Guía 3280.' 
      : `Se detectaron ${alerts.length} condición(es) fuera de umbral clínico.`
  };
};

/**
 * Genera el guión clínico que utilizará el Agente IA para llamar al paciente
 * o enviar un mensaje interactivo, basándose estrictamente en la Resolución 3280 de 2018.
 */
export const generateAIAgentScript = ({
  pacienteNombre,
  pacienteTelefono,
  alerta,
  cursoVida,
  esGestante = false,
  semanaGestacional = null
}) => {
  const nombre = pacienteNombre || 'Estimado(a) paciente';
  
  if (!alerta) {
    return {
      canalRecomendado: 'whatsapp',
      asunto: 'Recordatorio de Salud Preventiva - Resolución 3280',
      guionLlamada: [
        `"Hola ${nombre}, te saluda SADI, el asistente de salud inteligente de tu centro médico."`,
        `"Te contactamos porque según la Ruta de Promoción y Mantenimiento de la Salud de la Resolución 3280, ya tienes habilitada tu valoración preventiva sin ningún costo."`,
        `"Cuidar tu salud a tiempo es vital. ¿Te gustaría que coordinemos tu cita médica para esta semana? Marca 1 para agendar o 2 para más información."`
      ],
      mensajeTexto: `Hola ${nombre}, en SADI cuidamos tu salud. Tienes pendiente tu cita preventiva de la Ruta 3280. Responde SI para agendarla fácilmente. ¡Tu bienestar es primero!`,
      objetivo: 'Inducción de demanda preventiva'
    };
  }

  // Guión específico para Crisis Hipertensiva en Gestante (Preeclampsia)
  if (alerta.tipo === 'preeclampsia_severa_crisis') {
    return {
      canalRecomendado: 'call_ia',
      prioridad: 'ALTA_URGENCIA',
      asunto: 'ALERTA CLÍNICA: Preeclampsia Severa - Res. 3280',
      guionLlamada: [
        `"Hola ${nombre}, soy el Agente de Telemonitoreo Clínico de SADI. Acabamos de registrar tu medición de presión arterial de ${alerta.valor}."`,
        `"${nombre}, por estar en tu semana ${semanaGestacional || 'de gestación'}, esta cifra supera los umbrales seguros de la Ruta Materno Perinatal y requiere atención prioritaria."`,
        `"Por favor responde claramente: ¿Estás experimentando dolor de cabeza fuerte, visión borrosa, luces en los ojos o dolor en la boca del estómago?"`,
        `"Independientemente de tus síntomas, ya he generado una alerta prioritaria con el equipo de Enfermería Obstétrica de tu IPS y un profesional se comunicará contigo de inmediato. Por favor recuéstate sobre tu lado izquierdo, mantén la calma y prepárate para acudir a urgencias obstétricas."`
      ],
      mensajeTexto: `🚨 URGENTE SADI: ${nombre}, tu presión de ${alerta.valor} está en rango de riesgo para tu embarazo. Enfermería ya fue notificada. Si tienes dolor de cabeza o visión borrosa, acude ya a Urgencias Obstétricas.`,
      objetivo: 'Activación de Código Azul Obstétrico y prevención de Eclampsia'
    };
  }

  // Guión para Hipoglucemia Severa
  if (alerta.tipo === 'hipoglucemia_severa') {
    return {
      canalRecomendado: 'call_ia',
      prioridad: 'ALTA_URGENCIA',
      asunto: 'ALERTA CLÍNICA: Hipoglucemia Severa (< 70 mg/dL)',
      guionLlamada: [
        `"Hola ${nombre}, te llama de inmediato el Agente Clínico de SADI. Hemos recibido tu glucometría casera de ${alerta.valor}."`,
        `"Este nivel de azúcar es muy bajo y peligroso. Necesitamos actuar ya aplicando la Regla de los 15 de la guía médica:"`,
        `"Toma de inmediato medio vaso de jugo de frutas con una cucharada de azúcar, o tres sobres de azúcar disueltos en agua. NO te inyectes insulina."`,
        `"Quédate sentado o acostado. Volveremos a medir tu glucosa en 15 minutos. Nuestro equipo de enfermería tiene el reporte en pantalla."`
      ],
      mensajeTexto: `🚨 ALERTA SADI: Glucosa muy baja (${alerta.valor}). Toma ya medio vaso de agua con azúcar o jugo. Repite la prueba en 15 min. No apliques insulina. Enfermería informada.`,
      objetivo: 'Reversión rápida de neuroglucopenia'
    };
  }

  // Guión para Crisis Hipertensiva en Adulto
  if (alerta.tipo === 'crisis_hipertensiva') {
    return {
      canalRecomendado: 'call_ia',
      prioridad: 'ALTA_URGENCIA',
      asunto: 'ALERTA CLÍNICA: Crisis Hipertensiva',
      guionLlamada: [
        `"Hola ${nombre}, te habla el Agente Médico de SADI. Tu tensiómetro reportó ${alerta.valor}, un valor muy elevado."`,
        `"¿Presentas en este momento dolor en el pecho, dificultad para respirar, adormecimiento de la cara o brazos?"`,
        `"Por favor toma asiento tranquilamente. Si tomas medicamentos para la presión, ¿los tomaste hoy a la hora prescrita? La enfermera de turno está revisando tu caso en el Dashboard clínico."`
      ],
      mensajeTexto: `⚠️ SADI ALERTA: Presión arterial en ${alerta.valor}. Si sientes dolor de pecho o falta de aire ve a Urgencias. Enfermería está conectada a tu monitoreo.`,
      objetivo: 'Triage de emergencia cardiovascular'
    };
  }

  // Guión genérico para descompensación o adherencia
  return {
    canalRecomendado: 'call_ia',
    prioridad: 'MEDIA',
    asunto: `Seguimiento Clínico SADI - ${alerta.titulo}`,
    guionLlamada: [
      `"Hola ${nombre}, te habla el Agente de Salud de SADI. Notamos una variación en tu medición de ${alerta.parametro} (${alerta.valor})."`,
      `"Queremos acompañarte para que tu tratamiento sea un éxito y evitar complicaciones. ¿Has presentado algún malestar en las últimas 24 horas?"`,
      `"El equipo de auxiliares y enfermeras de tu IPS tiene tu evolución en su panel. Te enviaremos recomendaciones a tu WhatsApp y coordinaremos un control médico."`
    ],
    mensajeTexto: `Hola ${nombre}, SADI registró tu medición de ${alerta.parametro} (${alerta.valor}). Queremos asegurarnos de que estés bien. Recuerda no suspender tu medicación.`,
    objetivo: 'Acompañamiento clínico y adherencia al tratamiento'
  };
};

/**
 * Catálogo de Citas y Atenciones recomendadas por la Resolución 3280 de 2018
 * para alimentar automáticamente la programación del paciente.
 */
export const getRequiredRIASAppointments = (fechaNacimiento, sexo = 'femenino', esGestante = false, semanaGestacional = null) => {
  const curso = getCursoVida3280(fechaNacimiento);
  const appointments = [];

  if (esGestante) {
    appointments.push({
      protocol_id: '3280-MAT-PRENATAL',
      nombre: 'Control Prenatal de Seguimiento',
      frecuencia: 'Mensual hasta sem 36, quincenal hasta sem 38',
      profesional: 'Medicina General / Obstetricia / Enfermería',
      pagina: 263,
      accion: 'Evaluación materno fetal, curva de peso Atalah, toma de PA y auscultación FCF'
    });
    appointments.push({
      protocol_id: '3280-MAT-ECOGRAFIA',
      nombre: 'Ecografía Obstétrica de Detalle Anatómico (18-24 sem)',
      frecuencia: 'Semana 18 a 24 de gestación',
      profesional: 'Ginecobstetra / Radiólogo',
      pagina: 268,
      accion: 'Detección temprana de anomalías estructurales y bienestar fetal'
    });
    appointments.push({
      protocol_id: '3280-MAT-CURSO',
      nombre: 'Curso de Preparación para la Maternidad y Paternidad',
      frecuencia: '7 sesiones presenciales / virtuales',
      profesional: 'Equipo Interdisciplinario (Enfermería, Medicina, Psicología)',
      pagina: 273,
      accion: 'Capacitación en signos de alarma, parto humanizado, lactancia y puerperio'
    });
  }

  if (curso.id === 'primera_infancia') {
    appointments.push({
      protocol_id: '3280-PI-VAL',
      nombre: 'Control de Crecimiento y Desarrollo (EAD-3)',
      frecuencia: 'Cada 2-3 meses en < 1 año; cada 6 meses de 1 a 3 años',
      profesional: 'Pediatría / Medicina General / Enfermería',
      pagina: 105,
      accion: 'Aplicación de Escala Abreviada de Desarrollo 3 y curvas OMS'
    });
    appointments.push({
      protocol_id: '3280-PI-FLUOR',
      nombre: 'Aplicación de Barniz de Flúor en Primera Infancia',
      frecuencia: 'Semestral a partir del año de vida',
      profesional: 'Odontología / Higiene Oral',
      pagina: 162,
      accion: 'Protección específica del esmalte dental primario'
    });
  }

  if (curso.id === 'adultez' || curso.id === 'vejez') {
    if (sexo === 'femenino') {
      appointments.push({
        protocol_id: '3280-CA-CERVIX-VPH',
        nombre: 'Tamizaje Ca Cuello Uterino (Prueba ADN-VPH)',
        frecuencia: 'Cada 5 años (esquema 1-5-5 para 30 a 65 años)',
        profesional: 'Enfermería / Medicina',
        pagina: 168,
        accion: 'Toma de muestra cérvico uterina para genotipificación de VPH alto riesgo'
      });
      appointments.push({
        protocol_id: '3280-CA-MAMA-MAMO',
        nombre: 'Mamografía Bilateral de Dos Proyecciones',
        frecuencia: 'Cada 2 años (50 a 69 años)',
        profesional: 'Radiología / Tecnólogo en Imágenes Diagnósticas',
        pagina: 173,
        accion: 'Detección temprana de microcalcificaciones y nódulos mamarios'
      });
    }

    if (sexo === 'masculino') {
      appointments.push({
        protocol_id: '3280-CA-PROSTATA',
        nombre: 'Tamizaje Ca de Próstata (PSA + Tacto Rectal)',
        frecuencia: 'Cada 5 años (50 a 79 años, o 40 con riesgo)',
        profesional: 'Medicina General / Urología',
        pagina: 175,
        accion: 'Dosificación sérica de Antígeno Prostático y examen clínico'
      });
    }

    appointments.push({
      protocol_id: '3280-CA-COLON',
      nombre: 'Tamizaje Ca Colorrectal (Sangre Oculta en Heces FIT)',
      frecuencia: 'Cada 2 años (50 a 75 años)',
      profesional: 'Laboratorio Clínico / Bacteriología',
      pagina: 178,
      accion: 'Prueba inmunoquímica fecal para hemoglobina humana oculta'
    });

    appointments.push({
      protocol_id: '3280-RCV-FINDRISC',
      nombre: 'Valoración de Riesgo Cardiovascular y Metabólico',
      frecuencia: 'Cada 5 años',
      profesional: 'Medicina General o Familiar',
      pagina: 144,
      accion: 'Test de FINDRISC, cálculo Framingham 10 años, perfil lipídico y creatinina'
    });
  }

  return appointments;
};
