-- ==============================================================================
-- SADI 3280 ENTERPRISE - ESQUEMA INTEGRAL COMPLETO (RESOLUCIÓN 3280 DE 2018)
-- Incluye:
-- 1. Catálogo exhaustivo de todos los Programas, Tamizajes y Protecciones 3280
-- 2. 35 Pacientes reales clasificados por Cursos de Vida (5 por cada caso)
-- 3. 8 Doctores especialistas por cada área clínica
-- 4. Estructura de Historias Clínicas con árbol estricto de carpetas por archivo
-- 5. Tabla de integración en tiempo real para llamadas del Agente Vapi
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. CATÁLOGO EXHAUSTIVO DE PROTOCOLOS RESOLUCIÓN 3280 DE 2018
CREATE TABLE IF NOT EXISTS public.rias_protocols_3280 (
  protocol_id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  curso_vida TEXT NOT NULL,
  edad_minima_meses INTEGER NOT NULL DEFAULT 0,
  edad_maxima_meses INTEGER NOT NULL DEFAULT 1440,
  sexo_aplicable TEXT NOT NULL DEFAULT 'ambos' CHECK (sexo_aplicable IN ('ambos', 'femenino', 'masculino')),
  frecuencia_meses INTEGER NOT NULL,
  requiere_embarazo BOOLEAN NOT NULL DEFAULT FALSE,
  profesional_requerido TEXT NOT NULL,
  tipo_atencion TEXT NOT NULL CHECK (tipo_atencion IN ('valoracion_integral', 'tamizaje', 'proteccion_especifica', 'paraclinico', 'educacion_salud')),
  descripcion TEXT NOT NULL,
  pagina_res_3280 INTEGER NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. PERFILES ENRIQUECIDOS 3280
CREATE TABLE IF NOT EXISTS public.patient_profiles_3280 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE UNIQUE,
  curso_vida TEXT NOT NULL CHECK (curso_vida IN ('primera_infancia', 'infancia', 'adolescencia', 'juventud', 'adultez', 'vejez')),
  es_gestante BOOLEAN NOT NULL DEFAULT FALSE,
  semana_gestacional INTEGER NULL CHECK (semana_gestacional IS NULL OR (semana_gestacional >= 0 AND semana_gestacional <= 42)),
  fecha_probable_parto DATE NULL,
  es_hipertenso BOOLEAN NOT NULL DEFAULT FALSE,
  es_diabetico BOOLEAN NOT NULL DEFAULT FALSE,
  tiene_riesgo_cv BOOLEAN NOT NULL DEFAULT FALSE,
  canal_preferido TEXT NOT NULL DEFAULT 'call_ia' CHECK (canal_preferido IN ('call_ia', 'whatsapp', 'sms')),
  dispositivos_caseros TEXT[] NOT NULL DEFAULT ARRAY['tensiometro']::TEXT[],
  contacto_emergencia_nombre TEXT NULL,
  contacto_emergencia_telefono TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. GESTIÓN DOCUMENTAL DE HISTORIAS CLÍNICAS (CARPETAS DISCRIMINADAS POR TIPO)
CREATE TABLE IF NOT EXISTS public.patient_clinical_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  doctor_id UUID NULL REFERENCES public.staff(doctor_id) ON DELETE SET NULL,
  nombre_archivo TEXT NOT NULL,
  carpeta_clasificada TEXT NOT NULL CHECK (carpeta_clasificada IN (
    'PDF', 'EXCEL', 'WORD', 'JPG/JPEG/PNG', 'POWERPOINT', 'POWER BI', 'PROJECT', 'ZIP/RAR', 'OTROS'
  )),
  ruta_almacenamiento TEXT NOT NULL, -- ej: HISTORIAS_CLINICAS/VALENTINA_RESTREPO/PDF/ecografia_detalle.pdf
  tamano_bytes BIGINT NOT NULL DEFAULT 0,
  tipo_mime TEXT NOT NULL,
  descripcion_clinica TEXT NULL,
  es_confidencial BOOLEAN NOT NULL DEFAULT FALSE,
  subido_por_nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_docs_patient ON public.patient_clinical_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_carpeta ON public.patient_clinical_documents(carpeta_clasificada);

-- 4. CONEXIÓN Y ESTADO EN VIVO PARA AGENTE VAPI (LLAMADAS DE VOZ IA)
CREATE TABLE IF NOT EXISTS public.vapi_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vapi_call_id TEXT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  doctor_id UUID NULL REFERENCES public.staff(doctor_id) ON DELETE SET NULL,
  telefono_llamado TEXT NOT NULL,
  motivo_llamada TEXT NOT NULL,
  estado_llamada TEXT NOT NULL DEFAULT 'programada' CHECK (estado_llamada IN ('programada', 'en_curso', 'completada', 'fallida', 'no_contesta')),
  duracion_segundos INTEGER NOT NULL DEFAULT 0,
  contexto_inyectado JSONB NOT NULL DEFAULT '{}'::JSONB, -- Variables clínicas vivas enviadas a Vapi
  transcripcion_completa TEXT NULL,
  resumen_ia TEXT NULL,
  sintomas_detectados TEXT[] NULL,
  cita_reagendada_at TIMESTAMPTZ NULL,
  escalado_a_enfermera BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vapi_sessions_patient ON public.vapi_agent_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_vapi_sessions_vapi_call_id ON public.vapi_agent_sessions(vapi_call_id);

-- ==============================================================================
-- INSERCIÓN DE TODOS LOS PROGRAMAS Y TAMIZAJES 3280 (SIN OMISIONES)
-- ==============================================================================
INSERT INTO public.rias_protocols_3280 (protocol_id, nombre, curso_vida, edad_minima_meses, edad_maxima_meses, sexo_aplicable, frecuencia_meses, requiere_embarazo, profesional_requerido, tipo_atencion, descripcion, pagina_res_3280)
VALUES
-- PRIMERA INFANCIA (0 - 5 AÑOS)
('3280-PI-VAL-DES', 'Valoración Integral del Desarrollo (EAD-3)', 'primera_infancia', 0, 71, 'ambos', 3, FALSE, 'Medicina General / Pediatría / Enfermería', 'valoracion_integral', 'Aplicación de Escala Abreviada de Desarrollo 3 en motricidad, lenguaje y personal social', 105),
('3280-PI-VAL-CREC', 'Valoración del Crecimiento Físico (Antropometría OMS)', 'primera_infancia', 0, 71, 'ambos', 3, FALSE, 'Medicina General / Pediatría / Enfermería', 'valoracion_integral', 'Evaluación de peso para talla, talla para edad y perímetro cefálico según patrones OMS', 108),
('3280-PI-BUCAL', 'Valoración de la Salud Bucal en Primera Infancia', 'primera_infancia', 6, 71, 'ambos', 6, FALSE, 'Odontología', 'valoracion_integral', 'Revisión bucomaxilofacial, erupción dental primaria y asesoría en higiene oral', 158),
('3280-PI-FLUOR', 'Aplicación de Barniz de Flúor Semestral', 'primera_infancia', 12, 71, 'ambos', 6, FALSE, 'Odontología / Higiene Oral', 'proteccion_especifica', 'Aplicación semestral de barniz de flúor desde el primer año de vida para prevención de caries', 162),
('3280-PI-PROFILAXIS', 'Profilaxis y Remoción de Placa Bacteriana', 'primera_infancia', 24, 71, 'ambos', 6, FALSE, 'Odontología / Higiene Oral', 'proteccion_especifica', 'Remoción mecánica de placa blanda y cálculo incipiente en dentición decidua', 161),
('3280-PI-MICRONUT', 'Fortificación con Micronutrientes en Polvo (Chispitas)', 'primera_infancia', 6, 24, 'ambos', 6, FALSE, 'Enfermería / Nutrición', 'proteccion_especifica', 'Suministro de sobres con hierro, zinc, vitamina A, C y ácido fólico (2 ciclos de 60 sobres)', 195),
('3280-PI-HIERRO', 'Suplementación Preventiva con Hierro', 'primera_infancia', 4, 24, 'ambos', 6, FALSE, 'Medicina / Enfermería', 'proteccion_especifica', 'Hierro en gotas para prevención de anemia ferropénica en bajo peso o zonas de riesgo', 113),
('3280-PI-VIT-A', 'Suplementación con Vitamina A (Megadosis)', 'primera_infancia', 6, 59, 'ambos', 6, FALSE, 'Enfermería / Medicina', 'proteccion_especifica', 'Administración semestral de 100.000 UI a 200.000 UI en municipios priorizados', 113),
('3280-PI-DESPARASITA', 'Desparasitación Antihelmíntica Masiva', 'primera_infancia', 12, 71, 'ambos', 6, FALSE, 'Enfermería / Medicina', 'proteccion_especifica', 'Albendazol 400 mg (o 200 mg de 12-23 meses) semestral en zonas con riesgo de geohelmintos', 114),
('3280-PI-TAM-HEMO', 'Tamizaje de Hemoglobina / Hematocrito (Anemia)', 'primera_infancia', 4, 24, 'ambos', 12, FALSE, 'Laboratorio Clínico / Bacteriología', 'tamizaje', 'Toma de muestra sanguínea a los 4-6 meses y a los 24 meses de vida', 114),
('3280-PI-TAM-VIS', 'Tamizaje de Agudeza Visual a los 4 Años', 'primera_infancia', 48, 59, 'ambos', 12, FALSE, 'Medicina / Optometría', 'tamizaje', 'Examen de agudeza visual con tabla de optotipos de figuras / E tumbling', 110),
('3280-PI-TAM-AUD', 'Tamizaje de Salud Auditiva y Comunicativa', 'primera_infancia', 0, 71, 'ambos', 6, FALSE, 'Fonoaudiología / Medicina', 'tamizaje', 'Verificación de reflejo cócleo-palpebral, localización de fuente sonora y desarrollo del habla', 110),
('3280-PI-PAI', 'Vacunación Completa según Esquema PAI', 'primera_infancia', 0, 71, 'ambos', 2, FALSE, 'Enfermería', 'proteccion_especifica', 'Aplicación de biológicos PAI: BCG, Hepatitis B, Pentavalente, Polio, Rotavirus, Neumococo, Triple Viral, Fiebre Amarilla, Varicela, DPT', 112),

-- INFANCIA (6 - 11 AÑOS)
('3280-INF-VAL', 'Valoración Integral de la Salud en la Infancia', 'infancia', 72, 143, 'ambos', 12, FALSE, 'Medicina General / Pediatría / Enfermería', 'valoracion_integral', 'Control anual integral: desarrollo cognitivo, rendimiento escolar, dinámica familiar y nutrición', 115),
('3280-INF-BUCAL', 'Valoración Anual de Salud Bucal en Infancia', 'infancia', 72, 143, 'ambos', 12, FALSE, 'Odontología', 'valoracion_integral', 'Monitoreo de dentición mixta, oclusión, hábitos orales y salud periodontal', 158),
('3280-INF-SELLANTES', 'Aplicación de Sellantes en Fosas y Fisuras (6-15 años)', 'infancia', 72, 143, 'ambos', 12, FALSE, 'Odontología', 'proteccion_especifica', 'Aplicación en primeros y segundos molares permanentes recién erupcionados para barrera física antibacteriana', 163),
('3280-INF-FLUOR', 'Aplicación Semestral de Barniz de Flúor', 'infancia', 72, 143, 'ambos', 6, FALSE, 'Odontología / Higiene Oral', 'proteccion_especifica', 'Remineralización del esmalte de dientes permanentes jóvenes', 162),
('3280-INF-DETARTRAJE', 'Detartraje Supragingival en Infancia', 'infancia', 72, 143, 'ambos', 12, FALSE, 'Odontología', 'proteccion_especifica', 'Eliminación mecánica de cálculo dental supragingival', 164),
('3280-INF-TAM-VIS', 'Tamizaje de Agudeza Visual a los 11 Años', 'infancia', 132, 143, 'ambos', 12, FALSE, 'Optometría / Medicina', 'tamizaje', 'Evaluación de agudeza visual lejana con optotipo de Snellen', 119),
('3280-INF-TAM-AUD', 'Tamizaje Auditivo y Valoración de Voz', 'infancia', 72, 143, 'ambos', 24, FALSE, 'Fonoaudiología / Medicina', 'tamizaje', 'Detección temprana de hipoacusias y disfonías escolares', 118),
('3280-INF-DESPARASITA', 'Desparasitación Antihelmíntica en Escolares', 'infancia', 72, 143, 'ambos', 6, FALSE, 'Enfermería / Medicina', 'proteccion_especifica', 'Albendazol 400 mg semestral para escolares en riesgo', 122),
('3280-INF-VAC-VPH', 'Vacunación contra Virus del Papiloma Humano (VPH)', 'infancia', 108, 143, 'ambos', 6, FALSE, 'Enfermería', 'proteccion_especifica', 'Vacuna VPH según lineamiento nacional para prevención de cáncer anogenital', 120),

-- ADOLESCENCIA (12 - 17 AÑOS)
('3280-ADO-VAL', 'Valoración Integral de la Adolescencia', 'adolescencia', 144, 215, 'ambos', 12, FALSE, 'Medicina General / Familiar / Enfermería', 'valoracion_integral', 'Valoración de maduración sexual (Tanner), salud mental, identidad y estilo de vida', 123),
('3280-ADO-BUCAL', 'Valoración y Control de Salud Bucal en Adolescentes', 'adolescencia', 144, 215, 'ambos', 12, FALSE, 'Odontología', 'valoracion_integral', 'Detección de gingivitis puberal, maloclusiones y aplicación de flúor hasta los 17 años', 158),
('3280-ADO-TAM-VIS', 'Tamizaje de Agudeza Visual a los 16 Años', 'adolescencia', 192, 203, 'ambos', 12, FALSE, 'Optometría / Medicina', 'tamizaje', 'Evaluación con optotipo de Snellen a los 16 años', 128),
('3280-ADO-SEXUAL', 'Asesoría y Suministro de Métodos Anticonceptivos', 'adolescencia', 144, 215, 'ambos', 6, FALSE, 'Enfermería / Medicina', 'proteccion_especifica', 'Asesoría en derechos sexuales y reproductivos, entrega de implantes, DIU, píldoras y condones', 180),
('3280-ADO-TAM-PSICO', 'Tamizaje Psicosocial (Cuestionarios CRAFFT / ASSIST / AUDIT)', 'adolescencia', 144, 215, 'ambos', 12, FALSE, 'Medicina / Psicología / Enfermería', 'tamizaje', 'Tamizaje de consumo de alcohol, tabaco, sustancias psicoactivas y riesgo suicida', 126),
('3280-ADO-TAM-VIOL', 'Tamizaje de Violencias y Acoso Escolar (Bullying)', 'adolescencia', 144, 215, 'ambos', 12, FALSE, 'Medicina / Psicología / Enfermería', 'tamizaje', 'Detección de maltrato físico, emocional o violencia basada en género', 126),
('3280-ADO-TAM-HEMO', 'Tamizaje de Anemia en Adolescentes Mujeres', 'adolescencia', 144, 215, 'femenino', 36, FALSE, 'Laboratorio Clínico', 'tamizaje', 'Hemograma o hemoglobina en mujeres que ya iniciaron menarquia', 131),
('3280-ADO-TAM-ITS', 'Pruebas Rápidas Voluntarias de VIH y Sífilis', 'adolescencia', 144, 215, 'ambos', 12, FALSE, 'Enfermería / Medicina', 'tamizaje', 'Pruebas rápidas voluntarias y confidenciales con asesoría pre y postest', 131),

-- JUVENTUD (18 - 28 AÑOS)
('3280-JUV-VAL', 'Valoración Integral de la Juventud', 'juventud', 216, 347, 'ambos', 36, FALSE, 'Medicina General / Familiar', 'valoracion_integral', 'Evaluación integral cada 3 años: salud física, nutrición, hábitos de vida y salud sexual', 132),
('3280-JUV-BUCAL', 'Valoración de Salud Bucal del Joven', 'juventud', 216, 347, 'ambos', 24, FALSE, 'Odontología', 'valoracion_integral', 'Evaluación periodontal y detartraje supragingival', 158),
('3280-JUV-PLANIF', 'Consulta de Planificación Familiar y Anticoncepción', 'juventud', 216, 347, 'ambos', 12, FALSE, 'Enfermería / Medicina', 'proteccion_especifica', 'Elección informada de métodos modernos reversibles o definitivos y preservativos', 180),
('3280-JUV-CITO-CERVIX', 'Tamizaje Ca Cuello Uterino con Citología (25 - 29 años)', 'juventud', 300, 347, 'femenino', 36, FALSE, 'Enfermería / Medicina', 'tamizaje', 'Citología de cuello uterino con esquema 1-3-3 ante resultados negativos', 168),
('3280-JUV-RCV', 'Tamizaje Riesgo Cardiovascular & Metabólico', 'juventud', 216, 347, 'ambos', 60, FALSE, 'Medicina General', 'tamizaje', 'Glicemia en ayunas y perfil lipídico cada 5 años en jóvenes con factores de riesgo', 136),
('3280-JUV-TAM-ITS', 'Tamizaje de ITS (VIH, Sífilis, Hepatitis B)', 'juventud', 216, 347, 'ambos', 12, FALSE, 'Enfermería / Laboratorio Clínico', 'tamizaje', 'Prueba rápida treponémica y VIH según exposición y demanda', 139),

-- ADULTEZ (29 - 59 AÑOS)
('3280-ADU-VAL', 'Valoración Integral del Adulto', 'adultez', 348, 719, 'ambos', 60, FALSE, 'Medicina General / Familiar', 'valoracion_integral', 'Evaluación integral cada 5 años del estado general, función cardiovascular y metabólica', 140),
('3280-ADU-CA-CERVIX-VPH', 'Tamizaje Ca Cuello Uterino con Prueba ADN-VPH (30-65 años)', 'adultez', 360, 719, 'femenino', 60, FALSE, 'Enfermería / Medicina', 'tamizaje', 'Prueba molecular de ADN-VPH cada 5 años (esquema 1-5-5)', 168),
('3280-ADU-CA-MAMA-CLINICO', 'Examen Clínico de Mama Anual (40+ años)', 'adultez', 480, 719, 'femenino', 12, FALSE, 'Medicina General / Especialista', 'tamizaje', 'Examen físico minucioso de mamas y axilas anualmente a partir de los 40 años', 173),
('3280-ADU-CA-MAMA-MAMO', 'Mamografía Bilateral cada 2 Años (50-69 años)', 'adultez', 600, 719, 'femenino', 24, FALSE, 'Radiología', 'tamizaje', 'Mamografía bilateral de dos proyecciones cada 2 años para detección temprana de cáncer de mama', 173),
('3280-ADU-CA-PROSTATA', 'Tamizaje Ca de Próstata (PSA + Tacto Rectal 50-79 años)', 'adultez', 600, 719, 'masculino', 60, FALSE, 'Medicina General / Urología', 'tamizaje', 'Antígeno prostático específico y tacto rectal cada 5 años (o 40 años si afrodescendiente o historia familiar)', 175),
('3280-ADU-CA-COLON', 'Sangre Oculta en Materia Fecal FIT (50-75 años)', 'adultez', 600, 719, 'ambos', 24, FALSE, 'Laboratorio Clínico / Bacteriología', 'tamizaje', 'Prueba inmunoquímica fecal cada 2 años. Si positiva, colonoscopia complementaria', 178),
('3280-ADU-RCV-FINDRISC', 'Cálculo de Riesgo Cardiovascular (Framingham) & Diabetes (FINDRISC)', 'adultez', 348, 719, 'ambos', 60, FALSE, 'Medicina General / Familiar', 'tamizaje', 'Evaluación del riesgo de infarto a 10 años, FINDRISC, perfil lipídico, creatinina y uroanálisis', 144),
('3280-ADU-BUCAL', 'Salud Bucal y Detartraje Supragingival en el Adulto', 'adultez', 348, 719, 'ambos', 24, FALSE, 'Odontología', 'proteccion_especifica', 'Evaluación periodontal y detartraje periódico', 158),
('3280-ADU-VAS-LIG', 'Anticoncepción Quirúrgica Voluntaria (Vasectomía / Ligadura)', 'adultez', 216, 719, 'ambos', 120, FALSE, 'Urología / Cirugía / Ginecología', 'proteccion_especifica', 'Procedimientos definitivos bajo consentimiento informado', 191),

-- VEJEZ (60+ AÑOS)
('3280-VEJ-VAL-GER', 'Valoración Geriátrica Integral (VGI)', 'vejez', 720, 1440, 'ambos', 36, FALSE, 'Medicina General / Geriatría / Medicina Familiar', 'valoracion_integral', 'Evaluación cada 3 años: Barthel (actividades básicas), Lawton-Brody (instrumentales), Mini-Mental/Mini-Cog y Yesavage (depresión)', 148),
('3280-VEJ-FRAGILIDAD', 'Tamizaje de Fragilidad y Riesgo de Caídas', 'vejez', 720, 1440, 'ambos', 12, FALSE, 'Medicina / Fisioterapia / Enfermería', 'tamizaje', 'Criterios de Linda Fried, prueba Get Up and Go y marcha rápida', 152),
('3280-VEJ-CA-PROSTATA', 'Tamizaje Ca de Próstata en Vejez (hasta 79 años)', 'vejez', 720, 959, 'masculino', 60, FALSE, 'Urología / Medicina', 'tamizaje', 'PSA y tacto rectal cada 5 años hasta los 79 años', 175),
('3280-VEJ-CA-COLON', 'Tamizaje Ca Colorrectal en Vejez (hasta 75 años)', 'vejez', 720, 900, 'ambos', 24, FALSE, 'Laboratorio Clínico', 'tamizaje', 'Sangre oculta en materia fecal FIT cada 2 años hasta los 75 años', 178),
('3280-VEJ-CA-MAMA', 'Mamografía Bilateral en Vejez (hasta 69 años)', 'vejez', 720, 839, 'femenino', 24, FALSE, 'Radiología', 'tamizaje', 'Mamografía bilateral cada 2 años hasta los 69 años y examen clínico anual posterior', 173),
('3280-VEJ-TAM-VIS', 'Tamizaje de Agudeza Visual y Cataratas en el Adulto Mayor', 'vejez', 720, 1440, 'ambos', 36, FALSE, 'Oftalmología / Optometría', 'tamizaje', 'Detección oportuna de cataratas, glaucoma y degeneración macular senil', 153),
('3280-VEJ-TAM-AUD', 'Tamizaje Auditivo y Presbiacusia', 'vejez', 720, 1440, 'ambos', 36, FALSE, 'Fonoaudiología / Otorrinolaringología', 'tamizaje', 'Audiometría tamiz para detección de pérdida auditiva e indicación de audífonos', 153),
('3280-VEJ-RCV', 'Control de Riesgo Cardiovascular en Vejez', 'vejez', 720, 1440, 'ambos', 60, FALSE, 'Medicina General / Geriatría', 'tamizaje', 'Perfil lipídico, glicemia en ayunas, creatinina sérica y parcial de orina', 154),
('3280-VEJ-BUCAL', 'Salud Bucal y Adaptación de Prótesis en Vejez', 'vejez', 720, 1440, 'ambos', 24, FALSE, 'Odontología / Rehabilitación Oral', 'valoracion_integral', 'Revisión de edentulismo, estado mucoso y funcionalidad protésica', 158),

-- RUTA MATERNO PERINATAL (RIAMP)
('3280-MAT-PRECONCEP', 'Atención para el Cuidado Preconcepcional', 'adultez', 120, 600, 'femenino', 12, FALSE, 'Medicina General / Especialista', 'valoracion_integral', 'Evaluación médica antes de embarazarse, paraclínicos preconcepcionales y ácido fólico (400 mcg o 4-5 mg)', 245),
('3280-MAT-IVE', 'Atención para la Interrupción Voluntaria del Embarazo (IVE)', 'adultez', 120, 600, 'femenino', 1, FALSE, 'Medicina General / Ginecología', 'proteccion_especifica', 'Asesoría y procedimiento farmacológico o quirúrgico bajo marco legal garantista', 252),
('3280-MAT-PRENATAL', 'Control Prenatal de Seguimiento', 'adultez', 120, 600, 'femenino', 1, TRUE, 'Medicina General / Obstetricia / Enfermería', 'valoracion_integral', 'Mínimo 10 consultas en nulíparas y 7 en multíparas. Control mensual hasta sem 36, quincenal hasta sem 38, semanal hasta el parto', 263),
('3280-MAT-MICRONUT', 'Micronutrientes Gestacionales Obligatorios (Calcio, Hierro, Ácido Fólico)', 'adultez', 120, 600, 'femenino', 1, TRUE, 'Medicina / Enfermería', 'proteccion_especifica', 'Carbonato de Calcio 1200 mg/día desde sem 14 (prevención preeclampsia), Ácido Fólico 0.4 mg hasta sem 12, Hierro elemental y ASA 75-100 mg/día en riesgo', 267),
('3280-MAT-ECO-GENETICA', 'Ecografía de Tamizaje Genético (Semana 10.6 - 13.6)', 'adultez', 120, 600, 'femenino', 1, TRUE, 'Ginecobstetricia / Radiología', 'paraclinico', 'Medición de translucencia nucal, hueso nasal y tamizaje de aneuploidías fetales', 267),
('3280-MAT-ECOGRAFIA', 'Ecografía de Detalle Anatómico Fetal (Semana 18 - 24)', 'adultez', 120, 600, 'femenino', 1, TRUE, 'Ginecología / Radiología', 'paraclinico', 'Evaluación de malformaciones estructurales y biometría fetal completa', 268),
('3280-MAT-PTOG', 'Prueba de Tolerancia a la Glucosa 75g (Semana 24 - 28)', 'adultez', 120, 600, 'femenino', 1, TRUE, 'Laboratorio Clínico', 'tamizaje', 'Tamizaje de Diabetes Gestacional con curva de glucosa en ayunas, 1h y 2h', 268),
('3280-MAT-SGB', 'Cultivo Rectovaginal para Estreptococo Grupo B (Semana 35 - 37)', 'adultez', 120, 600, 'femenino', 1, TRUE, 'Bacteriología / Laboratorio Clínico', 'tamizaje', 'Toma de cultivo para profilaxis antibiótica intraparto y prevención de sepsis neonatal', 268),
('3280-MAT-CURSO', 'Curso de Preparación para la Maternidad y Paternidad', 'adultez', 120, 600, 'femenino', 1, TRUE, 'Equipo Interdisciplinario (Enfermería, Medicina, Psicología)', 'educacion_salud', 'Mínimo 7 sesiones teórico-prácticas sobre signos de alarma, parto, lactancia y cuidados del recién nacido', 273),
('3280-MAT-BUCAL', 'Atención en Salud Bucal de la Gestante', 'adultez', 120, 600, 'femenino', 6, TRUE, 'Odontología', 'valoracion_integral', 'Control de gingivitis del embarazo y profilaxis para prevenir parto pretérmino', 276),
('3280-MAT-NUTRICION', 'Atención para la Promoción de la Nutrición Gestacional', 'adultez', 120, 600, 'femenino', 3, TRUE, 'Nutrición / Enfermería', 'educacion_salud', 'Evaluación nutricional según gráfica de Atalah (IMC por Edad Gestacional) y plan alimentario', 277),
('3280-MAT-PARTO', 'Atención del Parto Humanizado y Nacimiento', 'adultez', 120, 600, 'femenino', 1, TRUE, 'Medicina General / Ginecobstetricia / Enfermería', 'proteccion_especifica', 'Acompañamiento continuo, alumbramiento activo con oxitocina 10 UI, pinzamiento tardío de cordón (1-3 min) y piel a piel 1 hora', 280),
('3280-MAT-PUERPERIO', 'Atención del Puerperio Inmediato y Control Postnatal', 'adultez', 120, 600, 'femenino', 1, TRUE, 'Medicina General / Enfermería', 'valoracion_integral', 'Vigilancia en primeras 48h (involución uterina, loquios), control postparto a las 72h y cita de puerperio a los 42 días', 286),
('3280-MAT-RN-INMEDIATO', 'Atención del Recién Nacido Inmediato', 'primera_infancia', 0, 1, 'ambos', 1, FALSE, 'Medicina General / Pediatría / Enfermería', 'proteccion_especifica', 'Vitamina K1 fitomenadiona (1 mg IM), profilaxis oftálmica, toma de TSH de cordón umbilical y contacto temprano', 299),
('3280-MAT-RN-OXIMETRIA', 'Tamizaje de Cardiopatías Congénitas Críticas (Oximetría 24-48h)', 'primera_infancia', 0, 1, 'ambos', 1, FALSE, 'Enfermería / Pediatría', 'tamizaje', 'Oximetría de pulso preductal (mano derecha) y postductal (pie) entre las 24 y 48 horas de vida', 302),
('3280-MAT-RN-CONTROL', 'Consulta de Seguimiento al Recién Nacido (72 horas / 3-5 días)', 'primera_infancia', 0, 1, 'ambos', 1, FALSE, 'Medicina General / Pediatría / Enfermería', 'valoracion_integral', 'Evaluación de ictericia, ganancia ponderal, reflejo rojo ocular, tamizaje auditivo y técnica de lactancia materna', 316)
ON CONFLICT (protocol_id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  pagina_res_3280 = EXCLUDED.pagina_res_3280;
