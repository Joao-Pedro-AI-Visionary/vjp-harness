// verify.js: avaliação determinística do registry (sem spawnar processo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRegistry } from '../verify.js';

const fakeReg = {
  harnessVersion: '9.9.9',
  components: [
    { id: 'req-ok', name: 'ReqOK', tier: 'core', priority: 1, required: true,
      verify: { type: 'command', cmd: 'node --version', expect: 'v' } },
    { id: 'req-missing', name: 'ReqMissing', tier: 'core', priority: 2, required: true,
      verify: { type: 'file', path: 'definitely/missing/file.xyz' } },
    { id: 'opt-missing', name: 'OptMissing', tier: 'mcp', priority: 3, required: false,
      verify: { type: 'file', path: 'also/missing.xyz' } },
    { id: 'removed-old', name: 'Removed', tier: 'mcp', priority: 4, required: false, removed: true,
      verify: { type: 'file', path: 'whatever' } },
  ],
};

test('obrigatório ausente → fail não-vazio (montagem não-determinística)', () => {
  const r = evaluateRegistry(fakeReg, { strict: false });
  assert.ok(r.fail.length >= 1);
  assert.ok(r.fail.some((f) => f.id === 'req-missing'), 'req-missing deveria estar em fail');
});

test('opcional ausente NÃO bloqueia em modo normal', () => {
  const r = evaluateRegistry(fakeReg, { strict: false });
  assert.ok(!r.fail.some((f) => f.id === 'opt-missing'), 'opcional não pode bloquear');
});

test('--strict: opcional ausente TAMBÉM vira fail', () => {
  const r = evaluateRegistry(fakeReg, { strict: true });
  assert.ok(r.fail.some((f) => f.id === 'opt-missing'), 'strict deve pegar opcional');
});

test('componente `removed` é ignorado (não aparece em rows)', () => {
  const r = evaluateRegistry(fakeReg);
  assert.ok(!r.rows.some((x) => x.id === 'removed-old'), 'removed não pode ser verificado');
});

test('harnessVersion é propagado para a saída', () => {
  assert.equal(evaluateRegistry(fakeReg).harnessVersion, '9.9.9');
});

test('componente que passa (node --version) fica status ok', () => {
  const r = evaluateRegistry(fakeReg);
  const ok = r.rows.find((x) => x.id === 'req-ok');
  assert.equal(ok.status, 'ok');
});
