import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publicSiteUrl } from '@/lib/siteUrl';
import { safeNextPath } from '@/lib/auth/safeNextPath';

const OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;
type EmailOtpType = (typeof OTP_TYPES)[number];

function isEmailOtpType(value: string): value is EmailOtpType {
  return (OTP_TYPES as readonly string[]).includes(value);
}

function redirectBase(origin: string): string {
  return publicSiteUrl() || origin;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const base = redirectBase(origin);

  if (tokenHash && type && isEmailOtpType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${base}${safeNextPath(searchParams.get('next'))}`);
    }
  }

  return NextResponse.redirect(`${base}/?authError=1`);
}
