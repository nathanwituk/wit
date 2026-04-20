import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// POST /api/context/activity
// Logs what Nathan is currently doing — called by Mac tracker script and Claude Code hook
// Body: { app, category, context, working_dir?, action }
export async function POST(req: NextRequest) {
  try {
    const { app, category = 'code', context = '', working_dir = '', action = 'active' } = await req.json();
    if (!app) return NextResponse.json({ error: 'app required' }, { status: 400 });

    const supabase = createAdminSupabaseClient();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateStr = now.toISOString().slice(0, 10);

    const key = `${app.toLowerCase().replace(/\s+/g, '_')}_${action}`;
    const value = [
      `${action === 'start' ? 'Started' : action === 'end' ? 'Ended' : 'Active in'} ${app} at ${timeStr} on ${dateStr}`,
      context ? `Context: ${context}` : null,
      working_dir ? `Directory: ${working_dir}` : null,
    ].filter(Boolean).join('. ');

    // Upsert: delete recent duplicate key from today, then insert fresh
    await supabase
      .from('memories')
      .delete()
      .eq('key', key)
      .eq('category', 'activity')
      .gte('created_at', `${dateStr}T00:00:00`);

    const { error } = await supabase.from('memories').insert({
      category: 'activity',
      key,
      value,
      source: 'tracker',
    });

    if (error) throw error;
    return NextResponse.json({ ok: true, logged: value });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// GET /api/context/activity — return today's activity log
export async function GET() {
  try {
    const supabase = createAdminSupabaseClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('memories')
      .select('key, value, created_at')
      .eq('category', 'activity')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ activity: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
