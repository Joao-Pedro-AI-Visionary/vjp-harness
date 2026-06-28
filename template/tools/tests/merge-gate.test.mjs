// Afirmação CENTRAL do BSD (gate por sinal concreto, padrão Janitor/Bernstein):
// teste verde manda; a aprovação do LLM NUNCA sobrepõe um teste falho.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeGate } from '../bsd.js';

test('merge: teste verde + Reviewer aprova → MERGE', () => {
  assert.equal(mergeGate(true, true), true);
});

test('REGRESSÃO: LLM aprova MAS teste falha → NÃO merge (claim central)', () => {
  assert.equal(mergeGate(false, true), false);
});

test('teste verde mas Reviewer reprova → NÃO merge', () => {
  assert.equal(mergeGate(true, false), false);
});

test('ambos falham → NÃO merge', () => {
  assert.equal(mergeGate(false, false), false);
});

test('coerção: valores truthy/falsy se comportam como booleanos', () => {
  assert.equal(mergeGate(1, 'ok'), true);
  assert.equal(mergeGate(0, 'ok'), false);
  assert.equal(mergeGate(true, null), false);
  assert.equal(mergeGate(true, undefined), false);
});
