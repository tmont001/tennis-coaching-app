'use client';
// components/layout/TeamSwitcher.tsx
// Dropdown showing all teams the user belongs to.
// Allows switching, creating a new team, or deleting the current one.

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown, Plus, Check, Trash2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal, ConfirmDialog } from '@/components/ui';
import { switchTeam, createTeam, deleteTeam } from '@/actions/teams';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field } from '@/components/ui';

export interface TeamOption {
  id: string;
  name: string;
  schoolName: string | null;
  role: 'coach' | 'player' | 'parent';
}

interface TeamSwitcherProps {
  currentTeamId: string;
  currentTeamName: string;
  allTeams: TeamOption[];
  isCreator: boolean;
  collapsed?: boolean; // true on mobile where we show compact view
}

export function TeamSwitcher({
  currentTeamId,
  currentTeamName,
  allTeams,
  isCreator,
  collapsed = false,
}: TeamSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [switching, startSwitch] = useTransition();
  const [deleteLoading, setDeleteLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSwitch(teamId: string) {
    if (teamId === currentTeamId) {
      setOpen(false);
      return;
    }
    setOpen(false);
    startSwitch(async () => {
      await switchTeam(teamId);
      // Stay on same route but reload with new team data
      router.refresh();
    });
  }

  async function handleDelete() {
    setDeleteLoading(true);
    const result = await deleteTeam(currentTeamId);
    setDeleteLoading(false);
    if (result.error) return;
    setShowDeleteDialog(false);
    router.push('/dashboard');
    router.refresh();
  }

  const canDelete = isCreator && allTeams.length > 1;
  const deleteNameMatches = deleteConfirmText === currentTeamName;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex items-center gap-2 w-full rounded-lg px-2 py-2 transition-colors hover:bg-gray-100',
          open && 'bg-gray-100',
        )}
      >
        {/* Team icon */}
        <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">
            {currentTeamName.charAt(0).toUpperCase()}
          </span>
        </div>

        {!collapsed && (
          <>
            <span className="flex-1 text-sm font-medium text-gray-900 truncate text-left">
              {currentTeamName}
            </span>
            {switching ? (
              <Loader2
                size={14}
                className="animate-spin text-gray-400 flex-shrink-0"
              />
            ) : (
              <ChevronDown
                size={14}
                className={clsx(
                  'text-gray-400 flex-shrink-0 transition-transform',
                  open && 'rotate-180',
                )}
              />
            )}
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Team list */}
          <div className="py-1">
            <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Your teams
            </p>
            {allTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => handleSwitch(team.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-md bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-700 text-xs font-bold">
                    {team.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {team.name}
                  </p>
                  {team.schoolName && (
                    <p className="text-xs text-gray-400 truncate">
                      {team.schoolName}
                    </p>
                  )}
                </div>
                {team.id === currentTeamId && (
                  <Check size={14} className="text-brand-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={() => {
                setOpen(false);
                setShowCreateModal(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Plus size={15} className="text-brand-600" />
              Create new team
            </button>

            {canDelete && (
              <button
                onClick={() => {
                  setOpen(false);
                  setShowDeleteDialog(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={15} />
                Delete {currentTeamName}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create team modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Team"
      >
        <CreateTeamForm
          onSuccess={(teamId) => {
            setShowCreateModal(false);
            router.refresh();
          }}
        />
      </Modal>

      {/* Delete team dialog — custom with type-to-confirm */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteDialog(false)}
          />
          <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              Delete this team?
            </h2>
            <p className="text-sm text-gray-600">
              This will permanently delete{' '}
              <span className="font-semibold">{currentTeamName}</span> and all
              its data — roster, matches, events, notes, and everything else.
              This cannot be undone.
            </p>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Type{' '}
                <span className="font-mono font-bold">{currentTeamName}</span>{' '}
                to confirm
              </label>
              <input
                type="text"
                className="input"
                placeholder={currentTeamName}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmText('');
                }}
                className="btn-secondary"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!deleteNameMatches || deleteLoading}
                className="btn-danger gap-2"
              >
                {deleteLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create team form ──────────────────────────────────────────
const createSchema = z.object({
  name: z.string().min(3, 'Team name must be at least 3 characters'),
  schoolName: z.string().optional(),
  seasonYear: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

function CreateTeamForm({
  onSuccess,
}: {
  onSuccess: (teamId: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) });

  async function onSubmit(values: CreateFormValues) {
    setServerError(null);
    const result = await createTeam({
      name: values.name,
      schoolName: values.schoolName || null,
      seasonYear: values.seasonYear ? parseInt(values.seasonYear) : null,
    });

    if (result.error) {
      setServerError(result.error);
      return;
    }
    onSuccess(result.data!.teamId);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {serverError}
        </div>
      )}

      <Field label="Team name" htmlFor="name" error={errors.name?.message}>
        <input
          id="name"
          type="text"
          className="input"
          placeholder="Lincoln HS Boys Varsity Tennis"
          {...register('name')}
        />
      </Field>

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

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Creating…
          </>
        ) : (
          'Create team'
        )}
      </button>
    </form>
  );
}
