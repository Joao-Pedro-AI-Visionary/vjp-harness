// agents.js (montagem de contexto/prompt) + bsd.js applyFiles (guarda anti path-traversal).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildContext, systemPrompt, DRY } from '../agents.js';
import { applyFiles } from '../bsd.js';

test('systemPrompt inclui papel, regras e memória do projeto', () => {
  const ctx = { rules: 'REGRA-X', gbrain: 'MEMORIA-Y', packed: '' };
  const s = systemPrompt('reviewer', ctx, 'faça isso', '{"ok":true}');
  assert.match(s, /REVIEWER/);
  assert.match(s, /REGRA-X/);
  assert.match(s, /MEMORIA-Y/);
  assert.match(s, /Responda SOMENTE com JSON/);
});

test('buildContext lê AGENT_RULES.md e .gbrain/*.md', () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'h-'));
  const p = fs.mkdtempSync(path.join(os.tmpdir(), 'p-'));
  fs.writeFileSync(path.join(h, 'AGENT_RULES.md'), 'minhas-regras');
  fs.mkdirSync(path.join(p, '.gbrain'), { recursive: true });
  fs.writeFileSync(path.join(p, '.gbrain', 'decisions.md'), 'minha-decisao');
  const ctx = buildContext(h, p);
  assert.match(ctx.rules, /minhas-regras/);
  assert.match(ctx.gbrain, /minha-decisao/);
});

test('DRY.executor devolve files com path relativo (mecânica do pipeline)', () => {
  const r = DRY.executor({ feature: 'foo' });
  assert.ok(Array.isArray(r.files) && r.files.length >= 1);
  assert.ok(typeof r.files[0].path === 'string');
});

test('DRY.reviewer aprova só se testPassed (espelha o gate)', () => {
  assert.equal(DRY.reviewer({ testPassed: true }).approved, true);
  assert.equal(DRY.reviewer({ testPassed: false }).approved, false);
});

test('applyFiles escreve dentro da worktree e retorna os caminhos', async () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
  const applied = await applyFiles(wt, [{ path: 'a/b.txt', content: 'oi' }]);
  assert.deepEqual(applied, ['a/b.txt']);
  assert.equal(fs.readFileSync(path.join(wt, 'a/b.txt'), 'utf8'), 'oi');
});

test('SEGURANÇA: applyFiles recusa path traversal (../)', async () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
  await assert.rejects(
    () => applyFiles(wt, [{ path: '../evil.txt', content: 'x' }]),
    /fora da worktree/,
  );
});
