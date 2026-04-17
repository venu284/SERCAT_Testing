# Task 1 — Migrate 5 Light/Medium Screens Off `useMockApp`

> **Goal**: Replace `useMockApp()` imports in 5 screens with real API hooks (`useApiData`, `useActiveCycle`, `useAuth`, `useMemberDashboardContext`). Zero changes to visual UI or styling.
>
> **Project root**: The inner `SERCAT_Testing/` directory (contains `package.json`, `src/`, `api/`, `db/`, `lib/`)
>
> **Rule**: Every screen must show a loading state while data fetches and an error state if the API call fails. Follow the exact patterns established in the already-migrated screens (see Reference section below).

---

## Context: What Already Exists

The project has a complete backend (35+ API routes, Neon PostgreSQL, Drizzle ORM) and a partially migrated frontend. These pieces are already built and working — **do NOT modify them**:

### Already-migrated screens (use as reference patterns):
- `src/screens/auth/LoginScreen.jsx` — uses `useAuth()`
- `src/screens/auth/ActivateAccountScreen.jsx` — uses `useAuth()`
- `src/screens/admin/AdminDashboard.jsx` — uses `useActiveCycle()`, `usePreferenceStatus()`, `useSchedule()`, `useUsers()`
- `src/screens/admin/AdminComments.jsx` — uses `useComments()`, `useUpdateComment()`
- `src/screens/member/MemberDashboard.jsx` — uses `useActiveCycle()`, `useMemberDashboardContext()`
- `src/screens/member/MemberComments.jsx` — uses `useComments()`, `useCreateComment()`

### Available hooks in `src/hooks/useApiData.js`:
```
useInstitutions, useUsers, useCreateUser, useCycles, useCreateCycle, useUpdateCycle,
useAvailableDates, useSetAvailableDates, useMasterShares, useUploadShares,
useCycleShares, useSnapshotShares, usePreferences, useSubmitPreferences,
usePreferenceStatus, useSchedule, useGenerateSchedule, usePublishSchedule,
useAdjustAssignment, useNotifications, useComments, useCreateComment,
useUpdateComment, useMarkNotificationRead, useMarkAllNotificationsRead,
useSwapRequests, useCreateSwapRequest, useResolveSwapRequest, useAuditLog
```

### Available context hooks:
- `src/hooks/useActiveCycle.js` — returns `{ activeCycle, activeCycleId, isLoading, error }`
- `src/hooks/useMemberDashboardContext.js` — returns `{ member, entitlement, preferenceDeadline, daysUntilPreferenceDeadline, isPreferenceSubmitted, schedulePublication, currentMemberAssignments, memberShiftCounts, isLoading, error }`
- `src/contexts/AuthContext.jsx` — returns `{ user, loading, login, logout, activate, requestReset, setNewPassword }`

### API client:
- `src/lib/api.js` — `api.get()`, `api.post()`, `api.put()`, `api.delete()` — all return `{ data }` or throw `ApiError`

---

## Screens to Migrate (5 total)

### Screen 1: `src/screens/admin/FairnessPanel.jsx` (8 lines — trivial)

**Current code:**
```jsx
import React from 'react';
import FairnessDashboard from '../../components/FairnessDashboard';
import { useMockApp } from '../../lib/mock-state';

export default function FairnessPanel() {
  const { results, queue } = useMockApp();
  return <FairnessDashboard results={results} initialQueue={queue} />;
}
```

**What to do:**
- Replace `useMockApp()` with `useActiveCycle()` + `useSchedule(activeCycleId)`
- `results` maps to the schedule data. The `FairnessDashboard` component expects `results.fairness`, `results.metadata`, `results.engineLog`, `results.errors`
- The schedule API (`GET /api/cycles/:id/schedules`) returns `{ assignments, analytics, status, ... }`. Build the `results` object from this response the same way `useServerSync.js` does (lines 157-187 in that file)
- `queue` maps to `analytics.detectedPatterns.updatedPriorityQueue || []`
- Add loading/error states

