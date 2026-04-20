import { NextRequest, NextResponse } from 'next/server';
import { verifyTOTP } from '@/lib/totp';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  const secret = process.env.TOTP_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'TOTP not configured' }, { status: 400 });
  }

  // window=0 — only the exact current 30-second code is valid
  if (!verifyTOTP(token, secret, 0)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set('wit_2fa_verified', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  return NextResponse.json({ success: true });
}
