-- ============================================================
-- Week 2 Schema Additions
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- Add status column to events (scheduled, cancelled, postponed)
alter table public.events
  add column if not exists status text not null default 'scheduled'
  check (status in ('scheduled', 'cancelled', 'postponed'));

-- Add description column to events
alter table public.events
  add column if not exists description text;

-- Add display_name to players table for unclaimed roster entries
-- (players who don't have an auth account yet)
alter table public.players
  add column if not exists display_name text;

-- Add invited_email for future invite flow
alter table public.players
  add column if not exists invited_email text;

-- Add jersey_number directly on players (in addition to team_members)
alter table public.players
  add column if not exists jersey_number int;

-- Make team_member_id and profile_id nullable on players
-- so coaches can add players before they have accounts
alter table public.players
  alter column team_member_id drop not null;

alter table public.players
  alter column profile_id drop not null;

-- Index for fast player lookups by team
create index if not exists idx_players_team_id_rank
  on public.players(team_id, ladder_rank nulls last);

-- ── RLS for unclaimed players ─────────────────────────────────
-- Drop and recreate players policies to handle null profile_id
drop policy if exists "players_select_members" on public.players;
drop policy if exists "players_insert_coach" on public.players;
drop policy if exists "players_update_coach" on public.players;

create policy "players_select_members"
  on public.players for select
  using (public.is_team_member(team_id));

create policy "players_insert_coach"
  on public.players for insert
  with check (public.is_team_coach(team_id));

create policy "players_update_coach"
  on public.players for update
  using (public.is_team_coach(team_id));

create policy "players_delete_coach"
  on public.players for delete
  using (public.is_team_coach(team_id));

-- ── Events RLS ────────────────────────────────────────────────
-- Ensure events policies exist (may have been missed earlier)
drop policy if exists "events_select_members" on public.events;
drop policy if exists "events_insert_coach" on public.events;
drop policy if exists "events_update_coach" on public.events;
drop policy if exists "events_delete_coach" on public.events;

create policy "events_select_members"
  on public.events for select
  using (public.is_team_member(team_id));

create policy "events_insert_coach"
  on public.events for insert
  with check (public.is_team_coach(team_id));

create policy "events_update_coach"
  on public.events for update
  using (public.is_team_coach(team_id));

create policy "events_delete_coach"
  on public.events for delete
  using (public.is_team_coach(team_id));