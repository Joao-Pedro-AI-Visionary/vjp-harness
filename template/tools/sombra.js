#!/usr/bin/env node
/**
 * V-JP Harness: Probe Sombra + Conjunto-Canário (Fase 4).
 * Roda o canário no nível MAIS FROUXO (sombra) e agrega em shadow_first_try_pass,
 * pra o analisador (Fase 3) promover com evidência de-riscada. runner PLUGÁVEL:
 * embutido = self-check determinístico do Dial (sem LLM); produção injeta a pipeline LLM.
 * — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { selectLevel, stageEnabled, loadDialConfig } from './dial.js';

// Nível-sombra = um degrau mais frouxo que o atual, sem furar o piso. null = já no piso (sem sombra).
export function shadowLevelFor(currentLevel, taskClass, config) {
  const piso = config.pisos[taskClass] ?? config.pisos.config ?? 0;
  const shadow = currentLevel - 1;
  return shadow >= piso ? shadow : null;
}

// shadow_first_try_pass = TRUE só se todas as amostras passaram. Ignora resultados não-booleanos.
export function aggregateShadow(results) {
  const scored = (results || []).filter((r) => r && typeof r.passed === 'boolean');
  if (!scored.length) return { shadow_first_try_pass: null, rate: null, n: 0 };
  const passed = scored.filter((r) => r.passed).length;
  return { shadow_first_try_pass: passed === scored.length, rate: passed / scored.length, n: scored.length };
}

export function loadCanary(canaryPath) {
  const p = canaryPath || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../config/canary.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Roda cada fixture pelo runner e agrega. runner(fixture) -> { passed: boolean|null }.
export function runCanaryProbe({ canary, runner }) {
  return aggregateShadow((canary.fixtures || []).map((fx) => runner(fx)));
}

// Runner embutido (determinístico, SEM LLM): valida que o Dial produz o nível/estágios dourados.
// NÃO mede qualidade do modelo — é um self-check do harness. Produção injeta um runner LLM.
export function dialConsistencyRunner(config) {
  return (fx) => {
    const level = selectLevel({ taskClass: fx.taskClass, recommended: fx.recommended, config });
    if (level !== fx.expectLevel) return { passed: false };
    const stagesOk = Object.entries(fx.expectStages || {}).every(([s, exp]) => stageEnabled(level, s, config) === exp);
    return { passed: stagesOk };
  };
}

// ---- CLI (Art. II): node sombra.js --probe [--config <path>] [--canary <path>] [--json] ----
function main() {
  const argv = process.argv.slice(2);
  const get = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  if (!argv.includes('--probe')) { console.error('uso: node sombra.js --probe [--config <path>] [--canary <path>] [--json]'); process.exit(2); }
  const config = loadDialConfig(get('--config'));
  const canary = loadCanary(get('--canary'));
  const agg = runCanaryProbe({ canary, runner: dialConsistencyRunner(config) });
  const out = { fixtures: canary.fixtures.length, ...agg, runner: 'dial-consistency (self-check, sem LLM)' };
  console.log(argv.includes('--json') ? JSON.stringify(out, null, 2)
    : `canário: ${agg.n} fixtures, sombra_pass=${agg.shadow_first_try_pass} (taxa ${agg.rate}) [runner: self-check do Dial]`);
  process.exit(agg.shadow_first_try_pass ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
