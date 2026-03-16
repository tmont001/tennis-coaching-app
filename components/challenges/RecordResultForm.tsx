'use client';
// components/challenges/RecordResultForm.tsx
// Coach selects the winner and enters the score.
// Returns swap preview data to parent if challenger won.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/ui';
import { recordChallengeResult } from '@/actions/challenges';
import type {
  ChallengeRow,
  SwapPreview,
} from '@/components/challenges/ChallengesClient';

const schema = z.object({
  winnerId: z.string().min(1, 'Select a winner'),
  score: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function RecordResultForm({
  challenge,
  teamId,
  onResult,
}: {
  challenge: ChallengeRow;
  teamId: string;
  onResult: (preview: SwapPreview | null) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const challengerName =
    challenge.challenger.profiles?.full_name ??
    challenge.challenger.display_name ??
    'Challenger';
  const challengedName =
    challenge.challenged.profiles?.full_name ??
    challenge.challenged.display_name ??
    'Challenged';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await recordChallengeResult(
      challenge.id,
      teamId,
      values.winnerId,
      values.score || '',
    );

    if (result.error) {
      setServerError(result.error);
      return;
    }

    if (result.data?.rankSwapRequired && result.data.swapPreview) {
      onResult({
        challengeId: result.data.challengeId!,
        challenger: result.data.swapPreview.challenger,
        challenged: result.data.swapPreview.challenged,
      });
    } else {
      onResult(null);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {serverError}
        </div>
      )}

      {/* Match summary */}
      <div className="p-4 bg-gray-50 rounded-xl text-center">
        <p className="text-sm text-gray-500 mb-1">Challenge</p>
        <p className="text-base font-semibold text-gray-900">
          {challengerName}
          <span className="text-gray-400 font-normal mx-2">vs</span>
          {challengedName}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          #{challenge.challenger.ladder_rank} challenges #
          {challenge.challenged.ladder_rank}
        </p>
      </div>

      {/* Winner selection */}
      <Field label="Winner" htmlFor="winnerId" error={errors.winnerId?.message}>
        <select id="winnerId" className="input" {...register('winnerId')}>
          <option value="">Select winner…</option>
          <option value={challenge.challenger.id}>
            {challengerName} (Challenger — #{challenge.challenger.ladder_rank})
          </option>
          <option value={challenge.challenged.id}>
            {challengedName} (Challenged — #{challenge.challenged.ladder_rank})
          </option>
        </select>
      </Field>

      {/* Score */}
      <Field label="Score" htmlFor="score" optional>
        <input
          id="score"
          type="text"
          className="input"
          placeholder="e.g. 6-3, 7-5"
          {...register('score')}
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
            Recording…
          </>
        ) : (
          'Record result'
        )}
      </button>
    </form>
  );
}
