"use client";
// components/matches/LineupSlot.tsx
// A single lineup slot — shows assigned player(s), result,
// and structured set-by-set score entry.

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { Check, Plus, Trash2 } from "lucide-react";
import { upsertMatchLine } from "@/actions/lineup";
import type { MatchLine, LineupPlayer } from "@/components/matches/MatchDetailClient";

interface LineupSlotProps {
  line: MatchLine;
  matchId: string;
  teamId: string;
  players: LineupPlayer[];
  isCoach: boolean;
  onUpdated: (line: MatchLine) => void;
}

// A single set score: our games vs their games
interface SetScore {
  ours: string;
  theirs: string;
}

const RESULT_STYLES = {
  win:        { label: "W", className: "bg-green-100 text-green-700 border-green-200" },
  loss:       { label: "L", className: "bg-red-100 text-red-600 border-red-200" },
  not_played: { label: "–", className: "bg-gray-100 text-gray-400 border-gray-200" },
  null:       { label: "?", className: "bg-gray-50 text-gray-300 border-gray-100" },
};

// ── Parse a score string back into SetScore array ─────────────
// e.g. "6-3, 4-6, 10-7" → [{ours:"6",theirs:"3"}, ...]
function parseScoreString(score: string | null): SetScore[] {
  if (!score) return [{ ours: "", theirs: "" }];
  return score.split(",").map((s) => {
    const parts = s.trim().split("-");
    return { ours: parts[0] ?? "", theirs: parts[1] ?? "" };
  });
}

// ── Build score string from SetScore array ────────────────────
// [{ours:"6",theirs:"3"}, ...] → "6-3, 4-6, 10-7"
function buildScoreString(sets: SetScore[]): string {
  return sets
    .filter((s) => s.ours !== "" || s.theirs !== "")
    .map((s) => `${s.ours || "0"}-${s.theirs || "0"}`)
    .join(", ");
}

// ── Derive sets won/lost from set scores ──────────────────────
function deriveSets(sets: SetScore[]): { setsWon: number; setsLost: number } {
  let setsWon = 0;
  let setsLost = 0;
  for (const s of sets) {
    const ours = parseInt(s.ours);
    const theirs = parseInt(s.theirs);
    if (isNaN(ours) || isNaN(theirs)) continue;
    if (ours > theirs) setsWon++;
    else if (theirs > ours) setsLost++;
  }
  return { setsWon, setsLost };
}

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

  const [selectedResult, setSelectedResult] = useState<string>(line.result ?? "");
  const [sets, setSets] = useState<SetScore[]>(parseScoreString(line.score));

  const isDoubles = line.line_type === "doubles";
  const resultKey = (line.result ?? "null") as keyof typeof RESULT_STYLES;
  const resultStyle = RESULT_STYLES[resultKey] ?? RESULT_STYLES["null"];

  const player1Name = line.player1?.profiles?.full_name ?? line.player1?.display_name ?? null;
  const player2Name = line.player2?.profiles?.full_name ?? line.player2?.display_name ?? null;

  // Sets summary for display
  const setsWonDisplay = line.sets_won ?? null;
  const setsLostDisplay = line.sets_lost ?? null;

  function addSet() {
    setSets((prev) => [...prev, { ours: "", theirs: "" }]);
  }

  function removeSet(idx: number) {
    setSets((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSet(idx: number, field: "ours" | "theirs", value: string) {
    setSets((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  }

  function handleSave() {
    startSave(async () => {
      const scoreString = buildScoreString(sets);
      const { setsWon, setsLost } = deriveSets(sets);

      const result = await upsertMatchLine({
        matchId,
        teamId,
        lineType: line.line_type,
        position: line.position,
        player1Id: line.player1?.id ?? null,
        player2Id: line.player2?.id ?? null,
        result: (selectedResult as "win" | "loss" | "not_played") || null,
        score: scoreString || null,
        setsWon: scoreString ? setsWon : null,
        setsLost: scoreString ? setsLost : null,
      });

      if (!result.error) {
        onUpdated({
          ...line,
          result: (selectedResult as "win" | "loss" | "not_played") || null,
          score: scoreString || null,
          sets_won: scoreString ? setsWon : null,
          sets_lost: scoreString ? setsLost : null,
        });
        setEditing(false);
      }
    });
  }

  function handleCancel() {
    setSelectedResult(line.result ?? "");
    setSets(parseScoreString(line.score));
    setEditing(false);
  }

  return (
    <div className="card px-4 py-3">
      {!editing ? (
        // ── View mode ────────────────────────────────────────────
        <div className="flex items-center gap-3">
          {/* Position */}
          <div className="w-6 flex-shrink-0 text-center">
            <span className="text-xs font-bold text-gray-400">{line.position}</span>
          </div>

          {/* Result badge */}
          <div
            className={clsx(
              "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border flex-shrink-0",
              resultStyle.className
            )}
          >
            {resultStyle.label}
          </div>

          {/* Players + score */}
          <div className="flex-1 min-w-0">
            {player1Name ? (
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {isDoubles && player2Name
                    ? `${player1Name} / ${player2Name}`
                    : player1Name}
                </span>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {line.score && (
                    <span className="text-xs text-gray-400 font-mono">
                      {line.score}
                    </span>
                  )}
                  {setsWonDisplay !== null && setsLostDisplay !== null && (
                    <span className="text-xs text-gray-400">
                      ({setsWonDisplay}–{setsLostDisplay} sets)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-sm text-gray-300 italic">
                {isDoubles ? "No pair assigned" : "No player assigned"}
              </span>
            )}
          </div>

          {/* Edit — coach only */}
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
        // ── Edit mode ────────────────────────────────────────────
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 capitalize">
              {line.line_type} {line.position}
            </span>
            <button
              onClick={handleCancel}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          {/* Result */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">Result</label>
            <select
              value={selectedResult}
              onChange={(e) => setSelectedResult(e.target.value)}
              className="input text-sm"
            >
              <option value="">— Not set —</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="not_played">Not Played</option>
            </select>
          </div>

          {/* Set scores */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">Score</label>
            {sets.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Us"
                  value={s.ours}
                  onChange={(e) => updateSet(idx, "ours", e.target.value)}
                  className="input text-sm w-14 text-center"
                />
                <span className="text-gray-400 text-xs">–</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Them"
                  value={s.theirs}
                  onChange={(e) => updateSet(idx, "theirs", e.target.value)}
                  className="input text-sm w-14 text-center"
                />
                {sets.length > 1 && (
                  <button
                    onClick={() => removeSet(idx)}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {sets.length < 5 && (
              <button
                onClick={addSet}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 transition-colors mt-1"
              >
                <Plus size={12} /> Add set
              </button>
            )}
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-1 text-sm"
          >
            <Check size={14} />
            {saving ? "Saving…" : "Save Lineup"}
          </button>
        </div>
      )}
    </div>
  );
}
