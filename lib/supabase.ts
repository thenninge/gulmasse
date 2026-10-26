import { createClient } from '@supabase/supabase-js';

const localDemo =
  process.env.LOCAL_DEMO === '1' || process.env.LOCAL_DEMO === 'true';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (localDemo ? 'https://local-demo.supabase.co' : undefined);
const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (localDemo ? 'local-demo-anon-key' : undefined);

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase configuration (SUPABASE_URL and SUPABASE_ANON_KEY). For localhost without DB, set LOCAL_DEMO=1 in .env.local',
  );
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
