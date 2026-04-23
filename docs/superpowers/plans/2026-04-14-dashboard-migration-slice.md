# Dashboard Migration Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** migrate `AdminDashboard` and `MemberDashboard` off `useMockApp()` while preserving the current dashboard UI almost exactly and removing the admin local snapshot controls.

**Architecture:** add a small `useActiveCycle` seam that unwraps the existing paginated cycle API, then add a focused `useMemberDashboardContext` hook that derives the exact member-dashboard values from auth, shares, preferences, and schedule data. Keep `AdminDashboard` screen-local: it composes `useActiveCycle`, `useUsers`, `usePreferenceStatus`, and `useSchedule` directly and removes the prototype workspace card instead of building a broader admin abstraction.

**Tech Stack:** Vite, React 18, React Router 6, TanStack Query, Vitest, Testing Library

---

## File Map

**Create**

- `src/hooks/useActiveCycle.js`
- `src/hooks/useActiveCycle.test.js`
- `src/hooks/useMemberDashboardContext.js`
- `src/hooks/useMemberDashboardContext.test.js`
- `src/screens/member/MemberDashboard.test.jsx`
- `src/screens/admin/AdminDashboard.test.jsx`

**Modify**

- `src/screens/member/MemberDashboard.jsx`
- `src/screens/admin/AdminDashboard.jsx`
- `package.json`

**Why this structure**

- `useActiveCycle` is the smallest reusable seam needed by both dashboards and later screen migrations.
- `useMemberDashboardContext` keeps the member-dashboard derivations out of JSX without broadening this slice into a general state layer.
- `AdminDashboard` stays screen-local on purpose. Only this screen needs its exact summary mix right now, so a shared admin hook would add abstraction without reuse.
- `package.json` changes are deferred to the final task so each earlier task can run focused `vitest` commands during TDD.

### Task 1: Add `useActiveCycle`

**Files:**

- Create: `src/hooks/useActiveCycle.js`
- Create: `src/hooks/useActiveCycle.test.js`

- [ ] **Step 1: Write the failing hook test**

Create `src/hooks/useActiveCycle.test.js`:

```js
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useCycles = vi.fn();

vi.mock('./useApiData', () => ({
  useCycles: () => useCycles(),
}));

import { useActiveCycle } from './useActiveCycle';

describe('useActiveCycle', () => {
  beforeEach(() => {
    useCycles.mockReset();
  });

  it('selects the first non-archived cycle from the paginated cycles payload', () => {
    useCycles.mockReturnValue({
      data: [
        { id: 'cycle-archived', status: 'archived', name: 'Archived Cycle' },
        { id: 'cycle-live', status: 'collecting', name: 'Live Cycle' },
        { id: 'cycle-next', status: 'setup', name: 'Next Cycle' },
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useActiveCycle());

    expect(result.current.activeCycle).toEqual({
      id: 'cycle-live',
      status: 'collecting',
      name: 'Live Cycle',
    });
    expect(result.current.activeCycleId).toBe('cycle-live');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('falls back to the first cycle when every cycle is archived-like or missing status', () => {
    useCycles.mockReturnValue({
      data: [
        { id: 'cycle-old', status: 'archived', name: 'Old Cycle' },
        { id: 'cycle-older', name: 'Older Cycle' },
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useActiveCycle());

    expect(result.current.activeCycle).toEqual({
      id: 'cycle-old',
      status: 'archived',
      name: 'Old Cycle',
    });
    expect(result.current.activeCycleId).toBe('cycle-old');
  });

  it('returns a safe null state when the cycles query has no rows yet', () => {
    useCycles.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() => useActiveCycle());

    expect(result.current.activeCycle).toBeNull();
    expect(result.current.activeCycleId).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
npx vitest run src/hooks/useActiveCycle.test.js
```

Expected: FAIL with `Cannot find module './useActiveCycle'` or missing export errors.

- [ ] **Step 3: Implement `useActiveCycle`**

Create `src/hooks/useActiveCycle.js`:

