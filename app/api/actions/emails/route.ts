import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { safeDecrypt } from '@/lib/encryption';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getOAuthClient(accessToken: string, refreshToken: string | null) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  // Tokens are stored encrypted — decrypt before use
  client.setCredentials({
    access_token: safeDecrypt(accessToken) ?? accessToken,
    refresh_token: refreshToken ? (safeDecrypt(refreshToken) ?? refreshToken) : undefined,
  });
  return client;
}

// Decode base64url email body
function decodeBody(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

// Extract plain text from Gmail message parts
function extractText(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: typeof payload[];
}): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBody(payload.body.data).slice(0, 2000);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractText(part);
      if (text) return text;
    }
  }
  return '';
}

export async function GET() {
  const supabase = createAdminSupabaseClient();

  // Get all connected Gmail accounts
  const { data: accounts } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('provider', 'gmail');

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ connected: false, emails: [] });
  }

  // Return cached summaries first (non-dismissed, last 30)
  const { data: cached } = await supabase
    .from('email_summaries')
    .select('*')
    .eq('provider', 'gmail')
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(30);

  // Fetch fresh emails from all accounts in background if cache exists
  if (cached && cached.length > 0) {
    Promise.all(accounts.map(a => refreshEmails(a, supabase))).catch(console.error);
    return NextResponse.json({ connected: true, emails: cached });
  }

  // First load — fetch from all accounts synchronously
  await Promise.all(accounts.map(a => refreshEmails(a, supabase)));

  const { data: fresh } = await supabase
    .from('email_summaries')
    .select('*')
    .eq('provider', 'gmail')
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(30);

  return NextResponse.json({ connected: true, emails: fresh || [] });
}

export async function DELETE(req: Request) {
  const { emailId, alsoInGmail } = await req.json();
  const supabase = createAdminSupabaseClient();

  await supabase.from('email_summaries').update({ dismissed: true }).eq('id', emailId);

  if (alsoInGmail) {
    const { data: account } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('provider', 'gmail')
      .single();

    if (account) {
      const { data: summary } = await supabase
        .from('email_summaries')
        .select('email_id')
        .eq('id', emailId)
        .single();

      if (summary) {
        const auth = getOAuthClient(account.access_token, account.refresh_token);
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.trash({ userId: 'me', id: summary.email_id }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function refreshEmails(
  account: { access_token: string; refresh_token: string | null; id: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  const auth = getOAuthClient(account.access_token, account.refresh_token);
  const gmail = google.gmail({ version: 'v1', auth });

  // Fetch up to 20 unread emails
  const { data: listData } = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
    maxResults: 20,
  });

  const messages = listData.messages || [];
  if (messages.length === 0) return [];

  // Fetch existing email IDs to skip already-summarized
  const { data: existing } = await supabase
    .from('email_summaries')
    .select('email_id')
    .eq('provider', 'gmail');
  const existingIds = new Set((existing || []).map((e: { email_id: string }) => e.email_id));

  const newMessages = messages.filter(m => m.id && !existingIds.has(m.id));
  if (newMessages.length === 0) {
    const { data } = await supabase
      .from('email_summaries')
      .select('*')
      .eq('provider', 'gmail')
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(30);
    return data || [];
  }

  // Fetch full message details (parallel, max 10)
  const toProcess = newMessages.slice(0, 10);
  const fullMessages = await Promise.all(
    toProcess.map(m =>
      gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' })
        .then(r => r.data)
        .catch(() => null)
    )
  );

  // Summarize each with Claude
  const summarized = await Promise.all(
    fullMessages.filter(Boolean).map(async (msg) => {
      const headers = msg!.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const body = extractText(msg!.payload as Parameters<typeof extractText>[0]);

      const senderName = from.replace(/<.*>/, '').trim() || from;
      const senderEmail = from.match(/<(.+)>/)?.[1] || from;

      if (!body && !subject) return null;

      try {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: `You are Nathan's email assistant. Analyze emails and respond with JSON only.
Output: { "summary": "1-2 sentence plain English summary", "action_needed": true/false, "suggested_task": null or { "title": "...", "category": "admin|code|design|school|personal", "priority": "urgent|high|medium|low" }, "draft_reply": null or "short reply if needed" }

Classification rules:
- action_needed = FALSE (To Delete): newsletters, promotions, notifications, receipts, automated emails, no-reply senders, marketing, social media alerts
- action_needed = TRUE (To Review): real humans emailing Nathan directly, deadlines, assignments, meeting requests, job/internship emails, professor emails, anything requiring a response or action

Be aggressive about marking things as To Delete. If in doubt, it's To Delete.`,
          messages: [{
            role: 'user',
            content: `From: ${from}\nSubject: ${subject}\n\n${body}`,
          }],
        });

        const raw = response.content[0].type === 'text' ? response.content[0].text : '';
        const json = raw.match(/\{[\s\S]*\}/)?.[0];
        if (!json) return null;
        const parsed = JSON.parse(json);

        return {
          account_id: account.id,
          email_id: msg!.id!,
          provider: 'gmail',
          sender_name: senderName,
          sender_email: senderEmail,
          subject,
          summary: parsed.summary,
          action_needed: parsed.action_needed ?? false,
          suggested_task: parsed.suggested_task ?? null,
          draft_reply: parsed.draft_reply ?? null,
          dismissed: false,
        };
      } catch {
        return null;
      }
    })
  );

  const rows = summarized.filter(Boolean);
  if (rows.length > 0) {
    await supabase.from('email_summaries').upsert(rows, { onConflict: 'provider,email_id' });
  }

  const { data } = await supabase
    .from('email_summaries')
    .select('*')
    .eq('provider', 'gmail')
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(30);
  return data || [];
}
