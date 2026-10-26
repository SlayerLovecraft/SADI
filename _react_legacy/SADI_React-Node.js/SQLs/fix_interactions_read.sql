-- Fix READ permissions for interactions table
-- This script allows patients to see their own interactions and hospitals to see theirs.

-- 1. Enable RLS on interactions table
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Patients can view own interactions" ON public.interactions;
DROP POLICY IF EXISTS "Hospitals can view assigned interactions" ON public.interactions;
DROP POLICY IF EXISTS "Patients can create interactions" ON public.interactions;
DROP POLICY IF EXISTS "Hospitals can update assigned interactions" ON public.interactions;

-- 3. Create Policy: Patients can view ONLY their own interactions
CREATE POLICY "Patients can view own interactions"
ON public.interactions
FOR SELECT
TO authenticated
USING (
  patient_id = auth.uid()
);

-- 4. Create Policy: Hospitals can view interactions assigned to them
CREATE POLICY "Hospitals can view assigned interactions"
ON public.interactions
FOR SELECT
TO authenticated
USING (
  hospital_id = auth.uid()
);

-- 5. Create Policy: Patients can INSERT their own interactions
CREATE POLICY "Patients can create interactions"
ON public.interactions
FOR INSERT
TO authenticated
WITH CHECK (
  patient_id = auth.uid()
);

-- 6. Create Policy: Hospitals can UPDATE interactions (to reply)
CREATE POLICY "Hospitals can update assigned interactions"
ON public.interactions
FOR UPDATE
TO authenticated
USING (
  hospital_id = auth.uid()
);

-- 7. Grant necessary permissions
GRANT ALL ON TABLE public.interactions TO authenticated;
