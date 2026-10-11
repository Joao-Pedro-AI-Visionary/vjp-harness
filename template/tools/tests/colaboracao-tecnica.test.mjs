// Diretrizes de colaboração técnica (core/11): a regra global e sua frase-sentinela chegam a TODAS as saídas
// (Codex/AGY/Cursor via AGENTS.md, Claude Code via @imports + HARNESS.md global, GEMINI.md global).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCore, renderBundle, planProject, planGlobal, applyOps } from '../sync-rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..', '..');
const IN_REPO = fs.existsSync(path.join(REPO, 'core/manifest.json')) && fs.existsSync(path.join(REPO, 'machine/export'));
const CORE = IN_REPO ? path.join(REPO, 'core') : path.resolve(__dirname, '..', '..', 'core');
const onlyRepo = { skip: IN_REPO ? false : 'só no repo vjp-harness' };
const core = loadCore(CORE);
const SENT = 'Sentinela colaboração: discordar só com fundamento, apontar a falha real e nunca inventar problema.';
const TITLE = '# Diretrizes de colaboração técnica (do João)';
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), `vjp-colab-${p}-`));
const has = (txt, where) => { assert.ok(txt.includes(SENT), `sentinela ausente em ${where}`); assert.ok(txt.includes(TITLE), `título ausente em ${where}`); };

test('core/11 é always-on e o bundle traz a sentinela de colaboração sem estourar 24.000 bytes', () => {
  assert.ok(core.manifest.alwaysOn.includes('11-comportamento-e-tom.md'));
  const b = renderBundle(core);
  has(b, 'bundle');
  assert.ok(Buffer.byteLength(b) <= 24000);
  assert.equal(b.split(SENT).length - 1, 1, 'regra aparece uma vez só (sem duplicar)');
});

test('espelhos versionados (machine/export AGENTS.md e HARNESS.md) trazem a regra', onlyRepo, () => {
  for (const f of ['AGENTS.md', 'HARNESS.md']) has(fs.readFileSync(path.join(REPO, 'machine/export', f), 'utf8'), f);
});

test('projeto: AGENTS.md (Codex/AGY/Cursor) e CLAUDE.md (@import de core/11) carregam a regra', onlyRepo, () => {
  const d = tmp('proj');
  applyOps(planProject(core, d, { repoRoot: REPO }));
  has(fs.readFileSync(path.join(d, 'AGENTS.md'), 'utf8'), 'AGENTS.md');
  const claude = fs.readFileSync(path.join(d, 'CLAUDE.md'), 'utf8');
  assert.ok(/^@\.harness\/core\/11-comportamento-e-tom\.md$/m.test(claude), 'CLAUDE.md importa core/11');
  has(fs.readFileSync(path.join(d, '.harness/core/11-comportamento-e-tom.md'), 'utf8'), 'CLAUDE.md→core/11');
});

test('global: ~/.codex/AGENTS.md, ~/.gemini/GEMINI.md (AGY) e ~/.claude/HARNESS.md carregam a regra', onlyRepo, () => {
  const home = tmp('home');
  applyOps(planGlobal(core, REPO, home));
  for (const f of ['.codex/AGENTS.md', '.gemini/GEMINI.md', '.claude/HARNESS.md']) has(fs.readFileSync(path.join(home, f), 'utf8'), f);
});

test('nuance preservada: discordar com fundamento, sem inventar problema, e respeitar trade-off legítimo', () => {
  const t = core.modules.find((m) => m.rel === '11-comportamento-e-tom.md').text;
  for (const f of ['Não concorde por reflexo', 'sem inventar discordância', 'não é verdade absoluta', 'sem inventar defeitos', 'Não mude conclusão factual só por insistência']) assert.ok(t.includes(f), f);
});
