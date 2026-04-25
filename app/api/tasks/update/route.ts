import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { logTaskEvent } from '@/lib/task-events';

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 });

    const supabase = createAdminSupabaseClient();

    // Fetch current task when needed for event logging or time calculations
    let currentTask: {
      started_at?: string; category?: string; context_tag?: string;
      energy_level?: string; estimated_minutes?: number; scheduled_time?: string;
    } | null = null;

    const needsCurrentTask = updates.status === 'done' || updates.status === 'todo' || 'scheduled_time' in updates;
    if (needsCurrentTask) {
      const { data } = await supabase
        .from('tasks')
        .select('started_at, category, context_tag, energy_level, estimated_minutes, scheduled_time')
        .eq('id', id)
        .single();
      currentTask = data;
    }

    // If marking done, log completion time
    if (updates.status === 'done') {
      updates.completed_at = new Date().toISOString();
      if (!updates.actual_minutes && currentTask?.started_at) {
        const mins = Math.round((Date.now() - new Date(currentTask.started_at).getTime()) / 60000);
        if (mins > 0) updates.actual_minutes = mins;
      }
    }

    // If starting a task, log start time
    if (updates.status === 'in_progress' && !updates.started_at) {
      updates.started_at = new Date().toISOString();
    }

    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
    if (error) throw error;

    // Fire-and-forget event logging
    const cat = data.category || currentTask?.category;
    const ctx = data.context_tag || currentTask?.context_tag;
    const energy = data.energy_level || currentTask?.energy_level;
    const estMins = data.estimated_minutes || currentTask?.estimated_minutes;

    if ('scheduled_time' in updates && updates.scheduled_time) {
      const wasScheduled = !!currentTask?.scheduled_time;
      logTaskEvent({
        task_id: id,
        event_type: wasScheduled ? 'rescheduled' : 'scheduled',
        category: cat, context_tag: ctx, energy_level: energy,
        time_of_day: updates.scheduled_time, estimated_minutes: estMins,
      });
    }
    if (updates.status === 'done') {
      logTaskEvent({
        task_id: id, event_type: 'completed',
        category: cat, context_tag: ctx, energy_level: energy,
        time_of_day: data.scheduled_time, estimated_minutes: estMins,
      });
    }
    if (updates.status === 'todo' && currentTask) {
      logTaskEvent({
        task_id: id, event_type: 'uncompleted',
        category: cat, context_tag: ctx, energy_level: energy,
        time_of_day: data.scheduled_time, estimated_minutes: estMins,
      });
    }

    return NextResponse.json({ task: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
