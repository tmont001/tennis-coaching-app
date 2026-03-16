// lib/types/app.types.ts
// Application-level types that extend or compose database types.

export type TeamRole = 'coach' | 'player' | 'parent';
export type EventType = 'practice' | 'match' | 'meeting' | 'other';
export type BlockType = 'warmup' | 'drill' | 'game' | 'cooldown' | 'other';
export type ChallengeStatus =
  | 'pending'
  | 'accepted'
  | 'completed'
  | 'declined'
  | 'expired';
export type MatchResult = 'win' | 'loss' | 'tie' | 'cancelled' | 'pending';

// The current user's membership context for a team.
// This is loaded once after login and used throughout the app.
export interface TeamContext {
  teamId: string;
  teamName: string;
  role: TeamRole;
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
}

// A profile with their role on the current team.
// Used for roster views and member lists.
export interface TeamMemberWithProfile {
  id: string; // team_members.id
  role: TeamRole;
  jerseyNumber: number | null;
  joinedAt: string;
  profile: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    phone: string | null;
  };
  player: PlayerDetail | null; // null if role !== 'player'
}

export interface PlayerDetail {
  id: string;
  ladderRank: number | null;
  singlesRecordW: number;
  singlesRecordL: number;
  doublesRecordW: number;
  doublesRecordL: number;
  gradYear: number | null;
  notesPublic: string | null;
}

export interface EventWithPlan {
  id: string;
  title: string;
  description: string | null;
  eventType: EventType;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  isHome: boolean;
  opponentName: string | null;
  practicePlanId: string | null;
  createdBy: string;
}

export interface AnnouncementWithAuthor {
  id: string;
  title: string | null;
  body: string;
  imageUrl: string | null;
  pinned: boolean;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  commentCount: number;
}

export interface PracticePlanWithBlocks {
  id: string;
  title: string;
  notes: string | null;
  durationMin: number | null;
  createdAt: string;
  blocks: PracticeBlock[];
}

export interface PracticeBlock {
  id: string;
  blockType: BlockType;
  title: string;
  description: string | null;
  durationMin: number;
  sortOrder: number;
}

export interface ChallengeWithPlayers {
  id: string;
  status: ChallengeStatus;
  scheduledDate: string | null;
  score: string | null;
  createdAt: string;
  challenger: {
    id: string; // players.id
    ladderRank: number | null;
    profile: { fullName: string; avatarUrl: string | null };
  };
  challenged: {
    id: string;
    ladderRank: number | null;
    profile: { fullName: string; avatarUrl: string | null };
  };
  winner: {
    id: string;
    profile: { fullName: string };
  } | null;
}
