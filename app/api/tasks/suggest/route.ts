import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientTz = searchParams.get('tz') || 'America/Chicago';
    const clientDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const clientTime = searchParams.get('time') || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

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
      .select('category, key, value, created_at')
      .order('created_at', { ascending: false })
      .limit(80);

    const allMemories = memories || [];

    // Pull out today's activity log separately for prominent context
    const today = new Date().toISOString().slice(0, 10);
    const todayActivity = allMemories
      .filter(m => m.category === 'activity' && m.created_at?.startsWith(today))
      .map(m => `• ${m.value}`)
      .join('\n');

    const memContext = allMemories
      .filter(m => m.category !== 'activity')
      .map(m => `[${m.category}] ${m.key}: ${m.value}`)
      .join('\n');

    const dayOfWeek = new Date(clientDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const timeOfDay = clientTime;

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are Nathan's intelligent task suggester. Generate highly personalized task suggestions based on his full context. Return ONLY a valid JSON array, no markdown.`,
      messages: [{
        role: 'user',
        content: `Today is ${dayOfWeek}, ${clientDate}. Current local time: ${timeOfDay} (${clientTz}).

${todayActivity ? `WHAT NATHAN HAS BEEN DOING TODAY:\n${todayActivity}\n\nIMPORTANT: Factor this into your suggestions. If he's been coding all morning, suggest a break/gym task. If he skipped his normal gym time to code, note that. Suggest tasks that fit the current energy and context.` : ''}

Nathan's full context:
${memContext}

Already in task list: ${existingTitles || 'none'}

Generate 6 smart task suggestions Nathan should do soon. Use his real projects, goals, and schedule. Be specific — reference his actual projects (Wit, portfolio, Speedster, classes, etc).

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
  "why": string (1 sentence — why this makes sense RIGHT NOW given today's activity),
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
