-- Fix permissions for the 'users' table
-- This is necessary because the 'interactions' table likely has an RLS policy 
-- or trigger that references the 'users' table, and the current user 
-- doesn't have permission to read from it.

-- Enable RLS on users table (if not already enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own data
-- This should resolve the "permission denied for table users" error
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING ( auth.uid() = id );

-- Policy to allow users to update their own data (needed for password change)
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING ( auth.uid() = id );

-- Grant usage on the public schema (usually default, but good to ensure)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE public.users TO authenticated;
