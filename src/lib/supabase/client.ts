import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __qlashBrowserClient: SupabaseClient | undefined;
}

/** One browser client per tab — a new client on every render tears down realtime. */
export const createClient = (): SupabaseClient => {
  if (globalThis.__qlashBrowserClient) {
    return globalThis.__qlashBrowserClient;
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  globalThis.__qlashBrowserClient = client;
  return client;
};
