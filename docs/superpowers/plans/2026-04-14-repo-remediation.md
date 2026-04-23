# SERCAT Repository Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** eliminate the current correctness, security, and maintainability failures in the SERCAT app while keeping a single deployable Vercel application.

**Architecture:** keep the existing single-app deployment model, but harden it into a layered monolith: verified API routes, durable auth/rate-limit infrastructure, one canonical scheduling engine, thinner client state adapters, and accurate operational documentation. Resolve production-impacting defects first, then remove the structural causes of repeat regressions.

**Tech Stack:** Vite, React 18, TanStack Query, Vercel serverless functions, Drizzle ORM, Neon Postgres, Zod, Vitest

---

## File Map

**Create**
- `vitest.config.js`
- `tests/helpers/http.js`
- `tests/helpers/db-mocks.js`
- `tests/api/schedules-access.test.js`
- `tests/api/schedule-lifecycle.test.js`
- `tests/api/schedule-publish.test.js`
- `tests/api/auth-throttle.test.js`
- `tests/client/snapshot-storage.test.js`
- `tests/client/server-sync-contract.test.js`
- `tests/shared/scheduling-engine.test.js`
- `db/schema/auth-rate-limits.js`
- `db/migrations/0005_auth_rate_limits.sql`
- `lib/rate-limit.js`
- `lib/env.js`
- `shared/scheduling/constants.js`
- `shared/scheduling/dates.js`
- `shared/scheduling/whole-share.js`
- `shared/scheduling/engine.js`
- `shared/scheduling/index.js`
- `src/state/snapshot.js`
- `docs/architecture/repo-layout.md`
- `docs/operations/deployment-checklist.md`
- `.github/workflows/ci.yml`

**Modify**
- `package.json`
- `README.md`
- `api/auth/login.js`
- `api/auth/reset-password.js`
- `api/cron/send-reminders.js`
- `api/cycles/[id]/schedules/index.js`
- `api/cycles/[id]/schedules/generate.js`
- `api/schedules/[id]/publish.js`
- `db/index.js`
- `db/seed.js`
- `db/schema/preference-history.js`
- `lib/auth-utils.js`
- `lib/email.js`
- `lib/scheduling/index.js`
- `lib/scheduling/result-persister.js`
- `src/engine/engine.js`
- `src/hooks/useApiData.js`
- `src/hooks/useServerSync.js`
- `src/lib/api.js`
- `src/lib/data-mappers.js`
- `src/lib/mock-state.js`
- `src/lib/normalizers.js`
- `src/lib/storage.js`
- `src/screens/member/PreferenceForm.jsx`

**Why this structure**
- The immediate bugs live in server routes and persistence code, so the first tasks focus on verified API behavior.
- The largest repeat-risk comes from duplicated scheduling logic and a 2400-line client state module, so later tasks remove those structural hazards after tests exist.
- The repo has no meaningful verification pipeline today, so the plan starts by making regressions cheap to catch before any wide refactor begins.

### Task 1: Add A Verification Baseline

**Files:**
- Create: `vitest.config.js`
- Create: `tests/helpers/http.js`
- Create: `tests/helpers/db-mocks.js`
- Create: `tests/api/schedules-access.test.js`
- Modify: `package.json`

- [ ] **Step 1: Install the missing test tooling**

Run:

```bash
npm install -D vitest @vitest/coverage-v8
```

Expected: npm adds the two dev dependencies without changing production dependencies.

- [ ] **Step 2: Add repeatable test scripts**

Modify `package.json` so the `scripts` section becomes:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:seed": "node db/seed.js",
    "db:studio": "drizzle-kit studio"
  }
}
```

- [ ] **Step 3: Create the Vitest configuration**

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['api/**/*.js', 'lib/**/*.js', 'src/**/*.js', 'src/**/*.jsx'],
    },
  },
});
```

- [ ] **Step 4: Add reusable route test helpers**

Create `tests/helpers/http.js`:

```js
export function createReq({
  method = 'GET',
  query = {},
  body = undefined,
  headers = {},
  user = undefined,
} = {}) {
  return {
    method,
    query,
    body,
    headers,
    user,
  };
}

export function createRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end(payload) {
      this.body = payload;
      return this;
    },
  };

  return res;
}
```

Create `tests/helpers/db-mocks.js`:

```js
import { vi } from 'vitest';

export function makeChain(result) {
  const chain = {
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => result),
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    set: vi.fn(() => chain),
    returning: vi.fn(async () => result),
  };

  return chain;
}
```

- [ ] **Step 5: Add the first failing access-control test**

