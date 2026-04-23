import test from 'node:test';
import assert from 'node:assert/strict';

import { apiRoutes } from './api-route-config.js';
import { createApiRouter, handleCatchAllRequest } from './api-catch-all.js';

function createJsonResponseRecorder() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };
}

test('handleCatchAllRequest normalizes array paths and merges matched params into req.query', async () => {
  const sharesUploadHandler = async (req, res) => {
    res.status(200).json({ data: { path: req.query.path, extra: req.query.extra } });
  };
  const assignmentHandler = async (req, res) => {
    res.status(200).json({
      data: {
        id: req.query.id,
        assignmentId: req.query.assignmentId,
        extra: req.query.extra,
      },
    });
  };

  const handlers = Object.fromEntries(
    apiRoutes.map((route) => [route.handlerKey, async (req, res) => res.status(204).json(null)]),
  );
  handlers.sharesUpload = sharesUploadHandler;
  handlers.scheduleAssignment = assignmentHandler;

  const router = createApiRouter(handlers);

  const uploadReq = {
    method: 'POST',
    query: { path: ['shares', 'upload'], extra: 'keep-me' },
  };
  const uploadRes = createJsonResponseRecorder();

  await handleCatchAllRequest(router, uploadReq, uploadRes);

  assert.equal(uploadRes.statusCode, 200);
  assert.deepEqual(uploadRes.payload, {
    data: {
      path: ['shares', 'upload'],
      extra: 'keep-me',
    },
  });

  const assignmentReq = {
    method: 'PUT',
    query: {
      path: ['schedules', 'schedule-1', 'assignments', 'assignment-2'],
      extra: 'still-here',
    },
  };
  const assignmentRes = createJsonResponseRecorder();

  await handleCatchAllRequest(router, assignmentReq, assignmentRes);

  assert.equal(assignmentRes.statusCode, 200);
  assert.deepEqual(assignmentRes.payload, {
    data: {
      id: 'schedule-1',
      assignmentId: 'assignment-2',
      extra: 'still-here',
    },
  });
});

test('handleCatchAllRequest accepts string path values and returns the existing 404 shape for misses', async () => {
  const handlers = Object.fromEntries(
    apiRoutes.map((route) => [route.handlerKey, async (req, res) => res.status(204).json(null)]),
  );
  handlers.login = async (req, res) => {
    res.status(200).json({ data: { ok: req.method } });
  };

  const router = createApiRouter(handlers);

  const hitReq = {
    method: 'POST',
    query: { path: 'auth/login' },
  };
  const hitRes = createJsonResponseRecorder();

  await handleCatchAllRequest(router, hitReq, hitRes);

  assert.equal(hitRes.statusCode, 200);
  assert.deepEqual(hitRes.payload, { data: { ok: 'POST' } });

  const missReq = {
    method: 'GET',
    query: { path: ['does-not-exist'] },
  };
  const missRes = createJsonResponseRecorder();

  await handleCatchAllRequest(router, missReq, missRes);

  assert.equal(missRes.statusCode, 404);
  assert.deepEqual(missRes.payload, {
    error: 'API route not found: GET /api/does-not-exist',
    code: 'NOT_FOUND',
  });
});

test('createApiRouter throws when a configured route is missing its handler', () => {
  const handlers = Object.fromEntries(
    apiRoutes
      .filter((route) => route.handlerKey !== 'health')
      .map((route) => [route.handlerKey, async (req, res) => res.status(204).json(null)]),
  );

  assert.throws(() => createApiRouter(handlers), {
    message: /Missing handler for route "\/health"/,
  });
});
