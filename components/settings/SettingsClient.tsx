'use client';
// components/settings/SettingsClient.tsx
// Team settings — team info, lineup format, invite code, members.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Loader2,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { PageHeader, Field, ConfirmDialog, Badge } from '@/components/ui';
import {
  updateTeamSettings,
  removeTeamMember,
  regenerateInviteCode,
} from '@/actions/match_lines';

// ── Types ─────────────────────────────────────────────────────
interface Team {
  id: string;
  name: string;
  school_name: string | null;
  season_year: number | null;
  invite_code: string;
  singles_count: number;
  doubles_count: number;
}

interface Member {
  id: string;
  role: 'coach' | 'player' | 'parent';
  joined_at: string;
  profiles: { id: string; full_name: string; avatar_url: string | null } | null;
}

// ── Form schema ───────────────────────────────────────────────
const settingsSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  schoolName: z.string().optional(),
  seasonYear: z.string().optional(),
  singlesCount: z.string().min(1),
  doublesCount: z.string().min(1),
});

type FormValues = z.infer<typeof settingsSchema>;

// ── Main component ────────────────────────────────────────────
export function SettingsClient({
  team,
  members,
  currentUserId,
  isCoach,
}: {
  team: Team;
  members: Member[];
  currentUserId: string;
  isCoach: boolean;
}) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState(team.invite_code);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [regenerating, startRegenerate] = useTransition();
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: team.name,
      schoolName: team.school_name ?? '',
      seasonYear: team.season_year?.toString() ?? '',
      singlesCount: String(team.singles_count),
      doublesCount: String(team.doubles_count),
    },
  });

  async function onSubmit(values: FormValues) {
    setSaveError(null);
    setSaveSuccess(false);
    const result = await updateTeamSettings({
      teamId: team.id,
      name: values.name,
      schoolName: values.schoolName || null,
      seasonYear: values.seasonYear ? parseInt(values.seasonYear) : null,
      singlesCount: parseInt(values.singlesCount),
      doublesCount: parseInt(values.doublesCount),
    });
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
    router.refresh();
  }

  function handleCopyInviteCode() {
    navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function handleCopyInviteLink() {
    const url = `${window.location.origin}/onboarding?code=${inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRegenerate() {
    startRegenerate(async () => {
      const result = await regenerateInviteCode(team.id);
      if (result.data?.inviteCode) {
        setInviteCode(result.data.inviteCode);
      }
    });
  }

  async function handleRemoveMember() {
    if (!removingMember) return;
    setRemoveLoading(true);
    await removeTeamMember(removingMember.id, team.id);
    setRemoveLoading(false);
    setRemovingMember(null);
    router.refresh();
  }

  const coaches = members.filter((m) => m.role === 'coach');
  const players = members.filter((m) => m.role === 'player');
  const parents = members.filter((m) => m.role === 'parent');

  const ROLE_CONFIG = {
    coach: { label: 'Coach', variant: 'green' as const, icon: Shield },
    player: { label: 'Player', variant: 'blue' as const, icon: User },
    parent: { label: 'Parent', variant: 'gray' as const, icon: Users },
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Team Settings" />

      {/* ── Team info ────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Team Information
        </h2>

        {isCoach ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {saveError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {saveError}
              </div>
            )}

            <Field
              label="Team name"
              htmlFor="name"
              error={errors.name?.message}
            >
              <input
                id="name"
                type="text"
                className="input"
                {...register('name')}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="School name" htmlFor="schoolName" optional>
                <input
                  id="schoolName"
                  type="text"
                  className="input"
                  placeholder="Lincoln High School"
                  {...register('schoolName')}
                />
              </Field>
              <Field label="Season year" htmlFor="seasonYear" optional>
                <input
                  id="seasonYear"
                  type="number"
                  className="input"
                  placeholder="2025"
                  min={2020}
                  max={2040}
                  {...register('seasonYear')}
                />
              </Field>
            </div>

            {/* Lineup format */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Lineup format
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Controls how many singles and doubles slots appear on each match
                lineup.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Singles positions"
                  htmlFor="singlesCount"
                  error={errors.singlesCount?.message}
                >
                  <input
                    id="singlesCount"
                    type="number"
                    className="input"
                    min={1}
                    max={10}
                    {...register('singlesCount')}
                  />
                </Field>
                <Field
                  label="Doubles positions"
                  htmlFor="doublesCount"
                  error={errors.doublesCount?.message}
                >
                  <input
                    id="doublesCount"
                    type="number"
                    className="input"
                    min={1}
                    max={10}
                    {...register('doublesCount')}
                  />
                </Field>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Example: NYS is typically 3 singles + 4 doubles. Small school
                playoffs may use 2 + 3.
              </p>
            </div>

            <button
              type="submit"
              className="btn-primary gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving…
                </>
              ) : saveSuccess ? (
                <>
                  <Check size={15} />
                  Saved!
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </form>
        ) : (
          // Read-only view for non-coaches
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Team name</span>
              <span className="text-gray-900 font-medium">{team.name}</span>
            </div>
            {team.school_name && (
              <div className="flex justify-between">
                <span className="text-gray-500">School</span>
                <span className="text-gray-900">{team.school_name}</span>
              </div>
            )}
            {team.season_year && (
              <div className="flex justify-between">
                <span className="text-gray-500">Season</span>
                <span className="text-gray-900">{team.season_year}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Lineup format</span>
              <span className="text-gray-900">
                {team.singles_count}S / {team.doubles_count}D
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Invite code ──────────────────────────────────────── */}
      {isCoach && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Invite Code
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Share this code with players and parents so they can join your team.
          </p>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-xl font-bold tracking-[0.3em] text-center text-gray-800">
              {inviteCode}
            </div>
            <button
              onClick={handleCopyInviteCode}
              className="btn-secondary p-3 flex-shrink-0"
              title="Copy code"
            >
              {codeCopied ? (
                <Check size={15} className="text-green-500" />
              ) : (
                <Copy size={15} />
              )}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="btn-secondary p-3 flex-shrink-0"
              title="Generate new code"
            >
              <RefreshCw
                size={15}
                className={regenerating ? 'animate-spin' : ''}
              />
            </button>
          </div>

          <button
            onClick={handleCopyInviteLink}
            className="btn-secondary w-full gap-2 text-sm"
          >
            {copied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} />
            )}
            {copied ? 'Link copied!' : 'Copy invite link'}
          </button>

          <p className="text-xs text-gray-400 mt-2 text-center">
            Invite link sends people directly to the join page with the code
            pre-filled.
          </p>
        </div>
      )}

      {/* ── Team members ─────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Users size={14} />
          Team Members
          <span className="text-gray-400 font-normal">({members.length})</span>
        </h2>

        <div className="space-y-4">
          {[
            { label: 'Coaches', group: coaches },
            { label: 'Players', group: players },
            { label: 'Parents', group: parents },
          ]
            .filter(({ group }) => group.length > 0)
            .map(({ label, group }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">
                  {label} ({group.length})
                </p>
                <div className="space-y-1">
                  {group.map((member) => {
                    const name = member.profiles?.full_name ?? 'Unknown';
                    const isCurrentUser = member.profiles?.id === currentUserId;
                    const config = ROLE_CONFIG[member.role];
                    const initials = name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 py-2 px-1 group rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {/* Avatar */}
                        {member.profiles?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.profiles.avatar_url}
                            alt={name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                            {initials}
                          </div>
                        )}

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-900 font-medium truncate">
                            {name}
                            {isCurrentUser && (
                              <span className="text-xs text-gray-400 font-normal ml-1">
                                (you)
                              </span>
                            )}
                          </span>
                          <p className="text-xs text-gray-400">
                            Joined{' '}
                            {format(parseISO(member.joined_at), 'MMM d, yyyy')}
                          </p>
                        </div>

                        <Badge variant={config.variant}>{config.label}</Badge>

                        {/* Remove button — coaches only, can't remove themselves */}
                        {isCoach && !isCurrentUser && (
                          <button
                            onClick={() => setRemovingMember(member)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
                            title="Remove member"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Remove member confirm */}
      <ConfirmDialog
        open={!!removingMember}
        onClose={() => setRemovingMember(null)}
        onConfirm={handleRemoveMember}
        loading={removeLoading}
        title="Remove this member?"
        description={`${removingMember?.profiles?.full_name ?? 'This person'} will be removed from the team and lose access immediately.`}
        confirmLabel="Remove member"
        confirmVariant="danger"
      />
    </div>
  );
}
