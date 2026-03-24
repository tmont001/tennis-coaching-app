// app/auth/login/page.tsx

import { LoginForm } from '@/components/auth/LoginForm';
import Link from 'next/link';

export const metadata = { title: 'Sign In' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; error?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CourtSide</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your team</p>
        </div>

        {searchParams.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            Something went wrong. Please try again.
          </div>
        )}

        <div className="card p-6">
          <LoginForm redirectTo={searchParams.redirectTo} />

          {/* Forgot password link — inside the card, below the form */}
          <p className="text-center text-sm text-gray-500 mt-4">
            <Link
              href="/auth/forgot-password"
              className="text-brand-600 font-medium hover:underline"
            >
              Forgot your password?
            </Link>
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/signup"
            className="text-brand-600 font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
