'use server';
// actions/roster.ts
// Server actions for all roster-related mutations.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { generateInviteCode } from '@/lib/utils/invite';

// ── Add single player ─────────────────────────────────────────
const addPlayerSchema = z.object({
  teamId: z.string().uuid(),
  displayName: z.string().min(1, 'Name is required'),
  gradYear: z.coerce.number().int().min(2020).max(2035).optional(),
  jerseyNumber: z.coerce.number().int().min(0).max(999).optional(),
  ladderRank: z.coerce.number().int().min(1).optional(),
  invitedEmail: z.string().email().optional().or(z.literal('')),
});

export type AddPlayerInput = z.infer<typeof addPlayerSchema>;

export async function addPlayer(input: AddPlayerInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = addPlayerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const {
    teamId,
    displayName,
    gradYear,
    jerseyNumber,
    ladderRank,
    invitedEmail,
  } = parsed.data;

  // Verify the caller is a coach on this team
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership || membership.role !== 'coach') {
    return { error: 'Only coaches can add players' };
  }

  // Create a team_member record with role=player (no profile yet — unclaimed)
  // We use a placeholder profile_id approach: store player data directly
  // on a "ghost" record. In Week 3, claim flow links a real profile.
  //
  // For now we insert into players table directly with team_id and
  // a generated placeholder. The player has no auth account yet.

  // First create a minimal profile placeholder for display purposes
  // We use a special approach: insert into players with display_name only
  const { data: player, error: playerError } = await (supabase as any)
    .from('players')
    .insert({
      team_id: teamId,
      display_name: displayName,
      grad_year: gradYear ?? null,
      ladder_rank: ladderRank ?? null,
      invited_email: invitedEmail || null,
      claim_code: generateInviteCode(), // auto-generate claim code on creation
      team_member_id: null,
      profile_id: null,
    })
    .select('id')
    .single();

  if (playerError) {
    console.error('addPlayer error:', playerError);
    return { error: 'Failed to add player. Please try again.' };
  }

  // If jersey number provided, we store it on the player record
  if (jerseyNumber !== undefined) {
    await (supabase as any)
      .from('players')
      .update({ jersey_number: jerseyNumber })
      .eq('id', player.id);
  }

  revalidatePath('/roster');
  return { data: player };
}

// ── Update player ─────────────────────────────────────────────
const updatePlayerSchema = z.object({
  playerId: z.string().uuid(),
  teamId: z.string().uuid(),
  displayName: z.string().min(1).optional(),
  gradYear: z.coerce.number().int().optional().nullable(),
  jerseyNumber: z.coerce.number().int().optional().nullable(),
  ladderRank: z.coerce.number().int().optional().nullable(),
  invitedEmail: z.string().email().optional().nullable().or(z.literal('')),
  notesPublic: z.string().optional().nullable(),
});

export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;

export async function updatePlayer(input: UpdatePlayerInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = updatePlayerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { playerId, teamId, ...updates } = parsed.data;

  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership || membership.role !== 'coach') {
    return { error: 'Only coaches can edit players' };
  }

  const { error } = await (supabase as any)
    .from('players')
    .update({
      display_name: updates.displayName,
      grad_year: updates.gradYear,
      ladder_rank: updates.ladderRank,
      invited_email: updates.invitedEmail || null,
      notes_public: updates.notesPublic,
    })
    .eq('id', playerId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to update player.' };

  revalidatePath('/roster');
  revalidatePath(`/roster/${playerId}`);
  return { data: { success: true } };
}

// ── CSV import ────────────────────────────────────────────────
export interface CsvPlayerRow {
  full_name: string;
  grad_year?: string;
  jersey_number?: string;
  ladder_rank?: string;
}

export async function importPlayersFromCsv(
  teamId: string,
  rows: CsvPlayerRow[],
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (!rows.length) return { error: 'No rows to import' };
  if (rows.length > 100) return { error: 'Maximum 100 players per import' };

  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership || membership.role !== 'coach') {
    return { error: 'Only coaches can import players' };
  }

  const playersToInsert = rows
    .filter((row) => row.full_name?.trim())
    .map((row) => ({
      team_id: teamId,
      display_name: row.full_name.trim(),
      grad_year: row.grad_year ? parseInt(row.grad_year) : null,
      ladder_rank: row.ladder_rank ? parseInt(row.ladder_rank) : null,
      team_member_id: null,
      profile_id: null,
    }));

  const { error } = await (supabase as any)
    .from('players')
    .insert(playersToInsert);

  if (error) {
    console.error('CSV import error:', error);
    return { error: 'Import failed. Please check your CSV format.' };
  }

  revalidatePath('/roster');
  return { data: { imported: playersToInsert.length } };
}
