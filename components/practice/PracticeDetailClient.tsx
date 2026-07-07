'use client';
// components/practice/PracticeDetailClient.tsx
// Full practice plan editor. Shows ordered blocks, allows adding,
// editing, reordering, and deleting blocks. Also handles
// linking the plan to a calendar event.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Clock,
  Pencil,
  Trash2,
  Unlink,
  Link2,
  CalendarDays,
  Check,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { Modal, ConfirmDialog, EmptyState } from '@/components/ui';
import { AddBlockForm } from '@/components/practice/AddBlockForm';
import { EditBlockForm } from '@/components/practice/EditBlockForm';
import {
  deletePracticeBlock,
  reorderBlocks,
  linkPlanToEvent,
  updatePracticePlan,
} from '@/actions/practices';

// ── Types ─────────────────────────────────────────────────────
export interface PracticeBlock {
  id: string;
  block_type: 'warmup' | 'drill' | 'game' | 'cooldown' | 'other';
  title: string;
  description: string | null;
  duration_min: number;
  sort_order: number;
}

export interface PracticePlan {
  id: string;
  title: string;
  notes: string | null;
  duration_min: number | null;
  created_at: string;
  practice_plan_blocks: PracticeBlock[];
}

interface LinkedEvent {
  id: string;
  title: string;
  starts_at: string;
  event_type: string;
}

// ── Block type config ─────────────────────────────────────────
const BLOCK_CONFIG = {
  warmup: {
    label: 'Warmup',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    dot: 'bg-orange-400',
  },
  drill: {
    label: 'Drill',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-400',
  },
  game: {
    label: 'Game',
    color: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-400',
  },
  cooldown: {
    label: 'Cooldown',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    dot: 'bg-purple-400',
  },
  other: {
    label: 'Other',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
  },
};

