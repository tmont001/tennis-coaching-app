'use client';
// components/onboarding/OnboardingFlow.tsx
// Lets a new user either join an existing team (via invite code)
// or create a new team (coach flow).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { generateInviteCode, normalizeInviteCode } from '@/lib/utils/invite';
import { Loader2, Users, Plus } from 'lucide-react';

type Mode = 'choose' | 'join' | 'create';

// ── Join team schema ──────────────────────────────────────────
const joinSchema = z.object({
  inviteCode: z
    .string()
    .min(6, 'Invite code must be at least 6 characters')
    .transform(normalizeInviteCode),
  role: z.enum(['player', 'parent'], { message: 'Please select your role' }),
});
type JoinValues = z.infer<typeof joinSchema>;

// ── Create team schema ────────────────────────────────────────
const createSchema = z.object({
  teamName: z.string().min(3, 'Team name must be at least 3 characters'),
  schoolName: z.string().optional(),
  seasonYear: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
});
type CreateValues = z.infer<typeof createSchema>;

// ─────────────────────────────────────────────────────────────

export function OnboardingFlow({ userId }: { userId: string }) {
  const [mode, setMode] = useState<Mode>('choose');

  if (mode === 'choose') {
    return <ChooseMode onSelect={setMode} />;
  }
  if (mode === 'join') {
    return <JoinTeamForm onBack={() => setMode('choose')} userId={userId} />;
  }
  return <CreateTeamForm onBack={() => setMode('choose')} userId={userId} />;
}

// ── Choose mode ───────────────────────────────────────────────
function ChooseMode({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        How would you like to get started?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onSelect('join')}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 transition-colors text-left"
        >
          <Users className="text-brand-600" size={28} />
          <div>
            <div className="font-medium text-gray-900">Join a team</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Enter an invite code from your coach
            </div>
          </div>
        </button>
        <button
          onClick={() => onSelect('create')}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 transition-colors text-left"
        >
          <Plus className="text-brand-600" size={28} />
          <div>
            <div className="font-medium text-gray-900">Create a team</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Set up a new team as a coach
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Join team form ────────────────────────────────────────────
function JoinTeamForm({
  onBack,
  userId,
}: {
  onBack: () => void;
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinValues>({ resolver: zodResolver(joinSchema) });

  async function onSubmit(values: JoinValues) {
    setServerError(null);

    // Look up team by invite code
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('invite_code', values.inviteCode)
      .single();

    if (teamError || !team) {
      setServerError(
        'No team found with that invite code. Double-check with your coach.',
      );
      return;
    }

    const { error: memberError } = await supabase.from('team_members').insert({
      team_id: (team as { id: string; name: string }).id,
      profile_id: userId,
      role: values.role,
    } as never);

    if (memberError) {
      if (memberError.code === '23505') {
        setServerError('You are already a member of this team.');
      } else {
        setServerError('Failed to join the team. Please try again.');
      }
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Join a team</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {serverError}
          </div>
        )}

        <div>
          <label
            htmlFor="inviteCode"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Invite code
          </label>
          <input
            id="inviteCode"
            type="text"
            className="input uppercase tracking-widest"
            placeholder="e.g. TN4KX9BM"
            {...register('inviteCode')}
          />
          {errors.inviteCode && (
            <p className="mt-1 text-xs text-red-600">
              {errors.inviteCode.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            I am joining as a…
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['player', 'parent'] as const).map((role) => (
              <label
                key={role}
                className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-brand-400 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
              >
                <input
                  type="radio"
                  value={role}
                  className="accent-brand-600"
                  {...register('role')}
                />
                <span className="text-sm font-medium capitalize">{role}</span>
              </label>
            ))}
          </div>
          {errors.role && (
            <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>
          )}
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Joining…
            </>
          ) : (
            'Join team'
          )}
        </button>
      </form>
    </div>
  );
}

// ── Create team form ──────────────────────────────────────────
function CreateTeamForm({
  onBack,
  userId,
}: {
  onBack: () => void;
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(createSchema) });

  async function onSubmit(values: CreateValues) {
    setServerError(null);

    const inviteCode = generateInviteCode();

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: values.teamName,
        school_name: values.schoolName ?? null,
        season_year: values.seasonYear ?? null,
        invite_code: inviteCode,
        created_by: userId,
      } as never)
      .select('id')
      .single();

    if (teamError || !team) {
      setServerError('Failed to create team. Please try again.');
      return;
    }

    const { error: memberError } = await supabase.from('team_members').insert({
      team_id: (team as { id: string }).id,
      profile_id: userId,
      role: 'coach',
    } as never);

    if (memberError) {
      setServerError(
        'Team created but could not add you as coach. Please contact support.',
      );
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Create a team</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {serverError}
          </div>
        )}

        <div>
          <label
            htmlFor="teamName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Team name <span className="text-red-500">*</span>
          </label>
          <input
            id="teamName"
            type="text"
            className="input"
            placeholder="Lincoln HS Boys Varsity Tennis"
            {...register('teamName')}
          />
          {errors.teamName && (
            <p className="mt-1 text-xs text-red-600">
              {errors.teamName.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="schoolName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            School name{' '}
            <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <input
            id="schoolName"
            type="text"
            className="input"
            placeholder="Lincoln High School"
            {...register('schoolName')}
          />
        </div>

        <div>
          <label
            htmlFor="seasonYear"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Season year{' '}
            <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <input
            id="seasonYear"
            type="number"
            className="input"
            placeholder="2025"
            min={2020}
            max={2040}
            {...register('seasonYear')}
          />
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating team…
            </>
          ) : (
            'Create team'
          )}
        </button>
      </form>
    </div>
  );
}
