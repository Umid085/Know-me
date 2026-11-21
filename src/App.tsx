import React, { useState } from 'react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  CalendarHeart,
  CheckSquare,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { CycleCalendarView } from './components/CycleCalendarView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MonthlyCalendarView } from './components/MonthlyCalendarView';
import { NotableDatesTimelineView } from './components/NotableDatesTimelineView';
import { NotificationCenterDrawer } from './components/NotificationCenterDrawer';
import { OnboardingGate } from './components/OnboardingGate';
import { PartnerDossiersView } from './components/PartnerDossiersView';
import { SharedPlannerView } from './components/SharedPlannerView';
import { SpaceSettingsView } from './components/SpaceSettingsView';
import { TodayOverview } from './components/TodayOverview';
import { SpaceProvider, useSpace } from './context/SpaceContext';
import type { NotificationModule, WorkspaceTab } from './types/knowme';

const NAV_ITEMS: {
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  notifModule?: NotificationModule;
}[] = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'dossiers', label: 'Partner Dossiers', icon: BookOpen, notifModule: 'dossiers' },
  { id: 'planner', label: 'Shared Planner', icon: CheckSquare, notifModule: 'planner' },
  { id: 'timeline', label: 'Notable Dates', icon: CalendarHeart, notifModule: 'timeline' },
  { id: 'calendar', label: 'Calendar & Wins', icon: CalendarDays, notifModule: 'calendar' },
  { id: 'cycle', label: 'Cycle Calendar', icon: Moon, notifModule: 'cycle' },
];

const TAB_TITLES: Record<WorkspaceTab, { title: string; ctaLabel?: string }> = {
  today: { title: 'Today Overview', ctaLabel: 'Log Accomplishment' },
  dossiers: { title: 'Partner Dossiers', ctaLabel: 'Add Dossier Note' },
  planner: { title: 'Shared Planner', ctaLabel: 'New Plan' },
  timeline: { title: 'Notable Dates Timeline', ctaLabel: 'Add Notable Date' },
  calendar: { title: 'Busyness & Accomplishments', ctaLabel: 'Log Accomplishment' },
  cycle: { title: 'Cycle Calendar', ctaLabel: 'Set Period Start' },
  settings: { title: 'Space & Pairing Settings' },
};

