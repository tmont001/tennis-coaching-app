'use client';
// components/practice/EditBlockForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/ui';
import { updatePracticeBlock } from '@/actions/practices';
import type { PracticeBlock } from '@/components/practice/PracticeDetailClient';

const schema = z.object({
  blockType: z.enum(['warmup', 'drill', 'game', 'cooldown', 'other']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  durationMin: z.string().min(1, 'Duration is required'),
});

type FormValues = z.infer<typeof schema>;

export function EditBlockForm({
  block,
  teamId,
  onSuccess,
}: {
  block: PracticeBlock;
  teamId: string;
  onSuccess: (updated: PracticeBlock) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      blockType: block.block_type,
      title: block.title,
      description: block.description ?? '',
      durationMin: String(block.duration_min),
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await updatePracticeBlock(block.id, teamId, {
      blockType: values.blockType,
      title: values.title,
      description: values.description || null,
      durationMin: parseInt(values.durationMin),
    });

    if (result.error) {
      setServerError(result.error);
      return;
    }

    onSuccess({
      ...block,
      block_type: values.blockType,
      title: values.title,
      description: values.description || null,
      duration_min: parseInt(values.durationMin),
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {serverError}
        </div>
      )}

      <Field label="Block type" htmlFor="blockType">
        <select id="blockType" className="input" {...register('blockType')}>
          <option value="warmup">Warmup</option>
          <option value="drill">Drill</option>
          <option value="game">Game</option>
          <option value="cooldown">Cooldown</option>
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

      <Field
        label="Duration"
        htmlFor="durationMin"
        error={errors.durationMin?.message}
      >
        <div className="relative">
          <input
            id="durationMin"
            type="number"
            className="input pr-12"
            min={1}
            max={120}
            {...register('durationMin')}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            min
          </span>
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {[5, 10, 15, 20, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setValue('durationMin', String(d))}
              className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-brand-100 hover:text-brand-700 transition-colors"
            >
              {d}m
            </button>
          ))}
        </div>
      </Field>

      <Field label="Description" htmlFor="description" optional>
        <textarea
          id="description"
          rows={2}
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
