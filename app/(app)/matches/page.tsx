// app/(app)/matches/page.tsx
// Team match history with overall record summary.
// All members can view. Coaches can add and edit.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MatchesClient } from '@/components/matches/MatchesClient';

export const metadata = { title: 'Matches' };

export default async function MatchesPage() {
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

  const { data: matches } = await (supabase as any)
    .from('matches')
    .select(
      `
      id,
      opponent_name,
      match_date,
      is_home,
      our_score,
      opponent_score,
      result,
      notes,
      created_at
    `,
    )
    .eq('team_id', membership.team_id)
    .order('match_date', { ascending: false });

  return (
    <MatchesClient
      matches={matches ?? []}
      teamId={membership.team_id}
      isCoach={membership.role === 'coach'}
    />
  );
}
