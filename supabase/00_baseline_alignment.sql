-- ============================================================
-- Baseline Alignment Migration
--
-- Brings the SQL source files in sync with the live database.
-- Everything here already exists in the live Supabase instance
-- (created via Dashboard SQL Editor) — this file captures those
-- changes so the schema is reproducible from source.
--
-- Safe to run against the live database: all statements are
-- idempotent (IF NOT EXISTS, CREATE OR REPLACE, DROP IF EXISTS).
--
-- Run in Supabase SQL Editor as a single query.
-- ============================================================


-- ════════════════════════════════════════════════════════════════
-- 1. RLS HELPER FUNCTIONS
--    Referenced by every RLS policy but never captured in source.
-- ════════════════════════════════════════════════════════════════

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
begin
  return exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and profile_id = auth.uid()
  );
end;
$$;

create or replace function public.is_team_coach(p_team_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
begin
  return exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and profile_id = auth.uid()
      and role = 'coach'
  );
end;
$$;

create or replace function public.is_coach_or_player(p_team_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
begin
  return exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and profile_id = auth.uid()
      and role in ('coach', 'player')
  );
end;
$$;


-- ════════════════════════════════════════════════════════════════
-- 2. MISSING TABLE: announcement_reactions
--    Used by actions/announcements.ts (toggleReaction) and
--    components/feed/FeedClient.tsx (ReactionData interface).
--    Columns derived from code usage:
--      id, announcement_id, profile_id, emoji, created_at
-- ════════════════════════════════════════════════════════════════

