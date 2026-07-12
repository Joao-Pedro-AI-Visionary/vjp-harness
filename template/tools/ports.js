#!/usr/bin/env node
/**
 * V-JP Harness: Portas (Adaptadores por papel) — Fase 5.
 * Resolve um PAPEL para uma implementação: a ferramenta pinada se presente, senão o
 * FALLBACK nativo V-JP (formato aberto). Fecha o Risco A (troca) e o B (sumiço).
 *
 * Art. VIII (anti-abstração) reconciliado: só existe porta onde há 2+ implementações
 * CONCRETAS (ferramenta + fallback próprio real). Porta sem fallback não é criada (YAGNI).
 * — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// Papéis com fallback próprio REAL (a única condição p/ existir uma porta).
export const PORTS = {
  memory: {
    role: 'Memória Persistente',
    tool: 'gbrain',
    defaultToolPath: path.join(DIR, 'gbrain', 'bin', 'gbrain.js'),
    fallback: path.join(DIR, 'fallbacks', 'memory-fallback.js'),
  },
  packer: {
    role: 'Empacotador de Repositório',
    tool: 'repomix',
    defaultToolPath: path.join(DIR, 'node_modules', 'repomix', 'bin', 'repomix.cjs'),
    fallback: path.join(DIR, 'fallbacks', 'packer-fallback.js'),
  },
};

// Resolve o papel -> { impl: 'tool'|'fallback', path, role, tool }.
export function resolvePort(role, { toolPaths = {} } = {}) {
  const port = PORTS[role];
  if (!port) throw new Error(`Porta: papel desconhecido "${role}"`);
  const toolPath = toolPaths[role] || port.defaultToolPath;
  const hasTool = (() => { try { return fs.existsSync(toolPath); } catch { return false; } })();
  return hasTool
    ? { impl: 'tool', path: toolPath, role: port.role, tool: port.tool }
    : { impl: 'fallback', path: port.fallback, role: port.role, tool: `${port.tool} (ausente → fallback V-JP)` };
}

// Status de todas as portas (auditável).
export function portStatus(opts = {}) {
  return Object.fromEntries(Object.keys(PORTS).map((r) => [r, resolvePort(r, opts)]));
}

// ---- CLI (Art. II): node ports.js [--json] ----
function main() {
  const st = portStatus();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(st, null, 2)); return; }
  console.log('\n=== V-JP Harness — Portas (papel → implementação) ===\n');
  for (const [role, r] of Object.entries(st)) {
    console.log(`  ${r.impl === 'tool' ? '✔' : '↺'} ${r.role}: ${r.impl === 'tool' ? 'ferramenta' : 'FALLBACK nativo'} (${r.tool})`);
  }
  console.log('\n↺ = a ferramenta sumiu, mas o método continua (fallback próprio).\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
