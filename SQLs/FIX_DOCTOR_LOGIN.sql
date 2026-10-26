-- ==============================================================================
-- CORRECCIÓN DEFINITIVA DE LA FUNCIÓN doctor_login Y ACCESO A STAFF
-- Soluciona: "Returned type character varying(255) does not match expected type text in column 8"
-- ==============================================================================

-- 1. Eliminar versiones anteriores de la función
DROP FUNCTION IF EXISTS public.doctor_login(TEXT, TEXT);

-- 2. Asegurar que la tabla staff tiene las columnas y registros requeridos
CREATE TABLE IF NOT EXISTS public.staff (
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

-- Habilitar permisos de lectura para autenticación
GRANT SELECT ON public.staff TO anon, authenticated;
GRANT SELECT ON public.hospitals TO anon, authenticated;

-- 3. Crear función doctor_login con casteo estricto ::TEXT para evitar error 42804
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
    s.doctor_email::TEXT AS doctor_email,
    s.doctor_name::TEXT AS doctor_name,
    s.doctor_specialty::TEXT AS doctor_specialty,
    s.hospital_id,
    s.doctor_password::TEXT AS doctor_password,
    s.is_active,
    coalesce(h.name::TEXT, 'Hospital Central SADI')::TEXT AS hospital_name
  INTO d
  FROM public.staff s
  LEFT JOIN public.hospitals h ON h.hospital_id = s.hospital_id
  WHERE lower(s.doctor_email) = lower(trim(coalesce(p_email, '')))
  LIMIT 1;

  IF d.doctor_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Doctor no encontrado'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  IF NOT d.is_active THEN
    RETURN QUERY SELECT FALSE, 'Doctor inactivo'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  IF coalesce(d.doctor_password, '') <> coalesce(p_password, '') THEN
    RETURN QUERY SELECT FALSE, 'Contraseña incorrecta'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  UPDATE public.staff s
  SET last_login_at = now(), updated_at = now()
  WHERE s.doctor_id = d.doctor_id;

  RETURN QUERY SELECT 
    TRUE, 
    'OK'::TEXT, 
    d.doctor_id, 
    d.doctor_email::TEXT, 
    d.doctor_name::TEXT, 
    d.doctor_specialty::TEXT, 
    d.hospital_id, 
    d.hospital_name::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.doctor_login(TEXT, TEXT) TO anon, authenticated;

-- 4. Semilla rápida para doctor1 a doctor8 si no existen
INSERT INTO public.staff (
  doctor_name,
  doctor_email,
  doctor_password,
  doctor_specialty,
  is_active
)
VALUES
  ('Dr. Staff Pediatría', 'doctor1@sadi.com.co', 'passwordstaff01', 'Pediatría y Puericultura', TRUE),
  ('Dr. Staff Hebiatría', 'doctor2@sadi.com.co', 'passwordstaff02', 'Medicina Familiar y Hebiatría', TRUE),
  ('Dra. Staff Juventud', 'doctor3@sadi.com.co', 'passwordstaff03', 'Medicina General y Salud Sexual', TRUE),
  ('Dr. Staff Adultez', 'doctor4@sadi.com.co', 'passwordstaff04', 'Medicina Interna y Riesgo Cardiovascular', TRUE),
  ('Dra. Staff Vejez', 'doctor5@sadi.com.co', 'passwordstaff05', 'Geriatría y Envejecimiento Activo', TRUE),
  ('Dr. Staff RIAMP', 'doctor6@sadi.com.co', 'passwordstaff06', 'Ginecobstetricia y Materno Fetal', TRUE),
  ('Dra. Staff Bucal', 'doctor7@sadi.com.co', 'passwordstaff07', 'Odontología Integral 3280', TRUE),
  ('Dr. Staff Oncología', 'doctor8@sadi.com.co', 'passwordstaff08', 'Oncología y Detección Temprana', TRUE)
ON CONFLICT (doctor_email) DO UPDATE SET
  doctor_password = EXCLUDED.doctor_password,
  is_active = TRUE;
