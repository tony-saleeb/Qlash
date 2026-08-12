import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __quizarenaAdminClient: SupabaseClient | undefined;
}

/**
 * Process-wide singleton — reuses HTTP connections under 80 concurrent submits.
 * Creating a new client per request was a major latency source.
 */
export const createAdminClient = (): SupabaseClient => {
  if (global.__quizarenaAdminClient) {
    return global.__quizarenaAdminClient;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env variable');
  }

  global.__quizarenaAdminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { 'x-client-info': 'quizarena-admin' },
      },
    }
  );

  return global.__quizarenaAdminClient;
};
