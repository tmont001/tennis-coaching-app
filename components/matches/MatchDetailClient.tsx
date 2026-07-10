'use client';
// components/matches/MatchDetailClient.tsx
// Full match detail with inline lineup editor.

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Users,
  CheckCircle,
  XCircle,
  Minus,
  Copy,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { Badge, Modal, ConfirmDialog } from '@/components/ui';
import { LogMatchForm } from '@/components/matches/LogMatchForm';
import { LineupSlot } from '@/components/matches/LineupSlot';
import { deleteMatch } from '@/actions/matches';
import {
  copyLineupFromMatch,
  saveLineup,
  saveLineupCopyPreference,
} from '@/actions/lineup';

// ── Types ─────────────────────────────────────────────────────
export interface MatchLine {
  id?: string;
  line_type: 'singles' | 'doubles';
  position: number;
  result: 'win' | 'loss' | 'not_played' | null;
  score: string | null;
  sets_won: number | null;
  sets_lost: number | null;
  player1: {
    id: string;
    display_name: string | null;
    profiles: { full_name: string } | null;
  } | null;
  player2: {
    id: string;
    display_name: string | null;
    profiles: { full_name: string } | null;
  } | null;
}

export interface LineupPlayer {
  id: string;
  display_name: string | null;
  ladder_rank: number | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
}

