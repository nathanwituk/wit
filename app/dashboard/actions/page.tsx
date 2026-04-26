'use client';

import { useState } from 'react';

type Tab = 'inbox' | 'content';

// ─── Gmail connect CTA ────────────────────────────────────────────────────────
function ConnectPrompt({ provider, onConnect }: { provider: 'gmail' | 'outlook'; onConnect: () => void }) {
  const isGmail = provider === 'gmail';
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-[#1e1e1e] flex items-center justify-center">
        {isGmail ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6Z" stroke="#555" strokeWidth="1.8" strokeLinecap="round"/>
            <polyline points="2,6 12,13 22,6" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6Z" stroke="#555" strokeWidth="1.8" strokeLinecap="round"/>
            <polyline points="2,6 12,13 22,6" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-white text-sm font-medium">Connect {isGmail ? 'Gmail' : 'Outlook'}</p>
        <p className="text-[#444] text-xs leading-relaxed max-w-xs">
          Wit reads your inbox, surfaces what matters, and keeps your schedule in sync — without you lifting a finger.
        </p>
      </div>
      <button
        onClick={onConnect}
        className="bg-white text-[#0a0a0a] text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#e0e0e0] active:scale-[0.97] transition-all"
      >
        Connect {isGmail ? 'Gmail' : 'Outlook'}
      </button>
    </div>
  );
}

// ─── Inbox tab ────────────────────────────────────────────────────────────────
function InboxTab() {
  const [gmailConnected] = useState(false);
  const [outlookConnected] = useState(false);

  if (!gmailConnected && !outlookConnected) {
    return (
      <div className="flex flex-col flex-1 overflow-y-auto">
        <ConnectPrompt provider="gmail" onConnect={() => {
          window.location.href = '/api/actions/auth/gmail';
        }} />

        <div className="mx-5 border-t border-[#141414]" />

        <div className="flex flex-col items-center gap-3 py-10 px-8 text-center">
          <p className="text-[#333] text-xs font-medium uppercase tracking-wider">Also available</p>
          <button
            onClick={() => { window.location.href = '/api/actions/auth/outlook'; }}
            className="flex items-center gap-2.5 bg-[#141414] border border-[#1e1e1e] text-[#888] text-sm px-5 py-2.5 rounded-xl hover:border-[#333] hover:text-white transition-all active:scale-[0.97]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <polyline points="2,6 12,13 22,6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Connect Outlook
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-5 py-4 gap-3">
      {/* Email cards will render here once connected */}
      <p className="text-[#444] text-xs text-center py-8">Loading your inbox...</p>
    </div>
  );
}

// ─── Script card ──────────────────────────────────────────────────────────────
function ScriptCard({ script, onCopy, onDelete }: {
  script: { id: string; topic: string; hook: string; body: string; cta: string; talkTime: string };
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(section: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(section);
    onCopy(text);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="rounded-2xl border border-[#1e1e1e] bg-[#0e0e0e] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#141414]">
        <div className="flex flex-col gap-0.5">
          <p className="text-white text-sm font-medium">{script.topic}</p>
          <p className="text-[#444] text-[10px]">~{script.talkTime} talk time</p>
        </div>
        <button
          onClick={() => onDelete(script.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#333] hover:text-[#888] hover:bg-[#1a1a1a] transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {[
        { key: 'hook', label: 'Hook', sublabel: '0–3s', text: script.hook },
        { key: 'body', label: 'Body', sublabel: 'main content', text: script.body },
        { key: 'cta', label: 'CTA', sublabel: 'call to action', text: script.cta },
      ].map(({ key, label, sublabel, text }) => (
        <div key={key} className="px-4 py-3 border-b border-[#141414] last:border-b-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white">{label}</span>
              <span className="text-[10px] text-[#333]">{sublabel}</span>
            </div>
            <button
              onClick={() => copy(key, text)}
              className="flex items-center gap-1.5 text-[10px] text-[#444] hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-[#1a1a1a]"
            >
              {copied === key ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="text-[#22c55e]">Copied</span>
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="text-[#888] text-xs leading-relaxed">{text}</p>
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
    } catch {
      // silent fail — will add error state in next pass
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Input */}
      <div className="px-5 py-4 border-b border-[#141414] flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()}
            placeholder="Topic or goal (e.g. 'grow my design audience')"
            className="flex-1 bg-[#141414] border border-[#1e1e1e] text-white text-sm rounded-xl px-4 py-3 outline-none placeholder:text-[#333] focus:border-[#333] transition-colors"
          />
          <button
            onClick={generate}
            disabled={!topic.trim() || loading}
            className="bg-white text-[#0a0a0a] text-sm font-semibold px-4 py-3 rounded-xl hover:bg-[#e0e0e0] active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
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
        <p className="text-[#333] text-[10px] mt-2 px-1">Generates a TikTok/Reel script — hook, body, CTA — with research-backed framing.</p>
      </div>

      {/* Scripts list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {scripts.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-[#2a2a2a] text-sm">No scripts yet</p>
            <p className="text-[#222] text-xs">Enter a topic above to generate your first script</p>
          </div>
        )}
        {scripts.map(script => (
          <ScriptCard
            key={script.id}
            script={script}
            onCopy={() => {}}
            onDelete={id => setScripts(prev => prev.filter(s => s.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ActionsPage() {
  const [tab, setTab] = useState<Tab>('inbox');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-14 pb-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-semibold tracking-tight">Actions</h1>
            <p className="text-[#444] text-xs mt-0.5">Inbox intelligence + content generation</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-[#111] rounded-xl p-1 gap-1">
          {(['inbox', 'content'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all capitalize ${
                tab === t ? 'bg-[#1e1e1e] text-white' : 'text-[#444] hover:text-[#888]'
              }`}
            >
              {t === 'inbox' ? 'Inbox' : 'Content'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'inbox' ? <InboxTab /> : <ContentTab />}
      </div>
    </div>
  );
}
