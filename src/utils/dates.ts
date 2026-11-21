export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatReadableDate(dateStr: string, includeWeekday = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = parseLocalDate(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    weekday: includeWeekday ? 'long' : undefined,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatShortDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = parseLocalDate(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatMonthYear(year: number, monthIndex: number): string {
  const date = new Date(year, monthIndex, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export interface CalendarCell {
  dateStr: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

export function buildMonthGrid(year: number, monthIndex: number): CalendarCell[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = Sun
  const gridStart = new Date(year, monthIndex, 1 - startWeekday);
  const todayStr = getTodayDateString();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i++) {
    const cur = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    cells.push({
      dateStr,
      dayNumber: cur.getDate(),
      inCurrentMonth: cur.getMonth() === monthIndex,
      isToday: dateStr === todayStr,
    });
  }
  return cells;
}

export function computeDaysBetween(fromDateStr: string, toDateStr: string): number {
  const from = parseLocalDate(fromDateStr);
  const to = parseLocalDate(toDateStr);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

export function getNextOccurrenceDays(dateStr: string, recurringYearly: boolean): {
  daysUntil: number;
  nextDateStr: string;
  isPastNonRecurring: boolean;
  yearsCount: number;
} {
  const todayStr = getTodayDateString();
  const today = parseLocalDate(todayStr);
  const base = parseLocalDate(dateStr);

  if (!recurringYearly) {
    const diff = computeDaysBetween(todayStr, dateStr);
    return {
      daysUntil: diff,
      nextDateStr: dateStr,
      isPastNonRecurring: diff < 0,
      yearsCount: 0,
    };
  }

  let candidateYear = today.getFullYear();
  let candidate = new Date(candidateYear, base.getMonth(), base.getDate());
  if (candidate.getTime() < today.getTime()) {
    candidateYear += 1;
    candidate = new Date(candidateYear, base.getMonth(), base.getDate());
  }

  const nextDateStr = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(
    candidate.getDate()
  ).padStart(2, '0')}`;
  const daysUntil = computeDaysBetween(todayStr, nextDateStr);
  const yearsCount = Math.max(0, candidateYear - base.getFullYear());

  return {
    daysUntil,
    nextDateStr,
    isPastNonRecurring: false,
    yearsCount,
  };
}

export function formatElapsedSince(dateStr: string): string {
  const todayStr = getTodayDateString();
  const days = computeDaysBetween(dateStr, todayStr);
  if (days === 0) return 'Today';
  if (days < 0) return `In ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years === 0) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  if (months === 0) return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  return `${years} yr${years > 1 ? 's' : ''}, ${months} mo${months > 1 ? 's' : ''} ago`;
}

export function getMonthDayRange(year: number, monthIndex: number): { start: string; end: string } {
  const start = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const end = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}
