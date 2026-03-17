'use client';
// components/matches/LineupSlot.tsx
// A single lineup slot — shows assigned player(s), result,
// and score. Coaches can edit inline.

import { useState, useTransition } from 'react';
import { clsx } from 'clsx';
import { Check, X, Minus, ChevronDown } from 'lucide-react';
import { upsertMatchLine } from '@/actions/match_lines';
import type {
  MatchLine,
  LineupPlayer,
} from '@/components/matches/MatchDetailClient';

interface LineupSlotProps {
  line: MatchLine;
  matchId: string;
  teamId: string;
  players: LineupPlayer[];
  isCoach: boolean;
  onUpdated: (line: MatchLine) => void;
}

const RESULT_STYLES = {
  win: {
    label: 'W',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  loss: { label: 'L', className: 'bg-red-100 text-red-600 border-red-200' },
  not_played: {
    label: '–',
    className: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  null: { label: '?', className: 'bg-gray-50 text-gray-300 border-gray-100' },
};

export function LineupSlot({
  line,
  matchId,
  teamId,
  players,
  isCoach,
  onUpdated,
}: LineupSlotProps) {
  const [editing, setEditing] = useState(false);
  const [saving, startSave] = useTransition();

  const [selectedPlayer1, setSelectedPlayer1] = useState(
    line.player1?.id ?? '',
  );
  const [selectedPlayer2, setSelectedPlayer2] = useState(
    line.player2?.id ?? '',
  );
  const [selectedResult, setSelectedResult] = useState<string>(
    line.result ?? '',
  );
  const [score, setScore] = useState(line.score ?? '');

  const isDoubles = line.line_type === 'doubles';
  const resultKey = (line.result ?? 'null') as keyof typeof RESULT_STYLES;
  const resultStyle = RESULT_STYLES[resultKey] ?? RESULT_STYLES['null'];

  const player1Name =
    line.player1?.profiles?.full_name ?? line.player1?.display_name ?? null;
  const player2Name =
    line.player2?.profiles?.full_name ?? line.player2?.display_name ?? null;

  function getPlayerLabel(p: LineupPlayer) {
    const name = p.profiles?.full_name ?? p.display_name ?? 'Player';
    return p.ladder_rank ? `#${p.ladder_rank} ${name}` : name;
  }

  function handleSave() {
    startSave(async () => {
      const result = await upsertMatchLine({
        matchId,
        teamId,
        lineType: line.line_type,
        position: line.position,
        player1Id: selectedPlayer1 || null,
        player2Id: isDoubles ? selectedPlayer2 || null : null,
        result: (selectedResult as 'win' | 'loss' | 'not_played') || null,
        score: score || null,
      });

      if (!result.error) {
        // Find player objects for optimistic update
        const p1 = players.find((p) => p.id === selectedPlayer1) ?? null;
        const p2 = players.find((p) => p.id === selectedPlayer2) ?? null;

        onUpdated({
          ...line,
          player1: p1
            ? {
                id: p1.id,
                display_name: p1.display_name,
                profiles: p1.profiles
                  ? { full_name: p1.profiles.full_name }
                  : null,
              }
            : null,
          player2: p2
            ? {
                id: p2.id,
                display_name: p2.display_name,
                profiles: p2.profiles
                  ? { full_name: p2.profiles.full_name }
                  : null,
              }
            : null,
          result: (selectedResult as 'win' | 'loss' | 'not_played') || null,
          score: score || null,
        });
        setEditing(false);
      }
    });
  }

  function handleCancel() {
    setSelectedPlayer1(line.player1?.id ?? '');
    setSelectedPlayer2(line.player2?.id ?? '');
    setSelectedResult(line.result ?? '');
    setScore(line.score ?? '');
    setEditing(false);
  }

  return (
    <div className="card px-4 py-3">
      {!editing ? (
        // ── View mode ──────────────────────────────────────────
        <div className="flex items-center gap-3">
          {/* Position label */}
          <div className="w-6 flex-shrink-0 text-center">
            <span className="text-xs font-bold text-gray-400">
              {line.position}
            </span>
          </div>

          {/* Result badge */}
          <div
            className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border flex-shrink-0',
              resultStyle.className,
            )}
          >
            {resultStyle.label}
          </div>

          {/* Players */}
          <div className="flex-1 min-w-0">
            {player1Name ? (
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {isDoubles && player2Name
                    ? `${player1Name} / ${player2Name}`
                    : player1Name}
                </span>
                {line.score && (
                  <span className="text-xs text-gray-400 ml-2 font-mono">
                    {line.score}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-300 italic">
                {isDoubles ? 'No pair assigned' : 'No player assigned'}
              </span>
            )}
          </div>

          {/* Edit button — coach only */}
          {isCoach && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-400 hover:text-brand-600 px-2 py-1 rounded hover:bg-brand-50 transition-colors flex-shrink-0"
            >
              Edit
            </button>
          )}
        </div>
      ) : (
        // ── Edit mode ──────────────────────────────────────────
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 w-6 text-center flex-shrink-0">
              {line.position}
            </span>
            <span className="text-xs font-semibold text-gray-600 capitalize">
              {line.line_type} {line.position}
            </span>
          </div>

          {/* Player 1 */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">
              {isDoubles ? 'Player 1' : 'Player'}
            </label>
            <select
              value={selectedPlayer1}
              onChange={(e) => setSelectedPlayer1(e.target.value)}
              className="input text-sm"
            >
              <option value="">— Unassigned —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {getPlayerLabel(p)}
                </option>
              ))}
            </select>
          </div>

          {/* Player 2 (doubles only) */}
          {isDoubles && (
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">
                Player 2
              </label>
              <select
                value={selectedPlayer2}
                onChange={(e) => setSelectedPlayer2(e.target.value)}
                className="input text-sm"
              >
                <option value="">— Unassigned —</option>
                {players
                  .filter((p) => p.id !== selectedPlayer1)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {getPlayerLabel(p)}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Result + Score */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">
                Result
              </label>
              <select
                value={selectedResult}
                onChange={(e) => setSelectedResult(e.target.value)}
                className="input text-sm"
              >
                <option value="">Pending</option>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="not_played">Not played</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">Score</label>
              <input
                type="text"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="6-3, 7-5"
                className="input text-sm"
              />
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={handleCancel}
              className="btn-secondary text-sm py-1.5"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary text-sm py-1.5 gap-1.5"
              disabled={saving}
            >
              {saving ? (
                <span className="animate-pulse">Saving…</span>
              ) : (
                <>
                  <Check size={13} />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
