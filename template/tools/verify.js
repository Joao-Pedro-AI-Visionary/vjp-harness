#!/usr/bin/env node

/**
 * V-JP Harness: Verificador de Determinismo (Doctor)
 *
 * Lê .harness/registry.json e checa cada componente contra a versão PINADA.
 * - Componentes `required` ausentes ou em drift => exit 1 (build não-determinístico).
 * - Componentes opcionais ausentes => aviso (não bloqueia).
 *
 * Uso: node .harness/tools/verify.js [--json] [--strict]
 *   --strict : trata drift/ausência de QUALQUER componente (mesmo opcional) como falha.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HARNESS_DIR = path.resolve(__dirname, '..');
const REGISTRY = path.join(HARNESS_DIR, 'registry.json');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const strict = args.includes('--strict');

function skillDirs() {
  return [
    path.join(os.homedir(), '.claude', 'skills'),
    path.join(os.homedir(), '.claude', 'plugins'),
    path.join(process.cwd(), '.claude', 'skills'),
  ];
}

function checkComponent(c) {
  const v = c.verify || {};
  // status: ok | drift | missing | unknown
  try {
    switch (v.type) {
      case 'bundled':
      case 'file': {
        const p = path.join(HARNESS_DIR, v.path);
        return fs.existsSync(p)
          ? { status: 'ok', detail: v.path }
          : { status: 'missing', detail: `ausente: ${v.path}` };
      }
      case 'command': {
        let out = '';
        try {
          out = execSync(v.cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        } catch {
          return { status: 'missing', detail: `comando falhou: ${v.cmd}` };
        }
        if (v.expect && !out.includes(v.expect)) {
          return { status: 'drift', detail: `esperado ${v.expect}, obtido "${out.split('\n')[0]}"` };
        }
        return { status: 'ok', detail: out.split('\n')[0] || v.cmd };
      }
      case 'skill': {
        const found = skillDirs().some((d) => {
          try { return fs.existsSync(path.join(d, v.path)); } catch { return false; }
        });
        return found
          ? { status: 'ok', detail: `skill ${v.path}` }
          : { status: 'missing', detail: `skill não encontrada: ${v.path}` };
      }
      default:
        return { status: 'unknown', detail: 'sem método de verificação' };
    }
  } catch (e) {
    return { status: 'missing', detail: e.message };
  }
}

function main() {
  if (!fs.existsSync(REGISTRY)) {
    console.error(`${C.red}✗ registry.json não encontrado em ${REGISTRY}${C.reset}`);
    process.exit(2);
  }
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  // Componentes marcados `removed` (ex.: server-postgres na v1.7.0) ficam no registro
  // como histórico/ADR, mas não são verificados (não estão mais instalados).
  const components = [...reg.components].filter((c) => !c.removed).sort((a, b) => a.priority - b.priority);

  const rows = components.map((c) => {
    const r = checkComponent(c);
    return { id: c.id, name: c.name, tier: c.tier, required: !!c.required, version: c.version, ...r };
  });

  if (asJson) {
    console.log(JSON.stringify({ harnessVersion: reg.harnessVersion, results: rows }, null, 2));
  } else {
    const icon = { ok: `${C.green}✔${C.reset}`, drift: `${C.yellow}≠${C.reset}`, missing: `${C.red}✗${C.reset}`, unknown: `${C.dim}?${C.reset}` };
    console.log(`\n${C.bold}${C.cyan}=== V-JP Harness Doctor — Determinismo v${reg.harnessVersion} ===${C.reset}\n`);
    for (const r of rows) {
      const tag = r.required ? `${C.bold}[req]${C.reset}` : `${C.dim}[opt]${C.reset}`;
      console.log(`  ${icon[r.status]} ${tag} ${r.name} ${C.dim}@${r.version} (${r.tier})${C.reset}`);
      if (r.status !== 'ok') console.log(`      ${C.dim}${r.detail}${C.reset}`);
    }
  }

  const reqFail = rows.filter((r) => r.required && r.status !== 'ok');
  const anyFail = rows.filter((r) => r.status === 'drift' || r.status === 'missing');
  const fail = strict ? anyFail : reqFail;

  if (!asJson) {
    console.log('');
    if (fail.length === 0) {
      console.log(`${C.green}${C.bold}✔ Determinismo OK${C.reset} ${C.dim}(${rows.filter(r=>r.status==='ok').length}/${rows.length} componentes verificados)${C.reset}\n`);
    } else {
      console.log(`${C.red}${C.bold}✗ ${fail.length} componente(s) ${strict ? '' : 'obrigatório(s) '}com problema${C.reset} — montagem não-determinística.\n`);
    }
  }
  process.exit(fail.length === 0 ? 0 : 1);
}

main();
