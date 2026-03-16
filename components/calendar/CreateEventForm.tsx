'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/ui';
import { createEvent } from '@/actions/events';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  eventType: z.enum(['practice', 'match', 'meeting', 'other']),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().optional(),
  location: z.string().optional(),
  opponentName: z.string().optional(),
  isHome: z.string().optional(), // kept as string, converted on submit
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreateEventForm({
  teamId,
  onSuccess,
}: {
  teamId: string;
  onSuccess: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      eventType: 'practice',
      isHome: 'true',
    },
  });

  const eventType = watch('eventType');

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const startsAt = `${values.date}T${values.startTime}:00`;
    const endsAt = values.endTime
      ? `${values.date}T${values.endTime}:00`
      : null;

    const result = await createEvent({
      teamId,
      title: values.title,
      eventType: values.eventType,
      startsAt,
      endsAt,
      location: values.location || null,
      opponentName: values.opponentName || null,
      description: values.description || null,
      isHome: values.isHome !== 'false', // convert string to boolean
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

      {/* Event type */}
      <Field
        label="Event type"
        htmlFor="eventType"
        error={errors.eventType?.message}
      >
        <select id="eventType" className="input" {...register('eventType')}>
          <option value="practice">Practice</option>
          <option value="match">Match</option>
          <option value="meeting">Meeting</option>
          <option value="other">Other</option>
        </select>
      </Field>

      {/* Title */}
      <Field label="Title" htmlFor="title" error={errors.title?.message}>
        <input
          id="title"
          type="text"
          className="input"
          placeholder={
            eventType === 'practice'
              ? 'Afternoon Practice'
              : eventType === 'match'
                ? 'vs Jefferson High'
                : 'Team Meeting'
          }
          {...register('title')}
        />
      </Field>

      {/* Date + times */}
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
        <Field label="End time" htmlFor="endTime" optional>
          <input
            id="endTime"
            type="time"
            className="input"
            {...register('endTime')}
          />
        </Field>
      </div>

      {/* Location */}
      <Field label="Location" htmlFor="location" optional>
        <input
          id="location"
          type="text"
          className="input"
          placeholder="Tennis courts, Gym, etc."
          {...register('location')}
        />
      </Field>

      {/* Match-specific fields */}
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
                  defaultChecked
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

      {/* Description */}
      <Field label="Notes" htmlFor="description" optional>
        <textarea
          id="description"
          className="input min-h-[80px] resize-none"
          placeholder="Any additional details..."
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
            Creating…
          </>
        ) : (
          'Create event'
        )}
      </button>
    </form>
  );
}
