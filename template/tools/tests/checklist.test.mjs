import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { evaluateChecklist, formatChecklist, liveProbes, parseVersion, runCommand, versionBelow, pinsFromRegistry, STATUS } from '../checklist.js';

const pins = pinsFromRegistry({
  components: [
    { id: 'headroom', version: '0.39.1' },
    { id: 'gbrain', version: '0.35.1.0' },
    { id: 'repomix', version: '1.16.0' },
    { id: 'playwright-mcp', version: '0.0.75' },
    { id: 'postgres-mcp-pro', version: '0.3.0' },
  ],
});

function probes(overrides = {}) {
  const commands = overrides.commands || {};
  return {
    platform: overrides.platform || 'linux',
    harnessDir: overrides.harnessDir || '/harness',
    home: overrides.home || '/home/dev',
    env: overrides.env || {},
    command(bin, args) {
      const key = `${bin} ${args.join(' ')}`;
      if (Object.prototype.hasOwnProperty.call(commands, key)) return commands[key];
      return { ok: false, stdout: '' };
    },
    exists: overrides.exists || (() => false),
    readJson: overrides.readJson || (() => null),
  };
}

const okNode = { 'node --version': { ok: true, stdout: 'v22.14.0\n' } };
const okPy = { 'python3 --version': { ok: true, stdout: 'Python 3.13.1\n' } };
const okGit = { 'git --version': { ok: true, stdout: 'git version 2.45.0\n' } };

test('parseVersion e mínimo do Node', () => {
  assert.deepEqual(parseVersion('v18.0.0'), [18, 0, 0]);
  assert.equal(versionBelow([17, 9, 9], [18, 0, 0]), true);
  assert.equal(versionBelow([18, 0, 0], [18, 0, 0]), false);
});

test('Node abaixo de 18 é FALTA com comando da plataforma', () => {
  const r = evaluateChecklist(probes({
    platform: 'win32',
    commands: { 'node --version': { ok: true, stdout: 'v16.20.0\n' } },
  }), { pins });
  const node = r.rows.find((x) => x.id === 'node');
  assert.equal(node.status, STATUS.FALTA);
  assert.match(node.fix, /OpenJS\.NodeJS\.LTS/);
  assert.ok(r.fail.some((x) => x.id === 'node'));
});

test('Python e git ausentes são AVISO e não bloqueiam', () => {
  const r = evaluateChecklist(probes({ commands: { ...okNode } }), { pins });
  assert.equal(r.rows.find((x) => x.id === 'python').status, STATUS.AVISO);
  assert.equal(r.rows.find((x) => x.id === 'git').status, STATUS.AVISO);
  assert.equal(r.fail.length, 1);
  assert.equal(r.fail[0].id, 'repomix');
});

test('--strict promove AVISO a falha de saída, sem trocar o rótulo', () => {
  const r = evaluateChecklist(probes({ commands: { ...okNode, ...okPy, ...okGit } }), { strict: true, pins });
  const py = r.rows.find((x) => x.id === 'python');
  assert.equal(py.status, STATUS.OK);
  assert.ok(r.fail.some((x) => x.status === STATUS.AVISO));
});

test('Repomix no pin é OK; versão errada é FALTA', () => {
  const readJson = (p) => {
    if (p.endsWith(`${path.join('tools', 'node_modules', 'repomix', 'package.json')}`)) return { version: '1.16.0' };
    if (p.endsWith('mcp.json')) return { mcpServers: { playwright: {}, postgres: {} } };
    return null;
  };
  const r = evaluateChecklist(probes({
    commands: { ...okNode, ...okPy, ...okGit },
    readJson,
  }), { pins });
  assert.equal(r.rows.find((x) => x.id === 'repomix').status, STATUS.OK);
  assert.equal(r.fail.length, 0);
});

test('não vaza valor de chave, URI nem beacon', () => {
  const secret = 'sk-SUPERSECRET-nao-imprimir';
  const uri = 'postgresql://user:s3cret@localhost/db';
  const r = evaluateChecklist(probes({
    commands: { ...okNode, ...okPy, ...okGit },
    env: { VJP_LLM_API_KEY: secret, DATABASE_URI: uri, HEADROOM_BEACON: 'ligado-secreto' },
    readJson: (p) => (p.endsWith('mcp.json')
      ? { mcpServers: { postgres: { env: { DATABASE_URI: uri } } } }
      : p.endsWith('package.json') ? { version: '1.16.0' } : null),
  }), { pins });
  const blob = JSON.stringify(r) + formatChecklist(r);
  assert.equal(blob.includes(secret), false);
  assert.equal(blob.includes(uri), false);
  assert.equal(blob.includes('s3cret'), false);
  assert.equal(blob.includes('ligado-secreto'), false);
  assert.match(blob, /definida/);
});

test('CLI ausente traz o comando oficial da plataforma', () => {
  const r = evaluateChecklist(probes({
    platform: 'darwin',
    commands: { ...okNode, ...okPy, ...okGit },
  }), { pins });
  const claude = r.rows.find((x) => x.id === 'cli-claude');
  assert.equal(claude.status, STATUS.AVISO);
  assert.match(claude.fix, /claude\.ai\/install\.sh/);
  const cursor = r.rows.find((x) => x.id === 'cli-cursor');
  assert.match(cursor.fix, /cursor\.com\/install/);
});

test('Headroom fora do pin é AVISO com o uv tool install pinado', () => {
  const r = evaluateChecklist(probes({
    commands: {
      ...okNode, ...okPy, ...okGit,
      'headroom --version': { ok: true, stdout: 'headroom 0.1.0\n' },
    },
  }), { pins });
  const hr = r.rows.find((x) => x.id === 'headroom');
  assert.equal(hr.status, STATUS.AVISO);
  assert.match(hr.fix, /headroom-ai\[proxy,code\]==0\.39\.1/);
});

test('runCommand recusa metacaractere de shell', () => {
  assert.equal(runCommand('node', ['--version;whoami']).ok, false);
  assert.equal(runCommand('node & calc', ['--version']).ok, false);
});

test('probe ao vivo não imprime valor de ambiente e reconhece o Node', () => {
  const r = evaluateChecklist(liveProbes());
  assert.equal(r.rows.find((x) => x.id === 'node').status, STATUS.OK);
  const blob = JSON.stringify(r);
  for (const key of ['VJP_LLM_API_KEY', 'DATABASE_URI', 'CURSOR_API_KEY', 'SUPABASE_ACCESS_TOKEN']) {
    const val = process.env[key];
    if (val && val.length > 8) assert.equal(blob.includes(val), false, key);
  }
});
