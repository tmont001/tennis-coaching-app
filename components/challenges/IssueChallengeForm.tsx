'use client';
// components/challenges/IssueChallengeForm.tsx

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/ui';
import { issueChallenge } from '@/actions/challenges';
import type { LadderPlayer } from '@/components/challenges/ChallengesClient';

const MAX_CHALLENGE_DISTANCE = 2;

const schema = z.object({
  challengerId: z.string().min(1, 'Select the challenger'),
  challengedId: z.string().min(1, 'Select the player being challenged'),
  scheduledDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function IssueChallengeForm({
  teamId,
  rankedPlayers,
  myPlayerId,
  myLadderRank,
  isCoach,
  preselectedChallengedId,
  onSuccess,
}: {
  teamId: string;
  rankedPlayers: LadderPlayer[];
  myPlayerId: string | null;
  myLadderRank: number | null;
  isCoach: boolean;
  preselectedChallengedId: string | null;
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
      // Coaches pick the challenger; players default to themselves
      challengerId: isCoach ? '' : (myPlayerId ?? ''),
      challengedId: preselectedChallengedId ?? '',
    },
  });

  const challengerId = watch('challengerId');

  // For players: only show players they can challenge (2 spots above)
  // For coaches: show all ranked players as options
  const challenger = rankedPlayers.find((p) => p.id === challengerId);

  const challengeableTargets = rankedPlayers.filter((p) => {
    if (
      !challenger ||
      challenger.ladder_rank === null ||
      p.ladder_rank === null
    )
      return false;
    if (p.id === challengerId) return false;
    if (p.ladder_rank >= challenger.ladder_rank) return false; // must be above
    if (
      !isCoach &&
      challenger.ladder_rank - p.ladder_rank > MAX_CHALLENGE_DISTANCE
    )
      return false;
    return true;
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await issueChallenge(
      teamId,
      values.challengerId,
      values.challengedId,
      values.scheduledDate || null,
    );

    if (result.error) {
      setServerError(result.error);
      return;
    }
    onSuccess();
  }

  function playerLabel(p: LadderPlayer) {
    const name = p.profiles?.full_name ?? p.display_name ?? 'Player';
    return `#${p.ladder_rank} — ${name}`;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {serverError}
        </div>
      )}

      {/* Challenger — coaches pick anyone, players default to themselves */}
      {isCoach && (
        <Field
          label="Challenger"
          htmlFor="challengerId"
          error={errors.challengerId?.message}
        >
          <select
            id="challengerId"
            className="input"
            {...register('challengerId')}
          >
            <option value="">Select challenger…</option>
            {rankedPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {playerLabel(p)}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Challenged player */}
      <Field
        label="Challenging"
        htmlFor="challengedId"
        error={errors.challengedId?.message}
      >
        <select
          id="challengedId"
          className="input"
          {...register('challengedId')}
        >
          <option value="">Select player to challenge…</option>
          {(isCoach
            ? rankedPlayers.filter((p) => p.id !== challengerId)
            : challengeableTargets
          ).map((p) => (
            <option key={p.id} value={p.id}>
              {playerLabel(p)}
            </option>
          ))}
        </select>
        {!isCoach && myLadderRank !== null && (
          <p className="text-xs text-gray-400 mt-1">
            You can challenge players ranked #
            {Math.max(1, myLadderRank - MAX_CHALLENGE_DISTANCE)}–#
            {myLadderRank - 1}
          </p>
        )}
      </Field>

      <Field label="Scheduled date" htmlFor="scheduledDate" optional>
        <input
          id="scheduledDate"
          type="date"
          className="input"
          {...register('scheduledDate')}
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
            Issuing challenge…
          </>
        ) : (
          'Issue challenge'
        )}
      </button>
    </form>
  );
}