**New code pattern:**
```jsx
import React, { useMemo } from 'react';
import FairnessDashboard from '../../components/FairnessDashboard';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import { useSchedule } from '../../hooks/useApiData';
import { CONCEPT_THEME } from '../../lib/theme';

export default function FairnessPanel() {
  const { activeCycleId, isLoading: cycleLoading } = useActiveCycle();
  const scheduleQuery = useSchedule(activeCycleId);

  const { results, queue } = useMemo(() => {
    const sched = scheduleQuery.data;
    if (!sched || !Array.isArray(sched.assignments)) {
      return { results: null, queue: [] };
    }
    const detected = sched.analytics?.detectedPatterns || {};
    const stdDev = sched.analytics?.fairnessStdDeviation != null
      ? Number(sched.analytics.fairnessStdDeviation) : 0;
    const mean = detected.deviationMean != null ? parseFloat(detected.deviationMean) : 0;

    return {
      results: {
        assignments: sched.assignments,
        fairness: {
          memberSatisfaction: sched.analytics?.piSatisfactionScores || [],
          updatedPriorityQueue: detected.updatedPriorityQueue || [],
          workingQueueFinal: detected.workingQueueFinal || [],
          deviation: { mean, stdDev },
        },
        metadata: detected.metadata || {
          totalRounds: 0, totalConflicts: 0, totalProximity: 0,
          totalAuto: 0, totalBackfill: 0,
        },
        engineLog: detected.engineLog || [],
        errors: detected.errors || [],
        warnings: detected.warnings || [],
        analytics: sched.analytics || null,
      },
      queue: detected.updatedPriorityQueue || [],
    };
  }, [scheduleQuery.data]);

  if (cycleLoading || scheduleQuery.isLoading) {
    return <div className="py-12 text-center text-sm" style={{ color: CONCEPT_THEME.muted }}>Loading fairness data...</div>;
  }

  if (!results) {
    return <div className="py-12 text-center text-sm" style={{ color: CONCEPT_THEME.muted }}>Run the engine to populate this screen.</div>;
  }

  return <FairnessDashboard results={results} initialQueue={queue} />;
}
```

---

### Screen 2: `src/screens/admin/ConflictLog.jsx` (8 lines — trivial)

**Current code uses:** `{ results } = useMockApp()`

**What to do:**
- Identical pattern to FairnessPanel above — use `useActiveCycle()` + `useSchedule(activeCycleId)` and build the same `results` object
- The `ConflictLogPanel` component expects `results.engineLog`, `results.metadata`, `results.errors`, `results.warnings`

**Implementation:** Same `useMemo` as FairnessPanel to build `results` from schedule data. Add loading/empty states.

---

### Screen 3: `src/screens/member/AvailabilityCalendar.jsx` (35 lines)

**Current code uses:** `{ hasAvailabilityCalendar, cycle, memberDirectory } = useMockApp()`

**What to do:**
- `hasAvailabilityCalendar` = `Boolean(cycle.startDate && cycle.endDate && cycle.startDate <= cycle.endDate)` — derive from active cycle
- `cycle` = the active cycle object. The `ShiftSlotCalendar` component expects `{ startDate, endDate, blockedDates, blockedSlots }`. Build from `useActiveCycle()` + `useAvailableDates(activeCycleId)`
- `memberDirectory` = `Object.fromEntries(members.map(m => [m.id, m]))`. Build from `useMasterShares()` + `useUsers()`

**New imports:**
```jsx
import { useActiveCycle } from '../../hooks/useActiveCycle';
import { useAvailableDates, useMasterShares, useUsers } from '../../hooks/useApiData';
```

**Key data mapping:**
```jsx
// Build cycle object for ShiftSlotCalendar
const cycleProp = useMemo(() => {
  if (!activeCycle) return null;
  const dates = datesQuery.data || [];
  // available_dates API returns array of { date, isAvailable }
  const blockedDates = dates
    .filter(d => !d.isAvailable)
    .map(d => d.date);
  return {
    id: activeCycle.name || activeCycle.id,
    startDate: activeCycle.startDate,
    endDate: activeCycle.endDate,
    blockedDates,
    blockedSlots: [], // admin-only feature, not relevant in member view
  };
}, [activeCycle, datesQuery.data]);

const hasAvailabilityCalendar = Boolean(
  cycleProp?.startDate && cycleProp?.endDate && cycleProp.startDate <= cycleProp.endDate
);

// Build memberDirectory from shares + users
const memberDirectory = useMemo(() => {
  const shares = Array.isArray(sharesQuery.data?.data) ? sharesQuery.data.data
    : Array.isArray(sharesQuery.data) ? sharesQuery.data : [];
  const dir = {};
  shares.forEach(s => {
    const key = s.institutionAbbreviation || s.institutionId;
    if (key) dir[key] = { id: key, name: s.institutionName || key, shares: Number(s.wholeShares || 0) + Number(s.fractionalShares || 0) };
  });
  return dir;
}, [sharesQuery.data]);
```

---

### Screen 4: `src/screens/member/MemberProfile.jsx` (142 lines)

**Current code uses:** `{ activeMember, saveMemberProfile, isAdminSession } = useMockApp()`

