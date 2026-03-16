-- ============================================================
-- Week 5 Schema — Matches + Challenge Ladder
-- Run in Supabase SQL Editor as a new query
-- ============================================================

-- ── Ladder history table ──────────────────────────────────────
-- Logs every rank change for audit trail and history view
create table if not exists public.ladder_history (
  id           uuid primary key default uuid_generate_v4(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  old_rank     int,
  new_rank     int,
  reason       text not null, -- 'challenge_result' | 'manual_adjustment'
  challenge_id uuid references public.challenges(id) on delete set null,
  changed_by   uuid not null references public.profiles(id),
  changed_at   timestamptz not null default now()
);

create index if not exists idx_ladder_history_team_id
  on public.ladder_history(team_id, changed_at desc);

create index if not exists idx_ladder_history_player_id
  on public.ladder_history(player_id);

-- ── preferences column on profiles ───────────────────────────
-- Stores per-user UI preferences (e.g. skip_ladder_confirm)
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}';

-- ── RLS — matches ─────────────────────────────────────────────
alter table public.matches enable row level security;

drop policy if exists "matches_select_members" on public.matches;
drop policy if exists "matches_insert_coach"   on public.matches;
drop policy if exists "matches_update_coach"   on public.matches;
drop policy if exists "matches_delete_coach"   on public.matches;

create policy "matches_select_members"
  on public.matches for select
  using (public.is_team_member(team_id));

create policy "matches_insert_coach"
  on public.matches for insert
  with check (public.is_team_coach(team_id));

create policy "matches_update_coach"
  on public.matches for update
  using (public.is_team_coach(team_id));

create policy "matches_delete_coach"
  on public.matches for delete
  using (public.is_team_coach(team_id));

-- ── RLS — challenges ─────────────────────────────────────────
alter table public.challenges enable row level security;

drop policy if exists "challenges_select_members"      on public.challenges;
drop policy if exists "challenges_insert_coach_or_player" on public.challenges;
drop policy if exists "challenges_update_coach"        on public.challenges;

create policy "challenges_select_members"
  on public.challenges for select
  using (public.is_team_member(team_id));

create policy "challenges_insert_coach_or_player"
  on public.challenges for insert
  with check (public.is_coach_or_player(team_id));

create policy "challenges_update_coach"
  on public.challenges for update
  using (public.is_team_coach(team_id));

-- ── RLS — ladder_history ─────────────────────────────────────
alter table public.ladder_history enable row level security;

create policy "ladder_history_select_members"
  on public.ladder_history for select
  using (public.is_team_member(team_id));

create policy "ladder_history_insert_coach"
  on public.ladder_history for insert
  with check (public.is_team_coach(team_id));