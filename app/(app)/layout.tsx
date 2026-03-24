// app/(app)/layout.tsx
// Authenticated layout. Reads the active team from cookie,
// falls back to oldest membership if none set.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import type { TeamContext } from '@/lib/types/app.types';
import { getActiveTeamId } from '@/actions/teams';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Get active team ID from cookie or oldest membership
  const activeTeamId = await getActiveTeamId(user.id);
  if (!activeTeamId) redirect('/onboarding');

  // Load the active team membership
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select(
      `
      id,
      role,
      team_id,
      teams ( id, name, created_by ),
      profiles!team_members_profile_id_fkey ( id, full_name, avatar_url )
    `,
    )
    .eq('team_id', activeTeamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) redirect('/onboarding');

  // Load all teams this user belongs to (for the switcher)
  const { data: allMemberships } = await (supabase as any)
    .from('team_members')
    .select(
      `
      team_id,
      role,
      teams ( id, name, school_name )
    `,
    )
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: true });

  const teamContext: TeamContext = {
    teamId: membership.team_id,
    teamName: (membership.teams as any).name,
    role: membership.role as TeamContext['role'],
    profileId: user.id,
    fullName: (membership.profiles as any).full_name,
    avatarUrl: (membership.profiles as any).avatar_url,
    isCreator: (membership.teams as any).created_by === user.id,
  };

  const allTeams = (allMemberships ?? []).map((m: any) => ({
    id: m.teams.id,
    name: m.teams.name,
    schoolName: m.teams.school_name,
    role: m.role,
  }));

  return (
    <AppShell teamContext={teamContext} allTeams={allTeams}>
      {children}
    </AppShell>
  );
}
