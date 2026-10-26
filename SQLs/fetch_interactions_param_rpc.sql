-- Create a secure function to fetch interactions for a specific patient ID
-- This avoids issues where auth.uid() might not match the patient_id column exactly
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_patient_interactions(p_patient_id UUID)
RETURNS SETOF public.interactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.interactions
  WHERE patient_id = p_patient_id
  ORDER BY created_at DESC;
END;
$$;

-- Grant execute permission to all authenticated users
GRANT EXECUTE ON FUNCTION get_patient_interactions TO authenticated;
