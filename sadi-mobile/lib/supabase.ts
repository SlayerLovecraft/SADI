import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { storage } from './supabaseStorage';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ospsgzzudwrdjyvldmmo.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcHNnenp1ZHdyZGp5dmxkbW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDA1NjAsImV4cCI6MjA5NDI3NjU2MH0.eF2mBQKmGxsz5j4YnNayL-Tz1AyIp0regUMrqNTkEWc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
