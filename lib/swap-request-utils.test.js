import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePreferredDates,
  serializePreferredDates,
  isIsoDateString,
} from './swap-request-utils.js';

test('serializePreferredDates stores arrays as JSON strings', () => {
  assert.equal(
    serializePreferredDates(['2026-04-20', '2026-04-22']),
    '["2026-04-20","2026-04-22"]',
  );
  assert.equal(serializePreferredDates([]), null);
});

test('parsePreferredDates accepts JSON strings and arrays', () => {
  assert.deepEqual(parsePreferredDates('["2026-04-20"]'), ['2026-04-20']);
  assert.deepEqual(parsePreferredDates(['2026-04-21']), ['2026-04-21']);
  assert.deepEqual(parsePreferredDates(null), []);
});

test('isIsoDateString validates YYYY-MM-DD dates only', () => {
  assert.equal(isIsoDateString('2026-04-20'), true);
  assert.equal(isIsoDateString('04/20/2026'), false);
  assert.equal(isIsoDateString('2026-4-2'), false);
});
