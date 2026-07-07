'use client';
// components/practice/CreatePlanForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/ui';
import { createPracticePlan } from '@/actions/practices';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreatePlanForm({
  teamId,
  onSuccess,
}: {
  teamId: string;
  onSuccess: (planId: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', notes: '' },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await createPracticePlan({
      teamId,
      title: values.title,
      notes: values.notes || null,
      durationMin: null,
    });

    if (result.error) {
      setServerError(result.error);
      return;
    }
    onSuccess(result.data!.id);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {serverError}
        </div>
      )}

      <Field label="Plan title" htmlFor="title" error={errors.title?.message}>
        <input
          id="title"
          type="text"
          className="input"
          placeholder="Tuesday Afternoon Practice"
          {...register('title')}
        />
      </Field>

      <Field label="Notes" htmlFor="notes" optional>
        <textarea
          id="notes"
          rows={3}
          className="input resize-none"
          placeholder="Focus areas, goals, or reminders for this practice…"
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
            Creating…
          </>
        ) : (
          'Create plan'
        )}
      </button>
    </form>
  );
}
