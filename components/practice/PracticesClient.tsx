'use client';
// components/practice/PracticesClient.tsx
// Lists all practice plans with create and delete actions.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardList, Clock, Trash2, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { PageHeader, EmptyState, Modal, ConfirmDialog } from '@/components/ui';
import { CreatePlanForm } from '@/components/practice/CreatePlanForm';
import { deletePracticePlan } from '@/actions/practices';

export interface PracticePlanSummary {
  id: string;
  title: string;
  notes: string | null;
  duration_min: number | null;
  created_at: string;
  practice_plan_blocks: { count: number }[];
}

export function PracticesClient({
  plans,
  teamId,
}: {
  plans: PracticePlanSummary[];
  teamId: string;
}) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<PracticePlanSummary | null>(
    null,
  );
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDelete() {
    if (!deletingPlan) return;
    setDeleteLoading(true);
    await deletePracticePlan(deletingPlan.id, teamId);
    setDeleteLoading(false);
    setDeletingPlan(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Practice Plans"
        description="Build and reuse structured practice sessions"
        action={
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary gap-2"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">New Plan</span>
          </button>
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No practice plans yet"
          description="Build a structured practice with warmups, drills, games, and cooldowns."
          action={
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              Create first plan
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => {
            const blockCount = plan.practice_plan_blocks?.[0]?.count ?? 0;
            const timeAgo = formatDistanceToNow(parseISO(plan.created_at), {
              addSuffix: true,
            });

            return (
              <div
                key={plan.id}
                className="card px-4 py-3 flex items-center gap-3 hover:border-brand-300 hover:shadow-sm transition-all group cursor-pointer"
                onClick={() => router.push(`/practices/${plan.id}`)}
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <ClipboardList size={18} className="text-brand-600" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 group-hover:text-brand-700 transition-colors truncate">
                    {plan.title}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500">
                      {blockCount} block{blockCount !== 1 ? 's' : ''}
                    </span>
                    {plan.duration_min && (
                      <span className="text-xs text-gray-400 flex items-center gap-0.5">
                        <Clock size={10} />
                        {plan.duration_min} min
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{timeAgo}</span>
                  </div>
                </div>

                {/* Delete + arrow */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingPlan(plan);
                    }}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete plan"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight
                    size={16}
                    className="text-gray-300 group-hover:text-gray-400 transition-colors"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Practice Plan"
      >
        <CreatePlanForm
          teamId={teamId}
          onSuccess={(id) => {
            setShowCreateModal(false);
            router.push(`/practices/${id}`);
          }}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deletingPlan}
        onClose={() => setDeletingPlan(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete practice plan?"
        description={`"${deletingPlan?.title}" and all its blocks will be permanently deleted.`}
        confirmLabel="Delete plan"
        confirmVariant="danger"
      />
    </div>
  );
}
