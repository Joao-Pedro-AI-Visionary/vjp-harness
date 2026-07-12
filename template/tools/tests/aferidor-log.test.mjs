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
