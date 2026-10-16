import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildPairs, compareAnswers, compareTexts, evaluateRules, ruleUnits } from '../rules-eval.js';
import { loadCore } from '../sync-rules.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(here, '../../../core');

test('com e sem a regra o prompt de usuário é o mesmo e o system muda', () => {
  const pairs = buildPairs([{ id: '10-principios.md', text: 'regra A' }]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].without.user, pairs[0].with.user);
  assert.equal(pairs[0].without.system, '');
  assert.equal(pairs[0].with.system, 'regra A');
  const diff = compareTexts(pairs[0].without.system, pairs[0].with.system);
  assert.equal(diff.identical, false);
  assert.equal(diff.deltaChars, 'regra A'.length);
});

test('respostas normalizam espaço antes de comparar', () => {
  assert.equal(compareAnswers('ok\n', 'ok').identical, true);
  assert.equal(compareAnswers('sim', 'não').identical, false);
});

test('core real: cada always-on entra no par e --llm fica desligado', async () => {
  const core = loadCore(coreDir);
  const units = ruleUnits(core);
  assert.ok(units.some((u) => u.id === '10-principios.md'));
  assert.ok(units.some((u) => u.id.startsWith('conditional:')));
  const report = await evaluateRules(core, { llm: false });
  assert.equal(report.llm, false);
  assert.equal(report.rows.length, units.length);
  assert.ok(report.rows.every((r) => r.promptIdentical === false && r.deltaChars > 0));
  assert.equal(JSON.stringify(report).includes('sk-'), false);
});
