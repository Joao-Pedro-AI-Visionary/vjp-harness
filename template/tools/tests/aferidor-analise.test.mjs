// aferidor-analise.js: recomendação de nível por janela (Fase 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { readRecords, recommendLevel } from '../aferidor-analise.js';

const cfg = { windowSize: 5, conservativeDefault: 3, demoteThreshold: 0.80, promoteThreshold: 0.90, minShadow: 5,
  pisos: { config: 0 } };

function rec(over = {}) {
  return { event: 'RUN_RECORD', model_id: 'm1', task_class: 'frontend', level: 2,
    first_try_pass: true, shadow_first_try_pass: null, human_intervened: false, ...over };
}

test('cold start (< janela) -> conservador', () => {
  const recs = [rec(), rec(), rec()];
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: cfg }), 3);
});

test('model_id novo -> conservador (reset): só vê os registros DELE', () => {
  const old = Array.from({ length: 5 }, () => rec({ model_id: 'm0', first_try_pass: true, level: 2 }));
  const neu = [rec({ model_id: 'm1' })];
  assert.equal(recommendLevel({ records: [...old, ...neu], taskClass: 'frontend', modelId: 'm1', config: cfg }), 3);
});

test('regressão (first_try < 80%) -> demove (aperta baseline+1)', () => {
  const recs = [rec({ first_try_pass: false }), rec({ first_try_pass: false }), rec({ first_try_pass: false }),
    rec({ first_try_pass: true }), rec({ first_try_pass: true, level: 2 })];
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: cfg }), 3);
});

test('evidência forte (≥90% first_try, 0 intervenção, sem sombra) -> promove (baseline-1)', () => {
  const recs = Array.from({ length: 5 }, () => rec({ first_try_pass: true, level: 2, human_intervened: false }));
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: cfg }), 1);
});

test('intervenção humana bloqueia promoção mesmo com sucesso', () => {
  const recs = Array.from({ length: 5 }, (_, i) => rec({ first_try_pass: true, level: 2, human_intervened: i === 0 }));
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: cfg }), 2);
});

test('zona morna (80–90%) -> mantém baseline', () => {
  const recs = [rec({ first_try_pass: false }), rec(), rec(), rec(), rec({ level: 2 })];
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: cfg }), 2);
});

test('sombra forte (Fase 4) promove mesmo com nível atual só ok', () => {
  const c2 = { ...cfg, minShadow: 3 };
  const recs = Array.from({ length: 5 }, () => rec({ first_try_pass: true, level: 2, shadow_first_try_pass: true }));
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: c2 }), 1);
});

test('readRecords ignora não-RUN_RECORD e linhas corrompidas', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-an-'));
  const h = path.join(d, 'history.jsonl');
  fs.writeFileSync(h, [
    JSON.stringify({ event: 'START_FEATURE' }),
    '{lixo corrompido',
    JSON.stringify({ event: 'RUN_RECORD', task_class: 'db' }),
  ].join('\n') + '\n');
  const r = readRecords(h);
  assert.equal(r.length, 1);
  assert.equal(r[0].task_class, 'db');
  assert.equal(readRecords(path.join(d, 'nao-existe.jsonl')).length, 0);
  fs.rmSync(d, { recursive: true, force: true });
});