Create `tests/api/schedules-access.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReq, createRes } from '../helpers/http.js';

const selectMock = vi.fn();

vi.mock('../../db/index.js', () => ({
  db: {
    select: selectMock,
  },
}));

vi.mock('../../lib/middleware/with-auth.js', () => ({
  withAuth: (handler) => handler,
}));

vi.mock('../../lib/middleware/with-method.js', () => ({
  withMethod: (_method, handler) => handler,
}));

describe('GET /api/cycles/[id]/schedules', () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it('returns null for PI users when only a draft schedule exists', async () => {
    const cycleChain = {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ id: 'cycle-1', status: 'collecting' }]),
        })),
      })),
    };

    const scheduleChain = {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    };

    selectMock
      .mockReturnValueOnce(cycleChain)
      .mockReturnValueOnce(scheduleChain);

    const { default: handler } = await import('../../api/cycles/[id]/schedules/index.js');
    const req = createReq({ query: { id: 'cycle-1' }, user: { userId: 'pi-1', role: 'pi' } });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: null });
  });
});
```

- [ ] **Step 6: Run the tests and verify the harness works**

Run:

```bash
npm run test -- tests/api/schedules-access.test.js
```

Expected: the test runner starts successfully. If the route still leaks draft schedules, this test fails before any production code is changed.

- [ ] **Step 7: Commit the verification baseline**

```bash
git add package.json package-lock.json vitest.config.js tests/helpers/http.js tests/helpers/db-mocks.js tests/api/schedules-access.test.js
git commit -m "test: add api verification baseline"
```

### Task 2: Finish Schedule Access And Lifecycle Fixes

**Files:**
- Modify: `api/cycles/[id]/schedules/index.js`
- Modify: `api/cycles/[id]/schedules/generate.js`
- Modify: `api/cycles/[id]/preferences/index.js`
- Create: `tests/api/schedule-lifecycle.test.js`

- [ ] **Step 1: Add failing lifecycle tests**

Create `tests/api/schedule-lifecycle.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReq, createRes } from '../helpers/http.js';

const selectMock = vi.fn();
const updateMock = vi.fn();

vi.mock('../../db/index.js', () => ({
  db: {
    select: selectMock,
    update: updateMock,
  },
}));

vi.mock('../../lib/middleware/with-admin.js', () => ({
  withAdmin: (handler) => handler,
}));

vi.mock('../../lib/middleware/with-method.js', () => ({
  withMethod: (_method, handler) => handler,
}));

vi.mock('../../lib/scheduling/data-loader.js', () => ({
  loadEngineInput: vi.fn(async () => ({ members: [] })),
}));

vi.mock('../../lib/scheduling/engine.js', () => ({
  runSchedulingEngine: vi.fn(() => ({ assignments: [], errors: [], warnings: [] })),
}));

vi.mock('../../lib/scheduling/result-persister.js', () => ({
  persistEngineResults: vi.fn(),
}));

describe('schedule generation lifecycle', () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
  });

  it('restores the cycle status when generation fails after a status flip', async () => {
    selectMock.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ id: 'cycle-1', status: 'collecting' }]),
        })),
      })),
    });

    const setMock = vi.fn(() => ({
      where: vi.fn(async () => []),
    }));

    updateMock.mockReturnValue({ set: setMock });

    const { default: handler } = await import('../../api/cycles/[id]/schedules/generate.js');
    const req = createReq({ method: 'POST', query: { id: 'cycle-1' }, user: { userId: 'admin-1', role: 'admin' } });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(setMock).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'scheduling' }));
  });
});
```

- [ ] **Step 2: Run the lifecycle test**

Run:

```bash
npm run test -- tests/api/schedule-lifecycle.test.js
```

Expected: FAIL if cycle status changes too early or fails to roll back correctly.

- [ ] **Step 3: Keep the route logic in the verified final shape**

Update `api/cycles/[id]/schedules/index.js` so PI users only fetch published schedules and only admins receive analytics:

```js
let schedule;
if (req.user.role === 'admin') {
  [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.cycleId, cycleId))
    .orderBy(desc(schedules.version))
    .limit(1);
} else {
  [schedule] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.cycleId, cycleId), eq(schedules.status, 'published')))
    .orderBy(desc(schedules.version))
    .limit(1);
}

return res.status(200).json({
  data: {
    scheduleId: schedule.id,
    cycleId: schedule.cycleId,
    version: schedule.version,
    status: schedule.status,
    generatedAt: schedule.generatedAt,
    publishedAt: schedule.publishedAt,
    assignments: filteredAssignments,
    analytics: req.user.role === 'admin' ? (analytics || null) : null,
  },
});
```

