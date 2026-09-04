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

  void client.auth?.getSession?.().then(({ error }) => {
    const code = (error as { code?: string } | null)?.code;
    const message = error?.message || '';
    if (code === 'refresh_token_not_found' || message.includes('Refresh Token')) {
      void client.auth.signOut({ scope: 'local' });
    }
  });

  globalThis.__qlashBrowserClient = client;
  return client;
};
