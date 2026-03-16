'use client';
// components/claim/ClaimForm.tsx
// Player enters their claim code to link their account
// to an existing roster record.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle } from 'lucide-react';
import { Field } from '@/components/ui';
import { claimPlayerAccount } from '@/actions/claim';

const schema = z.object({
  claimCode: z
    .string()
    .min(6, 'Claim code must be at least 6 characters')
    .transform((v) => v.toUpperCase().trim()),
});

type FormValues = z.infer<typeof schema>;

export function ClaimForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { claimCode: initialCode ?? '' },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await claimPlayerAccount(values.claimCode);

    if (result.error) {
      setServerError(result.error);
      return;
    }

    setSuccess(
      `Welcome to the team${result.data?.playerName ? `, ${result.data.playerName}` : ''}! Redirecting…`,
    );

    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 1500);
  }

  if (success) {
    return (
      <div className="text-center py-4 space-y-3">
        <CheckCircle className="mx-auto text-green-500" size={40} />
        <p className="text-sm font-medium text-gray-900">{success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {serverError}
        </div>
      )}

      <Field
        label="Claim code"
        htmlFor="claimCode"
        error={errors.claimCode?.message}
      >
        <input
          id="claimCode"
          type="text"
          className="input uppercase tracking-widest text-center text-lg font-mono"
          placeholder="XXXXXXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          {...register('claimCode')}
        />
        <p className="text-xs text-gray-400 text-center mt-1">
          Get this code from your coach
        </p>
      </Field>

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Verifying…
          </>
        ) : (
          'Claim my profile'
        )}
      </button>
    </form>
  );
}
