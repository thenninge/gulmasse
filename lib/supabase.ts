import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration (SUPABASE_URL and SUPABASE_ANON_KEY)');
}

// Singleton client for server-side use
const globalForSupabase = global as unknown as { supabaseClient?: ReturnType<typeof createClient> };

export const supabase =
  globalForSupabase.supabaseClient ??
  createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

if (!globalForSupabase.supabaseClient) {
  globalForSupabase.supabaseClient = supabase;
}