interface Match {
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
  win: { label: 'W', color: 'bg-green-100 text-green-800 border-green-200' },
  loss: { label: 'L', color: 'bg-red-100 text-red-700 border-red-200' },
  tie: { label: 'T', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  cancelled: { label: '–', color: 'bg-gray-100 text-gray-500 border-gray-200' },
  pending: { label: '?', color: 'bg-gray-100 text-gray-400 border-gray-200' },
};

// ── Main component ────────────────────────────────────────────
export function MatchDetailClient({
  match,
  lines,
  team,
  players,
  teamId,
  isCoach,
  previousMatch,
  skipLineupCopyPrompt,
}: {
  match: Match;
  lines: MatchLine[];
  team: {
    id: string;
    name: string;
    singles_count: number;
    doubles_count: number;
  };
  players: LineupPlayer[];
  teamId: string;
  isCoach: boolean;
  previousMatch: { id: string; opponentName: string; matchDate: string } | null;
  skipLineupCopyPrompt: boolean;
}) {
  const router = useRouter();
  const [currentLines, setCurrentLines] = useState<MatchLine[]>(lines);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const [skipCopyPrompt, setSkipCopyPrompt] = useState(skipLineupCopyPrompt);
  const [copyLoading, setCopyLoading] = useState(false);
  const [isCopying, startCopyTransition] = useTransition();
  const [editingLineup, setEditingLineup] = useState(false);
  const [savingLineup, startSaveLineupTransition] = useTransition();

  const resultConfig = RESULT_CONFIG[match.result];
  const formattedDate = format(
    parseISO(match.match_date),
    'EEEE, MMMM d, yyyy',
  );

  // Show copy prompt if lineup is empty and previous match has lineup
  const lineupIsEmpty = currentLines.length === 0;
  useEffect(() => {
    if (isCoach && lineupIsEmpty && previousMatch && !skipCopyPrompt) {
      setShowCopyPrompt(true);
    }
  }, []);

  // Sync currentLines when server re-fetches lines (e.g. after copy lineup)
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    setCurrentLines(lines);
  }, [lines]);

  // Build the expected lineup structure from team format
  function buildEmptyLineup(): MatchLine[] {
    const result: MatchLine[] = [];
    for (let i = 1; i <= team.singles_count; i++) {
      result.push({
        line_type: 'singles',
        position: i,
        result: null,
        score: null,
        player1: null,
        player2: null,
        sets_won: null,
        sets_lost: null,
      });
    }
    for (let i = 1; i <= team.doubles_count; i++) {
      result.push({
        line_type: 'doubles',
        position: i,
        result: null,
        score: null,
        player1: null,
        player2: null,
        sets_won: null,
        sets_lost: null,
      });
    }
    return result;
  }

  // Merge DB lines with empty structure
  function getMergedLines(): MatchLine[] {
    const empty = buildEmptyLineup();
    return empty.map((slot) => {
      const found = currentLines.find(
        (l) => l.line_type === slot.line_type && l.position === slot.position,
      );
      return found ?? slot;
    });
  }

  const mergedLines = getMergedLines();
  const singlesLines = mergedLines.filter((l) => l.line_type === 'singles');
  const doublesLines = mergedLines.filter((l) => l.line_type === 'doubles');

  // Line result summary
  const recordedLines = currentLines.filter(
    (l) => l.result && l.result !== 'not_played',
  );
  const lineWins = currentLines.filter((l) => l.result === 'win').length;
  const lineLosses = currentLines.filter((l) => l.result === 'loss').length;
  const hasAnyResults = recordedLines.length > 0;

  async function handleDelete() {
    setDeleteLoading(true);
    await deleteMatch(match.id, teamId);
    setDeleteLoading(false);
    router.push('/matches');
  }

  async function handleCopyLineup(skipNext: boolean) {
    if (!previousMatch) return;
    setCopyLoading(true);
    if (skipNext) {
      await saveLineupCopyPreference(true);
      setSkipCopyPrompt(true);
    }
    const result = await copyLineupFromMatch(
      previousMatch.id,
      match.id,
      teamId,
    );
    setCopyLoading(false);
    setShowCopyPrompt(false);
    if (!result.error) {
      router.refresh();
    }
  }

  function handleSaveLineup(
    slots: Array<{
      lineType: 'singles' | 'doubles';
      position: number;
      player1Id: string | null;
      player2Id: string | null;
    }>,
  ) {
    startSaveLineupTransition(async () => {
      const result = await saveLineup(match.id, teamId, slots);
      if (!result.error) {
        setEditingLineup(false);
        router.refresh();
      }
    });
  }

  function handleLineUpdated(updated: MatchLine) {
    setCurrentLines((prev) => {
      const exists = prev.find(
        (l) =>
          l.line_type === updated.line_type && l.position === updated.position,
      );
      if (exists) {
        return prev.map((l) =>
          l.line_type === updated.line_type && l.position === updated.position
            ? updated
            : l,
        );
      }
      return [...prev, updated];
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
        Back to Matches
      </button>

      {/* Match header card */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Result badge */}
            <div
              className={clsx(
                'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold border flex-shrink-0',
                resultConfig.color,
              )}
            >
              {resultConfig.label}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                vs {match.opponent_name}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-gray-500">{formattedDate}</span>
                <Badge variant={match.is_home ? 'green' : 'gray'}>
                  {match.is_home ? 'Home' : 'Away'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Coach actions */}
          {isCoach && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setShowEditModal(true)}
                className="btn-secondary p-2"
                title="Edit match"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="btn-secondary p-2 text-red-500 hover:text-red-700 hover:border-red-300"
                title="Delete match"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Score + line summary */}
        {(match.our_score !== null || hasAnyResults) && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6 flex-wrap">
            {match.our_score !== null && match.opponent_score !== null && (
              <div className="text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                  Score
                </div>
                <div className="text-lg font-bold text-gray-900 font-mono">
                  {match.our_score} – {match.opponent_score}
                </div>
              </div>
            )}
            {hasAnyResults && (
              <div className="text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                  Lines
                </div>
                <div className="text-lg font-bold text-gray-900">
                  <span className="text-green-600">{lineWins}</span>
                  <span className="text-gray-300 mx-1">–</span>
                  <span className="text-red-500">{lineLosses}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending nudge — coach only */}
        {match.result === 'pending' && isCoach && (
          <p className="text-xs text-gray-400 mt-3">
            Result not yet recorded — edit to log the outcome.
          </p>
        )}

        {/* Notes */}
        {(match.notes || isCoach) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
              Notes
            </p>
            {match.notes ? (
              <p className="text-sm text-gray-600 leading-relaxed">
                {match.notes}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">
                No match notes — edit to add.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Copy lineup prompt */}
      {showCopyPrompt && previousMatch && isCoach && (
        <div className="card p-4 border-brand-200 bg-brand-50/40">
          <div className="flex items-start gap-3">
            <Copy size={18} className="text-brand-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Copy lineup from last match?
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                vs {previousMatch.opponentName} ·{' '}
                {format(parseISO(previousMatch.matchDate), 'MMM d')} — use the
                same players and adjust after copying.
              </p>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={skipCopyPrompt}
                  onChange={(e) => setSkipCopyPrompt(e.target.checked)}
                />
                <span className="text-xs text-gray-500">Don't ask again</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <button
              onClick={() => setShowCopyPrompt(false)}
              className="btn-secondary text-sm py-1.5"
            >
              Start fresh
            </button>
            <button
              onClick={() => handleCopyLineup(skipCopyPrompt)}
              disabled={copyLoading}
              className="btn-primary text-sm py-1.5 gap-1.5"
            >
              {copyLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Copy size={13} />
              )}
              Copy lineup
            </button>
          </div>
        </div>
      )}

      {/* Lineup section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Users size={14} className="text-brand-500" />
            Lineup
          </h2>
          {isCoach && !editingLineup && (
            <div className="flex items-center gap-3">
              {previousMatch && !showCopyPrompt && currentLines.length > 0 && (
                <button
                  onClick={() => setShowCopyPrompt(true)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Copy from previous
                </button>
              )}
              <button
                onClick={() => setEditingLineup(true)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Set Lineup
              </button>
            </div>
          )}
        </div>

        {editingLineup ? (
          <LineupSetupPanel
            mergedLines={mergedLines}
            players={players}
            onSave={handleSaveLineup}
            onCancel={() => setEditingLineup(false)}
            saving={savingLineup}
          />
        ) : (
          <>
            {/* Singles */}
            {singlesLines.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Singles
                </p>
                {singlesLines.map((line) => (
                  <LineupSlot
                    key={`singles-${line.position}`}
                    line={line}
                    matchId={match.id}
                    teamId={teamId}
                    players={players}
                    isCoach={isCoach}
                    onUpdated={handleLineUpdated}
                  />
                ))}
              </div>
            )}

            {/* Doubles */}
            {doublesLines.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">
                  Doubles
                </p>
                {doublesLines.map((line) => (
                  <LineupSlot
                    key={`doubles-${line.position}`}
                    line={line}
                    matchId={match.id}
                    teamId={teamId}
                    players={players}
                    isCoach={isCoach}
                    onUpdated={handleLineUpdated}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit match modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Match"
      >
        <LogMatchForm
          teamId={teamId}
          existingMatch={match}
          onSuccess={() => {
            setShowEditModal(false);
            router.refresh();
          }}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete this match?"
        description={`The match vs ${match.opponent_name} and its lineup will be permanently removed.`}
        confirmLabel="Delete match"
        confirmVariant="danger"
      />
    </div>
  );
}

// ── Batch lineup setup panel ──────────────────────────────────
interface LineupDraftSlot {
  lineType: 'singles' | 'doubles';
  position: number;
  player1Id: string;
  player2Id: string;
}

function LineupSetupPanel({
  mergedLines,
  players,
  onSave,
  onCancel,
  saving,
}: {
  mergedLines: MatchLine[];
  players: LineupPlayer[];
  onSave: (slots: Array<{ lineType: 'singles' | 'doubles'; position: number; player1Id: string | null; player2Id: string | null }>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<LineupDraftSlot[]>(
    mergedLines.map((l) => ({
      lineType: l.line_type,
      position: l.position,
      player1Id: l.player1?.id ?? '',
      player2Id: l.player2?.id ?? '',
    })),
  );

  const singlesSlots = draft.filter((d) => d.lineType === 'singles');
  const doublesSlots = draft.filter((d) => d.lineType === 'doubles');

  function updateSlot(
    lineType: 'singles' | 'doubles',
    position: number,
    field: 'player1Id' | 'player2Id',
    value: string,
  ) {
    setDraft((prev) =>
      prev.map((s) =>
        s.lineType === lineType && s.position === position
          ? { ...s, [field]: value }
          : s,
      ),
    );
  }

  function getLabel(p: LineupPlayer) {
    const name = p.profiles?.full_name ?? p.display_name ?? 'Player';
    return p.ladder_rank ? `#${p.ladder_rank} ${name}` : name;
  }

  function PlayerDropdown({
    label,
    value,
    lineType,
    position,
    field,
  }: {
    label: string;
    value: string;
    lineType: 'singles' | 'doubles';
    position: number;
    field: 'player1Id' | 'player2Id';
  }) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500 font-medium">{label}</label>
          {value && (
            <button
              type="button"
              onClick={() => updateSlot(lineType, position, field, '')}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <select
          value={value}
          onChange={(e) => updateSlot(lineType, position, field, e.target.value)}
          className="input text-sm"
        >
          <option value="">— Unassigned —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {getLabel(p)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-5 border-brand-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Set Lineup</span>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>

      {singlesSlots.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Singles
          </p>
          {singlesSlots.map((slot) => (
            <div key={`s-${slot.position}`} className="space-y-2">
              <p className="text-xs font-medium text-gray-600">
                Singles {slot.position}
              </p>
              <PlayerDropdown
                label="Player"
                value={slot.player1Id}
                lineType={slot.lineType}
                position={slot.position}
                field="player1Id"
              />
            </div>
          ))}
        </div>
      )}

      {doublesSlots.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Doubles
          </p>
          {doublesSlots.map((slot) => (
            <div key={`d-${slot.position}`} className="space-y-2">
              <p className="text-xs font-medium text-gray-600">
                Doubles {slot.position}
              </p>
              <PlayerDropdown
                label="Player 1"
                value={slot.player1Id}
                lineType={slot.lineType}
                position={slot.position}
                field="player1Id"
              />
              <PlayerDropdown
                label="Player 2"
                value={slot.player2Id}
                lineType={slot.lineType}
                position={slot.position}
                field="player2Id"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          disabled={saving}
          className="btn-secondary flex-1 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() =>
            onSave(
              draft.map((s) => ({
                lineType: s.lineType,
                position: s.position,
                player1Id: s.player1Id || null,
                player2Id: s.player2Id || null,
              })),
            )
          }
          disabled={saving}
          className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving…
            </>
          ) : (
            'Save Lineup'
          )}
        </button>
      </div>
    </div>
  );
}
