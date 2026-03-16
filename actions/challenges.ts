'use server';
// actions/challenges.ts
// Server actions for challenge ladder — issue challenges,
// record results, and apply rank swaps with audit logging.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const MAX_CHALLENGE_DISTANCE = 2; // players can only challenge up to 2 spots above

async function verifyCoach(supabase: any, teamId: string, userId: string) {
  const { data } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', userId)
    .single();
  return data?.role === 'coach';
}

// ── Issue a challenge ─────────────────────────────────────────
export async function issueChallenge(
  teamId: string,
  challengerId: string, // players.id
  challengedId: string, // players.id
  scheduledDate?: string | null,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);

  // Fetch both players to validate ranks
  const { data: players } = await (supabase as any)
    .from('players')
    .select('id, ladder_rank, display_name, profiles(full_name)')
    .in('id', [challengerId, challengedId])
    .eq('team_id', teamId);

  if (!players || players.length !== 2) {
    return { error: 'Could not find both players on this team.' };
  }

  const challenger = players.find((p: any) => p.id === challengerId);
  const challenged = players.find((p: any) => p.id === challengedId);

  if (!challenger || !challenged) {
    return { error: 'Player not found.' };
  }

  // Both players must be ranked
  if (challenger.ladder_rank === null || challenged.ladder_rank === null) {
    return {
      error: 'Both players must have a ladder rank to issue a challenge.',
    };
  }

  // Challenger must have a higher rank number (lower position)
  if (challenger.ladder_rank <= challenged.ladder_rank) {
    return { error: 'You can only challenge players ranked above you.' };
  }

  // Enforce max challenge distance (coaches bypass this)
  if (!isCoach) {
    const distance = challenger.ladder_rank - challenged.ladder_rank;
    if (distance > MAX_CHALLENGE_DISTANCE) {
      return {
        error: `You can only challenge players up to ${MAX_CHALLENGE_DISTANCE} spots above you.`,
      };
    }
  }

  // Check challenger has no active challenge
  if (!isCoach) {
    const { data: activeChallenge } = await (supabase as any)
      .from('challenges')
      .select('id')
      .eq('team_id', teamId)
      .eq('challenger_id', challengerId)
      .in('status', ['pending', 'accepted'])
      .limit(1)
      .single();

    if (activeChallenge) {
      return {
        error:
          'You already have an active challenge. Wait for it to complete first.',
      };
    }
  }

  const { data, error } = await (supabase as any)
    .from('challenges')
    .insert({
      team_id: teamId,
      challenger_id: challengerId,
      challenged_id: challengedId,
      status: 'pending',
      scheduled_date: scheduledDate ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('issueChallenge:', error);
    return { error: 'Failed to issue challenge.' };
  }

  revalidatePath('/challenges');
  return { data };
}

