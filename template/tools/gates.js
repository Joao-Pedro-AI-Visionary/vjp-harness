#!/usr/bin/env node
/**
 * V-JP Harness: Portões — "definição de pronto" consolidada (Fase 1).
 * Cada portão retorna 'green' | 'red' | 'unknown'. unknown ≠ green (spec §5):
 * infra do portão indisponível NÃO marca pronto e NÃO polui a medição. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { evaluateRegistry } from './verify.js';

// Portão spec-presente: a feature tem spec.md?
export function checkSpecPresent(featureDir) {
  return fs.existsSync(path.join(featureDir, 'spec.md')) ? 'green' : 'red';
}

// Portão adr-presente: decisão registrada (arquivo existe e não-vazio).
export function checkAdrPresent(gbrainDecisionsPath) {
  try {
    return fs.statSync(gbrainDecisionsPath).size > 0 ? 'green' : 'red';
  } catch { return 'red'; }
}

// Portão saida-aberta (cobre Risco C): artefatos em formato aberto e próprio existem.
// MVP: spec.md da feature + decisions.md (ADR) do projeto.
export function checkOpenOutputs(featureDir, gbrainDecisionsPath) {
  const specOk = fs.existsSync(path.join(featureDir, 'spec.md'));
  const adrOk = fs.existsSync(gbrainDecisionsPath);
  return specOk && adrOk ? 'green' : 'red';
}

// Portão prova-viva (v1.19.0): o sinal que a skill `test-gate` deixa em .bsd/prova-viva.json.
// Regra dura: verde só vale para o COMMIT em que o teste rodou. Sinal de outro commit não
// prova o código atual — vira 'red'. Sem sinal (ou sem como provar a frescura) => 'unknown',
// que NÃO marca pronto (mesma lei do topo do arquivo).
export function checkProvaViva(provaVivaPath, { headCommit = null } = {}) {
  let sinal;
  try {
    sinal = JSON.parse(fs.readFileSync(provaVivaPath, 'utf8'));
  } catch {
    return 'unknown'; // ausente ou ilegível: infra do portão indisponível
  }
  if (sinal.result !== 'pass') return 'red'; // teste vermelho é vermelho, commit à parte
  if (!sinal.commit || !headCommit) return 'unknown'; // frescura não provável
  return sinal.commit === headCommit ? 'green' : 'red'; // recibo velho não paga a compra de hoje
}

// HEAD do repo (null quando não há git ou o comando falha — o portão trata como 'unknown').
export function resolveHeadCommit(root) {
  try {
    return execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || null;
  } catch { return null; }
}

// Portão determinismo: reusa evaluateRegistry (nenhum required em drift/missing).
export function checkDeterminism(registry, opts = {}) {
  const { fail } = evaluateRegistry(registry, opts);
  return fail.length === 0 ? 'green' : 'red';
}

// Portões forçados na Fase 1 (verificáveis por arquivo/registro). Os demais são reportados
// como 'unknown' (visível, não-bloqueante) até seu sinal externo ser fiado nas fases seguintes.
export const ENFORCED_GATES = ['spec-presente', 'adr-presente', 'saida-aberta', 'determinismo'];

// Consolida a "definição de pronto". ctx: { featureDir, gbrainDecisionsPath, registry?,
// registryOpts?, provaVivaPath?, headCommit?, provaViva?, contrato?, owasp? }. Retorna { passed, gates, enforced }.
export function evaluateGates(ctx) {
  const gates = {
    'spec-presente': checkSpecPresent(ctx.featureDir),
    'adr-presente': checkAdrPresent(ctx.gbrainDecisionsPath),
    'saida-aberta': checkOpenOutputs(ctx.featureDir, ctx.gbrainDecisionsPath),
    'determinismo': ctx.registry ? checkDeterminism(ctx.registry, ctx.registryOpts || {}) : 'unknown',
    // prova-viva: fiado na v1.19.0 (sinal do test-gate). Sem provaVivaPath, mantém o
    // comportamento antigo (ctx.provaViva ou 'unknown') — compatibilidade com chamadores velhos.
    'prova-viva': ctx.provaVivaPath
      ? checkProvaViva(ctx.provaVivaPath, { headCommit: ctx.headCommit })
      : (ctx.provaViva || 'unknown'),
    // sinais externos ainda declarativos (decisão consciente, ver ADR v1.19.0): 'unknown'
    'contrato-bate': ctx.contrato || 'unknown',
    'owasp': ctx.owasp || 'unknown',
  };
  const passed = ENFORCED_GATES.every((k) => gates[k] === 'green');
  return { passed, gates, enforced: ENFORCED_GATES };
}

// ---- CLI (Art. II): node gates.js --feature <slug> [--root <dir>] [--json] ----
function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const featureIdx = argv.indexOf('--feature');
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx >= 0 ? path.resolve(argv[rootIdx + 1]) : path.resolve(__dirname_gates(), '../..');
  const feature = featureIdx >= 0 ? argv[featureIdx + 1] : null;
  if (!feature) { console.error('uso: node gates.js --feature <slug> [--root <dir>] [--json]'); process.exit(2); }

  const featureDir = fs.existsSync(path.join(root, 'specs', feature))
    ? path.join(root, 'specs', feature)
    : path.join(root, '.planning', 'phases', feature);
  const gbrainDecisionsPath = path.join(root, '.gbrain', 'decisions.md');
  const registryPath = path.join(root, '.harness', 'registry.json');
  const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : null;

  const provaVivaPath = path.join(root, '.bsd', 'prova-viva.json');
  const headCommit = resolveHeadCommit(root);

  const result = evaluateGates({ featureDir, gbrainDecisionsPath, registry, provaVivaPath, headCommit });
  if (asJson) { console.log(JSON.stringify(result, null, 2)); }
  else {
    for (const [k, v] of Object.entries(result.gates)) {
      const enforced = ENFORCED_GATES.includes(k) ? '[req]' : '[opt]';
      console.log(`  ${v === 'green' ? '✔' : v === 'red' ? '✗' : '?'} ${enforced} ${k}: ${v}`);
    }
    console.log(result.passed ? '\n✔ Definição de pronto: PASSOU' : '\n✗ Definição de pronto: BLOQUEADO');
  }
  process.exit(result.passed ? 0 : 1);
}

function __dirname_gates() { return path.dirname(fileURLToPath(import.meta.url)); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
