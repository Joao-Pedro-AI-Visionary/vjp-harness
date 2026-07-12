#!/usr/bin/env node
/**
 * V-JP Harness: Portões — "definição de pronto" consolidada (Fase 1).
 * Cada portão retorna 'green' | 'red' | 'unknown'. unknown ≠ green (spec §5):
 * infra do portão indisponível NÃO marca pronto e NÃO polui a medição. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
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

// Portão determinismo: reusa evaluateRegistry (nenhum required em drift/missing).
export function checkDeterminism(registry, opts = {}) {
  const { fail } = evaluateRegistry(registry, opts);
  return fail.length === 0 ? 'green' : 'red';
}

// Portões forçados na Fase 1 (verificáveis por arquivo/registro). Os demais são reportados
// como 'unknown' (visível, não-bloqueante) até seu sinal externo ser fiado nas fases seguintes.
export const ENFORCED_GATES = ['spec-presente', 'adr-presente', 'saida-aberta', 'determinismo'];

// Consolida a "definição de pronto". ctx: { featureDir, gbrainDecisionsPath, registry?,
// registryOpts?, provaViva?, contrato?, owasp? }. Retorna { passed, gates, enforced }.
export function evaluateGates(ctx) {
  const gates = {
    'spec-presente': checkSpecPresent(ctx.featureDir),
    'adr-presente': checkAdrPresent(ctx.gbrainDecisionsPath),
    'saida-aberta': checkOpenOutputs(ctx.featureDir, ctx.gbrainDecisionsPath),
    'determinismo': ctx.registry ? checkDeterminism(ctx.registry, ctx.registryOpts || {}) : 'unknown',
    // sinais externos (fiados em fases futuras): 'unknown' se ausentes
    'prova-viva': ctx.provaViva || 'unknown',
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

  const result = evaluateGates({ featureDir, gbrainDecisionsPath, registry });
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
