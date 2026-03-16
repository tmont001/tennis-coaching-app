// app/claim/page.tsx
// Players visit this page to enter their claim code and link
// their account to their roster record.

import { ClaimForm } from '@/components/claim/ClaimForm';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Claim Your Player Profile' };

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(
      `/auth/login?redirectTo=/claim${searchParams.code ? `?code=${searchParams.code}` : ''}`,
    );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Claim Your Profile
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Enter the code your coach gave you to link your account.
          </p>
        </div>

        <div className="card p-6">
          <ClaimForm initialCode={searchParams.code} />
        </div>
      </div>
    </div>
  );
}
