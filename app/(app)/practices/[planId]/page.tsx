// app/(app)/practices/[planId]/page.tsx
// Full practice plan editor with ordered blocks.

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { PracticeDetailClient } from '@/components/practice/PracticeDetailClient';

export const metadata = { title: 'Practice Plan' };

export default async function PracticeDetailPage({
  params,
}: {
  params: { planId: string };
}) {
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
  if (membership.role !== 'coach') redirect('/dashboard');

  // Fetch plan with all blocks ordered by sort_order
  const { data: plan } = await (supabase as any)
    .from('practice_plans')
    .select(
      `
      id,
      title,
      notes,
      duration_min,
      created_at,
      practice_plan_blocks (
        id,
        block_type,
        title,
        description,
        duration_min,
        sort_order
      )
    `,
    )
    .eq('id', params.planId)
    .eq('team_id', membership.team_id)
    .single();

  if (!plan) notFound();

  // Sort blocks by sort_order
  const sortedBlocks = [...(plan.practice_plan_blocks ?? [])].sort(
    (a: any, b: any) => a.sort_order - b.sort_order,
  );

  // Fetch practice events this plan is linked to
  const { data: linkedEvents } = await (supabase as any)
    .from('events')
    .select('id, title, starts_at, event_type')
    .eq('practice_plan_id', params.planId)
    .eq('team_id', membership.team_id)
    .order('starts_at', { ascending: true });

  // Fetch all practice events for linking
  const { data: practiceEvents } = await (supabase as any)
    .from('events')
    .select('id, title, starts_at')
    .eq('team_id', membership.team_id)
    .eq('event_type', 'practice')
    .is('practice_plan_id', null)
    .order('starts_at', { ascending: true });

  return (
    <PracticeDetailClient
      plan={{ ...plan, practice_plan_blocks: sortedBlocks }}
      teamId={membership.team_id}
      linkedEvents={linkedEvents ?? []}
      availableEvents={practiceEvents ?? []}
    />
  );
}
