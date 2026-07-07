// app/(app)/practices/page.tsx
// Lists all practice plans for the team. Coach only.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PracticesClient } from '@/components/practice/PracticesClient';

export const metadata = { title: 'Practice Plans' };

export default async function PracticesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('team_id, role')
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (!membership) redirect('/onboarding');

  // Practices are coach-only
  if (membership.role !== 'coach') redirect('/dashboard');

  // Fetch all plans with block counts
  const { data: plans } = await (supabase as any)
    .from('practice_plans')
    .select(
      `
      id,
      title,
      notes,
      duration_min,
      created_at,
      practice_plan_blocks ( duration_min )
    `,
    )
    .eq('team_id', membership.team_id)
    .order('created_at', { ascending: false });

  return <PracticesClient plans={plans ?? []} teamId={membership.team_id} />;
}
