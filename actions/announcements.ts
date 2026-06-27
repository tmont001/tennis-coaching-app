'use server';
// actions/announcements.ts
// Server actions for feed posts, comments, reactions, and media.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ── Create announcement ───────────────────────────────────────
const createSchema = z.object({
  teamId: z.string().uuid(),
  title: z.string().optional().nullable(),
  body: z.string().min(1, 'Post body is required'),
  imageUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
});

export type CreateAnnouncementInput = z.infer<typeof createSchema>;

export async function createAnnouncement(input: CreateAnnouncementInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { teamId, title, body, imageUrl, videoUrl } = parsed.data;

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
      video_url: videoUrl || null,
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

  const { data: announcement } = await (supabase as any)
    .from('announcements')
    .select('author_id')
    .eq('id', announcementId)
    .eq('team_id', teamId)
    .single();

  if (!announcement) return { error: 'Post not found.' };

  const isAuthor = announcement.author_id === user.id;

  if (!isAuthor) {
    const { data: membership } = await (supabase as any)
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('profile_id', user.id)
      .single();

    if (!membership || membership.role !== 'coach') {
      return { error: 'Only the author or a coach can delete this post.' };
    }
  }

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
  if (!parsed.success) return { error: parsed.error.issues[0].message };

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

  const { data: comment } = await (supabase as any)
    .from('announcement_comments')
    .select('author_id, announcement_id')
    .eq('id', commentId)
    .single();

  if (!comment) return { error: 'Comment not found.' };

  const isAuthor = comment.author_id === user.id;

  if (!isAuthor) {
    const { data: announcement } = await (supabase as any)
      .from('announcements')
      .select('team_id')
      .eq('id', comment.announcement_id)
      .single();

    if (!announcement) return { error: 'Post not found.' };

    const { data: membership } = await (supabase as any)
      .from('team_members')
      .select('role')
      .eq('team_id', announcement.team_id)
      .eq('profile_id', user.id)
      .single();

    if (!membership || membership.role !== 'coach') {
      return { error: 'Only the author or a coach can delete this comment.' };
    }
  }

  const { error } = await (supabase as any)
    .from('announcement_comments')
    .delete()
    .eq('id', commentId);

  if (error) return { error: 'Failed to delete comment.' };

  revalidatePath('/dashboard');
  return { data: { success: true } };
}

// ── Toggle reaction ───────────────────────────────────────────
export async function toggleReaction(announcementId: string, emoji: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: existing } = await (supabase as any)
    .from('announcement_reactions')
    .select('id')
    .eq('announcement_id', announcementId)
    .eq('profile_id', user.id)
    .eq('emoji', emoji)
    .single();

  if (existing) {
    await (supabase as any)
      .from('announcement_reactions')
      .delete()
      .eq('id', existing.id);
  } else {
    await (supabase as any).from('announcement_reactions').insert({
      announcement_id: announcementId,
      profile_id: user.id,
      emoji,
    });
  }

  revalidatePath('/dashboard');
  return { data: { success: true } };
}

// ── Upload announcement image ─────────────────────────────────
export async function uploadAnnouncementImage(
  teamId: string,
  fileName: string,
  fileBase64: string,
  mimeType: string,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const path = `${user.id}/${Date.now()}-${fileName}`;
  const buffer = Buffer.from(fileBase64, 'base64');

  const { error } = await (supabase as any).storage
    .from('announcement-images')
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) {
    console.error('uploadAnnouncementImage:', error);
    return { error: 'Failed to upload image.' };
  }

  const { data: signed } = await (supabase as any).storage
    .from('announcement-images')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

  return { data: { url: signed?.signedUrl ?? null } };
}
