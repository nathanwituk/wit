import { createAdminSupabaseClient } from '@/lib/supabase-server';

export interface TaskEventPayload {
  task_id: string;
  event_type: 'created' | 'scheduled' | 'rescheduled' | 'completed' | 'uncompleted';
  category?: string;
  context_tag?: string;
  energy_level?: string;
  time_of_day?: string;
  estimated_minutes?: number;
}

export async function logTaskEvent(payload: TaskEventPayload) {
  try {
    const supabase = createAdminSupabaseClient();
    await supabase.from('task_events').insert({
      ...payload,
      day_of_week: new Date().getDay(),
    });
  } catch {
    // Non-blocking — never fail a task operation because of event logging
  }
}
