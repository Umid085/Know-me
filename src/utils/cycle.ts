import type { CycleLog, CyclePhase, CycleSettings } from '../types/knowme';
import { computeDaysBetween, getTodayDateString, parseLocalDate } from './dates';

export interface PeriodEpisode {
  startDate: string;
  endDate: string;
  lengthDays: number;
  dates: string[];
}

export type CycleStageKey =
  | 'period_early'
  | 'period_late'
  | 'follicular'
  | 'ovulation'
  | 'luteal_early'
  | 'luteal_pms';

export interface CycleStageAdvice {
  key: CycleStageKey;
  phase: CyclePhase;
  title: string;
  shortLabel: string;
  energyLevel: string;
  moodOutlook: string;
  summary: string;
  howToBehave: string[];
  whatToAvoid: string[];
  accentTextClass: string;
  dotClass: string;
}

export interface CycleDayStatus {
  date: string;
  isLoggedPeriod: boolean;
  isPredictedPeriod: boolean;
  isPeriod: boolean;
  periodDayNumber: number | null;
  periodTotalDays: number;
  isFertileWindow: boolean;
  isOvulationDay: boolean;
  phase: CyclePhase | null;
  stageKey: CycleStageKey | null;
  advice: CycleStageAdvice | null;
  cycleDay: number | null;
  isPmsWindow: boolean;
  log?: CycleLog;
}

export interface UpcomingStageItem {
  key: CycleStageKey;
  title: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
  daysUntil: number;
  isCurrent: boolean;
  outlook: string;
  headsUpTip: string;
  accentTextClass: string;
  dotClass: string;
}

export interface CycleSummary {
  episodes: PeriodEpisode[];
  lastPeriodStart: string | null;
  activeCycleStart: string | null;
  effectiveCycleLength: number;
  effectivePeriodLength: number;
  lutealLength: number;
  observedAverageCycle: number | null;
  observedAveragePeriod: number | null;
  nextPeriodDate: string | null;
  daysUntilNextPeriod: number | null;
  ovulationDate: string | null;
  fertileStart: string | null;
  fertileEnd: string | null;
  currentCycleDay: number | null;
  currentPeriodDay: number | null;
  currentPhase: CyclePhase | null;
  currentStageKey: CycleStageKey | null;
  currentAdvice: CycleStageAdvice | null;
  isCurrentlyOnPeriod: boolean;
  isPmsWindow: boolean;
  upcomingStages: UpcomingStageItem[];
}

