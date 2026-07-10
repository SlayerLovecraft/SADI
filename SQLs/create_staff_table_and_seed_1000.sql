CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.doctor_login(TEXT, TEXT);
DROP TABLE IF EXISTS public.staff CASCADE;

CREATE TABLE public.staff (
  doctor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_name TEXT NULL,
  doctor_email TEXT NOT NULL UNIQUE,
  doctor_password TEXT NOT NULL,
  doctor_specialty TEXT NOT NULL,
  hospital_id UUID NULL REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_specialty_idx ON public.staff(doctor_specialty);
CREATE INDEX IF NOT EXISTS staff_hospital_idx ON public.staff(hospital_id);

WITH specialty_list AS (
  SELECT ARRAY[
    'cardiologo',
    'obstetra',
    'general',
    'radiologo',
    'neurologico',
    'pediatra',
    'traumatologo',
    'ginecologo',
    'oncologo',
    'dermatologo'
  ] AS specialties
)
INSERT INTO public.staff (
  doctor_name,
  doctor_email,
  doctor_password,
  doctor_specialty,
  hospital_id,
  is_active,
  must_change_password
)
SELECT
  NULL AS doctor_name,
  'doctor' || gs.n::text || '@sadi.com.co' AS doctor_email,
  'passwordstaff' || lpad(gs.n::text, 2, '0') AS doctor_password,
  (SELECT specialties[((gs.n - 1) / 100) + 1] FROM specialty_list) AS doctor_specialty,
  NULL::uuid AS hospital_id,
  TRUE AS is_active,
  FALSE AS must_change_password
FROM generate_series(1, 1000) AS gs(n)
ON CONFLICT (doctor_email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.doctor_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  doctor_id UUID,
  doctor_email TEXT,
  doctor_name TEXT,
  doctor_specialty TEXT,
  hospital_id UUID,
  hospital_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d RECORD;
BEGIN
  SELECT
    s.doctor_id,
    s.doctor_email,
    s.doctor_name,
    s.doctor_specialty,
    s.hospital_id,
    s.doctor_password,
    s.is_active,
    h.name AS hospital_name
  INTO d
  FROM public.staff s
  LEFT JOIN public.hospitals h ON h.hospital_id = s.hospital_id
  WHERE lower(s.doctor_email) = lower(trim(coalesce(p_email, '')))
  LIMIT 1;

  IF d.doctor_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Doctor no encontrado', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  IF NOT d.is_active THEN
    RETURN QUERY SELECT FALSE, 'Doctor inactivo', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  IF coalesce(d.doctor_password, '') <> coalesce(p_password, '') THEN
    RETURN QUERY SELECT FALSE, 'Contraseña incorrecta', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  UPDATE public.staff s
  SET last_login_at = now(), updated_at = now()
  WHERE s.doctor_id = d.doctor_id;

  RETURN QUERY SELECT TRUE, 'OK', d.doctor_id, d.doctor_email, d.doctor_name, d.doctor_specialty, d.hospital_id, d.hospital_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.doctor_login(TEXT, TEXT) TO anon, authenticated;
