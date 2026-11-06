import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publicSiteUrl } from '@/lib/siteUrl';
import { safeNextPath } from '@/lib/auth/safeNextPath';

function redirectBase(origin: string): string {
  return publicSiteUrl() || origin;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  const base = redirectBase(origin);

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  return NextResponse.redirect(`${base}/`);
}