// ── Main component ────────────────────────────────────────────
export function PracticeDetailClient({
  plan,
  teamId,
  linkedEvents,
  availableEvents,
}: {
  plan: PracticePlan;
  teamId: string;
  linkedEvents: LinkedEvent[];
  availableEvents: LinkedEvent[];
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<PracticeBlock[]>(
    plan.practice_plan_blocks,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<PracticeBlock | null>(null);
  const [deletingBlock, setDeletingBlock] = useState<PracticeBlock | null>(
    null,
  );
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const [unlinkLoading, startUnlinkTransition] = useTransition();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(plan.title);
  const [savingTitle, startTitleTransition] = useTransition();

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(plan.notes ?? '');
  const [savingNotes, startNotesTransition] = useTransition();

  // Calculate total duration from blocks
  const totalDuration = blocks.reduce((sum, b) => sum + b.duration_min, 0);

  async function handleDeleteBlock() {
    if (!deletingBlock) return;
    setDeleteLoading(true);
    await deletePracticeBlock(deletingBlock.id, teamId);
    setBlocks((prev) => prev.filter((b) => b.id !== deletingBlock.id));
    setDeleteLoading(false);
    setDeletingBlock(null);
  }

  function handleBlockAdded(newBlock: PracticeBlock) {
    setBlocks((prev) =>
      [...prev, newBlock].sort((a, b) => a.sort_order - b.sort_order),
    );
    setShowAddModal(false);
  }

  function handleBlockUpdated(updated: PracticeBlock) {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setEditingBlock(null);
  }

  // Simple drag-free reorder via up/down arrows
  async function moveBlock(blockId: string, direction: 'up' | 'down') {
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === blocks.length - 1) return;

    const newBlocks = [...blocks];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newBlocks[idx], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[idx]];
    const reordered = newBlocks.map((b, i) => ({ ...b, sort_order: i }));
    setBlocks(reordered);

    await reorderBlocks(
      teamId,
      plan.id,
      reordered.map((b) => b.id),
    );
  }

  function saveTitle() {
    if (!titleValue.trim() || titleValue === plan.title) {
      setEditingTitle(false);
      setTitleValue(plan.title);
      return;
    }
    startTitleTransition(async () => {
      await updatePracticePlan(plan.id, teamId, { title: titleValue.trim() });
      setEditingTitle(false);
    });
  }

  function saveNotes() {
    const trimmed = notesValue.trim();
    if (trimmed === (plan.notes ?? '')) {
      setEditingNotes(false);
      return;
    }
    startNotesTransition(async () => {
      await updatePracticePlan(plan.id, teamId, { notes: trimmed || null });
      setEditingNotes(false);
    });
  }

  function handleUnlink(eventId: string) {
    startUnlinkTransition(async () => {
      await linkPlanToEvent(eventId, null, teamId);
      setConfirmUnlinkId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Plans
      </button>

      {/* Plan header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTitle();
                    if (e.key === 'Escape') {
                      setEditingTitle(false);
                      setTitleValue(plan.title);
                    }
                  }}
                  className="input text-lg font-bold flex-1"
                  autoFocus
                />
                <button onClick={saveTitle} className="btn-primary p-2">
                  <Check size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="text-xl font-bold text-gray-900 hover:text-brand-700 transition-colors text-left group flex items-center gap-2"
              >
                {titleValue}
                <Pencil
                  size={13}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity"
                />
              </button>
            )}

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Clock size={13} />
                {totalDuration > 0
                  ? `${totalDuration} min total`
                  : 'No duration yet'}
              </span>
              <span className="text-sm text-gray-400">
                {blocks.length} block{blocks.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowLinkModal(true)}
            className="btn-secondary gap-2 flex-shrink-0 text-sm"
          >
            <Link2 size={14} />
            <span className="hidden sm:inline">Link to event</span>
          </button>
        </div>

        {/* Linked events */}
        {linkedEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">
              Linked to
            </p>
            <div className="space-y-2">
              {linkedEvents.map((event) => (
                <div key={event.id}>
                  {confirmUnlinkId === event.id ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 flex-1">
                        Unlink from{' '}
                        <span className="font-medium">{event.title}</span>?
                      </span>
                      <button
                        onClick={() => handleUnlink(event.id)}
                        disabled={unlinkLoading}
                        className="text-xs text-red-600 hover:underline font-medium"
                      >
                        {unlinkLoading ? 'Unlinking…' : 'Unlink'}
                      </button>
                      <button
                        onClick={() => setConfirmUnlinkId(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-600 group">
                      <CalendarDays size={13} className="text-brand-500 flex-shrink-0" />
                      <span className="flex-1">
                        {event.title} —{' '}
                        <span className="text-gray-400">
                          {format(parseISO(event.starts_at), 'MMM d, yyyy')}
                        </span>
                      </span>
                      <button
                        onClick={() => setConfirmUnlinkId(event.id)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-colors"
                        title="Unlink this event"
                      >
                        <Unlink size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Plan notes — editable */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
              Notes
            </p>
            {!editingNotes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-xs text-brand-600 hover:underline font-medium"
              >
                {notesValue ? 'Edit' : 'Add'}
              </button>
            )}
          </div>

          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={3}
                className="input resize-none w-full text-sm"
                placeholder="Focus areas, goals, or reminders for this practice…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditingNotes(false);
                    setNotesValue(plan.notes ?? '');
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="btn-primary text-sm py-1.5 px-3"
                >
                  {savingNotes ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingNotes(false);
                    setNotesValue(plan.notes ?? '');
                  }}
                  className="btn-secondary text-sm py-1.5 px-3"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : notesValue ? (
            <p className="text-sm text-gray-600 leading-relaxed">{notesValue}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">
              No notes added — click Add to include focus areas.
            </p>
          )}
        </div>
      </div>

      {/* Blocks section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Blocks
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary gap-1.5 text-sm py-1.5"
          >
            <Plus size={14} />
            Add Block
          </button>
        </div>

        {blocks.length === 0 ? (
          <EmptyState
            icon="🎾"
            title="No blocks yet"
            description="Add warmups, drills, games, and cooldowns to build your practice."
            action={
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary"
              >
                Add first block
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {blocks.map((block, idx) => {
              const config = BLOCK_CONFIG[block.block_type];
              return (
                <div
                  key={block.id}
                  className="card px-4 py-3 flex items-center gap-3 group"
                >
                  {/* Reorder arrows */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => moveBlock(block.id, 'up')}
                      disabled={idx === 0}
                      className="text-gray-200 hover:text-gray-400 disabled:opacity-20 transition-colors leading-none"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveBlock(block.id, 'down')}
                      disabled={idx === blocks.length - 1}
                      className="text-gray-200 hover:text-gray-400 disabled:opacity-20 transition-colors leading-none"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Color dot */}
                  <div
                    className={clsx(
                      'w-2.5 h-2.5 rounded-full flex-shrink-0',
                      config.dot,
                    )}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {block.title}
                      </span>
                      <span
                        className={clsx(
                          'text-xs px-1.5 py-0.5 rounded border font-medium',
                          config.color,
                        )}
                      >
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400 flex items-center gap-0.5">
                        <Clock size={10} />
                        {block.duration_min} min
                      </span>
                      {block.description && (
                        <span className="text-xs text-gray-400 truncate max-w-[200px]">
                          {block.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions — always visible on mobile, hover-only on desktop */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingBlock(block)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      title="Edit block"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeletingBlock(block)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete block"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Duration summary bar */}
            <div className="card px-4 py-3 bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-500">Total practice time</span>
              <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                <Clock size={13} className="text-brand-500" />
                {totalDuration} minutes
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add block modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Block"
      >
        <AddBlockForm
          planId={plan.id}
          teamId={teamId}
          nextSortOrder={blocks.length}
          onSuccess={handleBlockAdded}
        />
      </Modal>

      {/* Edit block modal */}
      <Modal
        open={!!editingBlock}
        onClose={() => setEditingBlock(null)}
        title="Edit Block"
      >
        {editingBlock && (
          <EditBlockForm
            block={editingBlock}
            teamId={teamId}
            onSuccess={handleBlockUpdated}
          />
        )}
      </Modal>

      {/* Delete block confirm */}
      <ConfirmDialog
        open={!!deletingBlock}
        onClose={() => setDeletingBlock(null)}
        onConfirm={handleDeleteBlock}
        loading={deleteLoading}
        title="Delete this block?"
        description={`"${deletingBlock?.title}" will be removed from this practice plan.`}
        confirmLabel="Delete block"
        confirmVariant="danger"
      />

      {/* Link to event modal */}
      <Modal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="Link to Practice Event"
        maxWidth="sm"
      >
        <LinkToEventForm
          planId={plan.id}
          teamId={teamId}
          availableEvents={availableEvents}
          onSuccess={() => {
            setShowLinkModal(false);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

// ── Link to event form ────────────────────────────────────────
function LinkToEventForm({
  planId,
  teamId,
  availableEvents,
  onSuccess,
}: {
  planId: string;
  teamId: string;
  availableEvents: LinkedEvent[];
  onSuccess: () => void;
}) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    if (!selectedEventId) return;
    setLoading(true);
    setError(null);
    const result = await linkPlanToEvent(selectedEventId, planId, teamId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  }

  if (availableEvents.length === 0) {
    return (
      <div className="text-center py-4 space-y-2">
        <p className="text-sm text-gray-500">
          No unlinked practice events found. Create a practice event on the
          calendar first, then come back to link it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Select a practice event to attach this plan to. It will appear on the
        event detail page.
      </p>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {availableEvents.map((event) => (
          <label
            key={event.id}
            className={clsx(
              'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
              selectedEventId === event.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-200 hover:border-brand-300',
            )}
          >
            <input
              type="radio"
              name="event"
              value={event.id}
              checked={selectedEventId === event.id}
              onChange={() => setSelectedEventId(event.id)}
              className="accent-brand-600"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {event.title}
              </div>
              <div className="text-xs text-gray-400">
                {format(parseISO(event.starts_at), 'EEE, MMM d · h:mm a')}
              </div>
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={handleLink}
        disabled={!selectedEventId || loading}
        className="btn-primary w-full"
      >
        {loading ? 'Linking…' : 'Link to event'}
      </button>
    </div>
  );
}
