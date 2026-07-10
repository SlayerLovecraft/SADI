CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.clinical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  hospital_id UUID NULL REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL,
  doctor_id UUID NULL REFERENCES public.staff(doctor_id) ON DELETE SET NULL,
  doctor_name TEXT NULL,
  doctor_specialty TEXT NULL,
  record_type TEXT NOT NULL DEFAULT 'Registro clínico',
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NULL,
  attachment_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinical_records_patient_date_idx ON public.clinical_records(patient_id, record_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS clinical_records_hospital_idx ON public.clinical_records(hospital_id);
CREATE INDEX IF NOT EXISTS clinical_records_doctor_idx ON public.clinical_records(doctor_id);

ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all clinical_records" ON public.clinical_records;
DROP POLICY IF EXISTS "Allow insert access to clinical_records" ON public.clinical_records;
DROP POLICY IF EXISTS "Allow update access to clinical_records" ON public.clinical_records;
DROP POLICY IF EXISTS "Allow delete access to clinical_records" ON public.clinical_records;

CREATE POLICY "Allow read access to all clinical_records"
ON public.clinical_records
FOR SELECT
TO anon, authenticated
USING ( true );

CREATE POLICY "Allow insert access to clinical_records"
ON public.clinical_records
FOR INSERT
TO anon, authenticated
WITH CHECK ( true );

CREATE POLICY "Allow update access to clinical_records"
ON public.clinical_records
FOR UPDATE
TO anon, authenticated
USING ( true )
WITH CHECK ( true );

CREATE POLICY "Allow delete access to clinical_records"
ON public.clinical_records
FOR DELETE
TO anon, authenticated
USING ( true );

GRANT ALL ON TABLE public.clinical_records TO anon, authenticated;
