#!/usr/bin/env node
/**
 * V-JP Harness: Mirror de Upstreams (Fase 5) — Risco B (a ferramenta some).
 * O vendoring atual clona do upstream: se o repo for apagado/o pacote despublicado, a
 * montagem morre. O mirror guarda uma CÓPIA PRÓPRIA (tarball) de cada upstream pinado,
 * verificável por SHA-256. `--audit` é offline/determinístico; `--fetch` toca a rede (opt-in).
 * — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MIRROR_DIR = path.resolve(DIR, '../../.mirror');

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

// Manifesto: um arquivo por upstream EXTERNO (bundled é nosso, não precisa de espelho).
export function buildMirrorManifest(registry, mirrorDir = DEFAULT_MIRROR_DIR) {
  const entries = (registry.components || [])
    .filter((c) => c.source && c.source.type !== 'bundled' && !c.removed)
    .map((c) => ({
      id: c.id,
      name: c.name,
      version: c.version,
      type: c.source.type,
      repo: c.source.repo || null,
      url: c.source.url || null,
      tag: c.source.tag || null,
      commit: c.source.commit || null,
      package: c.source.package || null,
      archive: path.join(mirrorDir, `${c.id}-${c.version}.tar.gz`),
      sha256: null,
    }));
  return { mirrorDir, entries };
}

// Estado de UMA entrada: ok | corrupted | missing | unverified. (unverified ≠ ok.)
export function verifyMirror(entry) {
  if (!fs.existsSync(entry.archive)) return { id: entry.id, status: 'missing', detail: 'sem cópia local' };
  if (!entry.sha256) return { id: entry.id, status: 'unverified', detail: 'sem sha256 registrado' };
  const actual = sha256File(entry.archive);
  return actual === entry.sha256
    ? { id: entry.id, status: 'ok', detail: actual.slice(0, 12) }
    : { id: entry.id, status: 'corrupted', detail: `esperado ${entry.sha256.slice(0, 12)}, obtido ${actual.slice(0, 12)}` };
}

// Saúde do espelho: healthy só se TODAS as entradas estão ok.
export function auditMirror(manifest) {
  const results = (manifest.entries || []).map(verifyMirror);
  return { healthy: results.length > 0 && results.every((r) => r.status === 'ok'), results };
}

// ---- rede (opt-in, NÃO testado): baixa os upstreams git pinados p/ o espelho ----
function fetchGitEntry(entry, mirrorDir) {
  fs.mkdirSync(mirrorDir, { recursive: true });
  const tmp = path.join(mirrorDir, `.tmp-${entry.id}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  execSync(`git clone --quiet --depth 1 ${entry.tag ? `--branch ${entry.tag}` : ''} ${entry.url} ${JSON.stringify(tmp)}`, { stdio: 'ignore' });
  execSync(`tar -czf ${JSON.stringify(entry.archive)} -C ${JSON.stringify(tmp)} .`, { stdio: 'ignore' });
  fs.rmSync(tmp, { recursive: true, force: true });
  return sha256File(entry.archive);
}

function manifestPath(mirrorDir) { return path.join(mirrorDir, 'manifest.json'); }

function main() {
  const argv = process.argv.slice(2);
  const registryPath = path.resolve(DIR, '../registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const mirrorDir = DEFAULT_MIRROR_DIR;
  const mp = manifestPath(mirrorDir);
  const manifest = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : buildMirrorManifest(registry, mirrorDir);

  if (argv.includes('--fetch')) {
    fs.mkdirSync(mirrorDir, { recursive: true });
    for (const e of manifest.entries.filter((x) => x.type === 'git' && x.url)) {
      try { e.sha256 = fetchGitEntry(e, mirrorDir); console.log(`  ✔ espelhado ${e.id} (${e.sha256.slice(0, 12)})`); }
      catch (err) { console.log(`  ✗ falhou ${e.id}: ${err.message}`); }
    }
    fs.writeFileSync(mp, JSON.stringify(manifest, null, 2));
    console.log(`\nmanifesto: ${mp}`);
    return;
  }

  const audit = auditMirror(manifest);
  if (argv.includes('--json')) { console.log(JSON.stringify({ mirrorDir, ...audit }, null, 2)); }
  else {
    const icon = { ok: '✔', corrupted: '✗', missing: '·', unverified: '?' };
    console.log(`\n=== V-JP Harness — Mirror de Upstreams (Risco B) ===\n`);
    for (const r of audit.results) console.log(`  ${icon[r.status]} ${r.id}: ${r.status} ${r.detail ? `(${r.detail})` : ''}`);
    console.log(`\n${audit.healthy ? '✔ Espelho saudável' : '⚠ Espelho incompleto — rode: node .harness/tools/mirror.js --fetch (rede)'}\n`);
  }
  process.exit(audit.healthy ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
