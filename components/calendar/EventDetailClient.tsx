'use client';
// components/calendar/EventDetailClient.tsx
// Shows full event details. Coaches can edit, cancel, or permanently delete.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Edit2,
  XCircle,
  Trash2,
  Loader2,
  MapPin,
  Swords,
  User,
  Clock,
  ClipboardList,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { Badge, ConfirmDialog, Modal, Field } from '@/components/ui';
import { cancelEvent, updateEvent, deleteEvent } from '@/actions/events';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────
interface EventDetail {
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
  created_at: string;
  practice_plan_id: string | null;
  profiles: { full_name: string } | null;
  practice_plans: {
    id: string;
    title: string;
    duration_min: number | null;
  } | null;
}

const EVENT_TYPE_CONFIG = {
  practice: { label: 'Practice', variant: 'green' as const, emoji: '🎾' },
  match: { label: 'Match', variant: 'blue' as const, emoji: '🏆' },
  meeting: { label: 'Meeting', variant: 'gray' as const, emoji: '📋' },
  other: { label: 'Event', variant: 'gray' as const, emoji: '📌' },
};

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', variant: 'green' as const },
  cancelled: { label: 'Cancelled', variant: 'red' as const },
  postponed: { label: 'Postponed', variant: 'yellow' as const },
};

// ── Edit form schema ──────────────────────────────────────────
const editSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    eventType: z.enum(['practice', 'match', 'meeting', 'other']),
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().optional(),
    location: z.string().optional(),
    opponentName: z.string().optional(),
    isHome: z.string().optional(),
    description: z.string().optional(),
  })
  .refine(
    (data) => !data.endTime || data.endTime > data.startTime,
    { message: 'End time must be after start time', path: ['endTime'] },
  );

type EditFormValues = z.infer<typeof editSchema>;

