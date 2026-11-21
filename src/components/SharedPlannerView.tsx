import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, Circle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import {
  deletePlannerItem,
  promotePlannerItemToWin,
  savePlannerItem,
  togglePlannerItemComplete,
} from '../services/spaceService';
import {
  LIMITS,
  PLANNER_CATEGORY_LABELS,
  type PlannerAssignee,
  type PlannerCategory,
  type PlannerItem,
} from '../types/knowme';
import { formatShortDate } from '../utils/dates';

interface SharedPlannerViewProps {
  openDrawerSignal: number;
}

const CATEGORIES: Array<{ id: PlannerCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Plans' },
  { id: 'date_idea', label: 'Date Ideas' },
  { id: 'home_life', label: 'Home & Life' },
  { id: 'trip', label: 'Trips' },
  { id: 'goal', label: 'Goals' },
];

export function SharedPlannerView({ openDrawerSignal }: SharedPlannerViewProps) {
  const { user, space, plannerItems, getPartnerLabel, showToast } = useSpace();

  const [activeCategory, setActiveCategory] = useState<PlannerCategory | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<PlannerAssignee | 'all'>('all');
  const [showCompleted, setShowCompleted] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlannerItem | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PlannerCategory>('date_idea');
  const [assignee, setAssignee] = useState<PlannerAssignee>('together');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  React.useEffect(() => {
    if (openDrawerSignal > 0) {
      openCreateDrawer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDrawerSignal]);

  function openCreateDrawer() {
    setEditingItem(null);
    setTitle('');
    setCategory(activeCategory === 'all' ? 'date_idea' : activeCategory);
    setAssignee(assigneeFilter === 'all' ? 'together' : assigneeFilter);
    setDueDate('');
    setNotes('');
    setFormError('');
    setDrawerOpen(true);
  }

  function openEditDrawer(item: PlannerItem) {
    setEditingItem(item);
    setTitle(item.title);
    setCategory(item.category);
    setAssignee(item.assignee);
    setDueDate(item.dueDate);
    setNotes(item.notes);
    setFormError('');
    setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!space || !user) return;
    setFormError('');
    if (!title.trim()) {
      setFormError('Please enter a title for your plan.');
      return;
    }

    setSaving(true);
    try {
      await savePlannerItem(space.id, user.uid, {
        id: editingItem?.id,
        title,
        category,
        assignee,
        dueDate,
        notes,
        completed: editingItem?.completed ?? false,
        promotedToWin: editingItem?.promotedToWin ?? false,
      });
      setDrawerOpen(false);
      showToast(editingItem ? 'Plan updated.' : 'Added to shared planner.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save plan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleComplete(item: PlannerItem) {
    if (!space || !user) return;
    const nextCompleted = !item.completed;
    try {
      await togglePlannerItemComplete(space.id, item.id, nextCompleted);
      if (nextCompleted && !item.promotedToWin) {
        showToast(`Completed "${item.title}".`, {
          label: 'Log as Win',
          onClick: () => {
            void promotePlannerItemToWin(space.id, user.uid, item).then(() =>
              showToast('Celebrated on today’s accomplishments calendar.')
            );
          },
        });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update item.');
    }
  }

  async function handlePromoteWin(item: PlannerItem) {
    if (!space || !user) return;
    try {
      await promotePlannerItemToWin(space.id, user.uid, item);
      showToast(`Logged "${item.title}" as an accomplishment for today.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not log accomplishment.');
    }
  }

  async function handleDelete(item: PlannerItem) {
    if (!space) return;
    try {
      await deletePlannerItem(space.id, item.id);
      if (editingItem?.id === item.id) setDrawerOpen(false);
      showToast(`Removed "${item.title}".`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete item.');
    }
  }

  const filteredItems = useMemo(() => {
    return plannerItems.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (assigneeFilter !== 'all' && item.assignee !== assigneeFilter) return false;
      return true;
    });
  }, [plannerItems, activeCategory, assigneeFilter]);

  const openItems = useMemo(() => filteredItems.filter((i) => !i.completed), [filteredItems]);
  const completedItems = useMemo(() => filteredItems.filter((i) => i.completed), [filteredItems]);

  if (!space) return null;

  return (
    <div className="space-y-8">
      {/* Category & Assignee Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#E5DDD1]">
        <div className="flex items-center gap-6 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const count =
              cat.id === 'all'
                ? plannerItems.filter((i) => !i.completed).length
                : plannerItems.filter((i) => !i.completed && i.category === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeCategory === cat.id
                    ? 'border-[#2C4C3B] text-[#231F1D]'
                    : 'border-transparent text-[#6D645D] hover:text-[#231F1D]'
                }`}
              >
                {cat.label}{' '}
                <span className="font-mono text-xs text-[#6D645D] tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-[#F2EDE4] rounded-lg">
            {(
              [
                { id: 'all', label: 'Anyone' },
                { id: 'together', label: 'Together' },
                { id: 'partnerA', label: space.partnerAName },
                { id: 'partnerB', label: space.partnerBName },
              ] as { id: PlannerAssignee | 'all'; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAssigneeFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  assigneeFilter === opt.id
                    ? 'bg-white text-[#231F1D] shadow-xs'
                    : 'text-[#6D645D] hover:text-[#231F1D]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Plan</span>
          </button>
        </div>
      </div>

      {/* Open Plans List */}
      <section className="bg-white border border-[#E5DDD1] rounded-xl p-6 sm:p-7 space-y-4">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#EFE9DF]">
          <div>
            <h2 className="font-serif text-2xl font-normal text-[#231F1D]">Upcoming &amp; Ideas</h2>
            <p className="text-xs text-[#6D645D] mt-0.5 tabular-nums">
              {openItems.length} active {openItems.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>

        {openItems.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-[#6D645D]">
              Nothing open in this view yet. Add a date night, weekend trip idea, or household goal.
            </p>
            <button
              type="button"
              onClick={openCreateDrawer}
              className="px-4 py-2 text-xs font-medium text-[#2C4C3B] border border-[#E5DDD1] hover:bg-[#FAF7F2] rounded-lg transition-colors"
            >
              Add first plan
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-[#EFE9DF]">
            {openItems.map((item) => (
              <li key={item.id} className="py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => void handleToggleComplete(item)}
                    aria-label={`Complete ${item.title}`}
                    className="mt-0.5 text-[#6D645D] hover:text-[#2C4C3B] transition-colors shrink-0"
                  >
                    <Circle className="w-5 h-5" />
                  </button>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs text-[#6D645D]">
                      <span>{PLANNER_CATEGORY_LABELS[item.category]}</span>
                      <span aria-hidden="true"> · </span>
                      <span
                        className={
                          item.assignee === 'partnerA'
                            ? 'text-[#2C4C3B] font-medium'
                            : item.assignee === 'partnerB'
                            ? 'text-[#7B3E52] font-medium'
                            : 'text-[#231F1D] font-medium'
                        }
                      >
                        {getPartnerLabel(item.assignee)}
                      </span>
                      {item.dueDate && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono tabular-nums">
                            Due {formatShortDate(item.dueDate)}
                          </span>
                        </>
                      )}
                    </p>
                    <p className="text-base font-medium text-[#231F1D] leading-snug">{item.title}</p>
                    {item.notes && (
                      <p className="text-sm text-[#6D645D] leading-relaxed">{item.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditDrawer(item)}
                    aria-label={`Edit ${item.title}`}
                    className="p-2 text-[#6D645D] hover:text-[#231F1D] hover:bg-[#F2EDE4] rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item)}
                    aria-label={`Delete ${item.title}`}
                    className="p-2 text-[#6D645D] hover:text-[#8C2F39] hover:bg-[#8C2F39]/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Completed Plans Section */}
      {completedItems.length > 0 && (
        <section className="bg-white border border-[#E5DDD1] rounded-xl p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#EFE9DF]">
            <div>
              <h3 className="font-serif text-xl font-normal text-[#231F1D]">
                Completed ({completedItems.length})
              </h3>
              <p className="text-xs text-[#6D645D] mt-0.5">
                Promote any completed goal straight into your Accomplishments Calendar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="text-xs font-medium text-[#6D645D] hover:text-[#231F1D]"
            >
              {showCompleted ? 'Hide' : 'Show'}
            </button>
          </div>

          {showCompleted && (
            <ul className="divide-y divide-[#EFE9DF]">
              {completedItems.map((item) => (
                <li key={item.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => void handleToggleComplete(item)}
                      aria-label={`Mark ${item.title} incomplete`}
                      className="mt-0.5 text-[#2C4C3B] hover:text-[#6D645D] transition-colors shrink-0"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#6D645D] line-through">{item.title}</p>
                      <p className="text-xs text-[#6D645D] mt-0.5">
                        {PLANNER_CATEGORY_LABELS[item.category]} · {getPartnerLabel(item.assignee)}
                        {item.promotedToWin ? ' · Logged as accomplishment' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!item.promotedToWin && (
                      <button
                        type="button"
                        onClick={() => void handlePromoteWin(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2C4C3B] border border-[#E5DDD1] hover:bg-[#FAF7F2] rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Log as Win</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      aria-label={`Delete ${item.title}`}
                      className="p-2 text-[#6D645D] hover:text-[#8C2F39] hover:bg-[#8C2F39]/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Slide-over Editor Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#231F1D]/35"
          role="dialog"
          aria-modal="true"
          aria-label={editingItem ? 'Edit plan' : 'Add plan'}
        >
          <div className="w-full max-w-lg bg-[#FAF7F2] border-l border-[#E5DDD1] h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between gap-6">
            <form id="planner-item-form" onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5DDD1]">
                <div>
                  <p className="text-xs font-mono text-[#6D645D]">Shared Planner</p>
                  <h2 className="font-serif text-2xl text-[#231F1D] mt-0.5">
                    {editingItem ? 'Edit Plan' : 'New Shared Plan'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close planner editor"
                  className="p-2 text-[#6D645D] hover:text-[#231F1D] rounded-lg hover:bg-[#F2EDE4]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#231F1D]">Plan title</span>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.plannerTitle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Saturday farmers market & homemade pasta"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#231F1D]">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PlannerCategory)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                  >
                    {(Object.keys(PLANNER_CATEGORY_LABELS) as PlannerCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {PLANNER_CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#231F1D]">Owner</span>
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value as PlannerAssignee)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                  >
                    <option value="together">Together</option>
                    <option value="partnerA">{space.partnerAName}</option>
                    <option value="partnerB">{space.partnerBName}</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#231F1D]">
                  Target date <span className="text-[#6D645D] font-normal">(optional)</span>
                </span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#231F1D]">Notes</span>
                <textarea
                  rows={4}
                  maxLength={LIMITS.plannerNotes}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reservations, packing ideas, links, or checklist notes..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B] resize-y"
                />
              </label>

              {formError && (
                <p className="text-sm text-[#8C2F39] bg-[#8C2F39]/10 border border-[#8C2F39]/25 rounded-lg px-3.5 py-2.5">
                  {formError}
                </p>
              )}
            </form>

            <div className="pt-4 border-t border-[#E5DDD1] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 text-sm text-[#6D645D] hover:text-[#231F1D]"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="planner-item-form"
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
