'use client';
// components/roster/RosterPlayerCard.tsx
// A single player row in the roster list.

import Link from 'next/link';
import { clsx } from 'clsx';
import { UserCheck, Mail } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { RosterPlayer } from './RosterClient';

interface RosterPlayerCardProps {
  player: RosterPlayer;
  rank: number | null;
  isCoach: boolean;
  teamId: string;
}

export function RosterPlayerCard({
  player,
  rank,
  isCoach,
  teamId,
}: RosterPlayerCardProps) {
  const name =
    player.profiles?.full_name ?? player.display_name ?? 'Unnamed Player';
  const avatarUrl = player.profiles?.avatar_url ?? null;
  const isClaimed = player.profile_id !== null;

  const singlesRecord = `${player.singles_record_w}-${player.singles_record_l}`;
  const doublesRecord = `${player.doubles_record_w}-${player.doubles_record_l}`;
  const hasSingles = player.singles_record_w > 0 || player.singles_record_l > 0;
  const hasDoubles = player.doubles_record_w > 0 || player.doubles_record_l > 0;
  const hasSinglesSets =
    player.singles_sets_won > 0 || player.singles_sets_lost > 0;
  const hasDoublesSets =
    player.doubles_sets_won > 0 || player.doubles_sets_lost > 0;

  // Initials for avatar fallback
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Link href={`/roster/${player.id}`}>
      <div className="card px-4 py-3 flex items-center gap-3 hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer group">
        {/* Rank badge */}
        <div className="w-8 flex-shrink-0 text-center">
          {rank !== null ? (
            <span className="text-sm font-bold text-brand-600">#{rank}</span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </div>

        {/* Avatar */}
        <div className="flex-shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex items-center justify-center">
              {initials}
            </div>
          )}
        </div>

        {/* Name + details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 group-hover:text-brand-700 transition-colors truncate">
              {name}
            </span>
            {!isClaimed && isCoach && <Badge variant="yellow">Unclaimed</Badge>}
            {isClaimed && (
              <UserCheck size={13} className="text-green-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {player.grad_year && (
              <span className="text-xs text-gray-400">
                '{String(player.grad_year).slice(-2)}
              </span>
            )}
            {hasSingles && (
              <span className="text-xs text-gray-500">
                S: {singlesRecord}
                {hasSinglesSets && (
                  <span className="text-gray-400 ml-1">
                    ({player.singles_sets_won}–{player.singles_sets_lost} sets)
                  </span>
                )}
              </span>
            )}
            {hasDoubles && (
              <span className="text-xs text-gray-500">
                D: {doublesRecord}
                {hasDoublesSets && (
                  <span className="text-gray-400 ml-1">
                    ({player.doubles_sets_won}–{player.doubles_sets_lost} sets)
                  </span>
                )}
              </span>
            )}
            {player.invited_email && isCoach && !isClaimed && (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <Mail size={10} />
                {player.invited_email}
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0">
          →
        </div>
      </div>
    </Link>
  );
}
