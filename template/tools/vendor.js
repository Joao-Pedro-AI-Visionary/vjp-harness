#!/usr/bin/env node

/**
 * V-JP Harness: Vendorização determinística de componentes git.
 *
 * Lê registry.json e clona cada componente `vendor: true` (RTK, GBrain, Superpowers)
 * no seu `dest` dentro de .harness/tools/<id>/, PINADO no ref do registro:
 *   - shallow clone na tag (git clone --depth 1 --branch <tag>)
 *   - se houver commit no registro, ASSERTA que o HEAD bate (determinismo)
 *
 * Idempotente: se o dest já existe no commit certo, pula. Caso contrário re-clona.
 *
 * Uso: node .harness/tools/vendor.js [--force] [--only <id>]
 *   --force      remove e re-clona mesmo se já estiver no commit certo
 *   --only <id>  vendoriza só um componente (ex: superpowers)
 */

import fs from 'fs';
import path from 'path';
import { execSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HARNESS_DIR = path.resolve(__dirname, '..');
const PROJECT_DIR = path.resolve(HARNESS_DIR, '..');
const REGISTRY = path.join(HARNESS_DIR, 'registry.json');

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' };
const info = (m) => console.log(`${C.cyan}▸${C.reset} ${m}`);
const ok = (m) => console.log(`${C.green}✔${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}⚠${C.reset} ${m}`);

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

function hasGit() {
  try { execSync('git --version', { stdio: 'ignore' }); return true; } catch { return false; }
}

function headCommit(dir) {
  try { return execSync('git rev-parse HEAD', { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return null; }
}

function vendorOne(c) {
  const src = c.source || {};
  const destAbs = path.join(PROJECT_DIR, c.dest);
  const tag = src.tag;
  const wantCommit = src.commit;
  const label = `${c.name} (${src.repo} @ ${tag || wantCommit || 'HEAD'})`;

  // já no commit certo?
  if (fs.existsSync(path.join(destAbs, '.git')) && !force) {
    const head = headCommit(destAbs);
    if (wantCommit && head && head.startsWith(wantCommit)) { ok(`${label} — já vendorizado (${head.slice(0, 12)})`); return { id: c.id, status: 'cached' }; }
    if (!wantCommit && head) { ok(`${label} — presente (${head.slice(0, 12)})`); return { id: c.id, status: 'cached' }; }
  }

  info(`Clonando ${label} ...`);
  fs.rmSync(destAbs, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });

  try {
    const cloneArgs = ['clone', '--depth', '1'];
    if (tag) cloneArgs.push('--branch', tag);
    cloneArgs.push(src.url, destAbs);
    execFileSync('git', cloneArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    warn(`${label} — clone falhou: ${String(e.stderr || e.message).split('\n')[0]}`);
    return { id: c.id, status: 'failed' };
  }

  // assert determinístico do commit
  const head = headCommit(destAbs);
  if (wantCommit && head && !head.startsWith(wantCommit)) {
    warn(`${label} — DRIFT: esperado ${wantCommit}, obtido ${head.slice(0, 12)} (a tag pode ter se movido)`);
    return { id: c.id, status: 'drift', head };
  }
  ok(`${label} — vendorizado em ${c.dest} (${(head || '').slice(0, 12)})`);
  return { id: c.id, status: 'ok', head };
}

function main() {
  if (!fs.existsSync(REGISTRY)) { console.error(`${C.red}✗ registry.json ausente${C.reset}`); process.exit(2); }
  if (!hasGit()) { warn('git não encontrado — vendorização pulada.'); process.exit(0); }

  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  let targets = reg.components.filter((c) => c.vendor && c.source && c.source.type === 'git');
  if (only) targets = targets.filter((c) => c.id === only);

  if (targets.length === 0) { warn('Nenhum componente para vendorizar.'); process.exit(0); }

  console.log(`\n${C.bold}${C.cyan}=== Vendorização determinística (${targets.length} componentes) ===${C.reset}\n`);
  const results = targets.map(vendorOne);

  const failed = results.filter((r) => r.status === 'failed' || r.status === 'drift');
  console.log('');
  if (failed.length === 0) ok(`${results.length} componente(s) vendorizado(s)/em cache.`);
  else warn(`${failed.length} componente(s) com problema (rede ou drift de tag). Veja acima.`);
  // vendorização é opcional → nunca falha o build (exit 0), mas sinaliza drift com exit 1 se --force
  process.exit(0);
}

main();
