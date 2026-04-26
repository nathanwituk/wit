import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, category, scheduled_time, estimated_minutes, energy_level, context_tag, priority, friction_score, days_of_week } = body;
  if (!title?.trim() || !days_of_week?.length) {
    return NextResponse.json({ error: 'title and days_of_week required' }, { status: 400 });
  }
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('recurring_templates')
    .insert({
      title: title.trim(),
      category: category || 'personal',
      scheduled_time: scheduled_time || null,
      estimated_minutes: estimated_minutes || 60,
      energy_level: energy_level || 'light_work',
      context_tag: context_tag || 'anywhere',
      priority: priority || 'medium',
      friction_score: friction_score || 2,
      days_of_week,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from('recurring_templates')
    .update({ active: false })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
