'use client';
// components/roster/RosterClient.tsx

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  UserPlus,
  Upload,
  Trophy,
  ArrowUpDown,
  BarChart2,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { PageHeader, EmptyState, Modal } from '@/components/ui';
import { AddPlayerForm } from '@/components/roster/AddPlayerForm';
import { CsvImportForm } from '@/components/roster/CsvImportForm';
import { RosterPlayerCard } from '@/components/roster/RosterPlayerCard';
import { RosterStatsTable } from '@/components/roster/RosterStatsTable';
import { deletePlayer } from '@/actions/roster';

export interface RosterPlayer {
  id: string;
  display_name: string | null;
  ladder_rank: number | null;
  singles_record_w: number;
  singles_record_l: number;
  doubles_record_w: number;
  doubles_record_l: number;
  singles_sets_won: number;
  singles_sets_lost: number;
  doubles_sets_won: number;
  doubles_sets_lost: number;
  grad_year: number | null;
  invited_email: string | null;
  notes_public: string | null;
  profile_id: string | null;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

type SortMode = 'rank' | 'alpha';
type TabMode = 'roster' | 'stats';

export function RosterClient({
  players,
  teamId,
  isCoach,
}: {
  players: RosterPlayer[];
  teamId: string;
  isCoach: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabMode>('roster');
  const [sortMode, setSortMode] = useState<SortMode>('rank');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, startBulkDelete] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const sorted = [...players].sort((a, b) => {
    if (sortMode === 'rank') {
      if (a.ladder_rank === null && b.ladder_rank === null) return 0;
      if (a.ladder_rank === null) return 1;
      if (b.ladder_rank === null) return -1;
      return a.ladder_rank - b.ladder_rank;
    }
    const na = (a.profiles?.full_name ?? a.display_name ?? '').toLowerCase();
    const nb = (b.profiles?.full_name ?? b.display_name ?? '').toLowerCase();
    return na.localeCompare(nb);
  });

  const playerCount = players.length;
  const claimedCount = players.filter((p) => p.profile_id !== null).length;

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(
      selected.size === sorted.length
        ? new Set()
        : new Set(sorted.map((p) => p.id)),
    );
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setBulkError(null);
  }

  function handleBulkDeleteConfirm() {
    setBulkError(null);
    startBulkDelete(async () => {
      const ids = Array.from(selected);
      const results = await Promise.all(
        ids.map((id) => deletePlayer(id, teamId)),
      );
      const failed = results.filter((r) => r.error);
      if (failed.length > 0) {
        setBulkError(
          `Failed to remove ${failed.length} player${failed.length !== 1 ? 's' : ''}. Try again.`,
        );
      } else {
        setShowBulkConfirm(false);
        exitSelectMode();
        router.refresh();
      }
    });
  }

  const selectedNames = sorted
    .filter((p) => selected.has(p.id))
    .slice(0, 3)
    .map((p) => p.profiles?.full_name ?? p.display_name ?? 'Player')
    .join(', ');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roster"
        description={
          playerCount > 0
            ? `${playerCount} player${playerCount !== 1 ? 's' : ''} · ${claimedCount} with accounts`
            : undefined
        }
        action={
          isCoach ? (
            <div className="flex gap-2">
              {!selectMode ? (
                <>
                  <button
                    onClick={() => setSelectMode(true)}
                    className="btn-secondary gap-2 text-sm"
                    title="Select players to remove"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Select</span>
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="btn-secondary gap-2"
                  >
                    <Upload size={15} />
                    <span className="hidden sm:inline">Import CSV</span>
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary gap-2"
                  >
                    <UserPlus size={15} />
                    <span className="hidden sm:inline">Add Player</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={exitSelectMode}
                    className="btn-secondary gap-2 text-sm"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowBulkConfirm(true)}
                    disabled={selected.size === 0 || bulkDeleting}
                    className="btn-danger gap-2 text-sm"
                  >
                    <Trash2 size={14} />
                    Remove {selected.size > 0 ? `(${selected.size})` : ''}
                  </button>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {selectMode && sorted.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-brand-50 border border-brand-200 rounded-xl text-sm">
          <input
            type="checkbox"
            className="accent-brand-600 w-4 h-4"
            checked={selected.size === sorted.length}
            onChange={toggleSelectAll}
          />
          <span className="text-brand-700 font-medium">
            {selected.size === 0
              ? 'Select players to remove'
              : `${selected.size} of ${sorted.length} selected`}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('roster')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'roster'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <Trophy size={13} />
          Roster
        </button>
        <button
          onClick={() => setTab('stats')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'stats'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <BarChart2 size={13} />
          Stats
        </button>
      </div>

      {tab === 'roster' && (
        <>
          {!selectMode && playerCount > 0 && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button
                onClick={() => setSortMode('rank')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  sortMode === 'rank'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <Trophy size={13} />
                By Rank
              </button>
              <button
                onClick={() => setSortMode('alpha')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  sortMode === 'alpha'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <ArrowUpDown size={13} />
                A–Z
              </button>
            </div>
          )}

          {sorted.length === 0 ? (
            <EmptyState
              icon="🎾"
              title="No players yet"
              description={
                isCoach
                  ? 'Add players individually or import your roster from a CSV file.'
                  : "Your coach hasn't added any players yet."
              }
              action={
                isCoach ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="btn-secondary"
                    >
                      Import CSV
                    </button>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="btn-primary"
                    >
                      Add Player
                    </button>
                  </div>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {sorted.map((player) => (
                <div key={player.id} className="flex items-center gap-2">
                  {selectMode && (
                    <input
                      type="checkbox"
                      className="accent-brand-600 w-4 h-4 flex-shrink-0"
                      checked={selected.has(player.id)}
                      onChange={() => toggleSelected(player.id)}
                    />
                  )}
                  <div
                    className={clsx('flex-1', selectMode && 'cursor-pointer')}
                    onClick={
                      selectMode ? () => toggleSelected(player.id) : undefined
                    }
                  >
                    <RosterPlayerCard
                      player={player}
                      rank={sortMode === 'rank' ? player.ladder_rank : null}
                      isCoach={isCoach}
                      teamId={teamId}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'stats' && <RosterStatsTable players={players} />}

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Player"
      >
        <AddPlayerForm
          teamId={teamId}
          onSuccess={() => {
            setShowAddModal(false);
            router.refresh();
          }}
        />
      </Modal>
      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Roster from CSV"
        maxWidth="lg"
      >
        <CsvImportForm
          teamId={teamId}
          onSuccess={() => {
            setShowImportModal(false);
            router.refresh();
          }}
        />
      </Modal>

      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowBulkConfirm(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              Remove {selected.size} player{selected.size !== 1 ? 's' : ''}?
            </h2>
            <p className="text-sm text-gray-600">
              <span className="font-medium">
                {selectedNames}
                {selected.size > 3 ? ` and ${selected.size - 3} others` : ''}
              </span>{' '}
              will be permanently removed from the roster along with their match
              history and notes.
            </p>
            {bulkError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {bulkError}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBulkConfirm(false)}
                className="btn-secondary"
                disabled={bulkDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteConfirm}
                className="btn-danger gap-2"
                disabled={bulkDeleting}
              >
                {bulkDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Removing…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Remove {selected.size} player
                    {selected.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
