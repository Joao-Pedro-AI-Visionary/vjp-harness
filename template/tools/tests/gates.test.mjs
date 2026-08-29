// gates.js: "definição de pronto" consolidada (Fase 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { checkSpecPresent, checkAdrPresent, checkOpenOutputs, checkDeterminism } from '../gates.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-gates-')); }

test('checkSpecPresent: green se spec.md existe, red se não', () => {
  const d = tmp();
  assert.equal(checkSpecPresent(d), 'red');
  fs.writeFileSync(path.join(d, 'spec.md'), '# spec');
  assert.equal(checkSpecPresent(d), 'green');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkAdrPresent: green só se arquivo existe e não-vazio', () => {
  const d = tmp();
  const adr = path.join(d, 'decisions.md');
  assert.equal(checkAdrPresent(adr), 'red');
  fs.writeFileSync(adr, '');
  assert.equal(checkAdrPresent(adr), 'red');
  fs.writeFileSync(adr, '## D1');
  assert.equal(checkAdrPresent(adr), 'green');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkOpenOutputs: green só quando spec.md E decisions.md existem', () => {
  const d = tmp();
  const adr = path.join(d, 'decisions.md');
  assert.equal(checkOpenOutputs(d, adr), 'red');
  fs.writeFileSync(path.join(d, 'spec.md'), '# spec');
  assert.equal(checkOpenOutputs(d, adr), 'red');
  fs.writeFileSync(adr, '## D1');
  assert.equal(checkOpenOutputs(d, adr), 'green');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkDeterminism: green quando não há required em falha', () => {
  const okReg = { harnessVersion: '9.9.9', components: [
    { id: 'a', name: 'A', tier: 'core', priority: 1, required: true,
      verify: { type: 'command', cmd: 'node --version', expect: 'v' } },
  ] };
  assert.equal(checkDeterminism(okReg), 'green');
  const badReg = { harnessVersion: '9.9.9', components: [
    { id: 'b', name: 'B', tier: 'core', priority: 1, required: true,
      verify: { type: 'file', path: 'missing/x.xyz' } },
  ] };
  assert.equal(checkDeterminism(badReg), 'red');
});

import { evaluateGates, ENFORCED_GATES } from '../gates.js';

test('evaluateGates: passed=true só com os 4 enforced green; externos ficam unknown', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-gates-eg-'));
  const adr = path.join(d, 'decisions.md');
  fs.writeFileSync(path.join(d, 'spec.md'), '# spec');
  fs.writeFileSync(adr, '## D1');
  const okReg = { harnessVersion: '9.9.9', components: [
    { id: 'a', name: 'A', tier: 'core', priority: 1, required: true,
      verify: { type: 'command', cmd: 'node --version', expect: 'v' } },
  ] };
  const { passed, gates } = evaluateGates({ featureDir: d, gbrainDecisionsPath: adr, registry: okReg });
  assert.equal(passed, true);
  assert.equal(gates['saida-aberta'], 'green');
  assert.equal(gates['prova-viva'], 'unknown');
  fs.rmSync(d, { recursive: true, force: true });
});

test('evaluateGates: passed=false se um enforced (adr) falta, mesmo externos ignorados', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-gates-eg2-'));
  fs.writeFileSync(path.join(d, 'spec.md'), '# spec');
  const adr = path.join(d, 'decisions.md');
  const { passed } = evaluateGates({ featureDir: d, gbrainDecisionsPath: adr, registry: { harnessVersion: '9', components: [] } });
  assert.equal(passed, false);
  fs.rmSync(d, { recursive: true, force: true });
});

test('ENFORCED_GATES tem exatamente os 4 verificáveis da Fase 1', () => {
  assert.deepEqual([...ENFORCED_GATES].sort(),
    ['adr-presente', 'determinismo', 'saida-aberta', 'spec-presente']);
});

// ---- Portão prova-viva (v1.19.0): sinal do test-gate com carimbo de commit ----
import { checkProvaViva } from '../gates.js';

function provaFile(dir, obj) {
  const p = path.join(dir, 'prova-viva.json');
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return p;
}

test('checkProvaViva: ausente => unknown (infra ausente não polui a medição)', () => {
  const d = tmp();
  assert.equal(checkProvaViva(path.join(d, 'prova-viva.json'), { headCommit: 'abc123' }), 'unknown');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkProvaViva: JSON inválido => unknown (não é prova de falha)', () => {
  const d = tmp();
  const p = provaFile(d, '{ isso não é json');
  assert.equal(checkProvaViva(p, { headCommit: 'abc123' }), 'unknown');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkProvaViva: result fail => red mesmo com o commit certo', () => {
  const d = tmp();
  const p = provaFile(d, { result: 'fail', commit: 'abc123', command: 'npm test' });
  assert.equal(checkProvaViva(p, { headCommit: 'abc123' }), 'red');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkProvaViva: verde de OUTRO commit => red (sinal velho não prova o código atual)', () => {
  const d = tmp();
  const p = provaFile(d, { result: 'pass', commit: 'aaaaaaa', command: 'npm test' });
  assert.equal(checkProvaViva(p, { headCommit: 'bbbbbbb' }), 'red');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkProvaViva: pass + commit igual ao HEAD => green', () => {
  const d = tmp();
  const p = provaFile(d, { result: 'pass', commit: 'abc123', command: 'npx jest x.spec.ts' });
  assert.equal(checkProvaViva(p, { headCommit: 'abc123' }), 'green');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkProvaViva: sem campo commit OU HEAD irresolvível => unknown (frescura não provável)', () => {
  const d = tmp();
  const semCommit = provaFile(d, { result: 'pass', command: 'npm test' });
  assert.equal(checkProvaViva(semCommit, { headCommit: 'abc123' }), 'unknown');
  const comCommit = provaFile(d, { result: 'pass', commit: 'abc123' });
  assert.equal(checkProvaViva(comCommit, { headCommit: null }), 'unknown');
  fs.rmSync(d, { recursive: true, force: true });
});

test('evaluateGates: provaVivaPath fiado reflete no portão, sem entrar em ENFORCED_GATES', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-gates-pv-'));
  const adr = path.join(d, 'decisions.md');
  fs.writeFileSync(path.join(d, 'spec.md'), '# spec');
  fs.writeFileSync(adr, '## D1');
  const okReg = { harnessVersion: '9.9.9', components: [
    { id: 'a', name: 'A', tier: 'core', priority: 1, required: true,
      verify: { type: 'command', cmd: 'node --version', expect: 'v' } },
  ] };
  const pv = provaFile(d, { result: 'pass', commit: 'deadbee' });
  const verde = evaluateGates({ featureDir: d, gbrainDecisionsPath: adr, registry: okReg,
    provaVivaPath: pv, headCommit: 'deadbee' });
  assert.equal(verde.gates['prova-viva'], 'green');

  // sinal velho vira red — mas NÃO derruba o passed (portão não é enforced)
  const velho = evaluateGates({ featureDir: d, gbrainDecisionsPath: adr, registry: okReg,
    provaVivaPath: pv, headCommit: 'outro01' });
  assert.equal(velho.gates['prova-viva'], 'red');
  assert.equal(velho.passed, true, 'prova-viva avisa, não barra (não está em ENFORCED_GATES)');
  fs.rmSync(d, { recursive: true, force: true });
});
