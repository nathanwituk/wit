import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  // Tomorrow's date in CT
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const tomorrow = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const tomorrowLabel = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric' });
  const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' });
  const dayIndex = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dayOfWeek);

  // Get existing tasks for tomorrow
  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('id, title, category, scheduled_time, estimated_minutes, priority, energy_level')
    .eq('due_date', tomorrow)
    .neq('status', 'cancelled');

  // Get recurring templates that fire tomorrow (preview — cron seeds them at 6am)
  const { data: templates } = await supabase
    .from('recurring_templates')
    .select('title, category, scheduled_time, estimated_minutes, priority, energy_level')
    .eq('active', true)
    .contains('days_of_week', [dayIndex]);

  // Merge: existing tasks + templates not already in existing
  const existingTitles = new Set((existingTasks || []).map(t => t.title.toLowerCase()));
  const templatePreviews = (templates || [])
    .filter(t => !existingTitles.has(t.title.toLowerCase()))
    .map(t => ({ title: t.title, category: t.category, scheduled_time: t.scheduled_time, estimated_minutes: t.estimated_minutes, priority: t.priority, energy_level: t.energy_level }));

  const allTasks = [
    ...(existingTasks || []),
    ...templatePreviews,
  ];

  if (allTasks.length === 0) {
    return NextResponse.json({ scheduled: 0, message: 'No tasks for tomorrow' });
  }

  // Get memories for context
  const { data: memories } = await supabase
    .from('memories')
    .select('category, key, value')
    .order('created_at', { ascending: false })
    .limit(60);

  const memContext = (memories || [])
    .filter(m => m.category !== 'activity')
    .map(m => `[${m.category}] ${m.key}: ${m.value}`)
    .join('\n');

  const taskList = allTasks.map(t =>
    `${'id' in t ? `[${t.id}]` : '[new]'} ${t.title} | ${t.category} | ${t.energy_level} | ~${t.estimated_minutes}m | currently: ${t.scheduled_time || 'unscheduled'}`
  ).join('\n');

  // Ask Claude Haiku to assign optimal times
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: `You are Nathan's overnight scheduler. Assign optimal scheduled_time values to his tasks for tomorrow. Return ONLY a JSON array, no markdown.`,
    messages: [{
      role: 'user',
      content: `Tomorrow is ${tomorrowLabel}.

Nathan's context:
${memContext}

Tasks to schedule:
${taskList}

Rules:
- Gym is always at 07:00 — never move it
- Classes have fixed times — never move them
- Schedule deep_focus tasks in the morning (8am-12pm) when energy is highest
- Schedule light_work and quick_wins in the afternoon
- Don't overlap tasks — respect estimated_minutes duration
- Leave at least 15 min between tasks
- Only return tasks that have an id (skip [new] entries)

Return JSON array: [{ "id": "uuid", "scheduled_time": "HH:MM" }]`
    }],
  });

  const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]';
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let schedule: Array<{ id: string; scheduled_time: string }> = [];
  try { schedule = JSON.parse(clean); } catch { return NextResponse.json({ error: 'Claude parse failed', raw }, { status: 500 }); }

  // Batch update scheduled_times
  await Promise.all(
    schedule.map(({ id, scheduled_time }) =>
      supabase.from('tasks').update({ scheduled_time }).eq('id', id)
    )
  );

  // Log to memories so morning chat knows about it
  await supabase.from('memories').upsert({
    category: 'daily_log',
    key: 'overnight_plan_date',
    value: tomorrow,
  }, { onConflict: 'category,key' });

  return NextResponse.json({ scheduled: schedule.length, date: tomorrow });
}
