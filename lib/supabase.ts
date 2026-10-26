import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const localDemo =
  process.env.LOCAL_DEMO === '1' || process.env.LOCAL_DEMO === 'true';

function resolveConfig(): { url: string; key: string } {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (localDemo ? 'https://local-demo.supabase.co' : '');
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (localDemo ? 'local-demo-anon-key' : '');

  if (!url || !key) {
    throw new Error(
      'Missing Supabase configuration (SUPABASE_URL and SUPABASE_ANON_KEY). For localhost without DB, set LOCAL_DEMO=1 in .env.local',
    );
  }
  return { url, key };
}

const globalForSupabase = global as unknown as {
  supabaseClient?: SupabaseClient;
};

function getClient(): SupabaseClient {
  if (globalForSupabase.supabaseClient) return globalForSupabase.supabaseClient;
  const { url, key } = resolveConfig();
  const client = createClient(url, key, {
    auth: { persistSession: false },
  });
  globalForSupabase.supabaseClient = client;
  return client;
}

/**
 * Lazy proxy so `next build` can collect route data without requiring
 * Supabase env at module-evaluation time. Real requests still need env.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
