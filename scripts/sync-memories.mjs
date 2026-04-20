// sync-memories.mjs
// Pulls all memories from Supabase → writes organized markdown to Obsidian vault
// Run: node scripts/sync-memories.mjs

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { config } from 'dotenv';

config({ path: new URL('../.env.local', import.meta.url).pathname });

const VAULT_PATH = join(homedir(), 'Documents', 'NathanOS_Hybrid_Final', '03_MEMORY');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CATEGORY_TITLES = {
  health: '🏃 Health & Fitness',
  goals: '🎯 Goals',
  projects: '🛠 Projects',
  preferences: '⚡ Preferences & Habits',
  schedule: '📅 Schedule',
  people: '👥 People',
  daily_log: '📓 Daily Log',
};

async function sync() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No memories found yet.');
    return;
  }

  // Group by category
  const grouped = {};
  for (const m of data) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  // Create vault memory folder
  mkdirSync(VAULT_PATH, { recursive: true });

  const now = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // Write one file per category
  for (const [category, memories] of Object.entries(grouped)) {
    const title = CATEGORY_TITLES[category] || category;
    const lines = [
      `# ${title}`,
      ``,
      `> Last synced: ${now}`,
      ``,
    ];

    for (const m of memories) {
      const date = new Date(m.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      lines.push(`## ${m.key}`);
      lines.push(`*${date} · via ${m.source}*`);
      lines.push(``);
      lines.push(m.value);
      lines.push(``);
    }

    const filename = category.replace('_', '-') + '.md';
    writeFileSync(join(VAULT_PATH, filename), lines.join('\n'));
    console.log(`✓ ${filename} (${memories.length} entries)`);
  }

  // Write index file
  const indexLines = [
    `# Wit Memory Index`,
    ``,
    `> Last synced: ${now}`,
    `> Total memories: ${data.length}`,
    ``,
    `## Categories`,
    ``,
  ];
  for (const [category, memories] of Object.entries(grouped)) {
    const title = CATEGORY_TITLES[category] || category;
    const filename = category.replace('_', '-') + '.md';
    indexLines.push(`- [[${filename.replace('.md', '')}|${title}]] — ${memories.length} entries`);
  }
  writeFileSync(join(VAULT_PATH, '_index.md'), indexLines.join('\n'));
  console.log(`✓ _index.md`);
  console.log(`\nSynced ${data.length} memories to ${VAULT_PATH}`);
}

sync();