Update `api/cycles/[id]/schedules/generate.js` so status changes happen after input validation and roll back on exceptions:

```js
const { id: cycleId } = req.query;
let previousStatus = null;

try {
  const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
  if (!cycle) {
    return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
  }

  previousStatus = cycle.status;
  const engineInput = await loadEngineInput(cycleId);
  if (engineInput.members.filter((m) => m.status === 'ACTIVE').length === 0) {
    return res.status(400).json({ error: 'No active members with shares in this cycle. Snapshot shares first.', code: 'NO_MEMBERS' });
  }

  await db.update(cycles).set({ status: 'scheduling', updatedAt: new Date() }).where(eq(cycles.id, cycleId));
  const engineOutput = runSchedulingEngine(engineInput);
  const { scheduleId, scheduleVersion } = await persistEngineResults(engineOutput, engineInput, req.user.userId);

  return res.status(200).json({
    data: {
      scheduleId,
      version: scheduleVersion,
      status: 'draft',
      _scheduleId: scheduleId,
      ...engineOutput,
    },
  });
} catch (err) {
  if (previousStatus !== null) {
    await db.update(cycles).set({ status: previousStatus, updatedAt: new Date() }).where(eq(cycles.id, cycleId));
  }
  return res.status(500).json({ error: err.message || 'Internal server error', code: 'INTERNAL_ERROR' });
}
```

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
npm run test -- tests/api/schedules-access.test.js tests/api/schedule-lifecycle.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the schedule lifecycle fixes**

```bash
git add api/cycles/[id]/schedules/index.js api/cycles/[id]/schedules/generate.js api/cycles/[id]/preferences/index.js tests/api/schedules-access.test.js tests/api/schedule-lifecycle.test.js
git commit -m "fix: harden schedule access and generation lifecycle"
```

### Task 3: Fix Publish-Time History And Analytics Bugs

**Files:**
- Modify: `api/schedules/[id]/publish.js`
- Modify: `lib/scheduling/result-persister.js`
- Modify: `db/schema/preference-history.js`
- Create: `tests/api/schedule-publish.test.js`

- [ ] **Step 1: Add failing publish regression tests**

Create `tests/api/schedule-publish.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReq, createRes } from '../helpers/http.js';

const selectMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../../db/index.js', () => ({
  db: {
    select: selectMock,
    update: updateMock,
    insert: insertMock,
    delete: deleteMock,
  },
}));

vi.mock('../../lib/middleware/with-admin.js', () => ({
  withAdmin: (handler) => handler,
}));

vi.mock('../../lib/middleware/with-method.js', () => ({
  withMethod: (_method, handler) => handler,
}));

vi.mock('../../lib/audit.js', () => ({
  logAudit: vi.fn(),
}));

vi.mock('../../lib/email.js', () => ({
  sendEmail: vi.fn(),
}));

describe('publish schedule', () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
    insertMock.mockReset();
    deleteMock.mockReset();
  });

  it('does not throw when analytics are read during publish', async () => {
    selectMock.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ id: 'schedule-1', cycleId: 'cycle-1', status: 'draft' }]),
        })),
      })),
    });

    updateMock.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    });

    insertMock.mockReturnValue({
      values: vi.fn(async () => []),
    });

    deleteMock.mockReturnValue({
      where: vi.fn(async () => []),
    });

    const { default: handler } = await import('../../api/schedules/[id]/publish.js');
    const req = createReq({ method: 'POST', query: { id: 'schedule-1' }, user: { userId: 'admin-1', role: 'admin' } });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).not.toBe(500);
  });
});
```

- [ ] **Step 2: Run the publish regression test**

Run:

```bash
npm run test -- tests/api/schedule-publish.test.js
```

Expected: FAIL with a publish-path regression such as `ReferenceError: runAnalytics is not defined` or history write mismatches.

- [ ] **Step 3: Implement the final publish-path shape**

Update the imports at the top of `api/schedules/[id]/publish.js`:

```js
import { runAnalytics } from '../../../db/schema/run-analytics.js';
```

Keep the preference-history replacement behavior instead of append-only inserts:

```js
await db.delete(preferenceHistory).where(eq(preferenceHistory.cycleId, schedule.cycleId));

if (historyRows.length > 0) {
  await db.insert(preferenceHistory).values(historyRows);
}
```

Keep fractional assignments persisted with a real `FRACTIONAL` slot key and sequential share indexes in `lib/scheduling/result-persister.js`:

