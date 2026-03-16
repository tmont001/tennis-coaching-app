import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import type { TeamContext } from '@/lib/types/app.types';

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

  // Cast to any to work around incomplete database.types.ts stub.
  // These types will resolve correctly after running the Supabase CLI generator.
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select(
      `
      id,
      role,
      team_id,
      teams ( id, name ),
      profiles!team_members_profile_id_fkey ( id, full_name, avatar_url )
    `,
    )
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (!membership) redirect('/onboarding');

  const teamContext: TeamContext = {
    teamId: membership.team_id,
    teamName: membership.teams?.name ?? 'My Team',
    role: membership.role as TeamContext['role'],
    profileId: user.id,
    fullName: membership.profiles?.full_name ?? 'User',
    avatarUrl: membership.profiles?.avatar_url ?? null,
  };

  return <AppShell teamContext={teamContext}>{children}</AppShell>;
}
