import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import {
  ensureUserProfile,
  getSpaceSubcollectionRef,
  saveNotificationPrefs,
} from '../services/spaceService';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type Accomplishment,
  type AppNotification,
  type BusynessLog,
  type CoupleSpace,
  type CycleLog,
  type CycleSettings,
  type NotificationModule,
  type NotificationPrefs,
  type PartnerEntry,
  type PartnerSlot,
  type PlannerItem,
  type TimelineEvent,
  type UserProfile,
} from '../types/knowme';
import {
  buildModuleNotifications,
  dispatchBrowserNotification,
  getBrowserNotificationPermission,
} from '../utils/notifications';

export interface ToastMessage {
  id: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export type NotificationPrefsEditable = Omit<
  NotificationPrefs,
  'spaceId' | 'uid' | 'createdAt' | 'updatedAt'
>;

interface SpaceContextValue {
  user: User | null;
  authLoading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  space: CoupleSpace | null;
  spaceLoading: boolean;
  currentUserSlot: PartnerSlot;
  partnerEntries: PartnerEntry[];
  plannerItems: PlannerItem[];
  timelineEvents: TimelineEvent[];
  busynessLogs: BusynessLog[];
  accomplishments: Accomplishment[];
  cycleSettings: CycleSettings[];
  cycleLogs: CycleLog[];
  notificationPrefs: NotificationPrefsEditable;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  unreadByModule: Record<NotificationModule, number>;
  updateNotificationPrefs: (patch: Partial<NotificationPrefsEditable>) => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  restoreDismissedNotifications: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  toast: ToastMessage | null;
  showToast: (text: string, action?: { label: string; onClick: () => void }) => void;
  dismissToast: () => void;
  getPartnerLabel: (slot: 'partnerA' | 'partnerB' | 'shared' | 'together') => string;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [space, setSpace] = useState<CoupleSpace | null>(null);
  const [spaceLoading, setSpaceLoading] = useState(false);

