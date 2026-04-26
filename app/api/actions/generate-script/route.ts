import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();
    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: `You are a social media content strategist. Generate punchy, research-backed TikTok/Reel scripts.
Each script must have:
- hook: 1–2 sentences (0–3 seconds, stops the scroll, bold claim or question)
- body: 3–5 sentences (the core content — cite a real stat, study, or insight to back it up)
- cta: 1 sentence (clear action: follow, comment, share, try something)

Keep language conversational, first-person, natural to speak aloud. No hashtags in the script.
Respond ONLY with valid JSON matching this shape exactly:
{ "hook": "...", "body": "...", "cta": "...", "talkTime": "45–60s" }`,
      messages: [{ role: 'user', content: `Topic: ${topic}` }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid response' }, { status: 500 });

    const script = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ script });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
