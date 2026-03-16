// app/(app)/calendar/[eventId]/page.tsx
// Event detail page — shows full event info with edit/cancel for coaches.

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { EventDetailClient } from '@/components/calendar/EventDetailClient';

export const metadata = { title: 'Event' };

export default async function EventDetailPage({
  params,
}: {
  params: { eventId: string };
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

  const { data: event } = await (supabase as any)
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
      created_at,
      profiles!events_created_by_fkey ( full_name )
    `,
    )
    .eq('id', params.eventId)
    .eq('team_id', membership.team_id)
    .single();

  if (!event) notFound();

  return (
    <EventDetailClient
      event={event}
      teamId={membership.team_id}
      isCoach={membership.role === 'coach'}
    />
  );
}
