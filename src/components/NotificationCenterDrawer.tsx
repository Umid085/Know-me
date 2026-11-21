import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import {
  NOTIFICATION_MODULE_LABELS,
  type NotificationModule,
  type WorkspaceTab,
} from '../types/knowme';
import { NotificationPreferencesForm } from './NotificationPreferencesForm';

interface NotificationCenterDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: WorkspaceTab) => void;
}

type DrawerView = 'alerts' | 'preferences';
type FilterScope = 'all' | NotificationModule;

const FILTER_OPTIONS: { id: FilterScope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'timeline', label: 'Dates' },
  { id: 'planner', label: 'Planner' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'dossiers', label: 'Dossiers' },
];

export function NotificationCenterDrawer({
  open,
  onClose,
  onNavigate,
}: NotificationCenterDrawerProps) {
  const {
    notifications,
    unreadNotificationCount,
    unreadByModule,
    dismissNotification,
    markAllNotificationsRead,
    restoreDismissedNotifications,
    showToast,
  } = useSpace();

  const [view, setView] = useState<DrawerView>('alerts');
  const [filter, setFilter] = useState<FilterScope>('all');
  const [showDismissed, setShowDismissed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const filteredList = useMemo(() => {
    return notifications.filter((item) => {
      if (filter !== 'all' && item.module !== filter) return false;
      if (!showDismissed && item.isDismissed) return false;
      return true;
    });
  }, [notifications, filter, showDismissed]);

  const dismissedInScopeCount = useMemo(() => {
    return notifications.filter(
      (item) => item.isDismissed && (filter === 'all' || item.module === filter)
    ).length;
  }, [notifications, filter]);

  if (!open) return null;

  async function handleDismiss(id: string) {
    setBusyId(id);
    try {
      await dismissNotification(id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not dismiss alert.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      showToast('All active alerts marked as read.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not clear alerts.');
    } finally {
      setMarkingAll(false);
    }
  }

  function handleJump(targetTab: WorkspaceTab) {
    onNavigate(targetTab);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#231F1D]/35"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
    >
      <div className="flex-1" onClick={onClose} />

      <div className="w-full max-w-md bg-[#FAF7F2] border-l border-[#E5DDD1] h-full flex flex-col">
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-white border-b border-[#E5DDD1] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bell className="w-4 h-4 text-[#2C4C3B] shrink-0" />
            <h2 className="font-serif text-xl font-normal text-[#231F1D] truncate">
              Notifications
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="p-1.5 text-[#6D645D] hover:text-[#231F1D] hover:bg-[#FAF7F2] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher */}
        <div className="px-6 pt-4 pb-3 bg-[#FAF7F2] border-b border-[#EFE9DF] space-y-3 shrink-0">
          <div className="grid grid-cols-2 p-1 bg-[#F2EDE4] border border-[#E5DDD1] rounded-lg">
            <button
              type="button"
              onClick={() => setView('alerts')}
              className={`flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === 'alerts'
                  ? 'bg-white text-[#231F1D] border border-[#E5DDD1]'
                  : 'text-[#6D645D] hover:text-[#231F1D]'
              }`}
            >
              <span>Alerts</span>
              {unreadNotificationCount > 0 && (
                <span className="font-mono tabular-nums text-[11px] text-[#2C4C3B]">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setView('preferences')}
              className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === 'preferences'
                  ? 'bg-white text-[#231F1D] border border-[#E5DDD1]'
                  : 'text-[#6D645D] hover:text-[#231F1D]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Preferences</span>
            </button>
          </div>

          {view === 'alerts' && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 -mx-1 px-1">
              {FILTER_OPTIONS.map((opt) => {
                const count =
                  opt.id === 'all' ? unreadNotificationCount : unreadByModule[opt.id];
                const active = filter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilter(opt.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors border ${
                      active
                        ? 'bg-white text-[#231F1D] font-semibold border-[#E5DDD1]'
                        : 'bg-transparent text-[#6D645D] hover:text-[#231F1D] border-transparent'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {count > 0 && (
                      <span className="font-mono tabular-nums text-[11px] text-[#2C4C3B]">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {view === 'preferences' ? (
            <div className="bg-white border border-[#E5DDD1] rounded-xl p-5">
              <p className="text-xs text-[#6D645D] mb-4 leading-relaxed">
                Choose which modules notify you and how far in advance. Your choices apply only to
                your account.
              </p>
              <NotificationPreferencesForm compact />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Action bar */}
              {(unreadNotificationCount > 0 || dismissedInScopeCount > 0) && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#6D645D] font-mono tabular-nums">
                    {filteredList.filter((i) => !i.isDismissed).length} active
                  </span>
                  <div className="flex items-center gap-3">
                    {dismissedInScopeCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowDismissed((prev) => !prev)}
                        className="text-[#6D645D] hover:text-[#231F1D] transition-colors"
                      >
                        {showDismissed
                          ? 'Hide dismissed'
                          : `Show dismissed (${dismissedInScopeCount})`}
                      </button>
                    )}
                    {unreadNotificationCount > 0 && (
                      <button
                        type="button"
                        disabled={markingAll}
                        onClick={() => void handleMarkAllRead()}
                        className="inline-flex items-center gap-1 font-medium text-[#2C4C3B] hover:underline disabled:opacity-50"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Alert cards */}
              {filteredList.length === 0 ? (
                <div className="bg-white border border-[#E5DDD1] rounded-xl p-8 text-center space-y-3">
                  <p className="font-serif text-lg text-[#231F1D]">You’re all caught up</p>
                  <p className="text-xs text-[#6D645D] leading-relaxed">
                    {filter === 'all'
                      ? 'No active reminders across your enabled modules right now.'
                      : `No active reminders in ${NOTIFICATION_MODULE_LABELS[filter]} right now.`}
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-4 text-xs">
                    {dismissedInScopeCount > 0 && !showDismissed && (
                      <button
                        type="button"
                        onClick={() => setShowDismissed(true)}
                        className="font-medium text-[#2C4C3B] hover:underline"
                      >
                        View {dismissedInScopeCount} dismissed
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setView('preferences')}
                      className="text-[#6D645D] hover:text-[#231F1D]"
                    >
                      Adjust lead times
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredList.map((item) => {
                    const moduleTextClass =
                      item.module === 'cycle' ? 'text-[#7B3E52]' : 'text-[#2C4C3B]';
                    const timingTextClass =
                      item.priority === 'high' ? 'text-[#B55336] font-medium' : 'text-[#6D645D]';

                    return (
                      <article
                        key={item.id}
                        className={`bg-white border border-[#E5DDD1] rounded-xl p-4 space-y-2 transition-opacity ${
                          item.isDismissed ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] min-w-0 truncate">
                            <span className={`font-semibold ${moduleTextClass}`}>
                              {NOTIFICATION_MODULE_LABELS[item.module]}
                            </span>
                            <span className="text-[#D8CFC2]" aria-hidden="true">
                              ·
                            </span>
                            <span className={`font-mono tabular-nums truncate ${timingTextClass}`}>
                              {item.timingLabel}
                            </span>
                          </div>
                          {!item.isDismissed && (
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => void handleDismiss(item.id)}
                              title="Mark as read"
                              aria-label={`Dismiss ${item.title}`}
                              className="p-1 text-[#6D645D] hover:text-[#2C4C3B] hover:bg-[#FAF7F2] rounded-md transition-colors shrink-0 disabled:opacity-40"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold text-[#231F1D] leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-xs text-[#6D645D] leading-relaxed">{item.body}</p>

                        <div className="pt-1 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleJump(item.targetTab)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#2C4C3B] hover:underline"
                          >
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          {item.isDismissed && (
                            <span className="text-[11px] text-[#6D645D]">Read</span>
                          )}
                        </div>
                      </article>
                    );
                  })}

                  {showDismissed && dismissedInScopeCount > 0 && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          void restoreDismissedNotifications().then(() => {
                            setShowDismissed(false);
                            showToast('Restored dismissed alerts.');
                          })
                        }
                        className="text-xs text-[#6D645D] hover:text-[#231F1D] underline"
                      >
                        Restore all dismissed alerts
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
