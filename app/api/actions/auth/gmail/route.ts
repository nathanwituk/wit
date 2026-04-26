import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { randomBytes } from 'crypto';

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://wit-nathanwituks-projects.vercel.app'}/api/actions/auth/gmail/callback`
  );
}

export async function GET() {
  const oauth2Client = getOAuthClient();

  // Generate CSRF state token
  const state = randomBytes(24).toString('hex');

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    state,
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });

  const res = NextResponse.redirect(url);
  // Store state in a short-lived httpOnly cookie
  res.cookies.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return res;
}
