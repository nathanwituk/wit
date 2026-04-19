import { NextResponse } from 'next/server';
import { generateSecret, generateURI } from 'otplib';

export async function GET() {
  if (process.env.TOTP_SECRET) {
    return NextResponse.json({ error: 'TOTP already configured' }, { status: 400 });
  }

  const secret = generateSecret();
  const otpauth = await generateURI({
    secret,
    label: 'nathanwituk@gmail.com',
    issuer: 'Wit',
  });

  return NextResponse.json({ secret, otpauth });
}