// ── Main component ────────────────────────────────────────────
export function EventDetailClient({
  event,
  teamId,
  isCoach,
}: {
  event: EventDetail;
  teamId: string;
  isCoach: boolean;
}) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);

  // Cancel state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const typeConfig = EVENT_TYPE_CONFIG[event.event_type];
  const statusConfig = STATUS_CONFIG[event.status];
  const isCancelled = event.status === 'cancelled';

  const startDate = parseISO(event.starts_at);
  const endDate = event.ends_at ? parseISO(event.ends_at) : null;

  const formattedDate = format(startDate, 'EEEE, MMMM d, yyyy');
  const formattedStart = format(startDate, 'h:mm a');
  const formattedEnd = endDate ? format(endDate, 'h:mm a') : null;
  const timeStr = formattedEnd
    ? `${formattedStart} – ${formattedEnd}`
    : formattedStart;

  async function handleCancel() {
    setCancelLoading(true);
    setCancelError(null);
    const result = await cancelEvent(event.id, teamId);
    setCancelLoading(false);
    if (result.error) {
      setCancelError(result.error);
      return;
    }
    setShowCancelDialog(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError(null);
    const result = await deleteEvent(event.id, teamId);
    setDeleteLoading(false);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    setShowDeleteDialog(false);
    router.push('/calendar');
  }

  return (
    <div className="space-y-5 max-w-lg">
      {/* Back navigation */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Calendar
      </button>

      {/* Event header card */}
      <div className={clsx('card p-5', isCancelled && 'opacity-70')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0">
              {typeConfig.emoji}
            </div>
            <div>
              <h1
                className={clsx(
                  'text-xl font-bold',
                  isCancelled ? 'line-through text-gray-400' : 'text-gray-900',
                )}
              >
                {event.title}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={typeConfig.variant}>{typeConfig.label}</Badge>
                <Badge variant={statusConfig.variant}>
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* Coach actions — scheduled event */}
          {isCoach && !isCancelled && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setShowEditModal(true)}
                className="btn-secondary p-2"
                title="Edit event"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={() => setShowCancelDialog(true)}
                className="btn-secondary p-2 text-yellow-600 hover:text-yellow-700 hover:border-yellow-300"
                title="Cancel event"
              >
                <XCircle size={15} />
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="btn-secondary p-2 text-red-500 hover:text-red-700 hover:border-red-300"
                title="Delete event permanently"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}

          {/* Coach actions — already cancelled event (delete only) */}
          {isCoach && isCancelled && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="btn-secondary p-2 text-red-500 hover:text-red-700 hover:border-red-300 flex-shrink-0"
              title="Delete event permanently"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Event details card */}
      <div className="card p-5 space-y-4">
        {/* Date & time */}
        <DetailRow icon={<Clock size={15} />} label="Date & time">
          <span className="text-sm text-gray-900">{formattedDate}</span>
          <span className="text-sm text-gray-500">{timeStr}</span>
        </DetailRow>

        {/* Location */}
        {event.location && (
          <DetailRow icon={<MapPin size={15} />} label="Location">
            <span className="text-sm text-gray-900">{event.location}</span>
          </DetailRow>
        )}

        {/* Match-specific */}
        {event.event_type === 'match' && (
          <DetailRow icon={<Swords size={15} />} label={event.opponent_name ? 'Opponent' : 'Match'}>
            {event.opponent_name && (
              <span className="text-sm text-gray-900">
                vs {event.opponent_name}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {event.is_home ? 'Home' : 'Away'}
            </span>
          </DetailRow>
        )}

        {/* Created by */}
        <DetailRow icon={<User size={15} />} label="Added by">
          <span className="text-sm text-gray-600">
            {event.profiles?.full_name ?? 'Coach'}
          </span>
        </DetailRow>
      </div>

      {/* Description / notes */}
      {(event.description || isCoach) && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Notes</h2>
          {event.description ? (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {event.description}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">
              No notes added — edit event to add details.
            </p>
          )}
        </div>
      )}

      {/* Linked practice plan — shown for practice events */}
      {event.event_type === 'practice' && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ClipboardList size={14} className="text-brand-500" />
            Practice Plan
          </h2>
          {event.practice_plans ? (
            <Link
              href={`/practices/${event.practice_plans.id}`}
              className="flex items-center justify-between p-3 rounded-xl bg-brand-50 border border-brand-200 hover:border-brand-400 transition-colors group"
            >
              <div>
                <div className="text-sm font-medium text-brand-800 group-hover:text-brand-900">
                  {event.practice_plans.title}
                </div>
                {event.practice_plans.duration_min && (
                  <div className="text-xs text-brand-600 mt-0.5 flex items-center gap-1">
                    <Clock size={10} />
                    {event.practice_plans.duration_min} min
                  </div>
                )}
              </div>
              <span className="text-brand-400 group-hover:text-brand-600 transition-colors">
                →
              </span>
            </Link>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                No practice plan linked yet.
              </p>
              {isCoach && (
                <Link
                  href="/practices"
                  className="text-xs text-brand-600 hover:underline font-medium"
                >
                  Go to Plans →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error messages */}
      {cancelError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {cancelError}
        </div>
      )}
      {deleteError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {deleteError}
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <ConfirmDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancel}
        loading={cancelLoading}
        title="Cancel this event?"
        description={`"${event.title}" will be marked as cancelled. It will remain visible in the calendar so the team can see it was cancelled.`}
        confirmLabel="Yes, cancel event"
        confirmVariant="danger"
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Permanently delete this event?"
        description={`"${event.title}" will be removed completely and cannot be recovered. Use Cancel instead if you want it to stay visible to the team.`}
        confirmLabel="Yes, delete permanently"
        confirmVariant="danger"
      />

      {/* Edit event modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Event"
        maxWidth="lg"
      >
        <EditEventForm
          event={event}
          teamId={teamId}
          onSuccess={() => {
            setShowEditModal(false);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

// ── Detail row layout helper ──────────────────────────────────
function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">
          {label}
        </div>
        <div className="flex flex-col gap-0.5">{children}</div>
      </div>
    </div>
  );
}

// ── Inline edit form ──────────────────────────────────────────
function EditEventForm({
  event,
  teamId,
  onSuccess,
}: {
  event: EventDetail;
  teamId: string;
  onSuccess: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const startDate = parseISO(event.starts_at);
  const endDate = event.ends_at ? parseISO(event.ends_at) : null;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: event.title,
      eventType: event.event_type,
      date: format(startDate, 'yyyy-MM-dd'),
      startTime: format(startDate, 'HH:mm'),
      endTime: endDate ? format(endDate, 'HH:mm') : '',
      location: event.location ?? '',
      opponentName: event.opponent_name ?? '',
      isHome: event.is_home ? 'true' : 'false',
      description: event.description ?? '',
    },
  });

  const eventType = watch('eventType');

  async function onSubmit(values: EditFormValues) {
    setServerError(null);

    const startsAt = new Date(`${values.date}T${values.startTime}:00`).toISOString();
    const endsAt = values.endTime
      ? new Date(`${values.date}T${values.endTime}:00`).toISOString()
      : null;

    const result = await updateEvent({
      eventId: event.id,
      teamId,
      title: values.title,
      eventType: values.eventType,
      startsAt,
      endsAt,
      location: values.location || null,
      opponentName: values.opponentName || null,
      isHome: values.isHome !== 'false',
      description: values.description || null,
    });

    if (result.error) {
      setServerError(result.error);
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {serverError}
        </div>
      )}

      <Field label="Event type" htmlFor="eventType">
        <select id="eventType" className="input" {...register('eventType')}>
          <option value="practice">Practice</option>
          <option value="match">Match</option>
          <option value="meeting">Meeting</option>
          <option value="other">Other</option>
        </select>
      </Field>

      <Field label="Title" htmlFor="title" error={errors.title?.message}>
        <input
          id="title"
          type="text"
          className="input"
          {...register('title')}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Date" htmlFor="date" error={errors.date?.message}>
          <input
            id="date"
            type="date"
            className="input"
            {...register('date')}
          />
        </Field>
        <Field
          label="Start time"
          htmlFor="startTime"
          error={errors.startTime?.message}
        >
          <input
            id="startTime"
            type="time"
            className="input"
            {...register('startTime')}
          />
        </Field>
        <Field
          label="End time"
          htmlFor="endTime"
          optional
          error={errors.endTime?.message}
        >
          <input
            id="endTime"
            type="time"
            className="input"
            {...register('endTime')}
          />
        </Field>
      </div>

      <Field label="Location" htmlFor="location" optional>
        <input
          id="location"
          type="text"
          className="input"
          {...register('location')}
        />
      </Field>

      {eventType === 'match' && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <Field label="Opponent" htmlFor="opponentName" optional>
            <input
              id="opponentName"
              type="text"
              className="input"
              placeholder="Jefferson High School"
              {...register('opponentName')}
            />
          </Field>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              Game location:
            </span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  value="true"
                  className="accent-brand-600"
                  {...register('isHome')}
                />
                Home
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  value="false"
                  className="accent-brand-600"
                  {...register('isHome')}
                />
                Away
              </label>
            </div>
          </div>
        </div>
      )}

      <Field label="Notes" htmlFor="description" optional>
        <textarea
          id="description"
          rows={3}
          className="input resize-none"
          {...register('description')}
        />
      </Field>

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Saving…
          </>
        ) : (
          'Save changes'
        )}
      </button>
    </form>
  );
}
