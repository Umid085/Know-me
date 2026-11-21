import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  LIMITS,
  type AccomplishmentCategory,
  type AccomplishmentOwner,
  type BusynessLevel,
  type CycleFlow,
  type CycleMood,
  type CycleSymptom,
  type DossierChapter,
  type EntrySubjectSlot,
  type PartnerSlot,
  type PlannerAssignee,
  type PlannerCategory,
  type SpaceInvite,
  type TimelineCategory,
  type UserProfile,
} from '../types/knowme';
import { addDaysToDateString } from '../utils/cycle';
import { getTodayDateString } from '../utils/dates';

function clampText(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function generateId(prefix: string): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) {
    suffix += alphabet[arr[i] % alphabet.length];
  }
  return `${prefix}_${suffix}`;
}

function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) {
    code += alphabet[arr[i] % alphabet.length];
  }
  return code;
}

function isValidDateOrEmpty(val: string): string {
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return '';
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const path = `userProfiles/${user.uid}`;
  const ref = doc(db, 'userProfiles', user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = clampText(user.displayName || user.email?.split('@')[0] || 'Partner', 80);
    const email = clampText(user.email || '', 160);
    const photoURL = clampText(user.photoURL || '', 500);

    if (snap.exists()) {
      const existing = snap.data() as UserProfile;
      if (
        existing.displayName !== displayName ||
        existing.email !== email ||
        existing.photoURL !== photoURL
      ) {
        await updateDoc(ref, {
          displayName,
          email,
          photoURL,
          updatedAt: serverTimestamp(),
        });
      }
      return {
        ...existing,
        displayName,
        email,
        photoURL,
      };
    }

    const profilePayload = {
      uid: user.uid,
      displayName,
      email,
      photoURL,
      activeSpaceId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, profilePayload);
    return {
      uid: user.uid,
      displayName,
      email,
      photoURL,
      activeSpaceId: '',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createCoupleSpace(params: {
  user: User;
  spaceName: string;
  partnerAName: string;
  partnerBName: string;
  relationshipStartDate: string;
}): Promise<{ spaceId: string; inviteCode: string }> {
  const spaceId = generateId('space');
  const inviteCode = generateInviteCode();
  const spacePath = `coupleSpaces/${spaceId}`;

  const cleanSpaceName = clampText(params.spaceName || 'Our Space', LIMITS.spaceName) || 'Our Space';
  const cleanPartnerA = clampText(params.partnerAName || 'Partner A', LIMITS.partnerName) || 'Partner A';
  const cleanPartnerB = clampText(params.partnerBName || 'Partner B', LIMITS.partnerName) || 'Partner B';
  const cleanStartDate = isValidDateOrEmpty(params.relationshipStartDate);

  try {
    const batch = writeBatch(db);
    const spaceRef = doc(db, 'coupleSpaces', spaceId);
    const inviteRef = doc(db, 'spaceInvites', inviteCode);
    const profileRef = doc(db, 'userProfiles', params.user.uid);

    batch.set(spaceRef, {
      id: spaceId,
      spaceName: cleanSpaceName,
      inviteCode,
      creatorUid: params.user.uid,
      partnerAUid: params.user.uid,
      partnerBUid: '',
      memberUids: [params.user.uid],
      partnerAName: cleanPartnerA,
      partnerBName: cleanPartnerB,
      relationshipStartDate: cleanStartDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(inviteRef, {
      code: inviteCode,
      spaceId,
      creatorUid: params.user.uid,
      claimed: false,
      claimedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    await updateDoc(profileRef, {
      activeSpaceId: spaceId,
      updatedAt: serverTimestamp(),
    });

    return { spaceId, inviteCode };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, spacePath);
  }
}

export async function joinCoupleSpace(params: {
  user: User;
  inviteCode: string;
  partnerBName: string;
}): Promise<{ spaceId: string }> {
  const normalizedCode = params.inviteCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{6,12}$/.test(normalizedCode)) {
    throw new Error('Invite code must be 6 characters (letters and numbers).');
  }

  const invitePath = `spaceInvites/${normalizedCode}`;
  const inviteRef = doc(db, 'spaceInvites', normalizedCode);

  let inviteSnap;
  try {
    inviteSnap = await getDoc(inviteRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, invitePath);
  }

  if (!inviteSnap.exists()) {
    throw new Error('We could not find a couple space with that invite code.');
  }

  const invite = inviteSnap.data() as SpaceInvite;
  if (invite.creatorUid === params.user.uid) {
    throw new Error('You created this invite code. Share it with your partner so they can join.');
  }
  if (invite.claimed) {
    throw new Error('This invite code has already been used by a partner.');
  }

  const cleanPartnerB =
    clampText(params.partnerBName || params.user.displayName || 'Partner', LIMITS.partnerName) || 'Partner';

  const spacePath = `coupleSpaces/${invite.spaceId}`;
  try {
    const batch = writeBatch(db);
    batch.update(inviteRef, {
      claimed: true,
      claimedBy: params.user.uid,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'coupleSpaces', invite.spaceId), {
      memberUids: [invite.creatorUid, params.user.uid],
      partnerBUid: params.user.uid,
      partnerBName: cleanPartnerB,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await updateDoc(doc(db, 'userProfiles', params.user.uid), {
      activeSpaceId: invite.spaceId,
      updatedAt: serverTimestamp(),
    });
    return { spaceId: invite.spaceId };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, spacePath);
  }
}

export async function updateCoupleSpaceSettings(
  spaceId: string,
  payload: {
    spaceName: string;
    partnerAName: string;
    partnerBName: string;
    relationshipStartDate: string;
  }
): Promise<void> {
  const path = `coupleSpaces/${spaceId}`;
  try {
    await updateDoc(doc(db, 'coupleSpaces', spaceId), {
      spaceName: clampText(payload.spaceName, LIMITS.spaceName) || 'Our Space',
      partnerAName: clampText(payload.partnerAName, LIMITS.partnerName) || 'Partner A',
      partnerBName: clampText(payload.partnerBName, LIMITS.partnerName) || 'Partner B',
      relationshipStartDate: isValidDateOrEmpty(payload.relationshipStartDate),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Partner Database Entries ---

export async function savePartnerEntry(
  spaceId: string,
  uid: string,
  payload: {
    id?: string;
    subjectSlot: EntrySubjectSlot;
    chapter: DossierChapter;
    category: string;
    title: string;
    details: string;
    metaNote: string;
    pinned: boolean;
  }
): Promise<void> {
  const cleanCategory = clampText(payload.category || 'General', LIMITS.entryCategory) || 'General';
  const cleanTitle = clampText(payload.title, LIMITS.entryTitle);
  if (!cleanTitle) throw new Error('Entry title is required.');

  const cleanDetails = clampText(payload.details, LIMITS.entryDetails);
  const cleanMeta = clampText(payload.metaNote, LIMITS.entryMetaNote);

  if (payload.id) {
    const path = `coupleSpaces/${spaceId}/partnerEntries/${payload.id}`;
    try {
      await updateDoc(doc(db, 'coupleSpaces', spaceId, 'partnerEntries', payload.id), {
        subjectSlot: payload.subjectSlot,
        chapter: payload.chapter,
        category: cleanCategory,
        title: cleanTitle,
        details: cleanDetails,
        metaNote: cleanMeta,
        pinned: Boolean(payload.pinned),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  const entryId = generateId('entry');
  const path = `coupleSpaces/${spaceId}/partnerEntries/${entryId}`;
  try {
    await setDoc(doc(db, 'coupleSpaces', spaceId, 'partnerEntries', entryId), {
      spaceId,
      subjectSlot: payload.subjectSlot,
      chapter: payload.chapter,
      category: cleanCategory,
      title: cleanTitle,
      details: cleanDetails,
      metaNote: cleanMeta,
      pinned: Boolean(payload.pinned),
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deletePartnerEntry(spaceId: string, entryId: string): Promise<void> {
  const path = `coupleSpaces/${spaceId}/partnerEntries/${entryId}`;
  try {
    await deleteDoc(doc(db, 'coupleSpaces', spaceId, 'partnerEntries', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Shared Planner ---

export async function savePlannerItem(
  spaceId: string,
  uid: string,
  payload: {
    id?: string;
    title: string;
    category: PlannerCategory;
    assignee: PlannerAssignee;
    dueDate: string;
    notes: string;
    completed?: boolean;
    promotedToWin?: boolean;
  }
): Promise<void> {
  const cleanTitle = clampText(payload.title, LIMITS.plannerTitle);
  if (!cleanTitle) throw new Error('Plan title is required.');

  const cleanNotes = clampText(payload.notes, LIMITS.plannerNotes);
  const cleanDueDate = isValidDateOrEmpty(payload.dueDate);

  if (payload.id) {
    const path = `coupleSpaces/${spaceId}/plannerItems/${payload.id}`;
    try {
      await updateDoc(doc(db, 'coupleSpaces', spaceId, 'plannerItems', payload.id), {
        title: cleanTitle,
        category: payload.category,
        assignee: payload.assignee,
        dueDate: cleanDueDate,
        notes: cleanNotes,
        completed: Boolean(payload.completed),
        promotedToWin: Boolean(payload.promotedToWin),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  const itemId = generateId('plan');
  const path = `coupleSpaces/${spaceId}/plannerItems/${itemId}`;
  try {
    await setDoc(doc(db, 'coupleSpaces', spaceId, 'plannerItems', itemId), {
      spaceId,
      title: cleanTitle,
      category: payload.category,
      assignee: payload.assignee,
      dueDate: cleanDueDate,
      notes: cleanNotes,
      completed: false,
      promotedToWin: false,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function togglePlannerItemComplete(
  spaceId: string,
  itemId: string,
  completed: boolean
): Promise<void> {
  const path = `coupleSpaces/${spaceId}/plannerItems/${itemId}`;
  try {
    await updateDoc(doc(db, 'coupleSpaces', spaceId, 'plannerItems', itemId), {
      completed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function promotePlannerItemToWin(
  spaceId: string,
  uid: string,
  item: {
    id: string;
    title: string;
    assignee: PlannerAssignee;
    notes: string;
  }
): Promise<void> {
  const winId = generateId('win');
  const path = `coupleSpaces/${spaceId}/accomplishments/${winId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'coupleSpaces', spaceId, 'accomplishments', winId), {
      spaceId,
      date: getTodayDateString(),
      title: clampText(item.title, LIMITS.accomplishmentTitle),
      owner: item.assignee,
      category: 'relationship',
      reflection: clampText(item.notes || 'Completed from our shared planner.', LIMITS.accomplishmentReflection),
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'coupleSpaces', spaceId, 'plannerItems', item.id), {
      completed: true,
      promotedToWin: true,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePlannerItem(spaceId: string, itemId: string): Promise<void> {
  const path = `coupleSpaces/${spaceId}/plannerItems/${itemId}`;
  try {
    await deleteDoc(doc(db, 'coupleSpaces', spaceId, 'plannerItems', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Notable Dates Timeline ---

export async function saveTimelineEvent(
  spaceId: string,
  uid: string,
  payload: {
    id?: string;
    title: string;
    date: string;
    category: TimelineCategory;
    recurringYearly: boolean;
    location: string;
    story: string;
  }
): Promise<void> {
  const cleanTitle = clampText(payload.title, LIMITS.timelineTitle);
  if (!cleanTitle) throw new Error('Event title is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) throw new Error('Please choose a valid date.');

  const cleanLocation = clampText(payload.location, LIMITS.timelineLocation);
  const cleanStory = clampText(payload.story, LIMITS.timelineStory);

  if (payload.id) {
    const path = `coupleSpaces/${spaceId}/timelineEvents/${payload.id}`;
    try {
      await updateDoc(doc(db, 'coupleSpaces', spaceId, 'timelineEvents', payload.id), {
        title: cleanTitle,
        date: payload.date,
        category: payload.category,
        recurringYearly: Boolean(payload.recurringYearly),
        location: cleanLocation,
        story: cleanStory,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  const eventId = generateId('date');
  const path = `coupleSpaces/${spaceId}/timelineEvents/${eventId}`;
  try {
    await setDoc(doc(db, 'coupleSpaces', spaceId, 'timelineEvents', eventId), {
      spaceId,
      title: cleanTitle,
      date: payload.date,
      category: payload.category,
      recurringYearly: Boolean(payload.recurringYearly),
      location: cleanLocation,
      story: cleanStory,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTimelineEvent(spaceId: string, eventId: string): Promise<void> {
  const path = `coupleSpaces/${spaceId}/timelineEvents/${eventId}`;
  try {
    await deleteDoc(doc(db, 'coupleSpaces', spaceId, 'timelineEvents', eventId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Busyness Logs ---

export async function upsertBusynessLog(
  spaceId: string,
  uid: string,
  payload: {
    date: string;
    partnerSlot: PartnerSlot;
    level: BusynessLevel;
    note: string;
    existsAlready: boolean;
  }
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) throw new Error('Valid date required.');
  const logId = `${payload.date}_${payload.partnerSlot}`;
  const path = `coupleSpaces/${spaceId}/busynessLogs/${logId}`;
  const ref = doc(db, 'coupleSpaces', spaceId, 'busynessLogs', logId);
  const cleanNote = clampText(payload.note, LIMITS.busynessNote);

  try {
    if (payload.existsAlready) {
      await updateDoc(ref, {
        level: payload.level,
        note: cleanNote,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        spaceId,
        date: payload.date,
        partnerSlot: payload.partnerSlot,
        level: payload.level,
        note: cleanNote,
        updatedBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      payload.existsAlready ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteBusynessLog(spaceId: string, logId: string): Promise<void> {
  const path = `coupleSpaces/${spaceId}/busynessLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'coupleSpaces', spaceId, 'busynessLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Accomplishments ---

export async function saveAccomplishment(
  spaceId: string,
  uid: string,
  payload: {
    id?: string;
    date: string;
    title: string;
    owner: AccomplishmentOwner;
    category: AccomplishmentCategory;
    reflection: string;
  }
): Promise<void> {
  const cleanTitle = clampText(payload.title, LIMITS.accomplishmentTitle);
  if (!cleanTitle) throw new Error('Accomplishment title is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) throw new Error('Valid date required.');

  const cleanReflection = clampText(payload.reflection, LIMITS.accomplishmentReflection);

  if (payload.id) {
    const path = `coupleSpaces/${spaceId}/accomplishments/${payload.id}`;
    try {
      await updateDoc(doc(db, 'coupleSpaces', spaceId, 'accomplishments', payload.id), {
        date: payload.date,
        title: cleanTitle,
        owner: payload.owner,
        category: payload.category,
        reflection: cleanReflection,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  const winId = generateId('win');
  const path = `coupleSpaces/${spaceId}/accomplishments/${winId}`;
  try {
    await setDoc(doc(db, 'coupleSpaces', spaceId, 'accomplishments', winId), {
      spaceId,
      date: payload.date,
      title: cleanTitle,
      owner: payload.owner,
      category: payload.category,
      reflection: cleanReflection,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAccomplishment(spaceId: string, winId: string): Promise<void> {
  const path = `coupleSpaces/${spaceId}/accomplishments/${winId}`;
  try {
    await deleteDoc(doc(db, 'coupleSpaces', spaceId, 'accomplishments', winId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Optional Starter Prompts Seeder ---

export async function seedStarterPrompts(spaceId: string, uid: string): Promise<void> {
  const today = getTodayDateString();
  const path = `coupleSpaces/${spaceId}/starterSeed`;
  try {
    const batch = writeBatch(db);

    const starterEntries: Array<{
      subjectSlot: EntrySubjectSlot;
      chapter: DossierChapter;
      category: string;
      title: string;
      details: string;
      metaNote: string;
      pinned: boolean;
    }> = [
      {
        subjectSlot: 'partnerA',
        chapter: 'essentials',
        category: 'Coffee & Food Orders',
        title: 'Go-to morning drink & bakery order',
        details: 'Edit this note with your exact coffee or tea order, milk preference, and favorite pastry.',
        metaNote: 'Quick surprise reference',
        pinned: true,
      },
      {
        subjectSlot: 'partnerB',
        chapter: 'essentials',
        category: 'Sizes',
        title: 'Clothing, shoe & ring sizes',
        details: 'Record top, bottom, shoe, and ring sizes here so thoughtful gifts always fit.',
        metaNote: 'Gift sizing guide',
        pinned: true,
      },
      {
        subjectSlot: 'partnerA',
        chapter: 'care',
        category: 'When Stressed',
        title: 'What helps most after a draining day',
        details: 'Describe whether you prefer quiet decompression time, a walk together, tea, or talking things through.',
        metaNote: 'Care playbook',
        pinned: false,
      },
      {
        subjectSlot: 'partnerB',
        chapter: 'routines',
        category: 'Energy Patterns',
        title: 'Best times for deep talks vs. quiet focus',
        details: 'Note when energy peaks during the day and which evenings are best kept unscheduled.',
        metaNote: 'Rhythm & boundaries',
        pinned: false,
      },
      {
        subjectSlot: 'shared',
        chapter: 'logistics',
        category: 'Travel Preferences',
        title: 'Seat preferences & packing essentials',
        details: 'Window or aisle seat, preferred airlines, hotel priorities, and passport renewal reminders (never store passwords or PINs).',
        metaNote: 'Trip logistics',
        pinned: false,
      },
    ];

    starterEntries.forEach((entry) => {
      const id = generateId('entry');
      batch.set(doc(db, 'coupleSpaces', spaceId, 'partnerEntries', id), {
        spaceId,
        ...entry,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const planId1 = generateId('plan');
    batch.set(doc(db, 'coupleSpaces', spaceId, 'plannerItems', planId1), {
      spaceId,
      title: 'Cook a slow Sunday dinner with phones away',
      category: 'date_idea',
      assignee: 'together',
      dueDate: '',
      notes: 'Pick a new recipe together and play a favorite record.',
      completed: false,
      promotedToWin: false,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const planId2 = generateId('plan');
    batch.set(doc(db, 'coupleSpaces', spaceId, 'plannerItems', planId2), {
      spaceId,
      title: 'Plan a long weekend getaway this season',
      category: 'trip',
      assignee: 'together',
      dueDate: '',
      notes: 'Shortlist two quiet towns within driving distance.',
      completed: false,
      promotedToWin: false,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const dateId = generateId('date');
    batch.set(doc(db, 'coupleSpaces', spaceId, 'timelineEvents', dateId), {
      spaceId,
      title: 'Started our Know Me space',
      date: today,
      category: 'milestone',
      recurringYearly: false,
      location: 'Home',
      story: 'Set up our shared journal for remembering the details that matter, planning life, and celebrating everyday wins.',
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const winId = generateId('win');
    batch.set(doc(db, 'coupleSpaces', spaceId, 'accomplishments', winId), {
      spaceId,
      date: today,
      title: 'Created our shared relationship almanac',
      owner: 'together',
      category: 'relationship',
      reflection: 'Ready to track our busy weeks, preferences, and notable dates in one calm place.',
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Cycle Calendar Settings & Daily Logs ---

const ALLOWED_SYMPTOMS: ReadonlySet<CycleSymptom> = new Set([
  'cramps',
  'headache',
  'bloating',
  'fatigue',
  'backache',
  'cravings',
  'tender',
  'insomnia',
]);

function clampInt(val: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}

export async function upsertCycleSettings(
  spaceId: string,
  uid: string,
  payload: {
    partnerSlot: PartnerSlot;
    enabled: boolean;
    averageCycleLength: number;
    averagePeriodLength: number;
    lutealLength: number;
    careNotes: string;
    existsAlready: boolean;
  }
): Promise<void> {
  const path = `coupleSpaces/${spaceId}/cycleSettings/${payload.partnerSlot}`;
  const ref = doc(db, 'coupleSpaces', spaceId, 'cycleSettings', payload.partnerSlot);
  const averageCycleLength = clampInt(payload.averageCycleLength, 21, 45, 28);
  const averagePeriodLength = clampInt(payload.averagePeriodLength, 2, 10, 5);
  const lutealLength = clampInt(payload.lutealLength, 10, 18, 14);
  const careNotes = clampText(payload.careNotes, LIMITS.cycleCareNotes);

  try {
    if (payload.existsAlready) {
      await updateDoc(ref, {
        enabled: Boolean(payload.enabled),
        averageCycleLength,
        averagePeriodLength,
        lutealLength,
        careNotes,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        spaceId,
        partnerSlot: payload.partnerSlot,
        enabled: Boolean(payload.enabled),
        averageCycleLength,
        averagePeriodLength,
        lutealLength,
        careNotes,
        updatedBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      payload.existsAlready ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function upsertCycleLog(
  spaceId: string,
  uid: string,
  payload: {
    date: string;
    partnerSlot: PartnerSlot;
    isPeriodDay: boolean;
    flow: CycleFlow;
    mood: CycleMood;
    symptoms: CycleSymptom[];
    note: string;
    existsAlready: boolean;
  }
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) throw new Error('Valid date required.');
  const logId = `${payload.date}_${payload.partnerSlot}`;
  const path = `coupleSpaces/${spaceId}/cycleLogs/${logId}`;
  const ref = doc(db, 'coupleSpaces', spaceId, 'cycleLogs', logId);
  const cleanNote = clampText(payload.note, LIMITS.cycleDailyNote);
  const cleanSymptoms = Array.from(
    new Set(payload.symptoms.filter((s) => ALLOWED_SYMPTOMS.has(s)))
  ).slice(0, 8);
  const cleanFlow: CycleFlow = payload.isPeriodDay
    ? payload.flow === 'none'
      ? 'medium'
      : payload.flow
    : payload.flow === 'spotting'
    ? 'spotting'
    : 'none';

  try {
    if (payload.existsAlready) {
      await updateDoc(ref, {
        isPeriodDay: Boolean(payload.isPeriodDay),
        flow: cleanFlow,
        mood: payload.mood,
        symptoms: cleanSymptoms,
        note: cleanNote,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        spaceId,
        date: payload.date,
        partnerSlot: payload.partnerSlot,
        isPeriodDay: Boolean(payload.isPeriodDay),
        flow: cleanFlow,
        mood: payload.mood,
        symptoms: cleanSymptoms,
        note: cleanNote,
        updatedBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      payload.existsAlready ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function logPeriodSpan(
  spaceId: string,
  uid: string,
  params: {
    startDate: string;
    daysCount: number;
    partnerSlot: PartnerSlot;
    existingDates: Set<string>;
  }
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.startDate)) throw new Error('Valid start date required.');
  const span = clampInt(params.daysCount, 1, 10, 5);
  const path = `coupleSpaces/${spaceId}/cycleLogs/span_${params.startDate}`;

  try {
    const batch = writeBatch(db);
    for (let i = 0; i < span; i++) {
      const dateStr = addDaysToDateString(params.startDate, i);
      const logId = `${dateStr}_${params.partnerSlot}`;
      const ref = doc(db, 'coupleSpaces', spaceId, 'cycleLogs', logId);
      const defaultFlow: CycleFlow = i === 0 || i === span - 1 ? 'light' : 'medium';

      if (params.existingDates.has(dateStr)) {
        batch.update(ref, {
          isPeriodDay: true,
          flow: defaultFlow,
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(ref, {
          spaceId,
          date: dateStr,
          partnerSlot: params.partnerSlot,
          isPeriodDay: true,
          flow: defaultFlow,
          mood: '',
          symptoms: [],
          note: '',
          updatedBy: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCycleLog(spaceId: string, logId: string): Promise<void> {
  const path = `coupleSpaces/${spaceId}/cycleLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'coupleSpaces', spaceId, 'cycleLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deletePeriodSpan(
  spaceId: string,
  partnerSlot: PartnerSlot,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) return;
  const path = `coupleSpaces/${spaceId}/cycleLogs/delete_span`;
  try {
    const batch = writeBatch(db);
    for (const dateStr of dates) {
      const logId = `${dateStr}_${partnerSlot}`;
      batch.delete(doc(db, 'coupleSpaces', spaceId, 'cycleLogs', logId));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function getSpaceSubcollectionRef(
  spaceId: string,
  sub:
    | 'partnerEntries'
    | 'plannerItems'
    | 'timelineEvents'
    | 'busynessLogs'
    | 'accomplishments'
    | 'cycleSettings'
    | 'cycleLogs'
) {
  return collection(db, 'coupleSpaces', spaceId, sub);
}
