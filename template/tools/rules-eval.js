#!/usr/bin/env node
/**
 * Eval opt-in das regras de core/. NÃO roda na instalação, no --doctor nem no npm test.
 *
 * Sem --llm: monta o mesmo prompt de usuário com e sem o texto de cada regra always-on
 * (e cada conditionalRule) e compara o system prompt (delta de caracteres). Não chama API.
 * Com --llm: chama tools/llm.js duas vezes por regra e compara as respostas. Exige
 * VJP_LLM_* / config/agents.json. Gasta cota. Use --only <id> para uma regra.
 *
 *   node template/tools/rules-eval.js
 *   node template/tools/sync-rules.js --eval
 *   node template/tools/sync-rules.js --eval --llm --only 10-principios.md
 */
import fs from 'fs';
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
  const out = { llm: false, json: false, only: null, core: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--llm') out.llm = true;
    else if (k === '--json') out.json = true;
    else if (k === '--only') out.only = argv[++i];
    else if (k === '--core') out.core = argv[++i];
    else if (k === '--help' || k === '-h') out.help = true;
    else throw new Error(`opção desconhecida: ${k}`);
  }
  return out;
}

async function answerPair(pair, cfg) {
  const { chat } = await import('./llm.js');
  const without = await chat({ system: pair.without.system, user: pair.without.user, cfg, agentId: 'planner' });
  const withRule = await chat({ system: pair.with.system, user: pair.with.user, cfg, agentId: 'planner' });
  return compareAnswers(without, withRule);
}

export async function evaluateRules(core, { llm = false, only = null, cfg = null } = {}) {
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
    if (llm) {
      const answers = await answerPair(pair, cfg);
      row.answerIdentical = answers.identical;
      row.answerDeltaChars = answers.deltaChars;
    }
    rows.push(row);
  }
  return {
    llm,
    prompt: PROBE_USER,
    note: llm
      ? 'respostas comparadas via llm.js; valores de API não são impressos'
      : 'só o system prompt foi comparado. Passe --llm para comparar respostas (opt-in, gasta API).',
    rows,
  };
}

export async function main(argv = process.argv.slice(2), scriptDir = path.dirname(fileURLToPath(import.meta.url))) {
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error(`✗ ${e.message}`); return 2; }
  if (args.help) {
    console.log('rules-eval.js [--json] [--llm] [--only <id>] [--core <dir>]\nOpt-in. Sem --llm não chama modelo.');
    return 0;
  }
  try {
    const lay = detectLayout(scriptDir, { core: args.core });
    if (!lay.coreDir) throw new Error('não achei core/ (use --core)');
    let cfg = null;
    if (args.llm) {
      const { loadLlmConfig } = await import('./llm.js');
      const harnessDir = lay.repoRoot ? path.join(lay.repoRoot, 'template') : path.resolve(scriptDir, '..');
      if (!fs.existsSync(path.join(harnessDir, 'config', 'agents.json'))) {
        throw new Error(`config/agents.json ausente em ${harnessDir}`);
      }
      cfg = loadLlmConfig(harnessDir);
    }
    const report = await evaluateRules(loadCore(lay.coreDir), { llm: args.llm, only: args.only, cfg });
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`eval de regras — ${report.note}`);
      for (const r of report.rows) {
        const ans = report.llm ? `  respostas ${r.answerIdentical ? 'iguais' : 'diferentes'}` : '';
        console.log(`${r.id}  prompt ${r.promptIdentical ? 'igual' : `+${r.deltaChars} chars`}${ans}`);
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