```js
slotKey: a.shareIndex === 0
  ? 'FRACTIONAL'
  : (a.slotKey || (a.shiftType === 'NS' ? 'NS' : a.shiftType === 'DS2' ? 'DAY2' : 'DAY1')),

const fracCounters = {};
assignmentRows.forEach((row) => {
  if (row.slotKey === 'FRACTIONAL') {
    const key = row.piId;
    fracCounters[key] = (fracCounters[key] || 0) + 1;
    row.shareIndex = fracCounters[key];
  }
});
```

Ensure `db/schema/preference-history.js` includes the fields publish now writes:

```js
export const preferenceHistory = pgTable('preference_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  piId: uuid('pi_id').notNull().references(() => users.id),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  shareIndex: integer('share_index').notNull().default(0),
  slotKey: slotKeyEnum('slot_key').notNull(),
  choice1Date: date('choice_1_date'),
  choice2Date: date('choice_2_date'),
  assignedDate: date('assigned_date'),
  choiceRank: integer('choice_rank'),
  assignmentType: text('assignment_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: Re-run the publish tests**

Run:

```bash
npm run test -- tests/api/schedule-publish.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the publish/history fixes**

```bash
git add api/schedules/[id]/publish.js lib/scheduling/result-persister.js db/schema/preference-history.js tests/api/schedule-publish.test.js
git commit -m "fix: correct schedule publication history writes"
```

### Task 4: Replace Ephemeral Auth Throttling With Durable Protection

**Files:**
- Create: `db/schema/auth-rate-limits.js`
- Create: `db/migrations/0005_auth_rate_limits.sql`
- Create: `lib/rate-limit.js`
- Create: `tests/api/auth-throttle.test.js`
- Modify: `db/index.js`
- Modify: `api/auth/login.js`
- Modify: `api/auth/reset-password.js`

- [ ] **Step 1: Add failing auth throttle tests**

Create `tests/api/auth-throttle.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReq, createRes } from '../helpers/http.js';

const takeRateLimitSlot = vi.fn();

vi.mock('../../lib/rate-limit.js', () => ({
  takeRateLimitSlot,
  clearRateLimitBucket: vi.fn(),
}));

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../lib/middleware/with-method.js', () => ({
  withMethod: (_method, handler) => handler,
}));

describe('auth throttling', () => {
  beforeEach(() => {
    takeRateLimitSlot.mockReset();
  });

  it('rejects rate-limited login attempts', async () => {
    takeRateLimitSlot.mockResolvedValue({ allowed: false, retryAfterMs: 60000 });

    const { default: handler } = await import('../../api/auth/login.js');
    const req = createReq({ method: 'POST', body: { email: 'pi@example.com', password: 'bad' } });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(429);
  });

  it('applies the same durable limiter to reset-password', async () => {
    takeRateLimitSlot.mockResolvedValue({ allowed: false, retryAfterMs: 60000 });

    const { default: handler } = await import('../../api/auth/reset-password.js');
    const req = createReq({ method: 'POST', body: { email: 'pi@example.com' } });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(429);
  });
});
```

- [ ] **Step 2: Run the auth throttle tests**

Run:

```bash
npm run test -- tests/api/auth-throttle.test.js
```

Expected: FAIL because `login.js` still uses the in-memory limiter and `reset-password.js` has no limiter yet.

- [ ] **Step 3: Add a DB-backed rate-limit table**

Create `db/schema/auth-rate-limits.js`:

```js
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const authRateLimits = pgTable('auth_rate_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  bucket: text('bucket').notNull().unique(),
  count: integer('count').notNull().default(0),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Create `db/migrations/0005_auth_rate_limits.sql`:

```sql
CREATE TABLE "auth_rate_limits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bucket" text NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "auth_rate_limits_bucket_unique" UNIQUE("bucket")
);
```

Update `db/index.js` to include the new schema module in the exported `schema` object.

- [ ] **Step 4: Create the durable limiter service**

Create `lib/rate-limit.js`:

```js
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authRateLimits } from '../db/schema/auth-rate-limits.js';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function bucketFor(scope, value) {
  return `${scope}:${String(value || '').trim().toLowerCase()}`;
}

