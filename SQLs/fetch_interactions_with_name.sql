-- FIX: Use JSON return type to avoid column definition mismatches
-- This is a more robust version of the previous script.
-- Run this in Supabase SQL Editor

DROP FUNCTION IF EXISTS get_patient_interactions(UUID);

CREATE OR REPLACE FUNCTION get_patient_interactions(p_patient_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(t) INTO result
  FROM (
    SELECT 
      i.*, 
      h.name as hospital_name
    FROM public.interactions i
    LEFT JOIN public.hospitals h ON i.hospital_id = h.hospital_id
    WHERE i.patient_id = p_patient_id
    ORDER BY i.created_at DESC
  ) t;
  
  -- Return empty array if null (instead of null)
  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_patient_interactions TO authenticated;