function WorkspaceShell() {
  const {
    user,
    profileLoading,
    space,
    spaceLoading,
    currentUserSlot,
    unreadNotificationCount,
    unreadByModule,
    signOut,
    toast,
    dismissToast,
  } = useSpace();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('today');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [dossierSignal, setDossierSignal] = useState(0);
  const [plannerSignal, setPlannerSignal] = useState(0);
  const [timelineSignal, setTimelineSignal] = useState(0);
  const [calendarWinSignal, setCalendarWinSignal] = useState(0);
  const [cycleLogSignal, setCycleLogSignal] = useState(0);

  if (user && (profileLoading || spaceLoading)) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white border border-[#E5DDD1] rounded-xl p-7 text-center space-y-4">
          <p className="font-serif text-2xl text-[#231F1D]">Know Me</p>
          <p className="text-sm text-[#6D645D]">Opening your shared couple space...</p>
          <div className="space-y-2 animate-pulse pt-1">
            <div className="h-2.5 bg-[#E5DDD1] rounded w-3/4 mx-auto" />
            <div className="h-2.5 bg-[#E5DDD1] rounded w-1/2 mx-auto" />
          </div>
          <div className="pt-2 flex items-center justify-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[#2C4C3B] font-medium hover:underline"
            >
              Reload
            </button>
            <span className="text-[#E5DDD1]" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-[#6D645D] hover:text-[#231F1D]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !space) {
    return (
      <>
        <OnboardingGate />
        {toast && <ToastBar text={toast.text} actionLabel={toast.actionLabel} onAction={toast.onAction} onDismiss={dismissToast} />}
      </>
    );
  }

  const headerMeta = TAB_TITLES[activeTab];

  function handlePrimaryAction() {
    if (activeTab === 'dossiers') {
      setDossierSignal((n) => n + 1);
    } else if (activeTab === 'planner') {
      setPlannerSignal((n) => n + 1);
    } else if (activeTab === 'timeline') {
      setTimelineSignal((n) => n + 1);
    } else if (activeTab === 'cycle') {
      setCycleLogSignal((n) => n + 1);
    } else if (activeTab === 'calendar' || activeTab === 'today') {
      setActiveTab('calendar');
      setCalendarWinSignal((n) => n + 1);
    }
  }

  function handleNavigate(tab: WorkspaceTab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }

  const myName = currentUserSlot === 'partnerA' ? space.partnerAName : space.partnerBName;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#231F1D] flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-[#F2EDE4] border-r border-[#E5DDD1] sticky top-0 h-screen">
        <div className="h-16 px-6 flex items-center border-b border-[#E5DDD1]">
          <span className="font-serif text-xl font-semibold tracking-tight text-[#231F1D] whitespace-nowrap">
            Know Me
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const moduleUnread = item.notifModule ? unreadByModule[item.notifModule] : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-[#231F1D] font-semibold border border-[#E5DDD1]'
                    : 'text-[#6D645D] hover:text-[#231F1D] hover:bg-[#FAF7F2]/70 font-medium border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#2C4C3B]' : 'text-[#6D645D]'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {moduleUnread > 0 && (
                  <span
                    className={`font-mono text-[11px] tabular-nums shrink-0 ${
                      item.notifModule === 'cycle' ? 'text-[#7B3E52]' : 'text-[#2C4C3B]'
                    }`}
                    aria-label={`${moduleUnread} unread alerts`}
                  >
                    {moduleUnread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Space summary + Settings */}
        <div className="p-4 border-t border-[#E5DDD1] space-y-2">
          <div className="px-2.5 py-1.5">
            <p className="text-xs font-semibold text-[#231F1D] truncate">{space.spaceName}</p>
            <p className="text-[11px] text-[#6D645D] truncate">
              {myName} · {space.partnerBUid ? 'Synced' : `Code ${space.inviteCode}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleNavigate('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'settings'
                ? 'bg-white text-[#231F1D] border border-[#E5DDD1]'
                : 'text-[#6D645D] hover:text-[#231F1D] hover:bg-[#FAF7F2]/70'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Space &amp; Pairing</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb/Page Title on Left, Single Primary CTA on Right */}
        <header className="sticky top-0 z-30 h-16 bg-[#FAF7F2]/95 backdrop-blur-xs border-b border-[#E5DDD1] px-5 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-[#231F1D] hover:bg-[#F2EDE4] rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-[#6D645D] truncate max-w-[160px]">
                {space.spaceName}
              </span>
              <span className="hidden sm:inline text-[#6D645D]" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-[#231F1D] truncate">{headerMeta.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label={
                unreadNotificationCount > 0
                  ? `Open notifications (${unreadNotificationCount} unread)`
                  : 'Open notifications'
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-[#231F1D] bg-white border border-[#E5DDD1] hover:bg-[#F2EDE4] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Bell
                className={`w-4 h-4 ${
                  unreadNotificationCount > 0 ? 'text-[#2C4C3B]' : 'text-[#6D645D]'
                }`}
              />
              {unreadNotificationCount > 0 && (
                <span className="font-mono text-xs tabular-nums text-[#2C4C3B]">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
            {headerMeta.ctaLabel && (
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{headerMeta.ctaLabel}</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 w-full max-w-[1200px] mx-auto px-5 sm:px-8 lg:px-10 py-8 pb-16">
          {activeTab === 'today' && (
            <TodayOverview
              onNavigate={handleNavigate}
              onQuickAddWin={() => {
                setActiveTab('calendar');
                setCalendarWinSignal((n) => n + 1);
              }}
              onQuickAddPlan={() => {
                setActiveTab('planner');
                setPlannerSignal((n) => n + 1);
              }}
              onOpenNotifications={() => setNotificationsOpen(true)}
            />
          )}
          {activeTab === 'dossiers' && <PartnerDossiersView openDrawerSignal={dossierSignal} />}
          {activeTab === 'planner' && <SharedPlannerView openDrawerSignal={plannerSignal} />}
          {activeTab === 'timeline' && (
            <NotableDatesTimelineView openDrawerSignal={timelineSignal} />
          )}
          {activeTab === 'calendar' && (
            <MonthlyCalendarView
              focusWinSignal={calendarWinSignal}
              onOpenCycleCalendar={() => handleNavigate('cycle')}
            />
          )}
          {activeTab === 'cycle' && <CycleCalendarView openQuickLogSignal={cycleLogSignal} />}
          {activeTab === 'settings' && <SpaceSettingsView />}
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex bg-[#231F1D]/40" role="dialog" aria-modal="true">
          <div className="w-72 max-w-[85vw] bg-[#F2EDE4] h-full flex flex-col border-r border-[#E5DDD1]">
            <div className="h-16 px-5 flex items-center justify-between border-b border-[#E5DDD1]">
              <span className="font-serif text-xl font-semibold text-[#231F1D]">Know Me</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-[#6D645D] hover:text-[#231F1D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                const moduleUnread = item.notifModule ? unreadByModule[item.notifModule] : 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm rounded-lg transition-colors ${
                      active
                        ? 'bg-white text-[#231F1D] font-semibold border border-[#E5DDD1]'
                        : 'text-[#6D645D] hover:text-[#231F1D]'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {moduleUnread > 0 && (
                      <span
                        className={`font-mono text-[11px] tabular-nums shrink-0 ${
                          item.notifModule === 'cycle' ? 'text-[#7B3E52]' : 'text-[#2C4C3B]'
                        }`}
                      >
                        {moduleUnread}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#E5DDD1]">
              <button
                type="button"
                onClick={() => handleNavigate('settings')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#231F1D] bg-white border border-[#E5DDD1] rounded-lg"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Space &amp; Pairing</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      <NotificationCenterDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onNavigate={handleNavigate}
      />

      {toast && (
        <ToastBar
          text={toast.text}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}

function ToastBar({
  text,
  actionLabel,
  onAction,
  onDismiss,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 max-w-md bg-[#231F1D] text-[#FAF7F2] px-4 py-3 rounded-xl shadow-lg flex items-center gap-3.5 text-sm"
    >
      <span className="leading-snug">{text}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={() => {
            onAction();
            onDismiss();
          }}
          className="px-2.5 py-1 text-xs font-medium bg-[#FAF7F2] text-[#231F1D] rounded-md hover:bg-white whitespace-nowrap shrink-0"
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-[#FAF7F2]/60 hover:text-[#FAF7F2] shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SpaceProvider>
        <WorkspaceShell />
      </SpaceProvider>
    </ErrorBoundary>
  );
}
