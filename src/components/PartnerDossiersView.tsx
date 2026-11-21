import React, { useMemo, useState } from 'react';
import { Pencil, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import { deletePartnerEntry, savePartnerEntry } from '../services/spaceService';
import {
  DOSSIER_CHAPTERS,
  LIMITS,
  type DossierChapter,
  type EntrySubjectSlot,
  type PartnerEntry,
} from '../types/knowme';

type ViewScope = 'all' | 'partnerA' | 'partnerB' | 'side_by_side';

interface PartnerDossiersViewProps {
  openDrawerSignal: number;
}

export function PartnerDossiersView({ openDrawerSignal }: PartnerDossiersViewProps) {
  const { user, space, partnerEntries, currentUserSlot, getPartnerLabel, showToast } = useSpace();

  const [scope, setScope] = useState<ViewScope>('all');
  const [activeChapter, setActiveChapter] = useState<DossierChapter | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PartnerEntry | null>(null);
  const [subjectSlot, setSubjectSlot] = useState<EntrySubjectSlot>(currentUserSlot);
  const [chapter, setChapter] = useState<DossierChapter>('essentials');
  const [category, setCategory] = useState('Favorites');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [metaNote, setMetaNote] = useState('');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  React.useEffect(() => {
    if (openDrawerSignal > 0) {
      openCreateDrawer(activeChapter === 'all' ? 'essentials' : activeChapter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDrawerSignal]);

  function openCreateDrawer(initialChapter: DossierChapter = 'essentials', initialSlot?: EntrySubjectSlot) {
    const ch = DOSSIER_CHAPTERS.find((c) => c.id === initialChapter) || DOSSIER_CHAPTERS[0];
    setEditingEntry(null);
    setSubjectSlot(
      initialSlot ||
        (scope === 'partnerA' || scope === 'partnerB' ? scope : currentUserSlot)
    );
    setChapter(ch.id);
    setCategory(ch.suggestedCategories[0]);
    setTitle('');
    setDetails('');
    setMetaNote('');
    setPinned(false);
    setFormError('');
    setDrawerOpen(true);
  }

  function openEditDrawer(entry: PartnerEntry) {
    setEditingEntry(entry);
    setSubjectSlot(entry.subjectSlot);
    setChapter(entry.chapter);
    setCategory(entry.category);
    setTitle(entry.title);
    setDetails(entry.details);
    setMetaNote(entry.metaNote);
    setPinned(entry.pinned);
    setFormError('');
    setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!space || !user) return;
    setFormError('');

    if (!title.trim()) {
      setFormError('Please enter a title for this dossier note.');
      return;
    }

    setSaving(true);
    try {
      await savePartnerEntry(space.id, user.uid, {
        id: editingEntry?.id,
        subjectSlot,
        chapter,
        category,
        title,
        details,
        metaNote,
        pinned,
      });
      setDrawerOpen(false);
      showToast(editingEntry ? 'Dossier entry updated.' : 'Saved to partner database.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save entry.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePin(entry: PartnerEntry) {
    if (!space || !user) return;
    try {
      await savePartnerEntry(space.id, user.uid, {
        ...entry,
        pinned: !entry.pinned,
      });
      showToast(entry.pinned ? 'Removed from pinned notes.' : 'Pinned to Today overview.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update pin.');
    }
  }

  async function handleDelete(entry: PartnerEntry) {
    if (!space) return;
    try {
      await deletePartnerEntry(space.id, entry.id);
      if (editingEntry?.id === entry.id) {
        setDrawerOpen(false);
      }
      showToast(`Deleted "${entry.title}".`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete entry.');
    }
  }

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return partnerEntries.filter((entry) => {
      if (activeChapter !== 'all' && entry.chapter !== activeChapter) return false;
      if (scope === 'partnerA' && entry.subjectSlot !== 'partnerA' && entry.subjectSlot !== 'shared')
        return false;
      if (scope === 'partnerB' && entry.subjectSlot !== 'partnerB' && entry.subjectSlot !== 'shared')
        return false;
      if (q) {
        const hay = `${entry.title} ${entry.category} ${entry.details} ${entry.metaNote}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [partnerEntries, activeChapter, scope, searchQuery]);

  const currentChapterConfig = DOSSIER_CHAPTERS.find((c) => c.id === chapter) || DOSSIER_CHAPTERS[0];

  if (!space) return null;

  function renderEntryRow(entry: PartnerEntry) {
    return (
      <div
        key={entry.id}
        className="py-5 flex items-start justify-between gap-4 group"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6D645D]">
            <span
              className={`font-medium ${
                entry.subjectSlot === 'partnerA'
                  ? 'text-[#2C4C3B]'
                  : entry.subjectSlot === 'partnerB'
                  ? 'text-[#7B3E52]'
                  : 'text-[#231F1D]'
              }`}
            >
              {getPartnerLabel(entry.subjectSlot)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{entry.category}</span>
            {entry.metaNote && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#231F1D]/80">{entry.metaNote}</span>
              </>
            )}
            {entry.pinned && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#2C4C3B] font-medium">Pinned</span>
              </>
            )}
          </div>

          <h4 className="text-base font-semibold text-[#231F1D] leading-snug">{entry.title}</h4>

          {entry.details && (
            <p className="text-sm text-[#6D645D] leading-relaxed whitespace-pre-line max-w-3xl">
              {entry.details}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <button
            type="button"
            onClick={() => void handleTogglePin(entry)}
            aria-label={entry.pinned ? 'Unpin note' : 'Pin note'}
            className={`p-2 rounded-lg transition-colors ${
              entry.pinned
                ? 'text-[#2C4C3B] bg-[#2C4C3B]/10'
                : 'text-[#6D645D] hover:text-[#231F1D] hover:bg-[#F2EDE4]'
            }`}
          >
            <Pin className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => openEditDrawer(entry)}
            aria-label={`Edit ${entry.title}`}
            className="p-2 text-[#6D645D] hover:text-[#231F1D] hover:bg-[#F2EDE4] rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void handleDelete(entry)}
            aria-label={`Delete ${entry.title}`}
            className="p-2 text-[#6D645D] hover:text-[#8C2F39] hover:bg-[#8C2F39]/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toolbar: Partner Scope + Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#E5DDD1]">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F2EDE4] rounded-lg self-start">
          {(
            [
              { id: 'all', label: 'All Entries' },
              { id: 'partnerA', label: space.partnerAName },
              { id: 'partnerB', label: space.partnerBName },
              { id: 'side_by_side', label: 'Side-by-Side' },
            ] as { id: ViewScope; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScope(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                scope === tab.id
                  ? 'bg-white text-[#231F1D] shadow-xs'
                  : 'text-[#6D645D] hover:text-[#231F1D]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="w-4 h-4 text-[#6D645D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sizes, allergies, gifts, habits..."
              className="w-full pl-10 pr-3.5 py-2 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
            />
          </div>
          <button
            type="button"
            onClick={() => openCreateDrawer(activeChapter === 'all' ? 'essentials' : activeChapter)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* Chapter Filter Navigation */}
      <div className="flex items-center gap-6 overflow-x-auto pb-1 border-b border-[#E5DDD1]">
        <button
          type="button"
          onClick={() => setActiveChapter('all')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            activeChapter === 'all'
              ? 'border-[#2C4C3B] text-[#231F1D]'
              : 'border-transparent text-[#6D645D] hover:text-[#231F1D]'
          }`}
        >
          All Chapters ({partnerEntries.length})
        </button>
        {DOSSIER_CHAPTERS.map((ch) => {
          const count = partnerEntries.filter((e) => e.chapter === ch.id).length;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => setActiveChapter(ch.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeChapter === ch.id
                  ? 'border-[#2C4C3B] text-[#231F1D]'
                  : 'border-transparent text-[#6D645D] hover:text-[#231F1D]'
              }`}
            >
              {ch.index}. {ch.label} <span className="font-mono text-xs text-[#6D645D] tabular-nums">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Side-by-Side Mode vs Chapter Ledger Mode */}
      {scope === 'side_by_side' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(['partnerA', 'partnerB'] as const).map((slot) => {
            const slotEntries = filteredEntries.filter(
              (e) => e.subjectSlot === slot || e.subjectSlot === 'shared'
            );
            return (
              <div key={slot} className="bg-white border border-[#E5DDD1] rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#EFE9DF]">
                  <div>
                    <h3 className="font-serif text-2xl text-[#231F1D]">
                      {getPartnerLabel(slot)}
                    </h3>
                    <p className="text-xs text-[#6D645D] mt-0.5 tabular-nums">
                      {slotEntries.length} recorded details
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openCreateDrawer(activeChapter === 'all' ? 'essentials' : activeChapter, slot)
                    }
                    className="px-3 py-1.5 text-xs font-medium text-[#2C4C3B] border border-[#E5DDD1] hover:bg-[#FAF7F2] rounded-lg transition-colors whitespace-nowrap"
                  >
                    + Add note
                  </button>
                </div>

                {slotEntries.length === 0 ? (
                  <p className="text-sm text-[#6D645D] py-8 text-center">
                    No entries match this filter for {getPartnerLabel(slot)}.
                  </p>
                ) : (
                  <div className="divide-y divide-[#EFE9DF]">
                    {slotEntries.map((entry) => renderEntryRow(entry))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-8">
          {DOSSIER_CHAPTERS.filter(
            (ch) => activeChapter === 'all' || activeChapter === ch.id
          ).map((ch) => {
            const chapterItems = filteredEntries.filter((e) => e.chapter === ch.id);
            return (
              <section
                key={ch.id}
                className="bg-white border border-[#E5DDD1] rounded-xl p-6 sm:p-7 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[#EFE9DF]">
                  <div className="space-y-1">
                    <h3 className="font-serif text-2xl font-normal text-[#231F1D]">
                      {ch.index}. {ch.label}
                    </h3>
                    <p className="text-xs text-[#6D645D]">{ch.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreateDrawer(ch.id)}
                    className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-[#2C4C3B] border border-[#E5DDD1] hover:bg-[#FAF7F2] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    + Add to {ch.shortLabel}
                  </button>
                </div>

                {chapterItems.length === 0 ? (
                  <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-sm text-[#6D645D]">
                      {searchQuery
                        ? 'No matching notes in this chapter.'
                        : `Nothing saved in ${ch.label} yet — try adding ${ch.suggestedCategories
                            .slice(0, 3)
                            .join(', ').toLowerCase()}.`}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#EFE9DF]">
                    {chapterItems.map((entry) => renderEntryRow(entry))}
                  </div>
                )}
              </section>
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
          aria-label={editingEntry ? 'Edit dossier entry' : 'Add dossier entry'}
        >
          <div className="w-full max-w-lg bg-[#FAF7F2] border-l border-[#E5DDD1] h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between gap-6">
            <form id="dossier-entry-form" onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5DDD1]">
                <div>
                  <p className="text-xs font-mono text-[#6D645D]">Partner Database</p>
                  <h2 className="font-serif text-2xl text-[#231F1D] mt-0.5">
                    {editingEntry ? 'Edit Dossier Note' : 'New Dossier Note'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close editor"
                  className="p-2 text-[#6D645D] hover:text-[#231F1D] rounded-lg hover:bg-[#F2EDE4]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Subject Slot */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#231F1D]">Who is this about?</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F2EDE4] rounded-lg">
                  {(
                    [
                      { id: 'partnerA', label: space.partnerAName },
                      { id: 'partnerB', label: space.partnerBName },
                      { id: 'shared', label: 'Shared' },
                    ] as { id: EntrySubjectSlot; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSubjectSlot(opt.id)}
                      className={`py-2 px-2 text-xs font-medium rounded-md transition-colors truncate ${
                        subjectSlot === opt.id
                          ? 'bg-white text-[#231F1D] shadow-xs'
                          : 'text-[#6D645D] hover:text-[#231F1D]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chapter */}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#231F1D]">Chapter</span>
                <select
                  value={chapter}
                  onChange={(e) => {
                    const nextCh = e.target.value as DossierChapter;
                    setChapter(nextCh);
                    const cfg = DOSSIER_CHAPTERS.find((c) => c.id === nextCh);
                    if (cfg && !cfg.suggestedCategories.includes(category)) {
                      setCategory(cfg.suggestedCategories[0]);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                >
                  {DOSSIER_CHAPTERS.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.index}. {ch.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Category + Quick Presets */}
              <div className="space-y-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#231F1D]">Topic / Category</span>
                  <input
                    type="text"
                    required
                    maxLength={LIMITS.entryCategory}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Ring & Shoe Sizes, Allergies, Comfort Habits"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {currentChapterConfig.suggestedCategories.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCategory(preset)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        category === preset
                          ? 'bg-[#2C4C3B] text-white border-[#2C4C3B]'
                          : 'bg-white text-[#6D645D] border-[#E5DDD1] hover:text-[#231F1D]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#231F1D]">Title</span>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.entryTitle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Oat flat white with cinnamon, Shoe size EU 39..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                />
              </label>

              {/* Meta Note */}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#231F1D]">
                  Quick reference{' '}
                  <span className="text-[#6D645D] font-normal">(optional — size, status, date)</span>
                </span>
                <input
                  type="text"
                  maxLength={LIMITS.entryMetaNote}
                  value={metaNote}
                  onChange={(e) => setMetaNote(e.target.value)}
                  placeholder="e.g. Ring size 6.5 · Idea · Renews Aug 2028"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                />
              </label>

              {/* Details */}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#231F1D]">Details &amp; notes</span>
                <textarea
                  rows={5}
                  maxLength={LIMITS.entryDetails}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Write anything thoughtful or helpful to remember..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B] resize-y"
                />
              </label>

              {chapter === 'logistics' && (
                <p className="text-xs text-[#6D645D] bg-[#F2EDE4] rounded-lg px-3.5 py-2.5 leading-relaxed">
                  Keep this space for helpful reminders like preferred seats, airline loyalty names,
                  or passport renewal dates — avoid storing passwords, PINs, or bank numbers.
                </p>
              )}

              <label className="flex items-center gap-2.5 text-sm text-[#231F1D] pt-1">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E5DDD1] accent-[#2C4C3B]"
                />
                <span>Pin to Today overview for instant lookup</span>
              </label>

              {formError && (
                <p className="text-sm text-[#8C2F39] bg-[#8C2F39]/10 border border-[#8C2F39]/25 rounded-lg px-3.5 py-2.5">
                  {formError}
                </p>
              )}
            </form>

            <div className="pt-4 border-t border-[#E5DDD1] flex items-center justify-between gap-3">
              {editingEntry ? (
                <button
                  type="button"
                  onClick={() => void handleDelete(editingEntry)}
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
                  form="dossier-entry-form"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : editingEntry ? 'Save Changes' : 'Save Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
