-- ============================================================
-- Tennis Coaching App — MVP Schema
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension (enabled by default in Supabase, but just in case)
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- One row per authenticated user. Created via trigger on signup.
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- TEAMS
-- A team belongs to a school or organization.
-- For MVP we keep org simple — just a name on the team.
-- ============================================================
create table public.teams (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,                -- e.g. "Lincoln HS Boys Varsity Tennis"
  school_name  text,
  sport        text not null default 'tennis',
  season_year  int,                          -- e.g. 2025
  invite_code  text unique not null,         -- short code coaches share to let people join
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- TEAM MEMBERS
-- Connects a profile to a team with a role.
-- A user can be on multiple teams (coach on one, parent on another).
-- ============================================================
create type public.team_role as enum ('coach', 'player', 'parent');

create table public.team_members (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role       public.team_role not null,
  jersey_number int,                        -- relevant for players
  joined_at  timestamptz not null default now(),
  unique (team_id, profile_id)              -- one membership per team per user
);

create index idx_team_members_team_id    on public.team_members(team_id);
create index idx_team_members_profile_id on public.team_members(profile_id);

-- ============================================================
-- PLAYERS
-- Extended player-specific data. One row per player member.
-- Linked to the team_members row, not directly to profile,
-- so player data is team-scoped.
-- ============================================================
create table public.players (
  id               uuid primary key default uuid_generate_v4(),
  team_member_id   uuid not null unique references public.team_members(id) on delete cascade,
  team_id          uuid not null references public.teams(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  ladder_rank      int,                     -- current challenge ladder position
  singles_record_w int not null default 0,
  singles_record_l int not null default 0,
  doubles_record_w int not null default 0,
  doubles_record_l int not null default 0,
  grad_year        int,
  notes_public     text,                   -- bio visible to team
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_players_team_id on public.players(team_id);

-- ============================================================
-- EVENTS (Calendar)
-- Practices, matches, meetings, and other events.
-- ============================================================
create type public.event_type as enum ('practice', 'match', 'meeting', 'other');

create table public.events (
  id             uuid primary key default uuid_generate_v4(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  created_by     uuid not null references public.profiles(id),
  title          text not null,
  description    text,
  event_type     public.event_type not null default 'other',
  location       text,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  is_home        boolean default true,      -- for matches: home or away
  opponent_name  text,                      -- for matches
  practice_plan_id uuid,                    -- linked after practice plans table exists (FK added below)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_events_team_id   on public.events(team_id);
create index idx_events_starts_at on public.events(starts_at);

-- ============================================================
-- ANNOUNCEMENTS (Feed)
-- Posts by coaches or players. Parents can comment but not post.
-- ============================================================
create table public.announcements (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  author_id   uuid not null references public.profiles(id),
  title       text,
  body        text not null,
  image_url   text,                         -- single image for MVP
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_announcements_team_id    on public.announcements(team_id);
create index idx_announcements_created_at on public.announcements(created_at desc);

-- ============================================================
-- ANNOUNCEMENT COMMENTS
-- ============================================================
create table public.announcement_comments (
  id               uuid primary key default uuid_generate_v4(),
  announcement_id  uuid not null references public.announcements(id) on delete cascade,
  author_id        uuid not null references public.profiles(id),
  body             text not null,
  created_at       timestamptz not null default now()
);

create index idx_announcement_comments_ann_id on public.announcement_comments(announcement_id);

-- ============================================================
-- MATCHES
-- Coach logs results. Linked to an event optionally.
-- ============================================================
create type public.match_result as enum ('win', 'loss', 'tie', 'cancelled', 'pending');

create table public.matches (
  id              uuid primary key default uuid_generate_v4(),
  team_id         uuid not null references public.teams(id) on delete cascade,
  event_id        uuid references public.events(id) on delete set null,
  opponent_name   text not null,
  match_date      date not null,
  is_home         boolean default true,
  our_score       int,
  opponent_score  int,
  result          public.match_result not null default 'pending',
  notes           text,                    -- coach notes on the match (not private)
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_matches_team_id    on public.matches(team_id);
create index idx_matches_match_date on public.matches(match_date desc);

-- ============================================================
-- PRACTICE PLANS
-- Coach-created plans with ordered blocks.
-- ============================================================
create table public.practice_plans (
  id           uuid primary key default uuid_generate_v4(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  created_by   uuid not null references public.profiles(id),
  title        text not null,
  notes        text,
  duration_min int,                         -- total planned duration in minutes
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_practice_plans_team_id on public.practice_plans(team_id);

-- Now we can add the FK from events to practice_plans
alter table public.events
  add constraint fk_events_practice_plan
  foreign key (practice_plan_id)
  references public.practice_plans(id)
  on delete set null;

-- ============================================================
-- PRACTICE PLAN BLOCKS
-- Ordered sections within a practice plan.
-- ============================================================
create type public.block_type as enum ('warmup', 'drill', 'game', 'cooldown', 'other');

create table public.practice_plan_blocks (
  id               uuid primary key default uuid_generate_v4(),
  practice_plan_id uuid not null references public.practice_plans(id) on delete cascade,
  block_type       public.block_type not null,
  title            text not null,
  description      text,
  duration_min     int not null default 10,
  sort_order       int not null default 0,  -- controls display order
  created_at       timestamptz not null default now()
);

create index idx_ppb_plan_id on public.practice_plan_blocks(practice_plan_id);

-- ============================================================
-- CHALLENGE LADDER
-- Players challenge others ranked above them.
-- Coach records results and updates ranks.
-- ============================================================
create type public.challenge_status as enum ('pending', 'accepted', 'completed', 'declined', 'expired');

create table public.challenges (
  id              uuid primary key default uuid_generate_v4(),
  team_id         uuid not null references public.teams(id) on delete cascade,
  challenger_id   uuid not null references public.players(id),  -- player issuing challenge
  challenged_id   uuid not null references public.players(id),  -- player being challenged
  status          public.challenge_status not null default 'pending',
  scheduled_date  date,
  winner_id       uuid references public.players(id),           -- set when completed
  score           text,                                          -- e.g. "6-3, 7-5"
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- prevent self-challenges
  check (challenger_id != challenged_id)
);

create index idx_challenges_team_id       on public.challenges(team_id);
create index idx_challenges_challenger_id on public.challenges(challenger_id);
create index idx_challenges_challenged_id on public.challenges(challenged_id);

-- ============================================================
-- COACH NOTES
-- Private notes per player, visible to coaches only.
-- RLS will enforce this — not just application logic.
-- ============================================================
create table public.coach_notes (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  author_id   uuid not null references public.profiles(id),     -- coach who wrote it
  player_id   uuid not null references public.players(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_coach_notes_team_id   on public.coach_notes(team_id);
create index idx_coach_notes_player_id on public.coach_notes(player_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- Auto-updates updated_at on any row change.
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to all tables with updated_at
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trg_teams_updated_at
  before update on public.teams
  for each row execute function public.handle_updated_at();

create trigger trg_players_updated_at
  before update on public.players
  for each row execute function public.handle_updated_at();

create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.handle_updated_at();

create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function public.handle_updated_at();

create trigger trg_matches_updated_at
  before update on public.matches
  for each row execute function public.handle_updated_at();

create trigger trg_practice_plans_updated_at
  before update on public.practice_plans
  for each row execute function public.handle_updated_at();

create trigger trg_challenges_updated_at
  before update on public.challenges
  for each row execute function public.handle_updated_at();

create trigger trg_coach_notes_updated_at
  before update on public.coach_notes
  for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- Supabase calls this when a new user signs up.
-- The user's full_name comes from auth.users raw_user_meta_data.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();