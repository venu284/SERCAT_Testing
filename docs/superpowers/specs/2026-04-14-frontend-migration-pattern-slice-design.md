# Frontend Migration Pattern Slice Design

## Goal

Migrate the first production frontend slice off the prototype `useMockApp()` state model while preserving the current UI almost exactly. This slice covers auth screens plus the comments flow for both admin and PI users.

## Why This Slice

The application already has a real backend, real auth, and real comments APIs, but the UI is still primarily driven by `src/lib/mock-state.js`. A full rewrite would be high risk. This slice establishes the migration pattern in a smaller vertical path:

- auth screens stop using mock-state-driven props
- admin and member comments stop using `useMockApp()`
- the rest of the application remains operational through the current bridge

This gives the codebase a working reference implementation for later screen migrations.

## Scope

### In Scope

- `src/App.jsx`
  - route and shell cleanup only where needed to support migrated auth and comments screens
- `src/screens/auth/LoginScreen.jsx`
- `src/screens/auth/ActivateAccountScreen.jsx`
- `src/screens/admin/AdminComments.jsx`
- `src/screens/member/MemberComments.jsx`
- small supporting hook or adapter changes needed to support the above screens

### Out of Scope

- dashboards
- scheduling screens
- members and shares management
- swap-request UI migration
- deleting `mock-state.js` globally
- deleting `useServerSync.js`
- deleting demo data directories
- auth/security hardening beyond what is required for the frontend migration itself

## Current State

The application is split between a real backend and a bridge-driven frontend:

- `src/contexts/AuthContext.jsx` already talks to real auth endpoints
- comments data already exists in:
  - `api/comments/index.js`
  - `api/comments/[id].js`
  - `db/schema/comments.js`
  - `src/hooks/useApiData.js`
- `src/App.jsx` still wraps the app in `MockStateProvider`
- all comments and auth screens still depend on prop drilling or `useMockApp()`

## Design

### 1. Hybrid Runtime

This migration slice keeps the application in a temporary hybrid state.

Migrated paths:

- login
- activation
- admin comments
- member comments

Legacy paths:

- every other screen that still depends on `useMockApp()`

The goal is not to remove the bridge yet. The goal is to prove the production pattern safely on a real cross-role feature.

### 2. App Shell Strategy

`src/App.jsx` remains the central route and layout file for this slice, but its responsibilities are narrowed:

- keep the current route paths
- keep the current top-bar and navigation visuals
- keep the current admin/member shells visually unchanged
- stop passing mock-auth state into auth screens
- mount migrated comments screens without `useMockApp()`

Non-migrated routes may continue to render inside the legacy bridge until later slices move them.

### 3. Auth Screen Strategy

#### Login

`src/screens/auth/LoginScreen.jsx` becomes self-contained for UI state:

- owns local form state
- calls `useAuth().login(email, password)`
- handles errors locally using the existing inline error UI
- keeps the current visual layout and CTA hierarchy

Prototype-only behaviors are removed from the live path:

- local invited-member lookup
- reset demo data controls

The "Activate your account" entry point remains.

#### Activation

`src/screens/auth/ActivateAccountScreen.jsx` also becomes self-contained:

- owns local token/password/phone form state
- calls `useAuth().activate(token, password, confirmPassword, phone)`
- renders the current success state after activation
- keeps the current overall layout and branding panel

Important limitation:

The current backend only validates tokens during activation. It does not provide a safe "preview invitation by token" endpoint. Because of that, the prototype behavior that reveals invitation details before activation cannot remain backed by local demo state.

For this slice:

- preserve the screen layout
- keep token entry UI
- remove the dependency on client-side member lookup by token
- continue to show the existing success screen after activation completes

This preserves the UI direction without inventing insecure token probing behavior in the browser.

### 4. Comments Screen Strategy

Comments are migrated directly to the existing production APIs.

#### Member Comments

`src/screens/member/MemberComments.jsx` uses:

- `useComments()` for history
- `useCreateComment()` for submit

The server already scopes `GET /api/comments` to the signed-in PI, so the screen does not need `activeMember` or client-side filtering to determine ownership.

The screen keeps:

- current form layout
- current success and error banners
- current history card layout
- current admin reply rendering

#### Admin Comments

`src/screens/admin/AdminComments.jsx` uses:

- `useComments()` for inbox data
- `useUpdateComment()` for:
  - marking comments as read
  - saving admin replies

Behavior:

- opening a `sent` message marks it as read
- replying updates the record through the real API
- the inbox remains sorted newest first
- local UI state still owns:
  - expanded row
  - reply drafts
  - local success and error messages

### 5. Comments View Adapter

This slice introduces a small comments-focused adapter rather than reusing the mock-state bridge.

Purpose:

- map API `status` values (`sent`, `read`, `replied`) to the UI labels already used by the screens (`Sent`, `Read`, `Replied`)
- normalize optional fields like `adminReply`, `adminReplyAt`, and `readAt`
- provide a stable screen-facing shape without pulling in `mock-state.js`

This adapter should live close to the migrated comments feature, not inside the legacy bridge.

### 6. Route and State Boundaries

After this slice:

- auth screens no longer require auth props from `App.jsx`
- comments screens no longer call `useMockApp()`
- comments screens no longer depend on:
  - `memberComments`
  - `memberDirectory`
  - `activeMember`
  - mock-state mutation helpers

The only state they keep locally is presentational or form state.

## Files Expected To Change

### Primary Files

- `src/App.jsx`
- `src/screens/auth/LoginScreen.jsx`
- `src/screens/auth/ActivateAccountScreen.jsx`
- `src/screens/admin/AdminComments.jsx`
- `src/screens/member/MemberComments.jsx`

### Supporting Files

- `src/hooks/useApiData.js`
  - only if minor hook cleanup is required
- new comments adapter file under `src/lib/` or `src/screens/...`
- targeted test files for the new adapter or migrated behavior

## Error Handling

The slice keeps the current screen-level error model.

- auth errors remain inline inside auth screens
- comments mutation failures remain inline inside comments screens
- no new global error framework is introduced

For data loading:

- use the existing empty/loading/error surfaces already implied by each screen
- do not redesign the UX

## Verification

### Automated

- add focused tests for the new comments adapter
- keep existing repo verification green with `npm run check`

### Manual

Verify the following flows:

1. open the login screen
2. sign in as admin
3. open admin comments
4. expand an unread comment and verify it becomes read
5. send or update an admin reply
6. sign out
7. sign in as a PI
8. submit a new comment
9. verify comment history shows the new comment
10. verify the admin reply is visible to the PI
11. verify account activation still completes successfully and routes back to sign-in cleanly

## Risks

### Known Risk 1: Mixed Runtime

This slice intentionally keeps migrated and non-migrated screens in the same app. That is acceptable temporarily, but `App.jsx` must clearly separate direct-hook paths from legacy bridge paths to avoid confusion.

### Known Risk 2: Activation Preview Regression

The current activation page uses prototype token lookup to display invitation details before submit. That behavior cannot remain exactly the same without a new backend endpoint. The design preserves the layout and success state, but not the fake preview behavior.

### Known Risk 3: Hook Contract Inconsistency

`src/hooks/useApiData.js` uses mixed response shapes today. This slice should avoid broad hook rewrites, but if comments/auth reveal contract problems, any cleanup must stay narrowly scoped to the migrated paths.

## Success Criteria

This slice is successful when:

- login screen works through `useAuth()` directly
- activation screen works through `useAuth()` directly
- admin comments use the real comments API directly
- member comments use the real comments API directly
- these four screens no longer depend on `useMockApp()`
- the rest of the app still runs without a visual redesign

