// sombra.js: probe sombra + conjunto-canário (Fase 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadowLevelFor, aggregateShadow, runCanaryProbe, dialConsistencyRunner, loadCanary } from '../sombra.js';

const cfg = {
  levels: { "0": "z", "1": "a", "2": "b", "3": "c" }, conservativeDefault: 3,
  pisos: { prod: 3, migration: 3, db: 2, backend: 1, frontend: 1, config: 0 },
  stageMinLevel: { planner: 1, nfr: 3, contract: 2, researcher: 2 },
};

test('shadowLevelFor: um degrau mais frouxo, respeitando o piso', () => {
  assert.equal(shadowLevelFor(2, 'frontend', cfg), 1); // piso 1
  assert.equal(shadowLevelFor(1, 'frontend', cfg), null); // já no piso -> sem sombra
  assert.equal(shadowLevelFor(3, 'prod', cfg), null);    // piso 3 -> sem espaço
  assert.equal(shadowLevelFor(2, 'config', cfg), 1);
});

test('aggregateShadow: só true se TODAS passaram; ignora não-booleanos', () => {
  assert.deepEqual(aggregateShadow([{ passed: true }, { passed: true }]), { shadow_first_try_pass: true, rate: 1, n: 2 });
  assert.deepEqual(aggregateShadow([{ passed: true }, { passed: false }]), { shadow_first_try_pass: false, rate: 0.5, n: 2 });
  assert.deepEqual(aggregateShadow([]), { shadow_first_try_pass: null, rate: null, n: 0 });
  assert.deepEqual(aggregateShadow([{ passed: null }]), { shadow_first_try_pass: null, rate: null, n: 0 });
});

test('dialConsistencyRunner: passa quando o Dial bate o fixture dourado', () => {
  const runner = dialConsistencyRunner(cfg);
  assert.equal(runner({ taskClass: 'frontend', recommended: 0, expectLevel: 1, expectStages: { planner: true, nfr: false, contract: false, researcher: false } }).passed, true);
  assert.equal(runner({ taskClass: 'config', recommended: 0, expectLevel: 0, expectStages: { planner: false, nfr: false, contract: false, researcher: false } }).passed, true);
});

test('dialConsistencyRunner: falha se o esperado não bate (detecta quebra do Dial)', () => {
  const runner = dialConsistencyRunner(cfg);
  assert.equal(runner({ taskClass: 'config', recommended: 0, expectLevel: 3, expectStages: {} }).passed, false);
  assert.equal(runner({ taskClass: 'frontend', recommended: 0, expectLevel: 1, expectStages: { nfr: true } }).passed, false);
});

test('runCanaryProbe: agrega o resultado do runner sobre os fixtures', () => {
  const canary = { fixtures: [
    { taskClass: 'frontend', recommended: 0, expectLevel: 1, expectStages: { planner: true, nfr: false, contract: false, researcher: false } },
    { taskClass: 'config', recommended: 0, expectLevel: 0, expectStages: { planner: false, nfr: false, contract: false, researcher: false } },
  ] };
  const agg = runCanaryProbe({ canary, runner: dialConsistencyRunner(cfg) });
  assert.equal(agg.shadow_first_try_pass, true);
  assert.equal(agg.n, 2);
});

test('loadCanary lê o canary.json real (>= 3 fixtures)', () => {
  const c = loadCanary();
  assert.ok(Array.isArray(c.fixtures) && c.fixtures.length >= 3);
});
