'use client';
// components/roster/EditPlayerForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/ui';
import { updatePlayer } from '@/actions/roster';

const schema = z.object({
  displayName: z.string().min(1, 'Name is required'),
  gradYear: z.string().optional(),
  ladderRank: z.string().optional(),
  invitedEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  notesPublic: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface EditPlayerFormProps {
  player: {
    id: string;
    display_name: string | null;
    ladder_rank: number | null;
    grad_year: number | null;
    invited_email: string | null;
    notes_public: string | null;
    profiles: { full_name: string } | null;
  };
  teamId: string;
  onSuccess: () => void;
}

export function EditPlayerForm({
  player,
  teamId,
  onSuccess,
}: EditPlayerFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const currentName = player.profiles?.full_name ?? player.display_name ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: currentName,
      gradYear: player.grad_year?.toString() ?? '',
      ladderRank: player.ladder_rank?.toString() ?? '',
      invitedEmail: player.invited_email ?? '',
      notesPublic: player.notes_public ?? '',
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await updatePlayer({
      playerId: player.id,
      teamId,
      displayName: values.displayName,
      gradYear: values.gradYear ? parseInt(values.gradYear) : null,
      ladderRank: values.ladderRank ? parseInt(values.ladderRank) : null,
      invitedEmail: values.invitedEmail || null,
      notesPublic: values.notesPublic || null,
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
          {...register('displayName')}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Grad year" htmlFor="gradYear" optional>
          <input
            id="gradYear"
            type="number"
            className="input"
            placeholder="2026"
            {...register('gradYear')}
          />
        </Field>
        <Field label="Ladder rank" htmlFor="ladderRank" optional>
          <input
            id="ladderRank"
            type="number"
            className="input"
            placeholder="1"
            {...register('ladderRank')}
          />
        </Field>
      </div>

      <Field
        label="Email (for invite)"
        htmlFor="invitedEmail"
        optional
        error={errors.invitedEmail?.message}
      >
        <input
          id="invitedEmail"
          type="email"
          className="input"
          {...register('invitedEmail')}
        />
      </Field>

      <Field label="Player bio / notes" htmlFor="notesPublic" optional>
        <textarea
          id="notesPublic"
          rows={3}
          className="input resize-none"
          placeholder="Visible to all team members"
          {...register('notesPublic')}
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
