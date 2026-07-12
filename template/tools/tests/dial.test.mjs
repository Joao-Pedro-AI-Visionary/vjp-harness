// dial.js: escolha de coreografia por risco × confiança (Fase 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectLevel, stageEnabled, describeLevel, loadDialConfig } from '../dial.js';

const cfg = {
  levels: { "0": "z", "1": "a", "2": "b", "3": "c" },
  conservativeDefault: 3,
  pisos: { prod: 3, migration: 3, db: 2, backend: 1, frontend: 1, config: 0 },
  stageMinLevel: { planner: 1, nfr: 3, contract: 2, researcher: 2 },
};

test('sem recomendado -> usa conservativeDefault (coreografia máxima)', () => {
  assert.equal(selectLevel({ taskClass: 'frontend', recommended: null, config: cfg }), 3);
  assert.equal(selectLevel({ taskClass: 'config', config: cfg }), 3);
});

test('piso nunca é rebaixado, mesmo com recomendado baixo', () => {
  assert.equal(selectLevel({ taskClass: 'prod', recommended: 0, config: cfg }), 3);
  assert.equal(selectLevel({ taskClass: 'db', recommended: 0, config: cfg }), 2);
  assert.equal(selectLevel({ taskClass: 'frontend', recommended: 0, config: cfg }), 1);
  assert.equal(selectLevel({ taskClass: 'config', recommended: 0, config: cfg }), 0);
});

test('recomendado ALTO empurra pra CIMA (baixa confiança = mais coreografia)', () => {
  assert.equal(selectLevel({ taskClass: 'config', recommended: 2, config: cfg }), 2);
});

test('clamp 0..3', () => {
  assert.equal(selectLevel({ taskClass: 'prod', recommended: 9, config: cfg }), 3);
  assert.equal(selectLevel({ taskClass: 'config', recommended: -5, config: cfg }), 0);
});

test('classe desconhecida cai no piso de config', () => {
  assert.equal(selectLevel({ taskClass: 'inexistente', recommended: 0, config: cfg }), 0);
});

test('stageEnabled respeita stageMinLevel', () => {
  assert.equal(stageEnabled(0, 'planner', cfg), false);
  assert.equal(stageEnabled(1, 'planner', cfg), true);
  assert.equal(stageEnabled(2, 'nfr', cfg), false);
  assert.equal(stageEnabled(3, 'nfr', cfg), true);
  assert.equal(stageEnabled(2, 'contract', cfg), true);
  assert.equal(stageEnabled(0, 'executor', cfg), true);
});

test('describeLevel devolve a descrição do nível', () => {
  assert.equal(describeLevel(2, cfg), 'b');
});

test('loadDialConfig lê o dial.json real do harness', () => {
  const real = loadDialConfig();
  assert.equal(real.conservativeDefault, 3);
  assert.equal(real.pisos.prod, 3);
});
