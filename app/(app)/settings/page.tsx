// app/(app)/settings/page.tsx
// Team settings — visible to all members, editable by coaches only.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SettingsClient } from '@/components/settings/SettingsClient';

export const metadata = { title: 'Team Settings' };

export default async function SettingsPage() {
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

  // Fetch team details
  const { data: team } = await (supabase as any)
    .from('teams')
    .select(
      'id, name, school_name, season_year, invite_code, singles_count, doubles_count',
    )
    .eq('id', membership.team_id)
    .single();

  // Fetch all team members with profiles
  const { data: members } = await (supabase as any)
    .from('team_members')
    .select(
      `
      id, role, joined_at,
      profiles ( id, full_name, avatar_url )
    `,
    )
    .eq('team_id', membership.team_id)
    .order('joined_at', { ascending: true });

  return (
    <SettingsClient
      team={team}
      members={members ?? []}
      currentUserId={user.id}
      isCoach={membership.role === 'coach'}
    />
  );
}