export const CYCLE_STAGE_ADVICE: Record<CycleStageKey, CycleStageAdvice> = {
  period_early: {
    key: 'period_early',
    phase: 'menstrual',
    title: 'Early Period Days',
    shortLabel: 'Early Period',
    energyLevel: 'Low · Restorative',
    moodOutlook: 'More sensitive, inward, and physically tired',
    summary:
      'Usually the heaviest and most draining days of the cycle. Cramps, fatigue, and low bandwidth are common.',
    howToBehave: [
      'Take small chores, meals, or errands off her plate without waiting to be asked.',
      'Bring warmth and comfort — hot tea, a heating pad, cozy food, and a calm evening at home.',
      'Keep affection gentle and unhurried; listen closely without rushing to solve everything.',
    ],
    whatToAvoid: [
      'Avoid springing surprise busy plans, late nights, or high-energy social commitments.',
      'Hold off on heavy or confrontational discussions unless they are genuinely urgent.',
    ],
    accentTextClass: 'text-[#7B3E52]',
    dotClass: 'bg-[#7B3E52]',
  },
  period_late: {
    key: 'period_late',
    phase: 'menstrual',
    title: 'Late Period Days',
    shortLabel: 'Late Period',
    energyLevel: 'Slowly Rising',
    moodOutlook: 'Lighter than days 1–2, still appreciating ease',
    summary:
      'Discomfort usually starts easing up and energy begins to return gradually, though full stamina is still building.',
    howToBehave: [
      'Offer low-pressure outings like a quiet walk, coffee run, or relaxed dinner.',
      'Check in on her energy before filling up the weekend schedule.',
      'Keep things warm, steady, and supportive while she finishes recovering.',
    ],
    whatToAvoid: [
      'Do not assume energy is back at 100% yet — keep backup options easygoing.',
      'Avoid crowding the calendar with back-to-back obligations.',
    ],
    accentTextClass: 'text-[#7B3E52]',
    dotClass: 'bg-[#7B3E52]',
  },
  follicular: {
    key: 'follicular',
    phase: 'follicular',
    title: 'Follicular Phase',
    shortLabel: 'Follicular',
    energyLevel: 'Rising · Fresh',
    moodOutlook: 'Upbeat, curious, clear-headed, and open to plans',
    summary:
      'Post-period energy climbs steadily. This is typically an optimistic, high-momentum stretch for trying new things together.',
    howToBehave: [
      'Suggest fun date nights, new restaurants, weekend trips, or shared projects.',
      'This is a great window for productive planning talks and big-picture couple goals.',
      'Match her rising momentum with playful energy and initiative.',
    ],
    whatToAvoid: [
      'Avoid letting great-energy days slip by in routine — take advantage to make memories.',
    ],
    accentTextClass: 'text-[#2C4C3B]',
    dotClass: 'bg-[#2C4C3B]',
  },
  ovulation: {
    key: 'ovulation',
    phase: 'ovulation',
    title: 'Ovulation & Peak Window',
    shortLabel: 'Ovulation',
    energyLevel: 'Peak · Social',
    moodOutlook: 'Warm, expressive, confident, and most connected',
    summary:
      'Energy, sociability, and emotional openness usually reach their peak around estimated ovulation.',
    howToBehave: [
      'Prioritize real quality time, romantic dates, and unhurried conversation.',
      'Be present, appreciative, and expressive — compliments and closeness land especially well.',
      'Great time for active outings, social gatherings, or celebrating together.',
    ],
    whatToAvoid: [
      'Avoid staying distracted on screens or postponing meaningful connection during this window.',
    ],
    accentTextClass: 'text-[#A67428]',
    dotClass: 'bg-[#A67428]',
  },
  luteal_early: {
    key: 'luteal_early',
    phase: 'luteal',
    title: 'Early Luteal Phase',
    shortLabel: 'Early Luteal',
    energyLevel: 'Steady · Grounded',
    moodOutlook: 'Calm and focused, gradually shifting toward cozy routines',
    summary:
      'After ovulation, energy levels out into a steadier, more grounded rhythm with a growing preference for comfort and predictability.',
    howToBehave: [
      'Keep plans steady and reliable — follow through on small promises and logistics.',
      'Balance social time with relaxing evenings at home so neither of you burns out.',
      'Start keeping favorite comfort snacks or easy dinner ideas in mind for next week.',
    ],
    whatToAvoid: [
      'Avoid flaky last-minute plan changes that add unnecessary friction.',
    ],
    accentTextClass: 'text-[#5E4E5E]',
    dotClass: 'bg-[#7C6B7D]',
  },
  luteal_pms: {
    key: 'luteal_pms',
    phase: 'luteal',
    title: 'Pre-Period Window (PMS Heads-Up)',
    shortLabel: 'Pre-Period',
    energyLevel: 'Dipping · Sensitive',
    moodOutlook: 'Lower patience, stronger emotions, cravings, or fatigue',
    summary:
      'The final 4–5 days before her period starts. Energy drops and stress or minor annoyances can feel much louder than usual.',
    howToBehave: [
      'Lead with extra patience, warmth, and reassurance — validate feelings before offering advice.',
      'Keep evenings calm, simplify dinner, and stock favorite comfort treats ahead of time.',
      'Give space if she feels quiet, and stay steady without getting defensive.',
    ],
    whatToAvoid: [
      'Do not take irritability, fatigue, or quietness personally or escalate small disagreements.',
      'Avoid saying things like "you are overreacting" or blaming emotions on her cycle.',
    ],
    accentTextClass: 'text-[#8C2F39]',
    dotClass: 'bg-[#8C2F39]',
  },
};

