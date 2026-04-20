import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 });

    const supabase = createAdminSupabaseClient();

    // If marking done, log completion time
    if (updates.status === 'done') {
      updates.completed_at = new Date().toISOString();
      if (!updates.actual_minutes) {
        const { data: task } = await supabase.from('tasks').select('started_at').eq('id', id).single();
        if (task?.started_at) {
          const mins = Math.round((Date.now() - new Date(task.started_at).getTime()) / 60000);
          if (mins > 0) updates.actual_minutes = mins;
        }
      }
    }

    // If starting a task, log start time
    if (updates.status === 'in_progress' && !updates.started_at) {
      updates.started_at = new Date().toISOString();
    }

    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
