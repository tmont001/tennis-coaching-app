'use client';
// components/roster/PlayerProfileClient.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit2,
  Trophy,
  TrendingUp,
  QrCode,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Badge, Modal } from '@/components/ui';
import { EditPlayerForm } from '@/components/roster/EditPlayerForm';
import { generateClaimCode } from '@/actions/claim';

interface Player {
  id: string;
  display_name: string | null;
  ladder_rank: number | null;
  singles_record_w: number;
  singles_record_l: number;
  doubles_record_w: number;
  doubles_record_l: number;
  singles_sets_won?: number;
  singles_sets_lost?: number;
  doubles_sets_won?: number;
  doubles_sets_lost?: number;
  grad_year: number | null;
  invited_email: string | null;
  notes_public: string | null;
  profile_id: string | null;
  team_id: string;
  claim_code: string | null;
  claimed_at: string | null;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
  } | null;
}

export function PlayerProfileClient({
  player,
  isCoach,
  teamId,
}: {
  player: Player;
  isCoach: boolean;
  teamId: string;
}) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentClaimCode, setCurrentClaimCode] = useState(player.claim_code);
  const [generatingCode, setGeneratingCode] = useState(false);

  const name =
    player.profiles?.full_name ?? player.display_name ?? 'Unnamed Player';
  const avatarUrl = player.profiles?.avatar_url ?? null;
  const isClaimed = player.profile_id !== null;

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const singlesTotal = player.singles_record_w + player.singles_record_l;
  const singlesWinPct =
    singlesTotal > 0
      ? Math.round((player.singles_record_w / singlesTotal) * 100)
      : null;

  const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/claim?code=${currentClaimCode}`;

  async function handleCopy() {
    if (!currentClaimCode) return;
    await navigator.clipboard.writeText(currentClaimCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerateCode() {
    setGeneratingCode(true);
    const result = await generateClaimCode(player.id, teamId);
    setGeneratingCode(false);
    if (result.data?.claimCode) {
      setCurrentClaimCode(result.data.claimCode);
    }
  }

  return (
    <div className="space-y-5 max-w-lg">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Roster
      </button>

      {/* Profile header card */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 text-xl font-bold flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {player.ladder_rank !== null && (
                  <span className="text-sm font-semibold text-brand-600 flex items-center gap-1">
                    <Trophy size={13} />
                    Rank #{player.ladder_rank}
                  </span>
                )}
                {player.grad_year && (
                  <span className="text-sm text-gray-500">
                    Class of {player.grad_year}
                  </span>
                )}
                {!isClaimed && isCoach && (
                  <Badge variant="yellow">Unclaimed</Badge>
                )}
                {isClaimed && <Badge variant="green">Account linked</Badge>}
              </div>
            </div>
          </div>

          {isCoach && (
            <button
              onClick={() => setShowEditModal(true)}
              className="btn-secondary p-2 flex-shrink-0"
            >
              <Edit2 size={15} />
            </button>
          )}
        </div>

        {/* Contact info — coach only */}
        {isCoach && (player.invited_email || player.profiles?.phone) && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
            {player.invited_email && (
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">Email: </span>
                {player.invited_email}
              </p>
            )}
            {player.profiles?.phone && (
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">Phone: </span>
                {player.profiles.phone}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Claim code card — coach only, unclaimed players */}
      {isCoach && !isClaimed && (
        <div className="card p-5 border-yellow-200 bg-yellow-50/50">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Player Claim Code
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Share this code with {name.split(' ')[0]} so they can link their
                account.
              </p>
            </div>
            <button
              onClick={() => setShowQrModal(true)}
              className="btn-secondary p-2 flex-shrink-0"
              title="Show QR code"
            >
              <QrCode size={15} />
            </button>
          </div>

          {currentClaimCode ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-3 font-mono text-xl font-bold tracking-[0.3em] text-center text-gray-800">
                {currentClaimCode}
              </div>
              <button
                onClick={handleCopy}
                className="btn-secondary p-3 flex-shrink-0"
                title="Copy code"
              >
                {copied ? (
                  <Check size={15} className="text-green-500" />
                ) : (
                  <Copy size={15} />
                )}
              </button>
              <button
                onClick={handleRegenerateCode}
                disabled={generatingCode}
                className="btn-secondary p-3 flex-shrink-0"
                title="Generate new code"
              >
                <RefreshCw
                  size={15}
                  className={generatingCode ? 'animate-spin' : ''}
                />
              </button>
            </div>
          ) : (
            <button
              onClick={handleRegenerateCode}
              disabled={generatingCode}
              className="btn-primary w-full"
            >
              Generate claim code
            </button>
          )}

          <p className="text-xs text-gray-400 mt-2 text-center">
            Player visits <span className="font-mono">courtside.app/claim</span>{' '}
            and enters this code
          </p>
        </div>
      )}

      {/* Stats card */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <TrendingUp size={15} />
          Season Record
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="text-2xl font-bold text-gray-900">
              {player.singles_record_w}–{player.singles_record_l}
            </div>
            <div className="text-xs text-gray-500 mt-1">Singles</div>
            {singlesWinPct !== null && (
              <div className="text-xs text-brand-600 font-medium mt-0.5">
                {singlesWinPct}% win rate
              </div>
            )}
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="text-2xl font-bold text-gray-900">
              {player.doubles_record_w}–{player.doubles_record_l}
            </div>
            <div className="text-xs text-gray-500 mt-1">Doubles</div>
          </div>
        </div>
      </div>

      {/* Bio */}
      {player.notes_public && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">About</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {player.notes_public}
          </p>
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Player"
      >
        <EditPlayerForm
          player={player}
          teamId={teamId}
          onSuccess={() => setShowEditModal(false)}
        />
      </Modal>

      {/* QR code modal */}
      {currentClaimCode && (
        <Modal
          open={showQrModal}
          onClose={() => setShowQrModal(false)}
          title="Claim QR Code"
          maxWidth="sm"
        >
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-sm text-gray-500 text-center">
              Have {name.split(' ')[0]} scan this QR code to claim their
              profile.
            </p>
            {/* QR code via free API — no package needed */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(claimUrl)}`}
              alt="Claim QR Code"
              className="w-48 h-48 rounded-xl border border-gray-200"
            />
            <div className="text-center">
              <div className="font-mono text-2xl font-bold tracking-[0.3em] text-gray-800">
                {currentClaimCode}
              </div>
              <p className="text-xs text-gray-400 mt-1">{claimUrl}</p>
            </div>
            <button onClick={handleCopy} className="btn-secondary gap-2">
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy code'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
