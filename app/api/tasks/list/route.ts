import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return NextResponse.json({ tasks: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
