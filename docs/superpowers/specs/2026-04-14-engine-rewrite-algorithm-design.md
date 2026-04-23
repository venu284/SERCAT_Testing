# Engine Rewrite Algorithm Design

**Goal:** Replace the current server-side scheduling algorithm with the locked multi-module design from `SERCAT_ALGORITHM_DECISIONS.md` and `ENGINE_REWRITE_ALGORITHM.md`, while keeping the existing API, DB-facing schedule persistence, and frontend `results` contract unchanged.

**Scope:** Server-side scheduling only. Allowed files are under `lib/scheduling/` plus the schedule data adapters already in that path. No `/src/` changes. No schedule API contract changes.

## Current Repo Constraints

- Schedule generation already runs on the server through:
  - `api/cycles/[id]/schedules/generate.js`
  - `api/cycles/[id]/schedules/index.js`
  - `api/schedules/[id]/publish.js`
  - `api/schedules/[id]/unpublish.js`
  - `api/schedules/[id]/assignments/[assignmentId].js`
- The current UI reads the existing `results` shape and must not break.
- `data-loader.js` and `result-persister.js` are already the DB-aware boundary around the engine.
- Current DB schema and prior Step 7 fixes must remain usable.

## Decision

Use an internal rewrite with compatibility adapters:

1. Build the new pure scheduling core inside `lib/scheduling/`
2. Keep schedule API handlers and screen contract stable
3. Translate current DB rows into the new engine input in `data-loader.js`
4. Translate rich engine output back into the current persisted/result shape in `result-persister.js`

This is intentionally not a full terminology/schema migration. The algorithm changes; the application contract stays stable.

## Files In Scope

### New files

- `lib/scheduling/config.js`
- `lib/scheduling/schemas.js`
- `lib/scheduling/scorer.js`
- `lib/scheduling/history.js`
- `lib/scheduling/analyzer.js`
- `lib/scheduling/engine.test.js`

### Rewritten files

- `lib/scheduling/engine.js`

### Updated files

- `lib/scheduling/data-loader.js`
- `lib/scheduling/result-persister.js`
- `lib/scheduling/index.js`

### Explicitly out of scope

- Everything under `src/`
- API route URLs and payload contracts
- Admin/member screen behavior
- Email, auth, shares CRUD, or cycle CRUD behavior

## Engine Input Design

`data-loader.js` will construct the rich `EngineInput` described by the algorithm docs using current persisted data:

- `shares[]`
  - derived from snapped cycle shares
  - includes `piId`, `institutionId`, `wholeShares`, `fractionalShares`
- `preferences[]`
  - derived from persisted preferences rows
  - normalized to `shift`-centric entries for both whole and fractional data
- `availableDates[]`
  - derived from cycle date availability after blocked dates and blocked shifts
- `deficitHistory[]`
  - mapped from existing deficit history rows
- `preferenceHistory[]`
  - mapped from existing preference history rows
- `pastAssignments[]`
  - loaded from published schedules and manual overrides where available
- `config`
  - populated from `DEFAULT_CONFIG`
- `previousDraft`
  - loaded from the latest existing draft for the cycle when rerunning
- `cycleDates`
  - start/end/blocked dates needed for guardrails and fallback search

The loader remains the only DB-aware translation point into the pure engine.

## Engine Output Design

The rewritten engine will return the rich internal shape from the algorithm docs:

- `assignments[]`
- `deficitUpdates[]`
- `satisfaction[]`
- `fairnessMetrics`
- `runQuality`
- `engineLog[]`
- `analytics`
- `errors[]`
- `warnings[]`

`result-persister.js` will map that back into the current persisted/result shape expected elsewhere:

- persisted `schedule_assignments`
- persisted `run_analytics`
- returned `results.assignments`
- returned `results.fairness`
- returned `results.metadata`
- returned `results.engineLog`
- returned `results.errors`
- returned `results.warnings`

Compatibility rules:

- `memberId` remains institution abbreviation in returned `results`
- `date` remains `YYYY-MM-DD`
- `shiftType` remains `DS1 | DS2 | NS`
- `slotKey` remains `DAY1 | DAY2 | NS | FRACTIONAL`
- `assignmentType` remains one of the current UI values
- `hours`, `isShared`, `sharedWith` remain populated for screens and publish logic

## Algorithm Modules

### `config.js`

- Exports `DEFAULT_CONFIG`
- Exports a Zod-backed config schema
- Validates exact locked values and that weights sum to `1.0`

### `schemas.js`

- Defines `EngineInputSchema`
- Defines `EngineOutputSchema`
- Exports `validateEngineInput(input)`
- Ensures invalid schedule runs fail before mutation/persistence

### `scorer.js`

- Implements the additive weighted scoring formula
- Uses min-max normalization per current conflict group
- Returns both total score and a full component breakdown
- Remains deterministic; tie-breaking stays outside scorer

### `history.js`

- Calculates effective institution+shift deficit with decay
- Detects patterns from historical preference data
- Produces confidence values for the pattern bonus

### `analyzer.js`

- Calculates institution satisfaction
- Calculates fairness metrics and deviation
- Calculates run quality composite score
- Produces deficit updates for the next cycle

### `engine.js`

The new engine replaces the current monolithic implementation with these phases:

1. Validate input
2. Initialize deficits, patterns, and optional rerun boosts
3. Whole-share assignment
   - round-based
   - shift-based
   - strict two-pass processing
4. Fractional assignment
   - DS1/DS2 bin-packing
   - preference-aware packing
   - oversubscription resolved by scorer
5. No-preference auto-assignment
   - deficit ordered
   - gap constrained
6. Post-run analytics
7. Build rich output

Behavior locked by the docs:

- institution-based deficit
- per-shift deficit granularity
- two-pass conflict resolution
- gap-aware proximity fallback
- flat per-round drop
- deterministic output for identical input
- no `Date.now()` or random behavior in the pure core

## Verification Strategy

The rewrite must be proven at three levels:

1. Module tests
   - scorer normalization and weights
   - deficit decay
   - pattern detection
   - satisfaction/fairness/quality calculations
2. Engine tests
   - deterministic same-input behavior
   - whole-share two-pass conflicts
   - fractional packing
   - no-preference assignment
   - edge cases from the design doc
3. Repo-level verification
   - `npm run build`
   - targeted live-style schedule generation smoke pass against the existing server-side handlers

## Risks To Control

- Existing screen contract is narrow and must remain backward-compatible
- Fractional assignments and shared allocations are easy to regress
- Publish logic depends on persisted assignment semantics and preference history
- Loader/persister mistakes are more dangerous than the engine rewrite itself because they can silently distort otherwise-correct algorithm behavior

## Non-Goals

- Renaming DB columns or route payloads to the new terminology
- Updating any frontend component or state shape in `src/`
- Adding new runtime dependencies
- Changing admin/member UX in this task
