'use client';
// components/feed/CreatePostForm.tsx
// Form for creating a new announcement post.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/ui';
import { createAnnouncement } from '@/actions/announcements';

const schema = z.object({
  title: z.string().optional(),
  body: z.string().min(1, 'Post content is required'),
});

type FormValues = z.infer<typeof schema>;

export function CreatePostForm({
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
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const body = watch('body') ?? '';

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const result = await createAnnouncement({
      teamId,
      title: values.title || null,
      body: values.body,
      imageUrl: null,
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

      <Field label="Title" htmlFor="title" optional>
        <input
          id="title"
          type="text"
          className="input"
          placeholder="Practice reminder, match update, shoutout…"
          {...register('title')}
        />
      </Field>

      <Field label="Post" htmlFor="body" error={errors.body?.message}>
        <textarea
          id="body"
          rows={5}
          className="input resize-none"
          placeholder="What's on your mind? Share an update with your team…"
          {...register('body')}
        />
        <div className="text-right">
          <span className="text-xs text-gray-400">{body.length} chars</span>
        </div>
      </Field>

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Posting…
          </>
        ) : (
          'Post to feed'
        )}
      </button>
    </form>
  );
}
