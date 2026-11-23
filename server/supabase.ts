import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isServerSupabaseConfigured = (): boolean => {
  return (
    !!supabaseUrl &&
    !!supabaseKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project-id')
  );
};

export const supabaseServer: SupabaseClient = createClient(
  isServerSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co',
  isServerSupabaseConfigured() ? supabaseKey : 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
