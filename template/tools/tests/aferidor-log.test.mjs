// aferidor-log.js: camada de dados do Aferidor de Confiança (Fase 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTaskClass } from '../aferidor-log.js';

test('migração vence tudo (precedência do mais crítico)', () => {
  assert.equal(classifyTaskClass(['prisma/migrations/001/migration.sql']), 'migration');
});

test('caminho de deploy/prod vira prod', () => {
  assert.equal(classifyTaskClass(['infra/prod/deploy.yaml']), 'prod');
});

test('repository/entity/sql viram db', () => {
  assert.equal(classifyTaskClass(['src/user.repository.ts']), 'db');
});

test('.tsx / web / frontend viram frontend', () => {
  assert.equal(classifyTaskClass(['web/components/Card.tsx']), 'frontend');
});

test('.ts de backend/api vira backend', () => {
  assert.equal(classifyTaskClass(['backend/api/user.service.ts']), 'backend');
});

test('sem match conhecido cai em config', () => {
  assert.equal(classifyTaskClass(['README.md']), 'config');
  assert.equal(classifyTaskClass([]), 'config');
});

import { buildRunRecord } from '../aferidor-log.js';

const baseInput = {
  now: '2026-07-11T14:00:00.000Z',
  modelId: 'claude-opus-4-8',
  taskClass: 'frontend',
  level: 0,
  gates: { 'spec-presente': 'green', 'saida-aberta': 'green' },
};

test('first_try_pass=true quando retries=0 e todos os portões green', () => {
  const r = buildRunRecord({ ...baseInput, retries: 0 });
  assert.equal(r.first_try_pass, true);
  assert.equal(r.event, 'RUN_RECORD');
  assert.equal(r.model_id, 'claude-opus-4-8');
  assert.equal(r.task_class, 'frontend');
  assert.equal(r.ts, '2026-07-11T14:00:00.000Z');
});

test('first_try_pass=false com retries>0 mesmo tudo green', () => {
  const r = buildRunRecord({ ...baseInput, retries: 1 });
  assert.equal(r.first_try_pass, false);
});

test('first_try_pass=false se algum portão não é green (unknown ≠ green)', () => {
  const r = buildRunRecord({ ...baseInput, gates: { 'spec-presente': 'green', 'prova-viva': 'unknown' } });
  assert.equal(r.first_try_pass, false);
});

test('defaults: shadow_level null, human_intervened false, tokens null', () => {
  const r = buildRunRecord(baseInput);
  assert.equal(r.shadow_level, null);
  assert.equal(r.human_intervened, false);
  assert.equal(r.tokens, null);
});

import { appendRunRecord } from '../aferidor-log.js';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

test('appendRunRecord grava uma linha JSONL e retorna o record', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-aferidor-'));
  const hist = path.join(dir, 'history.jsonl');
  const rec = { event: 'RUN_RECORD', model_id: 'x', first_try_pass: true };
  const out = appendRunRecord(hist, rec);
  const lines = fs.readFileSync(hist, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), rec);
  assert.deepEqual(out, rec);
  fs.rmSync(dir, { recursive: true, force: true });
});

// Integração: dado gates + contexto, montamos e persistimos um RUN_RECORD íntegro.
test('fluxo emit: buildRunRecord + appendRunRecord produzem JSONL parseável e coerente', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-emit-'));
  const hist = path.join(dir, 'history.jsonl');
  const rec = buildRunRecord({
    now: '2026-07-11T15:00:00.000Z',
    modelId: process.env.VJP_MODEL_ID || 'unknown',
    taskClass: classifyTaskClass(['web/App.tsx']),
    level: 0,
    gates: { 'spec-presente': 'green', 'adr-presente': 'green', 'saida-aberta': 'green', 'determinismo': 'green' },
  });
  appendRunRecord(hist, rec);
  const parsed = JSON.parse(fs.readFileSync(hist, 'utf8').trim());
  assert.equal(parsed.event, 'RUN_RECORD');
  assert.equal(parsed.task_class, 'frontend');
  assert.equal(parsed.first_try_pass, true);
  fs.rmSync(dir, { recursive: true, force: true });
});
