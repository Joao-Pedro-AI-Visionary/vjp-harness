// gbrain-decision.js: captura nativa de decisão — append idempotente em decisions.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendDecision, formatDecision, resolveDecisionsFile } from '../gbrain-decision.js';

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbrain-dec-'));
  return path.join(dir, 'nested', 'decisions.md');
}

test('cria arquivo + header e registra a 1ª decisão com formato V-JP', () => {
  const file = tmpFile();
  const r = appendDecision({ what: 'Adotar X', alt: 'Y', why: 'Z', date: '2026-06-28' }, file);
  assert.equal(r.appended, true);
  const c = fs.readFileSync(file, 'utf8');
  assert.match(c, /# 🧠 Decisions/);
  assert.match(c, /## 2026-06-28 — Adotar X/);
  assert.match(c, /\*\*Alternativa descartada:\*\* Y/);
  assert.match(c, /\*\*Porquê:\*\* Z/);
});

test('idempotência: mesma decisão+data não duplica', () => {
  const file = tmpFile();
  appendDecision({ what: 'Adotar X', alt: 'a', why: 'b', date: '2026-06-28' }, file);
  const r2 = appendDecision({ what: 'Adotar X', alt: 'c', why: 'd', date: '2026-06-28' }, file);
  assert.equal(r2.appended, false);
  const n = (fs.readFileSync(file, 'utf8').match(/## 2026-06-28 — Adotar X/g) || []).length;
  assert.equal(n, 1);
});

test('decisão distinta é adicionada', () => {
  const file = tmpFile();
  appendDecision({ what: 'Um', alt: 'a', why: 'b', date: '2026-06-28' }, file);
  const r = appendDecision({ what: 'Dois', alt: 'a', why: 'b', date: '2026-06-28' }, file);
  assert.equal(r.appended, true);
  assert.match(fs.readFileSync(file, 'utf8'), /## 2026-06-28 — Dois/);
});

test('"o quê" vazio lança erro (obrigatório)', () => {
  assert.throws(() => appendDecision({ what: '', alt: 'a', why: 'b' }, tmpFile()), /obrigatório/);
});

test('formatDecision usa "—" quando alt/why ausentes', () => {
  const b = formatDecision({ what: 'X', date: '2026-01-01' });
  assert.match(b, /\*\*Alternativa descartada:\*\* —/);
  assert.match(b, /\*\*Porquê:\*\* —/);
});

test('resolveDecisionsFile respeita env override', () => {
  assert.equal(resolveDecisionsFile({ GBRAIN_DECISIONS_FILE: '/x/y.md' }), '/x/y.md');
});
