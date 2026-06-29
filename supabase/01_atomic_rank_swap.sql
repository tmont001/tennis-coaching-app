-- ============================================================
-- Atomic Rank Swap RPC
--
-- Replaces the two-step UPDATE + INSERT pattern in
-- actions/challenges.ts with a single transactional function.
--
-- Reads current ranks from the database (not from UI params),
-- swaps them, and inserts ladder_history rows — all atomically.
-- If any step fails the entire transaction rolls back.
--
-- Run in Supabase SQL Editor.
-- ============================================================

create or replace function public.swap_ladder_ranks(
  p_challenge_id uuid,
  p_team_id uuid,
  p_challenger_id uuid,
  p_challenged_id uuid,
  p_changed_by uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_challenger_rank int;
  v_challenged_rank int;
begin
  -- Verify the caller is a coach on this team
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and profile_id = p_changed_by
      and role = 'coach'
  ) then
    return jsonb_build_object('error', 'Only coaches can apply rank swaps');
  end if;

  -- Lock and read current ranks (FOR UPDATE prevents concurrent swaps)
  select ladder_rank into v_challenger_rank
    from public.players
    where id = p_challenger_id and team_id = p_team_id
    for update;

  if not found then
    return jsonb_build_object('error', 'Challenger not found on this team');
  end if;

  select ladder_rank into v_challenged_rank
    from public.players
    where id = p_challenged_id and team_id = p_team_id
    for update;

  if not found then
    return jsonb_build_object('error', 'Challenged player not found on this team');
  end if;

  if v_challenger_rank is null or v_challenged_rank is null then
    return jsonb_build_object('error', 'Both players must have a ladder rank');
  end if;

  -- Swap ranks
  update public.players
    set ladder_rank = v_challenged_rank
    where id = p_challenger_id and team_id = p_team_id;

  update public.players
    set ladder_rank = v_challenger_rank
    where id = p_challenged_id and team_id = p_team_id;

  -- Log both changes
  insert into public.ladder_history
    (team_id, player_id, old_rank, new_rank, reason, challenge_id, changed_by)
  values
    (p_team_id, p_challenger_id, v_challenger_rank, v_challenged_rank, 'challenge_result', p_challenge_id, p_changed_by),
    (p_team_id, p_challenged_id, v_challenged_rank, v_challenger_rank, 'challenge_result', p_challenge_id, p_changed_by);

  return jsonb_build_object('success', true);
end;
$$;