```js
import { useMemo } from 'react';
import { useCycles } from './useApiData';

function extractCycles(payload) {
  return Array.isArray(payload) ? payload : [];
}

export function useActiveCycle() {
  const cyclesQuery = useCycles();

  const cycles = useMemo(
    () => extractCycles(cyclesQuery.data),
    [cyclesQuery.data],
  );

  const activeCycle = useMemo(() => (
    cycles.find((cycle) => cycle?.status && cycle.status !== 'archived')
    || cycles[0]
    || null
  ), [cycles]);

  return {
    activeCycle,
    activeCycleId: activeCycle?.id || null,
    isLoading: cyclesQuery.isLoading,
    error: cyclesQuery.error || null,
  };
}
```

- [ ] **Step 4: Run the hook test again**

Run:

```bash
npx vitest run src/hooks/useActiveCycle.test.js
```

Expected: PASS with `3 passed`.

- [ ] **Step 5: Commit the hook seam**

Run:

```bash
git add src/hooks/useActiveCycle.js src/hooks/useActiveCycle.test.js
git commit -m "feat: add active cycle dashboard hook"
```

### Task 2: Add `useMemberDashboardContext`

**Files:**

- Create: `src/hooks/useMemberDashboardContext.js`
- Create: `src/hooks/useMemberDashboardContext.test.js`

- [ ] **Step 1: Write the failing hook tests**

Create `src/hooks/useMemberDashboardContext.test.js`:

```js
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuth = vi.fn();
const useActiveCycle = vi.fn();
const useMasterShares = vi.fn();
const usePreferences = vi.fn();
const useSchedule = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('./useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('./useApiData', () => ({
  useMasterShares: () => useMasterShares(),
  usePreferences: (cycleId) => usePreferences(cycleId),
  useSchedule: (cycleId) => useSchedule(cycleId),
}));

import { useMemberDashboardContext } from './useMemberDashboardContext';

describe('useMemberDashboardContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));

    useAuth.mockReturnValue({
      user: {
        id: 'pi-1',
        role: 'pi',
        institutionId: 'inst-1',
        institutionName: 'Example Lab',
        institutionAbbreviation: 'EL',
      },
    });

    useActiveCycle.mockReturnValue({
      activeCycle: {
        id: 'cycle-1',
        startDate: '2026-04-20',
        endDate: '2026-04-30',
        preferenceDeadline: '',
      },
      activeCycleId: 'cycle-1',
      isLoading: false,
      error: null,
    });

    useMasterShares.mockReturnValue({
      data: [
        {
          piId: 'pi-1',
          institutionId: 'inst-1',
          institutionName: 'Example Lab',
          institutionAbbreviation: 'EL',
          wholeShares: '1',
          fractionalShares: '0.5',
        },
      ],
      isLoading: false,
      error: null,
    });

    usePreferences.mockReturnValue({
      data: {
        submittedAt: '2026-04-13T09:00:00Z',
        submissions: [{ piId: 'pi-1', submittedAt: '2026-04-13T09:00:00Z' }],
      },
      isLoading: false,
      error: null,
    });

    useSchedule.mockReturnValue({
      data: {
        status: 'published',
        publishedAt: '2026-04-18T10:00:00Z',
        generatedAt: '2026-04-17T10:00:00Z',
        assignments: [
          { id: 'a-1', piId: 'pi-1', assignedDate: '2026-04-21', shift: 'DS1' },
          { id: 'a-2', piId: 'pi-1', assignedDate: '2026-04-22', shift: 'NS' },
          { id: 'a-3', piId: 'pi-2', assignedDate: '2026-04-23', shift: 'DS2' },
        ],
      },
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives entitlement, deadline fallback, submission state, and member assignments from live payloads', () => {
    const { result } = renderHook(() => useMemberDashboardContext());

    expect(usePreferences).toHaveBeenCalledWith('cycle-1');
    expect(useSchedule).toHaveBeenCalledWith('cycle-1');

    expect(result.current.member).toEqual({
      id: 'EL',
      name: 'Example Lab',
      shares: 1.5,
      status: 'ACTIVE',
      _piUserId: 'pi-1',
      _institutionUuid: 'inst-1',
    });

    expect(result.current.entitlement).toEqual({
      memberId: 'EL',
      totalShares: 1.5,
      wholeShares: 1,
      fractionalHours: 12,
      nightShifts: 1,
    });

    expect(result.current.preferenceDeadline).toBe('2026-04-13');
    expect(result.current.daysUntilPreferenceDeadline).toBe(-1);
    expect(result.current.isPreferenceSubmitted).toBe(true);
    expect(result.current.schedulePublication).toEqual({
      status: 'published',
      publishedAt: '2026-04-18T10:00:00Z',
      draftedAt: '2026-04-17T10:00:00Z',
    });
    expect(result.current.currentMemberAssignments).toHaveLength(2);
    expect(result.current.memberShiftCounts).toEqual({
      DS1: 1,
      DS2: 0,
      NS: 1,
    });
  });

  it('returns a safe empty member state when the signed-in PI has no share row yet', () => {
    useMasterShares.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useMemberDashboardContext());

    expect(result.current.member).toBeNull();
    expect(result.current.entitlement).toEqual({
      wholeShares: 0,
      fractionalHours: 0,
    });
    expect(result.current.currentMemberAssignments).toEqual([]);
    expect(result.current.memberShiftCounts).toEqual({
      DS1: 0,
      DS2: 0,
      NS: 0,
    });
  });
});
```

