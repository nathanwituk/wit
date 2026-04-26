import { NextResponse } from 'next/server';

// Stub — Gmail OAuth flow implemented in Step 2
export async function GET() {
  return NextResponse.json({ error: 'Gmail OAuth not configured yet' }, { status: 501 });
}
