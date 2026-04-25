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

async function fetchTodaysTasks(localDate: string): Promise<string> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from('tasks')
      .select('id, title, scheduled_time, due_date, status, category, estimated_minutes, priority')
      .eq('due_date', localDate)
      .neq('status', 'cancelled')
      .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (!data || data.length === 0) return 'No tasks scheduled today.';

    return data
      .map(t =>
        `[${t.id}] ${t.scheduled_time || 'unscheduled'} | ${t.title} | ${t.category} | ${t.status}${t.estimated_minutes ? ` | ~${t.estimated_minutes}m` : ''}`
      )
      .join('\n');
  } catch {
    return '';
  }
}

const SCHEDULE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'propose_task',
    description:
      "Propose creating a new task on Nathan's schedule. Call this when Nathan mentions doing something (gym, studying, cooking, working on a project, etc.) or mentions something he needs to do. Include follow_up_question if you're missing key info like end time or duration.",
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Short task title' },
        category: {
          type: 'string',
          enum: ['fitness', 'code', 'design', 'school', 'personal', 'content', 'admin'],
        },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        scheduled_time: {
          type: 'string',
          description: 'HH:MM 24-hour. Use current time if Nathan says "right now". Omit if unknown.',
        },
        estimated_minutes: {
          type: 'number',
          description: 'Duration in minutes. Omit if unknown.',
        },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
        energy_level: { type: 'string', enum: ['deep_focus', 'light_work', 'quick_win'] },
        follow_up_question: {
          type: 'string',
          description:
            'Question to ask Nathan if you need more info (e.g. end time). Omit if you have everything needed.',
        },
      },
      required: ['title', 'category', 'due_date'],
    },
  },
  {
    name: 'update_task_schedule',
    description:
      "Update an existing task — mark it done, change its time, or reschedule it. Use task IDs from today's schedule shown in context.",
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string' },
        scheduled_time: { type: 'string', description: 'New HH:MM time' },
        estimated_minutes: { type: 'number' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'cancelled'] },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'plan_full_day',
    description:
      "Generate a complete day plan. Use when Nathan says he just woke up, asks 'what's my day', or asks to plan everything. Build the schedule around his existing tasks, goals, and energy patterns.",
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD — the date this plan is for. Use today unless Nathan asked to plan a different day (e.g. tomorrow).' },
        summary: { type: 'string', description: 'One sentence overview of the day' },
        plan: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              time: { type: 'string', description: 'HH:MM 24-hour' },
              title: { type: 'string' },
              duration_minutes: { type: 'number' },
              category: {
                type: 'string',
                enum: ['fitness', 'code', 'design', 'school', 'personal', 'content', 'admin'],
              },
              task_id: {
                type: 'string',
                description: 'Existing task ID if rescheduling, omit for new tasks',
              },
              priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
              energy_level: { type: 'string', enum: ['deep_focus', 'light_work', 'quick_win'] },
            },
            required: ['time', 'title', 'duration_minutes', 'category'],
          },
        },
      },
      required: ['summary', 'plan', 'date'],
    },
  },
];

// Broad enough to catch "help me plan tomorrow", "plan my week", "what should I do today", etc.
const PLAN_DAY_KEYWORDS = /\bplan\b|\bschedule (my|the|today|tomorrow|this)\b|what (should|can) (i|we) (do|work on|focus on|tackle)|my (day|schedule|agenda|tasks)|just woke|i.?m awake|good morning|lay out (my|the)|organize (my|the) day/i;
const ACTIVITY_KEYWORDS = /i.?m (at|in|doing|working|going|starting|about to)|just (started|got to|arrived|began|got back)|right now i/i;
const DONE_KEYWORDS = /just (finished|completed|done|got back|wrapped|left|returned)|i.?m (done|finished|back|home|out of)|finished (my|the)|done with|wrapped up/i;

