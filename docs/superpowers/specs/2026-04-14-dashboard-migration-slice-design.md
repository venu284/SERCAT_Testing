# Dashboard Migration Slice Design

Date: 2026-04-14

## Goal

Migrate the two landing dashboards from `useMockApp()` to real backend-backed data while preserving the current UI almost exactly.

This slice makes:

- `src/screens/member/MemberDashboard.jsx`
- `src/screens/admin/AdminDashboard.jsx`

production-backed without attempting a broader app rewrite.

## Chosen Approach

Use narrow shared hooks now.

- Add `useActiveCycle` as the shared active-cycle seam.
- Add a focused `useMemberDashboardContext` hook for member-dashboard derived data only.
- Keep `AdminDashboard` thinner and compose it directly from existing API hooks plus small local summary logic.

This avoids repeating cycle/member derivations across future screens without turning the slice into a broad hook-layer refactor.

## Scope

### In Scope

- Migrate `MemberDashboard` off `useMockApp()`
- Migrate `AdminDashboard` off `useMockApp()`
- Add `useActiveCycle`
- Add one narrow member-dashboard shared hook
- Add tests for the new hooks and both dashboards

### Out of Scope

- Members/shares CRUD
- Cycle editing
- Engine/schedule admin screens
- Preference form
- Profile screens
- Global deletion of `mock-state.js`
- Broad `useApiData` normalization beyond what these dashboards need

### Success Criteria

- Both dashboards render from real backend data
- The current dashboard UI remains nearly unchanged
- The admin local snapshot card is removed
- Missing data renders explicit loading or empty states instead of `null`
- The new hooks are reusable for later member-screen migrations

## UI Decisions

### Admin Dashboard

- Remove the prototype `Load Local` / `Save Local` workspace card entirely
- Start the screen with the existing cycle/action hero
- Keep the hero, stats, timeline, and submission-readiness sections visually the same

### Member Dashboard

- Keep the hero, stats, timeline, and shift-allocation layout visually the same
- Replace only the data source and derived values

## Architecture

### `useActiveCycle`

Add `src/hooks/useActiveCycle.js`.

Responsibilities:

- Wrap `useCycles()`
- Select the first non-archived cycle if one exists
- Fall back to the first cycle if no active-looking cycle exists
- Return:
  - `activeCycle`
  - `activeCycleId`
  - `isLoading`
  - `error`

This becomes the standard active-cycle seam for later frontend migrations.

### `useMemberDashboardContext`

Add `src/hooks/useMemberDashboardContext.js`.

Dependencies:

- `useAuth()`
- `useActiveCycle()`
- `usePreferences(activeCycleId)`
- `useSchedule(activeCycleId)`
- existing entitlement/date utilities

Responsibilities:

- Derive the current member/institution identity from authenticated user data
- Compute the exact values the current member dashboard JSX already expects
- Return a stable dashboard-focused shape instead of exposing raw API payloads

Expected return shape:

- `member`
- `entitlement`
- `preferenceDeadline`
- `daysUntilPreferenceDeadline`
- `isPreferenceSubmitted`
- `schedulePublication`
- `currentMemberAssignments`
- `memberShiftCounts`
- `isLoading`
- `error`

### `AdminDashboard`

Do not add a dedicated admin-dashboard shared hook in this slice.

Compose the screen from:

- `useActiveCycle()`
- `useUsers()`
- `usePreferenceStatus(activeCycleId)`
- `useSchedule(activeCycleId)`

Use small local summary helpers inside the screen if needed, but avoid creating a generic abstraction until another admin screen needs the same derived data.

## Data Mapping

### Member Dashboard

Derive member-dashboard data from real backend data using the shared hook.

#### Member identity

Use authenticated user/session information plus institution fields from backend-backed data. Do not rely on preview-mode `activeMember`.

#### Entitlement

Reuse `src/lib/entitlements.js` and `computeEntitlements()` instead of recreating share math inline.

Expected entitlement shape remains compatible with the existing JSX:

- `wholeShares`
- `fractionalHours`
- derived shift totals

#### Preference deadline

Use `activeCycle.preferenceDeadline` when available.

Fallback behavior should match the current UI:

- if the field is absent, use `activeCycle.startDate - 7 days`

#### Days until deadline

Compute from today versus the effective deadline using the existing date helpers.

#### Submission state

Derive from the active-cycle preferences payload for the logged-in PI. Do not use mock-state submission flags.

#### Schedule publication

Derive from active-cycle schedule data and expose the same shape the current JSX expects:

- `status`
- `publishedAt`

#### Current assignments and counts

Filter schedule assignments to the logged-in PI/member and compute:

- `currentMemberAssignments`
- `memberShiftCounts.DS1`
- `memberShiftCounts.DS2`
- `memberShiftCounts.NS`

### Admin Dashboard

Derive summary values from real backend data.

Expected data sources:

- `activeMembers`: active PI/member rows for the current cycle context
- `pendingMembers`: invited / not-yet-activated users
- `submittedCount`: derived from preference-status data
- `schedulePublication`: derived from schedule data
- `cycle`: derived from `useActiveCycle()`

The following mock-only fields are removed from the admin dashboard:

- `dbStatus`
- `dbBusy`
- `loadFromDatabase`
- `saveCurrentToDatabase`

## Loading and Empty States

### Member Dashboard

- If member dashboard data is loading, show a lightweight loading card instead of returning `null`
- If no active cycle or no member context can be derived, show a stable empty-state card

### Admin Dashboard

- If admin summary data is loading, show a lightweight loading card
- If no active cycle can be derived, show a stable empty-state card

## File Boundaries

### New Files

- `src/hooks/useActiveCycle.js`
- `src/hooks/useMemberDashboardContext.js`
- `src/hooks/useActiveCycle.test.js`
- `src/hooks/useMemberDashboardContext.test.js`
- `src/screens/member/MemberDashboard.test.jsx`
- `src/screens/admin/AdminDashboard.test.jsx`

### Modified Files

- `src/screens/member/MemberDashboard.jsx`
- `src/screens/admin/AdminDashboard.jsx`
- `package.json` only if needed to add the new dashboard tests to `check`

## Testing

### `useActiveCycle`

Test that it:

- selects the first non-archived cycle
- falls back correctly when cycles are missing or all are archived-like

### `useMemberDashboardContext`

Test that it computes:

- entitlement
- effective preference deadline
- days until preference deadline
- submission state
- assignment filtering
- member shift counts

### `MemberDashboard`

Test that it:

- renders real derived values
- shows loading state
- shows no-active-cycle or missing-member state safely

### `AdminDashboard`

Test that it:

- no longer renders the local snapshot card
- renders real hero/stat/timeline values
- shows loading state
- shows no-active-cycle state safely

## Risks and Boundaries

### Primary Risk

The backend/user payload may not expose every field the old mock dashboard assumed.

If that happens in this slice:

- add one narrow adapter or helper
- do not fall back to `mock-state`
- do not broaden the slice into unrelated API refactors

### Intentional Deferral

`mock-state.js` remains in place for non-migrated screens. This slice only removes it from the two dashboard landing surfaces.

## Expected Outcome

After this slice:

- auth screens are production-backed
- comments screens are production-backed
- both dashboards are production-backed

The remaining prototype-heavy screens become the next migration targets, but the app’s first-touch surfaces are no longer driven by mock state.
