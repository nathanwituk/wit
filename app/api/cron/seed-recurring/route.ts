import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  // Verify this is a legitimate Vercel cron call
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  // Get today's date in CT (UTC-5 / UTC-6 DST) — cron runs at 11am UTC = 6am CT
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); // YYYY-MM-DD
  const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' });
  const dayIndex = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dayOfWeek);

  // Fetch active templates that include today
  const { data: templates, error: tErr } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('active', true)
    .contains('days_of_week', [dayIndex]);

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!templates || templates.length === 0) return NextResponse.json({ seeded: 0 });

  // Fetch existing tasks for today to avoid duplicates
  const { data: existing } = await supabase
    .from('tasks')
    .select('title')
    .eq('due_date', today)
    .neq('status', 'cancelled');

  const existingTitles = new Set((existing || []).map(t => t.title.toLowerCase()));

  // Insert tasks that don't already exist
  const toInsert = templates
    .filter(t => !existingTitles.has(t.title.toLowerCase()))
    .map(t => ({
      title: t.title,
      category: t.category,
      scheduled_time: t.scheduled_time,
      estimated_minutes: t.estimated_minutes,
      energy_level: t.energy_level,
      context_tag: t.context_tag,
      priority: t.priority,
      friction_score: t.friction_score,
      due_date: today,
      status: 'todo',
      source: 'recurring',
      blocked_by: [],
      week_of: today,
    }));

  if (toInsert.length === 0) return NextResponse.json({ seeded: 0, message: 'All already exist' });

  const { error: insertErr } = await supabase.from('tasks').insert(toInsert);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ seeded: toInsert.length, date: today, tasks: toInsert.map(t => t.title) });
}