export async function takeRateLimitSlot(scope, value) {
  const bucket = bucketFor(scope, value);
  const now = new Date();
  const [existing] = await db.select().from(authRateLimits).where(eq(authRateLimits.bucket, bucket)).limit(1);

  if (!existing) {
    await db.insert(authRateLimits).values({
      bucket,
      count: 1,
      windowStartedAt: now,
      updatedAt: now,
    });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  const elapsed = now.getTime() - new Date(existing.windowStartedAt).getTime();
  if (elapsed > WINDOW_MS) {
    await db.update(authRateLimits).set({
      count: 1,
      windowStartedAt: now,
      updatedAt: now,
    }).where(eq(authRateLimits.bucket, bucket));
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (existing.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, retryAfterMs: WINDOW_MS - elapsed };
  }

  await db.update(authRateLimits).set({
    count: existing.count + 1,
    updatedAt: now,
  }).where(eq(authRateLimits.bucket, bucket));

  return { allowed: true, remaining: MAX_ATTEMPTS - (existing.count + 1) };
}

export async function clearRateLimitBucket(scope, value) {
  const bucket = bucketFor(scope, value);
  await db.delete(authRateLimits).where(eq(authRateLimits.bucket, bucket));
}
```

- [ ] **Step 5: Wire the new limiter into auth routes**

Update `api/auth/login.js` imports and limiter calls:

```js
import { takeRateLimitSlot, clearRateLimitBucket } from '../../lib/rate-limit.js';

const rateCheck = await takeRateLimitSlot('login', body.email);
if (!rateCheck.allowed) {
  const retryMinutes = Math.ceil(rateCheck.retryAfterMs / 60000);
  return res.status(429).json({
    error: `Too many login attempts. Try again in ${retryMinutes} minutes.`,
    code: 'RATE_LIMITED',
  });
}

await clearRateLimitBucket('login', body.email);
```

Update `api/auth/reset-password.js`:

```js
import { takeRateLimitSlot } from '../../lib/rate-limit.js';

const rateCheck = await takeRateLimitSlot('reset-password', body.email);
if (!rateCheck.allowed) {
  const retryMinutes = Math.ceil(rateCheck.retryAfterMs / 60000);
  return res.status(429).json({
    error: `Too many reset attempts. Try again in ${retryMinutes} minutes.`,
    code: 'RATE_LIMITED',
  });
}
```

- [ ] **Step 6: Re-run the auth tests**

Run:

```bash
npm run test -- tests/api/auth-throttle.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit the auth hardening**

```bash
git add db/schema/auth-rate-limits.js db/migrations/0005_auth_rate_limits.sql lib/rate-limit.js db/index.js api/auth/login.js api/auth/reset-password.js tests/api/auth-throttle.test.js
git commit -m "fix: add durable auth throttling"
```

### Task 5: Add Environment Guards And Seed Safety

**Files:**
- Create: `lib/env.js`
- Modify: `db/index.js`
- Modify: `lib/auth-utils.js`
- Modify: `lib/email.js`
- Modify: `api/cron/send-reminders.js`
- Modify: `db/seed.js`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Create a central environment loader**

Create `lib/env.js`:

```js
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '.env.local' });
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 2: Replace direct `process.env` reads in critical server files**

Update `db/index.js`:

```js
import { env } from '../lib/env.js';

const sql = neon(env.DATABASE_URL);
```

Update `lib/auth-utils.js`:

```js
import { env } from './env.js';

return jwt.sign(payload, env.JWT_SECRET, { expiresIn: JWT_EXPIRY_SECONDS });
return jwt.verify(token, env.JWT_SECRET);
const isProduction = env.NODE_ENV === 'production';
```

Update `api/cron/send-reminders.js`:

```js
import { env } from '../../lib/env.js';

if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
  return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
}
```

- [ ] **Step 3: Make seeding explicitly opt-in**

Update `db/seed.js`:

```js
import { env } from '../lib/env.js';

if (env.NODE_ENV === 'production' || process.env.ALLOW_DB_SEED !== 'yes') {
  throw new Error('Refusing to seed without ALLOW_DB_SEED=yes in a non-production environment');
}
```

Replace the hard-coded password output with:

```js
console.log('Default admin login created for local development only.');
console.log('Set ADMIN_SEED_PASSWORD in your shell before running the seed script.');
```

Use the password source:

```js
const adminPassword = process.env.ADMIN_SEED_PASSWORD;
if (!adminPassword) {
  throw new Error('ADMIN_SEED_PASSWORD is required when seeding');
}
const adminPasswordHash = await hashPassword(adminPassword);
```

- [ ] **Step 4: Update the documented environment contract**

Update `.env.example` to include:

```dotenv
DATABASE_URL=
JWT_SECRET=
CRON_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
APP_URL=http://localhost:5173
```

Update `README.md` to replace the current static-app copy with:

```md
# SERCAT Scheduler

Full-stack Vite + React + Vercel serverless application for member scheduling, preference collection, schedule generation, and publication.

