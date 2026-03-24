'use server';
// actions/teams.ts
// Server actions for team switching, creation, and deletion.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { generateInviteCode } from '@/lib/utils/invite';

const ACTIVE_TEAM_COOKIE = 'active_team_id';

// ── Get active team ID ────────────────────────────────────────
// Reads from cookie, falls back to the user's oldest membership.
export async function getActiveTeamId(userId: string): Promise<string | null> {
  const supabase = createClient();
  const cookieStore = cookies();
  const cookieTeamId = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;

  if (cookieTeamId) {
    // Verify the user is still a member of this team
    const { data } = await (supabase as any)
      .from('team_members')
      .select('team_id')
      .eq('team_id', cookieTeamId)
      .eq('profile_id', userId)
      .single();

    if (data) return cookieTeamId;
  }

  // Fall back to oldest membership
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('team_id')
    .eq('profile_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  return membership?.team_id ?? null;
}

// ── Switch active team ────────────────────────────────────────
export async function switchTeam(teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify membership
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('team_id')
    .eq('team_id', teamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) return { error: 'You are not a member of this team' };

  // Set cookie — expires in 1 year
  cookies().set(ACTIVE_TEAM_COOKIE, teamId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
  return { data: { success: true } };
}

// ── Create a new team ─────────────────────────────────────────
const createTeamSchema = z.object({
  name: z.string().min(3, 'Team name must be at least 3 characters'),
  schoolName: z.string().optional().nullable(),
  seasonYear: z.coerce.number().int().min(2020).max(2040).optional().nullable(),
});

export async function createTeam(input: z.infer<typeof createTeamSchema>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createTeamSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const inviteCode = generateInviteCode();

  const { data: team, error: teamError } = await (supabase as any)
    .from('teams')
    .insert({
      name: parsed.data.name,
      school_name: parsed.data.schoolName ?? null,
      season_year: parsed.data.seasonYear ?? null,
      invite_code: inviteCode,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (teamError || !team) {
    console.error('createTeam:', teamError);
    return { error: 'Failed to create team.' };
  }

  // Add creator as coach
  const { error: memberError } = await (supabase as any)
    .from('team_members')
    .insert({
      team_id: team.id,
      profile_id: user.id,
      role: 'coach',
    });

  if (memberError)
    return { error: 'Team created but failed to add you as coach.' };

  // Switch to the new team
  cookies().set(ACTIVE_TEAM_COOKIE, team.id, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
  return { data: { teamId: team.id } };
}

// ── Delete team ───────────────────────────────────────────────
// Only the original creator can delete the team.
// All related data is cascade-deleted by the database.
export async function deleteTeam(teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify the user is the creator
  const { data: team } = await (supabase as any)
    .from('teams')
    .select('id, name, created_by')
    .eq('id', teamId)
    .single();

  if (!team) return { error: 'Team not found' };
  if (team.created_by !== user.id) {
    return { error: 'Only the team creator can delete this team' };
  }

  const { error } = await (supabase as any)
    .from('teams')
    .delete()
    .eq('id', teamId);

  if (error) {
    console.error('deleteTeam:', error);
    return { error: 'Failed to delete team.' };
  }

  // Clear the active team cookie
  cookies().delete(ACTIVE_TEAM_COOKIE);

  revalidatePath('/', 'layout');
  return { data: { success: true } };
}
