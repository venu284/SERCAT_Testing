import test from 'node:test';
import assert from 'node:assert/strict';

import { mapPreferencesToMock } from './data-mappers.js';

test('mapPreferencesToMock groups whole and fractional preferences into the shift-only member model', () => {
  const members = [
    {
      id: 'UGA',
      name: 'University of Georgia',
      shares: 1.25,
      status: 'ACTIVE',
      _piUserId: 'pi-a',
    },
  ];

  const apiPayload = {
    preferences: [
      {
        piId: 'pi-a',
        institutionId: 'inst-a',
        shareIndex: 1,
        shift: 'DS1',
        choice1Date: '2026-03-10',
        choice2Date: '2026-03-11',
      },
      {
        piId: 'pi-a',
        institutionId: 'inst-a',
        shareIndex: 1,
        shift: 'DS2',
        choice1Date: '2026-03-17',
        choice2Date: '2026-03-18',
      },
      {
        piId: 'pi-a',
        institutionId: 'inst-a',
        shareIndex: 1,
        shift: 'NS',
        choice1Date: '2026-03-24',
        choice2Date: '2026-03-25',
      },
    ],
    fractionalPreferences: [
      {
        piId: 'pi-a',
        institutionId: 'inst-a',
        blockIndex: 1,
        fractionalHours: 6,
        choice1Date: '2026-03-31',
        choice2Date: '2026-04-01',
      },
    ],
    submissions: [
      {
        piId: 'pi-a',
        submittedAt: '2026-02-01T00:00:00Z',
      },
    ],
  };

  const result = mapPreferencesToMock(apiPayload, members);

  assert.deepEqual(result.UGA.wholeShare, [
    { shareIndex: 1, shift: 'DS1', choice1Date: '2026-03-10', choice2Date: '2026-03-11' },
    { shareIndex: 1, shift: 'DS2', choice1Date: '2026-03-17', choice2Date: '2026-03-18' },
    { shareIndex: 1, shift: 'NS', choice1Date: '2026-03-24', choice2Date: '2026-03-25' },
  ]);
  assert.deepEqual(result.UGA.fractionalPreferences, [
    { blockIndex: 1, fractionalHours: 6, choice1Date: '2026-03-31', choice2Date: '2026-04-01' },
  ]);
  assert.equal(result.UGA.submitted, true);
});
