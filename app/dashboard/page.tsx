'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: ScheduleAction[];
}

interface ScheduleAction {
  type: 'propose_task' | 'update_task_schedule' | 'plan_full_day';
  input: Record<string, unknown>;
  status?: 'pending' | 'confirmed' | 'dismissed';
}

interface DayPlanItem {
  time: string;
  title: string;
  duration_minutes: number;
  category: string;
  task_id?: string;
  priority?: string;
  energy_level?: string;
}

interface ConversationMeta {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
}

interface ConversationEntry extends ConversationMeta {
  messages: Message[];
}

const SUGGESTIONS = [
  "I'm awake, plan my day",
  "What should I focus on right now?",
  "I just finished my workout",
  "How's my week looking?",
  "I'm about to start a deep work session",
];

const CATEGORY_ICON: Record<string, string> = {
  fitness: '💪', code: '💻', design: '🎨', school: '📚',
  personal: '🧠', content: '✍️', admin: '📋',
};

// ─── Task Proposal Card ────────────────────────────────────────────────────────
function TaskProposalCard({
  action,
  onConfirm,
  onDismiss,
}: {
  action: ScheduleAction;
  onConfirm: (action: ScheduleAction) => void;
  onDismiss: (action: ScheduleAction) => void;
}) {
  const { input } = action;
  const category = (input.category as string) || 'personal';
  const icon = CATEGORY_ICON[category] || '📋';
  const time = input.scheduled_time as string | undefined;
  const mins = input.estimated_minutes as number | undefined;

  function fmtTime(t: string) {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  function fmtMins(m: number) {
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
  }

  if (action.status === 'confirmed') {
    return (
      <div className="mt-2 bg-[#0d1f0d] border border-[#1a3a1a] rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center flex-shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span className="text-[#4ade80] text-sm">Added to schedule</span>
      </div>
    );
  }

  if (action.status === 'dismissed') return null;

  return (
    <div className="mt-2 bg-[#141414] border border-[#252525] rounded-xl px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">{input.title as string}</p>
          <p className="text-[#555] text-xs mt-0.5">
            {category}
            {time ? ` · ${fmtTime(time)}` : ''}
            {mins ? ` · ${fmtMins(mins)}` : ''}
            {input.due_date ? ` · ${input.due_date === new Date().toISOString().slice(0, 10) ? 'today' : input.due_date}` : ''}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onConfirm(action)}
          className="flex-1 bg-white text-[#0a0a0a] text-xs font-semibold rounded-lg py-2 hover:bg-[#e0e0e0] transition-colors active:scale-[0.98]"
        >
          Add to schedule
        </button>
        <button
          onClick={() => onDismiss(action)}
          className="px-4 bg-[#1e1e1e] text-[#666] text-xs rounded-lg py-2 hover:bg-[#252525] transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Day Plan Card ─────────────────────────────────────────────────────────────
function DayPlanCard({ action }: { action: ScheduleAction }) {
  const { input } = action;
  const plan = (input.plan as DayPlanItem[]) || [];

  function fmtTime(t: string) {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  function fmtMins(m: number) {
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
  }

  if (action.status === 'dismissed') return null;

  // Auto-confirmed: show a compact summary (tasks already added to calendar)
  if (action.status === 'confirmed') {
    return (
      <div className="mt-2 bg-[#0d1f0d] border border-[#1a3a1a] rounded-xl px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center flex-shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span className="text-[#4ade80] text-sm font-medium">{plan.length} tasks added to calendar</span>
        </div>
        <div className="flex flex-col gap-1 pl-8">
          {plan.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[#2d6a2d] text-[10px] font-mono w-12 flex-shrink-0">{fmtTime(item.time)}</span>
              <span className="text-[#4ade80]/70 text-xs truncate">{item.title}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback card (shown briefly before auto-confirm kicks in)
  return (
    <div className="mt-2 bg-[#141414] border border-[#252525] rounded-xl overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <p className="text-[#888] text-[10px] uppercase tracking-wider font-semibold mb-3">Today&apos;s Plan</p>
        <div className="flex flex-col gap-2">
          {plan.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-[#444] text-xs w-14 flex-shrink-0 font-mono pt-0.5">
                {fmtTime(item.time)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm leading-none">{CATEGORY_ICON[item.category] || '📋'}</span>
                  <span className="text-white text-sm truncate">{item.title}</span>
                </div>
                <span className="text-[#444] text-[10px]">{fmtMins(item.duration_minutes)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Update Confirmation Card ──────────────────────────────────────────────────
function UpdateConfirmCard({ action }: { action: ScheduleAction }) {
  const { input } = action;
  if (action.status === 'confirmed') {
    const isDone = input.status === 'done';
    return (
      <div className="mt-2 bg-[#0d1f0d] border border-[#1a3a1a] rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center flex-shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span className="text-[#4ade80] text-sm">{isDone ? 'Task marked complete' : 'Schedule updated'}</span>
      </div>
    );
  }
  return null;
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [pendingActions, setPendingActions] = useState<ScheduleAction[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<ConversationMeta[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const pendingActionsRef = useRef<ScheduleAction[]>([]);
  pendingActionsRef.current = pendingActions;
  const conversationId = useRef(`wit_${Date.now()}`);

  // Compute local date once on mount
  const localDate = useRef(
    (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })()
  ).current;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-save conversation to localStorage after each assistant reply
  useEffect(() => {
    if (messages.length < 2) return;
    const firstUser = messages.find(m => m.role === 'user');
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    const entry: ConversationEntry = {
      id: conversationId.current,
      title: (firstUser?.content ?? 'Conversation').slice(0, 60),
      preview: lastMsg.content.slice(0, 100),
      createdAt: new Date().toISOString(),
      messages,
    };

    try {
      localStorage.setItem(`wit_conv_${entry.id}`, JSON.stringify(entry));
      const raw = localStorage.getItem('wit_conv_index');
      const index: ConversationMeta[] = raw ? JSON.parse(raw) : [];
      const meta: ConversationMeta = { id: entry.id, title: entry.title, preview: entry.preview, createdAt: entry.createdAt };
      const existing = index.findIndex(e => e.id === entry.id);
      if (existing >= 0) index[existing] = meta;
      else index.unshift(meta);
      localStorage.setItem('wit_conv_index', JSON.stringify(index.slice(0, 100)));
    } catch {}
  }, [messages]);

  function openHistory() {
    try {
      const raw = localStorage.getItem('wit_conv_index');
      setHistoryList(raw ? JSON.parse(raw) : []);
    } catch {
      setHistoryList([]);
    }
    setShowHistory(true);
  }

  function loadConversation(id: string) {
    try {
      const raw = localStorage.getItem(`wit_conv_${id}`);
      if (raw) {
        const conv: ConversationEntry = JSON.parse(raw);
        setMessages(conv.messages);
        conversationId.current = `wit_${Date.now()}`; // new ID so next message starts fresh
      }
    } catch {}
    setShowHistory(false);
  }

  function startNewChat() {
    setMessages([]);
    conversationId.current = `wit_${Date.now()}`;
    setShowHistory(false);
  }

  // Execute a confirmed task creation
  const executeCreateTask = useCallback(async (input: Record<string, unknown>) => {
    await fetch('/api/tasks/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        category: input.category,
        due_date: input.due_date || localDate,
        scheduled_time: input.scheduled_time || null,
        estimated_minutes: input.estimated_minutes || null,
        priority: input.priority || 'medium',
        energy_level: input.energy_level || 'light_work',
        source: 'chat',
      }),
    });
  }, [localDate]);

  // Execute an update to an existing task
  const executeUpdateTask = useCallback(async (input: Record<string, unknown>) => {
    await fetch('/api/tasks/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: input.task_id,
        ...(input.scheduled_time ? { scheduled_time: input.scheduled_time } : {}),
        ...(input.estimated_minutes ? { estimated_minutes: input.estimated_minutes } : {}),
        ...(input.status ? { status: input.status } : {}),
      }),
    });
  }, []);


  function updateActionStatus(msgIndex: number, actionIndex: number, status: ScheduleAction['status']) {
    setMessages(prev =>
      prev.map((m, mi) => {
        if (mi !== msgIndex || !m.actions) return m;
        return {
          ...m,
          actions: m.actions.map((a, ai) => (ai === actionIndex ? { ...a, status } : a)),
        };
      })
    );
  }

  async function handleConfirmTask(msgIndex: number, actionIndex: number, action: ScheduleAction) {
    updateActionStatus(msgIndex, actionIndex, 'confirmed');
    setPendingActions(prev => prev.filter(a => a !== action));
    await executeCreateTask(action.input);
  }

  async function handleDismissAction(msgIndex: number, actionIndex: number, action: ScheduleAction) {
    updateActionStatus(msgIndex, actionIndex, 'dismissed');
    setPendingActions(prev => prev.filter(a => a !== action));
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Build extra context from any pending unconfirmed actions
    const pending = pendingActionsRef.current.filter(a => !a.status || a.status === 'pending');
    let extraContext: string | undefined;
    if (pending.length > 0) {
      const pendingTask = pending.find(a => a.type === 'propose_task');
      if (pendingTask) {
        extraContext = `PENDING TASK PROPOSAL (Nathan is providing more info):\n${JSON.stringify(pendingTask.input, null, 2)}\nIf Nathan's reply gives you the missing info, call propose_task again with complete details and NO follow_up_question.`;
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          localDate,
          extraContext,
        }),
      });

      const data = await res.json();
      let content = data.text || data.error || 'No response — try again.';
      const actions: ScheduleAction[] = (data.actions || []).map((a: ScheduleAction) => ({
        ...a,
        status: 'pending' as const,
      }));

      // plan_full_day is handled server-side — tasks already in DB
      if (data.tasksCreated > 0) {
        // Signal the Tasks page to re-fetch
        try { localStorage.setItem('wit_tasks_updated', Date.now().toString()); } catch {}
        // If Claude didn't include a text response, add a confirmation
        if (!content.trim()) {
          content = `Done — ${data.tasksCreated} task${data.tasksCreated === 1 ? '' : 's'} added to your calendar.`;
        }
      }

      // Auto-execute update_task_schedule — low-risk, apply immediately
      const finalActions: ScheduleAction[] = [];
      for (const action of actions) {
        if (action.type === 'update_task_schedule') {
          await executeUpdateTask(action.input);
          try { localStorage.setItem('wit_tasks_updated', Date.now().toString()); } catch {}
          finalActions.push({ ...action, status: 'confirmed' });
        } else {
          finalActions.push(action);
        }
      }

      // Track pending propose_task actions (need user confirmation)
      const pendingNew = finalActions.filter(
        a => a.type === 'propose_task' && a.status === 'pending'
      );
      setPendingActions(pendingNew);

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content, actions: finalActions.length > 0 ? finalActions : undefined },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong — try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      sendMessage(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isFirstMessage = messages.length === 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
              <span className="text-[#0a0a0a] font-bold text-xs">W</span>
            </div>
            <span className="text-white font-semibold tracking-tight">Wit</span>
          </div>
          <button
            onClick={openHistory}
            className="flex items-center gap-1.5 text-[#333] hover:text-[#666] transition-colors pl-0.5"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="text-[10px] tracking-wide">History</span>
          </button>
        </div>
        <span className="text-[#333] text-xs">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowHistory(false)} />
          {/* Drawer */}
          <div className="relative w-72 max-w-[85vw] bg-[#0f0f0f] border-r border-[#1a1a1a] flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
              <p className="text-white text-sm font-semibold">Chat History</p>
              <button onClick={() => setShowHistory(false)} className="text-[#444] hover:text-[#888] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <button
              onClick={startNewChat}
              className="mx-4 mt-4 mb-2 flex items-center gap-2 bg-white text-[#0a0a0a] text-xs font-semibold rounded-xl px-4 py-2.5 hover:bg-[#e0e0e0] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New chat
            </button>

            <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1">
              {historyList.length === 0 ? (
                <p className="text-[#333] text-xs text-center mt-8">No conversations yet.</p>
              ) : (
                historyList.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className="text-left px-3 py-3 rounded-xl hover:bg-[#1a1a1a] transition-colors group"
                  >
                    <p className="text-[#ccc] text-xs font-medium truncate group-hover:text-white transition-colors">
                      {conv.title}
                    </p>
                    <p className="text-[#333] text-[10px] mt-0.5 truncate leading-relaxed">
                      {conv.preview}
                    </p>
                    <p className="text-[#252525] text-[10px] mt-1">
                      {new Date(conv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">

        {isFirstMessage && (
          <div className="flex flex-col gap-6 mt-8">
            <div className="text-center">
              <p className="text-[#555] text-sm mb-1">Good {getTimeOfDay()}, Nathan.</p>
              <p className="text-white text-xl font-medium tracking-tight">What&apos;s on your mind?</p>
            </div>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left bg-[#141414] text-[#888] text-sm rounded-xl px-4 py-3 hover:bg-[#1a1a1a] hover:text-white transition-colors border border-[#1e1e1e]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, msgIdx) => (
          <div key={msgIdx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-white text-[#0a0a0a] rounded-br-sm'
                  : 'bg-[#141414] text-[#e0e0e0] rounded-bl-sm border border-[#1e1e1e]'
              }`}
            >
              {m.content}
            </div>

            {/* Action cards rendered below assistant messages */}
            {m.role === 'assistant' && m.actions && m.actions.length > 0 && (
              <div className="w-full max-w-[85%] flex flex-col gap-2 mt-1">
                {m.actions.map((action, actionIdx) => {
                  if (action.type === 'propose_task') {
                    return (
                      <TaskProposalCard
                        key={actionIdx}
                        action={action}
                        onConfirm={a => handleConfirmTask(msgIdx, actionIdx, a)}
                        onDismiss={a => handleDismissAction(msgIdx, actionIdx, a)}
                      />
                    );
                  }
                  if (action.type === 'plan_full_day') {
                    return <DayPlanCard key={actionIdx} action={action} />;
                  }
                  if (action.type === 'update_task_schedule') {
                    return <UpdateConfirmCard key={actionIdx} action={action} />;
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-[#444] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-[#444] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-[#444] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 pb-6 pt-2 border-t border-[#1a1a1a]">
        {/* Pending action hint */}
        {pendingActions.some(a => a.type === 'propose_task' && a.status === 'pending') && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-[#555] text-xs">Waiting on more info — just reply</span>
          </div>
        )}
        <div className="flex items-end gap-2 bg-[#141414] rounded-2xl border border-[#1e1e1e] px-4 py-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Wit anything..."
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-[#444] outline-none resize-none leading-relaxed"
            style={{ maxHeight: '120px' }}
          />
          <div className="flex items-center gap-2 pb-0.5">
            <button
              onClick={startVoice}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                listening ? 'bg-red-500' : 'bg-[#2a2a2a] hover:bg-[#333]'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-full bg-white flex items-center justify-center disabled:opacity-20 hover:bg-[#e0e0e0] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
