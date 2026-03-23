// app/(app)/roster/page.tsx
// Displays the full team roster. Coaches can add/import players.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RosterClient } from '@/components/roster/RosterClient';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Roster' };

export default async function RosterPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Get the user's team membership and role
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('team_id, role')
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (!membership) redirect('/onboarding');

  // Fetch all players with their profiles
  const { data: players } = await (supabase as any)
    .from('players')
    .select(
      `
      id,
      display_name,
      ladder_rank,
      singles_record_w,
      singles_record_l,
      doubles_record_w,
      doubles_record_l,
      grad_year,
      invited_email,
      notes_public,
      profile_id,
      profiles (
        id,
        full_name,
        avatar_url
      )
    `,
    )
    .eq('team_id', membership.team_id)
    .order('ladder_rank', { ascending: true, nullsFirst: false });

  // Fetch live W-L records AND sets from match_lines for all players on this team
  const { data: lineResults } = await (supabase as any)
    .from('match_lines')
    .select('player1_id, player2_id, result, line_type, sets_won, sets_lost')
    .eq('team_id', membership.team_id)
    .in('result', ['win', 'loss']);

  // Build a map of playerId -> record totals
  type PlayerRecord = {
    singlesW: number;
    singlesL: number;
    doublesW: number;
    doublesL: number;
    singlesSetsW: number;
    singlesSetsL: number;
    doublesSetsW: number;
    doublesSetsL: number;
  };
  const recordMap: Map<string, PlayerRecord> = new Map();

  function addResult(
    playerId: string | null,
    lineType: string,
    result: string,
    setsWon: number | null,
    setsLost: number | null,
  ) {
    if (!playerId) return;
    if (!recordMap.has(playerId)) {
      recordMap.set(playerId, {
        singlesW: 0,
        singlesL: 0,
        doublesW: 0,
        doublesL: 0,
        singlesSetsW: 0,
        singlesSetsL: 0,
        doublesSetsW: 0,
        doublesSetsL: 0,
      });
    }
    const r = recordMap.get(playerId)!;
    if (lineType === 'singles') {
      if (result === 'win') r.singlesW++;
      else r.singlesL++;
      r.singlesSetsW += setsWon ?? 0;
      r.singlesSetsL += setsLost ?? 0;
    } else {
      if (result === 'win') r.doublesW++;
      else r.doublesL++;
      r.doublesSetsW += setsWon ?? 0;
      r.doublesSetsL += setsLost ?? 0;
    }
  }

  for (const line of lineResults ?? []) {
    addResult(
      line.player1_id,
      line.line_type,
      line.result,
      line.sets_won,
      line.sets_lost,
    );
    addResult(
      line.player2_id,
      line.line_type,
      line.result,
      line.sets_won,
      line.sets_lost,
    );
  }

  // Merge live records into player objects
  const playersWithRecords = (players ?? []).map((p: any) => {
    const live = recordMap.get(p.id);
    return {
      ...p,
      singles_record_w: live?.singlesW ?? 0,
      singles_record_l: live?.singlesL ?? 0,
      doubles_record_w: live?.doublesW ?? 0,
      doubles_record_l: live?.doublesL ?? 0,
      singles_sets_won: live?.singlesSetsW ?? 0,
      singles_sets_lost: live?.singlesSetsL ?? 0,
      doubles_sets_won: live?.doublesSetsW ?? 0,
      doubles_sets_lost: live?.doublesSetsL ?? 0,
    };
  });

  return (
    <div>
      <RosterClient
        players={playersWithRecords}
        teamId={membership.team_id}
        isCoach={membership.role === 'coach'}
      />
    </div>
  );
}
