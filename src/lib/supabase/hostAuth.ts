import { createClient } from '@/lib/supabase/server';

type HostClient = Awaited<ReturnType<typeof createClient>>;

export type HostUser = { id: string; email: string | null };

/**
 * Host identity from the verified JWT claims. The cookie session is not trusted.
 */
export async function readHostAuth(): Promise<{ supabase: HostClient; user: HostUser | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims.sub;
  if (error || !subject) {
    return { supabase, user: null };
  }
  const email = data.claims.email;
  return {
    supabase,
    user: { id: subject, email: typeof email === 'string' ? email : null },
  };
}

export async function getHostAuth() {
  const { supabase, user } = await readHostAuth();
  if (!user) {
    throw new Error('Unauthorized. Please log in.');
  }
  return { supabase, user };
}
