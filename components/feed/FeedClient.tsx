'use client';
// components/feed/FeedClient.tsx
// The main team feed. Shows pinned posts first, then all posts
// ordered by recency. Coaches and players can post.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pin, Plus } from 'lucide-react';
import { PageHeader, EmptyState, Modal } from '@/components/ui';
import { AnnouncementCard } from '@/components/feed/AnnouncementCard';
import { CreatePostForm } from '@/components/feed/CreatePostForm';

export interface FeedAnnouncement {
  id: string;
  title: string | null;
  body: string;
  image_url: string | null;
  pinned: boolean;
  created_at: string;
  author_id: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  announcement_comments: { count: number }[];
}

interface FeedClientProps {
  announcements: FeedAnnouncement[];
  teamId: string;
  currentUserId: string;
  isCoach: boolean;
  canPost: boolean;
}

export function FeedClient({
  announcements,
  teamId,
  currentUserId,
  isCoach,
  canPost,
}: FeedClientProps) {
  const router = useRouter();
  const [showPostModal, setShowPostModal] = useState(false);

  const pinned = announcements.filter((a) => a.pinned);
  const regular = announcements.filter((a) => !a.pinned);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team Feed"
        description="Announcements and updates from your team"
        action={
          canPost ? (
            <button
              onClick={() => setShowPostModal(true)}
              className="btn-primary gap-2"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Post</span>
            </button>
          ) : undefined
        }
      />

      {announcements.length === 0 ? (
        <EmptyState
          icon="📣"
          title="No posts yet"
          description={
            canPost
              ? 'Share an update, practice reminder, or shoutout with your team.'
              : "Your coaches and teammates haven't posted anything yet."
          }
          action={
            canPost ? (
              <button
                onClick={() => setShowPostModal(true)}
                className="btn-primary"
              >
                Create first post
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Pinned posts */}
          {pinned.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pin size={13} className="text-brand-600" />
                <span className="text-xs font-semibold text-brand-600 uppercase tracking-wide">
                  Pinned
                </span>
              </div>
              {pinned.map((post) => (
                <AnnouncementCard
                  key={post.id}
                  announcement={post}
                  teamId={teamId}
                  currentUserId={currentUserId}
                  isCoach={isCoach}
                  onDeleted={() => router.refresh()}
                  onPinToggled={() => router.refresh()}
                />
              ))}
            </div>
          )}

          {/* Regular posts */}
          {regular.length > 0 && (
            <div className="space-y-3">
              {pinned.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Recent
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}
              {regular.map((post) => (
                <AnnouncementCard
                  key={post.id}
                  announcement={post}
                  teamId={teamId}
                  currentUserId={currentUserId}
                  isCoach={isCoach}
                  onDeleted={() => router.refresh()}
                  onPinToggled={() => router.refresh()}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create post modal */}
      <Modal
        open={showPostModal}
        onClose={() => setShowPostModal(false)}
        title="New Post"
        maxWidth="lg"
      >
        <CreatePostForm
          teamId={teamId}
          onSuccess={() => {
            setShowPostModal(false);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
