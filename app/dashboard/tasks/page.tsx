'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  scheduled_time?: string;
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

// ─── Date utilities (string-based — no timezone bugs) ─────────────────────────
function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function localTimeStr(d = new Date()): string {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function navigateDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}
function formatDateHeader(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const today = localDateStr();
  const yesterday = navigateDate(today, -1);
  const tomorrow = navigateDate(today, 1);
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  if (date === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatDateSub(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function isOverdue(due?: string): boolean {
  if (!due) return false;
  return due < localDateStr();
}
function isToday(due?: string): boolean {
  return due === localDateStr();
}
function getUserTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'America/Chicago'; }
}

// ─── Constants ────────────────────────────────────────────────────────────────
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

const PX_PER_MIN = 1.5;
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
function hourLabel(h: number): string {
  if (h === 12) return 'Noon';
  return h > 12 ? `${h-12}pm` : `${h}am`;
}

// Find the next open 30-min slot on a given date, avoiding existing scheduled tasks
// `reservedSlots` lets callers pre-reserve slots (so multiple suggestions don't collide)
function findNextAvailableSlot(
  tasks: Task[],
  date: string,
  durationMins: number = 30,
  reservedSlots: Array<{ start: number; end: number }> = []
): string {
  const now = new Date();
  const isToday_ = date === localDateStr();

  // Start from now (rounded up to next 30 min) if today, else 8am
  let startMins = isToday_
    ? Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30
    : 8 * 60;
  startMins = Math.max(startMins, 6 * 60); // never before 6am

  const scheduled = tasks.filter(
    t => t.due_date === date && t.scheduled_time && t.status !== 'done' && t.status !== 'cancelled'
  ).map(t => ({
    start: timeToMinutes(t.scheduled_time!),
    end: timeToMinutes(t.scheduled_time!) + (t.estimated_minutes || 30),
  }));

  const allBlocked = [...scheduled, ...reservedSlots];

  for (let slot = startMins; slot < 22 * 60; slot += 30) {
    const slotEnd = slot + durationMins;
    const hasConflict = allBlocked.some(b => b.start < slotEnd && b.end > slot);
    if (!hasConflict) {
      return `${String(Math.floor(slot / 60)).padStart(2, '0')}:${String(slot % 60).padStart(2, '0')}`;
    }
  }
  return '09:00'; // fallback
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function ConfettiBurst() {
  const items = [
    { c:'#ef4444', tx:'-22px', ty:'-32px' }, { c:'#f97316', tx:'22px', ty:'-32px' },
    { c:'#eab308', tx:'-38px', ty:'-10px' }, { c:'#10b981', tx:'38px', ty:'-10px' },
    { c:'#3b82f6', tx:'-22px', ty:'24px'  }, { c:'#8b5cf6', tx:'22px', ty:'24px'  },
    { c:'#ec4899', tx:'0px',   ty:'-44px' }, { c:'#fff',    tx:'0px',  ty:'30px'  },
    { c:'#ef4444', tx:'-14px', ty:'38px'  }, { c:'#f97316', tx:'14px', ty:'-18px' },
  ];
  return (
    <>
      <style>{`
        @keyframes confettiBurst {
          0%   { opacity:1; transform: translate(-50%,-50%) scale(1); }
          100% { opacity:0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.4); }
        }
      `}</style>
      {items.map((item, i) => (
        <div key={i} className="absolute w-2 h-2 rounded-sm pointer-events-none z-50"
          style={{
            backgroundColor: item.c, top: '50%', left: '50%',
            ['--tx' as string]: item.tx, ['--ty' as string]: item.ty,
            animation: `confettiBurst 0.65s ${i * 35}ms ease-out forwards`,
          }} />
      ))}
    </>
  );
}

// ─── Day Calendar View ────────────────────────────────────────────────────────
function DayCalendarView({
  tasks, selectedDate, onUpdate, onDelete, onQuickCreate, onEdit
}: {
  tasks: Task[];
  selectedDate: string;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onQuickCreate: (time: string) => void;
  onEdit: (task: Task) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const isSelectedToday = selectedDate === localDateStr();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const nowOffset = (currentMins - START_HOUR * 60) * PX_PER_MIN;
  const totalHeight = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN;
  const [confettiId, setConfettiId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [drag, setDrag] = useState<{ taskId: string; touchOffset: number; snappedMins: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragInitTouchY = useRef(0);
  const dragRef = useRef<{ taskId: string; touchOffset: number; snappedMins: number } | null>(null);
  dragRef.current = drag;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Filter tasks for this date
  const dayTasks = tasks.filter(t =>
    t.status !== 'cancelled' && t.due_date === selectedDate
  );
  const overdueTasks = selectedDate === localDateStr()
    ? tasks.filter(t => t.status !== 'cancelled' && t.status !== 'done' && isOverdue(t.due_date))
    : [];

  // Separate active vs done clearly
  const scheduledActive = dayTasks.filter(t => t.scheduled_time && t.status !== 'done');
  const scheduledDone   = dayTasks.filter(t => t.scheduled_time && t.status === 'done');
  const unscheduledActive = dayTasks.filter(t => !t.scheduled_time && t.status !== 'done');
  const allDone = [...scheduledDone, ...dayTasks.filter(t => !t.scheduled_time && t.status === 'done')];
  const allUnscheduled = [...overdueTasks.filter(t => !t.scheduled_time), ...unscheduledActive];
  // Keep scheduledTasks as all scheduled for grid rendering (active only in grid)
  const scheduledTasks = scheduledActive;

  useEffect(() => {
    if (scrollRef.current && isSelectedToday) {
      scrollRef.current.scrollTop = Math.max(0, nowOffset - 120);
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - START_HOUR) * 60 * PX_PER_MIN; // scroll to 8am
    }
  }, [selectedDate]);

  // Document-level touch handlers while drag is active (passive: false to allow preventDefault)
  const isDragging = drag !== null;
  useEffect(() => {
    if (!isDragging) return;
    function onMove(e: TouchEvent) {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const touch = e.touches[0];
      const gridRect = scrollRef.current?.getBoundingClientRect();
      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      if (!gridRect) return;
      const taskContainerY = (touch.clientY - d.touchOffset) - gridRect.top + scrollTop;
      const rawMins = taskContainerY / PX_PER_MIN + START_HOUR * 60;
      const snapped = Math.min(Math.max(Math.round(rawMins / 30) * 30, START_HOUR * 60), (END_HOUR - 1) * 60);
      if (snapped !== d.snappedMins) {
        navigator.vibrate?.(8);
        setDrag(prev => prev ? { ...prev, snappedMins: snapped } : null);
      }
    }
    function onEnd() {
      const d = dragRef.current;
      if (!d) return;
      const h = Math.floor(d.snappedMins / 60);
      const m = d.snappedMins % 60;
      onUpdateRef.current(d.taskId, { scheduled_time: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` });
      setDrag(null);
    }
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    return () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [isDragging]);

  function handleComplete(task: Task) {
    if (task.status === 'done') {
      onUpdate(task.id, { status: 'todo' });
    } else {
      setConfettiId(task.id);
      setTimeout(() => setConfettiId(null), 800);
      onUpdate(task.id, { status: 'done' });
    }
  }

  function handleSlotTap(hour: number) {
    const time = `${String(hour).padStart(2,'0')}:00`;
    onQuickCreate(time);
  }

  function cancelHold() {
    if (holdTimerRef.current !== null) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
  }

  function handleTaskTouchStart(e: React.TouchEvent, task: Task, taskTop: number) {
    dragInitTouchY.current = e.touches[0].clientY;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      navigator.vibrate?.(25);
      const gridRect = scrollRef.current?.getBoundingClientRect();
      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      if (!gridRect) return;
      const taskScreenY = gridRect.top + taskTop - scrollTop;
      const touchOffset = dragInitTouchY.current - taskScreenY;
      setDrag({ taskId: task.id, touchOffset, snappedMins: timeToMinutes(task.scheduled_time!) });
    }, 450);
  }

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Unscheduled / overdue strip */}
      {allUnscheduled.length > 0 && (
        <div className="px-5 py-3 border-b border-[#181818] flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-[#444] mb-2 font-semibold">
            {overdueTasks.length > 0 ? '⚠ Overdue + Unscheduled' : 'Unscheduled'}
          </p>
          <div className="flex flex-col gap-1.5">
            {allUnscheduled.map(t => (
              <div key={t.id}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 transition-opacity ${
                  t.status === 'done' ? 'opacity-40' : ''
                } ${isOverdue(t.due_date) && t.status !== 'done' ? 'bg-red-500/5 border border-red-500/20' : 'bg-[#141414]'}`}>
                {/* Checkbox */}
                <div className="relative flex-shrink-0">
                  <button onClick={() => handleComplete(t)}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      t.status === 'done' ? 'bg-white border-white' : 'border-[#444] hover:border-white'
                    }`}>
                    {t.status === 'done' && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                  {confettiId === t.id && <ConfettiBurst />}
                </div>
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLOR[t.category] || '#6b7280' }} />
                <span className={`text-xs flex-1 truncate ${t.status === 'done' ? 'line-through text-[#444]' : isOverdue(t.due_date) ? 'text-red-400' : 'text-white'}`}>
                  {t.title}
                </span>
                {t.estimated_minutes && (
                  <span className="text-[#444] text-[10px] flex-shrink-0">{formatMins(t.estimated_minutes)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hour grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: totalHeight }}>

          {/* Hour rows + tap zones */}
          {hours.map(hour => {
            const top = (hour - START_HOUR) * 60 * PX_PER_MIN;
            return (
              <div key={hour} className="absolute left-0 right-0" style={{ top, height: 60 * PX_PER_MIN }}>
                {/* Label + line */}
                <div className="flex items-start h-full">
                  <span className="text-[#333] text-[10px] w-14 flex-shrink-0 pl-5 -mt-2 select-none">
                    {hourLabel(hour)}
                  </span>
                  <div className="flex-1 border-t border-[#141414] mr-5 h-full
                    hover:bg-white/[0.015] cursor-pointer active:bg-white/[0.03] transition-colors"
                    onClick={() => handleSlotTap(hour)} />
                </div>
              </div>
            );
          })}

          {/* Current time indicator */}
          {isSelectedToday && currentMins >= START_HOUR * 60 && currentMins <= END_HOUR * 60 && (
            <div className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
              style={{ top: nowOffset }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 ml-[46px] flex-shrink-0
                shadow-[0_0_8px_#ef4444]" />
              <div className="flex-1 h-px bg-red-500 mr-5 opacity-70" />
            </div>
          )}

          {/* Scheduled task blocks — overlap-aware layout */}
          {(() => {
            // Group tasks into overlap clusters, assign columns
            type Block = { task: Task; top: number; height: number; startMins: number; endMins: number };
            const blocks: Block[] = scheduledTasks.map(task => {
              const startMins = timeToMinutes(task.scheduled_time!);
              const duration = task.estimated_minutes || 30;
              const top = (startMins - START_HOUR * 60) * PX_PER_MIN;
              const height = Math.max(duration * PX_PER_MIN, 32);
              return { task, top, height, startMins, endMins: startMins + duration };
            });

            // Assign column index to each block
            const cols: number[] = new Array(blocks.length).fill(0);
            const colEnds: number[] = []; // track end time of each column
            for (let i = 0; i < blocks.length; i++) {
              let col = 0;
              while (colEnds[col] !== undefined && colEnds[col] > blocks[i].startMins) col++;
              cols[i] = col;
              colEnds[col] = blocks[i].endMins;
            }
            // How many columns does each block's cluster span?
            const totalCols: number[] = new Array(blocks.length).fill(1);
            for (let i = 0; i < blocks.length; i++) {
              for (let j = 0; j < blocks.length; j++) {
                if (i !== j && blocks[i].startMins < blocks[j].endMins && blocks[i].endMins > blocks[j].startMins) {
                  totalCols[i] = Math.max(totalCols[i], cols[j] + 1);
                }
              }
            }

            return blocks.map(({ task, top, height }, i) => {
            const color = CATEGORY_COLOR[task.category] || '#6b7280';
            const isDone = task.status === 'done';
            const col = cols[i];
            const total = totalCols[i];
            // left offset: label col is 56px, right margin 20px, split remaining
            const trackLeft = 56;
            const trackRight = 20;
            const trackWidth = `calc(100% - ${trackLeft + trackRight}px)`;
            const colWidth = total > 1 ? `calc((100% - ${trackLeft + trackRight}px) / ${total} - 2px)` : trackWidth;
            const colLeft = total > 1 ? `calc(${trackLeft}px + (100% - ${trackLeft + trackRight}px) / ${total} * ${col} + ${col * 2}px)` : `${trackLeft}px`;

            return (
              <div key={task.id}
                className={`absolute rounded-xl overflow-visible z-10 transition-opacity select-none ${isDone ? 'opacity-40' : drag?.taskId === task.id ? 'opacity-25' : ''}`}
                style={{
                  top, height,
                  left: colLeft,
                  width: colWidth,
                  backgroundColor: isDone ? '#1a1a1a' : `${color}20`,
                  borderLeft: `3px solid ${isDone ? '#333' : color}`,
                }}
                onTouchStart={(e) => !isDone && handleTaskTouchStart(e, task, top)}
                onTouchMove={(e) => {
                  if (holdTimerRef.current !== null && Math.abs(e.touches[0].clientY - dragInitTouchY.current) > 8) cancelHold();
                }}
                onTouchEnd={cancelHold}
                onContextMenu={(e) => e.preventDefault()}
              >
                <div className="px-2.5 py-1.5 h-full flex items-center gap-2">
                  {/* Checkbox */}
                  <div className="relative flex-shrink-0">
                    <button onClick={() => handleComplete(task)}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isDone ? 'bg-white/30 border-white/30' : 'border-white/30 hover:border-white'
                      }`}>
                      {isDone && (
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                    {confettiId === task.id && <ConfettiBurst />}
                  </div>
                  <div className="flex flex-col justify-center flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-tight truncate ${isDone ? 'line-through text-white/30' : 'text-white'}`}>
                      {task.title}
                    </p>
                    {height > 44 && (
                      <p className="text-white/30 text-[10px] mt-0.5">
                        {task.scheduled_time} · {formatMins(task.estimated_minutes)}
                      </p>
                    )}
                  </div>
                  {/* Edit button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-white/20 hover:text-white/70 hover:bg-white/10 transition-colors"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
            });
          })()}

          {/* Drag ghost block */}
          {drag && (() => {
            const dragTask = scheduledTasks.find(t => t.id === drag.taskId);
            if (!dragTask) return null;
            const ghostTop = (drag.snappedMins - START_HOUR * 60) * PX_PER_MIN;
            const ghostHeight = Math.max((dragTask.estimated_minutes || 30) * PX_PER_MIN, 32);
            const ghostColor = CATEGORY_COLOR[dragTask.category] || '#6b7280';
            const dh = drag.snappedMins / 60;
            const displayH = Math.floor(dh) > 12 ? Math.floor(dh) - 12 : Math.floor(dh) === 0 ? 12 : Math.floor(dh);
            const displayM = drag.snappedMins % 60;
            const period = Math.floor(dh) >= 12 ? 'PM' : 'AM';
            const timeLabel = `${displayH}:${String(displayM).padStart(2,'0')} ${period}`;
            return (
              <div key="drag-ghost"
                className="absolute left-14 right-5 rounded-xl z-30 pointer-events-none"
                style={{
                  top: ghostTop, height: ghostHeight,
                  backgroundColor: `${ghostColor}35`,
                  borderLeft: `3px solid ${ghostColor}`,
                  boxShadow: `0 0 20px ${ghostColor}30`,
                  transition: 'top 0.06s ease-out',
                }}>
                <div className="px-2.5 py-1.5 h-full flex items-center gap-2">
                  <div className="flex flex-col justify-center flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate text-white">{dragTask.title}</p>
                    <p className="text-white/60 text-[10px] mt-0.5 font-medium">{timeLabel}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Empty state */}
          {scheduledTasks.length === 0 && allUnscheduled.length === 0 && allDone.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
              <p className="text-[#2a2a2a] text-sm">No tasks for this day</p>
              <p className="text-[#222] text-xs">Tap any time slot to add one</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Completed section — always rendered, collapsible ── */}
      {allDone.length > 0 && (
        <div className="flex-shrink-0 border-t border-[#181818]">
          <button
            onClick={() => setShowCompleted(p => !p)}
            className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span className="text-[10px] uppercase tracking-wider text-[#444] font-semibold">
                Completed ({allDone.length})
              </span>
            </div>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round">
              <polyline points={showCompleted ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
            </svg>
          </button>
          {showCompleted && (
            <div className="px-5 pb-3 flex flex-col gap-1.5">
              {allDone.map(t => (
                <div key={t.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-[#0e0e0e] border border-[#161616]">
                  <button
                    onClick={() => onUpdate(t.id, { status: 'todo' })}
                    className="w-4 h-4 rounded-full bg-[#1e1e1e] border-2 border-[#2a2a2a] flex items-center justify-center flex-shrink-0 hover:border-white transition-colors"
                  >
                    <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLOR[t.category] || '#333' }} />
                  <span className="text-xs flex-1 truncate line-through text-[#3a3a3a]">{t.title}</span>
                  {t.scheduled_time && (
                    <span className="text-[10px] text-[#2a2a2a] flex-shrink-0">{t.scheduled_time}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ─── Task Card (List View) ────────────────────────────────────────────────────
function TaskCard({ task, allTasks, onUpdate, onDelete }: {
  task: Task; allTasks: Task[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(task);
  const [showLockMsg, setShowLockMsg] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const blockers = (task.blocked_by || []).map(bid => allTasks.find(t => t.id === bid)).filter(Boolean) as Task[];
  const isLocked = blockers.some(b => b.status !== 'done');
  const lockerName = blockers.find(b => b.status !== 'done')?.title;

  function handleComplete() {
    if (isLocked) { setShowLockMsg(true); setTimeout(() => setShowLockMsg(false), 3000); return; }
    if (task.status !== 'done') { setConfetti(true); setTimeout(() => setConfetti(false), 800); }
    onUpdate(task.id, { status: task.status === 'done' ? 'todo' : 'done' });
  }

  function saveEdit() { onUpdate(task.id, editData); setEditing(false); }

  if (editing) {
    return (
      <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-4 flex flex-col gap-3">
        <input className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
          value={editData.title} onChange={e => setEditData(p => ({...p, title: e.target.value}))} placeholder="Task title" />
        <textarea className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333] resize-none"
          rows={2} value={editData.description||''} onChange={e => setEditData(p => ({...p, description: e.target.value}))} placeholder="Description" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.due_date||''} onChange={e => setEditData(p => ({...p, due_date: e.target.value}))} />
          <input type="time" className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.scheduled_time||''} onChange={e => setEditData(p => ({...p, scheduled_time: e.target.value||undefined}))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.estimated_minutes||''} onChange={e => setEditData(p => ({...p, estimated_minutes: parseInt(e.target.value)}))} placeholder="Est. minutes" />
          <select className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.priority} onChange={e => setEditData(p => ({...p, priority: e.target.value as Task['priority']}))}>
            {['urgent','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.energy_level} onChange={e => setEditData(p => ({...p, energy_level: e.target.value as Task['energy_level']}))}>
            {['deep_focus','light_work','quick_win'].map(e => <option key={e} value={e}>{e.replace('_',' ')}</option>)}
          </select>
          <select className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333]"
            value={editData.category} onChange={e => setEditData(p => ({...p, category: e.target.value}))}>
            {['design','code','school','fitness','personal','content','admin'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <textarea className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2 outline-none border border-[#333] resize-none"
          rows={2} value={editData.notes||''} onChange={e => setEditData(p => ({...p, notes: e.target.value}))} placeholder="Notes" />
        <div className="flex gap-2">
          <button onClick={saveEdit} className="flex-1 bg-white text-[#0a0a0a] text-sm font-semibold rounded-xl py-2.5">Save</button>
          <button onClick={() => setEditing(false)} className="flex-1 bg-[#1e1e1e] text-[#888] text-sm rounded-xl py-2.5">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${
      isLocked ? 'border-[#1e1e1e] bg-[#0e0e0e] opacity-60'
      : task.status === 'done' ? 'border-[#1a1a1a] bg-[#0e0e0e] opacity-50'
      : 'border-[#1e1e1e] bg-[#141414]'
    } ${task.status === 'in_progress' ? 'border-[#333]' : ''}`}>

      {showLockMsg && (
        <div className="bg-[#1e1e1e] rounded-xl px-3 py-2 text-xs text-[#888]">
          🔒 Complete <span className="text-white font-medium">"{lockerName}"</span> first
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0 mt-0.5">
          <button onClick={handleComplete}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              isLocked ? 'border-[#333] cursor-not-allowed'
              : task.status === 'done' ? 'bg-white border-white'
              : 'border-[#444] hover:border-white'
            }`}>
            {isLocked ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            ) : task.status === 'done' ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : null}
          </button>
          {confetti && <ConfettiBurst />}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${isLocked ? 'text-[#555]' : task.status === 'done' ? 'line-through text-[#444]' : 'text-white'}`}>
            {task.title}
          </p>
          {task.description && <p className="text-[#555] text-xs mt-1 leading-relaxed">{task.description}</p>}
        </div>

        <button onClick={() => setEditing(true)} className="text-[#333] hover:text-[#666] transition-colors flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ color: PRIORITY_COLOR[task.priority], backgroundColor: `${PRIORITY_COLOR[task.priority]}18` }}>
          {task.priority}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">{ENERGY_LABEL[task.energy_level]}</span>
        {task.estimated_minutes && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">⏱ {formatMins(task.estimated_minutes)}</span>
        )}
        {task.scheduled_time && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#666]">🕐 {task.scheduled_time}</span>
        )}
        {task.due_date && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${isOverdue(task.due_date) && task.status !== 'done' ? 'bg-red-500/10 text-red-400' : 'bg-[#1e1e1e] text-[#666]'}`}>
            📅 {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isLocked && task.status !== 'done' && (
          <button onClick={() => onUpdate(task.id, { status: task.status === 'in_progress' ? 'todo' : 'in_progress' })}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              task.status === 'in_progress' ? 'bg-white text-[#0a0a0a] font-semibold' : 'bg-[#1e1e1e] text-[#666] hover:text-white'
            }`}>
            {task.status === 'in_progress' ? '⏸ Pause' : '▶ Start'}
          </button>
        )}
        <button onClick={() => setExpanded(p => !p)}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#1e1e1e] text-[#555] hover:text-[#888] transition-colors ml-auto">
          {expanded ? 'Hide ▲' : 'View more ▼'}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-[#1e1e1e] pt-3">
          {task.ai_suggestions?.tools && task.ai_suggestions.tools.length > 0 && (
            <div>
              <p className="text-[#555] text-xs font-medium mb-2">🛠 Suggested Tools</p>
              {task.ai_suggestions.tools.map((tool, i) => (
                <div key={i} className="bg-[#1a1a1a] rounded-xl p-3 mb-2">
                  <p className="text-white text-xs font-medium">{tool.name}</p>
                  <p className="text-[#555] text-xs mt-0.5">{tool.reason}</p>
                </div>
              ))}
            </div>
          )}
          {task.ai_suggestions?.prompts && task.ai_suggestions.prompts.length > 0 && (
            <div>
              <p className="text-[#555] text-xs font-medium mb-2">💬 Useful Prompts</p>
              {task.ai_suggestions.prompts.map((p, i) => (
                <div key={i} className="bg-[#1a1a1a] rounded-xl px-3 py-2 mb-1.5">
                  <p className="text-[#777] text-xs">"{p}"</p>
                </div>
              ))}
            </div>
          )}
          {task.ai_suggestions?.tips && task.ai_suggestions.tips.length > 0 && (
            <div>
              <p className="text-[#555] text-xs font-medium mb-2">💡 Tips</p>
              {task.ai_suggestions.tips.map((tip, i) => (
                <p key={i} className="text-[#666] text-xs">• {tip}</p>
              ))}
            </div>
          )}
          {task.notes && <p className="text-[#666] text-xs">📝 {task.notes}</p>}
          {task.actual_minutes && (
            <p className="text-[#444] text-xs">✓ Done in {formatMins(task.actual_minutes)} (est. {formatMins(task.estimated_minutes)})</p>
          )}
          <button onClick={() => onDelete(task.id)} className="text-red-900 text-xs hover:text-red-500 transition-colors text-left">
            Delete task
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────
function SuggestionCard({
  suggestion, suggestedTime, onAdd
}: {
  suggestion: Task & { why?: string };
  suggestedTime: string;
  onAdd: (s: Task, scheduledTime: string) => void;
}) {
  const [state, setState] = useState<'idle'|'adding'|'added'>('idle');
  const [time, setTime] = useState(suggestedTime);

  function handleAdd() {
    if (state !== 'idle') return;
    setState('adding');
    onAdd(suggestion, time);
    setTimeout(() => setState('added'), 300);
  }

  function formatTime(t: string) {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2,'0')}${ampm}`;
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
      </div>

      {/* Time slot picker */}
      {state === 'idle' && (
        <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-xl px-3 py-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="text-[#555] text-xs flex-1">Schedule for</span>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="bg-transparent text-white text-xs outline-none text-right w-20" />
        </div>
      )}

      <button onClick={handleAdd} disabled={state !== 'idle'}
        className={`w-full text-xs font-semibold rounded-xl py-2.5 transition-all duration-200 active:scale-[0.97] ${
          state === 'added' ? 'bg-white/10 text-white/60 cursor-default'
          : state === 'adding' ? 'bg-[#e0e0e0] text-[#0a0a0a]/60 cursor-default'
          : 'bg-white text-[#0a0a0a] hover:bg-[#e0e0e0]'
        }`}>
        {state === 'added' ? `✓ Added at ${formatTime(time)}` : state === 'adding' ? 'Adding...' : `+ Add at ${formatTime(time)}`}
      </button>
    </div>
  );
}

// ─── Edit Task Modal ──────────────────────────────────────────────────────────
function EditTaskModal({ task, onSave, onDelete, onClose }: {
  task: Task;
  onSave: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState(task);

  function save() { onSave(task.id, data); onClose(); }
  function del() { onDelete(task.id); onClose(); }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-8 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">

        <div className="flex items-center justify-between">
          <p className="text-white text-sm font-semibold">Edit task</p>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <input value={data.title} onChange={e => setData(p => ({ ...p, title: e.target.value }))}
          placeholder="Task title"
          className="bg-[#1e1e1e] text-white text-sm rounded-xl px-4 py-3 outline-none border border-[#2a2a2a] placeholder:text-[#444]" />

        <textarea value={data.description || ''} onChange={e => setData(p => ({ ...p, description: e.target.value }))}
          rows={2} placeholder="Description (optional)"
          className="bg-[#1e1e1e] text-white text-sm rounded-xl px-4 py-3 outline-none border border-[#2a2a2a] placeholder:text-[#444] resize-none" />

        <div className="grid grid-cols-2 gap-2">
          <input type="time" value={data.scheduled_time || ''} onChange={e => setData(p => ({ ...p, scheduled_time: e.target.value || undefined }))}
            className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2.5 outline-none border border-[#2a2a2a]" />
          <input type="number" value={data.estimated_minutes || ''} onChange={e => setData(p => ({ ...p, estimated_minutes: parseInt(e.target.value) || undefined }))}
            placeholder="Est. mins"
            className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2.5 outline-none border border-[#2a2a2a] placeholder:text-[#444]" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select value={data.category} onChange={e => setData(p => ({ ...p, category: e.target.value }))}
            className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2.5 outline-none border border-[#2a2a2a]">
            {['design','code','school','fitness','personal','content','admin'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={data.priority} onChange={e => setData(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
            className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2.5 outline-none border border-[#2a2a2a]">
            {['urgent','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <select value={data.energy_level} onChange={e => setData(p => ({ ...p, energy_level: e.target.value as Task['energy_level'] }))}
          className="bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2.5 outline-none border border-[#2a2a2a]">
          {['deep_focus','light_work','quick_win'].map(e => <option key={e} value={e}>{e.replace('_',' ')}</option>)}
        </select>

        <div className="flex gap-2">
          <button onClick={save} disabled={!data.title.trim()}
            className="flex-1 bg-white text-[#0a0a0a] text-sm font-semibold rounded-xl py-2.5 disabled:opacity-40">
            Save
          </button>
          <button onClick={onClose} className="bg-[#1e1e1e] text-[#888] text-sm rounded-xl px-4 py-2.5">Cancel</button>
        </div>
        <button onClick={del} className="text-red-900 text-xs hover:text-red-500 transition-colors text-center">
          Delete task
        </button>
      </div>
    </div>
  );
}

// ─── Quick Create Modal ───────────────────────────────────────────────────────
const QUICK_CATS = ['personal', 'design', 'code', 'school', 'fitness', 'content', 'admin'] as const;

function QuickCreateModal({ time, date, onSave, onClose }: {
  time: string; date: string;
  onSave: (title: string, time: string, date: string, category: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [selectedTime, setSelectedTime] = useState(time);
  const [category, setCategory] = useState('personal');
  const [chips, setChips] = useState<{ label: string; time: string; subtitle: string }[]>([]);
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingChips, setLoadingChips] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    setChips([]); setInsight(null); setLoadingChips(true);
    fetch('/api/patterns/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    })
      .then(r => r.json())
      .then(d => { setChips(d.chips || []); setInsight(d.insight || null); })
      .catch(() => {})
      .finally(() => setLoadingChips(false));
  }, [category]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-8 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 flex flex-col gap-4">

        <div className="flex items-center justify-between">
          <p className="text-white text-sm font-semibold">New task</p>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && title.trim()) { onSave(title.trim(), selectedTime, date, category); onClose(); } if (e.key === 'Escape') onClose(); }}
          placeholder="What do you need to do?"
          className="bg-[#1e1e1e] text-white text-sm rounded-xl px-4 py-3 outline-none border border-[#2a2a2a] placeholder:text-[#444]" />

        {/* Category picker */}
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {QUICK_CATS.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === cat ? 'bg-white text-[#0a0a0a]' : 'bg-[#1e1e1e] text-[#666] border border-[#2a2a2a] hover:border-[#444]'
              }`}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: CATEGORY_COLOR[cat] || '#6b7280' }} />
              {cat}
            </button>
          ))}
        </div>

        {/* Smart time chips from pattern engine */}
        {loadingChips && (
          <div className="flex gap-2">
            {[1,2,3].map(i => <div key={i} className="h-12 w-20 rounded-xl bg-[#1e1e1e] animate-pulse" />)}
          </div>
        )}
        {!loadingChips && chips.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[#333] text-[10px] uppercase tracking-wider font-semibold">Your patterns</p>
            <div className="flex gap-2 flex-wrap">
              {chips.map(chip => (
                <button key={chip.time} onClick={() => setSelectedTime(chip.time)}
                  className={`flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-colors ${
                    selectedTime === chip.time
                      ? 'bg-white border-white text-[#0a0a0a]'
                      : 'bg-[#1e1e1e] border-[#2a2a2a] text-white hover:border-[#444]'
                  }`}>
                  <span className="text-xs font-semibold leading-tight">{chip.label}</span>
                  {chip.subtitle && (
                    <span className={`text-[10px] leading-tight mt-0.5 ${selectedTime === chip.time ? 'text-[#666]' : 'text-[#555]'}`}>
                      {chip.subtitle}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {insight && <p className="text-[#3a3a3a] text-[11px] leading-relaxed italic">{insight}</p>}
          </div>
        )}

        {/* Time + date row */}
        <div className="flex items-center gap-2">
          <input type="time" value={selectedTime} onChange={e => setSelectedTime(e.target.value)}
            className="flex-1 bg-[#1e1e1e] text-white text-sm rounded-xl px-3 py-2.5 outline-none border border-[#2a2a2a]" />
          <p className="text-[#444] text-xs">{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { if (title.trim()) { onSave(title.trim(), selectedTime, date, category); onClose(); } }}
            disabled={!title.trim()}
            className="flex-1 bg-white text-[#0a0a0a] text-sm font-semibold rounded-xl py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
            Add to Calendar
          </button>
          <button onClick={onClose} className="bg-[#1e1e1e] text-[#888] text-sm rounded-xl px-4 py-2.5">Cancel</button>
        </div>

      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [suggestions, setSuggestions] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [selectedDate, setSelectedDate] = useState(localDateStr());
  const [view, setView] = useState<'calendar'|'list'>('calendar');
  const [showDone, setShowDone] = useState(true);
  const [quickCreate, setQuickCreate] = useState<{ time: string } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchSuggestions();

    // Re-fetch tasks when the tab becomes visible (user switches from Chat → Tasks)
    function onVisible() {
      if (!document.hidden) fetchTasks();
    }
    // Also re-fetch when Chat page signals tasks were created
    function onStorage(e: StorageEvent) {
      if (e.key === 'wit_tasks_updated') fetchTasks();
    }

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTasks(attempt = 0) {
    if (attempt === 0) setLoadingTasks(true);
    try {
      const res = await fetch('/api/tasks/list');
      if (res.ok) {
        const d = await res.json();
        setTasks(d.tasks || []);
        setLoadingTasks(false);
      } else if (attempt < 2) {
        setTimeout(() => fetchTasks(attempt + 1), 1500);
      } else {
        setLoadingTasks(false);
      }
    } catch {
      if (attempt < 2) {
        setTimeout(() => fetchTasks(attempt + 1), 1500);
      } else {
        setLoadingTasks(false);
      }
    }
  }

  async function fetchSuggestions() {
    const cacheKey = `wit_suggestions_${localDateStr()}`;

    // Show cached suggestions instantly, then refresh in background
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { suggestions: cachedSuggestions } = JSON.parse(cached);
        if (cachedSuggestions?.length > 0) {
          setSuggestions(cachedSuggestions);
          setLoadingSuggestions(false);
        }
      }
    } catch {}

    // Always fetch fresh in background (silently if we already showed cache)
    try {
      const tz = getUserTimezone();
      const date = localDateStr();
      const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const res = await fetch(`/api/tasks/suggest?tz=${encodeURIComponent(tz)}&date=${date}&time=${encodeURIComponent(time)}`);
      if (res.ok) {
        const d = await res.json();
        const fresh = d.suggestions || [];
        setSuggestions(fresh);
        try { localStorage.setItem(cacheKey, JSON.stringify({ suggestions: fresh })); } catch {}
      }
    } catch {}
    setLoadingSuggestions(false);
  }

  async function addSuggestion(s: Task, scheduledTime: string) {
    const date = localDateStr();
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      ...s, id: tempId, status: 'todo' as const, source: 'suggested',
      due_date: date, scheduled_time: scheduledTime,
    };
    setTasks(prev => [optimistic, ...prev]);

    // Sanitize — only send fields the DB accepts, with validated values
    const VALID_PRIORITIES = ['urgent','high','medium','low'];
    const VALID_ENERGY = ['deep_focus','light_work','quick_win'];
    const VALID_CONTEXT = ['anywhere','computer','phone','gym','campus'];
    const VALID_CATEGORIES = ['design','code','school','fitness','personal','content','admin'];

    const payload = {
      title: s.title?.trim() || 'Untitled',
      description: s.description || '',
      category: VALID_CATEGORIES.includes(s.category) ? s.category : 'personal',
      priority: VALID_PRIORITIES.includes(s.priority) ? s.priority : 'medium',
      energy_level: VALID_ENERGY.includes(s.energy_level) ? s.energy_level : 'light_work',
      context_tag: VALID_CONTEXT.includes(s.context_tag) ? s.context_tag : 'anywhere',
      friction_score: Math.min(5, Math.max(1, Number(s.friction_score) || 3)),
      estimated_minutes: Number(s.estimated_minutes) > 0 ? Number(s.estimated_minutes) : 30,
      blocked_by: [],
      source: 'suggested',
      due_date: date,
      scheduled_time: scheduledTime,
      localDate: date,
    };

    try {
      const res = await fetch('/api/tasks/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const d = await res.json();
        setTasks(prev => prev.map(t => t.id === tempId ? d.task : t));
        setSuggestions(prev => prev.filter(x => x.title !== s.title));
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Task create failed:', err);
        setTasks(prev => prev.filter(t => t.id !== tempId));
      }
    } catch (e) {
      console.error('Task create error:', e);
      setTasks(prev => prev.filter(t => t.id !== tempId));
    }
  }

  async function quickAddTask(title: string, time: string, date: string, category: string = 'personal') {
    const tempId = `temp-${Date.now()}`;
    const optimistic: Task = {
      id: tempId, title, status: 'todo', priority: 'medium', category,
      energy_level: 'light_work', context_tag: 'anywhere', friction_score: 3,
      blocked_by: [], due_date: date, scheduled_time: time,
    };
    setTasks(prev => [optimistic, ...prev]);
    try {
      const res = await fetch('/api/tasks/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, due_date: date, scheduled_time: time, category, source: 'manual', localDate: date }),
      });
      if (res.ok) {
        const d = await res.json();
        setTasks(prev => prev.map(t => t.id === tempId ? d.task : t));
      } else {
        setTasks(prev => prev.filter(t => t.id !== tempId));
      }
    } catch {
      setTasks(prev => prev.filter(t => t.id !== tempId));
    }
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    try {
      const res = await fetch('/api/tasks/update', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) { const d = await res.json(); setTasks(prev => prev.map(t => t.id === id ? d.task : t)); }
    } catch {}
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await fetch('/api/tasks/update', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'cancelled' }),
      });
    } catch {}
  }

  // List view grouping
  const activeTasks = tasks.filter(t => t.status !== 'cancelled');
  const grouped = {
    overdue: activeTasks.filter(t => t.status !== 'done' && isOverdue(t.due_date)),
    today: activeTasks.filter(t => t.status !== 'done' && isToday(t.due_date)),
    upcoming: activeTasks.filter(t => t.status !== 'done' && t.due_date && !isOverdue(t.due_date) && !isToday(t.due_date)),
    someday: activeTasks.filter(t => t.status !== 'done' && !t.due_date),
    done: activeTasks.filter(t => t.status === 'done'),
  };
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

  const isToday_ = selectedDate === localDateStr();

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#0a0a0a] overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-white text-xl font-semibold tracking-tight">Tasks</h1>
            <p className="text-[#444] text-xs mt-0.5">{activeCount} active</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-[#141414] border border-[#1e1e1e] rounded-xl p-1 gap-1">
              <button onClick={() => setView('calendar')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${view === 'calendar' ? 'bg-white' : 'hover:bg-[#1e1e1e]'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={view === 'calendar' ? '#0a0a0a' : '#555'} strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
                </svg>
              </button>
              <button onClick={() => setView('list')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${view === 'list' ? 'bg-white' : 'hover:bg-[#1e1e1e]'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={view === 'list' ? '#0a0a0a' : '#555'} strokeWidth="2" strokeLinecap="round">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <circle cx="3" cy="6" r="1" fill="currentColor"/>
                  <circle cx="3" cy="12" r="1" fill="currentColor"/>
                  <circle cx="3" cy="18" r="1" fill="currentColor"/>
                </svg>
              </button>
            </div>
            {/* Add button */}
            <button onClick={() => setQuickCreate({ time: localTimeStr() })}
              className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-[#e0e0e0] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Day navigation */}
        <div className="flex items-center justify-between bg-[#111] rounded-2xl px-4 py-3 border border-[#1a1a1a]">
          <button onClick={() => setSelectedDate(d => navigateDate(d, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#1e1e1e] transition-colors text-[#555] hover:text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="text-center">
            <p className="text-white text-sm font-semibold">{formatDateHeader(selectedDate)}</p>
            {!isToday_ && <p className="text-[#444] text-[10px] mt-0.5">{formatDateSub(selectedDate)}</p>}
            {isToday_ && (
              <p className="text-[#444] text-[10px] mt-0.5">
                {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isToday_ && (
              <button onClick={() => setSelectedDate(localDateStr())}
                className="text-[10px] text-[#555] hover:text-white px-2 py-1 rounded-lg hover:bg-[#1e1e1e] transition-colors">
                Today
              </button>
            )}
            <button onClick={() => setSelectedDate(d => navigateDate(d, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#1e1e1e] transition-colors text-[#555] hover:text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Suggestions strip */}
      {(loadingSuggestions || suggestions.length > 0) && (
        <div className="pb-3 flex-shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#444] px-5 mb-3">✨ Suggested</p>
          {loadingSuggestions ? (
            <div className="px-5 flex gap-3">
              {[1,2,3].map(i => <div key={i} className="flex-shrink-0 w-64 h-28 bg-[#141414] rounded-2xl border border-[#1e1e1e] animate-pulse" />)}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide">
              {suggestions.map((s, i) => {
                // Pre-calculate staggered slots so cards don't suggest the same time
                const reserved: Array<{start: number; end: number}> = [];
                for (let j = 0; j < i; j++) {
                  const slot = findNextAvailableSlot(tasks, localDateStr(), suggestions[j].estimated_minutes || 30, reserved);
                  const start = timeToMinutes(slot);
                  reserved.push({ start, end: start + (suggestions[j].estimated_minutes || 30) });
                }
                const suggestedTime = findNextAvailableSlot(tasks, localDateStr(), s.estimated_minutes || 30, reserved);
                return <SuggestionCard key={i} suggestion={s} suggestedTime={suggestedTime} onAdd={addSuggestion} />;
              })}
            </div>
          )}
        </div>
      )}

      {/* Main view */}
      {loadingTasks ? (
        <div className="px-5 flex flex-col gap-3 pb-8">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-[#141414] rounded-2xl border border-[#1e1e1e] animate-pulse" />)}
        </div>
      ) : view === 'calendar' ? (
        <DayCalendarView
          tasks={tasks}
          selectedDate={selectedDate}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onQuickCreate={(time) => setQuickCreate({ time })}
          onEdit={(task) => setEditingTask(task)}
        />
      ) : (
        <div className="px-5 flex flex-col gap-6 pb-8 overflow-y-auto flex-1">
          <Section label="⚠ Overdue" items={grouped.overdue} color="#ef4444" />
          <Section label="Today" items={grouped.today} color="#ffffff" />
          <Section label="Upcoming" items={grouped.upcoming} color="#6b7280" />
          <Section label="Someday" items={grouped.someday} color="#374151" />
          {grouped.done.length > 0 && (
            <div className="border-t border-[#181818] pt-4">
              <button onClick={() => setShowDone(p => !p)}
                className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span className="text-xs text-[#444] uppercase tracking-wider font-semibold">
                  Completed
                </span>
                <span className="text-[10px] bg-[#1e1e1e] text-[#555] px-2 py-0.5 rounded-full">
                  {grouped.done.length}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round">
                  <polyline points={showDone ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
                </svg>
              </button>
              {showDone && (
                <div className="flex flex-col gap-2">
                  {grouped.done.map(t => <TaskCard key={t.id} task={t} allTasks={tasks} onUpdate={updateTask} onDelete={deleteTask} />)}
                </div>
              )}
            </div>
          )}
          {Object.values(grouped).every(g => g.length === 0) && (
            <div className="text-center py-16">
              <p className="text-[#333] text-sm">No tasks yet.</p>
              <p className="text-[#222] text-xs mt-1">Tap + to add one.</p>
            </div>
          )}
        </div>
      )}

      {/* Quick create modal */}
      {quickCreate && (
        <QuickCreateModal
          time={quickCreate.time}
          date={selectedDate}
          onSave={quickAddTask}
          onClose={() => setQuickCreate(null)}
        />
      )}

      {/* Edit task modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onSave={updateTask}
          onDelete={deleteTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