export function addDaysToDateString(dateStr: string, days: number): string {
  const base = parseLocalDate(dateStr);
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function groupPeriodEpisodes(logs: CycleLog[]): PeriodEpisode[] {
  const periodDates = Array.from(
    new Set(logs.filter((l) => l.isPeriodDay).map((l) => l.date))
  ).sort((a, b) => a.localeCompare(b));

  if (periodDates.length === 0) return [];

  const episodes: PeriodEpisode[] = [];
  let currentDates: string[] = [periodDates[0]];

  for (let i = 1; i < periodDates.length; i++) {
    const prev = periodDates[i - 1];
    const curr = periodDates[i];
    const gap = computeDaysBetween(prev, curr);
    if (gap <= 2) {
      currentDates.push(curr);
    } else {
      episodes.push({
        startDate: currentDates[0],
        endDate: currentDates[currentDates.length - 1],
        lengthDays: computeDaysBetween(currentDates[0], currentDates[currentDates.length - 1]) + 1,
        dates: currentDates,
      });
      currentDates = [curr];
    }
  }

  episodes.push({
    startDate: currentDates[0],
    endDate: currentDates[currentDates.length - 1],
    lengthDays: computeDaysBetween(currentDates[0], currentDates[currentDates.length - 1]) + 1,
    dates: currentDates,
  });

  return episodes;
}

function resolveStageKey(
  cycleDay: number,
  cycleLen: number,
  periodLen: number,
  ovulationDayNum: number,
  isLoggedPeriod: boolean
): CycleStageKey {
  if (isLoggedPeriod || cycleDay <= periodLen) {
    return cycleDay <= 2 ? 'period_early' : 'period_late';
  }
  if (cycleDay < ovulationDayNum - 5) {
    return 'follicular';
  }
  if (cycleDay <= ovulationDayNum + 1) {
    return 'ovulation';
  }
  if (cycleDay >= cycleLen - 4) {
    return 'luteal_pms';
  }
  return 'luteal_early';
}

function buildUpcomingStages(
  cycleStart: string,
  cycleLen: number,
  periodLen: number,
  ovulationDayNum: number,
  referenceDate: string
): UpcomingStageItem[] {
  // Build stage windows for the active cycle AND the start of the next cycle so you always see what's coming next
  const fertileStartDay = Math.max(periodLen + 1, ovulationDayNum - 5);
  const fertileEndDay = Math.min(cycleLen - 5, ovulationDayNum + 1);
  const pmsStartDay = Math.max(fertileEndDay + 1, cycleLen - 4);

  const rawWindows: Array<{ key: CycleStageKey; startOffset: number; endOffset: number; cycleShift: number }> = [];

  for (const shift of [0, 1]) {
    const base = shift * cycleLen;
    // Period window
    rawWindows.push({
      key: 'period_early',
      startOffset: base + 0,
      endOffset: base + periodLen - 1,
      cycleShift: shift,
    });
    // Follicular window
    if (fertileStartDay > periodLen + 1) {
      rawWindows.push({
        key: 'follicular',
        startOffset: base + periodLen,
        endOffset: base + fertileStartDay - 2,
        cycleShift: shift,
      });
    }
    // Ovulation / fertile window
    rawWindows.push({
      key: 'ovulation',
      startOffset: base + fertileStartDay - 1,
      endOffset: base + fertileEndDay - 1,
      cycleShift: shift,
    });
    // Early luteal window
    if (pmsStartDay > fertileEndDay + 1) {
      rawWindows.push({
        key: 'luteal_early',
        startOffset: base + fertileEndDay,
        endOffset: base + pmsStartDay - 2,
        cycleShift: shift,
      });
    }
    // Pre-period PMS window
    rawWindows.push({
      key: 'luteal_pms',
      startOffset: base + pmsStartDay - 1,
      endOffset: base + cycleLen - 1,
      cycleShift: shift,
    });
  }

  const items: UpcomingStageItem[] = [];
  for (const win of rawWindows) {
    const startDate = addDaysToDateString(cycleStart, win.startOffset);
    const endDate = addDaysToDateString(cycleStart, win.endOffset);
    if (endDate < referenceDate) continue;

    const isCurrent = referenceDate >= startDate && referenceDate <= endDate;
    const daysUntil = isCurrent ? 0 : computeDaysBetween(referenceDate, startDate);
    const meta = CYCLE_STAGE_ADVICE[win.key];

    const title =
      win.key === 'period_early'
        ? win.cycleShift === 0 && isCurrent
          ? `Current Period (${periodLen} days)`
          : `Next Period (${periodLen} days)`
        : meta.title;

    items.push({
      key: win.key,
      title,
      shortLabel: win.key === 'period_early' ? 'Period' : meta.shortLabel,
      startDate,
      endDate,
      daysUntil,
      isCurrent,
      outlook: meta.moodOutlook,
      headsUpTip: meta.howToBehave[0],
      accentTextClass: meta.accentTextClass,
      dotClass: meta.dotClass,
    });

    if (items.length >= 5) break;
  }

  return items;
}

export function computeCycleSummary(
  logs: CycleLog[],
  settings?: CycleSettings | null,
  referenceDate = getTodayDateString()
): CycleSummary {
  const configuredCycle = settings?.averageCycleLength || 28;
  const configuredPeriod = settings?.averagePeriodLength || 5;
  const lutealLength = settings?.lutealLength || 14;

  const episodes = groupPeriodEpisodes(logs);
  if (episodes.length === 0) {
    return {
      episodes: [],
      lastPeriodStart: null,
      activeCycleStart: null,
      effectiveCycleLength: configuredCycle,
      effectivePeriodLength: configuredPeriod,
      lutealLength,
      observedAverageCycle: null,
      observedAveragePeriod: null,
      nextPeriodDate: null,
      daysUntilNextPeriod: null,
      ovulationDate: null,
      fertileStart: null,
      fertileEnd: null,
      currentCycleDay: null,
      currentPeriodDay: null,
      currentPhase: null,
      currentStageKey: null,
      currentAdvice: null,
      isCurrentlyOnPeriod: false,
      isPmsWindow: false,
      upcomingStages: [],
    };
  }

  const cycleIntervals: number[] = [];
  for (let i = 1; i < episodes.length; i++) {
    const interval = computeDaysBetween(episodes[i - 1].startDate, episodes[i].startDate);
    if (interval >= 20 && interval <= 50) {
      cycleIntervals.push(interval);
    }
  }

  const recentIntervals = cycleIntervals.slice(-6);
  const observedAverageCycle =
    recentIntervals.length > 0
      ? Math.round(recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length)
      : null;

  const recentPeriods = episodes.slice(-6).map((ep) => ep.lengthDays);
  const observedAveragePeriod =
    recentPeriods.length > 0
      ? Math.max(
          2,
          Math.min(10, Math.round(recentPeriods.reduce((a, b) => a + b, 0) / recentPeriods.length))
        )
      : null;

  const effectiveCycleLength = settings ? configuredCycle : observedAverageCycle || configuredCycle;
  const effectivePeriodLength = settings
    ? configuredPeriod
    : observedAveragePeriod || configuredPeriod;

  const pastOrCurrentEpisodes = episodes.filter((ep) => ep.startDate <= referenceDate);
  const anchorEpisode =
    pastOrCurrentEpisodes[pastOrCurrentEpisodes.length - 1] || episodes[episodes.length - 1];
  const lastPeriodStart = anchorEpisode.startDate;

  let cycleStart = lastPeriodStart;
  const diffFromLast = computeDaysBetween(lastPeriodStart, referenceDate);
  if (diffFromLast >= effectiveCycleLength) {
    const cyclesElapsed = Math.floor(diffFromLast / effectiveCycleLength);
    cycleStart = addDaysToDateString(lastPeriodStart, cyclesElapsed * effectiveCycleLength);
  }

  const nextPeriodDate = addDaysToDateString(cycleStart, effectiveCycleLength);
  const daysUntilNextPeriod = computeDaysBetween(referenceDate, nextPeriodDate);
  const ovulationDayNum = Math.max(effectivePeriodLength + 1, effectiveCycleLength - lutealLength);
  const ovulationDate = addDaysToDateString(cycleStart, ovulationDayNum - 1);
  const fertileStart = addDaysToDateString(ovulationDate, -5);
  const fertileEnd = addDaysToDateString(ovulationDate, 1);

  const currentCycleDay = diffFromLast >= 0 ? computeDaysBetween(cycleStart, referenceDate) + 1 : null;
  const todayLog = logs.find((l) => l.date === referenceDate);
  const isLoggedPeriodToday = Boolean(todayLog?.isPeriodDay);
  const isCurrentlyOnPeriod =
    isLoggedPeriodToday ||
    (currentCycleDay !== null && currentCycleDay >= 1 && currentCycleDay <= effectivePeriodLength);

  const currentPeriodDay =
    isCurrentlyOnPeriod && currentCycleDay !== null
      ? Math.min(currentCycleDay, Math.max(effectivePeriodLength, currentCycleDay))
      : null;

  let currentStageKey: CycleStageKey | null = null;
  let currentPhase: CyclePhase | null = null;
  let isPmsWindow = false;

  if (currentCycleDay !== null) {
    currentStageKey = resolveStageKey(
      currentCycleDay,
      effectiveCycleLength,
      effectivePeriodLength,
      ovulationDayNum,
      isLoggedPeriodToday
    );
    currentPhase = CYCLE_STAGE_ADVICE[currentStageKey].phase;
    isPmsWindow = currentStageKey === 'luteal_pms';
  }

  const upcomingStages =
    diffFromLast >= 0
      ? buildUpcomingStages(
          cycleStart,
          effectiveCycleLength,
          effectivePeriodLength,
          ovulationDayNum,
          referenceDate
        )
      : [];

  return {
    episodes,
    lastPeriodStart,
    activeCycleStart: cycleStart,
    effectiveCycleLength,
    effectivePeriodLength,
    lutealLength,
    observedAverageCycle,
    observedAveragePeriod,
    nextPeriodDate,
    daysUntilNextPeriod,
    ovulationDate,
    fertileStart,
    fertileEnd,
    currentCycleDay,
    currentPeriodDay,
    currentPhase,
    currentStageKey,
    currentAdvice: currentStageKey ? CYCLE_STAGE_ADVICE[currentStageKey] : null,
    isCurrentlyOnPeriod,
    isPmsWindow,
    upcomingStages,
  };
}

export function evaluateDateCycleStatus(
  dateStr: string,
  logsByDate: Map<string, CycleLog>,
  summary: CycleSummary
): CycleDayStatus {
  const log = logsByDate.get(dateStr);
  const isLoggedPeriod = Boolean(log?.isPeriodDay);
  const periodLen = summary.effectivePeriodLength;

  if (!summary.lastPeriodStart) {
    const fallbackStage = isLoggedPeriod ? 'period_early' : null;
    return {
      date: dateStr,
      isLoggedPeriod,
      isPredictedPeriod: false,
      isPeriod: isLoggedPeriod,
      periodDayNumber: isLoggedPeriod ? 1 : null,
      periodTotalDays: periodLen,
      isFertileWindow: false,
      isOvulationDay: false,
      phase: isLoggedPeriod ? 'menstrual' : null,
      stageKey: fallbackStage,
      advice: fallbackStage ? CYCLE_STAGE_ADVICE[fallbackStage] : null,
      cycleDay: null,
      isPmsWindow: false,
      log,
    };
  }

  const cycleLen = summary.effectiveCycleLength;
  const lutealLen = summary.lutealLength;

  const episodes = summary.episodes;
  let anchorStart: string | null = null;
  let isProjectedCycle = false;

  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    const nextEp = episodes[i + 1];
    if (dateStr >= ep.startDate && (!nextEp || dateStr < nextEp.startDate)) {
      anchorStart = ep.startDate;
      break;
    }
  }

  if (!anchorStart) {
    return {
      date: dateStr,
      isLoggedPeriod,
      isPredictedPeriod: false,
      isPeriod: isLoggedPeriod,
      periodDayNumber: isLoggedPeriod ? 1 : null,
      periodTotalDays: periodLen,
      isFertileWindow: false,
      isOvulationDay: false,
      phase: isLoggedPeriod ? 'menstrual' : null,
      stageKey: isLoggedPeriod ? 'period_early' : null,
      advice: isLoggedPeriod ? CYCLE_STAGE_ADVICE.period_early : null,
      cycleDay: null,
      isPmsWindow: false,
      log,
    };
  }

  let dayOffset = computeDaysBetween(anchorStart, dateStr);
  const latestStart = episodes[episodes.length - 1].startDate;

  if (anchorStart === latestStart && dayOffset >= cycleLen) {
    if (dayOffset > 210) {
      return {
        date: dateStr,
        isLoggedPeriod,
        isPredictedPeriod: false,
        isPeriod: false,
        periodDayNumber: null,
        periodTotalDays: periodLen,
        isFertileWindow: false,
        isOvulationDay: false,
        phase: null,
        stageKey: null,
        advice: null,
        cycleDay: null,
        isPmsWindow: false,
        log,
      };
    }
    const cyclesAhead = Math.floor(dayOffset / cycleLen);
    dayOffset = dayOffset - cyclesAhead * cycleLen;
    isProjectedCycle = true;
  }

  const cycleDay = dayOffset + 1;
  const isPredictedPeriod =
    !isLoggedPeriod &&
    cycleDay <= periodLen &&
    (isProjectedCycle || dateStr >= getTodayDateString());
  const isPeriod = isLoggedPeriod || isPredictedPeriod;
  const periodDayNumber = isPeriod ? cycleDay : null;

  const ovulationDayNum = Math.max(periodLen + 1, cycleLen - lutealLen);
  const isOvulationDay = !isPeriod && cycleDay === ovulationDayNum;
  const isFertileWindow =
    !isPeriod && cycleDay >= ovulationDayNum - 5 && cycleDay <= ovulationDayNum + 1;
  const isPmsWindow = !isPeriod && cycleDay >= cycleLen - 4 && cycleDay <= cycleLen;

  const stageKey = resolveStageKey(cycleDay, cycleLen, periodLen, ovulationDayNum, isLoggedPeriod);
  const advice = CYCLE_STAGE_ADVICE[stageKey];

  return {
    date: dateStr,
    isLoggedPeriod,
    isPredictedPeriod,
    isPeriod,
    periodDayNumber,
    periodTotalDays: periodLen,
    isFertileWindow,
    isOvulationDay,
    phase: advice.phase,
    stageKey,
    advice,
    cycleDay,
    isPmsWindow,
    log,
  };
}
