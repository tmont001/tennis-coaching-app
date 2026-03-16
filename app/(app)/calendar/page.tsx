// app/(app)/calendar/page.tsx
// Team calendar showing upcoming and past events.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CalendarClient } from '@/components/calendar/CalendarClient';

export const metadata = { title: 'Calendar' };

export default async function CalendarPage() {
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

  // Fetch all events for the team, ordered by start time
  const { data: events } = await (supabase as any)
    .from('events')
    .select(
      `
      id,
      title,
      event_type,
      starts_at,
      ends_at,
      location,
      opponent_name,
      is_home,
      status,
      description,
      created_by,
      profiles!events_created_by_fkey ( full_name )
    `,
    )
    .eq('team_id', membership.team_id)
    .order('starts_at', { ascending: true });

  return (
    <CalendarClient
      events={events ?? []}
      teamId={membership.team_id}
      isCoach={membership.role === 'coach'}
    />
  );
}
