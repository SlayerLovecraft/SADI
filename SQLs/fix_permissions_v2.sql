-- Fix permissions for 'users' table - V2 (More permissive)
-- Use this script if the previous one didn't resolve the "permission denied for table users" error.

-- 1. Allow authenticated users to read ALL user profiles
-- This is necessary if the system needs to look up other users (like doctors/admins)
-- during operations (e.g. sending notifications, linking records)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop previous policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow read access to all users" ON public.users;
DROP POLICY IF EXISTS "Allow update own profile" ON public.users;

-- Create a policy that allows reading ANY user in the users table
-- This solves the issue where a Trigger might need to read an admin/hospital user
CREATE POLICY "Allow read access to all users"
ON public.users
FOR SELECT
TO authenticated
USING ( true );

-- Allow users to update ONLY their own profile
CREATE POLICY "Allow update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING ( auth.uid() = id );

-- 2. Ensure explicit permissions are granted
GRANT SELECT, UPDATE ON TABLE public.users TO authenticated;

-- 3. Also ensure 'hospitals' table is readable (often related)
GRANT SELECT ON TABLE public.hospitals TO authenticated;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all hospitals" ON public.hospitals;
CREATE POLICY "Allow read access to all hospitals"
ON public.hospitals
FOR SELECT
TO authenticated
USING ( true );

-- 4. Ensure 'interactions' table has correct permissions
GRANT ALL ON TABLE public.interactions TO authenticated;

-- 5. Fix permissions/RLS for 'segments' table (needed for doctor portal)
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all segments" ON public.segments;
DROP POLICY IF EXISTS "Allow insert access to segments" ON public.segments;
DROP POLICY IF EXISTS "Allow update access to segments" ON public.segments;
DROP POLICY IF EXISTS "Allow delete access to segments" ON public.segments;

CREATE POLICY "Allow read access to all segments"
ON public.segments
FOR SELECT
TO anon, authenticated
USING ( true );

CREATE POLICY "Allow insert access to segments"
ON public.segments
FOR INSERT
TO anon, authenticated
WITH CHECK ( true );

CREATE POLICY "Allow update access to segments"
ON public.segments
FOR UPDATE
TO anon, authenticated
USING ( true )
WITH CHECK ( true );

CREATE POLICY "Allow delete access to segments"
ON public.segments
FOR DELETE
TO anon, authenticated
USING ( true );

GRANT ALL ON TABLE public.segments TO anon, authenticated;
