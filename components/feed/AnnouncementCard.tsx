'use client';
// components/feed/AnnouncementCard.tsx

import { useState, useTransition, useRef } from 'react';
import { clsx } from 'clsx';
import {
  Pin,
  PinOff,
  Trash2,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  SmilePlus,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ConfirmDialog } from '@/components/ui';
import { CommentThread } from '@/components/feed/CommentThread';
import {
  deleteAnnouncement,
  togglePin,
  toggleReaction,
} from '@/actions/announcements';
import type {
  FeedAnnouncement,
  ReactionData,
} from '@/components/feed/FeedClient';

const DEFAULT_EMOJIS = ['👍', '❤️', '🎾', '🔥', '💪', '🏆'];

interface AnnouncementCardProps {
  announcement: FeedAnnouncement;
  teamId: string;
  currentUserId: string;
  isCoach: boolean;
  canReact: boolean;
  showReactionNames: boolean;
  onDeleted: () => void;
  onPinToggled: () => void;
}

export function AnnouncementCard({
  announcement,
  teamId,
  currentUserId,
  isCoach,
  canReact,
  showReactionNames,
  onDeleted,
  onPinToggled,
}: AnnouncementCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPinning, startPinTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [reacting, startReactTransition] = useTransition();
  const [localReactions, setLocalReactions] = useState<ReactionData[]>(
    announcement.announcement_reactions ?? [],
  );
  const emojiInputRef = useRef<HTMLInputElement>(null);

  const isAuthor = announcement.author_id === currentUserId;
  const canDelete = isAuthor || isCoach;
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

  // Group reactions by emoji
  const reactionGroups = DEFAULT_EMOJIS.reduce<Record<string, ReactionData[]>>(
    (acc, emoji) => {
      const group = localReactions.filter((r) => r.emoji === emoji);
      if (group.length > 0) acc[emoji] = group;
      return acc;
    },
    {},
  );

  // Custom emojis (not in default set)
  const customReactions = localReactions.filter(
    (r) => !DEFAULT_EMOJIS.includes(r.emoji),
  );
  customReactions.forEach((r) => {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = [];
    if (!reactionGroups[r.emoji].find((x) => x.id === r.id)) {
      reactionGroups[r.emoji].push(r);
    }
  });

  function hasReacted(emoji: string) {
    return localReactions.some(
      (r) => r.emoji === emoji && r.profile_id === currentUserId,
    );
  }

  function handleReact(emoji: string) {
    if (!canReact) return;
    const alreadyReacted = hasReacted(emoji);

    // Optimistic update
    if (alreadyReacted) {
      setLocalReactions((prev) =>
        prev.filter(
          (r) => !(r.emoji === emoji && r.profile_id === currentUserId),
        ),
      );
    } else {
      setLocalReactions((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          emoji,
          profile_id: currentUserId,
          profiles: null,
        },
      ]);
    }

    startReactTransition(async () => {
      await toggleReaction(announcement.id, emoji);
    });
  }

  function handleCustomEmoji(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!val) return;
    // Take only the last character entered (the emoji)
    const emoji = [...val].slice(-1)[0];
    if (emoji && emoji.trim()) {
      handleReact(emoji);
    }
    e.target.value = '';
    setShowEmojiPicker(false);
  }

  async function handleDelete() {
    setIsDeleting(true);
    await deleteAnnouncement(announcement.id, teamId);
    setIsDeleting(false);
    setShowDeleteDialog(false);
    onDeleted();
  }

  // Extract YouTube/Vimeo embed URL
  function getVideoEmbed(url: string): string | null {
    const ytMatch = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return null;
  }

  return (
    <div
      className={clsx(
        'card overflow-hidden',
        announcement.pinned && 'border-brand-200 bg-brand-50/30',
      )}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
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

          <div className="flex items-center gap-1 flex-shrink-0">
            {isCoach && (
              <button
                onClick={() =>
                  startPinTransition(async () => {
                    await togglePin(
                      announcement.id,
                      teamId,
                      !announcement.pinned,
                    );
                    onPinToggled();
                  })
                }
                disabled={isPinning}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  announcement.pinned
                    ? 'text-brand-600 hover:bg-brand-100'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
                )}
                title={announcement.pinned ? 'Unpin' : 'Pin'}
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

        {announcement.title && (
          <h3 className="text-base font-semibold text-gray-900 mt-3">
            {announcement.title}
          </h3>
        )}
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

      {/* Video embed */}
      {announcement.video_url &&
        (() => {
          const embedUrl = getVideoEmbed(announcement.video_url);
          if (embedUrl) {
            return (
              <div
                className="relative w-full"
                style={{ paddingBottom: '56.25%' }}
              >
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            );
          }
          // Fallback: just show a link
          return (
            <div className="px-4 py-2">
              <a
                href={announcement.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-600 hover:underline break-all"
              >
                📹 {announcement.video_url}
              </a>
            </div>
          );
        })()}

      {/* Reactions display */}
      {Object.keys(reactionGroups).length > 0 && (
        <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1.5">
          {Object.entries(reactionGroups).map(([emoji, reactors]) => {
            const iMine = reactors.some((r) => r.profile_id === currentUserId);
            const names = reactors
              .map((r) => r.profiles?.full_name ?? 'Someone')
              .join(', ');

            return (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                disabled={!canReact}
                title={showReactionNames ? names : undefined}
                className={clsx(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-colors',
                  iMine
                    ? 'bg-brand-100 border-brand-300 text-brand-800'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100',
                  !canReact && 'cursor-default',
                )}
              >
                <span>{emoji}</span>
                <span className="text-xs font-medium">{reactors.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Reaction bar + comment toggle */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        {/* Default emoji buttons */}
        {canReact && (
          <div className="flex items-center gap-1">
            {DEFAULT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={clsx(
                  'w-7 h-7 rounded-lg text-base flex items-center justify-center transition-colors hover:bg-gray-100',
                  hasReacted(emoji) && 'bg-brand-100',
                )}
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}

            {/* Custom emoji trigger */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowEmojiPicker(true);
                  setTimeout(() => emojiInputRef.current?.focus(), 50);
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Add custom reaction"
              >
                <SmilePlus size={14} />
              </button>
              {/* Hidden input that triggers native emoji keyboard */}
              <input
                ref={emojiInputRef}
                type="text"
                className="absolute opacity-0 w-1 h-1 pointer-events-none"
                onChange={handleCustomEmoji}
                onBlur={() => setShowEmojiPicker(false)}
              />
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Comment toggle */}
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
        >
          <MessageCircle size={15} />
          {commentCount > 0
            ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}`
            : 'Comment'}
          {commentCount > 0 &&
            (showComments ? (
              <ChevronUp size={13} />
            ) : (
              <ChevronDown size={13} />
            ))}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
          <CommentThread
            announcementId={announcement.id}
            currentUserId={currentUserId}
            isCoach={isCoach}
          />
        </div>
      )}

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
