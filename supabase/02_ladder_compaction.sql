-- ============================================================
-- Ladder Rank Compaction Trigger
--
-- When a ranked player is deleted, decrements the ladder_rank
-- of all players on the same team who were ranked below
-- (higher rank number) the deleted player.
--
-- Example: deleting #2 from [1,2,3,4] produces [1,2,3].
--
-- Does NOT insert ladder_history rows — compaction is an
-- implicit side effect of deletion, not an explicit coach
-- action. Logging every affected player's rank shift on
-- delete would create noisy audit entries with no challenge_id
-- and no meaningful changed_by (the delete might cascade from
-- a team deletion). The audit trail for the delete itself is
-- the players row disappearing.
--
-- Run in Supabase SQL Editor.
-- ============================================================

create or replace function public.compact_ladder_ranks()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.ladder_rank is not null then
    update public.players
      set ladder_rank = ladder_rank - 1
      where team_id = old.team_id
        and ladder_rank > old.ladder_rank;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_players_compact_ranks on public.players;

create trigger trg_players_compact_ranks
  after delete on public.players
  for each row
  execute function public.compact_ladder_ranks();
