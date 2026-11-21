import React, { useMemo, useState } from 'react';
import { CalendarHeart, MapPin, Pencil, Plus, Repeat, Trash2, X } from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import { deleteTimelineEvent, saveTimelineEvent } from '../services/spaceService';
import {
  LIMITS,
  TIMELINE_CATEGORY_LABELS,
  type TimelineCategory,
  type TimelineEvent,
} from '../types/knowme';
import {
  formatElapsedSince,
  formatReadableDate,
  getNextOccurrenceDays,
  getTodayDateString,
} from '../utils/dates';

const TIMELINE_BANNER = '/src/assets/images/timeline_keepsake_banner_1795258967566.jpg';

interface NotableDatesTimelineViewProps {
  openDrawerSignal: number;
}

export function NotableDatesTimelineView({ openDrawerSignal }: NotableDatesTimelineViewProps) {
  const { user, space, timelineEvents, showToast } = useSpace();

  const [categoryFilter, setCategoryFilter] = useState<TimelineCategory | 'all'>('all');
  const [sortMode, setSortMode] = useState<'chronological' | 'upcoming'>('chronological');
  const [bannerFailed, setBannerFailed] = useState(false);

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

  React.useEffect(() => {
    if (openDrawerSignal > 0) {
      openCreateDrawer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDrawerSignal]);

  function openCreateDrawer() {
    setEditingEvent(null);
    setTitle('');
    setDate(getTodayDateString());
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!space || !user) return;
    setFormError('');
    if (!title.trim()) {
      setFormError('Please give this notable date a title.');
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
      showToast(editingEvent ? 'Timeline date updated.' : 'Added to notable dates timeline.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save event.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ev: TimelineEvent) {
    if (!space) return;
    try {
      await deleteTimelineEvent(space.id, ev.id);
      if (editingEvent?.id === ev.id) setDrawerOpen(false);
      showToast(`Deleted "${ev.title}".`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete event.');
    }
  }

  const displayedEvents = useMemo(() => {
    const filtered = timelineEvents.filter((ev) =>
      categoryFilter === 'all' ? true : ev.category === categoryFilter
    );

    if (sortMode === 'chronological') {
      return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
    }

    return [...filtered].sort((a, b) => {
      const infoA = getNextOccurrenceDays(a.date, a.recurringYearly);
      const infoB = getNextOccurrenceDays(b.date, b.recurringYearly);
      if (infoA.isPastNonRecurring && !infoB.isPastNonRecurring) return 1;
      if (!infoA.isPastNonRecurring && infoB.isPastNonRecurring) return -1;
      return infoA.daysUntil - infoB.daysUntil;
    });
  }, [timelineEvents, categoryFilter, sortMode]);

  const recurringCount = useMemo(
    () => timelineEvents.filter((e) => e.recurringYearly).length,
    [timelineEvents]
  );

  if (!space) return null;

  return (
    <div className="space-y-8">
      {/* Editorial Keepsake Banner */}
      <section className="relative rounded-xl overflow-hidden border border-[#E5DDD1] bg-[#F2EDE4] min-h-[190px] flex items-end">
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
              {timelineEvents.length} recorded {timelineEvents.length === 1 ? 'date' : 'dates'} ·{' '}
              {recurringCount} recurring {recurringCount === 1 ? 'anniversary' : 'anniversaries'}
            </p>
            <h2 className="font-serif text-3xl font-normal text-[#FAF7F2]">
              Our Notable Dates Chronicle
            </h2>
          </div>

          <button
            type="button"
            onClick={openCreateDrawer}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-[#231F1D] bg-[#FAF7F2] hover:bg-white rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Notable Date</span>
          </button>
        </div>
      </section>

      {/* Filter & Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5DDD1]">
        <div className="flex items-center gap-6 overflow-x-auto pb-1">
          {(
            [
              { id: 'all', label: 'All Dates' },
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
              className={`pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === tab.id
                  ? 'border-[#2C4C3B] text-[#231F1D]'
                  : 'border-transparent text-[#6D645D] hover:text-[#231F1D]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-[#F2EDE4] rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSortMode('chronological')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              sortMode === 'chronological'
                ? 'bg-white text-[#231F1D] shadow-xs'
                : 'text-[#6D645D] hover:text-[#231F1D]'
            }`}
          >
            Chronological
          </button>
          <button
            type="button"
            onClick={() => setSortMode('upcoming')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              sortMode === 'upcoming'
                ? 'bg-white text-[#231F1D] shadow-xs'
                : 'text-[#6D645D] hover:text-[#231F1D]'
            }`}
          >
            Upcoming Next
          </button>
        </div>
      </div>

      {/* Editorial Timeline List */}
      {displayedEvents.length === 0 ? (
        <div className="bg-white border border-[#E5DDD1] rounded-xl p-12 text-center space-y-3">
          <CalendarHeart className="w-7 h-7 text-[#7B3E52] mx-auto" />
          <h3 className="font-serif text-2xl text-[#231F1D]">Start your timeline</h3>
          <p className="text-sm text-[#6D645D] max-w-md mx-auto leading-relaxed">
            Record your first meeting, anniversary, favorite trip, or big life milestone — recurring
            dates automatically count down each year.
          </p>
          <button
            type="button"
            onClick={openCreateDrawer}
            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] rounded-lg transition-colors"
          >
            Add First Notable Date
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E5DDD1] rounded-xl divide-y divide-[#EFE9DF]">
          {displayedEvents.map((ev) => {
            const nextInfo = getNextOccurrenceDays(ev.date, ev.recurringYearly);
            return (
              <article
                key={ev.id}
                className="p-6 sm:p-7 grid grid-cols-1 md:grid-cols-12 gap-5 items-start"
              >
                {/* Left Date Column */}
                <div className="md:col-span-4 space-y-1.5">
                  <p className="font-mono text-sm font-medium text-[#231F1D] tabular-nums">
                    {formatReadableDate(ev.date)}
                  </p>
                  <p className="text-xs text-[#6D645D] font-mono tabular-nums">
                    {formatElapsedSince(ev.date)}
                  </p>
                  {ev.recurringYearly && (
                    <p className="inline-flex items-center gap-1.5 text-xs text-[#7B3E52] font-medium pt-1">
                      <Repeat className="w-3.5 h-3.5" />
                      <span className="tabular-nums">
                        {nextInfo.daysUntil === 0
                          ? 'Celebrating today'
                          : `Next in ${nextInfo.daysUntil} ${
                              nextInfo.daysUntil === 1 ? 'day' : 'days'
                            }`}
                      </span>
                    </p>
                  )}
                </div>

                {/* Right Story Column */}
                <div className="md:col-span-8 flex items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6D645D]">
                      <span className="font-medium text-[#2C4C3B]">
                        {TIMELINE_CATEGORY_LABELS[ev.category]}
                      </span>
                      {ev.location && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {ev.location}
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="font-serif text-2xl font-normal text-[#231F1D] leading-snug">
                      {ev.title}
                    </h3>

                    {ev.story && (
                      <p className="text-sm text-[#6D645D] leading-relaxed whitespace-pre-line max-w-2xl">
                        {ev.story}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditDrawer(ev)}
                      aria-label={`Edit ${ev.title}`}
                      className="p-2 text-[#6D645D] hover:text-[#231F1D] hover:bg-[#F2EDE4] rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(ev)}
                      aria-label={`Delete ${ev.title}`}
                      className="p-2 text-[#6D645D] hover:text-[#8C2F39] hover:bg-[#8C2F39]/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Slide-over Editor Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#231F1D]/35"
          role="dialog"
          aria-modal="true"
          aria-label={editingEvent ? 'Edit notable date' : 'Add notable date'}
        >
          <div className="w-full max-w-lg bg-[#FAF7F2] border-l border-[#E5DDD1] h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between gap-6">
            <form id="timeline-event-form" onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5DDD1]">
                <div>
                  <p className="text-xs font-mono text-[#6D645D]">Notable Dates Timeline</p>
                  <h2 className="font-serif text-2xl text-[#231F1D] mt-0.5">
                    {editingEvent ? 'Edit Notable Date' : 'New Notable Date'}
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
                <span className="text-xs font-medium text-[#231F1D]">Event title</span>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.timelineTitle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Our first coffee date, Anniversary, Kyoto autumn trip"
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
                <span className="text-xs font-medium text-[#231F1D]">Memory or note</span>
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
                form="timeline-event-form"
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Save Date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
