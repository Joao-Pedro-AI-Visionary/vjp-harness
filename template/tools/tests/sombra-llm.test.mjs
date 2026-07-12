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

// --- Falha de INFRA (rede/LLM fora) != falha do MODELO ---
// Achado ao rodar de verdade: 'fetch failed' virava passed:false, ou seja, uma queda de rede
// parecia "o modelo piorou" e ia poluir a medição do Aferidor. Spec §5: infra != sinal do modelo.
import { summarizeProbe as sp2 } from '../sombra-llm.js';

test('erro de infra vira passed:null (excluído do placar), não passed:false', () => {
  // null = "não medido" -> summarizeProbe ignora (filtra por typeof boolean)
  const r = sp2([{ id: 'a', passed: null, detail: 'erro na chamada' }, { id: 'b', passed: null }]);
  assert.equal(r.shadow_first_try_pass, null, 'tudo infra -> null (não mede)');
  assert.equal(r.n, 0);
});

test('mistura: infra ignorada, modelo julgado só no que respondeu', () => {
  const r = sp2([{ id: 'a', passed: true }, { id: 'b', passed: null }, { id: 'c', passed: true }]);
  assert.equal(r.shadow_first_try_pass, true, 'as 2 respondidas passaram -> pass');
  assert.equal(r.n, 2, 'a de infra não conta no placar');
});

// --- probeLlm ponta-a-ponta com IA falsa (chatFn injetado): prova a corrente inteira ---
import { probeLlm } from '../sombra-llm.js';
import path2 from 'node:path';

const HARNESS = path2.resolve(process.cwd(), '..');   // template/
const CANARY = { fixtures: [
  { id: 'f1', system: 's', user: 'u', expect: { task_class: 'migration' } },
  { id: 'f2', system: 's', user: 'u', expect: { risk: 'alto' } },
] };

test('probeLlm: IA acerta tudo -> shadow_first_try_pass=true', async () => {
  const fake = async ({ user }) => JSON.stringify({ task_class: 'migration', risk: 'alto' });
  const r = await probeLlm({ harnessDir: HARNESS, canary: CANARY, chatFn: fake });
  assert.equal(r.shadow_first_try_pass, true);
  assert.equal(r.n, 2);
});

test('probeLlm: IA erra -> pass=false (falha do MODELO conta)', async () => {
  const fake = async () => JSON.stringify({ task_class: 'frontend', risk: 'baixo' });
  const r = await probeLlm({ harnessDir: HARNESS, canary: CANARY, chatFn: fake });
  assert.equal(r.shadow_first_try_pass, false);
  assert.equal(r.n, 2);
});

test('probeLlm: IA responde lixo (não-JSON) -> falha do MODELO (respondeu, mas mal)', async () => {
  const fake = async () => 'desculpa, não sei responder';
  const r = await probeLlm({ harnessDir: HARNESS, canary: CANARY, chatFn: fake });
  assert.equal(r.shadow_first_try_pass, false);
  assert.equal(r.n, 2);
});

test('probeLlm: REDE CAIU -> null e n=0 (infra NÃO polui a medição)', async () => {
  const fake = async () => { throw new Error('fetch failed'); };
  const r = await probeLlm({ harnessDir: HARNESS, canary: CANARY, chatFn: fake });
  assert.equal(r.shadow_first_try_pass, null, 'rede fora nunca vira "modelo piorou"');
  assert.equal(r.n, 0);
  assert.match(r.skipped, /LLM\/rede fora/);
});

test('probeLlm: respeita maxFixtures (Art. LLM10 — teto de consumo)', async () => {
  let calls = 0;
  const fake = async () => { calls++; return JSON.stringify({ task_class: 'migration', risk: 'alto' }); };
  await probeLlm({ harnessDir: HARNESS, canary: CANARY, chatFn: fake, maxFixtures: 1 });
  assert.equal(calls, 1, 'não pode chamar a IA além do teto');
});
