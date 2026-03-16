'use server';
// actions/practices.ts
// Server actions for practice plan creation and management.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ── Verify coach helper ───────────────────────────────────────
async function verifyCoach(supabase: any, teamId: string, userId: string) {
  const { data } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', userId)
    .single();
  return data?.role === 'coach';
}

// ── Create practice plan ──────────────────────────────────────
const createPlanSchema = z.object({
  teamId: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  notes: z.string().optional().nullable(),
  durationMin: z.coerce.number().int().min(1).optional().nullable(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export async function createPracticePlan(input: CreatePlanInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createPlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const isCoach = await verifyCoach(
    supabase as any,
    parsed.data.teamId,
    user.id,
  );
  if (!isCoach) return { error: 'Only coaches can create practice plans' };

  const { data, error } = await (supabase as any)
    .from('practice_plans')
    .insert({
      team_id: parsed.data.teamId,
      created_by: user.id,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      duration_min: parsed.data.durationMin ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('createPracticePlan:', error);
    return { error: 'Failed to create practice plan.' };
  }

  revalidatePath('/practices');
  return { data };
}

// ── Update practice plan ──────────────────────────────────────
export async function updatePracticePlan(
  planId: string,
  teamId: string,
  updates: {
    title?: string;
    notes?: string | null;
    durationMin?: number | null;
  },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can edit practice plans' };

  const { error } = await (supabase as any)
    .from('practice_plans')
    .update({
      title: updates.title,
      notes: updates.notes,
      duration_min: updates.durationMin,
    })
    .eq('id', planId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to update practice plan.' };

  revalidatePath('/practices');
  revalidatePath(`/practices/${planId}`);
  return { data: { success: true } };
}

// ── Delete practice plan ──────────────────────────────────────
export async function deletePracticePlan(planId: string, teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can delete practice plans' };

  const { error } = await (supabase as any)
    .from('practice_plans')
    .delete()
    .eq('id', planId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to delete practice plan.' };

  revalidatePath('/practices');
  return { data: { success: true } };
}

// ── Add block ─────────────────────────────────────────────────
const blockSchema = z.object({
  practicePlanId: z.string().uuid(),
  blockType: z.enum(['warmup', 'drill', 'game', 'cooldown', 'other']),
  title: z.string().min(1, 'Block title is required'),
  description: z.string().optional().nullable(),
  durationMin: z.coerce
    .number()
    .int()
    .min(1, 'Duration must be at least 1 minute'),
  sortOrder: z.coerce.number().int().default(0),
});

export type BlockInput = z.infer<typeof blockSchema>;

export async function addPracticeBlock(teamId: string, input: BlockInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can add blocks' };

  const { data, error } = await (supabase as any)
    .from('practice_plan_blocks')
    .insert({
      practice_plan_id: parsed.data.practicePlanId,
      block_type: parsed.data.blockType,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      duration_min: parsed.data.durationMin,
      sort_order: parsed.data.sortOrder,
    })
    .select('id')
    .single();

  if (error) {
    console.error('addPracticeBlock:', error);
    return { error: 'Failed to add block.' };
  }

  revalidatePath(`/practices/${parsed.data.practicePlanId}`);
  return { data };
}

// ── Update block ──────────────────────────────────────────────
export async function updatePracticeBlock(
  blockId: string,
  teamId: string,
  updates: {
    blockType?: string;
    title?: string;
    description?: string | null;
    durationMin?: number;
    sortOrder?: number;
  },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can edit blocks' };

  const { error } = await (supabase as any)
    .from('practice_plan_blocks')
    .update({
      block_type: updates.blockType,
      title: updates.title,
      description: updates.description,
      duration_min: updates.durationMin,
      sort_order: updates.sortOrder,
    })
    .eq('id', blockId);

  if (error) return { error: 'Failed to update block.' };

  return { data: { success: true } };
}

// ── Delete block ──────────────────────────────────────────────
export async function deletePracticeBlock(blockId: string, teamId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can delete blocks' };

  const { error } = await (supabase as any)
    .from('practice_plan_blocks')
    .delete()
    .eq('id', blockId);

  if (error) return { error: 'Failed to delete block.' };

  return { data: { success: true } };
}

// ── Reorder blocks ────────────────────────────────────────────
// Takes an ordered array of block IDs and updates sort_order
export async function reorderBlocks(
  teamId: string,
  planId: string,
  orderedBlockIds: string[],
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can reorder blocks' };

  // Update each block's sort_order based on its position in the array
  const updates = orderedBlockIds.map((id, index) =>
    (supabase as any)
      .from('practice_plan_blocks')
      .update({ sort_order: index })
      .eq('id', id),
  );

  await Promise.all(updates);

  revalidatePath(`/practices/${planId}`);
  return { data: { success: true } };
}

// ── Link plan to event ────────────────────────────────────────
export async function linkPlanToEvent(
  eventId: string,
  planId: string | null,
  teamId: string,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const isCoach = await verifyCoach(supabase as any, teamId, user.id);
  if (!isCoach) return { error: 'Only coaches can link plans to events' };

  const { error } = await (supabase as any)
    .from('events')
    .update({ practice_plan_id: planId })
    .eq('id', eventId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to link plan.' };

  revalidatePath('/calendar');
  revalidatePath(`/calendar/${eventId}`);
  revalidatePath('/practices');
  return { data: { success: true } };
}
