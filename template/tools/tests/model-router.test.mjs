import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  applyModels,
  checkAgentSources,
  claudeModel,
  codexModel,
  cursorModel,
  phaseOfAgent,
  readFrontmatter,
  renderCodexAgent,
  renderCursorAgent,
  wantsCache1h,
  AGY_MODEL,
  AGENTS_SRC,
} from '../model-router.js';

test('planner e reviewer em opus; executor e researcher em sonnet', () => {
  for (const id of ['planner', 'reviewer', 'nfr-planner', 'nfr-performance-planner', 'integration-verifier']) {
    assert.equal(claudeModel(id), 'opus', id);
  }
  for (const id of ['researcher', 'executor', 'executor:backend', 'backend-specialist', 'frontend-specialist', 'db-migration-specialist']) {
    assert.equal(claudeModel(id), 'sonnet', id);
  }
  assert.equal(phaseOfAgent('contract'), null);
  assert.equal(claudeModel('contract'), null);
});

test('cache de 1h só em quem espera teste/build', () => {
  for (const id of ['executor', 'backend-specialist', 'frontend-specialist', 'db-migration-specialist', 'integration-verifier']) {
    assert.equal(wantsCache1h(id), true, id);
  }
  for (const id of ['planner', 'reviewer', 'researcher', 'nfr-performance-planner']) {
    assert.equal(wantsCache1h(id), false, id);
  }
});

test('fontmatter versionado bate com a tabela e não cita fable', () => {
  const errors = checkAgentSources();
  assert.deepEqual(errors, []);
  const blob = fs.readdirSync(AGENTS_SRC).filter((f) => f.endsWith('.md')).map((f) => fs.readFileSync(path.join(AGENTS_SRC, f), 'utf8')).join('\n');
  assert.equal(/fable/i.test(blob), false);
});

test('Cursor e Codex recebem o par documentado da fase', () => {
  assert.equal(cursorModel('planner'), 'claude-opus-5-5');
  assert.equal(cursorModel('executor'), 'claude-sonnet-5-5');
  assert.deepEqual(codexModel('reviewer'), { model: 'gpt-6.1-sol', model_reasoning_effort: 'medium' });
  assert.deepEqual(codexModel('researcher'), { model: 'gpt-6-luna', model_reasoning_effort: 'high' });
  assert.equal(AGY_MODEL.applied, false);
  assert.equal(AGY_MODEL.default, 'gemini');
});

test('render Cursor não leva cacheTtl; Codex leva model e effort', () => {
  const md = fs.readFileSync(path.join(AGENTS_SRC, 'executor.md'), 'utf8');
  const cursor = renderCursorAgent(md);
  assert.match(cursor, /"claude-sonnet-5-5"/);
  assert.equal(cursor.includes('cacheTtl'), false);
  assert.equal(cursor.includes('experimental'), false);
  const codex = renderCodexAgent(md);
  assert.match(codex, /model = "gpt-6-luna"/);
  assert.match(codex, /model_reasoning_effort = "high"/);
  assert.equal(codex.includes('cacheTtl'), false);
});

test('apply grava as três CLIs e o Claude conserva o cache de 1h', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-models-'));
  const written = applyModels(root);
  assert.ok(written.length >= 9 * 3);
  const execClaude = fs.readFileSync(path.join(root, '.claude', 'agents', 'executor.md'), 'utf8');
  const fm = readFrontmatter(execClaude);
  assert.equal(fm.fields.model, 'sonnet');
  assert.equal(fm.fields.experimental.cacheTtl, '1h');
  const planCursor = fs.readFileSync(path.join(root, '.cursor', 'agents', 'planner.md'), 'utf8');
  assert.match(planCursor, /claude-opus-5-5/);
  assert.equal(planCursor.includes('cacheTtl'), false);
  const revCodex = fs.readFileSync(path.join(root, '.codex', 'agents', 'reviewer.toml'), 'utf8');
  assert.match(revCodex, /model = "gpt-6\.1-sol"/);
  assert.equal(fs.existsSync(path.join(root, '.gemini')), false);
});

