import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_CONFIG, configSchema } from './config.js';
import { calculatePriorityScore } from './scorer.js';
import { calculateEffectiveDeficits } from './history.js';
import { runSchedulingEngine } from './engine.js';

function buildBaseInput(overrides = {}) {
  return {
    shares: [
      {
        piId: 'pi-a',
        institutionId: 'inst-a',
        institutionAbbreviation: 'UGA',
        wholeShares: 1,
        fractionalShares: 0,
        isActive: true,
      },
      {
        piId: 'pi-b',
        institutionId: 'inst-b',
        institutionAbbreviation: 'NIH',
        wholeShares: 1,
        fractionalShares: 0,
        isActive: true,
      },
    ],
    preferences: [
      {
        piId: 'pi-a',
        institutionId: 'inst-a',
        memberId: 'UGA',
        shareIndex: 1,
        shift: 'DS1',
        choice1Date: '2026-03-10',
        choice2Date: '2026-03-11',
      },
      {
        piId: 'pi-a',
        institutionId: 'inst-a',
        memberId: 'UGA',
        shareIndex: 1,
        shift: 'DS2',
        choice1Date: '2026-03-17',
        choice2Date: '2026-03-18',
      },
      {
        piId: 'pi-a',
        institutionId: 'inst-a',
        memberId: 'UGA',
        shareIndex: 1,
        shift: 'NS',
        choice1Date: '2026-03-24',
        choice2Date: '2026-03-25',
      },
      {
        piId: 'pi-b',
        institutionId: 'inst-b',
        memberId: 'NIH',
        shareIndex: 1,
        shift: 'DS1',
        choice1Date: '2026-03-10',
        choice2Date: '2026-03-12',
      },
      {
        piId: 'pi-b',
        institutionId: 'inst-b',
        memberId: 'NIH',
        shareIndex: 1,
        shift: 'DS2',
        choice1Date: '2026-03-19',
        choice2Date: '2026-03-20',
      },
      {
        piId: 'pi-b',
        institutionId: 'inst-b',
        memberId: 'NIH',
        shareIndex: 1,
        shift: 'NS',
        choice1Date: '2026-03-26',
        choice2Date: '2026-03-27',
      },
    ],
    fractionalPreferences: [],
    availableDates: [
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-17',
      '2026-03-18',
      '2026-03-19',
      '2026-03-20',
      '2026-03-24',
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
    ],
    blockedSlots: [],
    deficitHistory: [],
    preferenceHistory: [],
    pastAssignments: [],
    config: DEFAULT_CONFIG,
    previousDraft: null,
    cycleDates: {
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      blockedDates: [],
    },
    _cycleId: 'cycle-1',
    _abbrToPiId: { UGA: 'pi-a', NIH: 'pi-b' },
    _abbrToInstitutionId: { UGA: 'inst-a', NIH: 'inst-b' },
    ...overrides,
  };
}

test('config schema validates locked defaults', () => {
  const parsed = configSchema.parse(DEFAULT_CONFIG);
  assert.equal(parsed.weights.institutionalDeficit, 0.35);
  assert.equal(parsed.qualityWeights.satisfaction, 0.6);
});

test('priority scorer favors higher deficit when other inputs are equal', () => {
  const high = calculatePriorityScore({
    institutionalDeficit: 2,
    allDeficits: [2, 0],
    choiceRank: 1,
    avgSatisfaction: 0.5,
    allAvgSatisfactions: [0.5, 0.5],
    patternConfidence: 0,
    round: 1,
    config: DEFAULT_CONFIG,
  });
  const low = calculatePriorityScore({
    institutionalDeficit: 0,
    allDeficits: [2, 0],
    choiceRank: 1,
    avgSatisfaction: 0.5,
    allAvgSatisfactions: [0.5, 0.5],
    patternConfidence: 0,
    round: 1,
    config: DEFAULT_CONFIG,
  });
  assert.ok(high.score > low.score);
});

