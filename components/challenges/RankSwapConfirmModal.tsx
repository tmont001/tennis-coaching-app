'use client';
// components/challenges/RankSwapConfirmModal.tsx
// Shows a clear before/after rank preview and asks coach to confirm
// before the ladder is updated. Includes "don't show again" option.

import { useState } from 'react';
import { Loader2, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import type { SwapPreview } from '@/components/challenges/ChallengesClient';

interface RankSwapConfirmModalProps {
  open: boolean;
  preview: SwapPreview;
  loading: boolean;
  onConfirm: (skipNext: boolean) => void;
  onCancel: () => void;
}

export function RankSwapConfirmModal({
  open,
  preview,
  loading,
  onConfirm,
  onCancel,
}: RankSwapConfirmModalProps) {
  const [skipNext, setSkipNext] = useState(false);

  if (!open) return null;

  const { challenger, challenged } = preview;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Panel */}
      <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Update Ladder Rankings?
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            This result will make the following changes to the ladder.
          </p>
        </div>

        {/* Rank change preview */}
        <div className="p-5 space-y-3">
          {/* Challenger moves up */}
          <RankChangeRow
            name={challenger.name}
            oldRank={challenger.oldRank}
            newRank={challenger.newRank}
            direction="up"
          />

          {/* Challenged moves down */}
          <RankChangeRow
            name={challenged.name}
            oldRank={challenged.oldRank}
            newRank={challenged.newRank}
            direction="down"
          />
        </div>

        {/* Don't show again */}
        <div className="px-5 pb-2">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipNext}
              onChange={(e) => setSkipNext(e.target.checked)}
              className="w-4 h-4 accent-brand-600 rounded"
            />
            <span className="text-sm text-gray-500">
              Don't show this confirmation again
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(skipNext)}
            disabled={loading}
            className="btn-primary gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Updating…
              </>
            ) : (
              'Confirm and Update Ladder'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rank change row ───────────────────────────────────────────
function RankChangeRow({
  name,
  oldRank,
  newRank,
  direction,
}: {
  name: string;
  oldRank: number;
  newRank: number;
  direction: 'up' | 'down';
}) {
  const isUp = direction === 'up';

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
      {/* Direction icon */}
      <div
        className={
          isUp
            ? 'w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0'
            : 'w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0'
        }
      >
        {isUp ? (
          <TrendingUp size={15} className="text-green-600" />
        ) : (
          <TrendingDown size={15} className="text-red-500" />
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-400">
          {isUp ? 'Moves up' : 'Moves down'}
        </p>
      </div>

      {/* Rank change */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-sm font-bold text-gray-500">#{oldRank}</span>
        <ArrowRight size={13} className="text-gray-300" />
        <span
          className={
            isUp
              ? 'text-sm font-bold text-green-600'
              : 'text-sm font-bold text-red-500'
          }
        >
          #{newRank}
        </span>
      </div>
    </div>
  );
}
