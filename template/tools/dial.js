#!/usr/bin/env node
/**
 * V-JP Harness: Dial de Rigor (Fase 2).
 * Escolhe QUANTO rigor por (risco da classe × confiança medida).
 * nível = clamp(max(piso_da_classe, recomendado), 0, 3). MAIOR = MAIS rigor.
 * Piso nunca é rebaixado (segurança). recomendado=null -> conservativeDefault. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function defaultConfigPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../config/dial.json');
}

export function loadDialConfig(configPath) {
  return JSON.parse(fs.readFileSync(configPath || defaultConfigPath(), 'utf8'));
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// nível efetivo. recomendado null/undefined -> conservativeDefault (rigor máximo, sem confiança).
export function selectLevel({ taskClass, recommended = null, config }) {
  const piso = config.pisos[taskClass] ?? config.pisos.config ?? 0;
  const rec = (recommended == null) ? config.conservativeDefault : recommended;
  return clamp(Math.max(piso, rec), 0, 3);
}

// Um estágio upfront roda se o nível atinge o mínimo configurado; estágio sem limiar roda sempre.
export function stageEnabled(level, stage, config) {
  const min = config.stageMinLevel[stage];
  return min == null ? true : level >= min;
}

export function describeLevel(level, config) {
  return config.levels[String(level)] || `nível ${level}`;
}

// ---- CLI (Art. II): node dial.js --class <classe> [--recommended <0-3>] [--config <path>] [--json] ----
function main() {
  const argv = process.argv.slice(2);
  const get = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const taskClass = get('--class');
  if (!taskClass) { console.error('uso: node dial.js --class <classe> [--recommended <0-3>] [--config <path>] [--json]'); process.exit(2); }
  const config = loadDialConfig(get('--config'));
  const recommended = get('--recommended') != null ? Number(get('--recommended')) : null;
  const level = selectLevel({ taskClass, recommended, config });
  const out = {
    taskClass, recommended, level, description: describeLevel(level, config),
    stages: Object.fromEntries(Object.keys(config.stageMinLevel).map((s) => [s, stageEnabled(level, s, config)])),
  };
  console.log(argv.includes('--json') ? JSON.stringify(out, null, 2)
    : `classe=${taskClass} recomendado=${recommended == null ? '(conservador)' : recommended} -> nível ${level} (${out.description})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
