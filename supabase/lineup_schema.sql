-- ============================================================
-- Lineup + Team Settings Schema
-- Run in Supabase SQL Editor as a new query
-- ============================================================

-- ── Add lineup format to teams ────────────────────────────────
alter table public.teams
  add column if not exists singles_count int not null default 3,
  add column if not exists doubles_count int not null default 3;

-- ── match_lines table ─────────────────────────────────────────
create table if not exists public.match_lines (
  id          uuid primary key default uuid_generate_v4(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  line_type   text not null check (line_type in ('singles', 'doubles')),
  position    int not null,           -- 1-based within type
  player1_id  uuid references public.players(id) on delete set null,
  player2_id  uuid references public.players(id) on delete set null,
  result      text check (result in ('win', 'loss', 'not_played')),
  score       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (match_id, line_type, position)
);

create index if not exists idx_match_lines_match_id
  on public.match_lines(match_id);

create index if not exists idx_match_lines_player1
  on public.match_lines(player1_id);

create index if not exists idx_match_lines_player2
  on public.match_lines(player2_id);

-- updated_at trigger
create trigger trg_match_lines_updated_at
  before update on public.match_lines
  for each row execute function public.handle_updated_at();

-- ── RLS on match_lines ────────────────────────────────────────
alter table public.match_lines enable row level security;

create policy "match_lines_select_members"
  on public.match_lines for select
  using (public.is_team_member(team_id));

create policy "match_lines_insert_coach"
  on public.match_lines for insert
  with check (public.is_team_coach(team_id));

create policy "match_lines_update_coach"
  on public.match_lines for update
  using (public.is_team_coach(team_id));

create policy "match_lines_delete_coach"
  on public.match_lines for delete
  using (public.is_team_coach(team_id));

-- ── RLS on teams (update) ─────────────────────────────────────
-- Coaches can update their own team settings
drop policy if exists "teams_update_coach" on public.teams;
drop policy if exists "teams_update"       on public.teams;

create policy "teams_update_coach"
  on public.teams for update
  using (public.is_team_coach(id));

-- ── RLS on team_members (coach can remove members) ───────────
-- Already exists but confirm delete policy is in place
drop policy if exists "team_members_delete_coach" on public.team_members;
drop policy if exists "team_members_delete"       on public.team_members;

create policy "team_members_delete_coach"
  on public.team_members for delete
  using (public.is_team_coach(team_id));