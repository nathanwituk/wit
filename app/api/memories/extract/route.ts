import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = ['health', 'goals', 'projects', 'preferences', 'schedule', 'people', 'daily_log'] as const;
type Category = typeof CATEGORIES[number];

interface Memory {
  category: Category;
  key: string;
  value: string;
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, source = 'voice' } = await req.json();

    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are a memory extraction engine. Extract every distinct fact, preference, goal, habit, event, or piece of context about Nathan from the transcript. Be thorough — capture everything, even small details.

Return ONLY a valid JSON array. No explanation, no markdown, just the array.

Each item must have:
- "category": one of: health, goals, projects, preferences, schedule, people, daily_log
- "key": short title (5 words max, e.g. "Morning workout routine", "Internship interview date")
- "value": the full captured fact in 1-3 sentences

Category guide:
- health: workouts, food, sleep, body, fitness, nutrition
- goals: aspirations, targets, metrics, financial goals
- projects: work, design projects, deadlines, status updates
- preferences: how Nathan works, likes, dislikes, tools, habits
- schedule: specific dates, times, recurring events, classes
- people: people in Nathan's life, relationships, professors, coworkers
- daily_log: what happened today, decisions made, general life updates`,
      messages: [{ role: 'user', content: transcript }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';

    let memories: Memory[] = [];
    try {
      const parsed = JSON.parse(rawText);
      memories = Array.isArray(parsed) ? parsed.filter(
        (m): m is Memory =>
          CATEGORIES.includes(m.category) &&
          typeof m.key === 'string' &&
          typeof m.value === 'string'
      ) : [];
    } catch {
      return NextResponse.json({ error: 'Failed to parse extracted memories' }, { status: 500 });
    }

    if (memories.length === 0) {
      return NextResponse.json({ memories: [], saved: 0 });
    }

    const supabase = createAdminSupabaseClient();
    const rows = memories.map(m => ({
      category: m.category,
      key: m.key,
      value: m.value,
      source,
      raw_transcript: transcript,
    }));

    const { error } = await supabase.from('memories').insert(rows);
    if (error) throw error;

    return NextResponse.json({ memories, saved: memories.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Memory extraction error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
