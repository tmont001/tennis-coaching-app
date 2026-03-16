'use server';
// actions/claim.ts
// Handles the player claim flow — linking a signed-in user
// to an existing unclaimed player record via a claim code.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { generateInviteCode } from '@/lib/utils/invite';

// ── Generate a claim code for a player ───────────────────────
// Called when a coach adds a player. Also callable manually
// from the player profile if no code exists yet.
export async function generateClaimCode(playerId: string, teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Only coaches can generate claim codes
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership || membership.role !== 'coach') {
    return { error: 'Only coaches can generate claim codes' };
  }

  // Generate a unique 8-char code
  const claimCode = generateInviteCode();

  const { error } = await (supabase as any)
    .from('players')
    .update({ claim_code: claimCode })
    .eq('id', playerId)
    .eq('team_id', teamId)
    .is('claimed_at', null); // only update if not yet claimed

  if (error) return { error: 'Failed to generate claim code.' };

  revalidatePath(`/roster/${playerId}`);
  return { data: { claimCode } };
}

// ── Claim a player record ─────────────────────────────────────
// Called when a logged-in user submits their claim code.
// Links their profile to the player record.
export async function claimPlayerAccount(claimCode: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Normalize code
  const normalizedCode = claimCode.toUpperCase().trim();

  // Find the player record with this claim code
  const { data: player, error: findError } = await (supabase as any)
    .from('players')
    .select('id, team_id, claimed_at, display_name')
    .eq('claim_code', normalizedCode)
    .single();

  if (findError || !player) {
    return { error: 'Invalid claim code. Please check with your coach.' };
  }

  if (player.claimed_at) {
    return { error: 'This code has already been used.' };
  }

  // Check user isn't already on this team
  const { data: existing } = await (supabase as any)
    .from('team_members')
    .select('id')
    .eq('team_id', player.team_id)
    .eq('profile_id', user.id)
    .single();

  if (existing) {
    return { error: 'You are already a member of this team.' };
  }

  // Create team_members row for this player
  const { data: member, error: memberError } = await (supabase as any)
    .from('team_members')
    .insert({
      team_id: player.team_id,
      profile_id: user.id,
      role: 'player',
    })
    .select('id')
    .single();

  if (memberError) {
    return { error: 'Failed to join team. Please try again.' };
  }

  // Link the player record to this profile
  const { error: updateError } = await (supabase as any)
    .from('players')
    .update({
      profile_id: user.id,
      team_member_id: member.id,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', player.id);

  if (updateError) {
    return { error: 'Failed to link player profile. Please try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/roster');
  return { data: { teamId: player.team_id, playerName: player.display_name } };
}
