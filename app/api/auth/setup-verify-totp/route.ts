import { NextRequest, NextResponse } from 'next/server';
import { verifyTOTP } from '@/lib/totp';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  const { token, secret } = await req.json();

  if (!token || !secret) {
    return NextResponse.json({ error: 'Missing token or secret' }, { status: 400 });
  }

  if (!verifyTOTP(token, secret, 0)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 });
  }

  // Save TOTP_SECRET to .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = fs.readFileSync(envPath, 'utf-8');
  envContent = envContent.replace(/^TOTP_SECRET=.*$/m, `TOTP_SECRET=${secret}`);
  fs.writeFileSync(envPath, envContent);

  return NextResponse.json({ success: true });
}
