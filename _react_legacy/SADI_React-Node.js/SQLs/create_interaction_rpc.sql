-- Create a secure function to insert interactions bypassing RLS
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION create_interaction_secure(
  p_patient_id UUID,
  p_hospital_id UUID,
  p_patient_name TEXT,
  p_patient_phone TEXT,
  p_patient_email TEXT,
  p_tipo TEXT,
  p_asunto TEXT,
  p_mensaje TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with the permissions of the creator (admin)
AS $$
DECLARE
  v_result JSONB;
BEGIN
  INSERT INTO public.interactions (
    patient_id, 
    hospital_id, 
    patient_name, 
    patient_phone, 
    patient_email, 
    tipo, 
    asunto, 
    mensaje, 
    estado,
    created_at
  ) VALUES (
    p_patient_id, 
    p_hospital_id, 
    p_patient_name, 
    p_patient_phone,
    p_patient_email, 
    p_tipo, 
    p_asunto, 
    p_mensaje, 
    'pendiente',
    NOW()
  )
  RETURNING to_jsonb(interactions.*) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to all authenticated users
GRANT EXECUTE ON FUNCTION create_interaction_secure TO authenticated;