- [ ] **Step 2: Run the new hook tests and confirm they fail**

Run:

```bash
npx vitest run src/hooks/useMemberDashboardContext.test.js
```

Expected: FAIL with `Cannot find module './useMemberDashboardContext'`.

- [ ] **Step 3: Implement the focused member-dashboard hook**

Create `src/hooks/useMemberDashboardContext.js`:

```js
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { computeEntitlements } from '../lib/entitlements';
import { addDays, daysBetweenSigned, localTodayDateStr } from '../lib/dates';
import { useMasterShares, usePreferences, useSchedule } from './useApiData';
import { useActiveCycle } from './useActiveCycle';

function extractRows(payload) {
  return Array.isArray(payload) ? payload : [];
}

function normalizePreferenceDeadline(cycle) {
  const explicit = cycle?.preferenceDeadline
    ? String(cycle.preferenceDeadline).split('T')[0]
    : '';

  if (explicit) return explicit;
  if (!cycle?.startDate) return '';
  return addDays(cycle.startDate, -7);
}

function buildMember(user, share) {
  if (!user || !share) return null;

  const wholeShares = Number(share.wholeShares) || 0;
  const fractionalShares = Number(share.fractionalShares) || 0;

  return {
    id: share.institutionAbbreviation || user.institutionAbbreviation || 'PI',
    name: share.institutionName || user.institutionName || user.name || 'Member',
    shares: Number((wholeShares + fractionalShares).toFixed(2)),
    status: 'ACTIVE',
    _piUserId: share.piId || user.id,
    _institutionUuid: share.institutionId || user.institutionId || null,
  };
}

export function useMemberDashboardContext() {
  const { user } = useAuth();
  const { activeCycle, activeCycleId, isLoading: cycleLoading, error: cycleError } = useActiveCycle();
  const sharesQuery = useMasterShares();
  const preferencesQuery = usePreferences(activeCycleId);
  const scheduleQuery = useSchedule(activeCycleId);

  const shareRows = useMemo(
    () => extractRows(sharesQuery.data),
    [sharesQuery.data],
  );

  const activeShare = useMemo(() => (
    shareRows.find((row) => row.piId === user?.id)
    || shareRows.find((row) => row.institutionId === user?.institutionId)
    || null
  ), [shareRows, user]);

  const member = useMemo(
    () => buildMember(user, activeShare),
    [user, activeShare],
  );

  const entitlement = useMemo(() => (
    member
      ? (computeEntitlements([member])[0] || { wholeShares: 0, fractionalHours: 0 })
      : { wholeShares: 0, fractionalHours: 0 }
  ), [member]);

  const preferencePayload = preferencesQuery.data || {};
  const schedulePayload = scheduleQuery.data || null;

  const preferenceDeadline = useMemo(
    () => normalizePreferenceDeadline(activeCycle),
    [activeCycle],
  );

  const currentMemberAssignments = useMemo(() => {
    if (!member || !Array.isArray(schedulePayload?.assignments)) return [];
    return schedulePayload.assignments.filter((assignment) => assignment.piId === member._piUserId);
  }, [member, schedulePayload]);

  const memberShiftCounts = useMemo(() => (
    currentMemberAssignments.reduce((acc, assignment) => {
      const shift = assignment.shift;
      if (shift) acc[shift] = (acc[shift] || 0) + 1;
      return acc;
    }, { DS1: 0, DS2: 0, NS: 0 })
  ), [currentMemberAssignments]);

  const submittedAt = preferencePayload.submittedAt
    || preferencePayload.submissions?.find((entry) => entry.piId === member?._piUserId)?.submittedAt
    || null;

  return {
    member,
    entitlement,
    preferenceDeadline,
    daysUntilPreferenceDeadline: preferenceDeadline
      ? daysBetweenSigned(localTodayDateStr(), preferenceDeadline)
      : 0,
    isPreferenceSubmitted: Boolean(submittedAt),
    schedulePublication: {
      status: schedulePayload?.status || 'draft',
      publishedAt: schedulePayload?.publishedAt || '',
      draftedAt: schedulePayload?.generatedAt || '',
    },
    currentMemberAssignments,
    memberShiftCounts,
    isLoading: cycleLoading || sharesQuery.isLoading || preferencesQuery.isLoading || scheduleQuery.isLoading,
    error: cycleError || sharesQuery.error || preferencesQuery.error || scheduleQuery.error || null,
  };
}
```

