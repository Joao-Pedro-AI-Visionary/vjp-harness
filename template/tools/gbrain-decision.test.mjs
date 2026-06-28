#!/usr/bin/env node
/**
 * Prova viva (V-JP) do gbrain-decision: append real em arquivo temporário,
 * assere criação, formato e IDEMPOTÊNCIA. Sem mock. Roda com: node gbrain-decision.test.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert';
import { appendDecision, formatDecision, resolveDecisionsFile } from './gbrain-decision.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gbrain-dec-'));
const file = path.join(tmp, 'nested', 'decisions.md');
let failures = 0;
const check = (name, fn) => { try { fn(); console.log(`  ✔ ${name}`); } catch (e) { failures++; console.error(`  ✗ ${name}\n    ${e.message}`); } };

console.log('== gbrain-decision: prova viva ==');

check('cria arquivo + header e registra 1ª decisão', () => {
  const r = appendDecision({ what: 'Adotar codebase-memory-mcp', alt: 'Substituir Repomix+RTK', why: 'Complementa, não substitui', date: '2026-06-28' }, file);
  assert.strictEqual(r.appended, true);
  const c = fs.readFileSync(file, 'utf8');
  assert.ok(c.includes('# 🧠 Decisions'), 'header ausente');
  assert.ok(c.includes('## 2026-06-28 — Adotar codebase-memory-mcp'), 'título ausente');
  assert.ok(c.includes('**Alternativa descartada:** Substituir Repomix+RTK'), 'alternativa ausente');
  assert.ok(c.includes('**Porquê:** Complementa, não substitui'), 'porquê ausente');
});

check('idempotência: mesma decisão+data não duplica', () => {
  const r = appendDecision({ what: 'Adotar codebase-memory-mcp', alt: 'x', why: 'y', date: '2026-06-28' }, file);
  assert.strictEqual(r.appended, false, 'deveria ser idempotente');
  const c = fs.readFileSync(file, 'utf8');
  const n = (c.match(/## 2026-06-28 — Adotar codebase-memory-mcp/g) || []).length;
  assert.strictEqual(n, 1, `esperava 1 ocorrência, achei ${n}`);
});

check('segunda decisão distinta é adicionada', () => {
  const r = appendDecision({ what: 'Rejeitar agentmemory', alt: 'Vendorizar', why: 'Não-determinístico', date: '2026-06-28' }, file);
  assert.strictEqual(r.appended, true);
  const c = fs.readFileSync(file, 'utf8');
  assert.ok(c.includes('## 2026-06-28 — Rejeitar agentmemory'));
});

check('"o quê" vazio lança erro', () => {
  assert.throws(() => appendDecision({ what: '', alt: 'a', why: 'b' }, file), /obrigatório/);
});

check('formatDecision usa — quando alt/why ausentes', () => {
  const b = formatDecision({ what: 'X', date: '2026-01-01' });
  assert.ok(b.includes('**Alternativa descartada:** —'));
  assert.ok(b.includes('**Porquê:** —'));
});

check('resolveDecisionsFile respeita env override', () => {
  assert.strictEqual(resolveDecisionsFile({ GBRAIN_DECISIONS_FILE: '/x/y.md' }), '/x/y.md');
});

fs.rmSync(tmp, { recursive: true, force: true });
if (failures) { console.error(`\n✗ ${failures} teste(s) falharam`); process.exit(1); }
console.log('\n✔ Todos os testes passaram');
