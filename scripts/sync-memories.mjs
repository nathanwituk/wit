// sync-memories.mjs
// Pulls all memories from Supabase → writes organized markdown to Obsidian vault
// Run: node scripts/sync-memories.mjs

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { config } from 'dotenv';

config({ path: new URL('../.env.local', import.meta.url).pathname });

const VAULT_ROOT = join(homedir(), 'Documents', 'NathanOS_Hybrid_Final');
const VAULT_PATH = join(VAULT_ROOT, '03_MEMORY');
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

// Cross-links: memory category → existing vault notes to link to
// These create graph edges between 03_MEMORY and the rest of the vault
const CATEGORY_VAULT_LINKS = {
  projects: ['Compose', 'Speedster', 'Fearless Inventory', 'SeatSync', 'Portfolio'],
  goals: ['Dashboard', 'Internship Tracker', 'Weekly Review', 'Resume Master'],
  people: ['Dashboard'],
  schedule: ['Dashboard', 'Internship Tracker', 'Weekly Review'],
  preferences: ['Dashboard'],
  health: ['Dashboard'],
  daily_log: ['Dashboard', 'Weekly Review'],
};

function getExistingVaultFiles() {
  // Scan vault for .md files to only link to ones that actually exist
  const existing = new Set();
  function scan(dir) {
    try {
      const { readdirSync, statSync } = require('fs');
      // Use dynamic import equivalent for ESM
    } catch {}
  }
  // Manually list known vault files
  const knownFiles = [
    'Dashboard', 'Internship Tracker', 'Weekly Review',
    'Compose', 'Speedster', 'Fearless Inventory', 'SeatSync', 'Portfolio',
    'Resume Master', 'Experience Stories',
  ];
  return knownFiles.filter(name => {
    const paths = [
      join(VAULT_ROOT, '00_HOME', name + '.md'),
      join(VAULT_ROOT, '01_PROJECTS', name + '.md'),
      join(VAULT_ROOT, '01_PROJECTS', name, name + '.md'),
      join(VAULT_ROOT, '01_PROJECTS', name, 'Overview.md'),
      join(VAULT_ROOT, '02_CAREER', name + '.md'),
    ];
    return paths.some(p => existsSync(p));
  });
}

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

  const existingFiles = getExistingVaultFiles();

  // Group by category
  const grouped = {};
  for (const m of data) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  mkdirSync(VAULT_PATH, { recursive: true });
  mkdirSync(join(VAULT_ROOT, '04_DAILY'), { recursive: true });

  const now = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // Write daily_log memories to dated files in 04_DAILY/
  const dailyLogs = grouped['daily_log'] || [];
  if (dailyLogs.length > 0) {
    // Group daily logs by date
    const byDate = {};
    for (const m of dailyLogs) {
      const dateKey = new Date(m.created_at).toISOString().slice(0, 10);
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(m);
    }
    for (const [dateKey, entries] of Object.entries(byDate)) {
      const dailyPath = join(VAULT_ROOT, '04_DAILY', `${dateKey}.md`);
      const dateLabel = new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const lines = [
        `# Daily Log — ${dateLabel}`,
        ``,
        `> Synced from Wit voice captures`,
        ``,
      ];
      for (const m of entries) {
        lines.push(`## ${m.key}`);
        lines.push(m.value);
        lines.push('');
      }
      lines.push('---');
      lines.push('[[Dashboard]] · [[Weekly Review]] · [[03_MEMORY/daily-log|Daily Log Memory]]');
      writeFileSync(dailyPath, lines.join('\n'));
      console.log(`✓ 04_DAILY/${dateKey}.md (${entries.length} entries)`);
    }
  }

  // Write one file per category
  for (const [category, memories] of Object.entries(grouped)) {
    const title = CATEGORY_TITLES[category] || category;

    // Build cross-links to existing vault files
    const vaultLinks = (CATEGORY_VAULT_LINKS[category] || [])
      .filter(name => existingFiles.includes(name))
      .map(name => `[[${name}]]`)
      .join(' · ');

    const lines = [
      `# ${title}`,
      ``,
      `> Last synced: ${now}`,
      vaultLinks ? `> Related: ${vaultLinks}` : '',
      ``,
      `---`,
      ``,
    ].filter(l => l !== null);

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

    // Add back-links section at bottom
    if (vaultLinks) {
      lines.push(`---`);
      lines.push(`### Linked Notes`);
      lines.push(vaultLinks);
    }

    const filename = category.replace('_', '-') + '.md';
    writeFileSync(join(VAULT_PATH, filename), lines.join('\n'));
    console.log(`✓ ${filename} (${memories.length} entries, links: ${vaultLinks || 'none'})`);
  }

  // Write index — links to all category files AND key vault hubs
  const indexLines = [
    `# 🧠 Wit Memory Index`,
    ``,
    `> Last synced: ${now}`,
    `> Total memories: ${data.length}`,
    ``,
    `## Memory Categories`,
    ``,
  ];
  for (const [category, memories] of Object.entries(grouped)) {
    const title = CATEGORY_TITLES[category] || category;
    const filename = category.replace('_', '-');
    indexLines.push(`- [[03_MEMORY/${filename}|${title}]] — ${memories.length} entries`);
  }

  indexLines.push('');
  indexLines.push('## Vault Links');
  indexLines.push('');
  const hubLinks = ['Dashboard', 'Weekly Review', 'Internship Tracker', 'Resume Master']
    .filter(n => existingFiles.includes(n))
    .map(n => `[[${n}]]`);
  indexLines.push(hubLinks.join(' · '));

  writeFileSync(join(VAULT_PATH, '_index.md'), indexLines.join('\n'));
  console.log(`✓ _index.md`);

  // Also inject a backlink into Dashboard.md so the main hub links back to memory
  const dashboardPath = join(VAULT_ROOT, '00_HOME', 'Dashboard.md');
  if (existsSync(dashboardPath)) {
    let dash = readFileSync(dashboardPath, 'utf-8');
    if (!dash.includes('03_MEMORY')) {
      dash += `\n\n## 🧠 Wit Memory\n[[03_MEMORY/_index|Memory Index]] — ${data.length} memories synced\n`;
      writeFileSync(dashboardPath, dash);
      console.log(`✓ Injected memory link into Dashboard.md`);
    }
  }

  console.log(`\nSynced ${data.length} memories to ${VAULT_PATH}`);
}

sync();
