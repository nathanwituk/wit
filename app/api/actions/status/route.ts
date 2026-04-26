import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('connected_accounts')
    .select('provider, email');

  const connected: Record<string, string | null> = {};
  for (const row of data || []) {
    connected[row.provider] = row.email;
  }

  return NextResponse.json({ connected });
}