- [ ] **Step 4: Run the hook tests again**

Run:

```bash
npx vitest run src/hooks/useMemberDashboardContext.test.js
```

Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit the member dashboard context**

Run:

```bash
git add src/hooks/useMemberDashboardContext.js src/hooks/useMemberDashboardContext.test.js
git commit -m "feat: add member dashboard data hook"
```

### Task 3: Migrate `MemberDashboard`

**Files:**

- Modify: `src/screens/member/MemberDashboard.jsx`
- Create: `src/screens/member/MemberDashboard.test.jsx`

- [ ] **Step 1: Write the failing screen tests**

Create `src/screens/member/MemberDashboard.test.jsx`:

```jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

const useActiveCycle = vi.fn();
const useMemberDashboardContext = vi.fn();

vi.mock('../../hooks/useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('../../hooks/useMemberDashboardContext', () => ({
  useMemberDashboardContext: () => useMemberDashboardContext(),
}));

import MemberDashboard from './MemberDashboard';

beforeEach(() => {
  useActiveCycle.mockReturnValue({
    activeCycle: {
      id: 'cycle-1',
      startDate: '2026-04-20',
      endDate: '2026-04-30',
    },
    activeCycleId: 'cycle-1',
    isLoading: false,
    error: null,
  });

  useMemberDashboardContext.mockReturnValue({
    member: {
      id: 'EL',
      name: 'Example Lab',
      shares: 1.5,
    },
    entitlement: {
      wholeShares: 1,
      fractionalHours: 12,
    },
    preferenceDeadline: '2026-04-13',
    daysUntilPreferenceDeadline: -1,
    isPreferenceSubmitted: true,
    schedulePublication: {
      status: 'published',
      publishedAt: '2026-04-18T10:00:00Z',
      draftedAt: '2026-04-17T10:00:00Z',
    },
    currentMemberAssignments: [
      { id: 'a-1', assignedDate: '2026-04-21', shift: 'DS1' },
      { id: 'a-2', assignedDate: '2026-04-22', shift: 'NS' },
    ],
    memberShiftCounts: {
      DS1: 1,
      DS2: 0,
      NS: 1,
    },
    isLoading: false,
    error: null,
  });
});

test('renders the production-backed member dashboard values without mock-state', () => {
  render(
    <MemoryRouter>
      <MemberDashboard />
    </MemoryRouter>,
  );

  expect(screen.getByText('Preferences already submitted')).toBeInTheDocument();
  expect(screen.getByText('Deadline: Apr 13, 2026')).toBeInTheDocument();
  expect(screen.getByText('1.50')).toBeInTheDocument();
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByText('12.00 hours')).toBeInTheDocument();
  expect(screen.getByText('Assigned now: 2 total (1 DS1, 0 DS2, 1 NS).')).toBeInTheDocument();
});

test('shows a stable loading card instead of returning null', () => {
  useActiveCycle.mockReturnValue({
    activeCycle: null,
    activeCycleId: null,
    isLoading: true,
    error: null,
  });

  useMemberDashboardContext.mockReturnValue({
    member: null,
    entitlement: { wholeShares: 0, fractionalHours: 0 },
    preferenceDeadline: '',
    daysUntilPreferenceDeadline: 0,
    isPreferenceSubmitted: false,
    schedulePublication: { status: 'draft', publishedAt: '', draftedAt: '' },
    currentMemberAssignments: [],
    memberShiftCounts: { DS1: 0, DS2: 0, NS: 0 },
    isLoading: true,
    error: null,
  });

  render(
    <MemoryRouter>
      <MemberDashboard />
    </MemoryRouter>,
  );

  expect(screen.getByText('Loading member dashboard...')).toBeInTheDocument();
});

test('shows a safe empty state when there is no active cycle', () => {
  useActiveCycle.mockReturnValue({
    activeCycle: null,
    activeCycleId: null,
    isLoading: false,
    error: null,
  });

  useMemberDashboardContext.mockReturnValue({
    member: null,
    entitlement: { wholeShares: 0, fractionalHours: 0 },
    preferenceDeadline: '',
    daysUntilPreferenceDeadline: 0,
    isPreferenceSubmitted: false,
    schedulePublication: { status: 'draft', publishedAt: '', draftedAt: '' },
    currentMemberAssignments: [],
    memberShiftCounts: { DS1: 0, DS2: 0, NS: 0 },
    isLoading: false,
    error: null,
  });

  render(
    <MemoryRouter>
      <MemberDashboard />
    </MemoryRouter>,
  );

  expect(screen.getByText('No active cycle is available right now.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the screen tests and confirm they fail**

Run:

```bash
npx vitest run src/screens/member/MemberDashboard.test.jsx
```

Expected: FAIL because `MemberDashboard.jsx` still imports `useMockApp()` and returns `null` for missing member state.

- [ ] **Step 3: Replace `useMockApp()` in `MemberDashboard.jsx`**

Update `src/screens/member/MemberDashboard.jsx` so the top of the component becomes:

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import ConceptShiftBadge from '../../components/ConceptShiftBadge';
import { addDays, formatCalendarDate, localTodayDateStr, toDateStr } from '../../lib/dates';
import { CONCEPT_THEME } from '../../lib/theme';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import { useMemberDashboardContext } from '../../hooks/useMemberDashboardContext';

export default function MemberDashboard() {
  const navigate = useNavigate();
  const { activeCycle, isLoading: cycleLoading, error: cycleError } = useActiveCycle();
  const {
    member,
    entitlement,
    preferenceDeadline,
    daysUntilPreferenceDeadline,
    isPreferenceSubmitted,
    schedulePublication,
    currentMemberAssignments,
    memberShiftCounts,
    isLoading,
    error,
  } = useMemberDashboardContext();

  if (cycleLoading || isLoading) {
    return (
      <div className="rounded-2xl px-6 py-5 concept-font-body" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <div className="concept-font-display text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>Loading member dashboard...</div>
        <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>Pulling your live cycle, shares, and schedule data.</p>
      </div>
    );
  }

  if (cycleError || error) {
    return (
      <div className="rounded-2xl px-6 py-5 concept-font-body" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <div className="concept-font-display text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>Unable to load member dashboard.</div>
        <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>Refresh the page or try again after the API is available.</p>
      </div>
    );
  }

  if (!activeCycle || !member) {
    return (
      <div className="rounded-2xl px-6 py-5 concept-font-body" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <div className="concept-font-display text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>No active cycle is available right now.</div>
        <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>Check back after the next cycle is opened.</p>
      </div>
    );
  }

  const fractionalBlocks = Math.ceil((entitlement.fractionalHours || 0) / 6);
  const published = schedulePublication.status === 'published';
  const heroTitle = isPreferenceSubmitted ? 'Preferences already submitted' : 'Submit Your Preferences';
  const heroDetail = isPreferenceSubmitted
    ? (published
      ? 'Schedule is published. Review your assigned shifts.'
      : 'Submission received. Waiting for admin schedule publication.')
    : (daysUntilPreferenceDeadline < 0
      ? `Deadline passed ${Math.abs(daysUntilPreferenceDeadline)} days(s) ago.`
      : daysUntilPreferenceDeadline === 0
        ? 'Deadline is today. Submit now.'
        : `${daysUntilPreferenceDeadline} day(s) left before deadline.`);
```