## Local setup

npm install
npm run test
npm run build
```

- [ ] **Step 5: Verify the environment guardrails**

Run:

```bash
npm run test -- tests/api/auth-throttle.test.js
npm run build
```

Expected: both commands pass, and `db/seed.js` now exits early unless the required opt-in variables are present.

- [ ] **Step 6: Commit the env and seed protections**

```bash
git add lib/env.js db/index.js lib/auth-utils.js lib/email.js api/cron/send-reminders.js db/seed.js .env.example README.md
git commit -m "chore: add env validation and seed guardrails"
```

### Task 6: Extract Snapshot Persistence From `mock-state`

**Files:**
- Create: `src/state/snapshot.js`
- Create: `tests/client/snapshot-storage.test.js`
- Modify: `src/lib/mock-state.js`
- Modify: `src/lib/storage.js`

- [ ] **Step 1: Add failing snapshot tests**

Create `tests/client/snapshot-storage.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { buildPersistedSnapshot } from '../../src/state/snapshot.js';

describe('buildPersistedSnapshot', () => {
  it('removes algorithm source text before localStorage persistence', () => {
    const snapshot = buildPersistedSnapshot({
      members: [],
      cycle: {},
      queue: [],
      config: {},
      preferences: {},
      results: null,
      currentView: 'admin',
      memberTab: 'dashboard',
      adminTab: 'dashboard',
      schedulePublication: { status: 'draft', draftedAt: '', publishedAt: '' },
      shiftChangeRequests: [],
      registrationRequests: [],
      memberAccessAccounts: [],
      memberComments: {},
      algorithm: {
        source: 'function hugeAlgorithm() {}',
        sourceHash: 1234,
      },
    });

    expect(snapshot.algorithm.source).toBeUndefined();
    expect(snapshot.algorithm.sourceHash).toBe(1234);
  });
});
```

- [ ] **Step 2: Run the snapshot test**

Run:

```bash
npm run test -- tests/client/snapshot-storage.test.js
```

Expected: FAIL because the current persistence path stores the raw engine source string.

- [ ] **Step 3: Add a focused snapshot module**

Create `src/state/snapshot.js`:

```js
export function buildPersistedSnapshot(snapshot) {
  const algorithm = snapshot.algorithm || {};

  return {
    ...snapshot,
    algorithm: {
      capturedAt: algorithm.capturedAt || '',
      sourceHash: algorithm.sourceHash || null,
      configSnapshot: algorithm.configSnapshot || {},
    },
  };
}
```

Update `src/lib/mock-state.js` so the storage path becomes:

```js
import { buildPersistedSnapshot } from '../state/snapshot';

const snapshot = buildPersistedSnapshot(buildSnapshot(overrides));
saveStoredSnapshot(snapshot);
```

Update `src/lib/storage.js` to remain a thin persistence wrapper only:

```js
export function saveStoredSnapshot(snapshot) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    console.error('Failed to save SERCAT UI state.', error);
    return false;
  }
}
```

- [ ] **Step 4: Re-run the snapshot test and build**

Run:

```bash
npm run test -- tests/client/snapshot-storage.test.js
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit the persistence extraction**

```bash
git add src/state/snapshot.js src/lib/mock-state.js src/lib/storage.js tests/client/snapshot-storage.test.js
git commit -m "refactor: isolate snapshot persistence rules"
```

### Task 7: Normalize Client/Server Contracts And Shrink `mock-state`

**Files:**
- Modify: `src/hooks/useApiData.js`
- Modify: `src/hooks/useServerSync.js`
- Modify: `src/lib/data-mappers.js`
- Modify: `src/lib/mock-state.js`
- Modify: `src/lib/api.js`

- [ ] **Step 1: Write a failing mapper test for server payload normalization**

Create `tests/client/server-sync-contract.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { mapPreferencesToMock } from '../../src/lib/data-mappers.js';

describe('mapPreferencesToMock', () => {
  it('rebuilds fractional preferences from FRACTIONAL rows', () => {
    const members = [{ id: 'UGA', _piUserId: 'pi-1', shares: 1.5, status: 'ACTIVE' }];
    const prefs = [
      { piId: 'pi-1', shareIndex: 1, slotKey: 'FRACTIONAL', shiftType: 'DS2', choice1Date: '2026-04-20', choice2Date: '2026-04-21', submittedAt: '2026-04-01T00:00:00.000Z' },
    ];

    const mapped = mapPreferencesToMock(prefs, members);

    expect(mapped.UGA.fractional[0]).toEqual({
      shiftType: 'DS2',
      firstChoiceDate: '2026-04-20',
      secondChoiceDate: '2026-04-21',
    });
  });
});
```

