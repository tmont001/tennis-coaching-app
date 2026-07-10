'use server';
// actions/lineup.ts
// Server actions specifically for match lineup management.
// Kept separate from match_lines.ts to avoid Next.js server action
// import resolution issues when a file mixes many exports.

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

// ── Save full lineup (player assignments only) ────────────────
// Upserts all courts in one call. Only sets player1_id and player2_id —
// result, score, and sets are left untouched on existing rows.
export async function saveLineup(
  matchId: string,
  teamId: string,
  slots: Array<{
    lineType: 'singles' | 'doubles';
    position: number;
    player1Id: string | null;
    player2Id: string | null;
  }>,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can edit lineups' };

  if (slots.length === 0) return { data: { saved: 0 } };

  const rows = slots.map((s) => ({
    match_id: matchId,
    team_id: teamId,
    line_type: s.lineType,
    position: s.position,
    player1_id: s.player1Id || null,
    player2_id: s.player2Id || null,
  }));

  const { error } = await (supabase as any)
    .from('match_lines')
    .upsert(rows, { onConflict: 'match_id,line_type,position' });

  if (error) return { error: 'Failed to save lineup.' };

  revalidatePath(`/matches/${matchId}`);
  return { data: { saved: rows.length } };
}

// ── Upsert a single match line ────────────────────────────────
const lineSchema = z.object({
  matchId: z.string().uuid(),
  teamId: z.string().uuid(),
  lineType: z.enum(['singles', 'doubles']),
  position: z.number().int().min(1),
  player1Id: z.string().uuid().nullable().optional(),
  player2Id: z.string().uuid().nullable().optional(),
  result: z.enum(['win', 'loss', 'not_played']).nullable().optional(),
  score: z.string().nullable().optional(),
  setsWon: z.number().int().min(0).nullable().optional(),
  setsLost: z.number().int().min(0).nullable().optional(),
});

export type LineInput = z.infer<typeof lineSchema>;

export async function upsertMatchLine(input: LineInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const isCoach = await verifyCoach(
    supabase as any,
    parsed.data.teamId,
    user.id,
  );
  if (!isCoach) return { error: 'Only coaches can edit lineups' };

  const { error } = await (supabase as any).from('match_lines').upsert(
    {
      match_id: parsed.data.matchId,
      team_id: parsed.data.teamId,
      line_type: parsed.data.lineType,
      position: parsed.data.position,
      player1_id: parsed.data.player1Id ?? null,
      player2_id: parsed.data.player2Id ?? null,
      result: parsed.data.result ?? null,
      score: parsed.data.score ?? null,
      sets_won: parsed.data.setsWon ?? null,
      sets_lost: parsed.data.setsLost ?? null,
    },
    { onConflict: 'match_id,line_type,position' },
  );

  if (error) {
    console.error('upsertMatchLine:', error);
    return { error: 'Failed to save lineup slot.' };
  }

  revalidatePath(`/matches/${parsed.data.matchId}`);
  return { data: { success: true } };
}

// ── Copy lineup from a previous match ────────────────────────
export async function copyLineupFromMatch(
  sourceMatchId: string,
  targetMatchId: string,
  teamId: string,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can copy lineups' };

  const { data: sourceLines, error: fetchError } = await (supabase as any)
    .from('match_lines')
    .select('line_type, position, player1_id, player2_id')
    .eq('match_id', sourceMatchId)
    .eq('team_id', teamId);

  if (fetchError) return { error: 'Failed to fetch source lineup.' };
  if (!sourceLines || sourceLines.length === 0) {
    return { error: 'No lineup found in the previous match.' };
  }

  // Delete existing lines in target
  await (supabase as any)
    .from('match_lines')
    .delete()
    .eq('match_id', targetMatchId)
    .eq('team_id', teamId);

  // Insert copied lines — players carry forward, results start blank
  const newLines = sourceLines.map((line: any) => ({
    match_id: targetMatchId,
    team_id: teamId,
    line_type: line.line_type,
    position: line.position,
    player1_id: line.player1_id,
    player2_id: line.player2_id,
    result: null,
    score: null,
    sets_won: null,
    sets_lost: null,
  }));

  const { error: insertError } = await (supabase as any)
    .from('match_lines')
    .insert(newLines);

  if (insertError) return { error: 'Failed to copy lineup.' };

  revalidatePath(`/matches/${targetMatchId}`);
  return { data: { copied: newLines.length } };
}

// ── Save lineup copy preference ───────────────────────────────
export async function saveLineupCopyPreference(skip: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Merge with existing preferences to avoid overwriting others
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .single();

  const existing = profile?.preferences ?? {};

  const { error } = await (supabase as any)
    .from('profiles')
    .update({ preferences: { ...existing, skip_lineup_copy_prompt: skip } })
    .eq('id', user.id);

  if (error) return { error: 'Failed to save preference.' };
  return { data: { success: true } };
}
