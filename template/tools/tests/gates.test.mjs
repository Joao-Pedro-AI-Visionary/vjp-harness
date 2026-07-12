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
