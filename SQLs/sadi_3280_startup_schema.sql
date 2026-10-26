-- ==============================================================================
-- SADI - SISTEMA DE APOYO PARA DEMANDA INDUCIDA & TELEMONITOREO (RES. 3280 DE 2018)
-- Script de Migración y Estructura Completa para Supabase PostgreSQL
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabla de Perfiles de Paciente Enriquecidos con Variables de la Res. 3280
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

CREATE INDEX IF NOT EXISTS idx_patient_profiles_curso_vida ON public.patient_profiles_3280(curso_vida);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_gestante ON public.patient_profiles_3280(es_gestante);

-- 2. Catálogo de Protocolos y Atenciones Obligatorias según Resolución 3280
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
  tipo_atencion TEXT NOT NULL CHECK (tipo_atencion IN ('valoracion_integral', 'tamizaje', 'proteccion_especifica', 'paraclinico')),
  descripcion TEXT NOT NULL,
  pagina_res_3280 INTEGER NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. Programación de Demanda Inducida y Adherencia por Paciente (Res. 3280)
CREATE TABLE IF NOT EXISTS public.rias_demand_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  protocol_id TEXT NOT NULL REFERENCES public.rias_protocols_3280(protocol_id) ON DELETE CASCADE,
  fecha_limite_atencion DATE NOT NULL,
  fecha_programada DATE NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'recordatorio_enviado', 'agendada', 'cumplida', 'inasistente', 'rechazada')),
  canal_recordatorio TEXT NOT NULL DEFAULT 'call_ia',
  intentos_contacto INTEGER NOT NULL DEFAULT 0,
  ultimo_contacto_at TIMESTAMPTZ NULL,
  motivo_inasistencia TEXT NULL,
  notas TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rias_demand_patient ON public.rias_demand_schedules(patient_id);
CREATE INDEX IF NOT EXISTS idx_rias_demand_estado ON public.rias_demand_schedules(estado);

-- 4. Registro de Mediciones de Equipos Caseros (Telemonitoreo RPM)
CREATE TABLE IF NOT EXISTS public.home_vital_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  tipo_medicion TEXT NOT NULL CHECK (tipo_medicion IN ('presion_arterial', 'glucometria', 'oximetria', 'peso_corporal')),
  -- Tensiometría
  presion_sistolica INTEGER NULL,
  presion_diastolica INTEGER NULL,
  pulso_bpm INTEGER NULL,
  pam_calculada NUMERIC(5,2) NULL, -- (2*diastolica + sistolica)/3
  -- Glucometría
  glucosa_mgdl NUMERIC(5,1) NULL,
  momento_glucometria TEXT NULL CHECK (momento_glucometria IS NULL OR momento_glucometria IN ('ayunas', 'postprandial_1h', 'postprandial_2h', 'antes_dormir')),
  -- Oximetría y Peso
  spo2_porcentaje INTEGER NULL,
  peso_kg NUMERIC(5,2) NULL,
  -- Metadatos del dispositivo
  dispositivo_modelo TEXT NULL,
  alerta_generada BOOLEAN NOT NULL DEFAULT FALSE,
  nivel_alerta TEXT NULL CHECK (nivel_alerta IS NULL OR nivel_alerta IN ('normal', 'alerta_amarilla', 'urgente_naranja', 'critica_roja')),
  medido_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_measurements_patient_fecha ON public.home_vital_measurements(patient_id, medido_at DESC);
CREATE INDEX IF NOT EXISTS idx_home_measurements_alerta ON public.home_vital_measurements(alerta_generada);

-- 5. Tabla de Alertas Clínicas por Desviación de Umbrales
CREATE TABLE IF NOT EXISTS public.clinical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  measurement_id UUID NULL REFERENCES public.home_vital_measurements(id) ON DELETE SET NULL,
  tipo_alerta TEXT NOT NULL,
  severidad TEXT NOT NULL CHECK (severidad IN ('critica_roja', 'urgente_naranja', 'alerta_amarilla')),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  criterio_res_3280 TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'contacto_ia_iniciado', 'intervenida_enfermeria', 'resuelta', 'derivada_urgencias')),
  ia_contact_disparado BOOLEAN NOT NULL DEFAULT FALSE,
  ia_contact_id UUID NULL,
  atendida_por_staff_id UUID NULL REFERENCES public.staff(doctor_id) ON DELETE SET NULL,
  notas_enfermeria TEXT NULL,
  fecha_resolucion TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_alerts_severidad ON public.clinical_alerts(severidad);
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_estado ON public.clinical_alerts(estado);

