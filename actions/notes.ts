'use server';
// actions/notes.ts
// Server actions for coach notes — private per-player notes.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

async function verifyCoach(supabase: any, teamId: string, userId: string) {
  const { data } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', userId)
    .single();
  return data?.role === 'coach';
}

// ── Create note ───────────────────────────────────────────────
const createNoteSchema = z.object({
  teamId: z.string().uuid(),
  playerId: z.string().uuid(),
  body: z.string().min(1, 'Note cannot be empty'),
});

export async function createNote(input: z.infer<typeof createNoteSchema>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const isCoach = await verifyCoach(
    supabase as any,
    parsed.data.teamId,
    user.id,
  );
  if (!isCoach) return { error: 'Only coaches can add notes' };

  const { data, error } = await (supabase as any)
    .from('coach_notes')
    .insert({
      team_id: parsed.data.teamId,
      author_id: user.id,
      player_id: parsed.data.playerId,
      body: parsed.data.body,
    })
    .select('id')
    .single();

  if (error) {
    console.error('createNote:', error);
    return { error: 'Failed to save note.' };
  }

  revalidatePath('/notes');
  revalidatePath(`/roster/${parsed.data.playerId}`);
  return { data };
}

// ── Update note ───────────────────────────────────────────────
export async function updateNote(noteId: string, teamId: string, body: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can edit notes' };

  if (!body.trim()) return { error: 'Note cannot be empty' };

  const { error } = await (supabase as any)
    .from('coach_notes')
    .update({ body: body.trim() })
    .eq('id', noteId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to update note.' };

  revalidatePath('/notes');
  return { data: { success: true } };
}

// ── Delete note ───────────────────────────────────────────────
export async function deleteNote(noteId: string, teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can delete notes' };

  const { error } = await (supabase as any)
    .from('coach_notes')
    .delete()
    .eq('id', noteId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to delete note.' };

  revalidatePath('/notes');
  return { data: { success: true } };
}
