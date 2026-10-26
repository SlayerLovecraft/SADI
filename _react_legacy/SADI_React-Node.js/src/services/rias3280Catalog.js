// ==============================================================================
// CATÁLOGO COMPLETO DE PROGRAMAS Y TAMIZAJES - RESOLUCIÓN 3280 DE 2018 (COLOMBIA)
// Cobertura total de los 7 Cursos de Vida y Ruta Integral Materno Perinatal (RIAMP)
// ==============================================================================

export const CURSOS_DE_VIDA_3280 = [
  {
    id: 'primera_infancia',
    nombre: 'Primera Infancia',
    rango: '0 a 5 años (0 a 71 meses)',
    color: 'emerald',
    descripcion: 'Desarrollo infantil temprano, neurodesarrollo EAD-3, tamizaje visual, auditivo, nutrición y vacunación PAI.'
  },
  {
    id: 'infancia',
    nombre: 'Infancia',
    rango: '6 a 11 años (72 a 143 meses)',
    color: 'teal',
    descripcion: 'Salud escolar, agudeza visual Snellen, salud bucal, sellantes y tamizaje de riesgo cardiovascular.'
  },
  {
    id: 'adolescencia',
    nombre: 'Adolescencia',
    rango: '12 a 17 años (144 a 215 meses)',
    color: 'indigo',
    descripcion: 'Hebiatría, salud sexual y reproductiva, tamizaje de depresión/ansiedad, consumo de SPA y salud visual.'
  },
  {
    id: 'juventud',
    nombre: 'Juventud',
    rango: '18 a 28 años',
    color: 'cyan',
    descripcion: 'Planificación familiar, tamizaje de ITS (VIH/Sífilis), citología cervicovaginal, riesgo cardiovascular y salud mental.'
  },
  {
    id: 'adultez',
    nombre: 'Adultez',
    rango: '29 a 59 años',
    color: 'blue',
    descripcion: 'Detección temprana de cáncer (mama, cuello uterino ADN-VPH, próstata, colorrectal) y riesgo cardiovascular metabólico.'
  },
  {
    id: 'vejez',
    nombre: 'Vejez',
    rango: '60 años o más',
    color: 'purple',
    descripcion: 'Valoración geriátrica integral (Barthel, Lawton, FRAIL, Minimental), tamizaje de caídas, comorbilidades y demencias.'
  },
  {
    id: 'materno_perinatal',
    nombre: 'Ruta Materno Perinatal (RIAMP)',
    rango: 'Gestación, Parto y Puerperio (0 a 40 sem + 42 días)',
    color: 'rose',
    descripcion: 'Atención prenatal integral, ecografías genéticas/detalle, tamizaje preeclampsia, diabetes gestacional, EGB y parto humanizado.'
  }
];

