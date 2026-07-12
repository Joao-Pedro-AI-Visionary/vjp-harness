#!/usr/bin/env node
/**
 * V-JP Harness: Aferidor de Confiança — analisador (Fase 3).
 * Lê history.jsonl, janela por task_class × model_id, e recomenda um nível pro Dial.
 * Demove (aperta) na regressão; promove (afrouxa) na evidência forte + zero intervenção.
 * Cold start / model_id novo -> conservador. Usa a sombra (Fase 4) quando disponível. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export function readRecords(historyPath) {
  let raw;
  try { raw = fs.readFileSync(historyPath, 'utf8'); } catch { return []; }
  const out = [];
  for (const line of raw.split('\n')) {
    const s = line.trim(); if (!s) continue;
    try { const o = JSON.parse(s); if (o && o.event === 'RUN_RECORD') out.push(o); } catch { /* ignora */ }
  }
  return out;
}

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export function recommendLevel({ records, taskClass, modelId = null, config }) {
  const N = config.windowSize ?? 20;
  const rel = records.filter((r) => r.task_class === taskClass && (!modelId || r.model_id === modelId));
  if (rel.length < N) return config.conservativeDefault;
  const win = rel.slice(-N);
  const last = win[win.length - 1];
  const baseline = Number.isInteger(last.level) ? last.level : config.conservativeDefault;
  const firstTryRate = mean(win.map((r) => (r.first_try_pass ? 1 : 0)));
  const humanIntervened = win.some((r) => r.human_intervened);
  const demote = config.demoteThreshold ?? 0.80;
  const promote = config.promoteThreshold ?? 0.90;
  const minShadow = config.minShadow ?? 5;

  if (firstTryRate < demote) return clamp(baseline + 1, 0, 3);

  const shadows = win.filter((r) => r.shadow_first_try_pass != null);
  const strong = shadows.length >= minShadow
    ? mean(shadows.map((r) => (r.shadow_first_try_pass ? 1 : 0))) >= promote
    : firstTryRate >= promote;
  if (strong && !humanIntervened) return clamp(baseline - 1, 0, 3);
  return baseline;
}

// ---- CLI (Art. II): node aferidor-analise.js --class <c> [--model <id>] [--history <path>] [--config <path>] [--json] ----
function main() {
  const argv = process.argv.slice(2);
  const get = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const taskClass = get('--class');
  if (!taskClass) { console.error('uso: node aferidor-analise.js --class <c> [--model <id>] [--history <path>] [--config <path>] [--json]'); process.exit(2); }
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const configPath = get('--config') || path.resolve(dir, '../config/dial.json');
  const historyPath = get('--history') || path.resolve(dir, '../../.bsd/history.jsonl');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const records = readRecords(historyPath);
  const modelId = get('--model');
  const recommended = recommendLevel({ records, taskClass, modelId, config });
  const n = records.filter((r) => r.task_class === taskClass && (!modelId || r.model_id === modelId)).length;
  const out = { taskClass, modelId: modelId || '(qualquer)', samples: n, windowSize: config.windowSize, recommended };
  console.log(argv.includes('--json') ? JSON.stringify(out, null, 2)
    : `classe=${taskClass} modelo=${out.modelId} amostras=${n} -> recomendado nível ${recommended}${n < (config.windowSize ?? 20) ? ' (cold start/conservador)' : ''}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