Keep the existing JSX body, but replace the old mock-state fields:

```jsx
{ label: 'Total Shares', value: member.shares.toFixed(2), accent: CONCEPT_THEME.sky },
{ label: 'Whole Shares', value: entitlement.wholeShares, accent: CONCEPT_THEME.navy },
{ label: 'Fractional Share', value: `${(entitlement.fractionalHours || 0).toFixed(2)} hours`, accent: CONCEPT_THEME.afternoon },
```

and:

```jsx
Array.from({ length: entitlement.wholeShares }, (_, idx) => idx + 1)
```

and:

```jsx
Fractional Share ({(entitlement.fractionalHours || 0).toFixed(2)} hours)
```

and:

```jsx
Assigned now: {currentMemberAssignments.length} total ({memberShiftCounts.DS1 || 0} DS1, {memberShiftCounts.DS2 || 0} DS2, {memberShiftCounts.NS || 0} NS).
```

and use `activeCycle.startDate` / `activeCycle.endDate` in the timeline instead of `cycle`.

- [ ] **Step 4: Run the member dashboard tests again**

Run:

```bash
npx vitest run src/screens/member/MemberDashboard.test.jsx
```

Expected: PASS with `3 passed`.

- [ ] **Step 5: Commit the member dashboard migration**

Run:

```bash
git add src/screens/member/MemberDashboard.jsx src/screens/member/MemberDashboard.test.jsx
git commit -m "feat: migrate member dashboard to live data"
```

### Task 4: Migrate `AdminDashboard`

**Files:**

- Modify: `src/screens/admin/AdminDashboard.jsx`
- Create: `src/screens/admin/AdminDashboard.test.jsx`

- [ ] **Step 1: Write the failing admin dashboard tests**

Create `src/screens/admin/AdminDashboard.test.jsx`:

```jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

const useActiveCycle = vi.fn();
const useUsers = vi.fn();
const usePreferenceStatus = vi.fn();
const useSchedule = vi.fn();

vi.mock('../../hooks/useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('../../hooks/useApiData', () => ({
  useUsers: () => useUsers(),
  usePreferenceStatus: (cycleId) => usePreferenceStatus(cycleId),
  useSchedule: (cycleId) => useSchedule(cycleId),
}));

import AdminDashboard from './AdminDashboard';

beforeEach(() => {
  useActiveCycle.mockReturnValue({
    activeCycle: {
      id: 'cycle-1',
      startDate: '2026-04-20',
      endDate: '2026-04-30',
      preferenceDeadline: '2026-04-13',
    },
    activeCycleId: 'cycle-1',
    isLoading: false,
    error: null,
  });

  useUsers.mockReturnValue({
    data: [
      { id: 'pi-1', role: 'pi', isActive: true, isActivated: true },
      { id: 'pi-2', role: 'pi', isActive: true, isActivated: true },
      { id: 'pi-3', role: 'pi', isActive: true, isActivated: false },
      { id: 'admin-1', role: 'admin', isActive: true, isActivated: true },
    ],
    isLoading: false,
    error: null,
  });

  usePreferenceStatus.mockReturnValue({
    data: {
      summary: {
        total: 2,
        submitted: 1,
        pending: 1,
      },
    },
    isLoading: false,
    error: null,
  });

  useSchedule.mockReturnValue({
    data: {
      status: 'published',
      publishedAt: '2026-04-18T10:00:00Z',
    },
    isLoading: false,
    error: null,
  });
});

test('renders production-backed summary cards and removes the local snapshot controls', () => {
  render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>,
  );

  expect(screen.queryByText('Admin workspace')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Load Local' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Local' })).not.toBeInTheDocument();

  expect(screen.getByText('Schedule Is Published')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('1/2')).toBeInTheDocument();
  expect(screen.getByText('50% complete')).toBeInTheDocument();
  expect(screen.getByText('Published')).toBeInTheDocument();
});

test('shows a stable loading card while the live queries resolve', () => {
  useActiveCycle.mockReturnValue({
    activeCycle: null,
    activeCycleId: null,
    isLoading: true,
    error: null,
  });

  useUsers.mockReturnValue({
    data: [],
    isLoading: true,
    error: null,
  });

  usePreferenceStatus.mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
  });

  useSchedule.mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
  });

  render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>,
  );

  expect(screen.getByText('Loading admin dashboard...')).toBeInTheDocument();
});

test('shows a safe empty state when there is no active cycle', () => {
  useActiveCycle.mockReturnValue({
    activeCycle: null,
    activeCycleId: null,
    isLoading: false,
    error: null,
  });

  render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>,
  );

  expect(screen.getByText('No active cycle is available right now.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the admin dashboard tests and confirm they fail**

Run:

```bash
npx vitest run src/screens/admin/AdminDashboard.test.jsx
```

Expected: FAIL because `AdminDashboard.jsx` still reads `useMockApp()` and still renders the workspace card.

- [ ] **Step 3: Replace `useMockApp()` in `AdminDashboard.jsx` and remove the snapshot card**

Update the top of `src/screens/admin/AdminDashboard.jsx`:

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, formatCalendarDate, localTodayDateStr, toDateStr } from '../../lib/dates';
import { CONCEPT_THEME } from '../../lib/theme';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import { usePreferenceStatus, useSchedule, useUsers } from '../../hooks/useApiData';

function extractRows(payload) {
  return Array.isArray(payload) ? payload : [];
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { activeCycle, activeCycleId, isLoading: cycleLoading, error: cycleError } = useActiveCycle();
  const usersQuery = useUsers();
  const preferenceStatusQuery = usePreferenceStatus(activeCycleId);
  const scheduleQuery = useSchedule(activeCycleId);

  if (cycleLoading || usersQuery.isLoading || preferenceStatusQuery.isLoading || scheduleQuery.isLoading) {
    return (
      <div className="rounded-2xl px-6 py-5 concept-font-body" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <div className="concept-font-display text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>Loading admin dashboard...</div>
        <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>Pulling users, submissions, and schedule status.</p>
      </div>
    );
  }

  if (cycleError || usersQuery.error || preferenceStatusQuery.error || scheduleQuery.error) {
    return (
      <div className="rounded-2xl px-6 py-5 concept-font-body" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <div className="concept-font-display text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>Unable to load admin dashboard.</div>
        <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>Refresh the page or try again after the API is available.</p>
      </div>
    );
  }

  if (!activeCycle) {
    return (
      <div className="rounded-2xl px-6 py-5 concept-font-body" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <div className="concept-font-display text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>No active cycle is available right now.</div>
        <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>Create or reopen a cycle to start collecting preferences.</p>
      </div>
    );
  }

  const users = extractRows(usersQuery.data);
  const activeMembers = users.filter((user) => user.role === 'pi' && user.isActive && user.isActivated);
  const pendingMembers = users.filter((user) => user.role === 'pi' && user.isActive && !user.isActivated);
  const statusSummary = preferenceStatusQuery.data?.summary || { total: activeMembers.length, submitted: 0, pending: activeMembers.length };
  const schedulePublication = {
    status: scheduleQuery.data?.status || 'draft',
    publishedAt: scheduleQuery.data?.publishedAt || '',
  };
```

