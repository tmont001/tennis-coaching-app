'use client';
// components/matches/LogMatchForm.tsx
// Form for logging or editing a match result.

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/ui';
import { createMatch, updateMatch } from '@/actions/matches';
import type { Match } from '@/components/matches/MatchesClient';

const schema = z.object({
  opponentName: z.string().min(1, 'Opponent name is required'),
  matchDate: z.string().min(1, 'Date is required'),
  isHome: z.enum(['true', 'false']).default('true'),
  result: z.enum(['win', 'loss', 'tie', 'cancelled', 'pending']),
  ourScore: z.string().optional(),
  opponentScore: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LogMatchForm({
  teamId,
  existingMatch,
  onSuccess,
}: {
  teamId: string;
  existingMatch?: Match;
  onSuccess: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const isEditing = !!existingMatch;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: existingMatch
      ? {
          opponentName: existingMatch.opponent_name,
          matchDate: existingMatch.match_date,
          isHome: existingMatch.is_home ? 'true' : 'false',
          result: existingMatch.result,
          ourScore: existingMatch.our_score?.toString() ?? '',
          opponentScore: existingMatch.opponent_score?.toString() ?? '',
          notes: existingMatch.notes ?? '',
        }
      : {
          result: 'pending',
          isHome: 'true',
        },
  });

  const result = watch('result');

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const payload = {
      teamId,
      opponentName: values.opponentName,
      matchDate: values.matchDate,
      isHome: values.isHome !== 'false',
      result: values.result,
      ourScore: values.ourScore ? parseInt(values.ourScore) : null,
      opponentScore: values.opponentScore
        ? parseInt(values.opponentScore)
        : null,
      notes: values.notes || null,
    };

    const res = isEditing
      ? await updateMatch(existingMatch!.id, teamId, payload)
      : await createMatch(payload);

    if (res.error) {
      setServerError(res.error);
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

      <Field
        label="Opponent"
        htmlFor="opponentName"
        error={errors.opponentName?.message}
      >
        <input
          id="opponentName"
          type="text"
          className="input"
          placeholder="Jefferson High School"
          {...register('opponentName')}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Date"
          htmlFor="matchDate"
          error={errors.matchDate?.message}
        >
          <input
            id="matchDate"
            type="date"
            className="input"
            {...register('matchDate')}
          />
        </Field>
        <Field label="Result" htmlFor="result">
          <select id="result" className="input" {...register('result')}>
            <option value="pending">Pending</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="tie">Tie</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
      </div>

      {/* Score fields — only show when result is known */}
      {['win', 'loss', 'tie'].includes(result) && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Our score" htmlFor="ourScore" optional>
            <input
              id="ourScore"
              type="number"
              className="input"
              placeholder="5"
              min={0}
              {...register('ourScore')}
            />
          </Field>
          <Field label="Their score" htmlFor="opponentScore" optional>
            <input
              id="opponentScore"
              type="number"
              className="input"
              placeholder="4"
              min={0}
              {...register('opponentScore')}
            />
          </Field>
        </div>
      )}

      {/* Home / Away */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Location:</span>
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

      <Field label="Notes" htmlFor="notes" optional>
        <textarea
          id="notes"
          rows={2}
          className="input resize-none"
          placeholder="Match notes, standout performances…"
          {...register('notes')}
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
            {isEditing ? 'Saving…' : 'Log match'}
          </>
        ) : isEditing ? (
          'Save changes'
        ) : (
          'Log match'
        )}
      </button>
    </form>
  );
}
