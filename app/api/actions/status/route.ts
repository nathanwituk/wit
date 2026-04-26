import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('connected_accounts')
    .select('provider, email');

  // Group by provider — array of emails per provider
  const connected: Record<string, string[]> = {};
  for (const row of data || []) {
    if (!connected[row.provider]) connected[row.provider] = [];
    if (row.email) connected[row.provider].push(row.email);
  }

  return NextResponse.json({ connected });
}