export async function POST(req: NextRequest) {
  try {
    const { messages, extraContext, localDate } = await req.json();
    const todaysDate = localDate || new Date().toISOString().slice(0, 10);

    const [memoriesContext, todaysTasks] = await Promise.all([
      fetchMemoriesContext(),
      fetchTodaysTasks(todaysDate),
    ]);

    const fullContext = [
      memoriesContext,
      `## Today's Schedule (${todaysDate})\nFormat: [task_id] time | title | category | status | duration\n${todaysTasks}`,
      extraContext,
    ]
      .filter(Boolean)
      .join('\n\n');

    // Detect intent from the last user message to force the right tool
    const lastUserMsg = (messages as Array<{ role: string; content: string }>)
      .filter(m => m.role === 'user')
      .at(-1)?.content ?? '';

    let toolChoice: Anthropic.Messages.ToolChoiceAuto | Anthropic.Messages.ToolChoiceTool =
      { type: 'auto' };

    if (PLAN_DAY_KEYWORDS.test(lastUserMsg)) {
      toolChoice = { type: 'tool', name: 'plan_full_day' };
    } else if (DONE_KEYWORDS.test(lastUserMsg)) {
      toolChoice = { type: 'tool', name: 'update_task_schedule' };
    } else if (ACTIVITY_KEYWORDS.test(lastUserMsg)) {
      toolChoice = { type: 'tool', name: 'propose_task' };
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(fullContext),
      tools: SCHEDULE_TOOLS,
      tool_choice: toolChoice,
      messages,
    });

    let text = '';
    let tasksCreated = 0;
    const actions: Array<{ type: string; input: Record<string, unknown> }> = [];

    for (const block of response.content) {
      if (block.type === 'text') text += block.text;
      if (block.type === 'tool_use') {
        if (block.name === 'plan_full_day') {
          const planInput = block.input as {
            date?: string;
            summary?: string;
            plan: Array<{
              time: string; title: string; duration_minutes: number;
              category: string; task_id?: string; priority?: string; energy_level?: string;
            }>;
          };
          const planDate = planInput.date || todaysDate;
          const supabase = createAdminSupabaseClient();

          // Fetch existing tasks for this day to check duplicates + conflicts
          const { data: existingTasks } = await supabase
            .from('tasks')
            .select('id, title, scheduled_time, estimated_minutes')
            .eq('due_date', planDate)
            .neq('status', 'cancelled');

          const existing = existingTasks || [];

          function tMins(t: string): number {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          }
          function minsToT(m: number): string {
            return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          }
          function titleSimilar(a: string, b: string): boolean {
            a = a.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
            b = b.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
            if (a === b || a.includes(b) || b.includes(a)) return true;
            const aW = new Set(a.split(' ').filter(w => w.length > 3));
            const overlap = b.split(' ').filter(w => w.length > 3 && aW.has(w)).length;
            return overlap >= 2;
          }
          function findFreeSlot(
            wantedMins: number, duration: number,
            occupied: Array<{ start: number; end: number }>
          ): number {
            let slot = wantedMins;
            for (let i = 0; i < 48; i++) {
              const conflict = occupied.find(o => o.start < slot + duration && o.end > slot);
              if (!conflict) return slot;
              slot = conflict.end;
            }
            return wantedMins;
          }

          // Seed occupied slots from existing tasks
          const occupied: Array<{ start: number; end: number }> = existing
            .filter(t => t.scheduled_time)
            .map(t => ({
              start: tMins(t.scheduled_time),
              end: tMins(t.scheduled_time) + (t.estimated_minutes || 30),
            }));

          let created = 0;
          for (const item of planInput.plan || []) {
            // Reschedule existing task — just update time, no duplicate risk
            if (item.task_id) {
              const duration = item.duration_minutes || 30;
              const freeMins = findFreeSlot(tMins(item.time), duration, occupied);
              occupied.push({ start: freeMins, end: freeMins + duration });
              const res = await supabase.from('tasks')
                .update({ scheduled_time: minsToT(freeMins), due_date: planDate })
                .eq('id', item.task_id);
              if (!res.error) created++;
              continue;
            }

            // Skip if a similar task already exists for this day
            if (existing.some(t => titleSimilar(t.title, item.title))) continue;

            // Find a free time slot
            const duration = item.duration_minutes || 30;
            const freeMins = findFreeSlot(tMins(item.time), duration, occupied);
            occupied.push({ start: freeMins, end: freeMins + duration });

            const res = await supabase.from('tasks').insert({
              title: item.title,
              category: item.category || 'personal',
              due_date: planDate,
              scheduled_time: minsToT(freeMins),
              estimated_minutes: duration,
              priority: item.priority || 'medium',
              energy_level: item.energy_level || 'light_work',
              status: 'todo',
              context_tag: 'anywhere',
              friction_score: 3,
              blocked_by: [],
              source: 'chat_plan',
            });
            if (!res.error) created++;
          }
          tasksCreated = created;
        } else {
          // propose_task and update_task_schedule handled client-side
          actions.push({ type: block.name, input: block.input as Record<string, unknown> });
        }
      }
    }

    // Fire-and-forget: extract memories from this exchange
    const transcript =
      messages
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'Nathan' : 'Wit'}: ${m.content}`)
        .join('\n') + (text ? `\nWit: ${text}` : '');

    fetch(`${req.nextUrl.origin}/api/memories/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, source: 'chat' }),
    }).catch(() => {});

    return NextResponse.json({ text, actions, tasksCreated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
