// test-budget.js: teto mecânico de runs/edits (anti-loop Codex).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  budgetEnabled, resolveLimits, limitsForLevel, consume, loadState, saveState,
  emptyState, HARD_CAP, DENIED, runCli,
} from '../test-budget.js';
import { loadDialConfig } from '../dial.js';

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-budget.js');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-tbudget-')); }

const cfg = loadDialConfig();

test('dial.json tem testBudget Codex 1/1 e byLevel 0..3', () => {
  assert.equal(cfg.testBudget.enabledByDefault, false);
  assert.deepEqual(cfg.testBudget.codexProfile, {
    max_runs: 1, max_edits: 1, prefer_fix_production: true,
  });
  assert.deepEqual(cfg.testBudget.byLevel['0'], { max_runs: 0, max_edits: 0 });
  assert.deepEqual(cfg.testBudget.byLevel['1'], { max_runs: 1, max_edits: 1 });
  assert.deepEqual(cfg.testBudget.byLevel['2'], { max_runs: 2, max_edits: 1 });
  assert.deepEqual(cfg.testBudget.byLevel['3'], { max_runs: 2, max_edits: 2 });
});

test('budgetEnabled só com env ou enabledByDefault', () => {
  assert.equal(budgetEnabled({}, cfg), false);
  assert.equal(budgetEnabled({ VJP_CODEX: '1' }, cfg), true);
  assert.equal(budgetEnabled({ VJP_TEST_BUDGET: '1' }, cfg), true);
  assert.equal(budgetEnabled({}, { testBudget: { enabledByDefault: true } }), true);
});

test('Codex sem nível usa perfil 1/1; Dial 3 nunca passa de 2/2', () => {
  const c = resolveLimits({ config: cfg, level: null, env: { VJP_CODEX: '1' } });
  assert.equal(c.max_runs, 1);
  assert.equal(c.max_edits, 1);
  const d3 = limitsForLevel(cfg, 3);
  assert.equal(d3.max_runs, 2);
  assert.equal(d3.max_edits, 2);
  assert.equal(HARD_CAP.max_runs, 2);
});

test('consume recusa o segundo run no teto 1', () => {
  let s = emptyState({ task_id: 't', max_runs: 1, max_edits: 1 });
  const a = consume(s, 'run');
  assert.equal(a.ok, true);
  const b = consume(a.state, 'run');
  assert.equal(b.ok, false);
  assert.equal(b.reason, 'ESGOTADO');
});

test('stop-continue (mesmo task_id) não zera o contador', () => {
  const root = tmp();
  const limits = { max_runs: 1, max_edits: 1 };
  saveState(root, { runs: 1, edits: 0, task_id: 'same', ...limits });
  const again = loadState(root, limits, 'same');
  assert.equal(again.runs, 1);
  const other = loadState(root, limits, 'other');
  assert.equal(other.runs, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('CLI: VJP_CODEX=1 VJP_TEST_BUDGET=1 — segundo --consume-run sai 3', () => {
  const root = tmp();
  const env = { ...process.env, VJP_CODEX: '1', VJP_TEST_BUDGET: '1' };
  const args = ['--consume-run', '--root', root, '--json'];
  assert.equal(runCli(args, env), 0);
  assert.equal(runCli(args, env), DENIED);
  const disk = JSON.parse(fs.readFileSync(path.join(root, '.bsd', 'test-budget.json'), 'utf8'));
  assert.equal(disk.runs, 1);
  assert.equal(disk.max_runs, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('CLI subprocess: segundo consume-run denega (aceitação)', () => {
  const root = tmp();
  const env = { ...process.env, VJP_CODEX: '1', VJP_TEST_BUDGET: '1' };
  const first = spawnSync(process.execPath, [TOOL, '--consume-run', '--root', root, '--json'], { env, encoding: 'utf8' });
  const second = spawnSync(process.execPath, [TOOL, '--consume-run', '--root', root, '--json'], { env, encoding: 'utf8' });
  assert.equal(first.status, 0);
  assert.equal(second.status, DENIED);
  assert.match(second.stdout, /ESGOTADO|denied/i);
  fs.rmSync(root, { recursive: true, force: true });
});

test('stop-typecheck.sh nunca chama --reset no test-budget', () => {
  const hook = fs.readFileSync(new URL('../../../machine/hooks/stop-typecheck.sh', import.meta.url), 'utf8');
  assert.equal(/test-budget\.js\b[^\n]*--reset/.test(hook), false);
  assert.match(hook, /NÃO chama --reset|test-budget intacto|não toca no test-budget/i);
});

test('--reset é explícito; sem ele o estado persiste', () => {
  const root = tmp();
  const env = { ...process.env, VJP_CODEX: '1' };
  assert.equal(runCli(['--consume-run', '--root', root], env), 0);
  assert.equal(runCli(['--status', '--root', root, '--json'], env), 0);
  const st = JSON.parse(fs.readFileSync(path.join(root, '.bsd', 'test-budget.json'), 'utf8'));
  assert.equal(st.runs, 1);
  assert.equal(runCli(['--reset', '--root', root], env), 0);
  const after = JSON.parse(fs.readFileSync(path.join(root, '.bsd', 'test-budget.json'), 'utf8'));
  assert.equal(after.runs, 0);
  fs.rmSync(root, { recursive: true, force: true });
});
