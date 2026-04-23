import test from 'node:test';
import assert from 'node:assert/strict';

import { createRouter } from './router.js';

test('matches exact routes and extracts params', () => {
  const router = createRouter();
  const usersHandler = () => 'users';
  const userHandler = () => 'user';

  router.all('/users', usersHandler);
  router.all('/users/:id', userHandler);

  const collection = router.match('GET', '/users');
  assert.ok(collection);
  assert.equal(collection.handler, usersHandler);
  assert.deepEqual(collection.params, {});

  const single = router.match('PUT', '/users/123');
  assert.ok(single);
  assert.equal(single.handler, userHandler);
  assert.deepEqual(single.params, { id: '123' });
});

test('matches specific routes before parameterized routes when registered first', () => {
  const router = createRouter();
  const uploadHandler = () => 'upload';
  const shareHandler = () => 'share';

  router.all('/shares/upload', uploadHandler);
  router.all('/shares/:id', shareHandler);

  const matched = router.match('POST', '/shares/upload');
  assert.ok(matched);
  assert.equal(matched.handler, uploadHandler);
  assert.deepEqual(matched.params, {});
});

test('extracts nested params for multi-segment patterns', () => {
  const router = createRouter();
  const assignmentHandler = () => 'assignment';

  router.all('/schedules/:id/assignments/:assignmentId', assignmentHandler);

  const matched = router.match('PUT', '/schedules/schedule-7/assignments/assignment-22');
  assert.ok(matched);
  assert.equal(matched.handler, assignmentHandler);
  assert.deepEqual(matched.params, {
    id: 'schedule-7',
    assignmentId: 'assignment-22',
  });
});
