'use client';
// components/feed/AnnouncementCard.tsx
// A single post card with author, body, image, comment thread,
// and coach/author actions (pin, delete).

import { useState, useTransition } from 'react';
import { clsx } from 'clsx';
import {
  Pin,
  PinOff,
  Trash2,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ConfirmDialog } from '@/components/ui';
import { CommentThread } from '@/components/feed/CommentThread';
import { deleteAnnouncement, togglePin } from '@/actions/announcements';
import type { FeedAnnouncement } from '@/components/feed/FeedClient';

interface AnnouncementCardProps {
  announcement: FeedAnnouncement;
  teamId: string;
  currentUserId: string;
  isCoach: boolean;
  onDeleted: () => void;
  onPinToggled: () => void;
}

export function AnnouncementCard({
  announcement,
  teamId,
  currentUserId,
  isCoach,
  onDeleted,
  onPinToggled,
}: AnnouncementCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isPinning, startPinTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = announcement.author_id === currentUserId;
  const canDelete = isAuthor || isCoach;
  const canPin = isCoach;

  const commentCount = announcement.announcement_comments?.[0]?.count ?? 0;
  const authorName = announcement.profiles?.full_name ?? 'Team Member';
  const authorAvatar = announcement.profiles?.avatar_url ?? null;
  const timeAgo = formatDistanceToNow(parseISO(announcement.created_at), {
    addSuffix: true,
  });

  const initials = authorName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleDelete() {
    setIsDeleting(true);
    await deleteAnnouncement(announcement.id, teamId);
    setIsDeleting(false);
    setShowDeleteDialog(false);
    onDeleted();
  }

  function handlePinToggle() {
    startPinTransition(async () => {
      await togglePin(announcement.id, teamId, !announcement.pinned);
      onPinToggled();
    });
  }

  return (
    <div
      className={clsx(
        'card overflow-hidden',
        announcement.pinned && 'border-brand-200 bg-brand-50/30',
      )}
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Author */}
          <div className="flex items-center gap-3 min-w-0">
            {authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={authorAvatar}
                alt={authorName}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <span className="text-sm font-semibold text-gray-900">
                {authorName}
              </span>
              <div className="text-xs text-gray-400">{timeAgo}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {canPin && (
              <button
                onClick={handlePinToggle}
                disabled={isPinning}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  announcement.pinned
                    ? 'text-brand-600 hover:bg-brand-100'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
                )}
                title={announcement.pinned ? 'Unpin post' : 'Pin post'}
              >
                {isPinning ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : announcement.pinned ? (
                  <PinOff size={15} />
                ) : (
                  <Pin size={15} />
                )}
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete post"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        {announcement.title && (
          <h3 className="text-base font-semibold text-gray-900 mt-3">
            {announcement.title}
          </h3>
        )}

        {/* Body */}
        <p className="text-sm text-gray-700 mt-2 leading-relaxed whitespace-pre-wrap">
          {announcement.body}
        </p>
      </div>

      {/* Image */}
      {announcement.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={announcement.image_url}
          alt="Post image"
          className="w-full max-h-80 object-cover"
        />
      )}

      {/* Comment toggle */}
      <div className="px-4 py-2 border-t border-gray-100">
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
        >
          <MessageCircle size={15} />
          {commentCount > 0
            ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}`
            : 'Add a comment'}
          {commentCount > 0 &&
            (showComments ? (
              <ChevronUp size={13} />
            ) : (
              <ChevronDown size={13} />
            ))}
        </button>
      </div>

      {/* Comment thread */}
      {showComments && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
          <CommentThread
            announcementId={announcement.id}
            currentUserId={currentUserId}
            isCoach={isCoach}
          />
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Delete this post?"
        description="This post and all its comments will be permanently removed."
        confirmLabel="Delete post"
        confirmVariant="danger"
      />
    </div>
  );
}
