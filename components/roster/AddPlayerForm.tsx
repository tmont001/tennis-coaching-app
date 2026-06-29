'use client';
// components/roster/AddPlayerForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/ui';
import { addPlayer } from '@/actions/roster';

const schema = z.object({
  displayName: z.string().min(1, 'Name is required'),
  gradYear: z.string().optional(),
  jerseyNumber: z.string().optional(),
  ladderRank: z.string().optional(),
  invitedEmail: z.string().email('Invalid email').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function AddPlayerForm({
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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await addPlayer({
      teamId,
      displayName: values.displayName,
      gradYear: values.gradYear ? parseInt(values.gradYear) : undefined,
      jerseyNumber: values.jerseyNumber
        ? parseInt(values.jerseyNumber)
        : undefined,
      ladderRank: values.ladderRank ? parseInt(values.ladderRank) : undefined,
      invitedEmail: values.invitedEmail || undefined,
      status: 'active',
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

      <Field
        label="Full name"
        htmlFor="displayName"
        error={errors.displayName?.message}
      >
        <input
          id="displayName"
          type="text"
          className="input"
          placeholder="Jane Smith"
          {...register('displayName')}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Grad year"
          htmlFor="gradYear"
          optional
          error={errors.gradYear?.message}
        >
          <input
            id="gradYear"
            type="number"
            className="input"
            placeholder="2026"
            min={2020}
            max={2035}
            {...register('gradYear')}
          />
        </Field>
        <Field
          label="Jersey #"
          htmlFor="jerseyNumber"
          optional
          error={errors.jerseyNumber?.message}
        >
          <input
            id="jerseyNumber"
            type="number"
            className="input"
            placeholder="12"
            min={0}
            max={999}
            {...register('jerseyNumber')}
          />
        </Field>
      </div>

      <Field
        label="Ladder rank"
        htmlFor="ladderRank"
        optional
        error={errors.ladderRank?.message}
      >
        <input
          id="ladderRank"
          type="number"
          className="input"
          placeholder="1"
          min={1}
          {...register('ladderRank')}
        />
      </Field>

      <Field
        label="Player email"
        htmlFor="invitedEmail"
        optional
        error={errors.invitedEmail?.message}
      >
        <input
          id="invitedEmail"
          type="email"
          className="input"
          placeholder="player@email.com (for future invite)"
          {...register('invitedEmail')}
        />
        <p className="text-xs text-gray-400 mt-1">
          Used in Week 3 to invite the player to claim their account.
        </p>
      </Field>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          className="btn-primary flex-1"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Adding…
            </>
          ) : (
            'Add player'
          )}
        </button>
      </div>
    </form>
  );
}
