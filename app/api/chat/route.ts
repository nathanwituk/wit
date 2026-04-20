import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/context';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, extraContext } = await req.json();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(extraContext),
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
