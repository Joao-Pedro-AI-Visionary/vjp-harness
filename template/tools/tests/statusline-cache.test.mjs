import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { formatStatus, cacheLabel } = require('../../../machine/export/statusline-context.js');

const NOW = 1_700_000_000;

test('contagem regressiva usa expires_at em segundos e o ttl oficial', () => {
  assert.equal(cacheLabel({ ttl: '1h', warm: true, expires_at: NOW + 90 }, NOW), 'cache 1h 1:30');
  assert.equal(cacheLabel({ ttl: '5m', warm: true, expires_at: NOW + 5 }, NOW), 'cache 5m 0:05');
});

test('cache frio quando warm é false ou o prazo zerou', () => {
  assert.equal(cacheLabel({ ttl: '1h', warm: false, expires_at: NOW + 100 }, NOW), 'cache 1h frio');
  assert.equal(cacheLabel({ ttl: '1h', warm: true, expires_at: NOW - 1 }, NOW), 'cache 1h frio');
});

test('sem prompt_cache não inventa contagem', () => {
  assert.equal(cacheLabel(undefined, NOW), '');
  assert.equal(cacheLabel({ ttl: '1h', warm: true, expires_at: null }, NOW), '');
  const line = formatStatus({ model: { display_name: 'Opus' }, workspace: { current_dir: '/tmp/proj' } }, NOW);
  assert.equal(line.includes('cache'), false);
  assert.match(line, /Opus/);
  assert.match(line, /proj/);
});

test('a linha inclui a contagem quando o CLI manda prompt_cache', () => {
  const line = formatStatus({
    model: { display_name: 'Opus' },
    prompt_cache: { ttl: '1h', warm: true, expires_at: NOW + 3661 },
  }, NOW);
  assert.match(line, /cache 1h 61:01/);
});