export const PROGRAMAS_Y_TAMIZAJES_3280 = [
  // --------------------------------------------------------------------------
  // 1. PRIMERA INFANCIA (0 A 5 AÑOS)
  // --------------------------------------------------------------------------
  {
    id: '3280-PI-VAL-INTEGRAL',
    curso_vida: 'primera_infancia',
    nombre: 'Valoración Integral de la Salud del Niño (Crecimiento y Desarrollo)',
    categoria: 'Valoración Integral',
    codigo_procedimiento: '890201',
    frecuencia: 'Al mes, a los 2-3 m, 4-5 m, 6-8 m, 9-11 m, 12-17 m, 18-23 m, 24-29 m, y anual hasta los 5 años',
    profesional: 'Pediatría / Medicina General / Enfermería',
    pagina_resolucion: 105,
    descripcion: 'Evaluación de crecimiento físico (curvas OMS: P/T, T/E, IMC/E) y desarrollo psicomotor con Escala Abreviada de Desarrollo (EAD-3).',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'Estimada familia de {paciente}, según la Resolución 3280 es momento del control de crecimiento y desarrollo con la Escala EAD-3 para asegurar su adecuado progreso motor y lingüístico.'
  },
  {
    id: '3280-PI-TAM-VISUAL',
    curso_vida: 'primera_infancia',
    nombre: 'Tamizaje de Agudeza Visual en Primera Infancia',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '890203',
    frecuencia: 'A los 3, 4 y 5 años de edad',
    profesional: 'Optometría / Medicina General / Enfermería capacitada',
    pagina_resolucion: 112,
    descripcion: 'Detección oportuna de ambliopía, estrabismo y errores refractivos mediante optotipos de figuras (LEA symbols) o E tumbling.',
    canal_recomendado: 'sms',
    guion_ia_base: 'Hola acudiente de {paciente}. A los 3 años inicia el tamizaje visual obligatorio de la Resolución 3280. Protege la visión de tu hijo reservando su cita.'
  },
  {
    id: '3280-PI-TAM-AUDITIVO',
    curso_vida: 'primera_infancia',
    nombre: 'Tamizaje Auditivo Neonatal y en Primera Infancia',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '954601',
    frecuencia: 'Neonatal antes de los 3 meses y verificación en cada control',
    profesional: 'Fonoaudiología / Otorrinolaringología / Pediatría',
    pagina_resolucion: 115,
    descripcion: 'Emisiones otoacústicas o potenciales evocados auditivos automatizados para detectar hipoacusia congénita.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Cordial saludo. El tamizaje auditivo neonatal de {paciente} es fundamental para el desarrollo del lenguaje. Verificamos que se haya efectuado en su IPS.'
  },
  {
    id: '3280-PI-TAM-ANEMIA',
    curso_vida: 'primera_infancia',
    nombre: 'Tamizaje de Anemia Infantil (Hemoglobina y Hematocrito)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '902213',
    frecuencia: 'A los 6 meses de edad y según factor de riesgo',
    profesional: 'Bacteriología / Laboratorio Clínico',
    pagina_resolucion: 118,
    descripcion: 'Cuantificación de hemoglobina y hematocrito para prevenir retardo psicomotor por deficiencia de hierro.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'SADI Salud: A los 6 meses {paciente} requiere su tamizaje de hemoglobina para prevenir anemia ferropénica. ¿Deseas la orden para el laboratorio más cercano?'
  },
  {
    id: '3280-PI-TAM-CADERA',
    curso_vida: 'primera_infancia',
    nombre: 'Tamizaje de Displasia del Desarrollo de Cadera (DDC)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '870101',
    frecuencia: 'Examen físico en cada control; Rx comparativa a los 4 meses si factores de riesgo',
    profesional: 'Pediatría / Medicina General / Ortopedia Infantil',
    pagina_resolucion: 121,
    descripcion: 'Maniobras de Ortolani y Barlow en el primer trimestre y radiografía comparativa o ecografía de cadera tipo Graf.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola familia de {paciente}. La detección precoz de displasia de cadera a los 4 meses previene dificultades futuras para caminar. Te recordamos asistir a su valoración.'
  },
  {
    id: '3280-PI-BUCAL-FLUOR',
    curso_vida: 'primera_infancia',
    nombre: 'Atención en Salud Bucal y Aplicación de Barniz de Flúor',
    categoria: 'Protección Específica',
    codigo_procedimiento: '997102',
    frecuencia: 'Semestral a partir del primer año (desde los 6 meses erupción dental)',
    profesional: 'Odontología / Higiene Oral',
    pagina_resolucion: 162,
    descripcion: 'Control de biopelícula, profilaxis dental infantil y barniz de flúor para remineralización y prevención de caries temprana de la infancia.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'Hola. Cuidar la sonrisa de {paciente} es prioridad. Según la Res. 3280 le corresponde su barniz de flúor semestral gratuito en odontología.'
  },
  {
    id: '3280-PI-DESPARASITACION',
    curso_vida: 'primera_infancia',
    nombre: 'Desparasitación Intestinal Periódica',
    categoria: 'Protección Específica',
    codigo_procedimiento: '993101',
    frecuencia: 'Semestral a partir del año de edad',
    profesional: 'Medicina General / Enfermería',
    pagina_resolucion: 125,
    descripcion: 'Administración de albendazol 400 mg dosis única o mebendazol según directriz nacional en zonas de riesgo.',
    canal_recomendado: 'sms',
    guion_ia_base: 'Recordatorio SADI: {paciente} tiene disponible la entrega del antiparasitario semestral en la farmacia de su IPS. Consulta abierta sin costo.'
  },

  // --------------------------------------------------------------------------
  // 2. INFANCIA (6 A 11 AÑOS)
  // --------------------------------------------------------------------------
  {
    id: '3280-INF-VAL-INTEGRAL',
    curso_vida: 'infancia',
    nombre: 'Valoración Integral de la Salud en la Infancia',
    categoria: 'Valoración Integral',
    codigo_procedimiento: '890202',
    frecuencia: 'Cada 2 a 3 años (a los 6, 8 y 10 años)',
    profesional: 'Medicina General / Pediatría / Enfermería',
    pagina_resolucion: 128,
    descripcion: 'Evaluación del desarrollo puberal temprano (Tanner), rendimiento escolar, hábitos alimentarios, agudeza auditiva y convivencia escolar.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola acudiente de {paciente}. A sus {edad} años le corresponde el control de salud escolar de la Resolución 3280 para evaluar su postura, desarrollo y visión.'
  },
  {
    id: '3280-INF-TAM-VISUAL',
    curso_vida: 'infancia',
    nombre: 'Tamizaje de Agudeza Visual con Tabla Snellen',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '890203',
    frecuencia: 'A los 6, 8 y 10 años de edad',
    profesional: 'Optometría / Medicina General',
    pagina_resolucion: 131,
    descripcion: 'Medición monocular de agudeza visual con optotipos alfanuméricos para prevenir fracaso escolar por miopía o astigmatismo no corregido.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'SADI te informa: El buen rendimiento escolar de {paciente} depende de su visión. Agenda su tamizaje Snellen en tu IPS.'
  },
  {
    id: '3280-INF-SALUD-BUCAL',
    curso_vida: 'infancia',
    nombre: 'Control de Placa, Profilaxis y Sellantes de Fosas y Fisuras',
    categoria: 'Protección Específica',
    codigo_procedimiento: '997103',
    frecuencia: 'Semestral para placa y sellantes en primeros molares permanentes (6-7 años)',
    profesional: 'Odontología / Higiene Oral',
    pagina_resolucion: 164,
    descripcion: 'Sellado de fosas y fisuras en primeros y segundos molares permanentes para blindar las piezas definitivas contra la caries.',
    canal_recomendado: 'sms',
    guion_ia_base: 'Odontología SADI: {paciente} tiene en erupción sus primeros molares definitivos. Aplica los sellantes preventivos gratuitos este mes.'
  },
  {
    id: '3280-INF-TAM-RIESGO-CV',
    curso_vida: 'infancia',
    nombre: 'Tamizaje de Tensión Arterial y Riesgo Metabólico en Infancia',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '890204',
    frecuencia: 'Anual a partir de los 6 años',
    profesional: 'Medicina General / Enfermería',
    pagina_resolucion: 134,
    descripcion: 'Toma de presión arterial con manguito adecuado al brazo del menor y percentilación según edad, sexo y talla (tabla AAP).',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola, te habla el Agente de Salud SADI. El tamizaje de presión arterial en {paciente} nos ayuda a detectar sobrepeso y cuidar su salud a tiempo.'
  },
  {
    id: '3280-INF-VACUNACION-VPH',
    curso_vida: 'infancia',
    nombre: 'Vacunación contra el Virus del Papiloma Humano (VPH)',
    categoria: 'Protección Específica',
    codigo_procedimiento: '993122',
    frecuencia: 'A partir de los 9 años (esquema nacional PAI)',
    profesional: 'Enfermería PAI',
    pagina_resolucion: 136,
    descripcion: 'Inmunización contra los genotipos oncogénicos 16 y 18 del VPH para erradicar el riesgo futuro de cáncer de cuello uterino.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'Vacunación SADI: {paciente} ha alcanzado la edad para recibir su dosis de vacuna contra el VPH. Protege su futuro hoy.'
  },

  // --------------------------------------------------------------------------
  // 3. ADOLESCENCIA (12 A 17 AÑOS)
  // --------------------------------------------------------------------------
  {
    id: '3280-ADO-VAL-INTEGRAL',
    curso_vida: 'adolescencia',
    nombre: 'Valoración Integral de la Salud del Adolescente (Hebiatría)',
    categoria: 'Valoración Integral',
    codigo_procedimiento: '890205',
    frecuencia: 'Cada 2 años (a los 12, 14 y 16 años)',
    profesional: 'Medicina Familiar / Medicina General / Enfermería',
    pagina_resolucion: 138,
    descripcion: 'Evaluación de estadios Tanner, salud mental, imagen corporal, tamizaje de violencia intrafamiliar y pautas de crianza en la adolescencia.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola {paciente}, en SADI nos interesa acompañarte en tus decisiones de salud y bienestar. Tienes habilitado tu chequeo integral para jóvenes de tu edad.'
  },
  {
    id: '3280-ADO-SALUD-MENTAL',
    curso_vida: 'adolescencia',
    nombre: 'Tamizaje de Depresión, Ansiedad y Riesgo Suicida (PHQ-9 / Columbia)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '890206',
    frecuencia: 'Anual o en cada valoración del adolescente',
    profesional: 'Psicología / Medicina General / Trabajo Social',
    pagina_resolucion: 140,
    descripcion: 'Aplicación de cuestionarios validados para detección temprana de trastornos del ánimo, ideación autolítica y ciberacoso.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'Hola {paciente}, tu bienestar emocional es lo más valioso. Si sientes sobrecarga, estrés o tristeza, en SADI cuentas con orientación médica y psicológica confidencial.'
  },
  {
    id: '3280-ADO-TAM-SPA',
    curso_vida: 'adolescencia',
    nombre: 'Tamizaje de Consumo de Sustancias Psicoactivas (CRAFFT / ASSIST)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '890207',
    frecuencia: 'En cada consulta médica o de enfermería',
    profesional: 'Medicina / Enfermería / Psicología',
    pagina_resolucion: 142,
    descripcion: 'Evaluación rápida de experimentación o consumo riesgoso de alcohol, vapeadores, tabaco o SPA con intervención breve motivacional.',
    canal_recomendado: 'sms',
    guion_ia_base: 'Espacio Joven SADI: Conoce la asesoría en prevención y toma de decisiones libres de riesgos. Habla con un profesional en tu IPS.'
  },
  {
    id: '3280-ADO-SALUD-SEXUAL',
    curso_vida: 'adolescencia',
    nombre: 'Asesoría en Anticoncepción y Derechos Sexuales y Reproductivos',
    categoria: 'Protección Específica',
    codigo_procedimiento: '890208',
    frecuencia: 'Demanda espontánea o inducida periódica',
    profesional: 'Medicina General / Enfermería',
    pagina_resolucion: 144,
    descripcion: 'Suministro libre y gratuito de preservativos, implantes subdérmicos, DIU y anticonceptivos orales o inyectables.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'Hola {paciente}, tienes derecho a asesoría médica personalizada y entrega de métodos anticonceptivos gratuitos en tu IPS sin necesidad de cita previa complicada.'
  },

  // --------------------------------------------------------------------------
  // 4. JUVENTUD (18 A 28 AÑOS)
  // --------------------------------------------------------------------------
  {
    id: '3280-JUV-VAL-INTEGRAL',
    curso_vida: 'juventud',
    nombre: 'Valoración Integral de la Salud del Joven',
    categoria: 'Valoración Integral',
    codigo_procedimiento: '890209',
    frecuencia: 'Cada 3 a 5 años en ausencia de factores de riesgo',
    profesional: 'Medicina General / Enfermería',
    pagina_resolucion: 146,
    descripcion: 'Evaluación antropométrica (IMC), hábitos de vida saludable, salud reproductiva, riesgo ocupacional y salud mental.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola {paciente}, te saluda el Agente SADI. Los chequeos en la juventud consolidan tu salud a largo plazo. Confirma tu valoración integral preventiva.'
  },
  {
    id: '3280-JUV-TAM-ITS',
    curso_vida: 'juventud',
    nombre: 'Tamizaje de Infecciones de Transmisión Sexual (VIH y Sífilis Pruebas Rápidas)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '906249',
    frecuencia: 'Anual o semestral según conducta de riesgo',
    profesional: 'Bacteriología / Enfermería capacitada',
    pagina_resolucion: 149,
    descripcion: 'Pruebas diagnósticas rápidas voluntarias con asesoría pre y pos-test con entrega de resultados en menos de 30 minutos.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'SADI Salud: Tu tamizaje rápido y confidencial de VIH y Sífilis está disponible en tu IPS. Conocer tu estado serológico es tu derecho.'
  },
  {
    id: '3280-JUV-CITOLOGIA',
    curso_vida: 'juventud',
    nombre: 'Tamizaje de Cáncer de Cuello Uterino (Citología Cervicovaginal 1-1-3)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '898001',
    frecuencia: 'Cada año por 2 años consecutivos; si son negativas, cada 3 años (mujeres de 25 a 29 años)',
    profesional: 'Citohistología / Enfermería / Medicina',
    pagina_resolucion: 167,
    descripcion: 'Toma de frotis endocervical y ectocervical con espátula de Ayre y citocepillo para detección de lesiones preneoplásicas de bajo o alto grado.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola {paciente}. Tu citología cervicovaginal anual de la Res. 3280 está lista para ser realizada sin ningún costo. Permítenos agendarte.'
  },
  {
    id: '3280-JUV-TAM-CARDIOVASCULAR',
    curso_vida: 'juventud',
    nombre: 'Tamizaje de Tensión Arterial y Cálculo de Riesgo FINDRISC',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '890210',
    frecuencia: 'Cada 2 años',
    profesional: 'Medicina General / Enfermería',
    pagina_resolucion: 152,
    descripcion: 'Toma seriada de presión arterial y aplicación del test FINDRISC para predecir diabetes mellitus tipo 2 en los próximos 10 años.',
    canal_recomendado: 'sms',
    guion_ia_base: 'SADI: Monitorea tu presión y metabolismo con tu equipo en casa o en tu centro de salud. Mantén tus metas saludables.'
  },

  // --------------------------------------------------------------------------
  // 5. ADULTEZ (29 A 59 AÑOS)
  // --------------------------------------------------------------------------
  {
    id: '3280-ADU-VAL-INTEGRAL',
    curso_vida: 'adultez',
    nombre: 'Valoración Integral de la Salud del Adulto',
    categoria: 'Valoración Integral',
    codigo_procedimiento: '890211',
    frecuencia: 'Cada 5 años',
    profesional: 'Medicina General / Medicina Interna / Medicina Familiar',
    pagina_resolucion: 154,
    descripcion: 'Evaluación integral cardiovascular, riesgo metabólico, perfil hepático, renal, estrés laboral y detección de neoplasias.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Estimado/a {paciente}, en la etapa adulta la prevención oportuna es la clave. SADI te invita a tu valoración integral de la Res. 3280.'
  },
  {
    id: '3280-CA-CERVIX-VPH',
    curso_vida: 'adultez',
    nombre: 'Tamizaje Molecular de Cáncer de Cuello Uterino (Prueba ADN-VPH)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '906915',
    frecuencia: 'Cada 5 años (esquema 1-5-5 para mujeres de 30 a 65 años)',
    profesional: 'Bacteriología / Patología / Enfermería',
    pagina_resolucion: 168,
    descripcion: 'Genotipificación molecular de VPH de alto riesgo (16, 18 y otros 12 genotipos oncogénicos) con triaje citológico reflejo.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'Hola {paciente}. La prueba molecular de ADN-VPH es el estándar moderno de la Res. 3280 para protegerte contra el cáncer de cérvix por 5 años.'
  },
  {
    id: '3280-CA-MAMA-MAMO',
    curso_vida: 'adultez',
    nombre: 'Tamizaje de Cáncer de Mama (Mamografía Bilateral)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '876802',
    frecuencia: 'Cada 2 años en mujeres de 50 a 69 años (examen clínico anual desde los 40 años)',
    profesional: 'Radiología / Imágenes Diagnósticas',
    pagina_resolucion: 173,
    descripcion: 'Mamografía digital bilateral en proyecciones craneocaudal y mediolateral oblicua con clasificación BI-RADS.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola {paciente}, te saluda el Agente SADI. Tu mamografía bilateral preventiva de la Resolución 3280 está disponible para agendar esta semana.'
  },
  {
    id: '3280-CA-PROSTATA',
    curso_vida: 'adultez',
    nombre: 'Tamizaje de Cáncer de Próstata (PSA Sérico + Tacto Rectal DRE)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '906422',
    frecuencia: 'Cada 5 años entre los 50 y 75 años (desde los 40 años si afrodescendiente o historia familiar)',
    profesional: 'Urología / Medicina General / Laboratorio Clínico',
    pagina_resolucion: 175,
    descripcion: 'Medición de Antígeno Prostático Específico total en sangre y examen físico prostático digital para detección en estadio localizado.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Estimado {paciente}, el cuidado prostático después de los 50 años salva vidas. Tu tamizaje combinado de PSA está ordenado sin costo en tu IPS.'
  },
  {
    id: '3280-CA-COLON',
    curso_vida: 'adultez',
    nombre: 'Tamizaje de Cáncer Colorrectal (Sangre Oculta en Heces FIT)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '902049',
    frecuencia: 'Cada 2 años entre los 50 y 75 años de edad',
    profesional: 'Laboratorio Clínico / Gastroenterología',
    pagina_resolucion: 178,
    descripcion: 'Prueba inmunoquímica fecal cuantitativa (FIT) específica para hemoglobina humana, sin restricción dietética previa.',
    canal_recomendado: 'sms',
    guion_ia_base: 'SADI Salud: Tu kit FIT para tamizaje de colon y recto te espera en el laboratorio de tu IPS. Procedimiento sencillo y no invasivo.'
  },
  {
    id: '3280-RCV-METABOLICO',
    curso_vida: 'adultez',
    nombre: 'Evaluación y Tamizaje de Riesgo Cardiovascular y Metabólico',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '890212',
    frecuencia: 'Cada 5 años o anual si presenta hipertensión o diabetes',
    profesional: 'Medicina General / Medicina Interna',
    pagina_resolucion: 156,
    descripcion: 'Perfil lipídico completo (colesterol total, HDL, LDL, triglicéridos), glicemia basal, creatinina, microalbuminuria y cálculo de riesgo Framingham a 10 años.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'Hola {paciente}. Con tu glucómetro y tensiómetro casero monitoreamos tu salud. Recuerda programar tus exámenes de perfil lipídico y glicemia.'
  },

  // --------------------------------------------------------------------------
  // 6. VEJEZ (60 AÑOS O MÁS)
  // --------------------------------------------------------------------------
  {
    id: '3280-VEJ-VAL-GERIATRICA',
    curso_vida: 'vejez',
    nombre: 'Valoración Geriátrica Integral Multidimensional (VGI)',
    categoria: 'Valoración Integral',
    codigo_procedimiento: '890213',
    frecuencia: 'Cada 3 años o anual en adultos mayores frágiles',
    profesional: 'Geriatría / Medicina Familiar / Medicina General',
    pagina_resolucion: 182,
    descripcion: 'Evaluación multidimensional: fragilidad (criterios Fried / escala FRAIL), funcionalidad (Índice de Barthel y Lawton-Brody), estado cognitivo y nutricional.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Apreciado/a {paciente}, en SADI queremos acompañarle con la mejor atención geriátrica. Coordinemos su chequeo integral de vitalidad y movilidad.'
  },
  {
    id: '3280-VEJ-TAM-COGNITIVO',
    curso_vida: 'vejez',
    nombre: 'Tamizaje de Deterioro Cognitivo y Demencias (Minimental / Pfeiffer / MoCA)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '890214',
    frecuencia: 'Anual en mayores de 60 años',
    profesional: 'Neuropsicología / Geriatría / Medicina General',
    pagina_resolucion: 186,
    descripcion: 'Evaluación de memoria reciente, orientación, cálculo y funciones ejecutivas para detección oportuna de deterioro cognitivo leve o Alzheimer.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola {paciente}. Cuidar la memoria y agilidad mental es parte del plan de envejecimiento activo de la Res. 3280. Le apoyamos en su valoración.'
  },
  {
    id: '3280-VEJ-TAM-CAIDAS',
    curso_vida: 'vejez',
    nombre: 'Tamizaje de Riesgo de Caídas y Movilidad (Prueba Timed Up and Go - TUG)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '890215',
    frecuencia: 'Anual',
    profesional: 'Fisioterapia / Medicina General / Enfermería',
    pagina_resolucion: 189,
    descripcion: 'Cronometraje de levantarse de una silla, caminar 3 metros y regresar para predecir inestabilidad y fractura de cadera.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'SADI te acompaña: Mantener tu equilibrio y fuerza muscular te protege de caídas. Asiste a tu evaluación de marcha y fisioterapia preventiva.'
  },
  {
    id: '3280-VEJ-TAM-DEPRESION',
    curso_vida: 'vejez',
    nombre: 'Tamizaje de Depresión en el Adulto Mayor (Escala Geriátrica de Yesavage)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '890216',
    frecuencia: 'Anual',
    profesional: 'Psicología / Medicina General / Trabajo Social',
    pagina_resolucion: 192,
    descripcion: 'Cuestionario de 15 ítems para identificar desánimo, soledad no deseada o pérdida de interés en la vida cotidiana.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola {paciente}, tu tranquilidad y alegría cotidiana son esenciales para nosotros. El equipo de salud mental de SADI está para escucharte y apoyarte.'
  },
  {
    id: '3280-VEJ-VACUNACION',
    curso_vida: 'vejez',
    nombre: 'Vacunación del Adulto Mayor (Influenza Estacional y Neumococo)',
    categoria: 'Protección Específica',
    codigo_procedimiento: '993130',
    frecuencia: 'Influenza anual y Neumococo según esquema',
    profesional: 'Enfermería PAI',
    pagina_resolucion: 195,
    descripcion: 'Inmunización respiratoria para prevenir neumonías graves y hospitalizaciones en época de picos respiratorios.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'SADI Vacunas: La vacuna antigripal para la temporada actual ya está disponible para ti sin costo ni fila. Te esperamos en tu IPS.'
  },

  // --------------------------------------------------------------------------
  // 7. RUTA MATERNO PERINATAL (RIAMP)
  // --------------------------------------------------------------------------
  {
    id: '3280-MAT-PRENATAL',
    curso_vida: 'materno_perinatal',
    nombre: 'Control Prenatal de Seguimiento Clínico y Monitoreo Fetal',
    categoria: 'Atención Integral',
    codigo_procedimiento: '890217',
    frecuencia: 'Mensual hasta semana 36, quincenal hasta semana 38 y semanal hasta el parto (mínimo 10 controles)',
    profesional: 'Ginecobstetricia / Medicina General / Enfermería Obstétrica',
    pagina_resolucion: 263,
    descripcion: 'Vigilancia de curva tensional (detección preeclampsia), altura uterina, auscultación de frecuencia cardíaca fetal y ganancia de peso según Atalah.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola {paciente}, te saluda el Agente SADI. Estando en la semana {semana_gestacional} de tu embarazo, tu control prenatal es vital para verificar tu presión y los latidos de tu bebé.'
  },
  {
    id: '3280-MAT-ECOGRAFIA-GENETICA',
    curso_vida: 'materno_perinatal',
    nombre: 'Ecografía Genética de Tamizaje de Aneuploidías (Semana 11 a 13.6)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '881431',
    frecuencia: 'Entre la semana 11 y 13 semanas + 6 días',
    profesional: 'Especialista en Medicina Materno Fetal / Radiología',
    pagina_resolucion: 266,
    descripcion: 'Medición de translucencia nucal, hueso nasal y Doppler de ductus venoso para tamizaje de trisomías 21, 18 y 13.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'Hola {paciente}. Estás en la ventana ideal para tu ecografía genética de primer trimestre. Coordina la cita con tu especialista en perinatología.'
  },
  {
    id: '3280-MAT-ECOGRAFIA-DETALLE',
    curso_vida: 'materno_perinatal',
    nombre: 'Ecografía Obstétrica de Detalle Anatómico Fetal (Semana 18 a 23.6)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '881432',
    frecuencia: 'Entre la semana 18 y 23 semanas + 6 días de gestación',
    profesional: 'Ginecobstetra / Perinatólogo',
    pagina_resolucion: 268,
    descripcion: 'Estudio morfológico detallado de cráneo, cerebro, corazón de cuatro cámaras, columna, extremidades y Doppler de arterias uterinas para predecir preeclampsia.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola {paciente}. Tu ecografía morfológica de detalle anatómico es uno de los estudios más importantes de la gestación para conocer a fondo la salud de tu bebé.'
  },
  {
    id: '3280-MAT-TAM-DIABETES',
    curso_vida: 'materno_perinatal',
    nombre: 'Tamizaje de Diabetes Gestacional (PTOG con 75g de glucosa)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '903823',
    frecuencia: 'Entre la semana 24 y 28 de gestación',
    profesional: 'Laboratorio Clínico / Bacteriología',
    pagina_resolucion: 270,
    descripcion: 'Prueba de tolerancia oral a la glucosa con determinación basal, a la hora y a las dos horas para prevenir macrosomía y distocia de hombros.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'SADI Gestantes: En la semana 24 corresponde tu prueba de tolerancia oral a la glucosa con 75g. Te enviamos la preparación en ayunas por WhatsApp.'
  },
  {
    id: '3280-MAT-TAM-EGB',
    curso_vida: 'materno_perinatal',
    nombre: 'Tamizaje de Estreptococo del Grupo B (Cultivo Vagino-Rectal)',
    categoria: 'Detección Temprana',
    codigo_procedimiento: '901222',
    frecuencia: 'Entre la semana 35 y 37 de gestación',
    profesional: 'Laboratorio Clínico / Bacteriología',
    pagina_resolucion: 272,
    descripcion: 'Frotis de tercio inferior de vagina y ano para indicar profilaxis antibiótica intraparto con ampicilina y evitar sepsis neonatal temprana.',
    canal_recomendado: 'call_ia',
    guion_ia_base: 'Hola {paciente}. A las 35-37 semanas realizamos el cultivo preventivo para estreptococo. Esto garantiza un parto seguro para tu bebé.'
  },
  {
    id: '3280-MAT-CURSO-MATERNIDAD',
    curso_vida: 'materno_perinatal',
    nombre: 'Curso de Preparación para la Maternidad y la Paternidad',
    categoria: 'Protección Específica',
    codigo_procedimiento: '890218',
    frecuencia: '7 sesiones estructuradas desde el segundo trimestre',
    profesional: 'Equipo Interdisciplinario (Enfermería, Obstetricia, Psicología, Fisioterapia)',
    pagina_resolucion: 273,
    descripcion: 'Entrenamiento en signos de alarma obstétrica, trabajo de parto, analgesia, derechos del parto humanizado, lactancia materna exclusiva y puerperio.',
    canal_recomendado: 'whatsapp',
    guion_ia_base: 'Hola futura mamá {paciente}. Te invitamos a la próxima sesión de preparación para el nacimiento y lactancia materna con tu acompañante de elección.'
  },
  {
    id: '3280-MAT-ODONTO-GESTANTE',
    curso_vida: 'materno_perinatal',
    nombre: 'Valoración Odontológica y Manejo Periodontal de la Gestante',
    categoria: 'Protección Específica',
    codigo_procedimiento: '890219',
    frecuencia: '2 consultas durante el embarazo (primer y segundo trimestre)',
    profesional: 'Odontología Integral',
    pagina_resolucion: 275,
    descripcion: 'Control de placa bacteriana y gingivitis gravídica, evitando la translocación bacteriana vinculada a parto prematuro y bajo peso al nacer.',
    canal_recomendado: 'sms',
    guion_ia_base: 'Salud Oral Gestante: Protege tu encías y a tu bebé. Reclama tu turno odontológico de la Res. 3280 sin costo en tu centro médico.'
  }
];

export const getAll3280Programs = () => PROGRAMAS_Y_TAMIZAJES_3280;

export const get3280ProgramsByCourse = (courseId) => {
  if (!courseId || courseId === 'todos') return PROGRAMAS_Y_TAMIZAJES_3280;
  return PROGRAMAS_Y_TAMIZAJES_3280.filter(p => p.curso_vida === courseId);
};
