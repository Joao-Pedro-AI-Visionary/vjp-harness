#!/usr/bin/env node
/**
 * V-JP Harness: orçamento mecânico de testes (anti-loop Codex).
 * Corta write-test→fail→fix-test. Contador em .bsd/test-budget.json.
 * Stop-continue NÃO zera — só --reset explícito (ou task_id novo).
 * Teto absoluto 2/2. Liga com VJP_CODEX=1 ou VJP_TEST_BUDGET=1. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDialConfig, selectLevel } from './dial.js';

export const HARD_CAP = Object.freeze({ max_runs: 2, max_edits: 2 });
export const DENIED = 3;

function defaultConfigPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../config/dial.json');
}

export function budgetEnabled(env = process.env, config = {}) {
  if (env.VJP_CODEX === '1' || env.VJP_TEST_BUDGET === '1' || env.VJP_TEST_BUDGET === 'true') return true;
  return config.testBudget?.enabledByDefault === true;
}

function clampCap(n, hard) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(hard, Math.floor(v));
}

export function limitsForLevel(config, level) {
  const tb = config.testBudget || {};
  const row = tb.byLevel?.[String(level)] || tb.codexProfile || { max_runs: 1, max_edits: 1 };
  return {
    max_runs: clampCap(row.max_runs, HARD_CAP.max_runs),
    max_edits: clampCap(row.max_edits, HARD_CAP.max_edits),
    prefer_fix_production: tb.codexProfile?.prefer_fix_production !== false,
  };
}

export function resolveLimits({ config, level = null, env = process.env } = {}) {
  const cfg = config || {};
  // Codex sem nível explícito: perfil 1/1. Com --class/--level, obedece byLevel (Dial 3 → 2/2).
  if (level == null && env.VJP_CODEX === '1') {
    const p = cfg.testBudget?.codexProfile || { max_runs: 1, max_edits: 1 };
    return {
      max_runs: clampCap(p.max_runs, HARD_CAP.max_runs),
      max_edits: clampCap(p.max_edits, HARD_CAP.max_edits),
      prefer_fix_production: p.prefer_fix_production !== false,
    };
  }
  const lvl = level == null ? (cfg.conservativeDefault ?? 3) : level;
  return limitsForLevel(cfg, lvl);
}

export function statePath(root) {
  return path.join(root, '.bsd', 'test-budget.json');
}

export function emptyState({ task_id, max_runs, max_edits }) {
  return { runs: 0, edits: 0, task_id: task_id || 'default', max_runs, max_edits };
}

export function loadState(root, limits, taskId) {
  const p = statePath(root);
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { raw = null; }
  if (!raw || typeof raw !== 'object') return emptyState({ task_id: taskId, ...limits });
  // task_id novo = outra tarefa. Stop-continue reusa o mesmo id e NÃO zera.
  if (taskId && raw.task_id && raw.task_id !== taskId) {
    return emptyState({ task_id: taskId, ...limits });
  }
  return {
    runs: Math.max(0, Number(raw.runs) || 0),
    edits: Math.max(0, Number(raw.edits) || 0),
    task_id: taskId || raw.task_id || 'default',
    max_runs: limits.max_runs,
    max_edits: limits.max_edits,
  };
}

export function saveState(root, state) {
  const dir = path.join(root, '.bsd');
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    runs: state.runs,
    edits: state.edits,
    task_id: state.task_id,
    max_runs: state.max_runs,
    max_edits: state.max_edits,
  };
  fs.writeFileSync(statePath(root), JSON.stringify(out, null, 2) + '\n');
  return out;
}

export function snapshot(state, { enabled, enforced, prefer_fix_production }) {
  const runs_exhausted = enforced && state.runs >= state.max_runs;
  const edits_exhausted = enforced && state.edits >= state.max_edits;
  const both_zero = enforced && state.max_runs === 0 && state.max_edits === 0;
  const exhausted = both_zero || (runs_exhausted && edits_exhausted);
  return {
    enabled,
    enforced,
    exhausted,
    runs_exhausted,
    edits_exhausted,
    runs: state.runs,
    edits: state.edits,
    max_runs: state.max_runs,
    max_edits: state.max_edits,
    remaining_runs: enforced ? Math.max(0, state.max_runs - state.runs) : null,
    remaining_edits: enforced ? Math.max(0, state.max_edits - state.edits) : null,
    task_id: state.task_id,
    prefer_fix_production,
    status: !enforced ? 'off' : exhausted ? 'ESGOTADO' : (runs_exhausted || edits_exhausted) ? 'PARCIAL' : 'ok',
  };
}

export function consume(state, kind) {
  const key = kind === 'edit' ? 'edits' : 'runs';
  const maxKey = kind === 'edit' ? 'max_edits' : 'max_runs';
  if (state[key] >= state[maxKey]) {
    return { ok: false, reason: 'ESGOTADO', kind, state };
  }
  const next = { ...state, [key]: state[key] + 1 };
  return { ok: true, kind, state: next };
}

function printOut(obj, asJson) {
  console.log(asJson ? JSON.stringify(obj, null, 2) : human(obj));
}

function human(obj) {
  if (obj.denied) return `ESGOTADO: ${obj.kind} ${obj[obj.kind === 'edit' ? 'edits' : 'runs']}/${obj[obj.kind === 'edit' ? 'max_edits' : 'max_runs']} (task=${obj.task_id})`;
  const flag = obj.enforced ? obj.status : 'off';
  return `test-budget ${flag} runs=${obj.runs}/${obj.max_runs} edits=${obj.edits}/${obj.max_edits} task=${obj.task_id}`;
}

export function runCli(argv, env = process.env) {
  const get = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const asJson = argv.includes('--json');
  const action = argv.includes('--reset') ? 'reset'
    : argv.includes('--consume-run') ? 'consume-run'
    : argv.includes('--consume-edit') ? 'consume-edit'
    : argv.includes('--status') ? 'status'
    : null;
  if (!action) {
    console.error('uso: node test-budget.js --status|--consume-run|--consume-edit|--reset [--class <c>] [--level 0-3] [--task-id <id>] [--root <dir>] [--json]');
    return 2;
  }

  const config = loadDialConfig(get('--config') || defaultConfigPath());
  const enabled = budgetEnabled(env, config);
  const taskClass = get('--class');
  const levelArg = get('--level');
  let level = levelArg != null ? Number(levelArg) : null;
  if (level == null && taskClass) {
    const recommended = get('--recommended') != null ? Number(get('--recommended')) : null;
    level = selectLevel({ taskClass, recommended, config });
  }
  const limits = resolveLimits({ config, level, env });
  const root = path.resolve(get('--root') || process.cwd());
  const taskId = get('--task-id') || env.VJP_TASK_ID || 'default';

  if (action === 'reset') {
    const state = saveState(root, emptyState({ task_id: taskId, ...limits }));
    printOut(snapshot(state, { enabled, enforced: enabled, prefer_fix_production: limits.prefer_fix_production }), asJson);
    return 0;
  }

  if (!enabled) {
    const state = { ...emptyState({ task_id: taskId, max_runs: limits.max_runs, max_edits: limits.max_edits }), ...limits };
    printOut(snapshot(state, { enabled: false, enforced: false, prefer_fix_production: limits.prefer_fix_production }), asJson);
    return 0;
  }

  let state = loadState(root, limits, taskId);

  if (action === 'status') {
    printOut(snapshot(state, { enabled, enforced: true, prefer_fix_production: limits.prefer_fix_production }), asJson);
    return 0;
  }

  const kind = action === 'consume-edit' ? 'edit' : 'run';
  const result = consume(state, kind);
  if (!result.ok) {
    const snap = snapshot(result.state, { enabled, enforced: true, prefer_fix_production: limits.prefer_fix_production });
    printOut({ ...snap, denied: true, kind }, asJson);
    return DENIED;
  }
  saveState(root, result.state);
  printOut(snapshot(result.state, { enabled, enforced: true, prefer_fix_production: limits.prefer_fix_production }), asJson);
  return 0;
}

function main() {
  process.exit(runCli(process.argv.slice(2), process.env));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
