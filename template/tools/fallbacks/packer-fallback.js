/**
 * V-JP Harness: Fallback nativo — Empacotador de Repositório (Fase 5).
 * Implementação PRÓPRIA do papel `packer`. Existe para o método sobreviver ao sumiço/troca
 * do Repomix (Risco B): gera um texto único com o conteúdo do repo. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';

const IGNORED = new Set(['node_modules', '.git', '.worktrees', 'dist', 'build', '.bsd']);

function walk(dir, base, exts, out) {
  for (const name of fs.readdirSync(dir)) {
    if (IGNORED.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) { walk(full, base, exts, out); continue; }
    if (exts.length && !exts.includes(path.extname(name))) continue;
    const rel = path.relative(base, full).split(path.sep).join('/');
    out.push(`=== ${rel} ===\n${fs.readFileSync(full, 'utf8')}`);
  }
  return out;
}

// Empacota o repo num texto único (cabeçalho por arquivo). extensions=[] -> todas.
export function packRepo(rootDir, { extensions = [] } = {}) {
  return walk(rootDir, rootDir, extensions, []).join('\n\n');
}
