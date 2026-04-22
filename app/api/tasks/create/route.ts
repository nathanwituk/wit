import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateAISuggestions(title: string, description: string, category: string) {
  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `Return ONLY a valid JSON object, no markdown. Generate AI tool suggestions for a task.`,
      messages: [{
        role: 'user',
        content: `Task: "${title}" (${category})\nDescription: ${description || 'none'}\n\nReturn JSON: { "tools": [{"name": string, "reason": string, "url": string}], "prompts": [string], "tips": [string] }. Max 3 of each.`
      }],
    });
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}';
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  } catch { return null; }
}

async function getEstimatedMinutes(title: string, category: string, energy_level: string): Promise<number> {
  const supabase = createAdminSupabaseClient();
  // Check historical averages for this category + energy level
  const { data } = await supabase
    .from('tasks')
    .select('actual_minutes, estimated_minutes')
    .eq('category', category)
    .eq('energy_level', energy_level)
    .eq('status', 'done')
    .not('actual_minutes', 'is', null)
    .limit(20);

  if (data && data.length >= 3) {
    const avg = Math.round(data.reduce((sum, t) => sum + (t.actual_minutes || t.estimated_minutes || 30), 0) / data.length);
    return avg;
  }

  // Fall back to Claude estimate
  const defaults: Record<string, number> = {
    'deep_focus': 90, 'light_work': 30, 'quick_win': 15
  };
  return defaults[energy_level] || 30;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title, description = '', category = 'personal',
      due_date, priority = 'medium', energy_level = 'light_work',
      context_tag = 'anywhere', friction_score = 3,
      blocked_by = [], recurrence, notes = '', source = 'manual'
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    const supabase = createAdminSupabaseClient();
    const estimated_minutes = body.estimated_minutes || await getEstimatedMinutes(title, category, energy_level);
    const ai_suggestions = await generateAISuggestions(title, description, category);
    const week_of = new Date();
    week_of.setDate(week_of.getDate() - week_of.getDay());

    // Default due_date to today (client timezone) or server date if not provided
    const resolved_due_date = due_date || body.localDate || new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase.from('tasks').insert({
      title: title.trim(), description, category,
      due_date: resolved_due_date,
      scheduled_time: body.scheduled_time || null,
      priority, energy_level, context_tag, friction_score,
      blocked_by, recurrence, notes, source,
      estimated_minutes, ai_suggestions,
      week_of: week_of.toISOString().slice(0, 10),
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
