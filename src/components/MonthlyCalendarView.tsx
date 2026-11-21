import React, { useMemo, useState } from 'react';
import { Award, CalendarHeart, CheckCircle2, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import {
  deleteAccomplishment,
  deleteBusynessLog,
  saveAccomplishment,
  upsertBusynessLog,
} from '../services/spaceService';
import {
  ACCOMPLISHMENT_CATEGORY_LABELS,
  BUSYNESS_META,
  LIMITS,
  type AccomplishmentCategory,
  type AccomplishmentOwner,
  type BusynessLevel,
  type BusynessLog,
  type PartnerSlot,
} from '../types/knowme';
import {
  buildMonthGrid,
  formatMonthYear,
  formatReadableDate,
  getMonthDayRange,
  getTodayDateString,
  parseLocalDate,
} from '../utils/dates';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BUSYNESS_LEVELS: BusynessLevel[] = ['light', 'steady', 'busy', 'packed'];

interface MonthlyCalendarViewProps {
  focusWinSignal: number;
}

export function MonthlyCalendarView({ focusWinSignal }: MonthlyCalendarViewProps) {
  const {
    user,
    space,
    currentUserSlot,
    busynessLogs,
    accomplishments,
    timelineEvents,
    getPartnerLabel,
    showToast,
  } = useSpace();

  const today = getTodayDateString();
  const initialDate = parseLocalDate(today);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  // Busyness form state inside Day Ledger
  const [activeSlotTab, setActiveSlotTab] = useState<PartnerSlot>(currentUserSlot);
  const [levelDraft, setLevelDraft] = useState<BusynessLevel>('steady');
  const [busyNoteDraft, setBusyNoteDraft] = useState('');
  const [savingBusy, setSavingBusy] = useState(false);

  // Win form state inside Day Ledger
  const [showWinForm, setShowWinForm] = useState(false);
  const [winTitle, setWinTitle] = useState('');
  const [winOwner, setWinOwner] = useState<AccomplishmentOwner>(currentUserSlot);
  const [winCategory, setWinCategory] = useState<AccomplishmentCategory>('personal');
  const [winReflection, setWinReflection] = useState('');
  const [savingWin, setSavingWin] = useState(false);

  React.useEffect(() => {
    setActiveSlotTab(currentUserSlot);
    setWinOwner(currentUserSlot);
  }, [currentUserSlot]);

  React.useEffect(() => {
    if (focusWinSignal > 0) {
      setSelectedDate(today);
      const d = parseLocalDate(today);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setShowWinForm(true);
    }
  }, [focusWinSignal, today]);

  const busynessByDate = useMemo(() => {
    const map = new Map<string, Partial<Record<PartnerSlot, BusynessLog>>>();
    for (const log of busynessLogs) {
      const entry = map.get(log.date) || {};
      entry[log.partnerSlot] = log;
      map.set(log.date, entry);
    }
    return map;
  }, [busynessLogs]);

  const winsByDate = useMemo(() => {
    const map = new Map<string, typeof accomplishments>();
    for (const win of accomplishments) {
      const list = map.get(win.date) || [];
      list.push(win);
      map.set(win.date, list);
    }
    return map;
  }, [accomplishments]);

  const timelineByMonthDay = useMemo(() => {
    const exactMap = new Map<string, typeof timelineEvents>();
    const recurringMap = new Map<string, typeof timelineEvents>();
    for (const ev of timelineEvents) {
      if (ev.recurringYearly) {
        const md = ev.date.slice(5);
        const list = recurringMap.get(md) || [];
        list.push(ev);
        recurringMap.set(md, list);
      } else {
        const list = exactMap.get(ev.date) || [];
        list.push(ev);
        exactMap.set(ev.date, list);
      }
    }
    return { exactMap, recurringMap };
  }, [timelineEvents]);

  function getTimelineEventsForDate(dateStr: string) {
    const exact = timelineByMonthDay.exactMap.get(dateStr) || [];
    const recurring = timelineByMonthDay.recurringMap.get(dateStr.slice(5)) || [];
    return [...exact, ...recurring];
  }

  // Sync busyness draft inputs whenever selectedDate or activeSlotTab changes
  React.useEffect(() => {
    const existing = busynessByDate.get(selectedDate)?.[activeSlotTab];
    setLevelDraft(existing?.level || 'steady');
    setBusyNoteDraft(existing?.note || '');
  }, [selectedDate, activeSlotTab, busynessByDate]);

  const calendarCells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthRange = useMemo(() => getMonthDayRange(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthStats = useMemo(() => {
    let winsCount = 0;
    let partnerABusyDays = 0;
    let partnerBBusyDays = 0;

    for (const win of accomplishments) {
      if (win.date >= monthRange.start && win.date <= monthRange.end) {
        winsCount++;
      }
    }
    for (const log of busynessLogs) {
      if (log.date >= monthRange.start && log.date <= monthRange.end) {
        if (log.level === 'busy' || log.level === 'packed') {
          if (log.partnerSlot === 'partnerA') partnerABusyDays++;
          if (log.partnerSlot === 'partnerB') partnerBBusyDays++;
        }
      }
    }
    return { winsCount, partnerABusyDays, partnerBBusyDays };
  }, [accomplishments, busynessLogs, monthRange]);

  function stepMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function jumpToToday() {
    const d = parseLocalDate(today);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(today);
  }

  async function handleSaveBusyness(e: React.FormEvent) {
    e.preventDefault();
    if (!space || !user) return;
    const existing = busynessByDate.get(selectedDate)?.[activeSlotTab];
    setSavingBusy(true);
    try {
      await upsertBusynessLog(space.id, user.uid, {
        date: selectedDate,
        partnerSlot: activeSlotTab,
        level: levelDraft,
        note: busyNoteDraft,
        existsAlready: Boolean(existing),
      });
      showToast(
        `Saved ${getPartnerLabel(activeSlotTab)}'s bandwidth (${BUSYNESS_META[levelDraft].label}).`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save busyness.');
    } finally {
      setSavingBusy(false);
    }
  }

  async function handleClearBusyness(slot: PartnerSlot) {
    if (!space) return;
    const existing = busynessByDate.get(selectedDate)?.[slot];
    if (!existing) return;
    try {
      await deleteBusynessLog(space.id, existing.id);
      showToast(`Cleared ${getPartnerLabel(slot)}'s status for ${selectedDate}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not clear status.');
    }
  }

  async function handleAddWin(e: React.FormEvent) {
    e.preventDefault();
    if (!space || !user || !winTitle.trim()) return;
    setSavingWin(true);
    try {
      await saveAccomplishment(space.id, user.uid, {
        date: selectedDate,
        title: winTitle,
        owner: winOwner,
        category: winCategory,
        reflection: winReflection,
      });
      setWinTitle('');
      setWinReflection('');
      setShowWinForm(false);
      showToast('Accomplishment logged on calendar.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not log accomplishment.');
    } finally {
      setSavingWin(false);
    }
  }

  async function handleDeleteWin(winId: string) {
    if (!space) return;
    try {
      await deleteAccomplishment(space.id, winId);
      showToast('Accomplishment removed.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not remove accomplishment.');
    }
  }

  if (!space) return null;

  const selectedDayLogs = busynessByDate.get(selectedDate) || {};
  const selectedDayWins = winsByDate.get(selectedDate) || [];
  const selectedDayMilestones = getTimelineEventsForDate(selectedDate);

  return (
    <div className="space-y-6">
      {/* Month Controls + Summary Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-[#E5DDD1]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              aria-label="Previous month"
              className="p-2 bg-white border border-[#E5DDD1] hover:bg-[#F2EDE4] rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[#231F1D]" />
            </button>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              aria-label="Next month"
              className="p-2 bg-white border border-[#E5DDD1] hover:bg-[#F2EDE4] rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-[#231F1D]" />
            </button>
          </div>
          <div>
            <h2 className="font-serif text-3xl font-normal text-[#231F1D]">
              {formatMonthYear(viewYear, viewMonth)}
            </h2>
          </div>
          <button
            type="button"
            onClick={jumpToToday}
            className="ml-2 px-3 py-1.5 text-xs font-medium text-[#231F1D] bg-white border border-[#E5DDD1] hover:bg-[#F2EDE4] rounded-lg transition-colors whitespace-nowrap"
          >
            Today
          </button>
        </div>

        {/* Clean Unboxed Monthly Metrics */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#6D645D]">
          <span>
            <strong className="font-mono text-[#231F1D] tabular-nums">{monthStats.winsCount}</strong>{' '}
            accomplishments this month
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="font-mono text-[#2C4C3B] tabular-nums">
              {monthStats.partnerABusyDays}
            </strong>{' '}
            heavy days for {space.partnerAName}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="font-mono text-[#7B3E52] tabular-nums">
              {monthStats.partnerBBusyDays}
            </strong>{' '}
            heavy days for {space.partnerBName}
          </span>
        </div>
      </div>

      {/* Explicit Accessible Busyness & Partner Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#6D645D]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-medium text-[#231F1D]">Busyness key:</span>
          {BUSYNESS_LEVELS.map((lvl) => (
            <span key={lvl} className="inline-flex items-center gap-1.5">
              <span className={`w-3 h-1.5 rounded-full ${BUSYNESS_META[lvl].barClass}`} />
              <span>{BUSYNESS_META[lvl].label}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span>Top bar: {space.partnerAName}</span>
          <span aria-hidden="true">·</span>
          <span>Bottom bar: {space.partnerBName}</span>
        </div>
      </div>

      {/* Main Split: 8-Col Monthly Grid + 4-Col Day Ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Monthly Grid */}
        <div className="xl:col-span-8 bg-white border border-[#E5DDD1] rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#E5DDD1] bg-[#F2EDE4]/60">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2.5 text-center text-xs font-medium text-[#6D645D] tracking-wide"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-[#EFE9DF]">
            {calendarCells.map((cell) => {
              const logs = busynessByDate.get(cell.dateStr);
              const wins = winsByDate.get(cell.dateStr) || [];
              const milestones = getTimelineEventsForDate(cell.dateStr);
              const isSelected = selectedDate === cell.dateStr;

              const logA = logs?.partnerA;
              const logB = logs?.partnerB;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`min-h-[92px] sm:min-h-[104px] p-2 sm:p-2.5 text-left flex flex-col justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2C4C3B] ${
                    isSelected
                      ? 'bg-[#2C4C3B]/[0.07]'
                      : cell.inCurrentMonth
                      ? 'bg-white hover:bg-[#FAF7F2]'
                      : 'bg-[#FAF7F2]/60 text-[#6D645D]/50 hover:bg-[#F2EDE4]/50'
                  }`}
                >
                  {/* Top row: Day number + Milestone mark */}
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span
                      className={`font-mono text-xs tabular-nums inline-flex items-center justify-center w-6 h-6 rounded-md ${
                        cell.isToday
                          ? 'bg-[#2C4C3B] text-white font-medium'
                          : isSelected
                          ? 'text-[#2C4C3B] font-semibold'
                          : cell.inCurrentMonth
                          ? 'text-[#231F1D]'
                          : 'text-[#6D645D]/50'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {milestones.length > 0 && (
                      <CalendarHeart
                        className="w-3.5 h-3.5 text-[#7B3E52] shrink-0"
                        aria-label={milestones[0].title}
                      />
                    )}
                  </div>

                  {/* Middle: Dual Partner Busyness Bars */}
                  <div className="space-y-1.5 my-1.5 w-full">
                    <div className="space-y-1">
                      <div
                        className={`h-1.5 w-full rounded-full ${
                          logA ? BUSYNESS_META[logA.level].barClass : 'bg-[#EFE9DF]/70'
                        }`}
                        title={
                          logA
                            ? `${space.partnerAName}: ${BUSYNESS_META[logA.level].label}`
                            : `${space.partnerAName}: Not logged`
                        }
                      />
                      <div
                        className={`h-1.5 w-full rounded-full ${
                          logB ? BUSYNESS_META[logB.level].barClass : 'bg-[#EFE9DF]/70'
                        }`}
                        title={
                          logB
                            ? `${space.partnerBName}: ${BUSYNESS_META[logB.level].label}`
                            : `${space.partnerBName}: Not logged`
                        }
                      />
                    </div>
                  </div>

                  {/* Bottom: Accomplishments count or busyness text hint */}
                  <div className="w-full min-h-[16px]">
                    {wins.length > 0 ? (
                      <p className="text-[11px] font-medium text-[#2C4C3B] truncate tabular-nums">
                        {wins.length} {wins.length === 1 ? 'win' : 'wins'}
                      </p>
                    ) : logA || logB ? (
                      <p className="text-[10px] text-[#6D645D] truncate hidden sm:block">
                        {logA ? BUSYNESS_META[logA.level].shortLabel : '—'} /{' '}
                        {logB ? BUSYNESS_META[logB.level].shortLabel : '—'}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Adjacent Day Ledger Panel */}
        <aside className="xl:col-span-4 bg-white border border-[#E5DDD1] rounded-xl p-6 space-y-6">
          <div className="pb-4 border-b border-[#EFE9DF] space-y-1">
            <p className="text-xs font-mono text-[#6D645D] tabular-nums">Day Ledger</p>
            <h3 className="font-serif text-2xl font-normal text-[#231F1D]">
              {formatReadableDate(selectedDate, true)}
            </h3>
            {selectedDayMilestones.length > 0 && (
              <div className="pt-2 space-y-1">
                {selectedDayMilestones.map((m) => (
                  <p
                    key={m.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7B3E52]"
                  >
                    <CalendarHeart className="w-3.5 h-3.5 shrink-0" />
                    <span>{m.title}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Section A: Partner Busyness Snapshot & Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[#231F1D]">Bandwidth &amp; Schedule</h4>
            </div>

            {/* Side-by-side readback */}
            <div className="grid grid-cols-2 gap-3">
              {(['partnerA', 'partnerB'] as PartnerSlot[]).map((slot) => {
                const log = selectedDayLogs[slot];
                const meta = log ? BUSYNESS_META[log.level] : null;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setActiveSlotTab(slot)}
                    className={`p-3 rounded-lg border text-left transition-colors space-y-1 ${
                      activeSlotTab === slot
                        ? 'border-[#2C4C3B] bg-[#FAF7F2]'
                        : 'border-[#E5DDD1] bg-white hover:bg-[#FAF7F2]/60'
                    }`}
                  >
                    <p
                      className={`text-xs font-medium truncate ${
                        slot === 'partnerA' ? 'text-[#2C4C3B]' : 'text-[#7B3E52]'
                      }`}
                    >
                      {getPartnerLabel(slot)}
                    </p>
                    <p className={`text-sm font-semibold ${meta ? meta.textClass : 'text-[#6D645D]'}`}>
                      {meta ? meta.label : 'Unset'}
                    </p>
                    {log?.note && (
                      <p className="text-[11px] text-[#6D645D] line-clamp-2 leading-snug">
                        {log.note}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Busyness Update Form for selected slot */}
            <form onSubmit={handleSaveBusyness} className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#6D645D]">
                  Set status for <strong className="text-[#231F1D]">{getPartnerLabel(activeSlotTab)}</strong>
                </span>
                {selectedDayLogs[activeSlotTab] && (
                  <button
                    type="button"
                    onClick={() => void handleClearBusyness(activeSlotTab)}
                    className="text-xs text-[#6D645D] hover:text-[#8C2F39]"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {BUSYNESS_LEVELS.map((lvl) => {
                  const selected = levelDraft === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevelDraft(lvl)}
                      className={`py-2 px-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                        selected
                          ? 'bg-[#231F1D] text-white border-[#231F1D]'
                          : 'bg-[#FAF7F2] text-[#231F1D] border-[#E5DDD1] hover:border-[#231F1D]/40'
                      }`}
                    >
                      {BUSYNESS_META[lvl].shortLabel}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                maxLength={LIMITS.busynessNote}
                value={busyNoteDraft}
                onChange={(e) => setBusyNoteDraft(e.target.value)}
                placeholder="Context note (e.g., Late deadline, free after 7pm)"
                className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
              />

              <button
                type="submit"
                disabled={savingBusy}
                className="w-full py-2 text-xs font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors"
              >
                {savingBusy ? 'Saving...' : `Save ${getPartnerLabel(activeSlotTab)}'s Busyness`}
              </button>
            </form>
          </div>

          {/* Section B: Daily Accomplishments */}
          <div className="pt-5 border-t border-[#EFE9DF] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#2C4C3B]" />
                <h4 className="text-sm font-semibold text-[#231F1D]">
                  Accomplishments ({selectedDayWins.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowWinForm((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2C4C3B] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showWinForm ? 'Close' : 'Log win'}</span>
              </button>
            </div>

            {showWinForm && (
              <form
                onSubmit={handleAddWin}
                className="p-4 bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg space-y-3"
              >
                <input
                  type="text"
                  required
                  maxLength={LIMITS.accomplishmentTitle}
                  value={winTitle}
                  onChange={(e) => setWinTitle(e.target.value)}
                  placeholder="What did you accomplish today?"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={winOwner}
                    onChange={(e) => setWinOwner(e.target.value as AccomplishmentOwner)}
                    className="px-2.5 py-2 text-xs bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                  >
                    <option value="partnerA">{space.partnerAName}</option>
                    <option value="partnerB">{space.partnerBName}</option>
                    <option value="together">Together</option>
                  </select>
                  <select
                    value={winCategory}
                    onChange={(e) => setWinCategory(e.target.value as AccomplishmentCategory)}
                    className="px-2.5 py-2 text-xs bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                  >
                    {(Object.keys(ACCOMPLISHMENT_CATEGORY_LABELS) as AccomplishmentCategory[]).map(
                      (cat) => (
                        <option key={cat} value={cat}>
                          {ACCOMPLISHMENT_CATEGORY_LABELS[cat]}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <textarea
                  rows={2}
                  maxLength={LIMITS.accomplishmentReflection}
                  value={winReflection}
                  onChange={(e) => setWinReflection(e.target.value)}
                  placeholder="Optional reflection or proud note..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B] resize-none"
                />
                <button
                  type="submit"
                  disabled={savingWin}
                  className="w-full py-2 text-xs font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors"
                >
                  {savingWin ? 'Logging...' : 'Save Accomplishment'}
                </button>
              </form>
            )}

            {selectedDayWins.length === 0 ? (
              <p className="text-xs text-[#6D645D] py-2">
                No wins recorded for this date yet — celebrate big milestones or small everyday
                victories.
              </p>
            ) : (
              <ul className="divide-y divide-[#EFE9DF]">
                {selectedDayWins.map((win) => (
                  <li key={win.id} className="py-3 flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <CheckCircle2 className="w-4 h-4 text-[#2C4C3B] mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#231F1D] leading-snug">
                          {win.title}
                        </p>
                        <p className="text-xs text-[#6D645D] mt-0.5">
                          {getPartnerLabel(win.owner)} ·{' '}
                          {ACCOMPLISHMENT_CATEGORY_LABELS[win.category]}
                        </p>
                        {win.reflection && (
                          <p className="text-xs text-[#6D645D] mt-1 leading-relaxed">
                            {win.reflection}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteWin(win.id)}
                      aria-label={`Remove ${win.title}`}
                      className="p-1.5 text-[#6D645D] hover:text-[#8C2F39] rounded-md transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