- [ ] **Step 2: Run the contract test**

Run:

```bash
npm run test -- tests/client/server-sync-contract.test.js
```

Expected: FAIL if the mapping and sync layers still depend on inconsistent route payload shapes.

- [ ] **Step 3: Keep one API envelope shape and thin adapters**

Update `src/lib/api.js` to keep returning parsed `{ data, pagination }` envelopes and do not special-case individual routes.

Update `src/hooks/useServerSync.js` so query functions unwrap the same way every time:

```js
queryFn: () => api.get(`/cycles/${activeCycleId}/dates`).then((r) => r.data || []),
queryFn: () => api.get(`/cycles/${activeCycleId}/preferences`).then((r) => r.data || []),
queryFn: () => api.get(`/cycles/${activeCycleId}/schedules`).then((r) => r.data || null),
```

Keep the schedule adapter logic in one place instead of spreading it through `mock-state`:

```js
if (!sched || !Array.isArray(sched.assignments)) {
  setResults(null);
  setSchedulePublication({ status: 'draft', draftedAt: '', publishedAt: '' });
  return;
}
```

Extract any remaining pure transform helpers from `src/lib/mock-state.js` into `src/lib/data-mappers.js` or `src/state/snapshot.js` instead of extending the context object further.

- [ ] **Step 4: Re-run the client contract tests**

Run:

```bash
npm run test -- tests/client/server-sync-contract.test.js tests/client/snapshot-storage.test.js
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit the client contract cleanup**

```bash
git add src/hooks/useApiData.js src/hooks/useServerSync.js src/lib/data-mappers.js src/lib/mock-state.js src/lib/api.js tests/client/server-sync-contract.test.js
git commit -m "refactor: normalize client server contracts"
```

### Task 8: Replace Duplicate Scheduling Engines With One Canonical Shared Engine

**Files:**
- Create: `shared/scheduling/constants.js`
- Create: `shared/scheduling/dates.js`
- Create: `shared/scheduling/whole-share.js`
- Create: `shared/scheduling/engine.js`
- Create: `shared/scheduling/index.js`
- Create: `tests/shared/scheduling-engine.test.js`
- Modify: `src/engine/engine.js`
- Modify: `lib/scheduling/index.js`
- Modify: `src/lib/normalizers.js`
- Modify: `src/lib/mock-state.js`
- Modify: `src/screens/member/PreferenceForm.jsx`

- [ ] **Step 1: Add a parity guard test**

Create `tests/shared/scheduling-engine.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { runSchedulingEngine as clientEngine } from '../../src/engine/engine.js';
import { runSchedulingEngine as serverEngine } from '../../lib/scheduling/engine.js';

const input = {
  cycle: { id: '2026-1', startDate: '2026-04-01', endDate: '2026-04-05', blockedDates: [], blockedSlots: [] },
  members: [{ id: 'UGA', shares: 1, status: 'ACTIVE' }],
  wholeSharePreferences: [
    { memberId: 'UGA', shareIndex: 1, slotKey: 'DAY1', shiftType: 'DS1', firstChoiceDate: '2026-04-01', secondChoiceDate: '2026-04-02' },
    { memberId: 'UGA', shareIndex: 1, slotKey: 'DAY2', shiftType: 'DS2', firstChoiceDate: '2026-04-01', secondChoiceDate: '2026-04-02' },
    { memberId: 'UGA', shareIndex: 1, slotKey: 'NS', shiftType: 'NS', firstChoiceDate: '2026-04-03', secondChoiceDate: '2026-04-04' },
  ],
  fractionalPreferences: [],
  priorityQueue: [{ memberId: 'UGA', deficitScore: 0, cycleWins: 0, roundWins: 0 }],
  config: {
    winPenalty: 0.15,
    secondChoicePenaltyRatio: 0.3,
    preferenceProximityDays: 7,
    backfillMinGapDays: 14,
    backfillIdealGapDays: 21,
    deficitHalfLifeCycles: 3,
    expectedSatisfaction: 0.7,
    satisfactionWeights: { firstChoice: 1.0, secondChoice: 0.7, proximity3: 0.4, proximity7: 0.2, auto: 0.0, backfill: 0.45 },
    fairnessWeights: { satisfaction: 0.6, desirability: 0.4 },
    pairingTolerance: 0.5,
    cycleNumber: 1,
  },
  simpleHash: () => 7,
};