Use the existing hero/timeline/stat JSX, but replace the old data sources with:

```jsx
  const preferenceDeadline = activeCycle.preferenceDeadline
    ? String(activeCycle.preferenceDeadline).split('T')[0]
    : addDays(activeCycle.startDate, -7);
  const published = schedulePublication.status === 'published';
  const submittedCount = statusSummary.submitted || 0;
  const activeMemberCount = statusSummary.total || activeMembers.length;
  const submissionPct = activeMemberCount > 0 ? Math.round((submittedCount / activeMemberCount) * 100) : 0;
```

and:

```jsx
Cycle {activeCycle.name || activeCycle.id} | Preference deadline: {formatCalendarDate(preferenceDeadline)}
```

and:

```jsx
{ label: 'Active Members', value: activeMemberCount, sub: 'in cycle', accent: CONCEPT_THEME.navy },
{ label: 'Invited Members', value: pendingMembers.length, sub: 'awaiting activation', accent: CONCEPT_THEME.accentText },
{ label: 'Submissions', value: `${submittedCount}/${activeMemberCount || 0}`, sub: `${submissionPct}% complete`, accent: CONCEPT_THEME.sky },
{ label: 'Schedule', value: published ? 'Published' : 'Draft', sub: published ? 'member-visible' : 'review mode', accent: published ? CONCEPT_THEME.emerald : CONCEPT_THEME.navyMuted },
```

