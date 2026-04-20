// One-time script to seed Nathan's full profile into memories
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env.local') });

const CATEGORIES = ['health', 'goals', 'projects', 'preferences', 'schedule', 'people', 'daily_log'];

const PROFILE = `
Nathan Wituk — Personal Overview

1. Identity & Background
My name is Nathan Wituk. I'm currently a college student living in Lawrence, Kansas, originally from Kansas as well. I'm openly gay and a big part of my identity is how I show up online and socially—confident, expressive, and very in tune with culture and trends. I'd describe myself as someone who's creative-first but also extremely driven by results and impact, especially when it comes to building things that actually work in the real world. Personality-wise, I'm a mix of analytical and instinctive—I trust my gut on design and ideas, but I also back things up with research and systems thinking. I tend to move fast, get obsessed with ideas, and push things further than most people around me.

2. Education
I go to the University of Kansas, studying Interaction Design (UI/UX focused). I'm currently in my junior year, taking classes like Design Systems (IXD 414), Interaction Design, and other advanced design and advertising courses. Professors like Matt Kirkland have played a role in shaping how I think about systems, not just visuals. My academic strengths are definitely in creative problem-solving, systems thinking, and execution. I struggle more with unclear instructions, tight turnarounds without structure, or anything that feels disconnected from actual industry application. GPA is not my focus—portfolio quality and real skills are.

3. Daily Routine
I aim for mornings that allow me to get ahead early, especially with workouts. Mornings: Planet Fitness workout. Midday: classes. Afternoon/evening: work sessions on projects and design work. Evenings: cardio (running) or creative work, wind down with content and social media before bed.

4. Health & Fitness
Workouts: mix of lifting and cardio. Planet Fitness for lifting, running outside or apartment gym for cardio. Diet: leans healthy—oatmeal, simple homemade foods, lower-calorie swaps. Body goals: stay lean, build muscle definition, feel confident physically. Previously completed 75 Hard. No major injuries. Biggest challenge: staying consistent and avoiding cycles of inconsistency.

5. Career & Money
Previous income: KU Marketing, graphic designer, retail, and nearly six figures in under a year as a TikTok LIVE host. Current focus: transitioning into UI/UX internships at startups, agencies, or studios—not big corporations. Long-term vision: build products and platforms that generate real revenue. Want scalable income beyond time-for-pay. Combining product design with entrepreneurship.

6. Projects & Work
Active projects: Seat Sync (VIP stadium experience app—comfort, replays, in-seat services), Compose (fully built digital concert program system with QR codes—already functional), Speedster (speeding awareness/safety behavior change concept), Fearless Inventory (design systems project for warehouse inventory accuracy). All aimed at portfolio-ready, recruiter-impressive case studies. Also exploring a TikTok Live overspending prevention app with Plaid Finance integration, push notification interventions, and iOS Screen Time breaks.

7. Goals
1 month: refine portfolio, improve website, build strong case studies. 3 months: land a UI/UX internship, highly polished differentiated portfolio. 1 year: strong income through design roles or personal projects, consistent fitness, grow personal brand. Big financial goal: $50,000 in earnings. TikTok growth: 29K to 50K followers. Design accounts each to 1,000+ followers.

8. Social Media & Brand
Built TikTok presence through LIVE streaming—nearly six figures, strong monetized community. Lifestyle content: living in Kansas, being gay, coffee shop reviews. Moving forward: combining UI/UX, building in public, and personality content. Posting has been inconsistent—goal is strategic and consistent. Building recognizable personal brand that supports career and income.

9. Relationships & People
Design program peers. Key mentors: Matt Kirkland (professor, also running an agency—internship starting April 22), Mark Pearlman, Jake Dugard. Family important—grandpa project idea called "Opa's diary." Values people who push forward, challenge, and open doors.

10. Preferences & Personality
Works best building something real, fast, and with purpose. Hates slow unclear processes and busy work. Tools: Figma, Claude Code, Next.js, AI tools. Peak focus: early morning after gym or late at night. Perfect day: productive, creative, physically active—shipped something meaningful. Guilty pleasures: Real Housewives, content consumption, trends. Watches Real Housewives to decompress.

11. Fears & Blockers
Biggest blocker: inconsistency—starting strong then falling off rhythm. Frustrated by inefficiency and unclear systems. Tendency to spread focus across too many ideas at once. Wants to break pattern of overthinking instead of executing and shipping.

12. Anything Else
Extremely idea-driven—constantly thinks of new systems, features, and products. Wants to combine design, tech, and real-world usability. Builds things that feel obvious in hindsight but didn't exist before. Very aware of branding and perception. Goal: be known as someone who builds impactful scalable solutions, not just a designer.
`;

async function main() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log('Extracting memories from profile...');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a memory extraction engine. Extract every distinct fact, preference, goal, habit, event, or piece of context about Nathan from the text. Be extremely thorough — extract 30-50 memories minimum.

Return ONLY a valid JSON array. No explanation, no markdown code fences, just the raw array.

Each item: { "category": one of ${CATEGORIES.join('/')}, "key": "short title max 6 words", "value": "full fact in 1-3 sentences" }`,
    messages: [{ role: 'user', content: PROFILE }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let memories;
  try {
    memories = JSON.parse(clean);
  } catch {
    console.error('Parse error. Raw response:\n', raw);
    process.exit(1);
  }

  console.log(`Extracted ${memories.length} memories. Saving to Supabase...`);

  const rows = memories
    .filter(m => CATEGORIES.includes(m.category) && m.key && m.value)
    .map(m => ({ category: m.category, key: m.key, value: m.value, source: 'profile', raw_transcript: 'Nathan Wituk personal profile document' }));

  const { error } = await supabase.from('memories').insert(rows);
  if (error) { console.error('Supabase error:', error.message); process.exit(1); }

  console.log(`✓ Saved ${rows.length} memories to Supabase`);
}

main();