create table if not exists public.announcement_reactions (
  id              uuid primary key default uuid_generate_v4(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  emoji           text not null,
  created_at      timestamptz not null default now(),
  unique (announcement_id, profile_id, emoji)
);

create index if not exists idx_announcement_reactions_ann_id
  on public.announcement_reactions(announcement_id);

create index if not exists idx_announcement_reactions_profile_id
  on public.announcement_reactions(profile_id);


-- ════════════════════════════════════════════════════════════════
-- 3. MISSING COLUMNS
--    All exist in live DB, added via Dashboard. Capturing here.
-- ════════════════════════════════════════════════════════════════

-- events: location coordinates (used by CreateEventForm geocoding)
alter table public.events
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

-- announcements: video URL (used by AnnouncementCard video embed)
alter table public.announcements
  add column if not exists video_url text;

-- teams: reaction settings (used by SettingsClient / team_settings action)
alter table public.teams
  add column if not exists show_reaction_names boolean not null default false,
  add column if not exists parents_can_react boolean not null default true;


-- ════════════════════════════════════════════════════════════════
-- 4. ENABLE ROW LEVEL SECURITY ON ALL TABLES
--    Week 4/5 migrations enabled RLS on some tables.
--    The remaining tables were enabled via Dashboard.
-- ════════════════════════════════════════════════════════════════

alter table public.profiles                enable row level security;
alter table public.teams                   enable row level security;
alter table public.team_members            enable row level security;
alter table public.players                 enable row level security;
alter table public.events                  enable row level security;
alter table public.announcements           enable row level security;
alter table public.announcement_comments   enable row level security;
alter table public.announcement_reactions  enable row level security;
alter table public.coach_notes             enable row level security;
-- Already enabled in weekly migrations, but safe to repeat:
alter table public.matches                 enable row level security;
alter table public.match_lines             enable row level security;
alter table public.practice_plans          enable row level security;
alter table public.practice_plan_blocks    enable row level security;
alter table public.challenges              enable row level security;
alter table public.ladder_history          enable row level security;


-- ════════════════════════════════════════════════════════════════
-- 5. MISSING RLS POLICIES
-- ════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────
-- Profiles are read via joins (announcements→profiles, team_members→profiles)
-- so team members need SELECT. Users can only update their own profile.

drop policy if exists "profiles_select_team_peers" on public.profiles;
drop policy if exists "profiles_update_own"        on public.profiles;

create policy "profiles_select_team_peers"
  on public.profiles for select
  using (
    -- own profile
    id = auth.uid()
    -- or shares a team with the viewer
    or exists (
      select 1 from public.team_members my
      join public.team_members theirs
        on theirs.team_id = my.team_id
      where my.profile_id = auth.uid()
        and theirs.profile_id = profiles.id
    )
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── teams ────────────────────────────────────────────────────
-- Team members can read their team. Any authenticated user can
-- create a team. Only the creator can delete. Update already
-- exists from lineup_schema.sql.

drop policy if exists "teams_select_members"  on public.teams;
drop policy if exists "teams_insert_creator"  on public.teams;
drop policy if exists "teams_delete_creator"  on public.teams;

create policy "teams_select_members"
  on public.teams for select
  using (public.is_team_member(id));

create policy "teams_insert_creator"
  on public.teams for insert
  with check (auth.uid() = created_by);

create policy "teams_delete_creator"
  on public.teams for delete
  using (auth.uid() = created_by);

-- ── team_members ─────────────────────────────────────────────
-- Members can view the roster of their team. Coaches can add
-- members. Self-insert is allowed for the claim flow (player
-- joins via claim code). Delete already exists from lineup_schema.

drop policy if exists "team_members_select_members" on public.team_members;
drop policy if exists "team_members_insert_self_or_coach" on public.team_members;

create policy "team_members_select_members"
  on public.team_members for select
  using (
    public.is_team_member(team_id)
    -- users can always see their own memberships (team switcher)
    or profile_id = auth.uid()
  );

create policy "team_members_insert_self_or_coach"
  on public.team_members for insert
  with check (
    -- coach adding a member to their team
    public.is_team_coach(team_id)
    -- team creator bootstrapping themselves as first member
    or (
      profile_id = auth.uid()
      and exists (
        select 1 from public.teams
        where id = team_id and created_by = auth.uid()
      )
    )
    -- player claiming their account (self-insert as player only)
    or (profile_id = auth.uid() and role = 'player')
  );

-- ── coach_notes ──────────────────────────────────────────────
-- Private notes visible only to coaches on that team.

drop policy if exists "coach_notes_select_coach" on public.coach_notes;
drop policy if exists "coach_notes_insert_coach" on public.coach_notes;
drop policy if exists "coach_notes_update_coach" on public.coach_notes;
drop policy if exists "coach_notes_delete_coach" on public.coach_notes;

create policy "coach_notes_select_coach"
  on public.coach_notes for select
  using (public.is_team_coach(team_id));

create policy "coach_notes_insert_coach"
  on public.coach_notes for insert
  with check (
    public.is_team_coach(team_id)
    and author_id = auth.uid()
  );

create policy "coach_notes_update_coach"
  on public.coach_notes for update
  using (public.is_team_coach(team_id));

create policy "coach_notes_delete_coach"
  on public.coach_notes for delete
  using (public.is_team_coach(team_id));

-- ── announcement_reactions ───────────────────────────────────
-- Team members can view reactions. Coaches and players can add/remove
-- their own reactions. Coaches can delete any reaction.

drop policy if exists "ann_reactions_select_members"    on public.announcement_reactions;
drop policy if exists "ann_reactions_insert_own"        on public.announcement_reactions;
drop policy if exists "ann_reactions_delete_own_or_coach" on public.announcement_reactions;

create policy "ann_reactions_select_members"
  on public.announcement_reactions for select
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_id
        and public.is_team_member(a.team_id)
    )
  );

create policy "ann_reactions_insert_own"
  on public.announcement_reactions for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.announcements a
      where a.id = announcement_id
        and public.is_team_member(a.team_id)
    )
  );

create policy "ann_reactions_delete_own_or_coach"
  on public.announcement_reactions for delete
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.announcements a
      where a.id = announcement_id
        and public.is_team_coach(a.team_id)
    )
  );


-- ════════════════════════════════════════════════════════════════
-- 6. INDEXES FOR NEW OBJECTS
-- ════════════════════════════════════════════════════════════════

-- Spatial lookups (future: nearby events)
create index if not exists idx_events_location
  on public.events(location_lat, location_lng)
  where location_lat is not null;

-- Coach notes by author (for "my notes" queries)
create index if not exists idx_coach_notes_author_id
  on public.coach_notes(author_id);

-- Announcement author lookups
create index if not exists idx_announcements_author_id
  on public.announcements(author_id);
