-- ============================================================
-- Player Status Column
--
-- Adds a status field to players for filtering the roster.
-- Defaults to 'active'. Constrained to active/injured/inactive.
--
-- Safe to run multiple times (IF NOT EXISTS + conditional CHECK).
-- Run in Supabase SQL Editor.
-- ============================================================

alter table public.players
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'players_status_check'
  ) then
    alter table public.players
      add constraint players_status_check
      check (status in ('active', 'injured', 'inactive'));
  end if;
end $$;
