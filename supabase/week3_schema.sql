-- ============================================================
-- Week 3 Schema Additions
-- Run in Supabase SQL Editor as a new query
-- ============================================================

-- Add claim_code to players table for the player claim flow
alter table public.players
  add column if not exists claim_code text unique,
  add column if not exists claimed_at timestamptz;

-- Index for fast claim code lookups
create index if not exists idx_players_claim_code
  on public.players(claim_code)
  where claim_code is not null;

-- ── Announcements RLS ─────────────────────────────────────────
-- Ensure all announcement policies are correct

drop policy if exists "announcements_select_members"      on public.announcements;
drop policy if exists "announcements_insert_coach_or_player" on public.announcements;
drop policy if exists "announcements_update_author_or_coach" on public.announcements;
drop policy if exists "announcements_delete_author_or_coach" on public.announcements;

create policy "announcements_select_members"
  on public.announcements for select
  using (public.is_team_member(team_id));

create policy "announcements_insert_coach_or_player"
  on public.announcements for insert
  with check (
    public.is_coach_or_player(team_id)
    and author_id = auth.uid()
  );

create policy "announcements_update_author_or_coach"
  on public.announcements for update
  using (
    author_id = auth.uid()
    or public.is_team_coach(team_id)
  );

create policy "announcements_delete_author_or_coach"
  on public.announcements for delete
  using (
    author_id = auth.uid()
    or public.is_team_coach(team_id)
  );

-- ── Announcement comments RLS ─────────────────────────────────
drop policy if exists "ann_comments_select_members" on public.announcement_comments;
drop policy if exists "ann_comments_insert_members" on public.announcement_comments;
drop policy if exists "ann_comments_delete_author_or_coach" on public.announcement_comments;

create policy "ann_comments_select_members"
  on public.announcement_comments for select
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_id
        and public.is_team_member(a.team_id)
    )
  );

create policy "ann_comments_insert_members"
  on public.announcement_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.announcements a
      where a.id = announcement_id
        and public.is_team_member(a.team_id)
    )
  );

create policy "ann_comments_delete_author_or_coach"
  on public.announcement_comments for delete
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.announcements a
      join public.team_members tm on tm.team_id = a.team_id
      where a.id = announcement_id
        and tm.profile_id = auth.uid()
        and tm.role = 'coach'
    )
  );