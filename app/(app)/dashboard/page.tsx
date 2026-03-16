// app/(app)/dashboard/page.tsx
// Team feed — shows pinned posts first, then all announcements
// ordered by most recent.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { FeedClient } from '@/components/feed/FeedClient';

export const metadata = { title: 'Team Feed' };

export default async function DashboardPage() {
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

  // Fetch announcements with author profiles and comment counts
  const { data: announcements } = await (supabase as any)
    .from('announcements')
    .select(
      `
      id,
      title,
      body,
      image_url,
      pinned,
      created_at,
      author_id,
      profiles!announcements_author_id_fkey (
        id,
        full_name,
        avatar_url
      ),
      announcement_comments ( count )
    `,
    )
    .eq('team_id', membership.team_id)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  return (
    <FeedClient
      announcements={announcements ?? []}
      teamId={membership.team_id}
      currentUserId={user.id}
      isCoach={membership.role === 'coach'}
      canPost={membership.role === 'coach' || membership.role === 'player'}
    />
  );
}
