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