**What to do:**
- `activeMember` — build from `useAuth()` + `useMasterShares()`. The member's profile data is their user record + their share entry
- `isAdminSession` — `user?.role === 'admin'` from `useAuth()`
- `saveMemberProfile` — currently updates local mock state. For production, this maps to `PUT /api/users/:id` to update the user's name/email/phone. Use the `api.put()` call directly or create a small mutation

**Key mapping:**
```jsx
const { user } = useAuth();
const sharesQuery = useMasterShares();
const isAdminSession = user?.role === 'admin';

const activeMember = useMemo(() => {
  const shares = Array.isArray(sharesQuery.data?.data) ? sharesQuery.data.data
    : Array.isArray(sharesQuery.data) ? sharesQuery.data : [];
  const myShare = shares.find(s => s.piId === user?.id);
  if (!myShare && !isAdminSession) return null;
  return {
    id: myShare?.institutionAbbreviation || user?.institutionAbbreviation || 'PI',
    name: myShare?.institutionName || user?.institutionName || user?.name || 'Member',
    shares: Number(myShare?.wholeShares || 0) + Number(myShare?.fractionalShares || 0),
    status: 'ACTIVE',
    piName: user?.name || '',
    piEmail: user?.email || '',
    piPhone: user?.phone || '',
    piRole: user?.role || '',
    _userId: user?.id,
  };
}, [sharesQuery.data, user, isAdminSession]);
```

**For `saveMemberProfile`:**
```jsx
const [saving, setSaving] = useState(false);

const handleSave = async (event) => {
  event.preventDefault();
  setSaving(true);
  try {
    await api.put(`/users/${activeMember._userId}`, {
      name: form.piName,
      email: form.piEmail,
      phone: form.piPhone,
    });
    setError('');
    setSuccess('Profile updated successfully.');
  } catch (err) {
    setError(err.message || 'Unable to save profile changes.');
    setSuccess('');
  } finally {
    setSaving(false);
  }
};
```

**Note:** The `PUT /api/users/:id` endpoint (`api/users/[id].js`) already exists and accepts `{ name, email }`. Check if it also accepts `phone` — if not, add `phone` as an optional field in the user update handler and add a `phone` column to the `users` table. If adding a column is out of scope for this task, simply save name and email and note that phone requires a schema update.

---

### Screen 5: `src/screens/member/MySchedule.jsx` (155 lines)

**Current code uses:**
```
{ cycle, downloadMemberSchedulePdf, hasGeneratedSchedule,
  hasGeneratedScheduleForCurrentMember, sortedCurrentMemberAssignments,
  memberShiftCounts, scheduleUpcomingAssignments, schedulePastAssignments,
  nextUpcomingAssignment, formatMemberShiftDate, formatMemberShiftTiming,
  scheduleRelativeDayLabel } = useMockApp()
```

**What to do:**
- This screen needs the same data that `useMemberDashboardContext` already provides (`currentMemberAssignments`, `memberShiftCounts`), plus some additional computed values. **Extend `useMemberDashboardContext`** or create a new hook `useMyScheduleContext` that builds on it.
- Key derivations:

```jsx
import { useActiveCycle } from '../../hooks/useActiveCycle';
import { useMemberDashboardContext } from '../../hooks/useMemberDashboardContext';
import { formatCalendarDate, localTodayDateStr, daysBetweenSigned } from '../../lib/dates';
import { SHIFT_HOURS } from '../../lib/constants'; // or define inline

// From useMemberDashboardContext
const { member, currentMemberAssignments, memberShiftCounts, schedulePublication, isLoading, error } = useMemberDashboardContext();
const { activeCycle } = useActiveCycle();

// Derived values
const hasGeneratedSchedule = schedulePublication.status === 'draft' || schedulePublication.status === 'published';
const hasGeneratedScheduleForCurrentMember = currentMemberAssignments.length > 0;

const sortedCurrentMemberAssignments = useMemo(
  () => [...currentMemberAssignments].sort((a, b) => String(a.assignedDate).localeCompare(String(b.assignedDate))),
  [currentMemberAssignments]
);

const todayDate = localTodayDateStr();

const scheduleUpcomingAssignments = useMemo(
  () => sortedCurrentMemberAssignments.filter(a => String(a.assignedDate || '') >= todayDate),
  [sortedCurrentMemberAssignments, todayDate]
);

const schedulePastAssignments = useMemo(
  () => sortedCurrentMemberAssignments.filter(a => String(a.assignedDate || '') < todayDate),
  [sortedCurrentMemberAssignments, todayDate]
);

const nextUpcomingAssignment = scheduleUpcomingAssignments[0] || null;

// Helper functions (move to top of file or a shared util)
const formatMemberShiftDate = (dateStr) => formatCalendarDate(dateStr);

const formatMemberShiftTiming = (shift) => {
  const times = { DS1: '8:00 AM – 4:00 PM', DS2: '4:00 PM – 12:00 AM', NS: '12:00 AM – 8:00 AM' };
  return times[shift] || shift;
};

const scheduleRelativeDayLabel = (dateStr) => {
  if (!dateStr) return '';
  const diff = daysBetweenSigned(todayDate, dateStr);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 0) return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
};

// Build cycle prop for display
const cycle = {
  id: activeCycle?.name || '',
  startDate: activeCycle?.startDate || '',
  endDate: activeCycle?.endDate || '',
};
```

