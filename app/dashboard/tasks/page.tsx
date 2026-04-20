'use client';

import { useState, useEffect, useRef } from 'react';

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  scheduled_time?: string; // HH:MM
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  category: string;
  energy_level: 'deep_focus' | 'light_work' | 'quick_win';
  context_tag: string;
  friction_score: number;
  estimated_minutes?: number;
  actual_minutes?: number;
  blocked_by: string[];
  ai_suggestions?: { tools?: {name:string,reason:string,url:string}[], prompts?: string[], tips?: string[] };
  notes?: string;
  started_at?: string;
  why?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280'
};
const ENERGY_LABEL: Record<string, string> = {
  deep_focus: '🔴 Deep Focus', light_work: '🟡 Light Work', quick_win: '🟢 Quick Win'
};
const FRICTION_LABEL = ['', '😊', '🙂', '😐', '😬', '😤'];
const CATEGORY_COLOR: Record<string, string> = {
  design: '#8b5cf6', code: '#3b82f6', school: '#f59e0b',
  fitness: '#10b981', personal: '#ec4899', content: '#f97316', admin: '#6b7280'
};

const PX_PER_MIN = 1.5; // 90px per hour
const START_HOUR = 6;
const END_HOUR = 23;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatMins(mins?: number) {
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`.trim();
}

function isOverdue(due?: string) {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

function isToday(due?: string) {
  if (!due) return false;
  return new Date(due).toDateString() === new Date().toDateString();
}

function groupTasks(tasks: Task[]) {
  const todo = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  return {
    overdue: todo.filter(t => isOverdue(t.due_date)),
    today: todo.filter(t => isToday(t.due_date)),
    upcoming: todo.filter(t => t.due_date && !isOverdue(t.due_date) && !isToday(t.due_date)),
    someday: todo.filter(t => !t.due_date),
  };
}

// ─── Day Calendar View ─────────────────────────────────────────────────────────

function DayCalendarView({ tasks, onUpdate, onDelete }: {
  tasks: Task[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const nowOffset = (currentMins - START_HOUR * 60) * PX_PER_MIN;
  const totalHeight = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN;

  const active = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const todayScheduled = active.filter(t => t.scheduled_time && (isToday(t.due_date) || !t.due_date));
  const todayUnscheduled = active.filter(t => !t.scheduled_time && (isToday(t.due_date) || isOverdue(t.due_date)));
  const overdueScheduled = active.filter(t => t.scheduled_time && isOverdue(t.due_date));

  const calendarTasks = [...todayScheduled, ...overdueScheduled];

  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = Math.max(0, nowOffset - 120);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, [nowOffset]);

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Unscheduled strip */}
      {todayUnscheduled.length > 0 && (
        <div className="px-5 py-3 border-b border-[#1a1a1a]">
          <p className="text-[10px] uppercase tracking-wider text-[#444] mb-2 font-semibold">Unscheduled · Today</p>
          <div className="flex flex-col gap-1.5">
            {todayUnscheduled.map(t => (
              <div key={t.id} className="flex items-center gap-2.5 bg-[#141414] rounded-xl px-3 py-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLOR[t.category] || '#6b7280' }} />
                <span className={`text-xs flex-1 truncate ${isOverdue(t.due_date) ? 'text-red-400' : 'text-white'}`}>
                  {t.title}
                </span>
                {t.estimated_minutes && (
                  <span className="text-[#444] text-[10px] flex-shrink-0">{formatMins(t.estimated_minutes)}</span>
                )}
                <button onClick={() => onUpdate(t.id, { status: 'done' })}
                  className="w-4 h-4 rounded-full border border-[#333] hover:border-white transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hour grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: totalHeight }}>

          {/* Hour rows */}
          {hours.map(hour => {
            const top = (hour - START_HOUR) * 60 * PX_PER_MIN;
            const label = hour === 12 ? 'Noon' : hour > 12 ? `${hour - 12}pm` : `${hour}am`;
            return (
              <div key={hour} className="absolute left-0 right-0" style={{ top }}>
                <div className="flex items-start">
                  <span className="text-[#3a3a3a] text-[10px] w-14 flex-shrink-0 pl-5 -mt-2 select-none">{label}</span>
                  <div className="flex-1 border-t border-[#181818] mr-5" />
                </div>
              </div>
            );
          })}

          {/* Current time indicator */}
          {currentMins >= START_HOUR * 60 && currentMins <= END_HOUR * 60 && (
            <div className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
              style={{ top: nowOffset }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 ml-[46px] flex-shrink-0 shadow-[0_0_6px_#ef4444]" />
              <div className="flex-1 h-px bg-red-500 mr-5 opacity-60" />
            </div>
          )}

          {/* Task blocks */}
          {calendarTasks.map(task => {
            const startMins = timeToMinutes(task.scheduled_time!) - START_HOUR * 60;
            const duration = task.estimated_minutes || 30;
            const top = startMins * PX_PER_MIN;
            const height = Math.max(duration * PX_PER_MIN, 30);
            const color = CATEGORY_COLOR[task.category] || '#6b7280';
            const isRunning = task.status === 'in_progress';

            return (
              <div key={task.id}
                className="absolute left-14 right-5 rounded-xl overflow-hidden cursor-pointer group"
                style={{
                  top,
                  height,
                  backgroundColor: `${color}18`,
                  borderLeft: `3px solid ${color}`,
                  boxShadow: isRunning ? `0 0 0 1px ${color}40` : undefined,
                }}>
                <div className="px-2.5 py-1.5 h-full flex flex-col justify-center">
                  <p className="text-white text-xs font-medium leading-tight truncate">{task.title}</p>
                  {height > 44 && (
                    <p className="text-white/30 text-[10px] mt-0.5">
                      {task.scheduled_time} · {formatMins(task.estimated_minutes)}
                    </p>
                  )}
                </div>
                {/* Complete button on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdate(task.id, { status: 'done' }); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-[#444] opacity-0 group-hover:opacity-100 transition-opacity hover:border-white bg-black/40"
                />
              </div>
            );
          })}

          {/* Empty state */}
          {calendarTasks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-[#2a2a2a] text-sm">No scheduled tasks today</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task Card (List View) ─────────────────────────────────────────────────────

function TaskCard({ task, allTasks, onUpdate, onDelete }: {
  task: Task;
  allTasks: Task[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(task);
  const [showLockMsg, setShowLockMsg] = useState(false);

  const blockers = (task.blocked_by || [])
    .map(bid => allTasks.find(t => t.id === bid))
    .filter(Boolean) as Task[];
  const isLocked = blockers.some(b => b.status !== 'done');
  const lockerName = blockers.find(b => b.status !== 'done')?.title;

  function handleComplete() {
    if (isLocked) { setShowLockMsg(true); setTimeout(() => setShowLockMsg(false), 3000); return; }
    onUpdate(task.id, { status: 'done' });
  }

  function handleStart() {
    if (isLocked) { setShowLockMsg(true); setTimeout(() => setShowLockMsg(false), 3000); return; }
    onUpdate(task.id, { status: task.status === 'in_progress' ? 'todo' : 'in_progress' });
  }

  function saveEdit() {
    onUpdate(task.id, editData);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-4 flex flex-col gap-3">
        <input className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
          value={editData.title} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))} placeholder="Task title" />
        <textarea className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333] resize-none"
          rows={2} value={editData.description || ''} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} placeholder="Description" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.due_date || ''} onChange={e => setEditData(p => ({ ...p, due_date: e.target.value }))} />
          <input type="time" className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.scheduled_time || ''} onChange={e => setEditData(p => ({ ...p, scheduled_time: e.target.value || undefined }))}
            placeholder="Schedule time" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.estimated_minutes || ''} onChange={e => setEditData(p => ({ ...p, estimated_minutes: parseInt(e.target.value) }))} placeholder="Est. minutes" />
          <select className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.priority} onChange={e => setEditData(p => ({ ...p, priority: e.target.value as Task['priority'] }))}>
            {['urgent','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.energy_level} onChange={e => setEditData(p => ({ ...p, energy_level: e.target.value as Task['energy_level'] }))}>
            {['deep_focus','light_work','quick_win'].map(e => <option key={e} value={e}>{e.replace('_',' ')}</option>)}
          </select>
          <select className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.category} onChange={e => setEditData(p => ({ ...p, category: e.target.value }))}>
            {['design','code','school','fitness','personal','content','admin'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.context_tag} onChange={e => setEditData(p => ({ ...p, context_tag: e.target.value }))}>
            {['anywhere','computer','phone','gym','campus'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex items-center gap-2 bg-[#1e1e1e] rounded-xl px-3 py-2 border border-[#333]">
            <span className="text-[#666] text-xs">Friction:</span>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setEditData(p => ({ ...p, friction_score: n }))}
                className={`text-sm ${editData.friction_score >= n ? 'opacity-100' : 'opacity-30'}`}>
                {FRICTION_LABEL[n]}
              </button>
            ))}
          </div>
        </div>
        <textarea className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333] resize-none"
          rows={2} value={editData.notes || ''} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} placeholder="Notes" />
        <div className="flex gap-2">
          <button onClick={saveEdit} className="flex-1 bg-white text-[#0a0a0a] text-sm font-semibold rounded-xl py-2.5">Save</button>
          <button onClick={() => setEditing(false)} className="flex-1 bg-[#1e1e1e] text-[#888] text-sm rounded-xl py-2.5">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-3 transition-opacity ${
      isLocked ? 'border-[#1e1e1e] bg-[#0e0e0e] opacity-60' : 'border-[#1e1e1e] bg-[#141414]'
    } ${task.status === 'in_progress' ? 'border-[#333]' : ''}`}>

      {showLockMsg && (
        <div className="bg-[#1e1e1e] rounded-xl px-3 py-2 text-xs text-[#888]">
          🔒 Complete <span className="text-white font-medium">"{lockerName}"</span> first
        </div>
      )}

      {/* Top row */}
      <div className="flex items-start gap-3">
        <button onClick={handleComplete}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            isLocked ? 'border-[#333] cursor-not-allowed' :
            task.status === 'done' ? 'bg-white border-white' : 'border-[#444] hover:border-white'
          }`}>
          {isLocked ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          ) : task.status === 'done' ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : null}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${isLocked ? 'text-[#555]' : 'text-white'} ${task.status === 'done' ? 'line-through text-[#444]' : ''}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-[#555] text-xs mt-1 leading-relaxed">{task.description}</p>
          )}
        </div>

        <button onClick={() => setEditing(true)} className="text-[#333] hover:text-[#666] transition-colors flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ color: PRIORITY_COLOR[task.priority], backgroundColor: `${PRIORITY_COLOR[task.priority]}18` }}>
          {task.priority}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">
          {ENERGY_LABEL[task.energy_level]}
        </span>
        {task.context_tag !== 'anywhere' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">
            📍 {task.context_tag}
          </span>
        )}
        {task.estimated_minutes && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">
            ⏱ {formatMins(task.estimated_minutes)}
          </span>
        )}
        {task.scheduled_time && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">
            🕐 {task.scheduled_time}
          </span>
        )}
        {task.friction_score >= 4 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">
            {FRICTION_LABEL[task.friction_score]} friction
          </span>
        )}
        {task.due_date && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${isOverdue(task.due_date) ? 'bg-red-500/10 text-red-400' : 'bg-[#1e1e1e] text-[#666]'}`}>
            📅 {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2">
        {!isLocked && task.status !== 'done' && (
          <button onClick={handleStart}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              task.status === 'in_progress'
                ? 'bg-white text-[#0a0a0a] font-semibold'
                : 'bg-[#1e1e1e] text-[#666] hover:text-white'
            }`}>
            {task.status === 'in_progress' ? '⏸ Pause' : '▶ Start'}
          </button>
        )}
        <button onClick={() => setExpanded(p => !p)}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#1e1e1e] text-[#555] hover:text-[#888] transition-colors ml-auto">
          {expanded ? 'Hide ▲' : 'View more ▼'}
        </button>
      </div>

      {/* Expanded drawer */}
      {expanded && (
        <div className="flex flex-col gap-4 border-t border-[#1e1e1e] pt-3">
          {blockers.length > 0 && (
            <div>
              <p className="text-[#555] text-xs font-medium mb-1.5">🔒 Blocked by</p>
              {blockers.map(b => (
                <p key={b.id} className={`text-xs px-2 py-1 rounded-lg ${b.status === 'done' ? 'text-[#444] line-through' : 'text-[#888] bg-[#1a1a1a]'}`}>
                  {b.title}
                </p>
              ))}
            </div>
          )}

          {task.notes && (
            <div>
              <p className="text-[#555] text-xs font-medium mb-1">📝 Notes</p>
              <p className="text-[#777] text-xs leading-relaxed">{task.notes}</p>
            </div>
          )}

          {task.ai_suggestions?.tools && task.ai_suggestions.tools.length > 0 && (
            <div>
              <p className="text-[#555] text-xs font-medium mb-2">🛠 Suggested Tools</p>
              <div className="flex flex-col gap-2">
                {task.ai_suggestions.tools.map((tool, i) => (
                  <div key={i} className="bg-[#1a1a1a] rounded-xl p-3">
                    <p className="text-white text-xs font-medium">{tool.name}</p>
                    <p className="text-[#555] text-xs mt-0.5">{tool.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.ai_suggestions?.prompts && task.ai_suggestions.prompts.length > 0 && (
            <div>
              <p className="text-[#555] text-xs font-medium mb-2">💬 Useful Prompts</p>
              <div className="flex flex-col gap-1.5">
                {task.ai_suggestions.prompts.map((prompt, i) => (
                  <div key={i} className="bg-[#1a1a1a] rounded-xl px-3 py-2">
                    <p className="text-[#777] text-xs leading-relaxed">"{prompt}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.ai_suggestions?.tips && task.ai_suggestions.tips.length > 0 && (
            <div>
              <p className="text-[#555] text-xs font-medium mb-2">💡 Tips</p>
              <div className="flex flex-col gap-1.5">
                {task.ai_suggestions.tips.map((tip, i) => (
                  <p key={i} className="text-[#666] text-xs leading-relaxed">• {tip}</p>
                ))}
              </div>
            </div>
          )}

          {task.actual_minutes && (
            <p className="text-[#444] text-xs">✓ Completed in {formatMins(task.actual_minutes)} (estimated {formatMins(task.estimated_minutes)})</p>
          )}

          <button onClick={() => onDelete(task.id)}
            className="text-red-900 text-xs hover:text-red-500 transition-colors text-left">
            Delete task
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Suggestion Card ───────────────────────────────────────────────────────────

function SuggestionCard({ suggestion, onAdd }: { suggestion: Task & { why?: string }, onAdd: (s: Task) => void }) {
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');

  function handleAdd() {
    if (state !== 'idle') return;
    setState('adding');
    onAdd(suggestion);
    setTimeout(() => setState('added'), 300);
  }

  return (
    <div className={`flex-shrink-0 w-72 rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-300 ${
      state === 'added' ? 'border-white/20 bg-white/5 scale-[0.97] opacity-60' : 'border-[#1e1e1e] bg-[#141414]'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-white text-sm font-medium leading-snug flex-1">{suggestion.title}</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-semibold"
          style={{ color: PRIORITY_COLOR[suggestion.priority], backgroundColor: `${PRIORITY_COLOR[suggestion.priority]}18` }}>
          {suggestion.priority}
        </span>
      </div>
      {suggestion.why && <p className="text-[#555] text-xs leading-relaxed">{suggestion.why}</p>}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">{ENERGY_LABEL[suggestion.energy_level]}</span>
        {suggestion.estimated_minutes && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">⏱ {formatMins(suggestion.estimated_minutes)}</span>
        )}
        {suggestion.due_date && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">
            📅 {new Date(suggestion.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      <button onClick={handleAdd} disabled={state !== 'idle'}
        className={`w-full text-xs font-semibold rounded-xl py-2.5 transition-all duration-200 active:scale-[0.97] ${
          state === 'added'
            ? 'bg-white/10 text-white/60 cursor-default'
            : state === 'adding'
            ? 'bg-[#e0e0e0] text-[#0a0a0a]/60 cursor-default'
            : 'bg-white text-[#0a0a0a] hover:bg-[#e0e0e0]'
        }`}>
        {state === 'added' ? '✓ Added' : state === 'adding' ? 'Adding...' : '+ Add to Tasks'}
      </button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [suggestions, setSuggestions] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  useEffect(() => { fetchTasks(); fetchSuggestions(); }, []);

  async function fetchTasks() {
    setLoadingTasks(true);
    const res = await fetch('/api/tasks/list');
    if (res.ok) { const d = await res.json(); setTasks(d.tasks || []); }
    setLoadingTasks(false);
  }

  async function fetchSuggestions() {
    setLoadingSuggestions(true);
    const res = await fetch('/api/tasks/suggest');
    if (res.ok) { const d = await res.json(); setSuggestions(d.suggestions || []); }
    setLoadingSuggestions(false);
  }

  async function addSuggestion(s: Task) {
    const tempId = `temp-${Date.now()}`;
    const optimistic = { ...s, id: tempId, status: 'todo' as const, source: 'suggested' };
    setTasks(prev => [optimistic, ...prev]);

    const res = await fetch('/api/tasks/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, source: 'suggested' }),
    });
    if (res.ok) {
      const d = await res.json();
      setTasks(prev => prev.map(t => t.id === tempId ? d.task : t));
      setSuggestions(prev => prev.filter(x => x.title !== s.title));
    } else {
      setTasks(prev => prev.filter(t => t.id !== tempId));
    }
  }

  async function quickAdd() {
    if (!newTitle.trim()) return;
    const res = await fetch('/api/tasks/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), source: 'manual' }),
    });
    if (res.ok) { const d = await res.json(); setTasks(prev => [d.task, ...prev]); }
    setNewTitle(''); setAddingTask(false);
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch('/api/tasks/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) { const d = await res.json(); setTasks(prev => prev.map(t => t.id === id ? d.task : t)); }
  }

  async function deleteTask(id: string) {
    await fetch('/api/tasks/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'cancelled' }),
    });
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  const grouped = groupTasks(tasks.filter(t => t.status !== 'cancelled'));
  const done = tasks.filter(t => t.status === 'done');
  const activeCount = grouped.overdue.length + grouped.today.length + grouped.upcoming.length + grouped.someday.length;

  function Section({ label, items, color }: { label: string, items: Task[], color: string }) {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color }}>{label}</p>
        {items.map(t => <TaskCard key={t.id} task={t} allTasks={tasks} onUpdate={updateTask} onDelete={deleteTask} />)}
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#0a0a0a] overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-white text-xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-[#444] text-xs mt-0.5">{today} · {activeCount} active</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-[#141414] border border-[#1e1e1e] rounded-xl p-1 gap-1">
            <button
              onClick={() => setView('calendar')}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                view === 'calendar' ? 'bg-white' : 'hover:bg-[#1e1e1e]'
              }`}>
              {/* Calendar grid icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={view === 'calendar' ? '#0a0a0a' : '#555'} strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                view === 'list' ? 'bg-white' : 'hover:bg-[#1e1e1e]'
              }`}>
              {/* List icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={view === 'list' ? '#0a0a0a' : '#555'} strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/>
                <circle cx="3" cy="18" r="1" fill="currentColor"/>
              </svg>
            </button>
          </div>

          {/* Add button */}
          <button onClick={() => setAddingTask(p => !p)}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-[#e0e0e0] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Quick add */}
      {addingTask && (
        <div className="px-5 pb-4 flex gap-2 flex-shrink-0">
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && quickAdd()}
            placeholder="Task title..."
            className="flex-1 bg-[#141414] text-white text-sm rounded-xl px-4 py-2.5 outline-none border border-[#2a2a2a] placeholder:text-[#444]" />
          <button onClick={quickAdd} className="bg-white text-[#0a0a0a] text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-[#e0e0e0] transition-colors">Add</button>
        </div>
      )}

      {/* Suggestions strip */}
      {(loadingSuggestions || suggestions.length > 0) && (
        <div className="pb-4 flex-shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#444] px-5 mb-3">✨ Suggested for you</p>
          {loadingSuggestions ? (
            <div className="px-5 flex gap-3">
              {[1,2,3].map(i => <div key={i} className="flex-shrink-0 w-72 h-36 bg-[#141414] rounded-2xl border border-[#1e1e1e] animate-pulse" />)}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
              {suggestions.map((s, i) => <SuggestionCard key={i} suggestion={s} onAdd={addSuggestion} />)}
            </div>
          )}
        </div>
      )}

      {/* Calendar or List view */}
      {loadingTasks ? (
        <div className="px-5 flex flex-col gap-3 pb-8">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-[#141414] rounded-2xl border border-[#1e1e1e] animate-pulse" />)}
        </div>
      ) : view === 'calendar' ? (
        <DayCalendarView tasks={tasks} onUpdate={updateTask} onDelete={deleteTask} />
      ) : (
        <div className="px-5 flex flex-col gap-6 pb-8 overflow-y-auto flex-1">
          <Section label="⚠ Overdue" items={grouped.overdue} color="#ef4444" />
          <Section label="Today" items={grouped.today} color="#ffffff" />
          <Section label="Upcoming" items={grouped.upcoming} color="#6b7280" />
          <Section label="Someday" items={grouped.someday} color="#374151" />

          {done.length > 0 && (
            <div>
              <button onClick={() => setShowDone(p => !p)}
                className="text-xs text-[#333] hover:text-[#555] transition-colors uppercase tracking-wider font-semibold">
                {showDone ? '▼' : '▶'} Completed ({done.length})
              </button>
              {showDone && (
                <div className="flex flex-col gap-2 mt-2">
                  {done.map(t => <TaskCard key={t.id} task={t} allTasks={tasks} onUpdate={updateTask} onDelete={deleteTask} />)}
                </div>
              )}
            </div>
          )}

          {Object.values(grouped).every(g => g.length === 0) && done.length === 0 && (
            <div className="text-center py-16">
              <p className="text-[#333] text-sm">No tasks yet.</p>
              <p className="text-[#222] text-xs mt-1">Tap + or check suggestions above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
