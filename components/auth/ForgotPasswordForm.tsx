'use client';
// components/auth/ForgotPasswordForm.tsx
// Sends a password reset email via Supabase Auth.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const supabase = createClient();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      // Don't reveal whether the email exists — show success regardless
      // but log the error for debugging
      console.error('resetPasswordForEmail:', error);
    }

    // Always show success to avoid email enumeration
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center py-4 space-y-3">
        <CheckCircle className="mx-auto text-green-500" size={40} />
        <h2 className="text-base font-semibold text-gray-900">
          Check your email
        </h2>
        <p className="text-sm text-gray-500">
          If an account exists for{' '}
          <span className="font-medium text-gray-700">
            {getValues('email')}
          </span>
          , we've sent a password reset link. Check your inbox and spam folder.
        </p>
        <p className="text-xs text-gray-400 pt-2">
          The link expires in 1 hour.
        </p>
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

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="input"
          placeholder="you@example.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
        )}
      </div>

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Sending…
          </>
        ) : (
          'Send reset link'
        )}
      </button>
    </form>
  );
}
