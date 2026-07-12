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
