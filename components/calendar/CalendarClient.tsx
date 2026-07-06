'use client';
// components/calendar/CalendarClient.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Plus, CalendarDays, History } from 'lucide-react';
import { PageHeader, EmptyState, Modal } from '@/components/ui';
import { EventCard } from '@/components/calendar/EventCard';
import { CreateEventForm } from '@/components/calendar/CreateEventForm';
import { isBefore, parseISO, startOfDay } from 'date-fns';

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: 'practice' | 'match' | 'meeting' | 'other';
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  opponent_name: string | null;
  is_home: boolean;
  status: 'scheduled' | 'cancelled' | 'postponed';
  description: string | null;
  created_by: string;
  profiles: { full_name: string } | null;
}

type TabMode = 'upcoming' | 'past';
type FilterType = 'all' | 'practice' | 'match' | 'meeting' | 'other';

const FILTER_CONFIG: {
  value: FilterType;
  label: string;
  plural: string;
}[] = [
  { value: 'all', label: 'All', plural: 'events' },
  { value: 'practice', label: 'Practices', plural: 'practices' },
  { value: 'match', label: 'Matches', plural: 'matches' },
  { value: 'meeting', label: 'Meetings', plural: 'meetings' },
  { value: 'other', label: 'Other', plural: 'other events' },
];

interface CalendarClientProps {
  events: CalendarEvent[];
  teamId: string;
  isCoach: boolean;
}

export function CalendarClient({
  events,
  teamId,
  isCoach,
}: CalendarClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabMode>('upcoming');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const now = startOfDay(new Date());

  const upcoming = events
    .filter((e) => !isBefore(parseISO(e.starts_at), now))
    .sort(
      (a, b) =>
        parseISO(a.starts_at).getTime() - parseISO(b.starts_at).getTime(),
    );

  const past = events
    .filter((e) => isBefore(parseISO(e.starts_at), now))
    .sort(
      (a, b) =>
        parseISO(b.starts_at).getTime() - parseISO(a.starts_at).getTime(),
    );

  const tabEvents = tab === 'upcoming' ? upcoming : past;
  const activeUpcomingCount = upcoming.filter((e) => e.status !== 'cancelled').length;

  // Counts per type within the current tab
  const typeCounts: Record<FilterType, number> = {
    all: tabEvents.length,
    practice: tabEvents.filter((e) => e.event_type === 'practice').length,
    match: tabEvents.filter((e) => e.event_type === 'match').length,
    meeting: tabEvents.filter((e) => e.event_type === 'meeting').length,
    other: tabEvents.filter((e) => e.event_type === 'other').length,
  };

  const displayed =
    filterType === 'all'
      ? tabEvents
      : tabEvents.filter((e) => e.event_type === filterType);

  // Group events by date label
  const grouped = groupEventsByDate(displayed);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Calendar"
        description={`${activeUpcomingCount} upcoming event${activeUpcomingCount !== 1 ? 's' : ''}`}
        action={
          isCoach ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary gap-2"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Event</span>
            </button>
          ) : undefined
        }
      />

      {/* Upcoming / Past tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('upcoming')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'upcoming'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <CalendarDays size={13} />
          Upcoming
          {upcoming.length > 0 && (
            <span
              className={clsx(
                'ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold',
                tab === 'upcoming'
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-gray-200 text-gray-500',
              )}
            >
              {upcoming.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('past')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'past'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <History size={13} />
          Past
        </button>
      </div>

      {/* Event type filter pills */}
      {tabEvents.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_CONFIG.map(({ value, label }) => {
            const count = typeCounts[value];
            if (value !== 'all' && count === 0) return null;
            return (
              <button
                key={value}
                onClick={() => setFilterType(value)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                  filterType === value
                    ? 'bg-brand-50 text-brand-700 border-brand-200'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                )}
              >
                {label}
                {value !== 'all' && (
                  <span className="ml-1 text-gray-400">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Event list */}
      {displayed.length === 0 ? (
        filterType !== 'all' ? (
          <EmptyState
            icon="📅"
            title={`No ${FILTER_CONFIG.find((f) => f.value === filterType)?.plural} ${tab === 'upcoming' ? 'scheduled' : 'recorded'}`}
            description={undefined}
            action={
              <button
                onClick={() => setFilterType('all')}
                className="btn-secondary"
              >
                Clear filter
              </button>
            }
          />
        ) : (
          <EmptyState
            icon="📅"
            title={tab === 'upcoming' ? 'No upcoming events' : 'No past events'}
            description={
              tab === 'upcoming' && isCoach
                ? 'Schedule a practice, match, or meeting to get started.'
                : undefined
            }
            action={
              tab === 'upcoming' && isCoach ? (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary"
                >
                  Create Event
                </button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, events: groupEvents }) => (
            <div key={label}>
              {/* Date group header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {label}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-2">
                {groupEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create event modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Event"
        maxWidth="lg"
      >
        <CreateEventForm
          teamId={teamId}
          onSuccess={(eventId?: string) => {
            setShowCreateModal(false);
            if (eventId) {
              router.push(`/calendar/${eventId}`);
            } else {
              router.refresh();
            }
          }}
        />
      </Modal>
    </div>
  );
}

// ── Group events by human-readable date label ─────────────────
function groupEventsByDate(
  events: CalendarEvent[],
): { label: string; events: CalendarEvent[] }[] {
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const date = parseISO(event.starts_at);
    const label = formatGroupLabel(date);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(event);
  }

  return Array.from(groups.entries()).map(([label, events]) => ({
    label,
    events,
  }));
}

function formatGroupLabel(date: Date): string {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const eventDay = startOfDay(date);

  if (eventDay.getTime() === today.getTime()) return 'Today';
  if (eventDay.getTime() === tomorrow.getTime()) return 'Tomorrow';

  // Within next 7 days — show day name
  const daysAway = Math.round(
    (eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysAway > 0 && daysAway < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  // Otherwise full date
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
