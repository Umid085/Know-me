import type { Timestamp } from 'firebase/firestore';

export type PartnerSlot = 'partnerA' | 'partnerB';
export type EntrySubjectSlot = PartnerSlot | 'shared';
export type DossierChapter = 'essentials' | 'care' | 'routines' | 'logistics';
export type PlannerCategory = 'date_idea' | 'home_life' | 'trip' | 'goal';
export type PlannerAssignee = 'together' | PartnerSlot;
export type TimelineCategory = 'milestone' | 'anniversary' | 'trip' | 'first';
export type BusynessLevel = 'light' | 'steady' | 'busy' | 'packed';
export type AccomplishmentOwner = PartnerSlot | 'together';
export type AccomplishmentCategory = 'personal' | 'career' | 'relationship' | 'wellness';
export type WorkspaceTab = 'today' | 'dossiers' | 'planner' | 'timeline' | 'calendar' | 'cycle' | 'settings';
export type CycleFlow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
export type CycleMood = '' | 'calm' | 'happy' | 'sensitive' | 'tired' | 'irritable' | 'anxious' | 'energized';
export type CycleSymptom =
  | 'cramps'
  | 'headache'
  | 'bloating'
  | 'fatigue'
  | 'backache'
  | 'cravings'
  | 'tender'
  | 'insomnia';
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export const LIMITS = {
  spaceName: 80,
  partnerName: 60,
  entryCategory: 60,
  entryTitle: 120,
  entryDetails: 2000,
  entryMetaNote: 200,
  plannerTitle: 140,
  plannerNotes: 1000,
  timelineTitle: 120,
  timelineLocation: 120,
  timelineStory: 2000,
  busynessNote: 300,
  accomplishmentTitle: 140,
  accomplishmentReflection: 1000,
  cycleCareNotes: 500,
  cycleDailyNote: 400,
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  activeSpaceId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CoupleSpace {
  id: string;
  spaceName: string;
  inviteCode: string;
  creatorUid: string;
  partnerAUid: string;
  partnerBUid: string;
  memberUids: string[];
  partnerAName: string;
  partnerBName: string;
  relationshipStartDate: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SpaceInvite {
  code: string;
  spaceId: string;
  creatorUid: string;
  claimed: boolean;
  claimedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PartnerEntry {
  id: string;
  spaceId: string;
  subjectSlot: EntrySubjectSlot;
  chapter: DossierChapter;
  category: string;
  title: string;
  details: string;
  metaNote: string;
  pinned: boolean;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PlannerItem {
  id: string;
  spaceId: string;
  title: string;
  category: PlannerCategory;
  assignee: PlannerAssignee;
  dueDate: string;
  notes: string;
  completed: boolean;
  promotedToWin: boolean;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TimelineEvent {
  id: string;
  spaceId: string;
  title: string;
  date: string;
  category: TimelineCategory;
  recurringYearly: boolean;
  location: string;
  story: string;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BusynessLog {
  id: string;
  spaceId: string;
  date: string;
  partnerSlot: PartnerSlot;
  level: BusynessLevel;
  note: string;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Accomplishment {
  id: string;
  spaceId: string;
  date: string;
  title: string;
  owner: AccomplishmentOwner;
  category: AccomplishmentCategory;
  reflection: string;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const DOSSIER_CHAPTERS: {
  id: DossierChapter;
  index: string;
  label: string;
  shortLabel: string;
  description: string;
  suggestedCategories: string[];
}[] = [
  {
    id: 'essentials',
    index: '01',
    label: 'Essentials & Gifts',
    shortLabel: 'Essentials',
    description: 'Favorites, clothing and ring sizes, allergies, dietary notes, and gift ideas.',
    suggestedCategories: ['Favorites', 'Sizes', 'Allergies & Dietary', 'Gift Ideas', 'Coffee & Food Orders'],
  },
  {
    id: 'care',
    index: '02',
    label: 'Care & Connection',
    shortLabel: 'Care',
    description: 'Love languages, comfort habits when stressed or unwell, and thoughtful reminders.',
    suggestedCategories: ['Love Language', 'Comfort Habits', 'When Stressed', 'Care Notes', 'Small Joys'],
  },
  {
    id: 'routines',
    index: '03',
    label: 'Routines & Boundaries',
    shortLabel: 'Routines',
    description: 'Daily rhythms, peak and low energy windows, communication habits, and boundaries.',
    suggestedCategories: ['Daily Routine', 'Energy Patterns', 'Communication', 'Boundaries', 'Recharge Rituals'],
  },
  {
    id: 'logistics',
    index: '04',
    label: 'Logistics & Wishlists',
    shortLabel: 'Logistics',
    description: 'Travel preferences, non-sensitive document reminders, and personal or shared wishlists.',
    suggestedCategories: ['Travel Preferences', 'Document Reminders', 'Wishlist', 'Emergency Contacts', 'Home Notes'],
  },
];

export const BUSYNESS_META: Record<
  BusynessLevel,
  { label: string; shortLabel: string; description: string; colorHex: string; barClass: string; textClass: string; bgSoftClass: string }
> = {
  light: {
    label: 'Light',
    shortLabel: 'Light',
    description: 'Open bandwidth — easy time to connect or make spontaneous plans.',
    colorHex: '#3F7D58',
    barClass: 'bg-[#3F7D58]',
    textClass: 'text-[#2C5B3F]',
    bgSoftClass: 'bg-[#3F7D58]/10',
  },
  steady: {
    label: 'Steady',
    shortLabel: 'Steady',
    description: 'Normal pace with a few commitments; evening time mostly free.',
    colorHex: '#A67428',
    barClass: 'bg-[#A67428]',
    textClass: 'text-[#7C5519]',
    bgSoftClass: 'bg-[#A67428]/10',
  },
  busy: {
    label: 'Busy',
    shortLabel: 'Busy',
    description: 'Full schedule — keep plans simple and check in before adding tasks.',
    colorHex: '#B55336',
    barClass: 'bg-[#B55336]',
    textClass: 'text-[#8B3B24]',
    bgSoftClass: 'bg-[#B55336]/10',
  },
  packed: {
    label: 'Packed',
    shortLabel: 'Packed',
    description: 'Heads-down day — low energy expected; quiet support appreciated.',
    colorHex: '#8C2F39',
    barClass: 'bg-[#8C2F39]',
    textClass: 'text-[#70232C]',
    bgSoftClass: 'bg-[#8C2F39]/10',
  },
};

export const PLANNER_CATEGORY_LABELS: Record<PlannerCategory, string> = {
  date_idea: 'Date Ideas',
  home_life: 'Home & Life',
  trip: 'Trips',
  goal: 'Goals',
};

export const TIMELINE_CATEGORY_LABELS: Record<TimelineCategory, string> = {
  milestone: 'Milestone',
  anniversary: 'Anniversary',
  trip: 'Trip',
  first: 'First',
};

export const ACCOMPLISHMENT_CATEGORY_LABELS: Record<AccomplishmentCategory, string> = {
  personal: 'Personal',
  career: 'Work & Study',
  relationship: 'Together',
  wellness: 'Health & Rest',
};

export interface CycleSettings {
  id: string;
  spaceId: string;
  partnerSlot: PartnerSlot;
  enabled: boolean;
  averageCycleLength: number;
  averagePeriodLength: number;
  lutealLength: number;
  careNotes: string;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CycleLog {
  id: string;
  spaceId: string;
  date: string;
  partnerSlot: PartnerSlot;
  isPeriodDay: boolean;
  flow: CycleFlow;
  mood: CycleMood;
  symptoms: CycleSymptom[];
  note: string;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const CYCLE_FLOW_LABELS: Record<CycleFlow, string> = {
  none: 'No flow',
  spotting: 'Spotting',
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
};

export const CYCLE_MOOD_LABELS: Record<Exclude<CycleMood, ''>, string> = {
  calm: 'Calm',
  happy: 'Happy',
  energized: 'Energized',
  sensitive: 'Sensitive',
  tired: 'Tired',
  irritable: 'Irritable',
  anxious: 'Anxious',
};

export const CYCLE_SYMPTOM_LABELS: Record<CycleSymptom, string> = {
  cramps: 'Cramps',
  fatigue: 'Low energy',
  headache: 'Headache',
  bloating: 'Bloating',
  backache: 'Backache',
  cravings: 'Cravings',
  tender: 'Tenderness',
  insomnia: 'Restless sleep',
};

export const CYCLE_PHASE_META: Record<
  CyclePhase,
  {
    label: string;
    shortLabel: string;
    rhythmNote: string;
    partnerSupportHint: string;
    accentTextClass: string;
    dotClass: string;
    softBgClass: string;
  }
> = {
  menstrual: {
    label: 'Menstrual Phase',
    shortLabel: 'Period',
    rhythmNote: 'Restorative days — energy is often lower and warmth or quiet comfort helps.',
    partnerSupportHint: 'Offer extra gentleness, warm drinks, fewer unplanned errands, and cozy evenings.',
    accentTextClass: 'text-[#7B3E52]',
    dotClass: 'bg-[#7B3E52]',
    softBgClass: 'bg-[#7B3E52]/10',
  },
  follicular: {
    label: 'Follicular Phase',
    shortLabel: 'Follicular',
    rhythmNote: 'Rising energy and curiosity — a great window for outings, projects, and fresh plans.',
    partnerSupportHint: 'Great timing for spontaneous date nights, shared goals, or trying a new spot together.',
    accentTextClass: 'text-[#2C4C3B]',
    dotClass: 'bg-[#2C4C3B]',
    softBgClass: 'bg-[#2C4C3B]/10',
  },
  ovulation: {
    label: 'Ovulation & Fertile Window',
    shortLabel: 'Fertile',
    rhythmNote: 'Peak energy and social bandwidth around estimated ovulation.',
    partnerSupportHint: 'High-connection window — ideal for quality time, conversation, and active plans.',
    accentTextClass: 'text-[#A67428]',
    dotClass: 'bg-[#A67428]',
    softBgClass: 'bg-[#A67428]/12',
  },
  luteal: {
    label: 'Luteal Phase',
    shortLabel: 'Luteal',
    rhythmNote: 'Gradual wind-down toward the next cycle; late days can bring sensitivity or fatigue.',
    partnerSupportHint: 'Keep schedules predictable, check in gently, and stock favorite comfort snacks.',
    accentTextClass: 'text-[#5E4E5E]',
    dotClass: 'bg-[#7C6B7D]',
    softBgClass: 'bg-[#7C6B7D]/10',
  },
};

export type NotificationModule = 'cycle' | 'timeline' | 'planner' | 'calendar' | 'dossiers';
export type NotificationPriority = 'high' | 'normal' | 'info';

export interface NotificationPrefs {
  spaceId: string;
  uid: string;
  browserPushEnabled: boolean;
  cycleEnabled: boolean;
  cycleLeadDays: number;
  timelineEnabled: boolean;
  timelineLeadDays: number;
  plannerEnabled: boolean;
  plannerLeadDays: number;
  calendarEnabled: boolean;
  dossiersEnabled: boolean;
  dismissedIds: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AppNotification {
  id: string;
  module: NotificationModule;
  targetTab: WorkspaceTab;
  priority: NotificationPriority;
  timingLabel: string;
  title: string;
  body: string;
  actionLabel: string;
  isDismissed: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: Omit<NotificationPrefs, 'spaceId' | 'uid' | 'createdAt' | 'updatedAt'> = {
  browserPushEnabled: false,
  cycleEnabled: true,
  cycleLeadDays: 3,
  timelineEnabled: true,
  timelineLeadDays: 7,
  plannerEnabled: true,
  plannerLeadDays: 2,
  calendarEnabled: true,
  dossiersEnabled: true,
  dismissedIds: [],
};

export const NOTIFICATION_MODULE_LABELS: Record<NotificationModule, string> = {
  cycle: 'Cycle Calendar',
  timeline: 'Notable Dates',
  planner: 'Shared Planner',
  calendar: 'Calendar & Wins',
  dossiers: 'Partner Dossiers',
};
