CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS doctor_password text;

CREATE INDEX IF NOT EXISTS idx_hospitals_lower_email
ON public.hospitals (lower(email));

CREATE INDEX IF NOT EXISTS idx_staff_lower_doctor_email
ON public.staff (lower(doctor_email));

CREATE INDEX IF NOT EXISTS idx_patients_lower_email
ON public.patients (lower(email));

ANALYZE public.hospitals;
ANALYZE public.staff;
ANALYZE public.patients;