test('effective deficit applies exponential decay by cycle age', () => {
  const map = calculateEffectiveDeficits([
    { institutionId: 'inst-a', shift: 'DS1', deficitScore: 1, cycleAge: 0 },
    { institutionId: 'inst-a', shift: 'DS1', deficitScore: 1, cycleAge: 1 },
    { institutionId: 'inst-a', shift: 'DS1', deficitScore: 1, cycleAge: 2 },
  ], 0.9);
  assert.equal(Number(map.get('inst-a:DS1').toFixed(2)), 2.71);
});

test('engine is deterministic for identical input', () => {
  const input = buildBaseInput();
  const first = runSchedulingEngine(input);
  const second = runSchedulingEngine(input);
  assert.deepEqual(first.assignments, second.assignments);
  assert.deepEqual(first.metadata, second.metadata);
});

test('whole-share conflicts resolve choice1 first and cascade losers to choice2', () => {
  const result = runSchedulingEngine(buildBaseInput());
  const ugaDs1 = result.assignments.find((a) => a.memberId === 'UGA' && a.shift === 'DS1' && a.shareIndex === 1);
  const nihDs1 = result.assignments.find((a) => a.memberId === 'NIH' && a.shift === 'DS1' && a.shareIndex === 1);

  assert.ok(ugaDs1);
  assert.ok(nihDs1);
  assert.equal(ugaDs1.assignmentReason, 'choice1');
  assert.equal(nihDs1.assignmentReason, 'choice2');
  assert.equal(nihDs1.assignedDate, '2026-03-12');
});

test('blocked slots are removed from engine availability', () => {
  const result = runSchedulingEngine(buildBaseInput({
    blockedSlots: ['2026-03-10:DS1'],
  }));
  const ugaDs1 = result.assignments.find((a) => a.memberId === 'UGA' && a.shift === 'DS1' && a.shareIndex === 1);

  assert.ok(ugaDs1);
  assert.notEqual(ugaDs1.assignedDate, '2026-03-10');
});

test('engine log captures scoring metadata for conflict decisions', () => {
  const result = runSchedulingEngine(buildBaseInput());
  const conflictLog = result.engineLog.find((entry) => entry.action === 'Conflict Won');

  assert.ok(conflictLog);
  assert.equal(conflictLog.round, 1);
  assert.equal(conflictLog.shift, 'DS1');
  assert.equal(typeof conflictLog.institutionId, 'string');
  assert.equal(typeof conflictLog.piId, 'string');
  assert.equal(typeof conflictLog.priorityScore, 'number');
  assert.deepEqual(Object.keys(conflictLog.scoreBreakdown).sort(), ['drop', 'w1', 'w2', 'w3', 'w4', 'w5']);
  assert.equal(conflictLog.result, 'choice1');
  assert.equal(conflictLog.assignedDate, '2026-03-10');
  assert.equal(typeof conflictLog.detail, 'string');
  assert.equal(conflictLog.details, conflictLog.detail);
});

test('analytics input snapshot stores a deep copy of the full engine input', () => {
  const input = buildBaseInput();
  const originalChoiceDate = input.preferences[0].choice1Date;
  const result = runSchedulingEngine(input);

  input.preferences[0].choice1Date = '2099-12-31';
  input.availableDates.pop();

  assert.equal(result.analytics.inputSnapshot.preferences[0].choice1Date, originalChoiceDate);
  assert.equal(result.analytics.inputSnapshot.availableDates.length, 11);
  assert.equal(result.analytics.inputSnapshot.shares.length, 2);
  assert.equal(result.analytics.inputSnapshot.previousDraft, null);
});

