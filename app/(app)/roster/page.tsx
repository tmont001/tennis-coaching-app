// app/(app)/roster/page.tsx
// Displays the full team roster. Coaches can add/import players.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RosterClient } from '@/components/roster/RosterClient';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Roster' };

export default async function RosterPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Get the user's team membership and role
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('team_id, role')
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (!membership) redirect('/onboarding');

  // Fetch all players on the team
  // Players may have a linked profile (claimed) or just a display_name (unclaimed)
  const { data: players } = await (supabase as any)
    .from('players')
    .select(
      `
      id,
      display_name,
      ladder_rank,
      singles_record_w,
      singles_record_l,
      doubles_record_w,
      doubles_record_l,
      grad_year,
      invited_email,
      notes_public,
      profile_id,
      profiles (
        id,
        full_name,
        avatar_url
      )
    `,
    )
    .eq('team_id', membership.team_id)
    .order('ladder_rank', { ascending: true, nullsFirst: false });

  return (
    <div>
      <RosterClient
        players={players ?? []}
        teamId={membership.team_id}
        isCoach={membership.role === 'coach'}
      />
    </div>
  );
}
