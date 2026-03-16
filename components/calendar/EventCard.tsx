'use client';
// components/calendar/EventCard.tsx
// A single event row in the calendar list.

import Link from 'next/link';
import { clsx } from 'clsx';
import { MapPin, Swords } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { CalendarEvent } from './CalendarClient';
import { parseISO, format } from 'date-fns';

const EVENT_TYPE_CONFIG = {
  practice: { label: 'Practice', variant: 'green' as const, emoji: '🎾' },
  match: { label: 'Match', variant: 'blue' as const, emoji: '🏆' },
  meeting: { label: 'Meeting', variant: 'gray' as const, emoji: '📋' },
  other: { label: 'Event', variant: 'gray' as const, emoji: '📌' },
};

const STATUS_CONFIG = {
  scheduled: null,
  cancelled: { label: 'Cancelled', variant: 'red' as const },
  postponed: { label: 'Postponed', variant: 'yellow' as const },
};

export function EventCard({ event }: { event: CalendarEvent }) {
  const typeConfig = EVENT_TYPE_CONFIG[event.event_type];
  const statusConfig = STATUS_CONFIG[event.status];

  const startTime = format(parseISO(event.starts_at), 'h:mm a');
  const endTime = event.ends_at
    ? format(parseISO(event.ends_at), 'h:mm a')
    : null;
  const timeStr = endTime ? `${startTime} – ${endTime}` : startTime;

  const isCancelled = event.status === 'cancelled';

  return (
    <Link href={`/calendar/${event.id}`}>
      <div
        className={clsx(
          'card px-4 py-3 flex items-center gap-3 hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer group',
          isCancelled && 'opacity-60',
        )}
      >
        {/* Event type icon */}
        <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 text-lg group-hover:bg-brand-50 transition-colors">
          {typeConfig.emoji}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={clsx(
                'text-sm font-medium truncate',
                isCancelled
                  ? 'line-through text-gray-400'
                  : 'text-gray-900 group-hover:text-brand-700',
              )}
            >
              {event.title}
            </span>
            <Badge variant={typeConfig.variant}>{typeConfig.label}</Badge>
            {statusConfig && (
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            )}
          </div>

          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {/* Time */}
            <span className="text-xs text-gray-500">{timeStr}</span>

            {/* Location */}
            {event.location && (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <MapPin size={10} />
                {event.location}
              </span>
            )}

            {/* Opponent for matches */}
            {event.event_type === 'match' && event.opponent_name && (
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <Swords size={10} />
                vs {event.opponent_name}{' '}
                <span className="text-gray-400">
                  ({event.is_home ? 'Home' : 'Away'})
                </span>
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