  const [partnerEntries, setPartnerEntries] = useState<PartnerEntry[]>([]);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [busynessLogs, setBusynessLogs] = useState<BusynessLog[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [cycleSettings, setCycleSettings] = useState<CycleSettings[]>([]);
  const [cycleLogs, setCycleLogs] = useState<CycleLog[]>([]);
  const [rawNotificationPrefs, setRawNotificationPrefs] = useState<NotificationPrefs | null>(null);
  const [notificationPrefsLoaded, setNotificationPrefsLoaded] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  const showToast = useCallback(
    (text: string, action?: { label: string; onClick: () => void }) => {
      const id = String(Date.now());
      setToast({
        id,
        text,
        actionLabel: action?.label,
        onAction: action?.onClick,
      });
    },
    []
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, toast.actionLabel ? 6500 : 3400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // 1. Auth listener (with safety timeout so preview never hangs if iframe storage is slow)
  useEffect(() => {
    const safetyTimer = window.setTimeout(() => {
      setAuthLoading(false);
    }, 4000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        window.clearTimeout(safetyTimer);
        setUser(firebaseUser);
        setAuthLoading(false);
        if (!firebaseUser) {
          setProfile(null);
          setSpace(null);
          setPartnerEntries([]);
          setPlannerItems([]);
          setTimelineEvents([]);
          setBusynessLogs([]);
          setAccomplishments([]);
          setCycleSettings([]);
          setCycleLogs([]);
          setRawNotificationPrefs(null);
          setNotificationPrefsLoaded(false);
        }
      },
      () => {
        window.clearTimeout(safetyTimer);
        setAuthLoading(false);
      }
    );
    return () => {
      window.clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // 2. Ensure & subscribe to userProfile when authenticated
  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);

    ensureUserProfile(user)
      .then(() => {
        if (cancelled) return;
      })
      .catch((err) => {
        if (!cancelled) setFatalError(err instanceof Error ? err : new Error(String(err)));
      });

    const profilePath = `userProfiles/${user.uid}`;
    const unsub = onSnapshot(
      doc(db, 'userProfiles', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile((prev) => {
            if (
              snap.metadata.hasPendingWrites &&
              data.activeSpaceId &&
              data.activeSpaceId !== prev?.activeSpaceId
            ) {
              return prev;
            }
            return data;
          });
        }
        setProfileLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, profilePath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  // 3a. Subscribe to parent coupleSpace document first
  const activeSpaceId = profile?.activeSpaceId || '';

  useEffect(() => {
    if (!user || !activeSpaceId) {
      setSpace(null);
      setSpaceLoading(false);
      return;
    }

    setSpaceLoading(true);
    const spacePath = `coupleSpaces/${activeSpaceId}`;

    const unsubSpace = onSnapshot(
      doc(db, 'coupleSpaces', activeSpaceId),
      (snap) => {
        if (snap.exists()) {
          setSpace(snap.data() as CoupleSpace);
        } else {
          setSpace(null);
        }
        setSpaceLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, spacePath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => {
      unsubSpace();
    };
  }, [user, activeSpaceId]);

  // 3b. Subscribe to the 5 subcollections only once parent space membership is confirmed
  const confirmedSpaceId =
    user &&
    space &&
    space.id === activeSpaceId &&
    Array.isArray(space.memberUids) &&
    space.memberUids.includes(user.uid)
      ? space.id
      : '';

  useEffect(() => {
    if (!user || !confirmedSpaceId) {
      setPartnerEntries([]);
      setPlannerItems([]);
      setTimelineEvents([]);
      setBusynessLogs([]);
      setAccomplishments([]);
      setCycleSettings([]);
      setCycleLogs([]);
      setRawNotificationPrefs(null);
      setNotificationPrefsLoaded(false);
      return;
    }

    const spacePath = `coupleSpaces/${confirmedSpaceId}`;

    const entriesPath = `${spacePath}/partnerEntries`;
    const unsubEntries = onSnapshot(
      query(
        getSpaceSubcollectionRef(confirmedSpaceId, 'partnerEntries'),
        where('spaceId', '==', confirmedSpaceId)
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PartnerEntry, 'id'>) }));
        list.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0);
        });
        setPartnerEntries(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, entriesPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const plannerPath = `${spacePath}/plannerItems`;
    const unsubPlanner = onSnapshot(
      query(
        getSpaceSubcollectionRef(confirmedSpaceId, 'plannerItems'),
        where('spaceId', '==', confirmedSpaceId)
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlannerItem, 'id'>) }));
        list.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        });
        setPlannerItems(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, plannerPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const timelinePath = `${spacePath}/timelineEvents`;
    const unsubTimeline = onSnapshot(
      query(
        getSpaceSubcollectionRef(confirmedSpaceId, 'timelineEvents'),
        where('spaceId', '==', confirmedSpaceId)
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TimelineEvent, 'id'>) }));
        list.sort((a, b) => b.date.localeCompare(a.date));
        setTimelineEvents(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, timelinePath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const busynessPath = `${spacePath}/busynessLogs`;
    const unsubBusyness = onSnapshot(
      query(
        getSpaceSubcollectionRef(confirmedSpaceId, 'busynessLogs'),
        where('spaceId', '==', confirmedSpaceId)
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BusynessLog, 'id'>) }));
        setBusynessLogs(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, busynessPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const winsPath = `${spacePath}/accomplishments`;
    const unsubWins = onSnapshot(
      query(
        getSpaceSubcollectionRef(confirmedSpaceId, 'accomplishments'),
        where('spaceId', '==', confirmedSpaceId)
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Accomplishment, 'id'>) }));
        list.sort((a, b) => {
          const cmp = b.date.localeCompare(a.date);
          if (cmp !== 0) return cmp;
          return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        });
        setAccomplishments(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, winsPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const cycleSettingsPath = `${spacePath}/cycleSettings`;
    const unsubCycleSettings = onSnapshot(
      query(
        getSpaceSubcollectionRef(confirmedSpaceId, 'cycleSettings'),
        where('spaceId', '==', confirmedSpaceId)
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CycleSettings, 'id'>) }));
        setCycleSettings(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, cycleSettingsPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const cycleLogsPath = `${spacePath}/cycleLogs`;
    const unsubCycleLogs = onSnapshot(
      query(
        getSpaceSubcollectionRef(confirmedSpaceId, 'cycleLogs'),
        where('spaceId', '==', confirmedSpaceId)
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CycleLog, 'id'>) }));
        list.sort((a, b) => b.date.localeCompare(a.date));
        setCycleLogs(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, cycleLogsPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const notifPrefsPath = `${spacePath}/notificationPrefs/${user.uid}`;
    const unsubNotifPrefs = onSnapshot(
      doc(db, 'coupleSpaces', confirmedSpaceId, 'notificationPrefs', user.uid),
      (snap) => {
        if (snap.exists()) {
          setRawNotificationPrefs(snap.data() as NotificationPrefs);
        } else {
          setRawNotificationPrefs(null);
        }
        setNotificationPrefsLoaded(true);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, notifPrefsPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => {
      unsubEntries();
      unsubPlanner();
      unsubTimeline();
      unsubBusyness();
      unsubWins();
      unsubCycleSettings();
      unsubCycleLogs();
      unsubNotifPrefs();
    };
  }, [user, confirmedSpaceId]);

  const currentUserSlot: PartnerSlot = useMemo(() => {
    if (!space || !user) return 'partnerA';
    return space.partnerBUid === user.uid ? 'partnerB' : 'partnerA';
  }, [space, user]);

  const notificationPrefs: NotificationPrefsEditable = useMemo(() => {
    if (!rawNotificationPrefs) return DEFAULT_NOTIFICATION_PREFS;
    return {
      browserPushEnabled: Boolean(rawNotificationPrefs.browserPushEnabled),
      cycleEnabled: Boolean(rawNotificationPrefs.cycleEnabled),
      cycleLeadDays: rawNotificationPrefs.cycleLeadDays ?? DEFAULT_NOTIFICATION_PREFS.cycleLeadDays,
      timelineEnabled: Boolean(rawNotificationPrefs.timelineEnabled),
      timelineLeadDays:
        rawNotificationPrefs.timelineLeadDays ?? DEFAULT_NOTIFICATION_PREFS.timelineLeadDays,
      plannerEnabled: Boolean(rawNotificationPrefs.plannerEnabled),
      plannerLeadDays:
        rawNotificationPrefs.plannerLeadDays ?? DEFAULT_NOTIFICATION_PREFS.plannerLeadDays,
      calendarEnabled: Boolean(rawNotificationPrefs.calendarEnabled),
      dossiersEnabled: Boolean(rawNotificationPrefs.dossiersEnabled),
      dismissedIds: Array.isArray(rawNotificationPrefs.dismissedIds)
        ? rawNotificationPrefs.dismissedIds
        : [],
    };
  }, [rawNotificationPrefs]);

  const notifications = useMemo(() => {
    if (!space || !user) return [];
    return buildModuleNotifications({
      userId: user.uid,
      currentUserSlot,
      space,
      partnerEntries,
      plannerItems,
      timelineEvents,
      busynessLogs,
      accomplishments,
      cycleSettings,
      cycleLogs,
      prefs: rawNotificationPrefs,
    });
  }, [
    space,
    user,
    currentUserSlot,
    partnerEntries,
    plannerItems,
    timelineEvents,
    busynessLogs,
    accomplishments,
    cycleSettings,
    cycleLogs,
    rawNotificationPrefs,
  ]);

  const { unreadNotificationCount, unreadByModule } = useMemo(() => {
    const byModule: Record<NotificationModule, number> = {
      cycle: 0,
      timeline: 0,
      planner: 0,
      calendar: 0,
      dossiers: 0,
    };
    let total = 0;
    for (const item of notifications) {
      if (!item.isDismissed) {
        total += 1;
        byModule[item.module] += 1;
      }
    }
    return { unreadNotificationCount: total, unreadByModule: byModule };
  }, [notifications]);

  const updateNotificationPrefs = useCallback(
    async (patch: Partial<NotificationPrefsEditable>) => {
      if (!space || !user) return;
      const merged: NotificationPrefsEditable = {
        ...notificationPrefs,
        ...patch,
      };
      await saveNotificationPrefs(space.id, user.uid, {
        ...merged,
        existsAlready: Boolean(rawNotificationPrefs),
      });
    },
    [space, user, notificationPrefs, rawNotificationPrefs]
  );

  const dismissNotification = useCallback(
    async (notificationId: string) => {
      if (!space || !user) return;
      if (notificationPrefs.dismissedIds.includes(notificationId)) return;
      const nextDismissed = [...notificationPrefs.dismissedIds, notificationId].slice(-100);
      await saveNotificationPrefs(space.id, user.uid, {
        ...notificationPrefs,
        dismissedIds: nextDismissed,
        existsAlready: Boolean(rawNotificationPrefs),
      });
    },
    [space, user, notificationPrefs, rawNotificationPrefs]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!space || !user) return;
    const unreadIds = notifications.filter((n) => !n.isDismissed).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const mergedIds = Array.from(
      new Set([...notificationPrefs.dismissedIds, ...unreadIds])
    ).slice(-100);
    await saveNotificationPrefs(space.id, user.uid, {
      ...notificationPrefs,
      dismissedIds: mergedIds,
      existsAlready: Boolean(rawNotificationPrefs),
    });
  }, [space, user, notifications, notificationPrefs, rawNotificationPrefs]);

  const restoreDismissedNotifications = useCallback(async () => {
    if (!space || !user) return;
    await saveNotificationPrefs(space.id, user.uid, {
      ...notificationPrefs,
      dismissedIds: [],
      existsAlready: Boolean(rawNotificationPrefs),
    });
  }, [space, user, notificationPrefs, rawNotificationPrefs]);

  // Deduplicated native browser notification dispatch when user explicitly opted in
  useEffect(() => {
    if (!user || !space || !notificationPrefsLoaded) return;
    if (!notificationPrefs.browserPushEnabled) return;
    if (getBrowserNotificationPermission() !== 'granted') return;

    const unread = notifications.filter((n) => !n.isDismissed);
    if (unread.length === 0) return;

    const storageKey = `knowme_pushed_notifs_${space.id}_${user.uid}`;
    let sentIds: string[] = [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          sentIds = parsed.filter((v): v is string => typeof v === 'string');
        }
      }
    } catch {
      sentIds = [];
    }

    const sentSet = new Set(sentIds);
    const pending = unread.filter((n) => !sentSet.has(n.id));
    if (pending.length === 0) return;

    const batch = pending.slice(0, 3);
    const newlySent: string[] = [];
    for (const item of batch) {
      const ok = dispatchBrowserNotification(item.title, item.body, item.id);
      if (ok) newlySent.push(item.id);
    }

    if (newlySent.length > 0) {
      try {
        const updated = Array.from(new Set([...sentIds, ...newlySent])).slice(-150);
        window.localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // Ignore storage quota / iframe restrictions
      }
    }
  }, [user, space, notificationPrefsLoaded, notificationPrefs.browserPushEnabled, notifications]);

  const getPartnerLabel = useCallback(
    (slot: 'partnerA' | 'partnerB' | 'shared' | 'together') => {
      if (slot === 'shared') return 'Shared';
      if (slot === 'together') return 'Together';
      if (slot === 'partnerA') return space?.partnerAName || 'Partner A';
      return space?.partnerBName || 'Partner B';
    },
    [space]
  );

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value: SpaceContextValue = {
    user,
    authLoading,
    profile,
    profileLoading,
    space,
    spaceLoading,
    currentUserSlot,
    partnerEntries,
    plannerItems,
    timelineEvents,
    busynessLogs,
    accomplishments,
    cycleSettings,
    cycleLogs,
    notificationPrefs,
    notifications,
    unreadNotificationCount,
    unreadByModule,
    updateNotificationPrefs,
    dismissNotification,
    markAllNotificationsRead,
    restoreDismissedNotifications,
    signInWithGoogle,
    signOut,
    toast,
    showToast,
    dismissToast,
    getPartnerLabel,
  };

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace(): SpaceContextValue {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error('useSpace must be used within SpaceProvider');
  return ctx;
}
