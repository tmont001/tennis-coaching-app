'use server';
// actions/matches.ts
// Server actions for match result logging and management.

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

// ── Create match ──────────────────────────────────────────────
const createMatchSchema = z.object({
  teamId: z.string().uuid(),
  opponentName: z.string().min(1, 'Opponent name is required'),
  matchDate: z.string().min(1, 'Date is required'),
  isHome: z.boolean().default(true),
  ourScore: z.coerce.number().int().min(0).optional().nullable(),
  opponentScore: z.coerce.number().int().min(0).optional().nullable(),
  result: z
    .enum(['win', 'loss', 'tie', 'cancelled', 'pending'])
    .default('pending'),
  notes: z.string().optional().nullable(),
  eventId: z.string().uuid().optional().nullable(),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;

export async function createMatch(input: CreateMatchInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createMatchSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const isCoach = await verifyCoach(
    supabase as any,
    parsed.data.teamId,
    user.id,
  );
  if (!isCoach) return { error: 'Only coaches can log matches' };

  const { data, error } = await (supabase as any)
    .from('matches')
    .insert({
      team_id: parsed.data.teamId,
      created_by: user.id,
      opponent_name: parsed.data.opponentName,
      match_date: parsed.data.matchDate,
      is_home: parsed.data.isHome,
      our_score: parsed.data.ourScore ?? null,
      opponent_score: parsed.data.opponentScore ?? null,
      result: parsed.data.result,
      notes: parsed.data.notes ?? null,
      event_id: parsed.data.eventId ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('createMatch:', error);
    return { error: 'Failed to log match.' };
  }

  revalidatePath('/matches');
  return { data };
}

// ── Update match ──────────────────────────────────────────────
export async function updateMatch(
  matchId: string,
  teamId: string,
  updates: Partial<CreateMatchInput>,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can edit matches' };

  const { error } = await (supabase as any)
    .from('matches')
    .update({
      opponent_name: updates.opponentName,
      match_date: updates.matchDate,
      is_home: updates.isHome,
      our_score: updates.ourScore ?? null,
      opponent_score: updates.opponentScore ?? null,
      result: updates.result,
      notes: updates.notes ?? null,
    })
    .eq('id', matchId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to update match.' };

  revalidatePath('/matches');
  revalidatePath(`/matches/${matchId}`);
  return { data: { success: true } };
}

// ── Delete match ──────────────────────────────────────────────
export async function deleteMatch(matchId: string, teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can delete matches' };

  const { error } = await (supabase as any)
    .from('matches')
    .delete()
    .eq('id', matchId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to delete match.' };

  revalidatePath('/matches');
  return { data: { success: true } };
}
