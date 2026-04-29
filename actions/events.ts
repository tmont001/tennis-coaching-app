'use server';
// actions/events.ts

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const eventSchema = z.object({
  teamId: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  eventType: z.enum(['practice', 'match', 'meeting', 'other']),
  startsAt: z.string().min(1, 'Start date/time is required'),
  endsAt: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  locationLat: z.number().optional().nullable(),
  locationLng: z.number().optional().nullable(),
  opponentName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isHome: z.boolean().default(true),
});

export type EventInput = z.infer<typeof eventSchema>;

export async function createEvent(input: EventInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { teamId, ...fields } = parsed.data;

  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership || membership.role !== 'coach') {
    return { error: 'Only coaches can create events' };
  }

  const { data: event, error } = await (supabase as any)
    .from('events')
    .insert({
      team_id: teamId,
      created_by: user.id,
      title: fields.title,
      event_type: fields.eventType,
      starts_at: fields.startsAt,
      ends_at: fields.endsAt ?? null,
      location: fields.location ?? null,
      location_lat: fields.locationLat ?? null,
      location_lng: fields.locationLng ?? null,
      opponent_name: fields.opponentName ?? null,
      description: fields.description ?? null,
      is_home: fields.isHome,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (error) {
    console.error('createEvent error:', error);
    return { error: 'Failed to create event. Please try again.' };
  }

  revalidatePath('/calendar');
  return { data: event };
}

const updateEventSchema = eventSchema
  .extend({
    eventId: z.string().uuid(),
  })
  .partial()
  .required({ eventId: true, teamId: true });

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export async function updateEvent(input: UpdateEventInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { eventId, teamId, ...fields } = input;

  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership || membership.role !== 'coach') {
    return { error: 'Only coaches can edit events' };
  }

  const updates: Record<string, unknown> = {};
  if (fields.title !== undefined) updates.title = fields.title;
  if (fields.eventType !== undefined) updates.event_type = fields.eventType;
  if (fields.startsAt !== undefined) updates.starts_at = fields.startsAt;
  if (fields.endsAt !== undefined) updates.ends_at = fields.endsAt;
  if (fields.location !== undefined) updates.location = fields.location;
  if (fields.opponentName !== undefined)
    updates.opponent_name = fields.opponentName;
  if (fields.description !== undefined)
    updates.description = fields.description;
  if (fields.isHome !== undefined) updates.is_home = fields.isHome;

  const { error } = await (supabase as any)
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to update event.' };

  revalidatePath('/calendar');
  revalidatePath(`/calendar/${eventId}`);
  return { data: { success: true } };
}

export async function cancelEvent(eventId: string, teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership || membership.role !== 'coach') {
    return { error: 'Only coaches can cancel events' };
  }

  const { error } = await (supabase as any)
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', eventId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to cancel event.' };

  revalidatePath('/calendar');
  revalidatePath(`/calendar/${eventId}`);
  return { data: { success: true } };
}

export async function deleteEvent(eventId: string, teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership || membership.role !== 'coach') {
    return { error: 'Only coaches can delete events' };
  }

  const { error } = await (supabase as any)
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to delete event.' };

  revalidatePath('/calendar');
  return { data: { success: true } };
}
