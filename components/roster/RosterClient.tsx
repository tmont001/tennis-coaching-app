'use client';
// components/roster/RosterClient.tsx

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  UserPlus,
  Upload,
  Trophy,
  GraduationCap,
  Search,
  BarChart2,
  Trash2,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { PageHeader, EmptyState, Modal } from '@/components/ui';
import { AddPlayerForm } from '@/components/roster/AddPlayerForm';
import { CsvImportForm } from '@/components/roster/CsvImportForm';
import { RosterPlayerCard } from '@/components/roster/RosterPlayerCard';
import { RosterStatsTable } from '@/components/roster/RosterStatsTable';
import { deletePlayer } from '@/actions/roster';

export type PlayerStatus = 'active' | 'injured' | 'inactive';

export interface RosterPlayer {
  id: string;
  display_name: string | null;
  ladder_rank: number | null;
  status: PlayerStatus;
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

type SortField = 'rank' | 'first' | 'last' | 'grade';
type SortDir = 'asc' | 'desc';
type TabMode = 'roster' | 'stats';

function getPlayerName(p: RosterPlayer): string {
  return p.profiles?.full_name ?? p.display_name ?? '';
}

function getFirstName(p: RosterPlayer): string {
  return getPlayerName(p).split(' ')[0]?.toLowerCase() ?? '';
}

function getLastName(p: RosterPlayer): string {
  const parts = getPlayerName(p).split(' ');
  return (parts.length > 1 ? parts[parts.length - 1] : parts[0])?.toLowerCase() ?? '';
}

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
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, startBulkDelete] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PlayerStatus | 'all'>('all');

  function handleSortClick(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const statusCounts = {
    all: players.length,
    active: players.filter((p) => p.status === 'active').length,
    injured: players.filter((p) => p.status === 'injured').length,
    inactive: players.filter((p) => p.status === 'inactive').length,
  };

  const afterStatusFilter =
    statusFilter === 'all'
      ? players
      : players.filter((p) => p.status === statusFilter);

  const searchLower = search.toLowerCase().trim();

  const filtered = searchLower
    ? afterStatusFilter.filter((p) => {
        const name = getPlayerName(p).toLowerCase();
        return name.includes(searchLower);
      })
    : afterStatusFilter;

  const dir = sortDir === 'asc' ? 1 : -1;

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === 'rank') {
      if (a.ladder_rank === null && b.ladder_rank === null) return 0;
      if (a.ladder_rank === null) return 1;
      if (b.ladder_rank === null) return -1;
      return (a.ladder_rank - b.ladder_rank) * dir;
    }
    if (sortField === 'grade') {
      if (a.grad_year === null && b.grad_year === null) return 0;
      if (a.grad_year === null) return 1;
      if (b.grad_year === null) return -1;
      return (a.grad_year - b.grad_year) * dir;
    }
    if (sortField === 'first') {
      return getFirstName(a).localeCompare(getFirstName(b)) * dir;
    }
    return getLastName(a).localeCompare(getLastName(b)) * dir;
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
            <div className="flex items-center gap-2 flex-wrap">
              {(['all', 'active', 'injured', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                    statusFilter === s
                      ? s === 'injured'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : s === 'inactive'
                          ? 'bg-gray-100 text-gray-700 border-gray-300'
                          : 'bg-brand-50 text-brand-700 border-brand-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                  )}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  <span className="ml-1 text-gray-400">{statusCounts[s]}</span>
                </button>
              ))}
            </div>
          )}

          {!selectMode && playerCount > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players…"
                  className="input pl-9 py-2 text-sm w-full"
                />
              </div>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
                {([
                  { field: 'rank' as SortField, label: 'Rank', icon: <Trophy size={13} /> },
                  { field: 'first' as SortField, label: 'First', icon: null },
                  { field: 'last' as SortField, label: 'Last', icon: null },
                  { field: 'grade' as SortField, label: 'Grade', icon: <GraduationCap size={13} /> },
                ]).map(({ field, label, icon }) => {
                  const active = sortField === field;
                  return (
                    <button
                      key={field}
                      onClick={() => handleSortClick(field)}
                      className={clsx(
                        'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors',
                        active
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700',
                      )}
                    >
                      {icon}
                      {label}
                      {active && (
                        sortDir === 'asc'
                          ? <ChevronUp size={12} className="text-gray-400" />
                          : <ChevronDown size={12} className="text-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {sorted.length === 0 ? (
            searchLower ? (
              <EmptyState
                icon="🔍"
                title={`No players match "${search.trim()}"`}
                description="Try a different name or clear the search."
                action={
                  <button
                    onClick={() => setSearch('')}
                    className="btn-secondary"
                  >
                    Clear search
                  </button>
                }
              />
            ) : (
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
            )
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
                      rank={sortField === 'rank' ? player.ladder_rank : null}
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
