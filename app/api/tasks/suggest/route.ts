import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET() {
  try {
    const supabase = createAdminSupabaseClient();

    // Get existing task titles to avoid duplicates
    const { data: existing } = await supabase
      .from('tasks')
      .select('title')
      .in('status', ['todo', 'in_progress']);

    const existingTitles = (existing || []).map(t => t.title).join(', ');

    // Get memories for context
    const { data: memories } = await supabase
      .from('memories')
      .select('category, key, value')
      .order('created_at', { ascending: false })
      .limit(80);

    const memContext = (memories || [])
      .map(m => `[${m.category}] ${m.key}: ${m.value}`)
      .join('\n');

    const today = new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are Nathan's intelligent task suggester. Generate highly personalized task suggestions based on his full context. Return ONLY a valid JSON array, no markdown.`,
      messages: [{
        role: 'user',
        content: `Today is ${dayOfWeek}, ${today}.

Nathan's context:
${memContext}

Already in task list: ${existingTitles || 'none'}

Generate 6 smart task suggestions Nathan should do soon. Use his real projects, goals, and schedule.

Return JSON array: [{
  "title": string,
  "description": string (1-2 sentences, specific),
  "category": design|code|school|fitness|personal|content|admin,
  "priority": urgent|high|medium|low,
  "energy_level": deep_focus|light_work|quick_win,
  "context_tag": anywhere|computer|phone|gym|campus,
  "friction_score": 1-5,
  "estimated_minutes": number,
  "due_date": YYYY-MM-DD or null,
  "why": string (1 sentence — why this is suggested now),
  "blocked_by": []
}]`
      }],
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]';
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const suggestions = JSON.parse(clean);

    return NextResponse.json({ suggestions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
