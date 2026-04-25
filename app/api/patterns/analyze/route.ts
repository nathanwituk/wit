import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function POST(req: NextRequest) {
  try {
    const { category, context_tag } = await req.json();
    if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 });

    const supabase = createAdminSupabaseClient();

    // Pull scheduled/rescheduled events for this category
    let query = supabase
      .from('task_events')
      .select('time_of_day, day_of_week, energy_level, context_tag, estimated_minutes, created_at')
      .in('event_type', ['scheduled', 'rescheduled'])
      .eq('category', category)
      .not('time_of_day', 'is', null)
      .order('created_at', { ascending: false })
      .limit(60);

    if (context_tag) query = query.eq('context_tag', context_tag);

    const { data: events, error } = await query;
    if (error) throw error;

    // Need at least 5 data points to find meaningful patterns
    if (!events || events.length < 5) {
      return NextResponse.json({ chips: [], insight: null, insufficient_data: true });
    }

    // Format raw events for Claude — be explicit about what each row means
    const rows = events.map(e => ({
      time: e.time_of_day,
      day: DAY_NAMES[e.day_of_week ?? 0],
      energy: e.energy_level,
      context: e.context_tag,
      mins: e.estimated_minutes,
    }));

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `You are a behavioral pattern analyst for a personal productivity system. Analyze scheduling history and identify distinct behavioral clusters — NOT averages. Return ONLY valid JSON, no markdown.`,
      messages: [{
        role: 'user',
        content: `Nathan's scheduling history for category "${category}" (${events.length} events, most recent first):

${JSON.stringify(rows, null, 2)}

Identify 2–4 distinct time clusters that Nathan actually uses. Look for:
- Different times used on different days of the week
- Different times based on energy level or context
- Recurring time preferences that suggest intentional patterns
- Do NOT average the times — if he uses 7am and 8am, those are two separate clusters

Return JSON:
{
  "chips": [
    {
      "label": "7:00 AM",
      "time": "07:00",
      "subtitle": "Weekdays",
      "count": 20
    }
  ],
  "insight": "One sentence explaining the most interesting pattern you found — what context drives Nathan to pick different times."
}

Rules:
- Max 4 chips
- "time" must be HH:MM 24-hour format
- "subtitle" should be the context that predicts this choice (day of week, energy level, etc.)
- "insight" must be specific, not generic — reference actual patterns in the data
- If all times cluster tightly (within 30 min of each other), return just 1 chip with the most common time`,
      }],
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}';
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(clean);

    return NextResponse.json({
      chips: result.chips || [],
      insight: result.insight || null,
      sample_size: events.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