test('gap-aware fallback skips dates inside the inferred exclusion zone', () => {
  const result = runSchedulingEngine({
    shares: [
      {
        piId: 'pi-z',
        institutionId: 'inst-a',
        institutionAbbreviation: 'UGA',
        wholeShares: 1,
        fractionalShares: 0,
        isActive: true,
      },
      {
        piId: 'pi-a',
        institutionId: 'inst-b',
        institutionAbbreviation: 'NIH',
        wholeShares: 1,
        fractionalShares: 0,
        isActive: true,
      },
      {
        piId: 'pi-c',
        institutionId: 'inst-c',
        institutionAbbreviation: 'DUKE',
        wholeShares: 1,
        fractionalShares: 0,
        isActive: true,
      },
    ],
    preferences: [
      { piId: 'pi-z', institutionId: 'inst-a', memberId: 'UGA', shareIndex: 1, shift: 'DS1', choice1Date: '2026-03-01', choice2Date: '2026-03-02' },
      { piId: 'pi-z', institutionId: 'inst-a', memberId: 'UGA', shareIndex: 1, shift: 'DS2', choice1Date: '2026-03-10', choice2Date: '2026-03-11' },
      { piId: 'pi-z', institutionId: 'inst-a', memberId: 'UGA', shareIndex: 1, shift: 'NS', choice1Date: '2026-03-29', choice2Date: '2026-03-30' },
      { piId: 'pi-a', institutionId: 'inst-b', memberId: 'NIH', shareIndex: 1, shift: 'DS1', choice1Date: '2026-03-03', choice2Date: '2026-03-04' },
      { piId: 'pi-a', institutionId: 'inst-b', memberId: 'NIH', shareIndex: 1, shift: 'DS2', choice1Date: '2026-03-10', choice2Date: '2026-03-12' },
      { piId: 'pi-a', institutionId: 'inst-b', memberId: 'NIH', shareIndex: 1, shift: 'NS', choice1Date: '2026-03-27', choice2Date: '2026-03-28' },
      { piId: 'pi-c', institutionId: 'inst-c', memberId: 'DUKE', shareIndex: 1, shift: 'DS1', choice1Date: '2026-03-05', choice2Date: '2026-03-06' },
      { piId: 'pi-c', institutionId: 'inst-c', memberId: 'DUKE', shareIndex: 1, shift: 'DS2', choice1Date: '2026-03-11', choice2Date: '2026-03-12' },
      { piId: 'pi-c', institutionId: 'inst-c', memberId: 'DUKE', shareIndex: 1, shift: 'NS', choice1Date: '2026-03-31', choice2Date: '2026-04-01' },
    ],
    fractionalPreferences: [],
    availableDates: [
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
      '2026-03-15',
      '2026-03-16',
      '2026-03-17',
      '2026-03-18',
      '2026-03-19',
      '2026-03-20',
      '2026-03-21',
      '2026-03-22',
      '2026-03-23',
      '2026-03-24',
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
      '2026-04-01',
    ],
    deficitHistory: [],
    preferenceHistory: [],
    pastAssignments: [],
    config: DEFAULT_CONFIG,
    previousDraft: null,
    cycleDates: {
      startDate: '2026-03-01',
      endDate: '2026-04-01',
      blockedDates: ['2026-03-12'],
    },
    _cycleId: 'cycle-2',
    _abbrToPiId: { UGA: 'pi-z', NIH: 'pi-a', DUKE: 'pi-c' },
    _abbrToInstitutionId: { UGA: 'inst-a', NIH: 'inst-b', DUKE: 'inst-c' },
  });

  const fallback = result.assignments.find((entry) => entry.piId === 'pi-z' && entry.shift === 'DS2');

  assert.ok(fallback);
  assert.equal(fallback.assignmentReason, 'fallback_proximity');
  assert.equal(fallback.assignedDate, '2026-03-15');
});

