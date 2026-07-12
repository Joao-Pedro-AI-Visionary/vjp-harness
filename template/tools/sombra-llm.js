#!/usr/bin/env node
/**
 * V-JP Harness: Sombra de Verdade — runner LLM (mede o MODELO, não o Dial).
 * A IA resolve tarefas douradas; um JUIZ DETERMINÍSTICO (código, não IA) compara com o gabarito.
 * O resultado vira shadow_first_try_pass, que o Aferidor usa pra promover.
 *
 * Constituição: Art. LLM05 — NUNCA executar/eval código gerado pela IA (por isso as tarefas
 * pedem saída ESTRUTURADA, não código). Art. LLM10 — consumo limitado (amostragem + maxFixtures).
 * Sem LLM/rede -> null (null ≠ pass: nunca "passa" por omissão). — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadLlmConfig, chat, extractJson } from './llm.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));

export function loadCanaryLlm(canaryPath) {
  const p = canaryPath || path.resolve(DIR, '../config/canary-llm.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function norm(v) { return String(v ?? '').trim().toLowerCase(); }

// Juiz DETERMINÍSTICO: compara a resposta com o gabarito. Não é IA julgando IA.
// Só os campos do gabarito importam (campo extra não reprova). Resposta ilegível -> não passa.
export function judgeFixture(fixture, answer) {
  const exp = fixture.expect || {};
  if (!answer || typeof answer !== 'object') {
    return { id: fixture.id, passed: false, detail: 'resposta ausente ou não-JSON' };
  }
  for (const [k, want] of Object.entries(exp)) {
    const got = answer[k];
    if (norm(got) !== norm(want)) {
      return { id: fixture.id, passed: false, detail: `campo "${k}": esperado "${want}", obtido "${got ?? '(vazio)'}"` };
    }
  }
  return { id: fixture.id, passed: true, detail: 'bateu o gabarito' };
}

// Amostragem DETERMINÍSTICA (sem Math.random, p/ ser testável): mede a cada N execuções.
// N inválido/0/null -> nunca amostra (fail-safe: não gasta token por acidente).
export function shouldSample(runCount, every) {
  const n = Number(every);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (n <= 1) return true;
  return Number(runCount) % n === 0;
}

// Agrega: pass só se TODAS passaram. Lista vazia/nula -> null (≠ pass).
export function summarizeProbe(results) {
  const rs = Array.isArray(results) ? results.filter((r) => r && typeof r.passed === 'boolean') : [];
  if (!rs.length) return { shadow_first_try_pass: null, rate: null, n: 0, results: [] };
  const passed = rs.filter((r) => r.passed).length;
  return { shadow_first_try_pass: passed === rs.length, rate: passed / rs.length, n: rs.length, results: rs };
}

// Runner LLM (toca a rede). Pergunta à IA cada fixture e julga.
//
// LINHA CRÍTICA — infra != modelo (spec §5, mesma disciplina do `unknown ≠ green`):
//   • chamada LANÇOU (rede caiu, API fora, timeout, sem chave) = falha de INFRA
//       -> passed: null  => NÃO entra no placar (não vira "o modelo piorou").
//   • a IA RESPONDEU, mas errou/veio ilegível                 = falha do MODELO
//       -> passed: false => entra no placar.
// Sem isso, uma queda de rede poluiria a medição do Aferidor. (Achado rodando de verdade.)
//
// chatFn é injetável só p/ teste (default: o chat real do llm.js).
export async function probeLlm({ harnessDir, canary, maxFixtures = 4, agentId = 'sombra', chatFn = chat } = {}) {
  let cfg;
  try {
    cfg = loadLlmConfig(harnessDir || path.resolve(DIR, '..'));
  } catch (e) {
    return { shadow_first_try_pass: null, rate: null, n: 0, results: [], skipped: `sem LLM configurado: ${e.message}` };
  }
  const cn = canary || loadCanaryLlm();
  const fixtures = (cn.fixtures || []).slice(0, maxFixtures);   // Art. LLM10: teto de consumo
  const results = [];
  let infraFails = 0;
  for (const fx of fixtures) {
    try {
      const text = await chatFn({ system: fx.system || 'Responda SOMENTE JSON.', user: fx.user, cfg, agentId });
      const answer = extractJson(text);           // respondeu: julga o MODELO (ilegível = erro dele)
      results.push(judgeFixture(fx, answer));
    } catch (e) {
      infraFails++;                                // não respondeu: INFRA, não conta
      results.push({ id: fx.id, passed: null, detail: `infra (não medido): ${String(e.message).slice(0, 60)}` });
    }
  }
  const out = summarizeProbe(results);
  out.results = results;                           // preserva as linhas de infra p/ o relatório
  if (infraFails) out.skipped = `${infraFails}/${fixtures.length} não medidas (LLM/rede fora)`;
  return out;
}

// ---- CLI (Art. II): node sombra-llm.js --probe [--json]  (toca a rede) ----
async function main() {
  const argv = process.argv.slice(2);
  if (!argv.includes('--probe')) {
    console.error('uso: node sombra-llm.js --probe [--json]   (chama a IA — gasta token)');
    process.exit(2);
  }
  const out = await probeLlm({});
  if (argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); }
  else {
    console.log('\n=== V-JP Harness — Sombra de Verdade (mede o MODELO) ===\n');
    if (out.skipped) console.log(`  ⚠ pulado: ${out.skipped}`);
    for (const r of out.results) console.log(`  ${r.passed ? '✔' : '✗'} ${r.id}: ${r.detail}`);
    console.log(`\n  shadow_first_try_pass=${out.shadow_first_try_pass} (taxa ${out.rate ?? 'n/a'}, ${out.n} tarefas)\n`);
  }
  process.exit(out.shadow_first_try_pass ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
