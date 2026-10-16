#!/usr/bin/env node
/**
 * Checklist OK/FALTA/AVISO. install.sh (via verify.js) e bsd.js --doctor/--check.
 * Não imprime valor de env. Correções conferidas (out/2026): code.claude.com/docs/en/setup,
 * developers.openai.com/codex/cli e /codex/environment-variables, antigravity.google/docs/cli/install,
 * cursor.com/docs/cli/installation, registry.json. CLIs sem mínimo pinado. postgres-mcp sem --version.
 * Plugins: diretórios de skill — não há flag não-interativa verificada para listar.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const STATUS = { OK: 'OK', FALTA: 'FALTA', AVISO: 'AVISO' };
const SKILLS = ['test-gate', 'pr-review', 'prepush', 'projeto-novo', 'superpowers', 'frontend-design', 'ui-ux-pro-max'];
const FIX = {
  node: {
    win32: 'winget install --id OpenJS.NodeJS.LTS',
    darwin: 'instale Node.js ≥ 18: https://nodejs.org/en/download',
    linux: 'instale Node.js ≥ 18: https://nodejs.org/en/download',
  },
  python: {
    win32: 'winget install --id Python.Python.3.14',
    darwin: 'instale Python ≥ 3.12: https://www.python.org/downloads/macos/',
    linux: 'instale Python ≥ 3.12: https://www.python.org/downloads/',
  },
  git: {
    win32: 'winget install --id Git.Git',
    darwin: 'xcode-select --install',
    linux: 'sudo apt-get install -y git   # Debian/Ubuntu; outras distros: https://git-scm.com/downloads',
  },
  claude: {
    win32: 'irm https://claude.ai/install.ps1 | iex',
    darwin: 'curl -fsSL https://claude.ai/install.sh | bash',
    linux: 'curl -fsSL https://claude.ai/install.sh | bash',
  },
  codex: {
    win32: 'irm https://chatgpt.com/codex/install.ps1 | iex',
    darwin: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
    linux: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
  },
  agy: {
    win32: 'irm https://antigravity.google/cli/install.ps1 | iex',
    darwin: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
    linux: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
  },
  cursor: {
    win32: "irm 'https://cursor.com/install?win32=true' | iex",
    darwin: 'curl https://cursor.com/install -fsS | bash',
    linux: 'curl https://cursor.com/install -fsS | bash',
  },
};

export function parseVersion(text) {
  const m = String(text || '').match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function versionBelow(found, min) {
  if (!found) return true;
  for (let i = 0; i < 3; i++) {
    if (found[i] !== min[i]) return found[i] < min[i];
  }
  return false;
}

export function pinsFromRegistry(reg) {
  const byId = Object.fromEntries((reg?.components || []).map((c) => [c.id, c]));
  return {
    nodeMin: [18, 0, 0],
    pythonMin: [3, 12, 0],
    headroom: byId.headroom?.version || '0.39.1',
    gbrain: byId.gbrain?.version || '0.35.1.0',
    repomix: byId.repomix?.version || '1.16.0',
    playwrightMcp: byId['playwright-mcp']?.version || '0.0.75',
    postgresMcp: byId['postgres-mcp-pro']?.version || '0.3.0',
  };
}

function fixFor(id, platform) {
  const row = FIX[id];
  if (!row) return '';
  return row[platform] || row.linux || '';
}

function firstLine(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
}

function row(partial) {
  return { version: null, fix: '', required: false, ...partial };
}

function cmdVersion(probes, bin, args) {
  const r = probes.command(bin, args);
  if (!r?.ok) return { ok: false, line: '', parsed: null };
  const line = firstLine(r.stdout).slice(0, 120);
  return { ok: true, line, parsed: parseVersion(line) };
}

function probeBins(probes, attempts) {
  for (const [bin, args] of attempts) {
    const hit = cmdVersion(probes, bin, args);
    if (hit.ok) return hit;
  }
  return { ok: false, line: '', parsed: null };
}

function presence(env, key) {
  const v = env?.[key];
  return v == null || String(v).length === 0 ? 'ausente' : 'definida';
}

function skillDirs(probes, name) {
  const home = probes.home;
  const project = path.resolve(probes.harnessDir, '..');
  return [
    path.join(home, '.claude', 'skills', name),
    path.join(home, '.claude', 'plugins', name),
    path.join(home, '.agents', 'skills', name),
    path.join(home, '.gemini', 'config', 'skills', name),
    path.join(home, '.gemini', 'antigravity-cli', 'skills', name),
    path.join(project, '.claude', 'skills', name),
    path.join(project, '.agents', 'skills', name),
  ];
}

function pkgVersion(probes, rel) {
  const j = probes.readJson(path.join(probes.harnessDir, rel));
  return j && typeof j.version === 'string' ? j.version : null;
}

export function evaluateChecklist(probes, { strict = false, pins } = {}) {
  const platform = probes.platform;
  const p = pins || pinsFromRegistry(probes.readJson(path.join(probes.harnessDir, 'registry.json')));
  const rows = [];
  const push = (r) => rows.push(row(r));

  const node = cmdVersion(probes, 'node', ['--version']);
  if (!node.ok) {
    push({ id: 'node', name: 'Node.js', required: true, status: STATUS.FALTA, detail: 'ausente no PATH', fix: fixFor('node', platform) });
  } else if (!node.parsed || versionBelow(node.parsed, p.nodeMin)) {
    push({ id: 'node', name: 'Node.js', required: true, status: STATUS.FALTA, version: node.line, detail: `mínimo ${p.nodeMin.join('.')} (install.sh)`, fix: fixFor('node', platform) });
  } else {
    push({ id: 'node', name: 'Node.js', required: true, status: STATUS.OK, version: node.line, detail: `mínimo ${p.nodeMin.join('.')}` });
  }

  const pyAttempts = platform === 'win32'
    ? [['py', ['-3', '--version']], ['python', ['--version']], ['python3', ['--version']]]
    : [['python3', ['--version']], ['python', ['--version']]];
  const py = probeBins(probes, pyAttempts);
  if (!py.ok) {
    push({ id: 'python', name: 'Python', status: STATUS.AVISO, detail: 'ausente — Headroom usa uv/Python 3.13; Postgres MCP Pro documenta 3.12+', fix: fixFor('python', platform) });
  } else if (!py.parsed || versionBelow(py.parsed, p.pythonMin)) {
    push({ id: 'python', name: 'Python', status: STATUS.AVISO, version: py.line, detail: `abaixo de ${p.pythonMin.join('.')} (Postgres MCP Pro)`, fix: fixFor('python', platform) });
  } else {
    push({ id: 'python', name: 'Python', status: STATUS.OK, version: py.line, detail: `mínimo ${p.pythonMin.join('.')} (Postgres MCP Pro; Headroom pina 3.13 via uv)` });
  }

  const git = cmdVersion(probes, 'git', ['--version']);
  push(git.ok
    ? { id: 'git', name: 'git', status: STATUS.OK, version: git.line, detail: 'worktrees habilitadas' }
    : { id: 'git', name: 'git', status: STATUS.AVISO, detail: 'ausente — bsd.js cai no diretório isolado', fix: fixFor('git', platform) });

  const clis = [
    ['cli-claude', 'Claude Code', 'claude', ['--version'], 'claude'],
    ['cli-codex', 'Codex CLI', 'codex', ['--version'], 'codex'],
    ['cli-agy', 'Antigravity CLI', 'agy', ['--version'], 'agy'],
    ['cli-cursor', 'Cursor CLI', 'agent', ['--version'], 'cursor'],
  ];
  for (const [id, name, bin, args, fixId] of clis) {
    const hit = cmdVersion(probes, bin, args);
    if (!hit.ok) {
      push({ id, name, status: STATUS.AVISO, detail: 'ausente — mínimo não pinado no registry; a doc oficial só define --version', fix: fixFor(fixId, platform) });
    } else if (!hit.parsed) {
      push({ id, name, status: STATUS.AVISO, version: hit.line || null, detail: 'respondeu, mas a versão não foi parseada', fix: fixFor(fixId, platform) });
    } else {
      push({ id, name, status: STATUS.OK, version: hit.line, detail: 'mínimo não pinado no registry' });
    }
  }

  const headroomFix = `uv tool install --python 3.13 "headroom-ai[proxy,code]==${p.headroom}"`;
  const hr = cmdVersion(probes, 'headroom', ['--version']);
  if (!hr.ok) push({ id: 'headroom', name: 'Headroom', status: STATUS.AVISO, detail: 'ausente (opcional)', fix: headroomFix });
  else if (!hr.line.includes(p.headroom)) push({ id: 'headroom', name: 'Headroom', status: STATUS.AVISO, version: hr.line, detail: `pin do registry é ${p.headroom}`, fix: headroomFix });
  else push({ id: 'headroom', name: 'Headroom', status: STATUS.OK, version: hr.line, detail: `pin ${p.headroom}` });

  const gbrainBins = probes.platform === 'win32'
    ? [['gbrain', ['--version']], [path.join(probes.home, '.bun', 'bin', 'gbrain.exe'), ['--version']]]
    : [['gbrain', ['--version']], [path.join(probes.home, '.bun', 'bin', 'gbrain'), ['--version']]];
  const gbrainHit = probeBins(probes, gbrainBins);
  const gbrainVendored = probes.exists(path.join(probes.harnessDir, 'tools', 'gbrain'));
  if (gbrainHit.ok && gbrainHit.line.includes(p.gbrain)) {
    push({ id: 'gbrain', name: 'GBrain', status: STATUS.OK, version: gbrainHit.line, detail: `pin ${p.gbrain}` });
  } else if (gbrainHit.ok) {
    push({ id: 'gbrain', name: 'GBrain', status: STATUS.AVISO, version: gbrainHit.line, detail: `binário não contém o pin ${p.gbrain}`, fix: 'node .harness/tools/bsd.js --vendor --only gbrain' });
  } else if (gbrainVendored) {
    push({ id: 'gbrain', name: 'GBrain', status: STATUS.OK, detail: 'clone pinado em .harness/tools/gbrain (sem binário no PATH)' });
  } else {
    push({ id: 'gbrain', name: 'GBrain', status: STATUS.AVISO, detail: 'ausente (opcional)', fix: 'node .harness/tools/bsd.js --vendor --only gbrain' });
  }

  const repomixVer = pkgVersion(probes, path.join('tools', 'node_modules', 'repomix', 'package.json'));
  if (!repomixVer) {
    push({ id: 'repomix', name: 'Repomix', required: true, status: STATUS.FALTA, detail: 'node_modules ausente', fix: 'cd .harness/tools && npm ci' });
  } else if (repomixVer !== p.repomix) {
    push({ id: 'repomix', name: 'Repomix', required: true, status: STATUS.FALTA, version: repomixVer, detail: `pin do registry é ${p.repomix}`, fix: 'cd .harness/tools && npm ci' });
  } else {
    push({ id: 'repomix', name: 'Repomix', required: true, status: STATUS.OK, version: repomixVer, detail: `pin ${p.repomix}` });
  }

  const pwVer = pkgVersion(probes, path.join('tools', 'node_modules', '@playwright', 'mcp', 'package.json'));
  if (!pwVer) push({ id: 'playwright', name: 'Playwright MCP', status: STATUS.AVISO, detail: 'pacote ausente (opcional)', fix: 'cd .harness/tools && npm ci' });
  else if (pwVer !== p.playwrightMcp) push({ id: 'playwright', name: 'Playwright MCP', status: STATUS.AVISO, version: pwVer, detail: `pin do registry é ${p.playwrightMcp}`, fix: 'cd .harness/tools && npm ci' });
  else push({ id: 'playwright', name: 'Playwright MCP', status: STATUS.OK, version: pwVer, detail: `pin ${p.playwrightMcp}` });

  const uvx = cmdVersion(probes, 'uvx', ['--version']);
  const docker = cmdVersion(probes, 'docker', ['--version']);
  if (uvx.ok || docker.ok) {
    const how = [uvx.ok ? 'uvx' : '', docker.ok ? 'docker' : ''].filter(Boolean).join('+');
    push({ id: 'postgres', name: 'Postgres MCP Pro', status: STATUS.OK, detail: `opcional; runtime ${how}. Sem --version no pacote; pin ${p.postgresMcp}` });
  } else {
    push({
      id: 'postgres', name: 'Postgres MCP Pro', status: STATUS.AVISO,
      detail: `opcional; nem uvx nem docker. O pacote não tem --version (registry)`,
      fix: `uvx postgres-mcp==${p.postgresMcp} --help`,
    });
  }

  const mcpPath = path.join(probes.harnessDir, 'config', 'mcp.json');
  const mcp = probes.readJson(mcpPath);
  const servers = mcp && mcp.mcpServers ? Object.keys(mcp.mcpServers) : null;
  if (!servers) {
    push({ id: 'mcp-config', name: 'MCPs (config/mcp.json)', status: STATUS.AVISO, detail: 'arquivo ausente ou inválido', fix: 'restaure template/config/mcp.json' });
  } else {
    const placeholder = JSON.stringify(mcp).includes('__DB_NAME__');
    push({
      id: 'mcp-config', name: 'MCPs (config/mcp.json)',
      status: placeholder ? STATUS.AVISO : STATUS.OK,
      detail: placeholder
        ? `servers: ${servers.join(', ')}. DATABASE_URI ainda é placeholder (valor não exibido)`
        : `servers: ${servers.join(', ')}`,
      fix: placeholder ? 'ajuste DATABASE_URI no ambiente, não no arquivo versionado' : '',
    });
  }

  const missingSkills = SKILLS.filter((name) => !skillDirs(probes, name).some((d) => probes.exists(d)));
  if (missingSkills.length === 0) {
    push({ id: 'plugins', name: 'Plugins / skills', status: STATUS.OK, detail: SKILLS.join(', ') });
  } else {
    push({
      id: 'plugins', name: 'Plugins / skills', status: STATUS.AVISO,
      detail: `faltam: ${missingSkills.join(', ')}`,
      fix: 'bash machine/bootstrap.sh   # ou node template/tools/sync-rules.js --global',
    });
  }

  const env = probes.env || {};
  const llm = presence(env, 'VJP_LLM_API_KEY');
  push({
    id: 'env-llm', name: 'VJP_LLM_API_KEY',
    status: llm === 'definida' ? STATUS.OK : STATUS.AVISO,
    detail: llm === 'definida' ? 'definida (valor oculto)' : 'ausente — pipeline com LLM não autentica; --dry-run funciona',
    fix: platform === 'win32' ? '$env:VJP_LLM_API_KEY="<sua chave>"' : 'export VJP_LLM_API_KEY="<sua chave>"',
  });

  if (!env.HEADROOM_BEACON) {
    push({ id: 'env-headroom', name: 'HEADROOM_BEACON', status: STATUS.AVISO, detail: 'ausente — a telemetria do Headroom vem ligada', fix: platform === 'win32' ? '$env:HEADROOM_BEACON="off"' : 'export HEADROOM_BEACON=off' });
  } else if (env.HEADROOM_BEACON === 'off') {
    push({ id: 'env-headroom', name: 'HEADROOM_BEACON', status: STATUS.OK, detail: 'definida (valor oculto)' });
  } else {
    push({ id: 'env-headroom', name: 'HEADROOM_BEACON', status: STATUS.AVISO, detail: 'definida com valor diferente do esperado pelo harness', fix: platform === 'win32' ? '$env:HEADROOM_BEACON="off"' : 'export HEADROOM_BEACON=off' });
  }

  const db = presence(env, 'DATABASE_URI');
  push({
    id: 'env-database', name: 'DATABASE_URI',
    status: db === 'definida' ? STATUS.OK : STATUS.AVISO,
    detail: db === 'definida' ? 'definida (valor oculto)' : 'ausente — Postgres MCP Pro não conecta (opcional)',
    fix: platform === 'win32' ? '$env:DATABASE_URI="postgresql://..."' : 'export DATABASE_URI="postgresql://..."',
  });

  const fail = rows.filter((r) => r.status === STATUS.FALTA || (strict && r.status === STATUS.AVISO));
  return { platform, rows, fail };
}

export function formatChecklist(result, { color = false } = {}) {
  const c = color
    ? { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' }
    : { reset: '', bold: '', dim: '', red: '', green: '', yellow: '' };
  const paint = { OK: c.green, FALTA: c.red, AVISO: c.yellow };
  const lines = ['', `${c.bold}=== Checklist de requisitos (${result.platform}) ===${c.reset}`, ''];
  for (const r of result.rows) {
    const ver = r.version ? `  ${r.version}` : '';
    lines.push(`  ${paint[r.status]}${r.status.padEnd(5)}${c.reset}  ${r.name}${c.dim}${ver}${c.reset}`);
    lines.push(`         ${c.dim}${r.detail}${c.reset}`);
    if (r.status !== STATUS.OK && r.fix) lines.push(`         correção: ${r.fix}`);
  }
  const n = (s) => result.rows.filter((r) => r.status === s).length;
  lines.push('', `${n(STATUS.OK)} OK · ${n(STATUS.FALTA)} FALTA · ${n(STATUS.AVISO)} AVISO`, '');
  return lines.join('\n');
}

const SAFE_TOKEN = /^[A-Za-z0-9_.:\\/-]+$/;

export function runCommand(bin, args, timeoutMs = 15000) {
  if (!SAFE_TOKEN.test(bin) || args.some((a) => !SAFE_TOKEN.test(a))) return { ok: false, stdout: '' };
  const opts = { timeout: timeoutMs, encoding: 'utf8', windowsHide: true };
  // Windows: shim .cmd/.ps1 só resolve com shell. A linha é SAFE_TOKEN, sem entrada do usuário.
  const bare = !/[\\/]/.test(bin);
  const r = process.platform === 'win32' && bare
    ? spawnSync([bin, ...args].join(' '), { ...opts, shell: true })
    : spawnSync(bin, args, { ...opts, shell: false });
  const stdout = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.error || r.status !== 0) return { ok: false, stdout: stdout.slice(0, 300) };
  return { ok: true, stdout };
}

export function liveProbes(harnessDir = path.resolve(__dirname, '..')) {
  return {
    platform: process.platform,
    harnessDir,
    home: process.env.HOME || process.env.USERPROFILE || '',
    env: process.env,
    command: runCommand,
    exists: (p) => { try { return fs.existsSync(p); } catch { return false; } },
    readJson: (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } },
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('node checklist.js [--json] [--strict] [--check]\n  --check  alias (o mesmo relatório). Não é o --check de drift do sync-rules.js.');
    return 0;
  }
  const strict = args.includes('--strict');
  const asJson = args.includes('--json');
  const result = evaluateChecklist(liveProbes(), { strict });
  if (asJson) console.log(JSON.stringify({ platform: result.platform, rows: result.rows }, null, 2));
  else console.log(formatChecklist(result, { color: process.stdout.isTTY }));
  return result.fail.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