and remove the entire `Admin workspace` card block from the top of the component.

- [ ] **Step 4: Run the admin dashboard tests again**

Run:

```bash
npx vitest run src/screens/admin/AdminDashboard.test.jsx
```

Expected: PASS with `3 passed`.

- [ ] **Step 5: Commit the admin dashboard migration**

Run:

```bash
git add src/screens/admin/AdminDashboard.jsx src/screens/admin/AdminDashboard.test.jsx
git commit -m "feat: migrate admin dashboard to live data"
```

### Task 5: Fold Dashboard Tests Into `npm run check` And Verify The Slice

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Extend the `check` script with the new dashboard tests**

Update the `check` script in `package.json`:

```json
"check": "node --test lib/scheduling/engine.test.js src/lib/data-mappers.test.js src/lib/server-bridge.test.js src/lib/notification-bell-utils.test.js lib/swap-request-utils.test.js && vitest run src/lib/comments-view-models.test.js src/screens/member/MemberComments.test.jsx src/screens/admin/AdminComments.test.jsx src/screens/auth/LoginScreen.test.jsx src/screens/auth/ActivateAccountScreen.test.jsx src/App.auth-routing.test.jsx src/hooks/useActiveCycle.test.js src/hooks/useMemberDashboardContext.test.js src/screens/member/MemberDashboard.test.jsx src/screens/admin/AdminDashboard.test.jsx && vite build"
```

- [ ] **Step 2: Run the full verification command**

Run:

```bash
npm run check
```

Expected:

- the existing `node --test` suite passes
- the existing auth/comments Vitest suite still passes
- the new dashboard hook and screen tests pass
- `vite build` completes successfully

- [ ] **Step 3: Commit the verification wiring**

Run:

```bash
git add package.json
git commit -m "test: cover dashboard live-data migration"
```

- [ ] **Step 4: Manual verification checklist**

Run the app locally:

```bash
npm run dev
```

Verify manually:

- sign in as admin and open `/admin/dashboard`
- confirm the `Admin workspace` card is gone
- confirm the hero, stats, timeline, and submission-readiness sections still match the old UI layout
- sign in as PI and open `/member/dashboard`
- confirm the hero, stats, timeline, and shift-allocation sections still match the old UI layout
- confirm both dashboards still navigate to the existing destination screens from their CTA buttons

- [ ] **Step 5: Final slice commit**

Run:

```bash
git status --short
```

Expected: clean working tree except for any unrelated pre-existing changes outside this slice.

If only the dashboard slice files are staged, run:

```bash
git commit --allow-empty -m "feat: migrate dashboards to production data"
```

Use `--allow-empty` only if the prior task commits already captured every file change and you still want a final marker commit for the completed slice.

## Self-Review

### Spec Coverage

- `useActiveCycle` seam: covered by Task 1.
- `useMemberDashboardContext`: covered by Task 2.
- `MemberDashboard` live-data migration with loading/empty states: covered by Task 3.
- `AdminDashboard` live-data migration and removal of local snapshot card: covered by Task 4.
- dashboard tests wired into repo verification: covered by Task 5.

### Placeholder Scan

- No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Every code-writing step includes concrete file content or exact replacement snippets.
- Every verification step includes an exact command and an expected result.

### Type Consistency

- `useActiveCycle` returns `activeCycle`, `activeCycleId`, `isLoading`, `error` consistently across later tasks.
- `useMemberDashboardContext` returns `member`, `entitlement`, `preferenceDeadline`, `daysUntilPreferenceDeadline`, `isPreferenceSubmitted`, `schedulePublication`, `currentMemberAssignments`, `memberShiftCounts`, `isLoading`, `error`, and the screen tasks use those same names.
- `AdminDashboard` uses the existing hook payload shape (`array` / already-unwrapped object) instead of re-unwrapping nonexistent `data.data` layers.