test('fractional fallback can relax to a five-day minimum gap for packing', () => {
  const result = runSchedulingEngine({
    ...buildBaseInput({
      shares: [
        {
          piId: 'pi-a',
          institutionId: 'inst-a',
          institutionAbbreviation: 'UGA',
          wholeShares: 1,
          fractionalShares: 0.25,
          isActive: true,
        },
      ],
      preferences: [
        { piId: 'pi-a', institutionId: 'inst-a', memberId: 'UGA', shareIndex: 1, shift: 'DS1', choice1Date: '2026-03-01', choice2Date: '2026-03-02' },
        { piId: 'pi-a', institutionId: 'inst-a', memberId: 'UGA', shareIndex: 1, shift: 'DS2', choice1Date: '2026-03-20', choice2Date: '2026-03-21' },
        { piId: 'pi-a', institutionId: 'inst-a', memberId: 'UGA', shareIndex: 1, shift: 'NS', choice1Date: '2026-03-27', choice2Date: '2026-03-28' },
      ],
      fractionalPreferences: [
        {
          piId: 'pi-a',
          institutionId: 'inst-a',
          memberId: 'UGA',
          fractionalHours: 6,
          choice1Date: '2026-03-04',
          choice2Date: '2026-03-05',
        },
      ],
      availableDates: [
        '2026-03-01',
        '2026-03-02',
        '2026-03-04',
        '2026-03-05',
        '2026-03-06',
        '2026-03-20',
        '2026-03-21',
        '2026-03-27',
        '2026-03-28',
      ],
      cycleDates: {
        startDate: '2026-03-01',
        endDate: '2026-03-28',
        blockedDates: [],
      },
      _cycleId: 'cycle-3',
      _abbrToPiId: { UGA: 'pi-a' },
      _abbrToInstitutionId: { UGA: 'inst-a' },
    }),
  });

  const fractional = result.assignments.find((entry) => entry.fractionalHours !== null);
  assert.ok(fractional);
  assert.equal(fractional.assignmentReason, 'auto_assigned');
  assert.equal(fractional.assignedDate, '2026-03-06');
});

test('no-preference ordering uses total institution deficit rather than DS1 only', () => {
  const result = runSchedulingEngine({
    ...buildBaseInput({
      shares: [
        {
          piId: 'pi-a',
          institutionId: 'inst-a',
          institutionAbbreviation: 'UGA',
          wholeShares: 1,
          fractionalShares: 0,
          isActive: true,
        },
        {
          piId: 'pi-b',
          institutionId: 'inst-b',
          institutionAbbreviation: 'NIH',
          wholeShares: 1,
          fractionalShares: 0,
          isActive: true,
        },
      ],
      preferences: [],
      fractionalPreferences: [],
      availableDates: [
        '2026-03-01',
        '2026-03-02',
        '2026-03-03',
        '2026-03-04',
        '2026-03-05',
        '2026-03-06',
      ],
      deficitHistory: [
        { institutionId: 'inst-a', shift: 'DS1', deficitScore: 5, cycleAge: 0 },
        { institutionId: 'inst-a', shift: 'DS2', deficitScore: 4, cycleAge: 0 },
        { institutionId: 'inst-a', shift: 'NS', deficitScore: 4, cycleAge: 0 },
        { institutionId: 'inst-b', shift: 'DS1', deficitScore: 6, cycleAge: 0 },
        { institutionId: 'inst-b', shift: 'DS2', deficitScore: -2, cycleAge: 0 },
        { institutionId: 'inst-b', shift: 'NS', deficitScore: -2, cycleAge: 0 },
      ],
      cycleDates: {
        startDate: '2026-03-01',
        endDate: '2026-03-06',
        blockedDates: [],
      },
      _cycleId: 'cycle-4',
    }),
  });

  const earliestDayShift = result.assignments
    .filter((entry) => entry.shift === 'DS1')
    .sort((left, right) => left.assignedDate.localeCompare(right.assignedDate))[0];

  assert.ok(earliestDayShift);
  assert.equal(earliestDayShift.memberId, 'UGA');
  assert.equal(earliestDayShift.assignmentReason, 'auto_assigned');
});
