import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import {
  deletePeriodSpan,
  logPeriodSpan,
  upsertCycleSettings,
} from '../services/spaceService';
import type { CycleLog, PartnerSlot } from '../types/knowme';
import { computeCycleSummary, evaluateDateCycleStatus } from '../utils/cycle';
import {
  buildMonthGrid,
  formatMonthYear,
  formatReadableDate,
  formatShortDate,
  getTodayDateString,
  parseLocalDate,
} from '../utils/dates';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CycleCalendarViewProps {
  openQuickLogSignal: number;
}

function formatCompactRange(startDate: string, endDate: string): string {
  const start = formatShortDate(startDate).replace(/,\s*\d{4}$/, '');
  if (startDate === endDate) return start;
  const end = formatShortDate(endDate).replace(/,\s*\d{4}$/, '');
  return `${start} – ${end}`;
}

export function CycleCalendarView({ openQuickLogSignal }: CycleCalendarViewProps) {
  const {
    user,
    space,
    currentUserSlot,
    cycleSettings,
    cycleLogs,
    getPartnerLabel,
    showToast,
  } = useSpace();

  const today = getTodayDateString();
  const initialDate = parseLocalDate(today);

  // Pick initial partner: whoever has cycle settings/logs, else the other partner if paired, else partnerB
  const defaultPartnerSlot = useMemo<PartnerSlot>(() => {
    const enabledSetting = cycleSettings.find((s) => s.enabled);
    if (enabledSetting) return enabledSetting.partnerSlot;
    if (cycleLogs.length > 0) return cycleLogs[0].partnerSlot;
    return currentUserSlot === 'partnerA' ? 'partnerB' : 'partnerA';
  }, [cycleSettings, cycleLogs, currentUserSlot]);

  const [trackedSlot, setTrackedSlot] = useState<PartnerSlot>(defaultPartnerSlot);
  const [hasPickedSlot, setHasPickedSlot] = useState(false);

  React.useEffect(() => {
    if (!hasPickedSlot) {
      setTrackedSlot(defaultPartnerSlot);
    }
  }, [defaultPartnerSlot, hasPickedSlot]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  // Compact setup / update drawer (only start date, cycle length, period length — zero notes)
  const [showSetupDrawer, setShowSetupDrawer] = useState(false);
  const [startDateDraft, setStartDateDraft] = useState(today);
  const [cycleLengthDraft, setCycleLengthDraft] = useState(28);
  const [periodLengthDraft, setPeriodLengthDraft] = useState(5);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (openQuickLogSignal > 0) {
      setStartDateDraft(selectedDate || today);
      setShowSetupDrawer(true);
    }
  }, [openQuickLogSignal, selectedDate, today]);

  const slotSettings = useMemo(
    () => cycleSettings.find((s) => s.partnerSlot === trackedSlot) || null,
    [cycleSettings, trackedSlot]
  );

  const slotLogs = useMemo(
    () => cycleLogs.filter((l) => l.partnerSlot === trackedSlot),
    [cycleLogs, trackedSlot]
  );

  const logsByDate = useMemo(() => {
    const map = new Map<string, CycleLog>();
    for (const log of slotLogs) {
      map.set(log.date, log);
    }
    return map;
  }, [slotLogs]);

  const summary = useMemo(
    () => computeCycleSummary(slotLogs, slotSettings, today),
    [slotLogs, slotSettings, today]
  );

  React.useEffect(() => {
    setCycleLengthDraft(slotSettings?.averageCycleLength || 28);
    setPeriodLengthDraft(slotSettings?.averagePeriodLength || 5);
  }, [slotSettings]);

  const calendarCells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const selectedDayStatus = useMemo(
    () => evaluateDateCycleStatus(selectedDate, logsByDate, summary),
    [selectedDate, logsByDate, summary]
  );

  const selectedEpisode = useMemo(
    () =>
      summary.episodes.find(
        (ep) => selectedDate >= ep.startDate && selectedDate <= ep.endDate
      ) || null,
    [summary.episodes, selectedDate]
  );

  function stepMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function jumpToDate(dateStr: string) {
    const d = parseLocalDate(dateStr);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(dateStr);
  }

  async function savePeriodStartAndLengths(
    startDate: string,
    cycleLen: number,
    periodLen: number,
    alsoLogPeriod = true
  ) {
    if (!space || !user) return;
    setSaving(true);
    try {
      await upsertCycleSettings(space.id, user.uid, {
        partnerSlot: trackedSlot,
        enabled: true,
        averageCycleLength: cycleLen,
        averagePeriodLength: periodLen,
        lutealLength: slotSettings?.lutealLength || 14,
        careNotes: slotSettings?.careNotes || '',
        existsAlready: Boolean(slotSettings),
      });

      if (alsoLogPeriod && startDate) {
        const existingDates = new Set(slotLogs.map((l) => l.date));
        await logPeriodSpan(space.id, user.uid, {
          startDate,
          daysCount: periodLen,
          partnerSlot: trackedSlot,
          existingDates,
        });
        jumpToDate(startDate);
      }

      setShowSetupDrawer(false);
      showToast(
        alsoLogPeriod
          ? `Updated period start to ${formatShortDate(startDate)} (${cycleLen}-day cycle, ${periodLen}-day period).`
          : `Saved cycle length (${cycleLen}d) and period length (${periodLen}d).`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update cycle calendar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    await savePeriodStartAndLengths(startDateDraft, cycleLengthDraft, periodLengthDraft, true);
  }

  async function handleSaveLengthsOnly() {
    await savePeriodStartAndLengths('', cycleLengthDraft, periodLengthDraft, false);
  }

  async function handleRemoveEpisode(dates: string[]) {
    if (!space) return;
    setSaving(true);
    try {
      await deletePeriodSpan(space.id, trackedSlot, dates);
      showToast('Removed logged period dates.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not remove period dates.');
    } finally {
      setSaving(false);
    }
  }

  if (!space) return null;

  const trackedName = getPartnerLabel(trackedSlot);
  const hasCycleData = Boolean(summary.lastPeriodStart && summary.currentAdvice);

  return (
    <div className="space-y-7">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-[#E5DDD1]">
        <div className="space-y-1.5">
          <p className="text-xs font-mono text-[#7B3E52] tabular-nums">
            Partner Cycle Guide · {trackedName}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#231F1D]">
            Cycle Calendar
          </h1>
          <p className="text-sm text-[#6D645D] max-w-2xl">
            Glance at what day of {trackedName}&apos;s period or cycle today is, how to show up
            thoughtfully right now, and what happens next — without taking daily notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Partner selector */}
          <div className="inline-flex items-center gap-1 p-1 bg-[#F2EDE4] rounded-lg">
            {(['partnerA', 'partnerB'] as PartnerSlot[]).map((slot) => {
              const active = trackedSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => {
                    setTrackedSlot(slot);
                    setHasPickedSlot(true);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-[#231F1D] shadow-xs'
                      : 'text-[#6D645D] hover:text-[#231F1D]'
                  }`}
                >
                  {getPartnerLabel(slot)}
                </button>
              );
            })}
          </div>

          {hasCycleData && (
            <button
              type="button"
              onClick={() => {
                setStartDateDraft(summary.lastPeriodStart || today);
                setShowSetupDrawer((v) => !v);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                showSetupDrawer
                  ? 'bg-[#231F1D] text-white border-[#231F1D]'
                  : 'bg-white text-[#231F1D] border-[#E5DDD1] hover:bg-[#F2EDE4]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Set Cycle Dates</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Setup / Update Panel (3 simple numbers/date, zero note fields) */}
      {(!hasCycleData || showSetupDrawer) && (
        <section className="bg-white border border-[#E5DDD1] rounded-xl p-6 sm:p-7 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-serif text-2xl font-normal text-[#231F1D]">
                {hasCycleData
                  ? `Update ${trackedName}'s cycle timing`
                  : `Set ${trackedName}'s last period start date`}
              </h2>
              <p className="text-sm text-[#6D645D]">
                Just pick one date — Know Me calculates today&apos;s period day, partner advice,
                and upcoming stages automatically.
              </p>
            </div>
            {hasCycleData && (
              <button
                type="button"
                onClick={() => setShowSetupDrawer(false)}
                aria-label="Close setup panel"
                className="p-1.5 text-[#6D645D] hover:text-[#231F1D] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleFormSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <label className="sm:col-span-4 block space-y-1.5">
              <span className="text-xs font-medium text-[#231F1D]">Last period start date</span>
              <input
                type="date"
                required
                value={startDateDraft}
                onChange={(e) => setStartDateDraft(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#7B3E52]"
              />
            </label>

            <label className="sm:col-span-2 block space-y-1.5">
              <span className="text-xs font-medium text-[#231F1D]">Cycle (days)</span>
              <input
                type="number"
                min={21}
                max={45}
                required
                value={cycleLengthDraft}
                onChange={(e) => setCycleLengthDraft(Number(e.target.value) || 28)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
              />
            </label>

            <label className="sm:col-span-2 block space-y-1.5">
              <span className="text-xs font-medium text-[#231F1D]">Period (days)</span>
              <input
                type="number"
                min={2}
                max={10}
                required
                value={periodLengthDraft}
                onChange={(e) => setPeriodLengthDraft(Number(e.target.value) || 5)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
              />
            </label>

            <div className="sm:col-span-4 flex flex-wrap items-center justify-end gap-2">
              {hasCycleData && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveLengthsOnly()}
                  className="px-3.5 py-2.5 text-xs font-medium text-[#231F1D] bg-[#FAF7F2] border border-[#E5DDD1] hover:bg-[#F2EDE4] rounded-lg transition-colors whitespace-nowrap"
                >
                  Save lengths only
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-[#7B3E52] hover:bg-[#653042] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Period Start'}</span>
              </button>
            </div>
          </form>

          {!hasCycleData && (
            <div className="pt-3 border-t border-[#EFE9DF] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6D645D]">
              <span>Did her period start today?</span>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void savePeriodStartAndLengths(today, cycleLengthDraft, periodLengthDraft, true)
                }
                className="font-medium text-[#7B3E52] hover:underline whitespace-nowrap"
              >
                Mark period started today ({formatShortDate(today)})
              </button>
            </div>
          )}
        </section>
      )}

      {/* Main Content once a period start date is known */}
      {hasCycleData && summary.currentAdvice && (
        <>
          {/* HERO BRIEFING: Right Now — Exact Period/Cycle Day + How to Behave */}
          <section className="bg-white border border-[#E5DDD1] rounded-xl grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#EFE9DF]">
            {/* Left 5 Cols: Instant Status */}
            <div className="lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-mono text-[#6D645D] tabular-nums">
                  Right Now · {formatReadableDate(today)}
                </p>

                {summary.isCurrentlyOnPeriod && summary.currentPeriodDay ? (
                  <div className="space-y-1.5">
                    <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#7B3E52] leading-tight">
                      Day {summary.currentPeriodDay} of {summary.effectivePeriodLength} of her
                      period
                    </h2>
                    <p className="text-sm text-[#6D645D] tabular-nums">
                      {Math.max(0, summary.effectivePeriodLength - summary.currentPeriodDay) === 0
                        ? 'Final estimated day of this period'
                        : `${
                            summary.effectivePeriodLength - summary.currentPeriodDay
                          } ${
                            summary.effectivePeriodLength - summary.currentPeriodDay === 1
                              ? 'day'
                              : 'days'
                          } remaining`}
                      {' · '}Cycle Day {summary.currentCycleDay} of {summary.effectiveCycleLength}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <h2
                      className={`font-serif text-3xl sm:text-4xl font-normal leading-tight ${summary.currentAdvice.accentTextClass}`}
                    >
                      {summary.currentAdvice.title}
                    </h2>
                    <p className="text-sm text-[#231F1D] font-mono tabular-nums">
                      Cycle Day {summary.currentCycleDay} of {summary.effectiveCycleLength}
                      {summary.nextPeriodDate && summary.daysUntilNextPeriod !== null && (
                        <span className="text-[#6D645D]">
                          {' · '}
                          {summary.daysUntilNextPeriod === 0
                            ? 'Next period expected today'
                            : `Next period in ${summary.daysUntilNextPeriod} ${
                                summary.daysUntilNextPeriod === 1 ? 'day' : 'days'
                              } (${formatShortDate(summary.nextPeriodDate).replace(/,\s*\d{4}$/, '')})`}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <p className="text-sm text-[#6D645D] leading-relaxed pt-1">
                  {summary.currentAdvice.summary}
                </p>
              </div>

              <div className="pt-4 border-t border-[#EFE9DF] space-y-3">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-[#6D645D]">Typical Energy</p>
                    <p className="font-medium text-[#231F1D] mt-0.5">
                      {summary.currentAdvice.energyLevel}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#6D645D]">Emotional Climate</p>
                    <p className="font-medium text-[#231F1D] mt-0.5">
                      {summary.currentAdvice.moodOutlook}
                    </p>
                  </div>
                </div>

                {!summary.isCurrentlyOnPeriod && (
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void savePeriodStartAndLengths(
                          today,
                          summary.effectiveCycleLength,
                          summary.effectivePeriodLength,
                          true
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#7B3E52] bg-[#7B3E52]/[0.08] hover:bg-[#7B3E52]/15 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Droplets className="w-3.5 h-3.5" />
                      <span>Period started today</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right 7 Cols: Practical Partner Playbook for Right Now */}
            <div className="lg:col-span-7 p-6 sm:p-7 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-mono text-[#2C4C3B]">How to Behave Today</p>
                <ul className="space-y-3">
                  {summary.currentAdvice.howToBehave.map((tip) => (
                    <li key={tip} className="flex items-start gap-3 text-sm text-[#231F1D] leading-relaxed">
                      <Check className="w-4 h-4 text-[#2C4C3B] mt-0.5 shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-5 border-t border-[#EFE9DF] space-y-3">
                <p className="text-xs font-mono text-[#8C2F39]">What to Avoid Right Now</p>
                <ul className="space-y-2.5">
                  {summary.currentAdvice.whatToAvoid.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-[#6D645D] leading-relaxed">
                      <AlertCircle className="w-4 h-4 text-[#8C2F39] mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* WHAT HAPPENS NOW & NEXT — Ahead-of-Time Forecast */}
          <section className="bg-white border border-[#E5DDD1] rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#2C4C3B]" />
                <h3 className="font-serif text-xl font-normal text-[#231F1D]">
                  What Happens Now &amp; Next
                </h3>
              </div>
              <p className="text-xs text-[#6D645D]">
                Know beforehand when energy rises, when pre-period sensitivity starts, and when her
                next period arrives.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-[#EFE9DF] border-t border-[#EFE9DF]">
              {summary.upcomingStages.map((stage) => (
                <button
                  key={`${stage.key}-${stage.startDate}`}
                  type="button"
                  onClick={() => jumpToDate(stage.startDate)}
                  className={`p-4 text-left flex flex-col justify-between gap-3 transition-colors hover:bg-[#FAF7F2] ${
                    stage.isCurrent ? 'bg-[#FAF7F2]/80' : ''
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-mono tabular-nums ${stage.accentTextClass}`}>
                        {stage.isCurrent
                          ? 'Now'
                          : stage.daysUntil === 1
                          ? 'Tomorrow'
                          : `In ${stage.daysUntil} days`}
                      </span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${stage.dotClass}`} />
                    </div>
                    <p className="text-sm font-semibold text-[#231F1D] leading-snug">
                      {stage.title}
                    </p>
                    <p className="text-[11px] font-mono text-[#6D645D] tabular-nums">
                      {formatCompactRange(stage.startDate, stage.endDate)}
                    </p>
                  </div>
                  <p className="text-xs text-[#6D645D] leading-relaxed">{stage.headsUpTip}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Month Navigation & Legend */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-3">
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
              <h2 className="font-serif text-2xl font-normal text-[#231F1D]">
                {formatMonthYear(viewYear, viewMonth)}
              </h2>
              <button
                type="button"
                onClick={() => jumpToDate(today)}
                className="ml-1 px-3 py-1.5 text-xs font-medium text-[#231F1D] bg-white border border-[#E5DDD1] hover:bg-[#F2EDE4] rounded-lg transition-colors whitespace-nowrap"
              >
                Today
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#6D645D]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-xs bg-[#7B3E52]" />
                <span>Period days</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-xs border border-dashed border-[#7B3E52] bg-[#7B3E52]/10" />
                <span>Next expected period</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-xs bg-[#8C2F39]/25 border border-[#8C2F39]/50" />
                <span>Pre-period (PMS)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-xs bg-[#A67428]/25 border border-[#A67428]/60" />
                <span>Ovulation / peak</span>
              </span>
            </div>
          </div>

          {/* 8-Col Monthly Grid + 4-Col Read-Only Date Advice Preview */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
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
                  const status = evaluateDateCycleStatus(cell.dateStr, logsByDate, summary);
                  const isSelected = selectedDate === cell.dateStr;

                  let cellBg = cell.inCurrentMonth
                    ? 'bg-white hover:bg-[#FAF7F2]'
                    : 'bg-[#FAF7F2]/60 text-[#6D645D]/50 hover:bg-[#F2EDE4]/50';

                  if (status.isLoggedPeriod) {
                    cellBg = isSelected
                      ? 'bg-[#7B3E52]/18'
                      : 'bg-[#7B3E52]/10 hover:bg-[#7B3E52]/15';
                  } else if (status.isPredictedPeriod) {
                    cellBg = isSelected
                      ? 'bg-[#7B3E52]/12'
                      : 'bg-[#7B3E52]/[0.05] hover:bg-[#7B3E52]/[0.09]';
                  } else if (status.isPmsWindow) {
                    cellBg = isSelected
                      ? 'bg-[#8C2F39]/14'
                      : 'bg-[#8C2F39]/[0.05] hover:bg-[#8C2F39]/[0.09]';
                  } else if (status.isFertileWindow) {
                    cellBg = isSelected
                      ? 'bg-[#A67428]/16'
                      : 'bg-[#A67428]/[0.07] hover:bg-[#A67428]/12';
                  } else if (isSelected) {
                    cellBg = 'bg-[#2C4C3B]/[0.08]';
                  }

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(cell.dateStr)}
                      className={`min-h-[86px] sm:min-h-[98px] p-2 sm:p-2.5 text-left flex flex-col justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7B3E52] ${cellBg} ${
                        isSelected ? 'ring-1 ring-inset ring-[#231F1D]/45' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span
                          className={`font-mono text-xs tabular-nums inline-flex items-center justify-center w-6 h-6 rounded-md ${
                            cell.isToday
                              ? 'bg-[#231F1D] text-white font-medium'
                              : isSelected
                              ? 'text-[#231F1D] font-semibold'
                              : cell.inCurrentMonth
                              ? 'text-[#231F1D]'
                              : 'text-[#6D645D]/50'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                        {status.cycleDay !== null && cell.inCurrentMonth && (
                          <span className="font-mono text-[10px] text-[#6D645D] tabular-nums">
                            D{status.cycleDay}
                          </span>
                        )}
                      </div>

                      <div className="w-full my-1">
                        {status.isLoggedPeriod ? (
                          <div className="h-2 w-full rounded-xs bg-[#7B3E52]" />
                        ) : status.isPredictedPeriod ? (
                          <div className="h-2 w-full rounded-xs border border-dashed border-[#7B3E52] bg-[#7B3E52]/10" />
                        ) : status.isPmsWindow ? (
                          <div className="h-1.5 w-full rounded-xs bg-[#8C2F39]/35" />
                        ) : status.isOvulationDay ? (
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#A67428] shrink-0" />
                            <span className="h-1 flex-1 rounded-full bg-[#A67428]/45" />
                          </div>
                        ) : status.isFertileWindow ? (
                          <div className="h-1.5 w-full rounded-xs bg-[#A67428]/35" />
                        ) : null}
                      </div>

                      <div className="w-full min-h-[16px]">
                        {status.isLoggedPeriod && status.periodDayNumber ? (
                          <span className="text-[11px] font-medium text-[#7B3E52] truncate block tabular-nums">
                            Period D{status.periodDayNumber}
                          </span>
                        ) : status.isPredictedPeriod && status.periodDayNumber ? (
                          <span className="text-[10px] font-medium text-[#7B3E52]/85 truncate block tabular-nums">
                            Est. D{status.periodDayNumber}
                          </span>
                        ) : status.isPmsWindow ? (
                          <span className="text-[10px] font-medium text-[#8C2F39] truncate block">
                            Pre-period
                          </span>
                        ) : status.isOvulationDay ? (
                          <span className="text-[10px] font-semibold text-[#8A5D1B] truncate block">
                            Ovulation
                          </span>
                        ) : status.isFertileWindow ? (
                          <span className="text-[10px] text-[#8A5D1B] truncate block">Peak</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right 4-Col Glanceable Date Briefing (zero forms/notes — pure insight) */}
            <aside className="xl:col-span-4 bg-white border border-[#E5DDD1] rounded-xl p-6 space-y-5">
              <div className="pb-4 border-b border-[#EFE9DF] space-y-1.5">
                <p className="text-xs font-mono text-[#6D645D] tabular-nums">
                  {selectedDate === today ? 'Today’s Briefing' : 'Selected Date Preview'}
                </p>
                <h3 className="font-serif text-2xl font-normal text-[#231F1D]">
                  {formatReadableDate(selectedDate, true)}
                </h3>
                {selectedDayStatus.isPeriod && selectedDayStatus.periodDayNumber ? (
                  <p className="text-sm font-medium text-[#7B3E52] tabular-nums">
                    {selectedDayStatus.isLoggedPeriod ? 'Period' : 'Expected Period'} Day{' '}
                    {selectedDayStatus.periodDayNumber} of {selectedDayStatus.periodTotalDays}
                  </p>
                ) : selectedDayStatus.advice && selectedDayStatus.cycleDay ? (
                  <p
                    className={`text-sm font-medium tabular-nums ${selectedDayStatus.advice.accentTextClass}`}
                  >
                    {selectedDayStatus.advice.title} · Cycle Day {selectedDayStatus.cycleDay}
                  </p>
                ) : (
                  <p className="text-xs text-[#6D645D]">
                    Before first logged period start date.
                  </p>
                )}
              </div>

              {selectedDayStatus.advice ? (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <p className="text-xs text-[#6D645D]">What to expect</p>
                    <p className="text-sm text-[#231F1D] leading-relaxed">
                      {selectedDayStatus.advice.summary}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-[#EFE9DF]">
                    <p className="text-xs font-mono text-[#2C4C3B]">How to behave</p>
                    <ul className="space-y-2">
                      {selectedDayStatus.advice.howToBehave.map((tip) => (
                        <li
                          key={tip}
                          className="flex items-start gap-2.5 text-xs text-[#231F1D] leading-relaxed"
                        >
                          <Check className="w-3.5 h-3.5 text-[#2C4C3B] mt-0.5 shrink-0" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-[#EFE9DF]">
                    <p className="text-xs font-mono text-[#8C2F39]">Keep in mind</p>
                    <ul className="space-y-1.5">
                      {selectedDayStatus.advice.whatToAvoid.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 text-xs text-[#6D645D] leading-relaxed"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-[#8C2F39] mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#6D645D] leading-relaxed">
                  Select any date on or after her logged period start to see what stage she is in
                  and how to support her.
                </p>
              )}

              {/* One-tap date action without any forms */}
              <div className="pt-4 border-t border-[#EFE9DF] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void savePeriodStartAndLengths(
                      selectedDate,
                      summary.effectiveCycleLength,
                      summary.effectivePeriodLength,
                      true
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#7B3E52] bg-[#7B3E52]/[0.08] hover:bg-[#7B3E52]/15 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>Period started on this date</span>
                </button>

                {selectedEpisode && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleRemoveEpisode(selectedEpisode.dates)}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs text-[#6D645D] hover:text-[#8C2F39] transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
