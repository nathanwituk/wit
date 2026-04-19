import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL!;

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Block anyone who isn't Nathan
      if (data.user.email !== ALLOWED_EMAIL) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/?error=unauthorized`);
      }

      // Check if TOTP is configured — if not, go to setup
      const totpSecret = process.env.TOTP_SECRET;
      if (!totpSecret) {
        return NextResponse.redirect(`${origin}/setup-2fa`);
      }

      // TOTP exists — go to verification
      return NextResponse.redirect(`${origin}/verify-2fa`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
