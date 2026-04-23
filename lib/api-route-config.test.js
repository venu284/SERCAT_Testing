import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { apiRoutes } from './api-route-config.js';

function listHandlerFiles(rootDir) {
  const files = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath.replaceAll('\\', '/'));
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

test('apiRoutes maps every non-cron handler file exactly once', () => {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const handlerRoot = path.join(repoRoot, 'api-handlers');
  const handlerFiles = listHandlerFiles(handlerRoot)
    .map((file) => path.relative(repoRoot, file).replaceAll('\\', '/'))
    .filter((file) => file !== 'api-handlers/cron/send-reminders.js');

  const catalogFiles = apiRoutes.map((route) => route.handlerFile).sort();

  assert.equal(new Set(catalogFiles).size, catalogFiles.length);
  assert.deepEqual(catalogFiles, handlerFiles);
});

test('apiRoutes exposes ordered route metadata for the catch-all', () => {
  assert.ok(apiRoutes.length > 0);

  for (const route of apiRoutes) {
    assert.equal(typeof route.pattern, 'string');
    assert.ok(route.pattern.startsWith('/'));
    assert.equal(typeof route.handlerKey, 'string');
    assert.equal(typeof route.handlerFile, 'string');
    assert.ok(route.handlerFile.startsWith('api-handlers/'));
  }
});
