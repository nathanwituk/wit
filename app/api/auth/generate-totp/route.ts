import { NextResponse } from 'next/server';
import { generateSecret } from '@/lib/totp';

export async function GET() {
  if (process.env.TOTP_SECRET) {
    return NextResponse.json({ error: 'TOTP already configured' }, { status: 400 });
  }

  const secret = generateSecret();
  const otpauth = `otpauth://totp/Wit:nathanwituk%40gmail.com?secret=${secret}&issuer=Wit&algorithm=SHA1&digits=6&period=30`;

  return NextResponse.json({ secret, otpauth });
}
