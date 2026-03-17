// app/(app)/matches/[matchId]/page.tsx
// Match detail with lineup card.

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { MatchDetailClient } from '@/components/matches/MatchDetailClient';

export const metadata = { title: 'Match Detail' };

export default async function MatchDetailPage({
  params,
}: {
  params: { matchId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('team_id, role')
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (!membership) redirect('/onboarding');

  // Fetch match
  const { data: match } = await (supabase as any)
    .from('matches')
    .select(
      `
      id, opponent_name, match_date, is_home,
      our_score, opponent_score, result, notes, created_at
    `,
    )
    .eq('id', params.matchId)
    .eq('team_id', membership.team_id)
    .single();

  if (!match) notFound();

  // Fetch match lines with player info
  const { data: lines } = await (supabase as any)
    .from('match_lines')
    .select(
      `
      id, line_type, position, result, score,
      player1:players!match_lines_player1_id_fkey (
        id, display_name, profiles(full_name)
      ),
      player2:players!match_lines_player2_id_fkey (
        id, display_name, profiles(full_name)
      )
    `,
    )
    .eq('match_id', params.matchId)
    .eq('team_id', membership.team_id)
    .order('line_type', { ascending: true })
    .order('position', { ascending: true });

  // Fetch team settings for lineup format
  const { data: team } = await (supabase as any)
    .from('teams')
    .select('id, name, singles_count, doubles_count')
    .eq('id', membership.team_id)
    .single();

  // Fetch all players for lineup assignment dropdowns
  const { data: players } = await (supabase as any)
    .from('players')
    .select('id, display_name, ladder_rank, profiles(full_name, avatar_url)')
    .eq('team_id', membership.team_id)
    .order('ladder_rank', { ascending: true, nullsFirst: false });

  // Fetch most recent previous match with lineup data for copy-forward
  const { data: previousMatch } = await (supabase as any)
    .from('matches')
    .select('id, opponent_name, match_date')
    .eq('team_id', membership.team_id)
    .neq('id', params.matchId)
    .order('match_date', { ascending: false })
    .limit(1)
    .single();

  // Check if previous match has lineup data
  let previousMatchHasLineup = false;
  if (previousMatch) {
    const { data: prevLines } = await (supabase as any)
      .from('match_lines')
      .select('id')
      .eq('match_id', previousMatch.id)
      .limit(1);
    previousMatchHasLineup = (prevLines?.length ?? 0) > 0;
  }

  // Fetch lineup copy preference
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .single();

  const skipLineupCopyPrompt =
    profile?.preferences?.skip_lineup_copy_prompt === true;

  return (
    <MatchDetailClient
      match={match}
      lines={lines ?? []}
      team={team}
      players={players ?? []}
      teamId={membership.team_id}
      isCoach={membership.role === 'coach'}
      previousMatch={
        previousMatchHasLineup && previousMatch
          ? { id: previousMatch.id, opponentName: previousMatch.opponent_name }
          : null
      }
      skipLineupCopyPrompt={skipLineupCopyPrompt}
    />
  );
}