// ── Record result (step 1) ────────────────────────────────────
// Records the winner and score. If challenger wins, returns
// rank swap preview data for the confirmation modal.
// Does NOT apply the rank swap yet.
export async function recordChallengeResult(
  challengeId: string,
  teamId: string,
  winnerId: string,
  score: string,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can record challenge results' };

  // Fetch challenge with both players
  const { data: challenge } = await (supabase as any)
    .from('challenges')
    .select(
      `
      id, status, challenger_id, challenged_id,
      challenger:players!challenges_challenger_id_fkey (
        id, ladder_rank, display_name, profiles(full_name)
      ),
      challenged:players!challenges_challenged_id_fkey (
        id, ladder_rank, display_name, profiles(full_name)
      )
    `,
    )
    .eq('id', challengeId)
    .eq('team_id', teamId)
    .single();

  if (!challenge) return { error: 'Challenge not found.' };
  if (!['pending', 'accepted'].includes(challenge.status)) {
    return { error: 'This challenge has already been completed.' };
  }

  // Update the challenge with winner and score
  const { error: updateError } = await (supabase as any)
    .from('challenges')
    .update({
      winner_id: winnerId,
      score: score || null,
      status: 'completed',
    })
    .eq('id', challengeId);

  if (updateError) return { error: 'Failed to record result.' };

  const challengerWon = winnerId === challenge.challenger_id;

  // If challenged player wins — ranks stay the same, we're done
  if (!challengerWon) {
    revalidatePath('/challenges');
    return { data: { rankSwapRequired: false } };
  }

  // Challenger won — return rank swap preview for confirmation modal
  const challenger = challenge.challenger as any;
  const challenged = challenge.challenged as any;

  const challengerName =
    challenger.profiles?.full_name ?? challenger.display_name ?? 'Challenger';
  const challengedName =
    challenged.profiles?.full_name ?? challenged.display_name ?? 'Challenged';

  revalidatePath('/challenges');
  return {
    data: {
      rankSwapRequired: true,
      challengeId,
      swapPreview: {
        challenger: {
          id: challenger.id,
          name: challengerName,
          oldRank: challenger.ladder_rank,
          newRank: challenged.ladder_rank,
        },
        challenged: {
          id: challenged.id,
          name: challengedName,
          oldRank: challenged.ladder_rank,
          newRank: challenger.ladder_rank,
        },
      },
    },
  };
}

// ── Apply rank swap (step 2) ──────────────────────────────────
// Called after coach confirms the rank change modal.
// Atomically swaps ranks and logs both changes.
export async function applyRankSwap(
  challengeId: string,
  teamId: string,
  challengerId: string,
  challengedId: string,
  challengerOldRank: number,
  challengedOldRank: number,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can apply rank swaps' };

  // Swap challenger's rank to challenged's old rank (moves up)
  const { error: e1 } = await (supabase as any)
    .from('players')
    .update({ ladder_rank: challengedOldRank })
    .eq('id', challengerId)
    .eq('team_id', teamId);

  if (e1) return { error: 'Failed to update challenger rank.' };

  // Swap challenged's rank to challenger's old rank (moves down)
  const { error: e2 } = await (supabase as any)
    .from('players')
    .update({ ladder_rank: challengerOldRank })
    .eq('id', challengedId)
    .eq('team_id', teamId);

  if (e2) return { error: 'Failed to update challenged rank.' };

  // Log both rank changes to ladder_history
  const { error: historyError } = await (supabase as any)
    .from('ladder_history')
    .insert([
      {
        team_id: teamId,
        player_id: challengerId,
        old_rank: challengerOldRank,
        new_rank: challengedOldRank,
        reason: 'challenge_result',
        challenge_id: challengeId,
        changed_by: user.id,
      },
      {
        team_id: teamId,
        player_id: challengedId,
        old_rank: challengedOldRank,
        new_rank: challengerOldRank,
        reason: 'challenge_result',
        challenge_id: challengeId,
        changed_by: user.id,
      },
    ]);

  if (historyError) {
    console.error('ladder_history insert:', historyError);
    // Non-fatal — ranks were swapped successfully, just log the error
  }

  revalidatePath('/challenges');
  revalidatePath('/roster');
  return { data: { success: true } };
}

// ── Save ladder confirm preference ───────────────────────────
// Called when coach checks "Don't show this again"
export async function saveLadderConfirmPreference(skip: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      preferences: { skip_ladder_confirm: skip },
    })
    .eq('id', user.id);

  if (error) return { error: 'Failed to save preference.' };
  return { data: { success: true } };
}

// ── Update challenge status ───────────────────────────────────
export async function updateChallengeStatus(
  challengeId: string,
  teamId: string,
  status: 'accepted' | 'declined' | 'expired',
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can update challenge status' };

  const { error } = await (supabase as any)
    .from('challenges')
    .update({ status })
    .eq('id', challengeId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to update challenge.' };

  revalidatePath('/challenges');
  return { data: { success: true } };
}
