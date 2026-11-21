import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import {
  Award,
  CalendarHeart,
  ChevronDown,
  ChevronUp,
  MapPin,
  MoveVertical,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import { deleteTimelineEvent, saveTimelineEvent } from '../services/spaceService';
import {
  ACCOMPLISHMENT_CATEGORY_LABELS,
  LIMITS,
  TIMELINE_CATEGORY_LABELS,
  type TimelineCategory,
  type TimelineEvent,
} from '../types/knowme';
import {
  formatElapsedSince,
  formatReadableDate,
  formatShortDate,
  getNextOccurrenceDays,
  getTodayDateString,
} from '../utils/dates';

const TIMELINE_BANNER = '/src/assets/images/timeline_keepsake_banner_1795258967566.jpg';

interface NotableDatesTimelineViewProps {
  openDrawerSignal: number;
}

interface UnifiedMemory {
  id: string;
  source: 'timeline' | 'win';
  date: string;
  title: string;
  subtitle: string;
  story: string;
  location: string;
  recurringYearly: boolean;
  categoryLabel: string;
  rawTimeline?: TimelineEvent;
}

export function NotableDatesTimelineView({ openDrawerSignal }: NotableDatesTimelineViewProps) {
  const { user, space, timelineEvents, accomplishments, getPartnerLabel, showToast } = useSpace();

  const [viewMode, setViewMode] = useState<'spine' | 'swipe'>('spine');
  const [categoryFilter, setCategoryFilter] = useState<TimelineCategory | 'all'>('all');
  const [afterDate, setAfterDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [includeWins, setIncludeWins] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);

  // Quick inline "Note a Situation" composer
  const [quickDate, setQuickDate] = useState(getTodayDateString());
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState<TimelineCategory>('milestone');
  const [quickStory, setQuickStory] = useState('');
  const [quickLocation, setQuickLocation] = useState('');
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);

  // Swipe Memories state
  const [activeIndex, setActiveIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  // Full Editor Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [category, setCategory] = useState<TimelineCategory>('milestone');
  const [recurringYearly, setRecurringYearly] = useState(false);
  const [location, setLocation] = useState('');
  const [story, setStory] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (openDrawerSignal > 0) {
      openCreateDrawer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDrawerSignal]);

  function openCreateDrawer() {
    setEditingEvent(null);
    setTitle('');
    setDate(quickDate || getTodayDateString());
    setCategory(categoryFilter === 'all' ? 'milestone' : categoryFilter);
    setRecurringYearly(categoryFilter === 'anniversary');
    setLocation('');
    setStory('');
    setFormError('');
    setDrawerOpen(true);
  }

  function openEditDrawer(ev: TimelineEvent) {
    setEditingEvent(ev);
    setTitle(ev.title);
    setDate(ev.date);
    setCategory(ev.category);
    setRecurringYearly(ev.recurringYearly);
    setLocation(ev.location);
    setStory(ev.story);
    setFormError('');
    setDrawerOpen(true);
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!space || !user || !quickTitle.trim()) return;
    setQuickSaving(true);
    try {
      await saveTimelineEvent(space.id, user.uid, {
        title: quickTitle,
        date: quickDate,
        category: quickCategory,
        recurringYearly: quickCategory === 'anniversary',
        location: quickLocation,
        story: quickStory,
      });
      if (afterDate && quickDate < afterDate) {
        setAfterDate('');
      }
      setRecentlyAddedId(`${quickDate}_${quickTitle.trim()}`);
      setQuickTitle('');
      setQuickStory('');
      setQuickLocation('');
      setQuickExpanded(false);
      showToast(`Placed on the timeline for ${formatShortDate(quickDate)}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add situation to timeline.');
    } finally {
      setQuickSaving(false);
    }
  }

  async function handleSubmitDrawer(e: React.FormEvent) {
    e.preventDefault();
    if (!space || !user) return;
    setFormError('');
    if (!title.trim()) {
      setFormError('Please give this memory a title.');
      return;
    }

    setSaving(true);
    try {
      await saveTimelineEvent(space.id, user.uid, {
        id: editingEvent?.id,
        title,
        date,
        category,
        recurringYearly,
        location,
        story,
      });
      setDrawerOpen(false);
      showToast(editingEvent ? 'Memory updated.' : 'Added to memories timeline.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save memory.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ev: TimelineEvent) {
    if (!space) return;
    try {
      await deleteTimelineEvent(space.id, ev.id);
      if (editingEvent?.id === ev.id) setDrawerOpen(false);
      showToast(`Removed "${ev.title}".`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete memory.');
    }
  }

  // Merge timeline situations (+ optional calendar accomplishments)
  const memories: UnifiedMemory[] = useMemo(() => {
    const timelineItems: UnifiedMemory[] = timelineEvents
      .filter((ev) => (categoryFilter === 'all' ? true : ev.category === categoryFilter))
      .map((ev) => ({
        id: ev.id,
        source: 'timeline',
        date: ev.date,
        title: ev.title,
        subtitle: TIMELINE_CATEGORY_LABELS[ev.category],
        story: ev.story,
        location: ev.location,
        recurringYearly: ev.recurringYearly,
        categoryLabel: TIMELINE_CATEGORY_LABELS[ev.category],
        rawTimeline: ev,
      }));

    const winItems: UnifiedMemory[] =
      includeWins && categoryFilter === 'all'
        ? accomplishments.map((win) => ({
            id: `win_${win.id}`,
            source: 'win',
            date: win.date,
            title: win.title,
            subtitle: `${getPartnerLabel(win.owner)} · ${ACCOMPLISHMENT_CATEGORY_LABELS[win.category]}`,
            story: win.reflection,
            location: '',
            recurringYearly: false,
            categoryLabel: 'Accomplishment',
          }))
        : [];

    const combined = [...timelineItems, ...winItems].filter((item) => {
      if (afterDate && item.date < afterDate) return false;
      return true;
    });

    combined.sort((a, b) =>
      sortOrder === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    );
    return combined;
  }, [timelineEvents, accomplishments, categoryFilter, includeWins, afterDate, sortOrder, getPartnerLabel]);

  // Keep swipe index in bounds
  useEffect(() => {
    if (memories.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= memories.length) {
      setActiveIndex(memories.length - 1);
    }
  }, [memories.length, activeIndex]);

  // Keyboard navigation in Swipe Memories mode
  useEffect(() => {
    if (viewMode !== 'swipe' || drawerOpen || memories.length <= 1) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        stepSwipe(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        stepSwipe(-1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, drawerOpen, memories.length, activeIndex]);

  function stepSwipe(delta: 1 | -1) {
    if (memories.length <= 1) return;
    setSwipeDirection(delta);
    setActiveIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next >= memories.length) return memories.length - 1;
      return next;
    });
  }

  function handleSwipeDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const offsetThreshold = 55;
    const velocityThreshold = 260;

    // Swiping down brings the next memory down into focus; swiping up returns to previous
    if (info.offset.y > offsetThreshold || info.velocity.y > velocityThreshold) {
      if (activeIndex < memories.length - 1) {
        stepSwipe(1);
      }
    } else if (info.offset.y < -offsetThreshold || info.velocity.y < -velocityThreshold) {
      if (activeIndex > 0) {
        stepSwipe(-1);
      }
    }
  }

  function openSwipeAt(index: number) {
    setActiveIndex(index);
    setViewMode('swipe');
  }

  const recurringCount = useMemo(
    () => timelineEvents.filter((e) => e.recurringYearly).length,
    [timelineEvents]
  );

  if (!space) return null;

  const currentMemory = memories[activeIndex] || null;
  const prevMemory = activeIndex > 0 ? memories[activeIndex - 1] : null;
  const nextMemory = activeIndex < memories.length - 1 ? memories[activeIndex + 1] : null;

  return (
    <div className="space-y-7">
      {/* Editorial Keepsake Banner */}
      <section className="relative rounded-xl overflow-hidden border border-[#E5DDD1] bg-[#F2EDE4] min-h-[176px] flex items-end">
        {!bannerFailed ? (
          <img
            src={TIMELINE_BANNER}
            alt="Pressed dried botanicals, warm cream cotton stationery, antique brass clips, and deep forest green ribbon on linen"
            referrerPolicy="no-referrer"
            onError={() => setBannerFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-[#2C4C3B] via-[#3A5949] to-[#7B3E52]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1D1917]/85 via-[#1D1917]/45 to-[#1D1917]/15" />

        <div className="relative z-10 w-full p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-mono text-[#FAF7F2]/80 tabular-nums">
              {timelineEvents.length} noted {timelineEvents.length === 1 ? 'situation' : 'situations'}{' '}
              · {recurringCount} yearly {recurringCount === 1 ? 'anniversary' : 'anniversaries'}
            </p>
            <h2 className="font-serif text-3xl font-normal text-[#FAF7F2]">
              Our Memories Timeline
            </h2>
          </div>

          <button
            type="button"
            onClick={openCreateDrawer}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-[#231F1D] bg-[#FAF7F2] hover:bg-white rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Full Memory Editor</span>
          </button>
        </div>
      </section>

      {/* Quick Inline Situation Composer: Pick Date -> Appears Directly on the Center Line */}
      <section className="bg-white border border-[#E5DDD1] rounded-xl p-5 sm:p-6">
        <form onSubmit={handleQuickAdd} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-serif text-xl font-normal text-[#231F1D]">
                Note a Situation on the Line
              </h3>
              <p className="text-xs text-[#6D645D] mt-0.5">
                Pick a date and capture a moment — it appears immediately along your center timeline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuickExpanded((v) => !v)}
              className="self-start sm:self-auto text-xs font-medium text-[#2C4C3B] hover:underline whitespace-nowrap"
            >
              {quickExpanded ? 'Fewer fields' : '+ Add story & location'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <label className="md:col-span-3 block">
              <span className="sr-only">Choose date</span>
              <input
                type="date"
                required
                value={quickDate}
                onChange={(e) => setQuickDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
              />
            </label>

            <label className="md:col-span-5 block">
              <span className="sr-only">Noted situation</span>
              <input
                type="text"
                required
                maxLength={LIMITS.timelineTitle}
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="What happened on this date?"
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
              />
            </label>

            <label className="md:col-span-2 block">
              <span className="sr-only">Category</span>
              <select
                value={quickCategory}
                onChange={(e) => setQuickCategory(e.target.value as TimelineCategory)}
                className="w-full px-3 py-2.5 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
              >
                {(Object.keys(TIMELINE_CATEGORY_LABELS) as TimelineCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {TIMELINE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={quickSaving}
                className="w-full h-full px-4 py-2.5 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                {quickSaving ? 'Placing...' : 'Place on Line'}
              </button>
            </div>
          </div>

          {quickExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
              <input
                type="text"
                maxLength={LIMITS.timelineLocation}
                value={quickLocation}
                onChange={(e) => setQuickLocation(e.target.value)}
                placeholder="Location (optional)"
                className="md:col-span-4 px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
              />
              <input
                type="text"
                maxLength={LIMITS.timelineStory}
                value={quickStory}
                onChange={(e) => setQuickStory(e.target.value)}
                placeholder="Short memory or feeling worth keeping..."
                className="md:col-span-8 px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
              />
            </div>
          )}
        </form>
      </section>

      {/* Timeline Controls: Mode Switch, After-Date Filter, Category & Order */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-[#E5DDD1]">
        {/* Left: Mode Switch + Category Tabs */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-[#F2EDE4] rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('spine')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'spine'
                  ? 'bg-white text-[#231F1D] shadow-xs'
                  : 'text-[#6D645D] hover:text-[#231F1D]'
              }`}
            >
              Center Line
            </button>
            <button
              type="button"
              onClick={() => setViewMode('swipe')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'swipe'
                  ? 'bg-white text-[#231F1D] shadow-xs'
                  : 'text-[#6D645D] hover:text-[#231F1D]'
              }`}
            >
              Swipe Memories
            </button>
          </div>

          <div className="flex items-center gap-5 overflow-x-auto">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'anniversary', label: 'Anniversaries' },
                { id: 'milestone', label: 'Milestones' },
                { id: 'trip', label: 'Trips' },
                { id: 'first', label: 'Firsts' },
              ] as { id: TimelineCategory | 'all'; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`py-1.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === tab.id
                    ? 'border-[#2C4C3B] text-[#231F1D]'
                    : 'border-transparent text-[#6D645D] hover:text-[#231F1D]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: After Date Choice, Sort Order, Include Wins */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-[#E5DDD1] rounded-lg px-3 py-1.5">
            <label htmlFor="timeline-after-date" className="text-xs text-[#6D645D] whitespace-nowrap">
              From date:
            </label>
            <input
              id="timeline-after-date"
              type="date"
              value={afterDate}
              onChange={(e) => {
                setAfterDate(e.target.value);
                setActiveIndex(0);
              }}
              className="text-xs font-mono tabular-nums text-[#231F1D] bg-transparent focus:outline-none"
            />
            {afterDate && (
              <button
                type="button"
                onClick={() => setAfterDate('')}
                aria-label="Clear date filter"
                className="text-[#6D645D] hover:text-[#231F1D]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSortOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
            className="px-3 py-2 text-xs font-medium text-[#231F1D] bg-white border border-[#E5DDD1] hover:bg-[#F2EDE4] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
          </button>

          <button
            type="button"
            onClick={() => setIncludeWins((v) => !v)}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              includeWins
                ? 'bg-[#2C4C3B] text-white border-[#2C4C3B]'
                : 'bg-white text-[#6D645D] border-[#E5DDD1] hover:text-[#231F1D]'
            }`}
          >
            {includeWins ? 'Showing Wins' : '+ Calendar Wins'}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {memories.length === 0 ? (
        <div className="bg-white border border-[#E5DDD1] rounded-xl p-12 text-center space-y-3">
          <CalendarHeart className="w-7 h-7 text-[#7B3E52] mx-auto" />
          <h3 className="font-serif text-2xl text-[#231F1D]">
            {afterDate
              ? `No noted situations on or after ${formatShortDate(afterDate)}`
              : 'Your center timeline is waiting'}
          </h3>
          <p className="text-sm text-[#6D645D] max-w-md mx-auto leading-relaxed">
            {afterDate
              ? 'Choose an earlier date above, clear the filter, or note a new situation for that date.'
              : 'Pick a date above to place your first memory along the center line, then swipe down through your story anytime.'}
          </p>
          {afterDate && (
            <button
              type="button"
              onClick={() => setAfterDate('')}
              className="mt-1 px-4 py-2 text-xs font-medium text-[#2C4C3B] border border-[#E5DDD1] hover:bg-[#FAF7F2] rounded-lg transition-colors"
            >
              Show all dates
            </button>
          )}
        </div>
      ) : viewMode === 'spine' ? (
        /* ==============================================================
           MODE 1: CENTER-LINE VERTICAL TIMELINE WITH DATES ON THE SPINE
           ============================================================== */
        <section className="relative py-4" aria-label="Center line timeline">
          {/* Continuous Vertical Center Spine */}
          <div
            aria-hidden="true"
            className="absolute top-0 bottom-0 left-5 md:left-1/2 md:-translate-x-1/2 w-px bg-[#D9CFC0]"
          />

          <div className="space-y-8 md:space-y-10">
            {memories.map((item, idx) => {
              const isLeft = idx % 2 === 0;
              const isHighlighted = recentlyAddedId === `${item.date}_${item.title}`;
              const nextInfo = item.recurringYearly
                ? getNextOccurrenceDays(item.date, true)
                : null;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="relative grid grid-cols-1 md:grid-cols-12 items-start gap-4 md:gap-0 pl-12 md:pl-0"
                >
                  {/* Center Axis Date Marker Node */}
                  <div
                    className={`absolute left-5 md:left-1/2 -translate-x-1/2 top-5 z-10 w-3.5 h-3.5 rounded-full border-2 border-[#FAF7F2] ${
                      item.source === 'win'
                        ? 'bg-[#A67428]'
                        : item.recurringYearly
                        ? 'bg-[#7B3E52]'
                        : 'bg-[#2C4C3B]'
                    }`}
                  />

                  {/* Left Column (either Card or Opposite Date Anchor on Desktop) */}
                  <div
                    className={`md:col-span-6 ${
                      isLeft
                        ? 'md:pr-10'
                        : 'hidden md:flex md:pr-10 md:justify-end md:pt-4'
                    }`}
                  >
                    {isLeft ? (
                      <TimelineMemoryCard
                        item={item}
                        isHighlighted={isHighlighted}
                        nextInfo={nextInfo}
                        onEdit={item.rawTimeline ? () => openEditDrawer(item.rawTimeline!) : undefined}
                        onDelete={
                          item.rawTimeline ? () => void handleDelete(item.rawTimeline!) : undefined
                        }
                        onSwipeHere={() => openSwipeAt(idx)}
                      />
                    ) : (
                      <div className="text-right space-y-0.5">
                        <p className="font-mono text-sm font-medium text-[#231F1D] tabular-nums">
                          {formatReadableDate(item.date)}
                        </p>
                        <p className="font-mono text-xs text-[#6D645D] tabular-nums">
                          {formatElapsedSince(item.date)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column (either Opposite Date Anchor or Card on Desktop) */}
                  <div
                    className={`md:col-span-6 ${
                      !isLeft
                        ? 'md:pl-10'
                        : 'hidden md:flex md:pl-10 md:justify-start md:pt-4'
                    }`}
                  >
                    {!isLeft ? (
                      <TimelineMemoryCard
                        item={item}
                        isHighlighted={isHighlighted}
                        nextInfo={nextInfo}
                        onEdit={item.rawTimeline ? () => openEditDrawer(item.rawTimeline!) : undefined}
                        onDelete={
                          item.rawTimeline ? () => void handleDelete(item.rawTimeline!) : undefined
                        }
                        onSwipeHere={() => openSwipeAt(idx)}
                      />
                    ) : (
                      <div className="text-left space-y-0.5">
                        <p className="font-mono text-sm font-medium text-[#231F1D] tabular-nums">
                          {formatReadableDate(item.date)}
                        </p>
                        <p className="font-mono text-xs text-[#6D645D] tabular-nums">
                          {formatElapsedSince(item.date)}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      ) : (
        /* ==============================================================
           MODE 2: VERTICAL SWIPE-DOWN MEMORY REEL ON THE CENTER LINE
           ============================================================== */
        <section
          className="relative bg-[#F2EDE4]/55 border border-[#E5DDD1] rounded-xl px-4 sm:px-8 py-8 overflow-hidden select-none"
          aria-label="Swipeable memories reel"
        >
          {/* Central Vertical Spine running straight behind the swipeable memory */}
          <div
            aria-hidden="true"
            className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-[#D9CFC0]"
          />

          <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center gap-5">
            {/* Top Navigation & Previous Date Peek on the Center Line */}
            <div className="w-full flex items-center justify-between gap-4">
              <p className="inline-flex items-center gap-1.5 text-xs text-[#6D645D] bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg px-3 py-1.5">
                <MoveVertical className="w-3.5 h-3.5 text-[#2C4C3B]" />
                <span>Swipe down for next memory</span>
              </p>
              <span className="font-mono text-xs text-[#231F1D] bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg px-3 py-1.5 tabular-nums">
                {activeIndex + 1} / {memories.length}
              </span>
            </div>

            {/* Previous Date Anchor on the Spine */}
            <button
              type="button"
              disabled={!prevMemory}
              onClick={() => stepSwipe(-1)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-mono tabular-nums transition-colors ${
                prevMemory
                  ? 'bg-[#FAF7F2] border-[#E5DDD1] text-[#6D645D] hover:text-[#231F1D] hover:border-[#231F1D]/30'
                  : 'bg-[#FAF7F2]/60 border-transparent text-[#6D645D]/40 cursor-default'
              }`}
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span className="truncate max-w-[260px]">
                {prevMemory
                  ? `${formatShortDate(prevMemory.date)} · ${prevMemory.title}`
                  : 'Start of memories'}
              </span>
            </button>

            {/* Draggable / Swipeable Focused Memory Card */}
            <div className="w-full min-h-[300px] flex items-center justify-center py-2">
              <AnimatePresence mode="wait" initial={false}>
                {currentMemory && (
                  <motion.article
                    key={currentMemory.id}
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={0.45}
                    onDragEnd={handleSwipeDragEnd}
                    initial={{ opacity: 0, y: swipeDirection > 0 ? -48 : 48, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: swipeDirection > 0 ? 48 : -48, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full bg-white border border-[#E5DDD1] rounded-xl p-7 sm:p-9 shadow-sm cursor-grab active:cursor-grabbing space-y-5"
                  >
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#EFE9DF]">
                      <div className="space-y-1">
                        <p className="font-mono text-sm font-medium text-[#2C4C3B] tabular-nums">
                          {formatReadableDate(currentMemory.date)}
                        </p>
                        <p className="text-xs text-[#6D645D]">
                          <span>{currentMemory.subtitle}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono tabular-nums">
                            {formatElapsedSince(currentMemory.date)}
                          </span>
                          {currentMemory.location && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>{currentMemory.location}</span>
                            </>
                          )}
                        </p>
                      </div>

                      {currentMemory.rawTimeline && (
                        <button
                          type="button"
                          onClick={() => openEditDrawer(currentMemory.rawTimeline!)}
                          aria-label={`Edit ${currentMemory.title}`}
                          className="p-2 text-[#6D645D] hover:text-[#231F1D] hover:bg-[#F2EDE4] rounded-lg transition-colors shrink-0"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-serif text-3xl font-normal text-[#231F1D] leading-snug">
                        {currentMemory.title}
                      </h3>
                      <p className="text-sm sm:text-base text-[#6D645D] leading-relaxed whitespace-pre-line">
                        {currentMemory.story ||
                          'No story notes added yet — click the pencil icon to jot down what made this day memorable.'}
                      </p>
                    </div>

                    {currentMemory.recurringYearly && (
                      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7B3E52] pt-2">
                        <Repeat className="w-3.5 h-3.5" />
                        <span className="tabular-nums">
                          {(() => {
                            const info = getNextOccurrenceDays(currentMemory.date, true);
                            return info.daysUntil === 0
                              ? 'Celebrating today'
                              : `Next anniversary in ${info.daysUntil} ${
                                  info.daysUntil === 1 ? 'day' : 'days'
                                }`;
                          })()}
                        </span>
                      </p>
                    )}
                  </motion.article>
                )}
              </AnimatePresence>
            </div>

            {/* Next Date Anchor on the Spine */}
            <button
              type="button"
              disabled={!nextMemory}
              onClick={() => stepSwipe(1)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-mono tabular-nums transition-colors ${
                nextMemory
                  ? 'bg-white border-[#E5DDD1] text-[#231F1D] hover:border-[#2C4C3B]'
                  : 'bg-[#FAF7F2]/60 border-transparent text-[#6D645D]/40 cursor-default'
              }`}
            >
              <ChevronDown className="w-3.5 h-3.5 text-[#2C4C3B]" />
              <span className="truncate max-w-[260px]">
                {nextMemory
                  ? `Next: ${formatShortDate(nextMemory.date)} · ${nextMemory.title}`
                  : 'Reached the end of these memories'}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* Slide-over Full Memory Editor Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#231F1D]/35"
          role="dialog"
          aria-modal="true"
          aria-label={editingEvent ? 'Edit notable date' : 'Add notable date'}
        >
          <div className="w-full max-w-lg bg-[#FAF7F2] border-l border-[#E5DDD1] h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between gap-6">
            <form id="timeline-event-form" onSubmit={handleSubmitDrawer} className="space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5DDD1]">
                <div>
                  <p className="text-xs font-mono text-[#6D645D]">Memories Timeline</p>
                  <h2 className="font-serif text-2xl text-[#231F1D] mt-0.5">
                    {editingEvent ? 'Edit Memory' : 'New Timeline Memory'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close timeline editor"
                  className="p-2 text-[#6D645D] hover:text-[#231F1D] rounded-lg hover:bg-[#F2EDE4]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#231F1D]">Situation / Memory title</span>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.timelineTitle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Our first coffee date, Rainy hike in Lisbon, Moving in together"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#231F1D]">Date</span>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#231F1D]">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TimelineCategory)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                  >
                    {(Object.keys(TIMELINE_CATEGORY_LABELS) as TimelineCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {TIMELINE_CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#231F1D]">
                  Location <span className="text-[#6D645D] font-normal">(optional)</span>
                </span>
                <input
                  type="text"
                  maxLength={LIMITS.timelineLocation}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Lisbon, Home, Central Park"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#231F1D]">Story &amp; details</span>
                <textarea
                  rows={5}
                  maxLength={LIMITS.timelineStory}
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="Write down the little details you never want to forget about this day..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B] resize-y"
                />
              </label>

              <label className="flex items-center gap-2.5 text-sm text-[#231F1D]">
                <input
                  type="checkbox"
                  checked={recurringYearly}
                  onChange={(e) => setRecurringYearly(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E5DDD1] accent-[#2C4C3B]"
                />
                <span>Repeat yearly on the calendar and countdown</span>
              </label>

              {formError && (
                <p className="text-sm text-[#8C2F39] bg-[#8C2F39]/10 border border-[#8C2F39]/25 rounded-lg px-3.5 py-2.5">
                  {formError}
                </p>
              )}
            </form>

            <div className="pt-4 border-t border-[#E5DDD1] flex items-center justify-between gap-3">
              {editingEvent ? (
                <button
                  type="button"
                  onClick={() => void handleDelete(editingEvent)}
                  className="px-3.5 py-2 text-xs font-medium text-[#8C2F39] hover:bg-[#8C2F39]/10 rounded-lg transition-colors"
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 text-sm text-[#6D645D] hover:text-[#231F1D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="timeline-event-form"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Save Memory'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineMemoryCard({
  item,
  isHighlighted,
  nextInfo,
  onEdit,
  onDelete,
  onSwipeHere,
}: {
  item: UnifiedMemory;
  isHighlighted: boolean;
  nextInfo: ReturnType<typeof getNextOccurrenceDays> | null;
  onEdit?: () => void;
  onDelete?: () => void;
  onSwipeHere: () => void;
}) {
  return (
    <article
      className={`bg-white border rounded-xl p-5 sm:p-6 space-y-2.5 transition-colors ${
        isHighlighted ? 'border-[#2C4C3B]' : 'border-[#E5DDD1]'
      }`}
    >
      {/* Mobile-only date stamp (desktop displays date directly opposite the spine) */}
      <p className="md:hidden font-mono text-xs font-medium text-[#2C4C3B] tabular-nums">
        {formatReadableDate(item.date)} · {formatElapsedSince(item.date)}
      </p>

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6D645D]">
            {item.source === 'win' ? (
              <span className="inline-flex items-center gap-1 font-medium text-[#A67428]">
                <Award className="w-3.5 h-3.5" />
                <span>Accomplishment</span>
              </span>
            ) : (
              <span className="font-medium text-[#2C4C3B]">{item.categoryLabel}</span>
            )}
            {item.source === 'win' && (
              <>
                <span aria-hidden="true">·</span>
                <span>{item.subtitle}</span>
              </>
            )}
            {item.location && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {item.location}
                </span>
              </>
            )}
          </div>

          <h3 className="font-serif text-xl sm:text-2xl font-normal text-[#231F1D] leading-snug">
            {item.title}
          </h3>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${item.title}`}
              className="p-1.5 text-[#6D645D] hover:text-[#231F1D] hover:bg-[#F2EDE4] rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${item.title}`}
              className="p-1.5 text-[#6D645D] hover:text-[#8C2F39] hover:bg-[#8C2F39]/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {item.story && (
        <p className="text-sm text-[#6D645D] leading-relaxed whitespace-pre-line">{item.story}</p>
      )}

      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFE9DF]">
        {nextInfo ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7B3E52] tabular-nums">
            <Repeat className="w-3.5 h-3.5" />
            <span>
              {nextInfo.daysUntil === 0
                ? 'Celebrating today'
                : `Next in ${nextInfo.daysUntil} ${nextInfo.daysUntil === 1 ? 'day' : 'days'}`}
            </span>
          </p>
        ) : (
          <span className="text-xs text-[#6D645D] font-mono tabular-nums">
            {formatShortDate(item.date)}
          </span>
        )}

        <button
          type="button"
          onClick={onSwipeHere}
          className="text-xs font-medium text-[#2C4C3B] hover:underline whitespace-nowrap"
        >
          Swipe from here
        </button>
      </div>
    </article>
  );
}
