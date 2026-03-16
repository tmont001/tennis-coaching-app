'use client';
// components/roster/RosterClient.tsx
// Interactive roster with sort toggle, add player modal, CSV import.

import { useState, useTransition } from 'react';
import { clsx } from 'clsx';
import { UserPlus, Upload, Trophy, ArrowUpDown } from 'lucide-react';
import { PageHeader, EmptyState, Modal, Badge, Spinner } from '@/components/ui';
import { AddPlayerForm } from '@/components/roster/AddPlayerForm';
import { CsvImportForm } from '@/components/roster/CsvImportForm';
import { RosterPlayerCard } from '@/components/roster/RosterPlayerCard';

export interface RosterPlayer {
  id: string;
  display_name: string | null;
  ladder_rank: number | null;
  singles_record_w: number;
  singles_record_l: number;
  doubles_record_w: number;
  doubles_record_l: number;
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

interface RosterClientProps {
  players: RosterPlayer[];
  teamId: string;
  isCoach: boolean;
}

export function RosterClient({ players, teamId, isCoach }: RosterClientProps) {
  const [sortMode, setSortMode] = useState<SortMode>('rank');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Sort players based on current mode
  const sorted = [...players].sort((a, b) => {
    if (sortMode === 'rank') {
      // Ranked players first, unranked at bottom
      if (a.ladder_rank === null && b.ladder_rank === null) return 0;
      if (a.ladder_rank === null) return 1;
      if (b.ladder_rank === null) return -1;
      return a.ladder_rank - b.ladder_rank;
    }
    // Alphabetical by display name
    const nameA = (a.profiles?.full_name ?? a.display_name ?? '').toLowerCase();
    const nameB = (b.profiles?.full_name ?? b.display_name ?? '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const playerCount = players.length;
  const claimedCount = players.filter((p) => p.profile_id !== null).length;

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
            </div>
          ) : undefined
        }
      />

      {/* Sort toggle */}
      {playerCount > 0 && (
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

      {/* Player list */}
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
          {sorted.map((player, index) => (
            <RosterPlayerCard
              key={player.id}
              player={player}
              rank={sortMode === 'rank' ? player.ladder_rank : null}
              isCoach={isCoach}
              teamId={teamId}
            />
          ))}
        </div>
      )}

      {/* Add player modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Player"
      >
        <AddPlayerForm
          teamId={teamId}
          onSuccess={() => setShowAddModal(false)}
        />
      </Modal>

      {/* CSV import modal */}
      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Roster from CSV"
        maxWidth="lg"
      >
        <CsvImportForm
          teamId={teamId}
          onSuccess={() => setShowImportModal(false)}
        />
      </Modal>
    </div>
  );
}
