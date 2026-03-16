import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Join Your Team' };

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: membership } = await supabase
    .from('team_members')
    .select('id')
    .eq('profile_id', user.id)
    .limit(1)
    .single();

  if (membership) redirect('/dashboard');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to CourtSide
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Get started by joining or creating a team.
          </p>
        </div>
        <OnboardingFlow userId={user.id} />
      </div>
    </div>
  );
}
