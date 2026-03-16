'use client';
// components/matches/MatchesClient.tsx
// Match history with record summary and coach management.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trophy, Minus, Equal } from 'lucide-react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import {
  PageHeader,
  EmptyState,
  Modal,
  Badge,
  ConfirmDialog,
} from '@/components/ui';
import { LogMatchForm } from '@/components/matches/LogMatchForm';
import { deleteMatch } from '@/actions/matches';

export interface Match {
  id: string;
  opponent_name: string;
  match_date: string;
  is_home: boolean;
  our_score: number | null;
  opponent_score: number | null;
  result: 'win' | 'loss' | 'tie' | 'cancelled' | 'pending';
  notes: string | null;
  created_at: string;
}

const RESULT_CONFIG = {
  win: {
    label: 'W',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: Trophy,
  },
  loss: {
    label: 'L',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: Minus,
  },
  tie: {
    label: 'T',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Equal,
  },
  cancelled: {
    label: '–',
    color: 'bg-gray-100 text-gray-500 border-gray-200',
    icon: Minus,
  },
  pending: {
    label: '?',
    color: 'bg-gray-100 text-gray-400 border-gray-200',
    icon: Minus,
  },
};

export function MatchesClient({
  matches,
  teamId,
  isCoach,
}: {
  matches: Match[];
  teamId: string;
  isCoach: boolean;
}) {
  const router = useRouter();
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [deletingMatch, setDeletingMatch] = useState<Match | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derive record from results
  const wins = matches.filter((m) => m.result === 'win').length;
  const losses = matches.filter((m) => m.result === 'loss').length;
  const ties = matches.filter((m) => m.result === 'tie').length;
  const played = wins + losses + ties;

  async function handleDelete() {
    if (!deletingMatch) return;
    setDeleteLoading(true);
    await deleteMatch(deletingMatch.id, teamId);
    setDeleteLoading(false);
    setDeletingMatch(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Matches"
        description="Season match results and record"
        action={
          isCoach ? (
            <button
              onClick={() => setShowLogModal(true)}
              className="btn-primary gap-2"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Log Match</span>
            </button>
          ) : undefined
        }
      />

      {/* Season record summary */}
      {played > 0 && (
        <div className="card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">
            Season Record
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{wins}</div>
              <div className="text-xs text-gray-500 mt-0.5">Wins</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{losses}</div>
              <div className="text-xs text-gray-500 mt-0.5">Losses</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{ties}</div>
              <div className="text-xs text-gray-500 mt-0.5">Ties</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-center">
            <span className="text-sm font-semibold text-gray-800">
              {wins}–{losses}
              {ties > 0 ? `–${ties}` : ''}
            </span>
            <span className="text-xs text-gray-400 ml-2">
              {played} match{played !== 1 ? 'es' : ''} played
            </span>
          </div>
        </div>
      )}

      {/* Match list */}
      {matches.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="No matches logged yet"
          description={
            isCoach
              ? 'Log your first match result to start tracking your season record.'
              : "Your coach hasn't logged any match results yet."
          }
          action={
            isCoach ? (
              <button
                onClick={() => setShowLogModal(true)}
                className="btn-primary"
              >
                Log first match
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {matches.map((match) => {
            const config = RESULT_CONFIG[match.result];
            const dateStr = format(parseISO(match.match_date), 'MMM d, yyyy');

            return (
              <div
                key={match.id}
                className="card px-4 py-3 flex items-center gap-3 group"
              >
                {/* Result badge */}
                <div
                  className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold border flex-shrink-0',
                    config.color,
                  )}
                >
                  {config.label}
                </div>

                {/* Match info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      vs {match.opponent_name}
                    </span>
                    <Badge variant={match.is_home ? 'green' : 'gray'}>
                      {match.is_home ? 'Home' : 'Away'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500">{dateStr}</span>
                    {match.our_score !== null &&
                      match.opponent_score !== null && (
                        <span className="text-xs font-mono text-gray-600">
                          {match.our_score} – {match.opponent_score}
                        </span>
                      )}
                  </div>
                </div>

                {/* Coach actions */}
                {isCoach && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => setEditingMatch(match)}
                      className="text-xs text-gray-400 hover:text-brand-600 px-2 py-1 rounded hover:bg-brand-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingMatch(match)}
                      className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Log match modal */}
      <Modal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        title="Log Match Result"
      >
        <LogMatchForm
          teamId={teamId}
          onSuccess={() => {
            setShowLogModal(false);
            router.refresh();
          }}
        />
      </Modal>

      {/* Edit match modal */}
      <Modal
        open={!!editingMatch}
        onClose={() => setEditingMatch(null)}
        title="Edit Match"
      >
        {editingMatch && (
          <LogMatchForm
            teamId={teamId}
            existingMatch={editingMatch}
            onSuccess={() => {
              setEditingMatch(null);
              router.refresh();
            }}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deletingMatch}
        onClose={() => setDeletingMatch(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete this match?"
        description={`The match vs ${deletingMatch?.opponent_name} will be permanently removed.`}
        confirmLabel="Delete match"
        confirmVariant="danger"
      />
    </div>
  );
}
