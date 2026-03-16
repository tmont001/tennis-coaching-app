'use server';
// actions/announcements.ts
// Server actions for feed posts and comments.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ── Create announcement ───────────────────────────────────────
const createSchema = z.object({
  teamId: z.string().uuid(),
  title: z.string().optional().nullable(),
  body: z.string().min(1, 'Post body is required'),
  imageUrl: z.string().url().optional().nullable(),
});

export type CreateAnnouncementInput = z.infer<typeof createSchema>;

export async function createAnnouncement(input: CreateAnnouncementInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { teamId, title, body, imageUrl } = parsed.data;

  // Verify user is coach or player (not parent)
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) return { error: 'Not a team member' };
  if (membership.role === 'parent')
    return { error: 'Parents cannot post announcements' };

  const { data, error } = await (supabase as any)
    .from('announcements')
    .insert({
      team_id: teamId,
      author_id: user.id,
      title: title || null,
      body,
      image_url: imageUrl || null,
      pinned: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('createAnnouncement error:', error);
    return { error: 'Failed to post announcement.' };
  }

  revalidatePath('/dashboard');
  return { data };
}

// ── Delete announcement ───────────────────────────────────────
export async function deleteAnnouncement(
  announcementId: string,
  teamId: string,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await (supabase as any)
    .from('announcements')
    .delete()
    .eq('id', announcementId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to delete post.' };

  revalidatePath('/dashboard');
  return { data: { success: true } };
}

// ── Toggle pin ────────────────────────────────────────────────
export async function togglePin(
  announcementId: string,
  teamId: string,
  pinned: boolean,
) {
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
    return { error: 'Only coaches can pin posts' };
  }

  const { error } = await (supabase as any)
    .from('announcements')
    .update({ pinned })
    .eq('id', announcementId)
    .eq('team_id', teamId);

  if (error) return { error: 'Failed to update pin.' };

  revalidatePath('/dashboard');
  return { data: { success: true } };
}

// ── Add comment ───────────────────────────────────────────────
const commentSchema = z.object({
  announcementId: z.string().uuid(),
  body: z.string().min(1, 'Comment cannot be empty'),
});

export async function addComment(input: z.infer<typeof commentSchema>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { data, error } = await (supabase as any)
    .from('announcement_comments')
    .insert({
      announcement_id: parsed.data.announcementId,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select('id')
    .single();

  if (error) {
    console.error('addComment error:', error);
    return { error: 'Failed to post comment.' };
  }

  revalidatePath('/dashboard');
  return { data };
}

// ── Delete comment ────────────────────────────────────────────
export async function deleteComment(commentId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await (supabase as any)
    .from('announcement_comments')
    .delete()
    .eq('id', commentId);

  if (error) return { error: 'Failed to delete comment.' };

  revalidatePath('/dashboard');
  return { data: { success: true } };
}
