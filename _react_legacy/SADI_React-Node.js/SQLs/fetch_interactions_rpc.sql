-- Create a secure function to fetch interactions bypassing RLS
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_my_interactions()
RETURNS SETOF public.interactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.interactions
  WHERE patient_id = auth.uid()
  ORDER BY created_at DESC;
END;
$$;

-- Grant execute permission to all authenticated users
GRANT EXECUTE ON FUNCTION get_my_interactions TO authenticated;
