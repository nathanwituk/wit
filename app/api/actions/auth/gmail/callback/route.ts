import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { encrypt } from '@/lib/encryption';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wit-nathanwituks-projects.vercel.app';

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${APP_URL}/api/actions/auth/gmail/callback`
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/dashboard/actions?error=access_denied`);
  }

  // Validate CSRF state
  const storedState = req.cookies.get('gmail_oauth_state')?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${APP_URL}/dashboard/actions?error=invalid_state`);
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get the user's email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const supabase = createAdminSupabaseClient();
    await supabase.from('connected_accounts').upsert({
      provider: 'gmail',
      access_token: encrypt(tokens.access_token!),
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      email: userInfo.email ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider,email' });

    const res = NextResponse.redirect(`${APP_URL}/dashboard/actions?connected=gmail`);
    // Clear the state cookie
    res.cookies.set('gmail_oauth_state', '', { maxAge: 0, path: '/' });
    return res;
  } catch (err) {
    console.error('Gmail OAuth callback error:', err);
    return NextResponse.redirect(`${APP_URL}/dashboard/actions?error=auth_failed`);
  }
}
