# Route Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the Vercel API surface into a single catch-all route plus the existing cron route without changing frontend URLs or handler behavior.

**Architecture:** Move the current `api/` tree to `api-handlers/` so existing handler logic and relative imports stay intact, then introduce `api/[...path].js` as the only general API entrypoint. Add a small path router utility for stable matching and param extraction, and keep `api/cron/send-reminders.js` as a dedicated function for Vercel cron compatibility.

**Tech Stack:** Node.js, Vercel serverless functions, plain React/Vite frontend, existing API handlers, Node test runner, Vitest

---

### Task 1: Add Router Test Coverage

**Files:**
- Create: `lib/router.test.js`
- Create: `lib/router.js`

- [ ] Write a failing test for exact route matching, param extraction, and specific-route precedence.
- [ ] Run `node --test lib/router.test.js` and confirm it fails because `lib/router.js` does not exist yet.
- [ ] Implement `createRouter()` in `lib/router.js`.
- [ ] Re-run `node --test lib/router.test.js` and confirm it passes.

### Task 2: Consolidate API Entrypoints

**Files:**
- Create: `api/[...path].js`
- Modify: `vercel.json`
- Move: `api/**` to `api-handlers/**`
- Create: `api/cron/send-reminders.js`

- [ ] Move the existing API handlers into `api-handlers/`, preserving structure and file contents.
- [ ] Add the catch-all route in `api/[...path].js` and register every current non-cron endpoint.
- [ ] Keep route registration ordered so specific paths are matched before parameterized paths.
- [ ] Copy the cron handler back to `api/cron/send-reminders.js`.
- [ ] Update `vercel.json` so `/api/:path*` rewrites to `/api/[...path]` and cron still points to `/api/cron/send-reminders`.

### Task 3: Verify Behavior and Function Count

**Files:**
- Verify: `api/`
- Verify: `api-handlers/`

- [ ] Run `find api -type f -name '*.js' | sort` and confirm only `api/[...path].js` and `api/cron/send-reminders.js` remain.
- [ ] Run `node --test lib/router.test.js`.
- [ ] Run `npm run check`.
- [ ] Review the final tree and confirm the API surface still matches the current frontend route usage.
