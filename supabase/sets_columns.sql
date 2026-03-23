-- ============================================================
-- Add set score columns to match_lines
-- Run in Supabase SQL Editor as a new query
-- ============================================================

-- Add sets_won and sets_lost to match_lines
alter table public.match_lines
  add column if not exists sets_won  int check (sets_won >= 0),
  add column if not exists sets_lost int check (sets_lost >= 0);

-- Confirm match_lines upsert constraint exists on the right columns
-- (already created in lineup_schema.sql but safe to verify)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'match_lines'
      and constraint_name = 'match_lines_match_id_line_type_position_key'
  ) then
    alter table public.match_lines
      add constraint match_lines_match_id_line_type_position_key
      unique (match_id, line_type, position);
  end if;
end $$;