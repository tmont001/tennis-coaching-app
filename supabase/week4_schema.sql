-- ============================================================
-- Week 4 Schema — Practice Planner
-- Run in Supabase SQL Editor as a new query
-- ============================================================

-- Ensure RLS is enabled on practice tables
alter table public.practice_plans       enable row level security;
alter table public.practice_plan_blocks enable row level security;

-- Drop and recreate to ensure clean state
drop policy if exists "practice_plans_coach_only"       on public.practice_plans;
drop policy if exists "practice_plan_blocks_coach_only" on public.practice_plan_blocks;

-- Practice plans: coaches only
create policy "practice_plans_all_coach"
  on public.practice_plans for all
  using (public.is_team_coach(team_id))
  with check (public.is_team_coach(team_id));

-- Practice plan blocks: coaches only via plan
create policy "practice_plan_blocks_all_coach"
  on public.practice_plan_blocks for all
  using (
    exists (
      select 1 from public.practice_plans pp
      where pp.id = practice_plan_id
        and public.is_team_coach(pp.team_id)
    )
  )
  with check (
    exists (
      select 1 from public.practice_plans pp
      where pp.id = practice_plan_id
        and public.is_team_coach(pp.team_id)
    )
  );

-- Link practice plan to event (events table already has practice_plan_id column)
-- Just ensure the FK constraint exists
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_events_practice_plan'
  ) then
    alter table public.events
      add constraint fk_events_practice_plan
      foreign key (practice_plan_id)
      references public.practice_plans(id)
      on delete set null;
  end if;
end $$;