'use client';
// components/feed/CommentThread.tsx
// Loads and displays comments for a post. Handles adding
// and deleting comments inline.

import { useState, useEffect, useTransition } from 'react';
import { Loader2, Trash2, Send } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { addComment, deleteComment } from '@/actions/announcements';

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface CommentThreadProps {
  announcementId: string;
  currentUserId: string;
  isCoach: boolean;
}

export function CommentThread({
  announcementId,
  currentUserId,
  isCoach,
}: CommentThreadProps) {
  const supabase = createClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, startDeleteTransition] = useTransition();

  // Load comments on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('announcement_comments')
        .select(
          `
          id,
          body,
          created_at,
          author_id,
          profiles!announcement_comments_author_id_fkey (
            full_name,
            avatar_url
          )
        `,
        )
        .eq('announcement_id', announcementId)
        .order('created_at', { ascending: true });

      setComments(data ?? []);
      setLoading(false);
    }
    load();
  }, [announcementId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmitting(true);
    setError(null);

    const result = await addComment({
      announcementId,
      body: commentText.trim(),
    });

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Optimistically reload comments
    setCommentText('');
    const { data } = await (supabase as any)
      .from('announcement_comments')
      .select(
        `
        id, body, created_at, author_id,
        profiles!announcement_comments_author_id_fkey ( full_name, avatar_url )
      `,
      )
      .eq('announcement_id', announcementId)
      .order('created_at', { ascending: true });

    setComments(data ?? []);
  }

  async function handleDelete(commentId: string) {
    startDeleteTransition(async () => {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 size={16} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Comment list */}
      {comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => {
            const name = comment.profiles?.full_name ?? 'Team Member';
            const canDelete = comment.author_id === currentUserId || isCoach;
            const initials = name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div key={comment.id} className="flex items-start gap-2.5 group">
                {/* Avatar */}
                {comment.profiles?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={comment.profiles.avatar_url}
                    alt={name}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {initials}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800">
                      {name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(parseISO(comment.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">
                    {comment.body}
                  </p>
                </div>

                {/* Delete */}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                    title="Delete comment"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment…"
          className="input flex-1 text-sm py-1.5"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || !commentText.trim()}
          className="btn-primary p-2 flex-shrink-0"
        >
          {submitting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={15} />
          )}
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
