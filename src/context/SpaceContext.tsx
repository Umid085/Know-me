import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { ensureUserProfile, getSpaceSubcollectionRef } from '../services/spaceService';
import type {
  Accomplishment,
  BusynessLog,
  CoupleSpace,
  CycleLog,
  CycleSettings,
  PartnerEntry,
  PartnerSlot,
  PlannerItem,
  TimelineEvent,
  UserProfile,
} from '../types/knowme';

export interface ToastMessage {
  id: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

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

    return () => {
      unsubEntries();
      unsubPlanner();
      unsubTimeline();
      unsubBusyness();
      unsubWins();
      unsubCycleSettings();
      unsubCycleLogs();
    };
  }, [user, confirmedSpaceId]);

  const currentUserSlot: PartnerSlot = useMemo(() => {
    if (!space || !user) return 'partnerA';
    return space.partnerBUid === user.uid ? 'partnerB' : 'partnerA';
  }, [space, user]);

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
