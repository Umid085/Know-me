import React, { useMemo, useState } from 'react';
import { ArrowRight, Bell, Check, CheckCircle2, Circle, Copy, Sparkles } from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import {
  promotePlannerItemToWin,
  seedStarterPrompts,
  togglePlannerItemComplete,
  upsertBusynessLog,
} from '../services/spaceService';
import {
  ACCOMPLISHMENT_CATEGORY_LABELS,
  BUSYNESS_META,
  LIMITS,
  NOTIFICATION_MODULE_LABELS,
  PLANNER_CATEGORY_LABELS,
  type BusynessLevel,
  type PartnerSlot,
  type WorkspaceTab,
} from '../types/knowme';
import { computeCycleSummary } from '../utils/cycle';
import {
  computeDaysBetween,
  formatReadableDate,
  formatShortDate,
  getNextOccurrenceDays,
  getTodayDateString,
} from '../utils/dates';

interface TodayOverviewProps {
  onNavigate: (tab: WorkspaceTab) => void;
  onQuickAddWin: () => void;
  onQuickAddPlan: () => void;
  onOpenNotifications: () => void;
}

const LEVELS: BusynessLevel[] = ['light', 'steady', 'busy', 'packed'];

export function TodayOverview({
  onNavigate,
  onQuickAddWin,
  onQuickAddPlan,
  onOpenNotifications,
}: TodayOverviewProps) {
  const {
    user,
    space,
    currentUserSlot,
    partnerEntries,
    plannerItems,
    timelineEvents,
    busynessLogs,
    accomplishments,
    cycleSettings,
    cycleLogs,
    notifications,
    unreadNotificationCount,
    dismissNotification,
    getPartnerLabel,
    showToast,
  } = useSpace();

  const today = getTodayDateString();
  const [editingSlot, setEditingSlot] = useState<PartnerSlot | null>(null);
  const [draftLevel, setDraftLevel] = useState<BusynessLevel>('steady');
  const [draftNote, setDraftNote] = useState('');
  const [savingBusy, setSavingBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const todayLogs = useMemo(() => {
    const map: Partial<Record<PartnerSlot, (typeof busynessLogs)[number]>> = {};
    for (const log of busynessLogs) {
      if (log.date === today) {
        map[log.partnerSlot] = log;
      }
    }
    return map;
  }, [busynessLogs, today]);

  const nextNotableDate = useMemo(() => {
    const candidates = timelineEvents
      .map((ev) => ({
        event: ev,
        info: getNextOccurrenceDays(ev.date, ev.recurringYearly),
      }))
      .filter((item) => !item.info.isPastNonRecurring)
      .sort((a, b) => a.info.daysUntil - b.info.daysUntil);
    return candidates[0] || null;
  }, [timelineEvents]);

  const openPlans = useMemo(
    () => plannerItems.filter((item) => !item.completed).slice(0, 5),
    [plannerItems]
  );

  const recentWins = useMemo(() => accomplishments.slice(0, 4), [accomplishments]);
  const pinnedDossier = useMemo(
    () => partnerEntries.filter((e) => e.pinned).slice(0, 4),
    [partnerEntries]
  );

  const isBrandNewSpace =
    partnerEntries.length === 0 &&
    plannerItems.length === 0 &&
    timelineEvents.length === 0 &&
    accomplishments.length === 0;

  const daysTogether = useMemo(() => {
    if (!space?.relationshipStartDate) return null;
    const diff = computeDaysBetween(space.relationshipStartDate, today);
    return diff >= 0 ? diff : null;
  }, [space?.relationshipStartDate, today]);

  const activeCycleSnapshot = useMemo(() => {
    const enabledSlot =
      cycleSettings.find((s) => s.enabled)?.partnerSlot || cycleLogs[0]?.partnerSlot || null;
    if (!enabledSlot) return null;
    const logs = cycleLogs.filter((l) => l.partnerSlot === enabledSlot);
    const settings = cycleSettings.find((s) => s.partnerSlot === enabledSlot) || null;
    const summary = computeCycleSummary(logs, settings, today);
    return { slot: enabledSlot, settings, summary };
  }, [cycleLogs, cycleSettings, today]);

  function openBusynessEditor(slot: PartnerSlot) {
    const existing = todayLogs[slot];
    setEditingSlot(slot);
    setDraftLevel(existing?.level || 'steady');
    setDraftNote(existing?.note || '');
  }

  async function handleSaveBusyness(e: React.FormEvent) {
    e.preventDefault();
    if (!space || !user || !editingSlot) return;
    setSavingBusy(true);
    try {
      await upsertBusynessLog(space.id, user.uid, {
        date: today,
        partnerSlot: editingSlot,
        level: draftLevel,
        note: draftNote,
        existsAlready: Boolean(todayLogs[editingSlot]),
      });
      setEditingSlot(null);
      showToast(`Updated ${getPartnerLabel(editingSlot)}'s bandwidth for today.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update busyness.');
    } finally {
      setSavingBusy(false);
    }
  }

  async function handleSeedStarter() {
    if (!space || !user) return;
    setSeeding(true);
    try {
      await seedStarterPrompts(space.id, user.uid);
      showToast('Starter prompts added across dossiers, planner, timeline, and wins.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add starter prompts.');
    } finally {
      setSeeding(false);
    }
  }

  async function handleCompletePlan(item: (typeof plannerItems)[number]) {
    if (!space || !user) return;
    try {
      await togglePlannerItemComplete(space.id, item.id, true);
      showToast(`Completed "${item.title}".`, {
        label: 'Log as Win',
        onClick: () => {
          void promotePlannerItemToWin(space.id, user.uid, item).then(() =>
            showToast('Logged on today’s accomplishments calendar.')
          );
        },
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update planner item.');
    }
  }

  function handleCopyInvite() {
    if (!space?.inviteCode) return;
    void navigator.clipboard.writeText(space.inviteCode).then(() => {
      setCopiedCode(true);
      showToast('Invite code copied to clipboard.');
      window.setTimeout(() => setCopiedCode(false), 2000);
    });
  }

  if (!space) return null;

  const isWaitingForPartner = !space.partnerBUid;

  return (
    <div className="space-y-10">
      {/* Editorial Day Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-7 border-b border-[#E5DDD1]">
        <div className="space-y-2">
          <p className="text-xs font-mono text-[#6D645D] tabular-nums">
            {formatReadableDate(today, true)}
            {daysTogether !== null && ` · Day ${daysTogether.toLocaleString()} together`}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#231F1D]">
            {space.spaceName}
          </h1>
          <p className="text-sm text-[#6D645D]">
            Check each other&apos;s bandwidth for today, glance at upcoming plans, and celebrate recent wins.
          </p>
        </div>

        {/* Invite banner if second partner has not joined yet */}
        {isWaitingForPartner && (
          <div className="bg-white border border-[#E5DDD1] rounded-xl px-5 py-4 flex items-center justify-between gap-5 max-w-md">
            <div className="space-y-0.5">
              <p className="text-xs text-[#6D645D]">Invite {space.partnerBName} to sync live</p>
              <p className="font-mono text-base font-medium tracking-widest text-[#231F1D] tabular-nums">
                {space.inviteCode}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#2C4C3B] border border-[#E5DDD1] hover:bg-[#FAF7F2] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Copied' : 'Copy code'}
            </button>
          </div>
        )}
      </section>

      {/* Active Module Alerts Strip (only shown when there are unread alerts) */}
      {unreadNotificationCount > 0 && (
        <section className="bg-white border border-[#E5DDD1] rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#2C4C3B] shrink-0" />
              <h2 className="font-serif text-lg font-normal text-[#231F1D]">
                Needs Your Attention
              </h2>
              <span className="font-mono text-xs tabular-nums text-[#6D645D]">
                · {unreadNotificationCount} active
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenNotifications}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#2C4C3B] hover:underline whitespace-nowrap shrink-0"
            >
              <span>All alerts &amp; settings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <ul className="divide-y divide-[#EFE9DF] border-t border-[#EFE9DF]">
            {notifications
              .filter((n) => !n.isDismissed)
              .slice(0, 3)
              .map((item) => (
                <li
                  key={item.id}
                  className="py-3 first:pt-3.5 last:pb-0 flex items-start justify-between gap-4"
                >
                  <button
                    type="button"
                    onClick={() => onNavigate(item.targetTab)}
                    className="text-left min-w-0 flex-1 group"
                  >
                    <p className="text-[11px] flex items-center gap-1.5">
                      <span
                        className={`font-semibold ${
                          item.module === 'cycle' ? 'text-[#7B3E52]' : 'text-[#2C4C3B]'
                        }`}
                      >
                        {NOTIFICATION_MODULE_LABELS[item.module]}
                      </span>
                      <span className="text-[#D8CFC2]" aria-hidden="true">
                        ·
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          item.priority === 'high' ? 'text-[#B55336] font-medium' : 'text-[#6D645D]'
                        }`}
                      >
                        {item.timingLabel}
                      </span>
                    </p>
                    <p className="text-sm font-medium text-[#231F1D] group-hover:text-[#2C4C3B] transition-colors mt-0.5">
                      {item.title}
                    </p>
                    <p className="text-xs text-[#6D645D] line-clamp-1 mt-0.5">{item.body}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void dismissNotification(item.id)}
                    title="Mark as read"
                    aria-label={`Dismiss ${item.title}`}
                    className="p-1.5 text-[#6D645D] hover:text-[#2C4C3B] hover:bg-[#FAF7F2] rounded-md transition-colors shrink-0 mt-0.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Optional Gentle Starter Prompts Card when Space is Completely Empty */}
      {isBrandNewSpace && (
        <section className="bg-white border border-[#E5DDD1] rounded-xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#231F1D]">
              <Sparkles className="w-4 h-4 text-[#2C4C3B]" />
              <span>Your shared almanac is fresh and ready</span>
            </div>
            <p className="text-sm text-[#6D645D] leading-relaxed">
              Start adding entries directly, or load a small set of editable starter prompts across
              all four dossier chapters, the planner, and your timeline.
            </p>
          </div>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void handleSeedStarter()}
            className="px-4 py-2.5 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {seeding ? 'Adding prompts...' : 'Load Starter Prompts'}
          </button>
        </section>
      )}

      {/* Today's Bandwidth: Side-by-Side Partner Busyness */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-normal text-[#231F1D]">Today&apos;s Bandwidth</h2>
            <p className="text-xs text-[#6D645D] mt-0.5">
              See how full each other&apos;s day feels before making evening plans.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('calendar')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2C4C3B] hover:underline whitespace-nowrap shrink-0"
          >
            <span>Open monthly calendar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(['partnerA', 'partnerB'] as PartnerSlot[]).map((slot) => {
            const log = todayLogs[slot];
            const isMe = currentUserSlot === slot;
            const meta = log ? BUSYNESS_META[log.level] : null;
            const name = getPartnerLabel(slot);
            const isEditing = editingSlot === slot;

            return (
              <div
                key={slot}
                className="bg-white border border-[#E5DDD1] rounded-xl p-6 space-y-4 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-[#6D645D]">
                      <span
                        className={`font-medium ${
                          slot === 'partnerA' ? 'text-[#2C4C3B]' : 'text-[#7B3E52]'
                        }`}
                      >
                        {name}
                      </span>
                      {isMe && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>You</span>
                        </>
                      )}
                    </div>
                    <p className="font-serif text-2xl text-[#231F1D]">
                      {meta ? meta.label : 'Not logged yet'}
                    </p>
                  </div>

                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => openBusynessEditor(slot)}
                      className="px-3 py-1.5 text-xs font-medium text-[#231F1D] border border-[#E5DDD1] hover:bg-[#FAF7F2] rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      {log ? 'Update' : 'Set status'}
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <div className="space-y-3">
                    {/* 4-segment capacity indicator */}
                    <div className="grid grid-cols-4 gap-1.5" aria-label={`Busyness level ${meta?.label || 'unset'}`}>
                      {LEVELS.map((lvl, idx) => {
                        const activeIdx = log ? LEVELS.indexOf(log.level) : -1;
                        const filled = idx <= activeIdx;
                        return (
                          <div
                            key={lvl}
                            className={`h-1.5 rounded-full transition-colors ${
                              filled && meta ? meta.barClass : 'bg-[#EFE9DF]'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-sm text-[#6D645D] leading-relaxed">
                      {log?.note
                        ? log.note
                        : meta
                        ? meta.description
                        : `Log how busy ${isMe ? 'your' : `${name}'s`} day is so you stay in sync.`}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSaveBusyness} className="space-y-3 pt-1">
                    <div className="grid grid-cols-4 gap-1.5">
                      {LEVELS.map((lvl) => {
                        const m = BUSYNESS_META[lvl];
                        const selected = draftLevel === lvl;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setDraftLevel(lvl)}
                            className={`py-2 px-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                              selected
                                ? 'bg-[#231F1D] text-white border-[#231F1D]'
                                : 'bg-[#FAF7F2] text-[#231F1D] border-[#E5DDD1] hover:border-[#231F1D]/40'
                            }`}
                          >
                            {m.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      maxLength={LIMITS.busynessNote}
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      placeholder="Short note (e.g., Back-to-back calls until 6pm, free for dinner)"
                      className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingSlot(null)}
                        className="px-3 py-1.5 text-xs font-medium text-[#6D645D] hover:text-[#231F1D]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingBusy}
                        className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors"
                      >
                        {savingBusy ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Main 12-col Asymmetric Editorial Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 7 cols: Upcoming Planner & Pinned Partner Notes */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white border border-[#E5DDD1] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl font-normal text-[#231F1D]">On the Planner</h2>
                <p className="text-xs text-[#6D645D] mt-0.5 tabular-nums">
                  {plannerItems.filter((i) => !i.completed).length} open items
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onQuickAddPlan}
                  className="text-xs font-medium text-[#2C4C3B] hover:underline whitespace-nowrap"
                >
                  + Add plan
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('planner')}
                  className="text-xs text-[#6D645D] hover:text-[#231F1D] whitespace-nowrap"
                >
                  View all
                </button>
              </div>
            </div>

            {openPlans.length === 0 ? (
              <div className="py-6 text-center space-y-2 border-t border-[#EFE9DF]">
                <p className="text-sm text-[#6D645D]">No open plans on the list right now.</p>
                <button
                  type="button"
                  onClick={onQuickAddPlan}
                  className="text-xs font-medium text-[#2C4C3B] hover:underline"
                >
                  Add a date idea or shared task
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-[#EFE9DF] border-t border-[#EFE9DF]">
                {openPlans.map((item) => (
                  <li key={item.id} className="py-3.5 flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => void handleCompletePlan(item)}
                      aria-label={`Mark "${item.title}" complete`}
                      className="mt-0.5 text-[#6D645D] hover:text-[#2C4C3B] transition-colors shrink-0"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#231F1D] leading-snug">{item.title}</p>
                      <p className="text-xs text-[#6D645D] mt-1">
                        {PLANNER_CATEGORY_LABELS[item.category]} · {getPartnerLabel(item.assignee)}
                        {item.dueDate ? ` · Due ${formatShortDate(item.dueDate)}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pinned Partner Notes */}
          <div className="bg-white border border-[#E5DDD1] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl font-normal text-[#231F1D]">Pinned Partner Notes</h2>
                <p className="text-xs text-[#6D645D] mt-0.5">
                  Quick-reference details from your partner dossiers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('dossiers')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2C4C3B] hover:underline whitespace-nowrap"
              >
                <span>Open dossiers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pinnedDossier.length === 0 ? (
              <div className="py-6 text-center space-y-2 border-t border-[#EFE9DF]">
                <p className="text-sm text-[#6D645D]">
                  Pin essentials like coffee orders, sizes, or comfort habits to surface them here.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('dossiers')}
                  className="text-xs font-medium text-[#2C4C3B] hover:underline"
                >
                  Browse partner database
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-[#EFE9DF]">
                {pinnedDossier.map((entry) => (
                  <div key={entry.id} className="space-y-1">
                    <p className="text-xs text-[#6D645D]">
                      {getPartnerLabel(entry.subjectSlot)} · {entry.category}
                    </p>
                    <p className="text-sm font-semibold text-[#231F1D]">{entry.title}</p>
                    {entry.details && (
                      <p className="text-xs text-[#6D645D] line-clamp-2 leading-relaxed">
                        {entry.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 cols: Next Notable Date + Recent Wins */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white border border-[#E5DDD1] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-mono text-[#7B3E52]">Next Notable Date</p>
              <button
                type="button"
                onClick={() => onNavigate('timeline')}
                className="text-xs text-[#6D645D] hover:text-[#231F1D]"
              >
                Timeline
              </button>
            </div>

            {nextNotableDate ? (
              <div className="space-y-2.5">
                <p className="font-mono text-3xl font-medium text-[#231F1D] tabular-nums">
                  {nextNotableDate.info.daysUntil === 0
                    ? 'Today'
                    : `In ${nextNotableDate.info.daysUntil} ${
                        nextNotableDate.info.daysUntil === 1 ? 'day' : 'days'
                      }`}
                </p>
                <div>
                  <h3 className="font-serif text-xl text-[#231F1D]">
                    {nextNotableDate.event.title}
                  </h3>
                  <p className="text-xs text-[#6D645D] mt-1 font-mono tabular-nums">
                    {formatShortDate(nextNotableDate.info.nextDateStr)}
                    {nextNotableDate.event.recurringYearly && nextNotableDate.info.yearsCount > 0
                      ? ` · Year ${nextNotableDate.info.yearsCount}`
                      : ''}
                    {nextNotableDate.event.location ? ` · ${nextNotableDate.event.location}` : ''}
                  </p>
                </div>
                {nextNotableDate.event.story && (
                  <p className="text-sm text-[#6D645D] leading-relaxed line-clamp-3 pt-1">
                    {nextNotableDate.event.story}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-4 space-y-2">
                <p className="text-sm text-[#6D645D]">
                  No upcoming anniversaries or notable dates recorded yet.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('timeline')}
                  className="text-xs font-medium text-[#2C4C3B] hover:underline"
                >
                  Add your first notable date
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-[#E5DDD1] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl font-normal text-[#231F1D]">Recent Wins</h2>
                <p className="text-xs text-[#6D645D] mt-0.5">
                  Everyday accomplishments worth noticing.
                </p>
              </div>
              <button
                type="button"
                onClick={onQuickAddWin}
                className="text-xs font-medium text-[#2C4C3B] hover:underline whitespace-nowrap"
              >
                + Log win
              </button>
            </div>

            {recentWins.length === 0 ? (
              <div className="py-6 text-center space-y-2 border-t border-[#EFE9DF]">
                <p className="text-sm text-[#6D645D]">No accomplishments logged yet.</p>
                <button
                  type="button"
                  onClick={onQuickAddWin}
                  className="text-xs font-medium text-[#2C4C3B] hover:underline"
                >
                  Record a win for today
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-[#EFE9DF] border-t border-[#EFE9DF]">
                {recentWins.map((win) => (
                  <li key={win.id} className="py-3.5 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#2C4C3B] mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#231F1D] leading-snug">{win.title}</p>
                      <p className="text-xs text-[#6D645D] mt-1 font-mono tabular-nums">
                        {getPartnerLabel(win.owner)} · {ACCOMPLISHMENT_CATEGORY_LABELS[win.category]} ·{' '}
                        {formatShortDate(win.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Cycle Guide Card */}
          <div className="bg-white border border-[#E5DDD1] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-mono text-[#7B3E52]">Cycle Calendar</p>
              <button
                type="button"
                onClick={() => onNavigate('cycle')}
                className="text-xs font-medium text-[#2C4C3B] hover:underline whitespace-nowrap"
              >
                Full guide &amp; forecast
              </button>
            </div>

            {activeCycleSnapshot && activeCycleSnapshot.summary.currentAdvice ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p
                    className={`font-serif text-2xl ${activeCycleSnapshot.summary.currentAdvice.accentTextClass}`}
                  >
                    {activeCycleSnapshot.summary.isCurrentlyOnPeriod &&
                    activeCycleSnapshot.summary.currentPeriodDay
                      ? `Day ${activeCycleSnapshot.summary.currentPeriodDay} of ${activeCycleSnapshot.summary.effectivePeriodLength} of period`
                      : activeCycleSnapshot.summary.currentAdvice.title}
                  </p>
                  <p className="text-xs font-mono text-[#6D645D] tabular-nums">
                    {getPartnerLabel(activeCycleSnapshot.slot)} · Cycle Day{' '}
                    {activeCycleSnapshot.summary.currentCycleDay} of{' '}
                    {activeCycleSnapshot.summary.effectiveCycleLength}
                    {!activeCycleSnapshot.summary.isCurrentlyOnPeriod &&
                    activeCycleSnapshot.summary.daysUntilNextPeriod !== null
                      ? ` · Next period in ${activeCycleSnapshot.summary.daysUntilNextPeriod}d`
                      : ''}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#EFE9DF] space-y-1.5">
                  <p className="text-[11px] font-mono text-[#2C4C3B]">Today’s advice</p>
                  <p className="text-xs text-[#231F1D] leading-relaxed">
                    {activeCycleSnapshot.summary.currentAdvice.howToBehave[0]}
                  </p>
                </div>

                {activeCycleSnapshot.summary.upcomingStages[1] && (
                  <p className="text-xs text-[#6D645D] pt-1 font-mono tabular-nums">
                    Up next in {activeCycleSnapshot.summary.upcomingStages[1].daysUntil}d:{' '}
                    <span className="text-[#231F1D] font-sans font-medium">
                      {activeCycleSnapshot.summary.upcomingStages[1].title}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-[#6D645D]">
                  Pick her last period start date once to see which day she&apos;s on, how to
                  behave today, and what comes next.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('cycle')}
                  className="text-xs font-medium text-[#7B3E52] hover:underline"
                >
                  Set period start date
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
