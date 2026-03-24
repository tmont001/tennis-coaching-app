'use client';
// components/roster/RosterStatsTable.tsx
// Sortable stats table showing W-L and sets for all players.

import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { RosterPlayer } from '@/components/roster/RosterClient';

type SortKey =
  | 'name'
  | 'singlesWL'
  | 'singlesWinPct'
  | 'singlesSets'
  | 'doublesWL'
  | 'doublesSets'
  | 'totalWL';
type SortDir = 'asc' | 'desc';

export function RosterStatsTable({ players }: { players: RosterPlayer[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('singlesWL');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Only show players who have played at least one recorded line
  const activePlayers = players.filter(
    (p) =>
      p.singles_record_w +
        p.singles_record_l +
        p.doubles_record_w +
        p.doubles_record_l >
      0,
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function getSortValue(p: RosterPlayer, key: SortKey): number {
    const sw = p.singles_record_w,
      sl = p.singles_record_l;
    const dw = p.doubles_record_w,
      dl = p.doubles_record_l;
    const ssw = p.singles_sets_won ?? 0,
      ssl = p.singles_sets_lost ?? 0;
    const dsw = p.doubles_sets_won ?? 0,
      dsl = p.doubles_sets_lost ?? 0;
    switch (key) {
      case 'singlesWL':
        return sw - sl;
      case 'singlesWinPct':
        return sw + sl > 0 ? sw / (sw + sl) : 0;
      case 'singlesSets':
        return ssw - ssl;
      case 'doublesWL':
        return dw - dl;
      case 'doublesSets':
        return dsw - dsl;
      case 'totalWL':
        return sw + dw - (sl + dl);
      default:
        return 0;
    }
  }

  const sorted = [...activePlayers].sort((a, b) => {
    if (sortKey === 'name') {
      const na = a.profiles?.full_name ?? a.display_name ?? '';
      const nb = b.profiles?.full_name ?? b.display_name ?? '';
      return sortDir === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na);
    }
    const va = getSortValue(a, sortKey);
    const vb = getSortValue(b, sortKey);
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  if (activePlayers.length === 0) {
    return (
      <div className="card p-10 text-center text-gray-400 text-sm">
        No match results recorded yet. Log match lineups to see stats here.
      </div>
    );
  }

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <th
        onClick={() => toggleSort(k)}
        className={clsx(
          'px-3 py-2.5 text-xs font-semibold cursor-pointer select-none whitespace-nowrap transition-colors text-right',
          active
            ? 'text-brand-700 bg-brand-50'
            : 'text-gray-500 hover:text-gray-700',
        )}
      >
        <div className="flex items-center justify-end gap-1">
          {label}
          {active ? (
            sortDir === 'desc' ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronUp size={12} />
            )
          ) : (
            <ChevronDown size={12} className="opacity-20" />
          )}
        </div>
      </th>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/70">
            <tr>
              <th
                onClick={() => toggleSort('name')}
                className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-left cursor-pointer hover:text-gray-700 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Player
                  {sortKey === 'name' ? (
                    sortDir === 'desc' ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronUp size={12} />
                    )
                  ) : (
                    <ChevronDown size={12} className="opacity-20" />
                  )}
                </div>
              </th>
              <SortHeader label="S W-L" k="singlesWL" />
              <SortHeader label="S Win%" k="singlesWinPct" />
              <SortHeader label="S Sets" k="singlesSets" />
              <SortHeader label="D W-L" k="doublesWL" />
              <SortHeader label="D Sets" k="doublesSets" />
              <SortHeader label="Total W-L" k="totalWL" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((p) => {
              const name = p.profiles?.full_name ?? p.display_name ?? 'Player';
              const sw = p.singles_record_w,
                sl = p.singles_record_l;
              const dw = p.doubles_record_w,
                dl = p.doubles_record_l;
              const ssw = p.singles_sets_won ?? 0,
                ssl = p.singles_sets_lost ?? 0;
              const dsw = p.doubles_sets_won ?? 0,
                dsl = p.doubles_sets_lost ?? 0;
              const winPct =
                sw + sl > 0 ? Math.round((sw / (sw + sl)) * 100) : null;

              return (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/roster/${p.id}`}
                      className="font-medium text-gray-900 hover:text-brand-700 transition-colors"
                    >
                      {name}
                    </Link>
                    {p.ladder_rank && (
                      <span className="text-xs text-gray-400 ml-1.5">
                        #{p.ladder_rank}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={clsx(
                        'font-medium',
                        sw > sl
                          ? 'text-green-600'
                          : sw < sl
                            ? 'text-red-500'
                            : 'text-gray-600',
                      )}
                    >
                      {sw}–{sl}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {winPct !== null ? `${winPct}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500 text-xs font-mono">
                    {ssw + ssl > 0 ? `${ssw}–${ssl}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={clsx(
                        'font-medium',
                        dw > dl
                          ? 'text-green-600'
                          : dw < dl
                            ? 'text-red-500'
                            : 'text-gray-600',
                      )}
                    >
                      {dw + dl > 0 ? `${dw}–${dl}` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500 text-xs font-mono">
                    {dsw + dsl > 0 ? `${dsw}–${dsl}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={clsx(
                        'font-semibold',
                        sw + dw > sl + dl
                          ? 'text-green-600'
                          : sw + dw < sl + dl
                            ? 'text-red-500'
                            : 'text-gray-600',
                      )}
                    >
                      {sw + dw}–{sl + dl}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