-- 6. Evidencias Auditables de Contacto con Agente IA / Multicanal
CREATE TABLE IF NOT EXISTS public.ai_contact_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  alert_id UUID NULL REFERENCES public.clinical_alerts(id) ON DELETE SET NULL,
  demand_schedule_id UUID NULL REFERENCES public.rias_demand_schedules(id) ON DELETE SET NULL,
  canal TEXT NOT NULL CHECK (canal IN ('call_ia', 'whatsapp', 'sms')),
  motivo_contacto TEXT NOT NULL CHECK (motivo_contacto IN ('alerta_umbral_critico', 'recordatorio_demanda_3280', 'adherencia_tratamiento', 'seguimiento_post_consulta')),
  telefono_destino TEXT NOT NULL,
  duracion_segundos INTEGER NOT NULL DEFAULT 0,
  grabacion_audio_url TEXT NULL,
  transcripcion_dialogo JSONB NOT NULL DEFAULT '[]'::JSONB,
  resumen_clinico_ia TEXT NOT NULL,
  resultado_contacto TEXT NOT NULL CHECK (resultado_contacto IN ('contactado_exitoso', 'requiere_intervencion_humana', 'no_contesta', 'numero_invalido', 'llamada_interrumpida')),
  paciente_confirmo_sintomas BOOLEAN NOT NULL DEFAULT FALSE,
  paciente_acepto_cita BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_evidence_patient ON public.ai_contact_evidence(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_evidence_motivo ON public.ai_contact_evidence(motivo_contacto);

-- 7. Intervenciones de Enfermería y Personal de Salud
CREATE TABLE IF NOT EXISTS public.nursing_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.clinical_alerts(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  staff_id UUID NULL REFERENCES public.staff(doctor_id) ON DELETE SET NULL,
  conducta_tomada TEXT NOT NULL CHECK (conducta_tomada IN ('educacion_paciente', 'reagendamiento_prioritario', 'ajuste_medicamento_ordenado', 'remision_urgencias', 'visita_domiciliaria', 'monitoreo_intensivo')),
  observaciones TEXT NOT NULL,
  seguimiento_programado_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- INSERCIÓN DE CATÁLOGO BASE DE LA RESOLUCIÓN 3280 DE 2018
-- ==============================================================================
INSERT INTO public.rias_protocols_3280 (protocol_id, nombre, curso_vida, edad_minima_meses, edad_maxima_meses, sexo_aplicable, frecuencia_meses, requiere_embarazo, profesional_requerido, tipo_atencion, descripcion, pagina_res_3280)
VALUES
-- Primera Infancia
('3280-PI-VAL', 'Valoración Integral de Primera Infancia', 'primera_infancia', 0, 71, 'ambos', 3, FALSE, 'Medicina General / Pediatría / Enfermería', 'valoracion_integral', 'Valoración física, tamizajes del desarrollo (EAD-3), crecimiento y salud bucal', 105),
('3280-PI-FLUOR', 'Aplicación de Barniz de Flúor en Primera Infancia', 'primera_infancia', 12, 71, 'ambos', 6, FALSE, 'Odontología / Higiene Bucal', 'proteccion_especifica', 'Aplicación semestral de barniz de flúor para prevención de caries', 162),
('3280-PI-MICRONUT', 'Micronutrientes en Polvo (Chispitas)', 'primera_infancia', 6, 24, 'ambos', 6, FALSE, 'Enfermería / Medicina', 'proteccion_especifica', 'Entrega y seguimiento de dos ciclos de 60 sobres de micronutrientes en polvo', 195),
-- Infancia
('3280-INF-VAL', 'Valoración Integral de la Infancia', 'infancia', 72, 143, 'ambos', 12, FALSE, 'Medicina General / Pediatría / Enfermería', 'valoracion_integral', 'Control anual de crecimiento, desarrollo y aprendizaje', 115),
('3280-INF-VIS', 'Tamizaje de Agudeza Visual a los 11 Años', 'infancia', 132, 143, 'ambos', 12, FALSE, 'Medicina General / Optometría / Enfermería', 'tamizaje', 'Tamizaje obligatorio de agudeza visual a los 11 años con optotipos estandarizados', 119),
-- Adolescencia
('3280-ADO-VAL', 'Valoración Integral de la Adolescencia', 'adolescencia', 144, 215, 'ambos', 12, FALSE, 'Medicina General / Familiar / Enfermería', 'valoracion_integral', 'Evaluación psicosocial (ASSIST, AUDIT, violencia), sexual y reproductiva', 123),
('3280-ADO-VIS', 'Tamizaje de Agudeza Visual a los 16 Años', 'adolescencia', 192, 203, 'ambos', 12, FALSE, 'Medicina General / Optometría / Enfermería', 'tamizaje', 'Tamizaje obligatorio de agudeza visual a los 16 años', 128),
-- Adultez & Detección Temprana de Cáncer
('3280-CA-CERVIX-CITO', 'Tamizaje Ca Cuello Uterino con Citología (25-29 años)', 'adultez', 300, 359, 'femenino', 36, FALSE, 'Enfermería / Medicina', 'tamizaje', 'Citología de cuello uterino con esquema 1-3-3 ante resultados negativos', 168),
('3280-CA-CERVIX-VPH', 'Tamizaje Ca Cuello Uterino con ADN-VPH (30-65 años)', 'adultez', 360, 780, 'femenino', 60, FALSE, 'Enfermería / Medicina', 'tamizaje', 'Prueba molecular de ADN-VPH cada 5 años (esquema 1-5-5)', 168),
('3280-CA-MAMA-CLINICO', 'Examen Clínico de Mama Anual (40+ años)', 'adultez', 480, 840, 'femenino', 12, FALSE, 'Medicina General / Especialista', 'tamizaje', 'Examen clínico anual de glándula mamaria y cadenas ganglionares', 173),
('3280-CA-MAMA-MAMO', 'Mamografía Bilateral cada 2 Años (50-69 años)', 'adultez', 600, 839, 'femenino', 24, FALSE, 'Radiología / Medicina', 'tamizaje', 'Mamografía bilateral de dos proyecciones cada 2 años', 173),
('3280-CA-PROSTATA', 'Tamizaje Ca de Próstata (PSA + Tacto Rectal 50-79 años)', 'adultez', 600, 959, 'masculino', 60, FALSE, 'Medicina General / Urología', 'tamizaje', 'Antígeno prostático específico y tacto rectal cada 5 años (o 40 con riesgo)', 175),
('3280-CA-COLON', 'Sangre Oculta en Materia Fecal FIT (50-75 años)', 'adultez', 600, 900, 'ambos', 24, FALSE, 'Bacteriología / Laboratorio Clínico', 'tamizaje', 'Test inmunoquímico cuantitativo o cualitativo de sangre oculta en heces cada 2 años', 178),
('3280-RCV-FINDRISC', 'Evaluación de Riesgo Cardiovascular & Diabetes (FINDRISC)', 'adultez', 348, 1440, 'ambos', 60, FALSE, 'Medicina General / Familiar', 'tamizaje', 'Cálculo de Framingham a 10 años, FINDRISC, perfil lipídico, glicemia y creatinina cada 5 años', 144),
-- Ruta Materno Perinatal
('3280-MAT-PRENATAL', 'Control Prenatal Integral', 'adultez', 120, 600, 'femenino', 1, TRUE, 'Medicina General / Obstetricia / Enfermería', 'valoracion_integral', 'Control mensual hasta sem 36, quincenal hasta sem 38, semanal hasta el parto', 263),
('3280-MAT-ECOGRAFIA', 'Ecografía de Detalle Anatómico Fetal (18-24 sem)', 'adultez', 120, 600, 'femenino', 6, TRUE, 'Ginecología / Radiología', 'paraclinico', 'Ecografía de detalle para malformaciones estructurales y biometría fetal', 268)
ON CONFLICT (protocol_id) DO NOTHING;
