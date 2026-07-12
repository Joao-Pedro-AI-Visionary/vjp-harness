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
