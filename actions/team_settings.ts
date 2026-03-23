'use server';
// actions/team_settings.ts
// Server actions for team settings management.
// Kept in a dedicated file for clean Next.js server action resolution.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

async function verifyCoach(supabase: any, teamId: string, userId: string) {
  const { data } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', userId)
    .single();
  return data?.role === 'coach';
}

// ── Update team settings ──────────────────────────────────────
const teamSettingsSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().min(1, 'Team name is required'),
  schoolName: z.string().optional().nullable(),
  seasonYear: z.coerce.number().int().min(2020).max(2040).optional().nullable(),
  singlesCount: z.coerce.number().int().min(1).max(10),
  doublesCount: z.coerce.number().int().min(1).max(10),
});

export type TeamSettingsInput = z.infer<typeof teamSettingsSchema>;

export async function updateTeamSettings(input: TeamSettingsInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = teamSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const isCoach = await verifyCoach(
    supabase as any,
    parsed.data.teamId,
    user.id,
  );
  if (!isCoach) return { error: 'Only coaches can update team settings' };

  const { error } = await (supabase as any)
    .from('teams')
    .update({
      name: parsed.data.name,
      school_name: parsed.data.schoolName ?? null,
      season_year: parsed.data.seasonYear ?? null,
      singles_count: parsed.data.singlesCount,
      doubles_count: parsed.data.doublesCount,
    })
    .eq('id', parsed.data.teamId);

  if (error) return { error: 'Failed to update team settings.' };

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { data: { success: true } };
}

// ── Remove team member ────────────────────────────────────────
export async function removeTeamMember(memberId: string, teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can remove members' };

  const { error } = await (supabase as any)
    .from('team_members')
    .delete()
    .eq('id', memberId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to remove member.' };

  revalidatePath('/settings');
  return { data: { success: true } };
}

// ── Regenerate invite code ────────────────────────────────────
export async function regenerateInviteCode(teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can regenerate the invite code' };

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const { error } = await (supabase as any)
    .from('teams')
    .update({ invite_code: code })
    .eq('id', teamId);

  if (error) return { error: 'Failed to regenerate invite code.' };

  revalidatePath('/settings');
  return { data: { inviteCode: code } };
}
