import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mapServerCommentsToMemberComments,
  mapServerSwapRequestsToShiftChangeRequests,
} from './server-bridge.js';

const members = [
  { id: 'UGA', _piUserId: 'pi-1' },
  { id: 'MIT', _piUserId: 'pi-2' },
];

test('mapServerCommentsToMemberComments groups comments by member and maps API status labels', () => {
  const result = mapServerCommentsToMemberComments([
    {
      id: 'comment-1',
      piId: 'pi-1',
      subject: 'Question',
      message: 'Need clarification',
      status: 'sent',
      createdAt: '2026-04-10T10:00:00Z',
      updatedAt: '2026-04-10T10:00:00Z',
      readAt: null,
      adminReply: null,
      adminReplyAt: null,
    },
    {
      id: 'comment-2',
      piId: 'pi-1',
      subject: 'Resolved',
      message: 'Thanks',
      status: 'replied',
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T11:00:00Z',
      readAt: '2026-04-11T10:30:00Z',
      adminReply: 'Reply sent',
      adminReplyAt: '2026-04-11T11:00:00Z',
    },
  ], members);

  assert.deepEqual(result.MIT, []);
  assert.equal(result.UGA.length, 2);
  assert.equal(result.UGA[0].id, 'comment-2');
  assert.equal(result.UGA[0].status, 'Replied');
  assert.equal(result.UGA[1].status, 'Sent');
});

test('mapServerSwapRequestsToShiftChangeRequests parses preferred dates and approved reassignment details', () => {
  const result = mapServerSwapRequestsToShiftChangeRequests([
    {
      id: 'swap-1',
      requesterId: 'pi-2',
      scheduleId: 'schedule-1',
      targetAssignmentId: 'assignment-1',
      preferredDates: '["2026-04-20","2026-04-22"]',
      status: 'approved',
      adminNotes: 'Open slot available',
      reviewedAt: '2026-04-13T12:00:00Z',
      createdAt: '2026-04-12T12:00:00Z',
      targetAssignment: {
        assignedDate: '2026-04-22',
        shift: 'NS',
      },
    },
  ], members);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    id: 'swap-1',
    memberId: 'MIT',
    sourceDate: '2026-04-22',
    sourceShift: 'NS',
    requestedDate: '2026-04-20',
    requestedShift: '',
    reason: '',
    status: 'Approved',
    createdAt: '2026-04-12T12:00:00Z',
    adminNote: 'Open slot available',
    reassignedDate: '2026-04-22',
    reassignedShift: 'NS',
    resolvedAt: '2026-04-13T12:00:00Z',
    _swapId: 'swap-1',
    _scheduleId: 'schedule-1',
    _targetAssignmentId: 'assignment-1',
  });
});
