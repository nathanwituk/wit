import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/context';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchMemoriesContext(): Promise<string> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('memories')
      .select('category, key, value')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data || data.length === 0) return '';

    const grouped: Record<string, string[]> = {};
    for (const m of data) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(`- **${m.key}:** ${m.value}`);
    }

    const sections = Object.entries(grouped)
      .map(([cat, items]) => `### ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n${items.join('\n')}`)
      .join('\n\n');

    return `## What Wit Knows About Nathan\n\n${sections}`;
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, extraContext } = await req.json();
    const memoriesContext = await fetchMemoriesContext();
    const fullContext = [memoriesContext, extraContext].filter(Boolean).join('\n\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(fullContext),
      messages,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
