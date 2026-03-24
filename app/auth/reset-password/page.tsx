// app/auth/reset-password/page.tsx
// User lands here after clicking the link in their reset email.
// They enter and confirm a new password.

import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata = { title: 'Set New Password' };

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Set a new password
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Choose a strong password for your account.
          </p>
        </div>

        <div className="card p-6">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
