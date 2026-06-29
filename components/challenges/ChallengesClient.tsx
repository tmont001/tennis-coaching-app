'use client';
// components/challenges/ChallengesClient.tsx
// Challenge ladder — ranked player list, challenge issuance,
// result recording, and rank swap confirmation.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Swords,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Trophy,
  Loader2,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
  PageHeader,
  EmptyState,
  Badge,
  Modal,
  ConfirmDialog,
} from '@/components/ui';
import { IssueChallengeForm } from '@/components/challenges/IssueChallengeForm';
import { RecordResultForm } from '@/components/challenges/RecordResultForm';
import { RankSwapConfirmModal } from '@/components/challenges/RankSwapConfirmModal';
import {
  updateChallengeStatus,
  applyRankSwap,
  saveLadderConfirmPreference,
} from '@/actions/challenges';

// ── Types ─────────────────────────────────────────────────────
export interface LadderPlayer {
  id: string;
  display_name: string | null;
  ladder_rank: number | null;
  singles_record_w?: number;
  singles_record_l?: number;
  profile_id: string | null;
  profiles: { id: string; full_name: string; avatar_url: string | null } | null;
}

export interface ChallengeRow {
  id: string;
  status: 'pending' | 'accepted' | 'completed' | 'declined' | 'expired';
  scheduled_date: string | null;
  score: string | null;
  created_at: string;
  updated_at: string;
  winner_id: string | null;
  challenger: {
    id: string;
    ladder_rank: number | null;
    display_name: string | null;
    profiles: { full_name: string; avatar_url: string | null } | null;
  };
  challenged: {
    id: string;
    ladder_rank: number | null;
    display_name: string | null;
    profiles: { full_name: string; avatar_url: string | null } | null;
  };
}

export interface SwapPreview {
  challengeId: string;
  challenger: { id: string; name: string; oldRank: number; newRank: number };
  challenged: { id: string; name: string; oldRank: number; newRank: number };
}

type TabMode = 'ladder' | 'challenges';

