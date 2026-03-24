'use client';
// components/notes/NotesClient.tsx
// Lists all players. Each row expands to show private notes
// with add / edit / delete inline.

import { useState, useTransition } from 'react';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { PageHeader, EmptyState, ConfirmDialog } from '@/components/ui';
import { createNote, updateNote, deleteNote } from '@/actions/notes';

interface Player {
  id: string;
  display_name: string | null;
  ladder_rank: number | null;
  profile_id: string | null;
  profiles: { id: string; full_name: string; avatar_url: string | null } | null;
}

interface Note {
  id: string;
  player_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  profiles: { id: string; full_name: string } | null;
}

export function NotesClient({
  players,
  notes,
  teamId,
  currentCoachId,
}: {
  players: Player[];
  notes: Note[];
  teamId: string;
  currentCoachId: string;
}) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<Note[]>(notes);

  function getPlayerNotes(playerId: string) {
    return localNotes.filter((n) => n.player_id === playerId);
  }

  function getPlayerName(p: Player) {
    return p.profiles?.full_name ?? p.display_name ?? 'Unnamed Player';
  }

  function handleNoteAdded(note: Note) {
    setLocalNotes((prev) => [note, ...prev]);
  }

  function handleNoteUpdated(updated: Note) {
    setLocalNotes((prev) =>
      prev.map((n) => (n.id === updated.id ? updated : n)),
    );
  }

  function handleNoteDeleted(noteId: string) {
    setLocalNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Coach Notes"
        description="Private notes visible only to coaches"
      />

      {players.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No players yet"
          description="Add players to the roster to start taking notes."
        />
      ) : (
        <div className="space-y-2">
          {players.map((player) => {
            const playerNotes = getPlayerNotes(player.id);
            const isExpanded = expandedPlayer === player.id;
            const name = getPlayerName(player);
            const initials = name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div key={player.id} className="card overflow-hidden">
                {/* Player row */}
                <button
                  onClick={() =>
                    setExpandedPlayer(isExpanded ? null : player.id)
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Avatar */}
                  {player.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.profiles.avatar_url}
                      alt={name}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                      {initials}
                    </div>
                  )}

                  {/* Name + rank */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900">
                      {name}
                    </span>
                    {player.ladder_rank && (
                      <span className="text-xs text-gray-400 ml-2">
                        #{player.ladder_rank}
                      </span>
                    )}
                  </div>

                  {/* Note count + chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {playerNotes.length > 0 && (
                      <span className="text-xs bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 font-medium">
                        {playerNotes.length}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={15} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={15} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded notes */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 space-y-3">
                    {/* Existing notes */}
                    {playerNotes.length > 0 ? (
                      <div className="space-y-2">
                        {playerNotes.map((note) => (
                          <NoteRow
                            key={note.id}
                            note={note}
                            teamId={teamId}
                            currentCoachId={currentCoachId}
                            onUpdated={handleNoteUpdated}
                            onDeleted={handleNoteDeleted}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">
                        No notes yet for {name.split(' ')[0]}.
                      </p>
                    )}

                    {/* Add note */}
                    <AddNoteInline
                      playerId={player.id}
                      teamId={teamId}
                      onAdded={handleNoteAdded}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Individual note row ───────────────────────────────────────
function NoteRow({
  note,
  teamId,
  currentCoachId,
  onUpdated,
  onDeleted,
}: {
  note: Note;
  teamId: string;
  currentCoachId: string;
  onUpdated: (note: Note) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(note.body);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saving, startSave] = useTransition();
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleSave() {
    if (!editBody.trim()) return;
    startSave(async () => {
      const result = await updateNote(note.id, teamId, editBody.trim());
      if (!result.error) {
        onUpdated({ ...note, body: editBody.trim() });
        setEditing(false);
      }
    });
  }

  async function handleDelete() {
    setDeleteLoading(true);
    await deleteNote(note.id, teamId);
    setDeleteLoading(false);
    setShowDeleteDialog(false);
    onDeleted(note.id);
  }

  const timeAgo = formatDistanceToNow(parseISO(note.created_at), {
    addSuffix: true,
  });
  const authorName = note.profiles?.full_name ?? 'Coach';

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 group">
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={3}
            className="input resize-none text-sm"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setEditing(false);
                setEditBody(note.body);
              }}
              className="btn-secondary text-xs py-1"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary text-xs py-1 gap-1"
              disabled={saving || !editBody.trim()}
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {note.body}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {authorName} · {timeAgo}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(true)}
                className="p-1 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete this note?"
        description="This note will be permanently removed."
        confirmLabel="Delete note"
        confirmVariant="danger"
      />
    </div>
  );
}

// ── Add note inline ───────────────────────────────────────────
function AddNoteInline({
  playerId,
  teamId,
  onAdded,
}: {
  playerId: string;
  teamId: string;
  onAdded: (note: Note) => void;
}) {
  const [body, setBody] = useState('');
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!body.trim()) return;
    setError(null);
    startSave(async () => {
      const result = await createNote({ teamId, playerId, body: body.trim() });
      if (result.error) {
        setError(result.error);
        return;
      }
      // Create a local note object for optimistic display
      const newNote: Note = {
        id: result.data?.id ?? `temp-${Date.now()}`,
        player_id: playerId,
        body: body.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: null,
      };
      onAdded(newNote);
      setBody('');
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        className="input resize-none text-sm"
        placeholder="Add a private note…"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
        }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Cmd+Enter to save</span>
        <button
          onClick={handleSave}
          disabled={!body.trim() || saving}
          className="btn-primary text-xs py-1.5 gap-1.5"
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Plus size={12} />
          )}
          Add note
        </button>
      </div>
    </div>
  );
}
