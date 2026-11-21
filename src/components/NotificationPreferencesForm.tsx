import React, { useState } from 'react';
import { Bell, BellRing, Send } from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import {
  dispatchBrowserNotification,
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
} from '../utils/notifications';

interface NotificationPreferencesFormProps {
  compact?: boolean;
}

function SwitchToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C4C3B]/40 disabled:opacity-50 ${
        checked
          ? 'bg-[#2C4C3B] border-[#2C4C3B]'
          : 'bg-[#E5DDD1] border-[#D8CFC2]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function NotificationPreferencesForm({ compact = false }: NotificationPreferencesFormProps) {
  const {
    notificationPrefs,
    updateNotificationPrefs,
    restoreDismissedNotifications,
    showToast,
  } = useSpace();

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getBrowserNotificationPermission()
  );

  const browserSupported = isBrowserNotificationSupported();

  async function applyPatch(
    key: string,
    patch: Parameters<typeof updateNotificationPrefs>[0],
    successMsg?: string
  ) {
    setSavingKey(key);
    try {
      await updateNotificationPrefs(patch);
      if (successMsg) showToast(successMsg);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update notification settings.');
    } finally {
      setSavingKey(null);
    }
  }

  async function handleBrowserToggle(nextEnabled: boolean) {
    if (!nextEnabled) {
      await applyPatch('browser', { browserPushEnabled: false }, 'Browser alerts paused.');
      return;
    }

    if (!browserSupported) {
      showToast('Browser alerts are not supported in this preview window.');
      return;
    }

    const perm = await requestBrowserNotificationPermission();
    setBrowserPerm(perm);

    if (perm === 'granted') {
      await applyPatch('browser', { browserPushEnabled: true }, 'Browser alerts enabled.');
    } else if (perm === 'denied') {
      showToast('Browser notifications are blocked in your browser site settings.');
    } else {
      showToast('Permission was not granted — in-app alerts remain active.');
    }
  }

  function handleSendTest() {
    const perm = getBrowserNotificationPermission();
    setBrowserPerm(perm);
    if (perm !== 'granted') {
      showToast('Enable browser alerts first to send a test notification.');
      return;
    }
    const ok = dispatchBrowserNotification(
      'Know Me · Alerts Ready',
      'You will see timely nudges here for Cycle Calendar, Notable Dates, Planner, Calendar, and Dossiers.',
      'knowme_test_alert'
    );
    if (ok) {
      showToast('Test browser notification sent.');
    } else {
      showToast('Could not trigger a browser notification in this embedded view.');
    }
  }

  const browserStatusText = !browserSupported
    ? 'Not available in this browser view'
    : browserPerm === 'granted'
    ? notificationPrefs.browserPushEnabled
      ? 'Allowed and active'
      : 'Allowed (currently paused)'
    : browserPerm === 'denied'
    ? 'Blocked in browser site settings'
    : 'Ask permission when enabled';

  const rowPad = compact ? 'py-3.5' : 'py-4';

  return (
    <div className="space-y-5">
      {/* Per-Module Controls */}
      <div className="divide-y divide-[#EFE9DF] border-t border-b border-[#EFE9DF]">
        {/* 1. Cycle Calendar */}
        <div className={`${rowPad} space-y-2.5`}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-semibold text-[#231F1D]">Cycle Calendar</p>
              <p className="text-xs text-[#6D645D] leading-relaxed">
                Active period day tips, pre-period window heads-up, and peak energy reminders.
              </p>
            </div>
            <SwitchToggle
              checked={notificationPrefs.cycleEnabled}
              disabled={savingKey === 'cycle'}
              label="Toggle Cycle Calendar notifications"
              onChange={(next) => void applyPatch('cycle', { cycleEnabled: next })}
            />
          </div>
          {notificationPrefs.cycleEnabled && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <label
                htmlFor={compact ? 'drawer-cycle-lead' : 'settings-cycle-lead'}
                className="text-xs text-[#6D645D]"
              >
                Pre-period heads-up lead time
              </label>
              <select
                id={compact ? 'drawer-cycle-lead' : 'settings-cycle-lead'}
                value={notificationPrefs.cycleLeadDays}
                disabled={savingKey === 'cycleLead'}
                onChange={(e) =>
                  void applyPatch('cycleLead', { cycleLeadDays: Number(e.target.value) })
                }
                className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg text-[#231F1D] focus:outline-none focus:border-[#2C4C3B]"
              >
                <option value={1}>1 day before</option>
                <option value={2}>2 days before</option>
                <option value={3}>3 days before</option>
                <option value={5}>5 days before</option>
                <option value={7}>7 days before</option>
              </select>
            </div>
          )}
        </div>

        {/* 2. Notable Dates Timeline */}
        <div className={`${rowPad} space-y-2.5`}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-semibold text-[#231F1D]">Notable Dates Timeline</p>
              <p className="text-xs text-[#6D645D] leading-relaxed">
                Upcoming anniversaries, trips, and saved relationship milestones.
              </p>
            </div>
            <SwitchToggle
              checked={notificationPrefs.timelineEnabled}
              disabled={savingKey === 'timeline'}
              label="Toggle Notable Dates notifications"
              onChange={(next) => void applyPatch('timeline', { timelineEnabled: next })}
            />
          </div>
          {notificationPrefs.timelineEnabled && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <label
                htmlFor={compact ? 'drawer-timeline-lead' : 'settings-timeline-lead'}
                className="text-xs text-[#6D645D]"
              >
                Remind ahead of date
              </label>
              <select
                id={compact ? 'drawer-timeline-lead' : 'settings-timeline-lead'}
                value={notificationPrefs.timelineLeadDays}
                disabled={savingKey === 'timelineLead'}
                onChange={(e) =>
                  void applyPatch('timelineLead', { timelineLeadDays: Number(e.target.value) })
                }
                className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg text-[#231F1D] focus:outline-none focus:border-[#2C4C3B]"
              >
                <option value={1}>1 day ahead</option>
                <option value={3}>3 days ahead</option>
                <option value={7}>7 days ahead</option>
                <option value={14}>14 days ahead</option>
                <option value={30}>30 days ahead</option>
              </select>
            </div>
          )}
        </div>

        {/* 3. Shared Planner */}
        <div className={`${rowPad} space-y-2.5`}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-semibold text-[#231F1D]">Shared Planner</p>
              <p className="text-xs text-[#6D645D] leading-relaxed">
                Overdue tasks, plans due today, and upcoming dated plans.
              </p>
            </div>
            <SwitchToggle
              checked={notificationPrefs.plannerEnabled}
              disabled={savingKey === 'planner'}
              label="Toggle Shared Planner notifications"
              onChange={(next) => void applyPatch('planner', { plannerEnabled: next })}
            />
          </div>
          {notificationPrefs.plannerEnabled && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <label
                htmlFor={compact ? 'drawer-planner-lead' : 'settings-planner-lead'}
                className="text-xs text-[#6D645D]"
              >
                Due-soon window
              </label>
              <select
                id={compact ? 'drawer-planner-lead' : 'settings-planner-lead'}
                value={notificationPrefs.plannerLeadDays}
                disabled={savingKey === 'plannerLead'}
                onChange={(e) =>
                  void applyPatch('plannerLead', { plannerLeadDays: Number(e.target.value) })
                }
                className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg text-[#231F1D] focus:outline-none focus:border-[#2C4C3B]"
              >
                <option value={1}>1 day before</option>
                <option value={2}>2 days before</option>
                <option value={3}>3 days before</option>
                <option value={7}>7 days before</option>
                <option value={14}>14 days before</option>
              </select>
            </div>
          )}
        </div>

        {/* 4. Calendar & Wins */}
        <div className={`${rowPad} flex items-start justify-between gap-4`}>
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-semibold text-[#231F1D]">Calendar &amp; Wins</p>
            <p className="text-xs text-[#6D645D] leading-relaxed">
              Partner marks a Busy or Packed day today/tomorrow, or shares a new win today.
            </p>
          </div>
          <SwitchToggle
            checked={notificationPrefs.calendarEnabled}
            disabled={savingKey === 'calendar'}
            label="Toggle Calendar and Wins notifications"
            onChange={(next) => void applyPatch('calendar', { calendarEnabled: next })}
          />
        </div>

        {/* 5. Partner Dossiers */}
        <div className={`${rowPad} flex items-start justify-between gap-4`}>
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-semibold text-[#231F1D]">Partner Dossiers</p>
            <p className="text-xs text-[#6D645D] leading-relaxed">
              Partner adds or edits a preference, size, care note, or wishlist detail (last 48h).
            </p>
          </div>
          <SwitchToggle
            checked={notificationPrefs.dossiersEnabled}
            disabled={savingKey === 'dossiers'}
            label="Toggle Partner Dossiers notifications"
            onChange={(next) => void applyPatch('dossiers', { dossiersEnabled: next })}
          />
        </div>
      </div>

      {/* Browser Push Alerts */}
      <div className="bg-[#FAF7F2] border border-[#E5DDD1] rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#231F1D]">
              {notificationPrefs.browserPushEnabled && browserPerm === 'granted' ? (
                <BellRing className="w-4 h-4 text-[#2C4C3B] shrink-0" />
              ) : (
                <Bell className="w-4 h-4 text-[#6D645D] shrink-0" />
              )}
              <span>Browser Desktop Alerts</span>
            </div>
            <p className="text-xs text-[#6D645D] leading-relaxed">
              Optionally mirror active module alerts to your device while this tab is open.
            </p>
            <p className="text-[11px] font-mono text-[#6D645D] pt-0.5">
              Status: {browserStatusText}
            </p>
          </div>
          <SwitchToggle
            checked={notificationPrefs.browserPushEnabled && browserPerm === 'granted'}
            disabled={savingKey === 'browser' || !browserSupported}
            label="Toggle browser desktop alerts"
            onChange={(next) => void handleBrowserToggle(next)}
          />
        </div>

        {browserSupported && browserPerm === 'granted' && notificationPrefs.browserPushEnabled && (
          <div className="pt-1 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSendTest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2C4C3B] bg-white border border-[#E5DDD1] hover:bg-[#F2EDE4] rounded-lg transition-colors"
            >
              <Send className="w-3 h-3" />
              <span>Send Test Alert</span>
            </button>
          </div>
        )}
      </div>

      {/* Dismissed Alerts Reset */}
      {notificationPrefs.dismissedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1 text-xs">
          <span className="text-[#6D645D] font-mono tabular-nums">
            {notificationPrefs.dismissedIds.length} dismissed alert
            {notificationPrefs.dismissedIds.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() =>
              void restoreDismissedNotifications().then(() =>
                showToast('Restored dismissed notifications.')
              )
            }
            className="font-medium text-[#2C4C3B] hover:underline"
          >
            Restore all dismissed
          </button>
        </div>
      )}
    </div>
  );
}
