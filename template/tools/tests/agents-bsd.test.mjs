// bsd.js applyFiles (guarda anti path-traversal). agents.js saiu na v2.2.0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyFiles } from '../bsd.js';

test('applyFiles escreve dentro da worktree e retorna os caminhos', async () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
  const applied = await applyFiles(wt, [{ path: 'a/b.txt', content: 'oi' }]);
  assert.deepEqual(applied, ['a/b.txt']);
  assert.equal(fs.readFileSync(path.join(wt, 'a/b.txt'), 'utf8'), 'oi');
});

test('SEGURANÇA: applyFiles recusa path traversal (../)', async () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
  await assert.rejects(
    () => applyFiles(wt, [{ path: '../evil.txt', content: 'x' }]),
    /fora da worktree/,
  );
});
