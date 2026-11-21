import {
  BUSYNESS_META,
  DEFAULT_NOTIFICATION_PREFS,
  type Accomplishment,
  type AppNotification,
  type BusynessLog,
  type CoupleSpace,
  type CycleLog,
  type CycleSettings,
  type NotificationPrefs,
  type PartnerEntry,
  type PartnerSlot,
  type PlannerItem,
  type TimelineEvent,
} from '../types/knowme';
import { addDaysToDateString, computeCycleSummary } from './cycle';
import {
  computeDaysBetween,
  formatShortDate,
  getNextOccurrenceDays,
  getTodayDateString,
} from './dates';

export interface NotificationSourceData {
  userId: string;
  currentUserSlot: PartnerSlot;
  space: CoupleSpace;
  partnerEntries: PartnerEntry[];
  plannerItems: PlannerItem[];
  timelineEvents: TimelineEvent[];
  busynessLogs: BusynessLog[];
  accomplishments: Accomplishment[];
  cycleSettings: CycleSettings[];
  cycleLogs: CycleLog[];
  prefs: NotificationPrefs | null;
  referenceDate?: string;
}

const PRIORITY_RANK = { high: 0, normal: 1, info: 2 } as const;

export function buildModuleNotifications(data: NotificationSourceData): AppNotification[] {
  const today = data.referenceDate || getTodayDateString();
  const tomorrow = addDaysToDateString(today, 1);
  const prefs = data.prefs || {
    spaceId: data.space.id,
    uid: data.userId,
    ...DEFAULT_NOTIFICATION_PREFS,
  };
  const dismissedSet = new Set(prefs.dismissedIds || []);
  const otherSlot: PartnerSlot = data.currentUserSlot === 'partnerA' ? 'partnerB' : 'partnerA';
  const otherName =
    otherSlot === 'partnerA' ? data.space.partnerAName : data.space.partnerBName;

  const list: AppNotification[] = [];

  const push = (item: Omit<AppNotification, 'isDismissed'>) => {
    list.push({
      ...item,
      isDismissed: dismissedSet.has(item.id),
    });
  };

  // 1. CYCLE CALENDAR NOTIFICATIONS
  if (prefs.cycleEnabled) {
    const trackedSlot =
      data.cycleSettings.find((s) => s.enabled)?.partnerSlot ||
      data.cycleLogs[0]?.partnerSlot ||
      null;

    if (trackedSlot) {
      const trackedName =
        trackedSlot === 'partnerA' ? data.space.partnerAName : data.space.partnerBName;
      const slotLogs = data.cycleLogs.filter((l) => l.partnerSlot === trackedSlot);
      const slotSetting = data.cycleSettings.find((s) => s.partnerSlot === trackedSlot) || null;
      const summary = computeCycleSummary(slotLogs, slotSetting, today);

      if (summary.lastPeriodStart && summary.currentAdvice) {
        // Active period days (especially Day 1 & Day 2)
        if (summary.isCurrentlyOnPeriod && summary.currentPeriodDay) {
          const remaining = Math.max(0, summary.effectivePeriodLength - summary.currentPeriodDay);
          push({
            id: `cycle_period_${summary.activeCycleStart}_d${summary.currentPeriodDay}`,
            module: 'cycle',
            targetTab: 'cycle',
            priority: summary.currentPeriodDay <= 2 ? 'high' : 'normal',
            timingLabel: `Period Day ${summary.currentPeriodDay} of ${summary.effectivePeriodLength}`,
            title: `${trackedName} is on Day ${summary.currentPeriodDay} of her period`,
            body: `${summary.currentAdvice.howToBehave[0]}${
              remaining > 0 ? ` (${remaining}d remaining)` : ' (Final estimated day)'
            }`,
            actionLabel: 'View today’s guide',
          });
        } else if (summary.isPmsWindow && summary.nextPeriodDate && summary.daysUntilNextPeriod !== null) {
          // Currently in Pre-Period / PMS window
          push({
            id: `cycle_pms_active_${summary.nextPeriodDate}_${today}`,
            module: 'cycle',
            targetTab: 'cycle',
            priority: 'high',
            timingLabel:
              summary.daysUntilNextPeriod === 0
                ? 'Period expected today'
                : `${summary.daysUntilNextPeriod}d before period`,
            title: `Pre-period window active for ${trackedName}`,
            body: summary.currentAdvice.howToBehave[0],
            actionLabel: 'See how to show up',
          });
        } else {
          // Upcoming Pre-Period heads-up before it starts
          const upcomingPms = summary.upcomingStages.find(
            (s) => s.key === 'luteal_pms' && !s.isCurrent
          );
          if (upcomingPms && upcomingPms.daysUntil <= prefs.cycleLeadDays) {
            push({
              id: `cycle_pms_ahead_${upcomingPms.startDate}`,
              module: 'cycle',
              targetTab: 'cycle',
              priority: 'normal',
              timingLabel:
                upcomingPms.daysUntil === 1
                  ? 'Starts tomorrow'
                  : `Starts in ${upcomingPms.daysUntil} days`,
              title: `Pre-period window starts ${formatShortDate(upcomingPms.startDate).replace(/,\s*\d{4}$/, '')}`,
              body: `Heads-up: ${upcomingPms.headsUpTip}`,
              actionLabel: 'Check forecast',
            });
          }

          // Upcoming Peak / Ovulation window arriving today or tomorrow
          const peakStage = summary.upcomingStages.find((s) => s.key === 'ovulation');
          if (peakStage && (peakStage.isCurrent || peakStage.daysUntil === 1)) {
            push({
              id: `cycle_peak_${peakStage.startDate}`,
              module: 'cycle',
              targetTab: 'cycle',
              priority: 'info',
              timingLabel: peakStage.isCurrent ? 'Active now' : 'Starts tomorrow',
              title: `${trackedName}'s peak energy window`,
              body: peakStage.headsUpTip,
              actionLabel: 'View Cycle Calendar',
            });
          }
        }
      }
    }
  }

  // 2. NOTABLE DATES TIMELINE NOTIFICATIONS
  if (prefs.timelineEnabled) {
    for (const ev of data.timelineEvents) {
      const occ = getNextOccurrenceDays(ev.date, ev.recurringYearly);
      if (occ.isPastNonRecurring) continue;
      if (occ.daysUntil >= 0 && occ.daysUntil <= prefs.timelineLeadDays) {
        const isUrgent = occ.daysUntil <= 1;
        const yearSuffix =
          ev.recurringYearly && occ.yearsCount > 0 ? ` (Year ${occ.yearsCount})` : '';
        push({
          id: `timeline_${ev.id}_${occ.nextDateStr}_${occ.daysUntil <= 1 ? 'soon' : 'ahead'}`,
          module: 'timeline',
          targetTab: 'timeline',
          priority: isUrgent ? 'high' : 'normal',
          timingLabel:
            occ.daysUntil === 0
              ? 'Today'
              : occ.daysUntil === 1
              ? 'Tomorrow'
              : `In ${occ.daysUntil} days`,
          title: `${ev.title}${yearSuffix}`,
          body: `${formatShortDate(occ.nextDateStr)}${ev.location ? ` · ${ev.location}` : ''}${
            ev.story ? ` — ${ev.story.slice(0, 90)}${ev.story.length > 90 ? '…' : ''}` : ''
          }`,
          actionLabel: 'Open Timeline',
        });
      }
    }
  }

  // 3. SHARED PLANNER NOTIFICATIONS
  if (prefs.plannerEnabled) {
    for (const item of data.plannerItems) {
      if (item.completed || !item.dueDate) continue;
      const daysUntil = computeDaysBetween(today, item.dueDate);
      if (daysUntil <= prefs.plannerLeadDays) {
        const isOverdue = daysUntil < 0;
        const isToday = daysUntil === 0;
        const assigneeLabel =
          item.assignee === 'together'
            ? 'Together'
            : item.assignee === 'partnerA'
            ? data.space.partnerAName
            : data.space.partnerBName;

        push({
          id: `planner_${item.id}_${item.dueDate}_${isOverdue ? 'overdue' : isToday ? 'today' : 'due'}`,
          module: 'planner',
          targetTab: 'planner',
          priority: isOverdue || isToday ? 'high' : 'normal',
          timingLabel: isOverdue
            ? `${Math.abs(daysUntil)}d overdue`
            : isToday
            ? 'Due today'
            : daysUntil === 1
            ? 'Due tomorrow'
            : `Due in ${daysUntil} days`,
          title: item.title,
          body: `Assigned to ${assigneeLabel} · ${formatShortDate(item.dueDate)}${
            item.notes ? ` — ${item.notes.slice(0, 80)}${item.notes.length > 80 ? '…' : ''}` : ''
          }`,
          actionLabel: 'Open Planner',
        });
      }
    }
  }

  // 4. CALENDAR & WINS NOTIFICATIONS (Partner Heavy Bandwidth & Partner Wins)
  if (prefs.calendarEnabled) {
    const partnerHeavyToday = data.busynessLogs.find(
      (l) => l.partnerSlot === otherSlot && l.date === today && (l.level === 'busy' || l.level === 'packed')
    );
    if (partnerHeavyToday) {
      const meta = BUSYNESS_META[partnerHeavyToday.level];
      push({
        id: `calendar_busy_${partnerHeavyToday.id}_${partnerHeavyToday.level}`,
        module: 'calendar',
        targetTab: 'calendar',
        priority: partnerHeavyToday.level === 'packed' ? 'high' : 'normal',
        timingLabel: 'Today’s bandwidth',
        title: `${otherName} is ${meta.label} today`,
        body: partnerHeavyToday.note || meta.description,
        actionLabel: 'Check Calendar',
      });
    }

    const partnerHeavyTomorrow = data.busynessLogs.find(
      (l) => l.partnerSlot === otherSlot && l.date === tomorrow && (l.level === 'busy' || l.level === 'packed')
    );
    if (partnerHeavyTomorrow) {
      const meta = BUSYNESS_META[partnerHeavyTomorrow.level];
      push({
        id: `calendar_busy_${partnerHeavyTomorrow.id}_${partnerHeavyTomorrow.level}`,
        module: 'calendar',
        targetTab: 'calendar',
        priority: 'info',
        timingLabel: 'Tomorrow’s bandwidth',
        title: `${otherName} has a ${meta.label.toLowerCase()} day tomorrow`,
        body: partnerHeavyTomorrow.note || meta.description,
        actionLabel: 'Check Calendar',
      });
    }

    // Celebrate partner's wins logged today
    const partnerWinsToday = data.accomplishments.filter(
      (w) => w.date === today && w.createdBy !== data.userId
    );
    for (const win of partnerWinsToday.slice(0, 2)) {
      push({
        id: `calendar_win_${win.id}`,
        module: 'calendar',
        targetTab: 'calendar',
        priority: 'info',
        timingLabel: 'New win today',
        title: `${otherName} logged a win: ${win.title}`,
        body: win.reflection || 'Take a moment to celebrate this accomplishment together.',
        actionLabel: 'View Wins',
      });
    }
  }

  // 5. PARTNER DOSSIERS NOTIFICATIONS (Recent partner additions/updates in last 48h)
  if (prefs.dossiersEnabled) {
    const nowMs = Date.now();
    const recentCutoffMs = nowMs - 48 * 60 * 60 * 1000;
    const recentPartnerEntries = data.partnerEntries.filter((entry) => {
      if (entry.createdBy === data.userId) return false;
      const updatedMs = entry.updatedAt?.toMillis() || entry.createdAt?.toMillis() || 0;
      return updatedMs >= recentCutoffMs;
    });

    for (const entry of recentPartnerEntries.slice(0, 3)) {
      push({
        id: `dossier_${entry.id}_${entry.updatedAt?.seconds || 0}`,
        module: 'dossiers',
        targetTab: 'dossiers',
        priority: 'info',
        timingLabel: entry.category,
        title: `${otherName} updated a dossier note: ${entry.title}`,
        body: entry.details
          ? `${entry.details.slice(0, 100)}${entry.details.length > 100 ? '…' : ''}`
          : 'Open Partner Dossiers to see the latest detail.',
        actionLabel: 'Open Dossiers',
      });
    }
  }

  // Sort: unread first, then priority (high -> normal -> info)
  list.sort((a, b) => {
    if (a.isDismissed !== b.isDismissed) return a.isDismissed ? 1 : -1;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });

  return list;
}

// --- Safe Browser Notification API Helpers ---

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export function dispatchBrowserNotification(title: string, body: string, tag?: string): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (window.Notification.permission !== 'granted') return false;
  try {
    new window.Notification(title, {
      body,
      tag,
    });
    return true;
  } catch {
    return false;
  }
}
