// app/(app)/roster/[playerId]/page.tsx
// Individual player profile page.

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { PlayerProfileClient } from '@/components/roster/PlayerProfileClient';

export const metadata = { title: 'Player Profile' };

export default async function PlayerProfilePage({
  params,
}: {
  params: { playerId: string };
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

  const { data: player } = await (supabase as any)
    .from('players')
    .select(
      `
      id,
      display_name,
      ladder_rank,
      status,
      singles_record_w,
      singles_record_l,
      doubles_record_w,
      doubles_record_l,
      grad_year,
      invited_email,
      notes_public,
      profile_id,
      team_id,
      claim_code,
      claimed_at,
      profiles (
        id,
        full_name,
        avatar_url,
        phone
      )
    `,
    )
    .eq('id', params.playerId)
    .eq('team_id', membership.team_id)
    .single();

  if (!player) notFound();

  return (
    <PlayerProfileClient
      player={player}
      isCoach={membership.role === 'coach'}
      teamId={membership.team_id}
    />
  );
}