// ── Main component ────────────────────────────────────────────
export function ChallengesClient({
  rankedPlayers,
  unrankedPlayers,
  challenges,
  teamId,
  isCoach,
  myPlayerId,
  myLadderRank,
  skipLadderConfirm,
}: {
  rankedPlayers: LadderPlayer[];
  unrankedPlayers: LadderPlayer[];
  challenges: ChallengeRow[];
  teamId: string;
  isCoach: boolean;
  myPlayerId: string | null;
  myLadderRank: number | null;
  skipLadderConfirm: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabMode>('ladder');
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengingPlayer, setChallengingPlayer] =
    useState<LadderPlayer | null>(null);
  const [recordingChallenge, setRecordingChallenge] =
    useState<ChallengeRow | null>(null);
  const [swapPreview, setSwapPreview] = useState<SwapPreview | null>(null);
  const [skipConfirm, setSkipConfirm] = useState(skipLadderConfirm);
  const [applyingSwap, setApplyingSwap] = useState(false);

  const activeChallenges = challenges.filter((c) =>
    ['pending', 'accepted'].includes(c.status),
  );
  const completedChallenges = challenges.filter((c) =>
    ['completed', 'declined', 'expired'].includes(c.status),
  );

  // Can this user issue a challenge to a given player?
  function canChallenge(targetPlayer: LadderPlayer): boolean {
    if (isCoach) return true;
    if (
      !myPlayerId ||
      myLadderRank === null ||
      targetPlayer.ladder_rank === null
    )
      return false;
    // Must be challenging someone ranked above (lower rank number)
    if (targetPlayer.ladder_rank >= myLadderRank) return false;
    // Max 2 spots
    return myLadderRank - targetPlayer.ladder_rank <= 2;
  }

  async function handleResultRecorded(preview: SwapPreview | null) {
    setRecordingChallenge(null);
    if (!preview) {
      // No swap needed — just refresh
      router.refresh();
      return;
    }
    // Challenger won — show confirmation or auto-apply if skipping
    if (skipConfirm) {
      await handleConfirmSwap(preview, false);
    } else {
      setSwapPreview(preview);
    }
  }

  async function handleConfirmSwap(
    preview: SwapPreview,
    shouldSavePreference: boolean,
  ) {
    setApplyingSwap(true);
    if (shouldSavePreference) {
      await saveLadderConfirmPreference(true);
      setSkipConfirm(true);
    }
    await applyRankSwap(
      preview.challengeId,
      teamId,
      preview.challenger.id,
      preview.challenged.id,
    );
    setApplyingSwap(false);
    setSwapPreview(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Challenge Ladder"
        description={
          rankedPlayers.length > 0
            ? `${rankedPlayers.length} ranked player${rankedPlayers.length !== 1 ? 's' : ''}`
            : 'No ranked players yet'
        }
        action={
          isCoach || (myPlayerId && myLadderRank !== null) ? (
            <button
              onClick={() => setShowChallengeModal(true)}
              className="btn-primary gap-2"
            >
              <Swords size={15} />
              <span className="hidden sm:inline">Issue Challenge</span>
            </button>
          ) : undefined
        }
      />

      {/* Tab toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('ladder')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'ladder'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <Trophy size={13} />
          Ladder
        </button>
        <button
          onClick={() => setTab('challenges')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'challenges'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <Swords size={13} />
          Challenges
          {activeChallenges.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-700">
              {activeChallenges.length}
            </span>
          )}
        </button>
      </div>

      {/* Ladder tab */}
      {tab === 'ladder' && (
        <div className="space-y-4">
          {rankedPlayers.length === 0 && unrankedPlayers.length === 0 ? (
            <EmptyState
              icon="🏆"
              title="No players on the ladder yet"
              description="Assign ladder ranks to players from their profile pages to get started."
            />
          ) : (
            <>
              {/* Ranked players */}
              {rankedPlayers.length > 0 && (
                <div className="space-y-2">
                  {rankedPlayers.map((player) => {
                    const name =
                      player.profiles?.full_name ??
                      player.display_name ??
                      'Player';
                    const isMe = player.id === myPlayerId;
                    const challengeable = canChallenge(player);

                    return (
                      <div
                        key={player.id}
                        className={clsx(
                          'card px-4 py-3 flex items-center gap-3',
                          isMe && 'border-brand-300 bg-brand-50/30',
                        )}
                      >
                        {/* Rank */}
                        <div className="w-8 text-center flex-shrink-0">
                          <span
                            className={clsx(
                              'text-sm font-bold',
                              player.ladder_rank === 1
                                ? 'text-yellow-500'
                                : 'text-brand-600',
                            )}
                          >
                            #{player.ladder_rank}
                          </span>
                        </div>

                        {/* Avatar */}
                        <PlayerAvatar
                          name={name}
                          avatarUrl={player.profiles?.avatar_url ?? null}
                        />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {name}
                            </span>
                            {isMe && <Badge variant="green">You</Badge>}
                          </div>
                          {player.singles_record_w !== undefined && (
                            <span className="text-xs text-gray-400">
                              {player.singles_record_w}–
                              {player.singles_record_l} singles
                            </span>
                          )}
                        </div>

                        {/* Challenge button */}
                        {challengeable && !isMe && (
                          <button
                            onClick={() => setChallengingPlayer(player)}
                            className="btn-secondary text-xs py-1.5 gap-1.5 flex-shrink-0"
                          >
                            <Swords size={12} />
                            Challenge
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Unranked players */}
              {unrankedPlayers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Unranked
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  {unrankedPlayers.map((player) => {
                    const name =
                      player.profiles?.full_name ??
                      player.display_name ??
                      'Player';
                    return (
                      <div
                        key={player.id}
                        className="card px-4 py-3 flex items-center gap-3 opacity-60"
                      >
                        <div className="w-8 text-center flex-shrink-0">
                          <span className="text-xs text-gray-300">—</span>
                        </div>
                        <PlayerAvatar
                          name={name}
                          avatarUrl={player.profiles?.avatar_url ?? null}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-500 truncate">
                            {name}
                          </span>
                        </div>
                        <Badge variant="gray">Unranked</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Challenges tab */}
      {tab === 'challenges' && (
        <div className="space-y-4">
          {/* Active challenges */}
          {activeChallenges.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Active
              </p>
              {activeChallenges.map((c) => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  isCoach={isCoach}
                  myPlayerId={myPlayerId}
                  teamId={teamId}
                  onRecordResult={() => setRecordingChallenge(c)}
                  onStatusChange={() => router.refresh()}
                />
              ))}
            </div>
          )}

          {/* Completed challenges */}
          {completedChallenges.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                History
              </p>
              {completedChallenges.map((c) => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  isCoach={isCoach}
                  myPlayerId={myPlayerId}
                  teamId={teamId}
                  onRecordResult={() => {}}
                  onStatusChange={() => router.refresh()}
                />
              ))}
            </div>
          )}

          {challenges.length === 0 && (
            <EmptyState
              icon="⚔️"
              title="No challenges yet"
              description="Challenges issued between players will appear here."
            />
          )}
        </div>
      )}

      {/* Issue challenge modal */}
      <Modal
        open={showChallengeModal || !!challengingPlayer}
        onClose={() => {
          setShowChallengeModal(false);
          setChallengingPlayer(null);
        }}
        title="Issue Challenge"
      >
        <IssueChallengeForm
          teamId={teamId}
          rankedPlayers={rankedPlayers}
          myPlayerId={myPlayerId}
          myLadderRank={myLadderRank}
          isCoach={isCoach}
          preselectedChallengedId={challengingPlayer?.id ?? null}
          onSuccess={() => {
            setShowChallengeModal(false);
            setChallengingPlayer(null);
            router.refresh();
          }}
        />
      </Modal>

      {/* Record result modal */}
      <Modal
        open={!!recordingChallenge}
        onClose={() => setRecordingChallenge(null)}
        title="Record Challenge Result"
      >
        {recordingChallenge && (
          <RecordResultForm
            challenge={recordingChallenge}
            teamId={teamId}
            onResult={handleResultRecorded}
          />
        )}
      </Modal>

      {/* Rank swap confirmation modal */}
      {swapPreview && (
        <RankSwapConfirmModal
          open={!!swapPreview}
          preview={swapPreview}
          loading={applyingSwap}
          onConfirm={(skipNext) => handleConfirmSwap(swapPreview, skipNext)}
          onCancel={() => {
            setSwapPreview(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ── Challenge card ────────────────────────────────────────────
function ChallengeCard({
  challenge,
  isCoach,
  myPlayerId,
  teamId,
  onRecordResult,
  onStatusChange,
}: {
  challenge: ChallengeRow;
  isCoach: boolean;
  myPlayerId: string | null;
  teamId: string;
  onRecordResult: () => void;
  onStatusChange: () => void;
}) {
  const [updating, startUpdate] = useTransition();

  const challengerName =
    challenge.challenger.profiles?.full_name ??
    challenge.challenger.display_name ??
    'Challenger';
  const challengedName =
    challenge.challenged.profiles?.full_name ??
    challenge.challenged.display_name ??
    'Challenged';

  const isCompleted = challenge.status === 'completed';
  const isActive = ['pending', 'accepted'].includes(challenge.status);

  const winnerIsChallenger = challenge.winner_id === challenge.challenger.id;

  const STATUS_BADGE: Record<
    string,
    { label: string; variant: 'green' | 'blue' | 'gray' | 'red' | 'yellow' }
  > = {
    pending: { label: 'Pending', variant: 'yellow' },
    accepted: { label: 'Accepted', variant: 'blue' },
    completed: { label: 'Completed', variant: 'green' },
    declined: { label: 'Declined', variant: 'red' },
    expired: { label: 'Expired', variant: 'gray' },
  };

  const statusBadge = STATUS_BADGE[challenge.status];

  return (
    <div className="card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Players */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {challengerName}
            </span>
            {challenge.challenger.ladder_rank && (
              <span className="text-xs text-gray-400">
                #{challenge.challenger.ladder_rank}
              </span>
            )}
            <Swords size={12} className="text-gray-300" />
            <span className="text-sm font-semibold text-gray-900">
              {challengedName}
            </span>
            {challenge.challenged.ladder_rank && (
              <span className="text-xs text-gray-400">
                #{challenge.challenged.ladder_rank}
              </span>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            {challenge.scheduled_date && (
              <span className="text-xs text-gray-400">
                {format(parseISO(challenge.scheduled_date), 'MMM d')}
              </span>
            )}
            {challenge.score && (
              <span className="text-xs font-mono text-gray-600">
                {challenge.score}
              </span>
            )}
            {isCompleted && challenge.winner_id && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <Trophy size={11} />
                {winnerIsChallenger ? challengerName : challengedName} won
              </span>
            )}
            <span className="text-xs text-gray-400">
              Issued {formatDistanceToNow(parseISO(challenge.created_at), { addSuffix: true })}
            </span>
            {isCompleted && challenge.updated_at !== challenge.created_at && (
              <span className="text-xs text-gray-400">
                Completed {formatDistanceToNow(parseISO(challenge.updated_at), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        {/* Coach actions */}
        {isCoach && isActive && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onRecordResult}
              className="btn-primary text-xs py-1.5 gap-1"
            >
              Record result
            </button>
            <button
              onClick={() =>
                startUpdate(async () => {
                  await updateChallengeStatus(challenge.id, teamId, 'expired');
                  onStatusChange();
                })
              }
              disabled={updating}
              className="btn-secondary text-xs py-1.5 text-gray-400"
              title="Mark as expired"
            >
              {updating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                'Expire'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small avatar helper ───────────────────────────────────────
function PlayerAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
      {initials}
    </div>
  );
}
