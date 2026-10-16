#!/usr/bin/env node
/**
 * Eval opt-in das regras de core/. NÃO roda na instalação, no --doctor nem no npm test.
 *
 * Monta o mesmo prompt de usuário com e sem o texto de cada regra always-on
 * (e cada conditionalRule) e compara o system prompt (delta de caracteres). Não chama API.
 * (O modo --llm saiu na v2.2.0 junto com a camada LLM própria.) Use --only <id> para uma regra.
 *
 *   node template/tools/rules-eval.js
 *   node template/tools/sync-rules.js --eval
 *   node template/tools/sync-rules.js --eval --only 10-principios.md
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { detectLayout, loadCore } from './sync-rules.js';

export const PROBE_USER = 'Responda em uma frase: qual é a primeira ação antes de escrever código de produção?';

export function ruleUnits(core) {
  const units = core.modules.map((m) => ({ id: m.rel, text: m.text }));
  for (const rule of core.manifest.conditionalRules || []) {
    units.push({ id: `conditional:${rule.id}`, text: String(rule.body || '') });
  }
  return units;
}

export function buildPairs(units, user = PROBE_USER) {
  return units.map((u) => ({
    id: u.id,
    without: { system: '', user },
    with: { system: u.text, user },
  }));
}

export function compareTexts(a, b) {
  const left = String(a ?? '');
  const right = String(b ?? '');
  return {
    identical: left === right,
    withoutChars: left.length,
    withChars: right.length,
    deltaChars: right.length - left.length,
  };
}

export function compareAnswers(a, b) {
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  return compareTexts(norm(a), norm(b));
}

function parseArgs(argv) {
  const out = { json: false, only: null, core: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--json') out.json = true;
    else if (k === '--only') out.only = argv[++i];
    else if (k === '--core') out.core = argv[++i];
    else if (k === '--help' || k === '-h') out.help = true;
    else throw new Error(`opção desconhecida: ${k}`);
  }
  return out;
}

export async function evaluateRules(core, { only = null } = {}) {
  let units = ruleUnits(core);
  if (only) {
    units = units.filter((u) => u.id === only);
    if (!units.length) throw new Error(`regra não encontrada: ${only}`);
  }
  const pairs = buildPairs(units);
  const rows = [];
  for (const pair of pairs) {
    const prompt = compareTexts(pair.without.system, pair.with.system);
    const row = { id: pair.id, promptIdentical: prompt.identical, deltaChars: prompt.deltaChars };
    rows.push(row);
  }
  return {
    prompt: PROBE_USER,
    note: 'só o system prompt foi comparado (sem chamada de modelo).',
    rows,
  };
}

export async function main(argv = process.argv.slice(2), scriptDir = path.dirname(fileURLToPath(import.meta.url))) {
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error(`✗ ${e.message}`); return 2; }
  if (args.help) {
    console.log('rules-eval.js [--json] [--only <id>] [--core <dir>]\nOpt-in. Não chama modelo.');
    return 0;
  }
  try {
    const lay = detectLayout(scriptDir, { core: args.core });
    if (!lay.coreDir) throw new Error('não achei core/ (use --core)');
    const report = await evaluateRules(loadCore(lay.coreDir), { only: args.only });
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`eval de regras — ${report.note}`);
      for (const r of report.rows) {
        console.log(`${r.id}  prompt ${r.promptIdentical ? 'igual' : `+${r.deltaChars} chars`}`);
      }
    }
    return 0;
  } catch (e) {
    console.error(`✗ rules-eval: ${e.message}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; });
}
