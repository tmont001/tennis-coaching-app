// app/(app)/challenges/page.tsx
// Challenge ladder — ranked player list and challenge history.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ChallengesClient } from '@/components/challenges/ChallengesClient';

export const metadata = { title: 'Challenge Ladder' };

export default async function ChallengesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('team_id, role, profile_id')
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (!membership) redirect('/onboarding');

  // Fetch all ranked players ordered by rank
  const { data: players } = await (supabase as any)
    .from('players')
    .select(
      `
      id,
      display_name,
      ladder_rank,
      singles_record_w,
      singles_record_l,
      profile_id,
      profiles ( id, full_name, avatar_url )
    `,
    )
    .eq('team_id', membership.team_id)
    .not('ladder_rank', 'is', null)
    .order('ladder_rank', { ascending: true });

  // Fetch unranked players separately
  const { data: unrankedPlayers } = await (supabase as any)
    .from('players')
    .select(
      `
      id,
      display_name,
      profile_id,
      profiles ( id, full_name, avatar_url )
    `,
    )
    .eq('team_id', membership.team_id)
    .is('ladder_rank', null);

  // Fetch active and recent challenges
  const { data: challenges } = await (supabase as any)
    .from('challenges')
    .select(
      `
      id,
      status,
      scheduled_date,
      score,
      created_at,
      winner_id,
      challenger:players!challenges_challenger_id_fkey (
        id, ladder_rank, display_name,
        profiles ( full_name, avatar_url )
      ),
      challenged:players!challenges_challenged_id_fkey (
        id, ladder_rank, display_name,
        profiles ( full_name, avatar_url )
      )
    `,
    )
    .eq('team_id', membership.team_id)
    .order('created_at', { ascending: false })
    .limit(30);

  // Find the current user's player record (if role is player)
  const { data: myPlayer } = await (supabase as any)
    .from('players')
    .select('id, ladder_rank')
    .eq('team_id', membership.team_id)
    .eq('profile_id', user.id)
    .single();

  // Fetch skip_ladder_confirm preference
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .single();

  const skipLadderConfirm = profile?.preferences?.skip_ladder_confirm === true;

  return (
    <ChallengesClient
      rankedPlayers={players ?? []}
      unrankedPlayers={unrankedPlayers ?? []}
      challenges={challenges ?? []}
      teamId={membership.team_id}
      isCoach={membership.role === 'coach'}
      myPlayerId={myPlayer?.id ?? null}
      myLadderRank={myPlayer?.ladder_rank ?? null}
      skipLadderConfirm={skipLadderConfirm}
    />
  );
}
