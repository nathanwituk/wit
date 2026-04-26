import { NextResponse } from 'next/server';

// Stub — Outlook OAuth flow implemented in Step 2
export async function GET() {
  return NextResponse.json({ error: 'Outlook OAuth not configured yet' }, { status: 501 });
}
