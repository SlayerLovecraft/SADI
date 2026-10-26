CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_hospitals_email
ON public.hospitals (email);

CREATE INDEX IF NOT EXISTS idx_patients_hospital_created_at
ON public.patients (hospital_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patients_hospital_program_created_at
ON public.patients (hospital_id, program, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patients_hospital_city_created_at
ON public.patients (hospital_id, city, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patients_email
ON public.patients (email);

CREATE INDEX IF NOT EXISTS idx_patients_document
ON public.patients (document);

CREATE INDEX IF NOT EXISTS gin_patients_name_trgm
ON public.patients USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gin_patients_document_trgm
ON public.patients USING gin (document gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gin_patients_phone_trgm
ON public.patients USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gin_patients_email_trgm
ON public.patients USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_staff_doctor_email
ON public.staff (doctor_email);

CREATE INDEX IF NOT EXISTS idx_staff_hospital_specialty_active
ON public.staff (hospital_id, doctor_specialty, is_active);

CREATE INDEX IF NOT EXISTS idx_campaigns_hospital_created_at
ON public.campaigns (hospital_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_hospital_estado
ON public.campaigns (hospital_id, estado);

CREATE INDEX IF NOT EXISTS idx_interactions_hospital_created_at
ON public.interactions (hospital_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_patient_created_at
ON public.interactions (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_hospital_estado_created_at
ON public.interactions (hospital_id, estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signos_vitales_paciente_fecha
ON public.signos_vitales (paciente_id, fecha DESC);

ANALYZE public.hospitals;
ANALYZE public.patients;
ANALYZE public.staff;
ANALYZE public.campaigns;
ANALYZE public.interactions;
ANALYZE public.signos_vitales;
