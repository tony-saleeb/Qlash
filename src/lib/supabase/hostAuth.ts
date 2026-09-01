import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

type HostClient = ReturnType<typeof createClient>;

/**
 * Host identity from the cookie JWT when possible (no Auth HTTP).
 * Falls back to getUser() when the session is missing.
 */
export async function readHostAuth(): Promise<{ supabase: HostClient; user: User | null }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    return { supabase, user: session.user };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user: user ?? null };
}

export async function getHostAuth() {
  const { supabase, user } = await readHostAuth();
  if (!user) {
    throw new Error('Unauthorized. Please log in.');
  }
  return { supabase, user };
}
