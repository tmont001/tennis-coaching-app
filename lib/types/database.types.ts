export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          avatar_url?: string | null;
          phone?: string | null;
        };
        Update: {
          full_name?: string;
          avatar_url?: string | null;
          phone?: string | null;
        };
      };
      teams: {
        Row: {
          id: string;
          name: string;
          school_name: string | null;
          sport: string;
          season_year: number | null;
          invite_code: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          school_name?: string | null;
          sport?: string;
          season_year?: number | null;
          invite_code: string;
          created_by: string;
        };
        Update: {
          name?: string;
          school_name?: string | null;
          season_year?: number | null;
        };
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          profile_id: string;
          role: "coach" | "player" | "parent";
          jersey_number: number | null;
          joined_at: string;
        };
        Insert: {
          team_id: string;
          profile_id: string;
          role: "coach" | "player" | "parent";
          jersey_number?: number | null;
        };
        Update: {
          role?: "coach" | "player" | "parent";
          jersey_number?: number | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_team_member: {
        Args: { p_team_id: string };
        Returns: boolean;
      };
      is_team_coach: {
        Args: { p_team_id: string };
        Returns: boolean;
      };
      is_coach_or_player: {
        Args: { p_team_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      team_role: "coach" | "player" | "parent";
      event_type: "practice" | "match" | "meeting" | "other";
      block_type: "warmup" | "drill" | "game" | "cooldown" | "other";
      challenge_status: "pending" | "accepted" | "completed" | "declined" | "expired";
      match_result: "win" | "loss" | "tie" | "cancelled" | "pending";
    };
  };
}