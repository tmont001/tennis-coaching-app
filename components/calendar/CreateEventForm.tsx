'use client';
// components/calendar/CreateEventForm.tsx
// Create event with Nominatim location autocomplete.

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useRef, useEffect } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import { Field } from '@/components/ui';
import { createEvent } from '@/actions/events';

const schema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    eventType: z.enum(['practice', 'match', 'meeting', 'other']),
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().optional(),
    description: z.string().optional(),
    opponentName: z.string().optional(),
    isHome: z.string().optional(),
  })
  .refine(
    (data) => !data.endTime || data.endTime > data.startTime,
    { message: 'End time must be after start time', path: ['endTime'] },
  );

type FormValues = z.infer<typeof schema>;

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export function CreateEventForm({
  teamId,
  onSuccess,
}: {
  teamId: string;
  onSuccess: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<
    NominatimResult[]
  >([]);
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { eventType: 'practice', isHome: 'true' },
  });

  const eventType = watch('eventType');

  // Debounced Nominatim search
  useEffect(() => {
    if (locationQuery.length < 3) {
      setLocationSuggestions([]);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=5`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data: NominatimResult[] = await res.json();
        setLocationSuggestions(data);
      } catch {
        setLocationSuggestions([]);
      }
      setSearching(false);
    }, 400);

    return () => clearTimeout(searchTimeout.current);
  }, [locationQuery]);

  function selectLocation(result: NominatimResult) {
    setSelectedLocation({
      name: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    });
    setLocationQuery(result.display_name);
    setLocationSuggestions([]);
  }

  function clearLocation() {
    setSelectedLocation(null);
    setLocationQuery('');
    setLocationSuggestions([]);
  }

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
      location: (selectedLocation?.name ?? locationQuery) || null,
      locationLat: selectedLocation?.lat ?? null,
      locationLng: selectedLocation?.lng ?? null,
      opponentName: values.opponentName || null,
      description: values.description || null,
      isHome: values.isHome !== 'false',
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

      {/* Location with Nominatim autocomplete */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Location <span className="text-gray-400 text-xs">(optional)</span>
        </label>
        <div className="relative">
          <div className="relative">
            <MapPin
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                setSelectedLocation(null);
              }}
              className="input pl-8 pr-8"
              placeholder="Search for a location…"
            />
            {(locationQuery || searching) && (
              <button
                type="button"
                onClick={clearLocation}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {searching ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <X size={14} />
                )}
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {locationSuggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {locationSuggestions.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  onClick={() => selectLocation(r)}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-800 transition-colors border-b border-gray-50 last:border-0"
                >
                  <span className="font-medium">
                    {r.display_name.split(',')[0]}
                  </span>
                  <span className="text-gray-400 text-xs ml-1">
                    {r.display_name.split(',').slice(1, 3).join(',')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedLocation && (
          <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
            <MapPin size={11} />
            Location confirmed: {selectedLocation.name.split(',')[0]}
          </p>
        )}
      </div>

      {/* Match-specific */}
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