**For `downloadMemberSchedulePdf`:**
This is a client-side PDF generation function. For now, keep it as a no-op or a simple stub that shows a "PDF export coming soon" message. The PDF generation logic in `mock-state.js` (lines 1946-2024) uses canvas-based rendering — it can be extracted to a standalone utility in a later task. For this migration:

```jsx
const handleExportPdf = () => {
  setExportError('PDF export will be available soon.');
};
```

---

## Verification Checklist

After all 5 screens are migrated, verify:

- [ ] `FairnessPanel` — shows fairness dashboard when schedule exists, empty state when not
- [ ] `ConflictLog` — shows engine log when schedule exists, empty state when not
- [ ] `AvailabilityCalendar` — shows calendar with blocked dates from API, warning when no cycle
- [ ] `MemberProfile` — shows member info from API, save updates via `PUT /api/users/:id`
- [ ] `MySchedule` — shows assignments from API, shift counts, upcoming/past split, loading states
- [ ] No screen imports `useMockApp` anymore (these 5 screens only)
- [ ] `npm run build` succeeds with no errors
- [ ] All existing tests still pass: `npm run check`

## Files Modified

```
MODIFIED:
  src/screens/admin/FairnessPanel.jsx
  src/screens/admin/ConflictLog.jsx
  src/screens/member/AvailabilityCalendar.jsx
  src/screens/member/MemberProfile.jsx
  src/screens/member/MySchedule.jsx

NOT MODIFIED (do not touch):
  src/lib/mock-state.js
  src/App.jsx
  src/hooks/useApiData.js
  src/hooks/useMemberDashboardContext.js
  src/contexts/AuthContext.jsx
  Any API routes, DB schema, or backend files
  Any other screen files
```

---

## Reference: `useServerSync.js` Schedule → Results Mapping (lines 157-187)

This is the canonical mapping from the schedule API response to the `results` object shape that `FairnessDashboard` and `ConflictLogPanel` expect. Reuse this exact structure:

```javascript
const sched = scheduleQuery.data;  // from GET /api/cycles/:id/schedules

const detected = sched.analytics?.detectedPatterns || {};
const stdDev = sched.analytics?.fairnessStdDeviation != null
  ? Number(sched.analytics.fairnessStdDeviation) : 0;
const mean = detected.deviationMean != null ? parseFloat(detected.deviationMean) : 0;

const results = {
  assignments: sched.assignments,
  fairness: {
    memberSatisfaction: sched.analytics?.piSatisfactionScores || [],
    updatedPriorityQueue: detected.updatedPriorityQueue || [],
    workingQueueFinal: detected.workingQueueFinal || [],
    deviation: { mean, stdDev },
  },
  metadata: detected.metadata || {
    totalRounds: 0, totalConflicts: 0, totalProximity: 0,
    totalAuto: 0, totalBackfill: 0,
  },
  engineLog: detected.engineLog || [],
  errors: detected.errors || [],
  warnings: detected.warnings || [],
  analytics: sched.analytics || null,
};
```

---

## Reference: Member Object Shape

When building `activeMember` or entries in `memberDirectory`, use this shape to match what existing components expect:

```javascript
{
  id: 'UGA',                          // institutionAbbreviation — used as display key
  name: 'University of Georgia',       // institutionName
  shares: 2.5,                         // wholeShares + fractionalShares
  status: 'ACTIVE',
  piName: 'Dr. Smith',                 // user.name
  piEmail: 'smith@uga.edu',            // user.email
  piPhone: '555-0100',                 // user.phone (if available)
  piRole: 'Principal Investigator',
  _piUserId: 'uuid-...',              // user.id (for API calls)
  _institutionUuid: 'uuid-...',       // institutionId (for API calls)
}
```
