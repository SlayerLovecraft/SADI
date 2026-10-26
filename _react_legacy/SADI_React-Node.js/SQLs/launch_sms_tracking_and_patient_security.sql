CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS public.patient_login(TEXT, TEXT);

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS sms_opt_out_at TIMESTAMPTZ NULL;

-- Persist doctor assignment per patient
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS doctor_id UUID NULL REFERENCES public.staff(doctor_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS patients_doctor_idx ON public.patients(doctor_id);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS pendientes INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.campaign_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  to_phone TEXT NULL,
  from_phone TEXT NULL,
  body TEXT NOT NULL,
  twilio_sid TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  twilio_status TEXT NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_messages_campaign_id_idx ON public.campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_messages_twilio_sid_idx ON public.campaign_messages(twilio_sid);

CREATE OR REPLACE FUNCTION public.recompute_campaign_counts(p_campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enviados INT;
  v_entregados INT;
  v_fallidos INT;
  v_pendientes INT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status IN ('enviado', 'entregado', 'fallido'))::INT,
    COUNT(*) FILTER (WHERE status = 'entregado')::INT,
    COUNT(*) FILTER (WHERE status = 'fallido')::INT,
    COUNT(*) FILTER (WHERE status IN ('pendiente', 'enviado'))::INT
  INTO v_enviados, v_entregados, v_fallidos, v_pendientes
  FROM public.campaign_messages
  WHERE campaign_id = p_campaign_id;

  UPDATE public.campaigns
  SET
    enviados = v_enviados,
    entregados = v_entregados,
    fallidos = v_fallidos,
    pendientes = v_pendientes,
    estado = CASE
      WHEN v_pendientes = 0 AND (v_enviados + v_fallidos + v_entregados) > 0 THEN 'Completada'
      ELSE estado
    END,
    fecha_completado = CASE
      WHEN v_pendientes = 0 AND (v_enviados + v_fallidos + v_entregados) > 0 AND fecha_completado IS NULL THEN now()
      ELSE fecha_completado
    END
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_campaign_counts(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.patient_login(p_identifier TEXT, p_password TEXT)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  patient_id UUID,
  email TEXT,
  name TEXT,
  document TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_identifier TEXT;
  v_patient_id UUID;
  v_email TEXT;
  v_name TEXT;
  v_document TEXT;
  v_password_hash TEXT;
BEGIN
  v_identifier := trim(coalesce(p_identifier, ''));

  SELECT
    pa.patient_id,
    pa.email,
    pa.name,
    pa.document,
    pa.password_hash
  INTO
    v_patient_id,
    v_email,
    v_name,
    v_document,
    v_password_hash
  FROM public.patients pa
  WHERE lower(pa.email) = lower(v_identifier)
     OR pa.document = v_identifier
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Paciente no encontrado', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF coalesce(v_password_hash, '') = '' THEN
    RETURN QUERY SELECT FALSE, 'Paciente sin contraseña asignada', v_patient_id, v_email, v_name, v_document;
    RETURN;
  END IF;

  IF crypt(coalesce(p_password, ''), v_password_hash) <> v_password_hash THEN
    RETURN QUERY SELECT FALSE, 'Contraseña incorrecta', v_patient_id, v_email, v_name, v_document;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, 'OK', v_patient_id, v_email, v_name, v_document;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_login(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.change_patient_password(
  p_patient_id UUID,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT patient_id, password_hash
  INTO p
  FROM public.patients
  WHERE patient_id = p_patient_id
  LIMIT 1;

  IF p.patient_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Paciente no encontrado';
    RETURN;
  END IF;

  IF coalesce(p.password_hash, '') = '' THEN
    RETURN QUERY SELECT FALSE, 'Paciente sin contraseña asignada';
    RETURN;
  END IF;

  IF crypt(coalesce(p_old_password, ''), p.password_hash) <> p.password_hash THEN
    RETURN QUERY SELECT FALSE, 'Contraseña actual incorrecta';
    RETURN;
  END IF;

  UPDATE public.patients
  SET
    password_hash = crypt(coalesce(p_new_password, ''), gen_salt('bf', 10)),
    must_change_password = FALSE
  WHERE patient_id = p_patient_id;

  RETURN QUERY SELECT TRUE, 'OK';
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_patient_password(UUID, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_patient_secure(
  p_hospital_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_document TEXT,
  p_phone TEXT,
  p_birthdate DATE,
  p_sex TEXT,
  p_city TEXT,
  p_address TEXT,
  p_program TEXT,
  p_plain_password TEXT,
  p_sms_opt_in BOOLEAN DEFAULT TRUE
)
RETURNS public.patients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_existing UUID;
  v_row public.patients;
BEGIN
  SELECT patient_id INTO v_existing
  FROM public.patients
  WHERE hospital_id = p_hospital_id
    AND (
      lower(email) = lower(trim(coalesce(p_email, '')))
      OR document = trim(coalesce(p_document, ''))
    )
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Paciente ya existe (email o documento)';
  END IF;

  INSERT INTO public.patients (
    hospital_id,
    email,
    name,
    document,
    phone,
    birthdate,
    sex,
    city,
    address,
    program,
    password_hash,
    must_change_password,
    sms_opt_in,
    sms_opt_out_at
  ) VALUES (
    p_hospital_id,
    lower(trim(p_email)),
    trim(p_name),
    trim(p_document),
    p_phone,
    p_birthdate,
    p_sex,
    p_city,
    p_address,
    p_program,
    crypt(coalesce(p_plain_password, ''), gen_salt('bf', 10)),
    TRUE,
    coalesce(p_sms_opt_in, TRUE),
    CASE WHEN coalesce(p_sms_opt_in, TRUE) THEN NULL ELSE now() END
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_patient_secure(UUID, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;
