# Know Me — Firestore Security Specification

## 1. Data Invariants

1. **PII Isolation**: `userProfiles/{userId}` holds user email and display metadata. Only the authenticated verified owner (`request.auth.uid == userId`) may read or write their profile. Listing `userProfiles` is unconditionally denied.
2. **Two-Partner Space Cap**: A `coupleSpaces/{spaceId}` document can contain at most two members (`memberUids.size() <= 2`). Only verified users in `memberUids` can read, update settings, or access any subcollection beneath that space.
3. **Atomic Single-Use Invite Claiming**: Joining a couple space requires claiming an unclaimed `spaceInvites/{inviteCode}` atomically in the same batch (`claimed: false -> true`, `claimedBy: request.auth.uid`). Once `claimed == true`, the invite is terminally locked.
4. **Master Gate Subcollection Isolation**: Every document in `partnerEntries`, `plannerItems`, `timelineEvents`, `busynessLogs`, `accomplishments`, `cycleSettings`, and `cycleLogs` must belong to an existing `coupleSpaces/{spaceId}` where `request.auth.uid` is currently in `memberUids`, and its `spaceId` field must match the path `{spaceId}`. `notificationPrefs/{userId}` additionally restricts read/write strictly to `request.auth.uid == userId` with `allow list: if false` and bounds `dismissedIds.size() <= 100`.
5. **Temporal & Schema Integrity**: Every create sets `createdAt == request.time` and `updatedAt == request.time`; every update preserves `createdAt`, `createdBy`/`creatorUid`, and `spaceId` immutably, sets `updatedAt == request.time`, enforces `hasOnly(...)` key allowlists, bounds numeric ranges (`averageCycleLength` 21..45, `averagePeriodLength` 2..10, `lutealLength` 10..18, `cycleLeadDays` 1..7, `timelineLeadDays` 1..30, `plannerLeadDays` 1..14) and arrays (`symptoms` <= 8, `dismissedIds` <= 100), and respects every string length and enum constraint from `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Cross-User Profile Read (PII Leak)**: User B requests `get /userProfiles/{userA_uid}`.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create a `coupleSpaces` document.
3. **Shadow Field Injection**: Partner A updates `partnerEntries/{id}` or `cycleLogs/{id}` with an extra ghost key `{ isAdmin: true }`.
4. **ID Poisoning**: User attempts to create `/coupleSpaces/../../evil$id`, a 200-character document ID, or a `cycleLogs` ID not matching `date + '_' + partnerSlot`.
5. **Third-Member Space Takeover**: User C attempts to join a `coupleSpaces/{spaceId}` that already has 2 members (`memberUids.size() == 2`).
6. **Non-Atomic Invite Bypass**: User B attempts to add themselves to `coupleSpaces/{spaceId}.memberUids` without claiming `spaceInvites/{inviteCode}` in the same batch.
7. **Terminal Invite Replay**: User C attempts to update a `spaceInvites/{code}` where `claimed == true`.
8. **Creator Spoofing**: Partner B creates a `partnerEntries` document with `createdBy: partnerA_uid` or a `cycleLogs` document with `updatedBy: partnerA_uid`.
9. **Timestamp Forgery**: Partner A creates a `plannerItems` or `cycleSettings` document with client-forged `createdAt` not equal to `request.time`.
10. **Immutable Space Relocation**: Partner A updates a `timelineEvents` or `cycleLogs` document to change `spaceId` to another space.
11. **Oversized String / Unbounded Array / Out-of-Range Numbers**: Partner A writes a 5,000-character `details` field into `partnerEntries`, 20 arbitrary items into `cycleLogs.symptoms`, or `averageCycleLength: 999` into `cycleSettings`.
12. **Unauthorized Subcollection Listing**: Non-member User C executes a `list` query on `/coupleSpaces/{spaceId}/partnerEntries` or `/coupleSpaces/{spaceId}/cycleLogs`.
