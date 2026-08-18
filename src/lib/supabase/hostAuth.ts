import { createClient } from '@/lib/supabase/server';

/**
 * Host identity from the cookie JWT when possible (no Auth HTTP).
 * Falls back to getUser() when the session is missing.
 */
export async function getHostAuth() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    return { supabase, user: session.user };
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Unauthorized. Please log in.');
  }
  return { supabase, user };
}
