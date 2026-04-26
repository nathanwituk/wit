'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

type Tab = 'inbox' | 'content';

interface EmailSummary {
  id: string;
  email_id: string;
  provider: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  summary: string;
  action_needed: boolean;
  suggested_task: { title: string; category: string; priority: string } | null;
  draft_reply: string | null;
  dismissed: boolean;
  created_at: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function GmailIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6Z" stroke="#555" strokeWidth="1.6" strokeLinecap="round"/>
      <polyline points="2,6 12,13 22,6" stroke="#555" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Connect prompt ───────────────────────────────────────────────────────────
function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-14 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-[#1e1e1e] flex items-center justify-center">
        <GmailIcon size={26} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-white text-sm font-medium">Connect Gmail</p>
        <p className="text-[#444] text-xs leading-relaxed max-w-xs">
          Wit reads your inbox, surfaces what matters, and keeps your schedule in sync — without you lifting a finger.
        </p>
      </div>
      <button
        onClick={onConnect}
        className="bg-white text-[#0a0a0a] text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#e0e0e0] active:scale-[0.97] transition-all"
      >
        Connect Gmail
      </button>
      <div className="flex flex-col items-center gap-2.5 pt-2">
        <p className="text-[#2a2a2a] text-[10px] uppercase tracking-wider font-medium">Also available</p>
        <button
          onClick={() => { window.location.href = '/api/actions/auth/outlook'; }}
          className="flex items-center gap-2 bg-[#111] border border-[#1e1e1e] text-[#555] text-xs px-4 py-2 rounded-xl hover:border-[#333] hover:text-[#888] transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6Z"/>
            <polyline points="2,6 12,13 22,6"/>
          </svg>
          Connect Outlook
        </button>
      </div>
    </div>
  );
}

// ─── Trash icon ───────────────────────────────────────────────────────────────
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}

