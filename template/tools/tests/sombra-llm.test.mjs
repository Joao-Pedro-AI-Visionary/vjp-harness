// sombra-llm.js: runner LLM do probe sombra — mede o MODELO (não o Dial).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeFixture, shouldSample, summarizeProbe, loadCanaryLlm } from '../sombra-llm.js';

test('judgeFixture: acerto exato -> passed', () => {
  const fx = { id: 'x', expect: { task_class: 'migration' } };
  assert.equal(judgeFixture(fx, { task_class: 'migration' }).passed, true);
});

test('judgeFixture: normaliza caixa e espaços (não pune formatação)', () => {
  const fx = { id: 'x', expect: { task_class: 'migration' } };
  assert.equal(judgeFixture(fx, { task_class: '  MIGRATION ' }).passed, true);
  assert.equal(judgeFixture({ id: 'y', expect: { method: 'GET' } }, { method: 'get' }).passed, true);
});

test('judgeFixture: resposta errada -> não passa (com detalhe)', () => {
  const fx = { id: 'x', expect: { task_class: 'migration' } };
  const r = judgeFixture(fx, { task_class: 'frontend' });
  assert.equal(r.passed, false);
  assert.match(r.detail, /esperado.*migration.*obtido.*frontend/i);
});

test('judgeFixture: resposta nula/ilegível -> não passa (nunca passa por omissão)', () => {
  const fx = { id: 'x', expect: { task_class: 'migration' } };
  assert.equal(judgeFixture(fx, null).passed, false);
  assert.equal(judgeFixture(fx, undefined).passed, false);
  assert.equal(judgeFixture(fx, 'texto solto').passed, false);
});

test('judgeFixture: campo faltando -> não passa', () => {
  const fx = { id: 'x', expect: { method: 'GET', path: '/users/:id' } };
  assert.equal(judgeFixture(fx, { method: 'GET' }).passed, false);
});

test('judgeFixture: campo EXTRA não reprova (só o gabarito importa)', () => {
  const fx = { id: 'x', expect: { method: 'GET' } };
  assert.equal(judgeFixture(fx, { method: 'GET', extra: 'ignorado' }).passed, true);
});

test('shouldSample: amostragem DETERMINÍSTICA a cada N (sem Math.random)', () => {
  assert.equal(shouldSample(0, 5), true);    // 1ª medição
  assert.equal(shouldSample(1, 5), false);
  assert.equal(shouldSample(4, 5), false);
  assert.equal(shouldSample(5, 5), true);    // a cada 5
  assert.equal(shouldSample(10, 5), true);
});

test('shouldSample: N<=1 -> sempre; N inválido -> nunca (fail-safe: não gasta token)', () => {
  assert.equal(shouldSample(3, 1), true);
  assert.equal(shouldSample(3, 0), false);
  assert.equal(shouldSample(3, null), false);
});

test('summarizeProbe: pass só se TODAS passaram; vazio/erro -> null (≠ pass)', () => {
  assert.equal(summarizeProbe([{ passed: true }, { passed: true }]).shadow_first_try_pass, true);
  assert.equal(summarizeProbe([{ passed: true }, { passed: false }]).shadow_first_try_pass, false);
  assert.equal(summarizeProbe([]).shadow_first_try_pass, null);
  assert.equal(summarizeProbe(null).shadow_first_try_pass, null);
});

test('loadCanaryLlm: lê o canário real (>=3 fixtures, todas com expect)', () => {
  const c = loadCanaryLlm();
  assert.ok(c.fixtures.length >= 3);
  for (const f of c.fixtures) { assert.ok(f.expect); assert.ok(f.user); }
});
