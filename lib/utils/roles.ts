// lib/utils/roles.ts
// Helpers for checking role permissions throughout the app.

import type { TeamRole } from '@/lib/types/app.types';

export function isCoach(role: TeamRole): boolean {
  return role === 'coach';
}

export function isPlayer(role: TeamRole): boolean {
  return role === 'player';
}

export function isParent(role: TeamRole): boolean {
  return role === 'parent';
}

export function canPost(role: TeamRole): boolean {
  return role === 'coach' || role === 'player';
}

export function canManageEvents(role: TeamRole): boolean {
  return role === 'coach';
}

export function canManageRoster(role: TeamRole): boolean {
  return role === 'coach';
}

export function canViewCoachNotes(role: TeamRole): boolean {
  return role === 'coach';
}

export function canIssueChallenges(role: TeamRole): boolean {
  return role === 'coach' || role === 'player';
}

export function canLogMatchResults(role: TeamRole): boolean {
  return role === 'coach';
}

export function getRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    coach: 'Coach',
    player: 'Player',
    parent: 'Parent',
  };
  return labels[role];
}

export function getRoleBadgeColor(role: TeamRole): string {
  const colors: Record<TeamRole, string> = {
    coach: 'bg-brand-600 text-white',
    player: 'bg-blue-600 text-white',
    parent: 'bg-gray-500 text-white',
  };
  return colors[role];
}