// ─── Email card (Figma design) ────────────────────────────────────────────────
function EmailCard({
  email,
  zIndex,
  onDismiss,
  onAddTask,
}: {
  email: EmailSummary;
  zIndex: number;
  onDismiss: (id: string) => void;
  onAddTask: (task: NonNullable<EmailSummary['suggested_task']>) => void;
}) {
  function openInGmail() {
    window.open(`https://mail.google.com/mail/u/0/#inbox/${email.email_id}`, '_blank');
  }

  return (
    <div
      className="relative rounded-[20px] border border-[#1a1a1a] bg-[#0e0e0e] p-5 flex flex-col gap-2.5 shrink-0 w-full"
      style={{ height: 198, marginBottom: -126, zIndex }}
    >
      {/* Title + summary */}
      <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
        <p className="text-white font-medium leading-snug" style={{ fontSize: 15 }}>
          {email.subject || email.sender_name}
        </p>
        <p className="text-[#666] leading-relaxed overflow-hidden" style={{ fontSize: 13 }}>
          {email.summary}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Open */}
        <button
          onClick={openInGmail}
          className="flex items-center gap-2 bg-[#141414] rounded-full px-3 py-2 text-[#666] active:opacity-70 transition-opacity"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span className="text-xs font-semibold whitespace-nowrap">Open</span>
        </button>

        {/* Add task — only on review emails with a suggestion */}
        {email.action_needed && email.suggested_task && (
          <button
            onClick={() => onAddTask(email.suggested_task!)}
            className="flex items-center justify-center bg-[#50532d] rounded-full px-3 py-2 active:opacity-70 transition-opacity"
          >
            <span className="text-xs font-semibold text-[#daff6b] whitespace-nowrap">Add task</span>
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => onDismiss(email.id)}
          className="flex items-center justify-center bg-[#391d1d] text-[#ff9696] rounded-full p-2 active:opacity-70 transition-opacity ml-auto"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ─── Email column ─────────────────────────────────────────────────────────────
function EmailColumn({
  title,
  emails,
  onDismiss,
  onDismissAll,
  onAddTask,
}: {
  title: string;
  emails: EmailSummary[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onAddTask: (task: NonNullable<EmailSummary['suggested_task']>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 w-[calc(50%-6px)] flex-shrink-0">
      {/* Column header */}
      <p className="text-white font-semibold text-center" style={{ fontSize: 17 }}>{title}</p>

      {/* Delete All pill */}
      <button
        onClick={onDismissAll}
        disabled={emails.length === 0}
        className="flex items-center justify-center gap-2 bg-[#391d1d] rounded-full px-3 py-2.5 disabled:opacity-30 active:opacity-70 transition-opacity w-full"
      >
        <TrashIcon />
        <span className="text-[#ff9696] text-xs font-semibold">Delete All</span>
      </button>

      {/* Stacked cards */}
      {emails.length === 0 ? (
        <p className="text-[#2a2a2a] text-xs text-center pt-4">Empty</p>
      ) : (
        <div
          className="relative flex flex-col items-stretch"
          style={{ paddingBottom: 126 }}
        >
          {emails.map((email, i) => (
            <EmailCard
              key={email.id}
              email={email}
              zIndex={emails.length - i}
              onDismiss={onDismiss}
              onAddTask={onAddTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inbox tab ────────────────────────────────────────────────────────────────
function InboxTab({ gmailEmails }: { gmailEmails: string[] }) {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskAdded, setTaskAdded] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/actions/emails');
      const data = await res.json();
      if (data.emails) setEmails(data.emails);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gmailEmails.length > 0) fetchEmails();
  }, [gmailEmails.length, fetchEmails]);

  async function handleDismiss(id: string) {
    setEmails(prev => prev.filter(e => e.id !== id));
    await fetch('/api/actions/emails', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: id, alsoInGmail: false }),
    });
  }

  async function handleDismissAll(ids: string[]) {
    setEmails(prev => prev.filter(e => !ids.includes(e.id)));
    await Promise.all(ids.map(id =>
      fetch('/api/actions/emails', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: id, alsoInGmail: false }),
      })
    ));
  }

  async function handleAddTask(task: NonNullable<EmailSummary['suggested_task']>) {
    await fetch('/api/tasks/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        category: task.category || 'admin',
        priority: task.priority || 'medium',
        status: 'todo',
        source: 'email',
      }),
    });
    setTaskAdded(task.title);
    setTimeout(() => setTaskAdded(null), 2500);
  }

  if (gmailEmails.length === 0) {
    return <ConnectPrompt onConnect={() => { window.location.href = '/api/actions/auth/gmail'; }} />;
  }

  // Split into two columns
  const toDelete = emails.filter(e => !e.action_needed);
  const toReview = emails.filter(e => e.action_needed);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Connected accounts bar */}
      <div className="px-4 py-2.5 border-b border-[#141414] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <div className="flex gap-1.5 flex-wrap min-w-0">
            {gmailEmails.map(e => (
              <span key={e} className="text-[10px] text-[#444] truncate max-w-[120px]">{e}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={fetchEmails} className="text-[#2a2a2a] hover:text-[#666] transition-colors p-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <button
            onClick={() => { window.location.href = '/api/actions/auth/gmail'; }}
            className="text-[#2a2a2a] hover:text-[#666] transition-colors text-[11px] font-medium"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Task added toast */}
      {taskAdded && (
        <div className="mx-4 mt-2.5 flex-shrink-0 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <p className="text-emerald-400 text-xs">Added: {taskAdded}</p>
        </div>
      )}

      {/* Loading */}
      {loading && emails.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 flex-1">
          <svg className="animate-spin text-[#333]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <p className="text-[#333] text-xs">Reading your inbox...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && emails.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 flex-1 text-center">
          <p className="text-[#2a2a2a] text-sm">Inbox clear</p>
          <p className="text-[#1e1e1e] text-xs">No unread emails right now</p>
        </div>
      )}

      {/* Two-column layout */}
      {emails.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
          <div className="flex gap-3 items-start">
            <EmailColumn
              title="To Delete"
              emails={toDelete}
              onDismiss={handleDismiss}
              onDismissAll={() => handleDismissAll(toDelete.map(e => e.id))}
              onAddTask={handleAddTask}
            />
            <EmailColumn
              title="To Review"
              emails={toReview}
              onDismiss={handleDismiss}
              onDismissAll={() => handleDismissAll(toReview.map(e => e.id))}
              onAddTask={handleAddTask}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Script card ──────────────────────────────────────────────────────────────
function ScriptCard({ script, onDelete }: {
  script: { id: string; topic: string; hook: string; body: string; cta: string; talkTime: string };
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(section: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(section);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="rounded-2xl border border-[#1e1e1e] bg-[#0e0e0e] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#141414]">
        <div>
          <p className="text-white text-sm font-medium">{script.topic}</p>
          <p className="text-[#333] text-[10px] mt-0.5">~{script.talkTime} talk time</p>
        </div>
        <button onClick={() => onDelete(script.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#2a2a2a] hover:text-[#888] hover:bg-[#1a1a1a] transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      {[
        { key: 'hook', label: 'Hook', sub: '0–3s', text: script.hook },
        { key: 'body', label: 'Body', sub: 'main content', text: script.body },
        { key: 'cta',  label: 'CTA',  sub: 'call to action', text: script.cta  },
      ].map(({ key, label, sub, text }) => (
        <div key={key} className="px-4 py-3 border-b border-[#141414] last:border-b-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">{label}</span>
              <span className="text-[10px] text-[#2a2a2a]">{sub}</span>
            </div>
            <button onClick={() => copy(key, text)}
              className="flex items-center gap-1.5 text-[10px] text-[#333] hover:text-white px-2 py-1 rounded-lg hover:bg-[#1a1a1a] transition-all">
              {copied === key ? (
                <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg><span className="text-[#22c55e]">Copied</span></>
              ) : (
                <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
              )}
            </button>
          </div>
          <p className="text-[#666] text-xs leading-relaxed">{text}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Content tab ──────────────────────────────────────────────────────────────
function ContentTab() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [scripts, setScripts] = useState<Array<{
    id: string; topic: string; hook: string; body: string; cta: string; talkTime: string;
  }>>([]);

  async function generate() {
    if (!topic.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/actions/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();
      if (data.script) {
        setScripts(prev => [{ id: `${Date.now()}`, topic: topic.trim(), ...data.script }, ...prev]);
        setTopic('');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 py-4 border-b border-[#141414] flex-shrink-0">
        <div className="flex gap-2">
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()}
            placeholder="Topic or goal (e.g. 'grow my design audience')"
            className="flex-1 bg-[#141414] border border-[#1e1e1e] text-white text-sm rounded-xl px-4 py-3 outline-none placeholder:text-[#2a2a2a] focus:border-[#333] transition-colors" />
          <button onClick={generate} disabled={!topic.trim() || loading}
            className="bg-white text-[#0a0a0a] text-sm font-semibold px-4 py-3 rounded-xl hover:bg-[#e0e0e0] active:scale-[0.97] transition-all disabled:opacity-30 flex-shrink-0">
            {loading ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            )}
          </button>
        </div>
        <p className="text-[#2a2a2a] text-[10px] mt-2 px-1">Generates a TikTok/Reel script — hook, body, CTA — with research-backed framing.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {scripts.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-[#2a2a2a] text-sm">No scripts yet</p>
            <p className="text-[#1e1e1e] text-xs">Enter a topic above to generate your first script</p>
          </div>
        )}
        {scripts.map(script => (
          <ScriptCard key={script.id} script={script}
            onDelete={id => setScripts(prev => prev.filter(s => s.id !== id))} />
        ))}
      </div>
    </div>
  );
}

// ─── Inner page (uses searchParams) ──────────────────────────────────────────
function ActionsInner() {
  const [tab, setTab] = useState<Tab>('inbox');
  const [gmailEmails, setGmailEmails] = useState<string[]>([]);
  const searchParams = useSearchParams();

  const loadStatus = useCallback(() => {
    fetch('/api/actions/status')
      .then(r => r.json())
      .then(data => {
        if (data.connected?.gmail) setGmailEmails(data.connected.gmail);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Handle redirect back from OAuth
  useEffect(() => {
    if (searchParams.get('connected') === 'gmail') loadStatus();
  }, [searchParams, loadStatus]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-14 pb-4 flex flex-col gap-4">
        <div>
          <h1 className="text-white text-xl font-semibold tracking-tight">Actions</h1>
          <p className="text-[#333] text-xs mt-0.5">Inbox intelligence + content generation</p>
        </div>
        <div className="flex bg-[#111] rounded-xl p-1 gap-1">
          {(['inbox', 'content'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all capitalize ${
                tab === t ? 'bg-[#1e1e1e] text-white' : 'text-[#333] hover:text-[#666]'
              }`}>
              {t === 'inbox' ? 'Inbox' : 'Content'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'inbox'
          ? <InboxTab gmailEmails={gmailEmails} />
          : <ContentTab />
        }
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ActionsPage() {
  return (
    <Suspense>
      <ActionsInner />
    </Suspense>
  );
}