describe('scheduling engine parity', () => {
  it('keeps browser and server scheduling behavior identical', () => {
    expect(clientEngine(input)).toEqual(serverEngine(input));
  });
});
```

- [ ] **Step 2: Run the parity test**

Run:

```bash
npm run test -- tests/shared/scheduling-engine.test.js
```

Expected: PASS. This test is the safety rail that lets the duplication be removed without changing behavior.

- [ ] **Step 3: Create the canonical shared engine**

Move the engine support files into `shared/scheduling/` and make both old entry points re-export the shared implementation.

Create `shared/scheduling/index.js`:

```js
export { SHIFT_HOURS, SHIFT_ORDER, WHOLE_SLOT_ORDER } from './constants.js';
export { runSchedulingEngine, computeEntitlements, buildDemandMap } from './engine.js';
export { addDays, daysBetween, generateDateRange } from './dates.js';
export {
  countRemainingWholeShareSlots,
  countWholeShareSlots,
  getActiveWholeSlotKeysForShare,
  normalizeWholeShareEntriesForDoubleNight,
} from './whole-share.js';
```

Update `src/engine/engine.js`:

```js
export { runSchedulingEngine, computeEntitlements, buildDemandMap } from '../../shared/scheduling/index.js';
```

Update `lib/scheduling/index.js`:

```js
export { runSchedulingEngine, computeEntitlements, buildDemandMap } from '../../shared/scheduling/index.js';
```

- [ ] **Step 4: Update imports to the canonical engine**

Keep `src/lib/normalizers.js`, `src/lib/mock-state.js`, and `src/screens/member/PreferenceForm.jsx` importing from one stable engine entry point after the re-export change. Do not leave both implementations active.

- [ ] **Step 5: Re-run parity, client, and build verification**

Run:

```bash
npm run test -- tests/shared/scheduling-engine.test.js tests/client/server-sync-contract.test.js
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit the engine deduplication**

```bash
git add shared/scheduling src/engine/engine.js lib/scheduling/index.js src/lib/normalizers.js src/lib/mock-state.js src/screens/member/PreferenceForm.jsx tests/shared/scheduling-engine.test.js
git commit -m "refactor: unify scheduling engine implementation"
```

### Task 9: Add CI And Operational Documentation

**Files:**
- Create: `docs/architecture/repo-layout.md`
- Create: `docs/operations/deployment-checklist.md`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Document the actual app layout**

Create `docs/architecture/repo-layout.md`:

```md
# Repository Layout

- `src/`: browser application code
- `api/`: Vercel serverless routes
- `db/`: Drizzle schema, migrations, seed tooling
- `lib/`: server-only helpers and route middleware
- `shared/`: browser-safe and server-safe shared domain code
- `tests/`: Vitest regression and contract tests
```

- [ ] **Step 2: Add a deployment checklist**

Create `docs/operations/deployment-checklist.md`:

```md
# Deployment Checklist

1. Run `npm run test`
2. Run `npm run build`
3. Confirm `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `APP_URL`, and `EMAIL_FROM` are set
4. Confirm the latest migration file has been applied
5. Confirm no `.env.local` changes are staged
6. Deploy only after the schedule access and publish tests are green
```

- [ ] **Step 3: Add CI so verification runs automatically**

Create `.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: package-lock.json
      - run: npm ci
      - run: npm run test
      - run: npm run build
```

- [ ] **Step 4: Reconcile the README with the real application**

Update `README.md` so the opening section states:

```md
SERCAT is a full-stack scheduling application with:

- React client screens for members and admins
- Vercel serverless API routes for auth, scheduling, and admin workflows
- Drizzle + Neon persistence for users, cycles, preferences, schedules, and analytics
- Vitest-based regression coverage for the highest-risk flows
```

- [ ] **Step 5: Run the full verification set**

Run:

```bash
npm run test
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit the docs and CI**

```bash
git add README.md docs/architecture/repo-layout.md docs/operations/deployment-checklist.md .github/workflows/ci.yml
git commit -m "docs: add repo architecture and deployment guardrails"
```

## Self-Review

- Spec coverage: the plan covers the review findings in three buckets: correctness (`Task 2`, `Task 3`), security and runtime safety (`Task 4`, `Task 5`), and maintainability/verification (`Task 1`, `Task 6`, `Task 7`, `Task 9`).
- Placeholder scan: no unfinished marker phrases remain.
- Type consistency: the plan uses the current repo’s actual file paths and current naming (`FRACTIONAL`, `preference_history.shareIndex`, `scheduleAssignments.assignmentType`, `useServerSync`, `runSchedulingEngine`).
