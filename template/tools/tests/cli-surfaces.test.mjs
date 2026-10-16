import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  versionAtLeast, mergeCodexConfig, renderAgyCliRule, renderCodexWorktreeMap, CLAUDE_MIN_VERSION,
} from '../cli-surfaces.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SESSION = path.join(ROOT, 'machine/hooks/cli-session-start.mjs');
const INSTALL = path.join(ROOT, 'machine/hooks/install-claude-plugins.sh');

test('versão do Claude Code: 2.1.296 entra, 2.1.295 fica de fora', () => {
  assert.equal(versionAtLeast('2.1.296', CLAUDE_MIN_VERSION), true);
  assert.equal(versionAtLeast('2.1.300', CLAUDE_MIN_VERSION), true);
  assert.equal(versionAtLeast('2.2.0', CLAUDE_MIN_VERSION), true);
  assert.equal(versionAtLeast('2.1.295', CLAUDE_MIN_VERSION), false);
  assert.equal(versionAtLeast('1.9.9', CLAUDE_MIN_VERSION), false);
});

test('config.toml do Codex não sobrescreve opt-out e não inventa chave do daemon', () => {
  const created = mergeCodexConfig('');
  assert.match(created, /worktrees = true/);
  assert.doesNotMatch(created, /daemon_auto_start/);
  assert.equal(mergeCodexConfig(created), created);
  const opted = '# meu\n[features]\nworktrees = false\n';
  assert.equal(mergeCodexConfig(opted), opted);
  const kept = mergeCodexConfig('model = "gpt-5.4"\n');
  assert.match(kept, /model = "gpt-5.4"/);
  assert.match(kept, /worktrees = true/);
});

test('regra AGY cita agy e não fixa Gemini 4 Argon como default', () => {
  const rule = renderAgyCliRule();
  assert.match(rule, /^---\ntrigger: always_on\n/);
  assert.match(rule, /comando é `agy`/);
  assert.match(rule, /não o define como modelo padrão/);
  assert.match(rule, /agy --model="Gemini 4 Argon"/);
  const map = JSON.parse(renderCodexWorktreeMap());
  assert.equal(map.feature, 'worktrees');
  assert.equal(map.daemon.defaultEnabled, true);
});

function runSession(surface, raw, cache) {
  return execFileSync(process.execPath, [SESSION, surface], {
    input: raw,
    encoding: 'utf8',
    env: { ...process.env, VJP_CLI_CACHE_DIR: cache },
  });
}

test('SessionStart Codex avisa o daemon uma vez e não bloqueia; a segunda na mesma sessão sai vazia', () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-cli-cache-'));
  const raw = JSON.stringify({ session_id: 'thr_1', hook_event_name: 'SessionStart' });
  const first = JSON.parse(runSession('codex', raw, cache));
  assert.equal(first.continue, true);
  assert.match(first.systemMessage, /daemon_auto_start/);
  assert.match(first.systemMessage, /não foi bloqueada/);
  assert.match(first.hookSpecificOutput.additionalContext, /\$CODEX_HOME\/worktrees/);
  assert.match(first.hookSpecificOutput.additionalContext, /\.bsd\/worktrees/);
  assert.equal(runSession('codex', raw, cache).trim(), '{}');
  const again = JSON.parse(runSession('codex', JSON.stringify({ session_id: 'thr_2' }), cache));
  assert.equal(again.systemMessage, undefined);
  assert.match(again.hookSpecificOutput.additionalContext, /worktrees/);
});

test('SessionStart Claude sugere auditoria sem bloquear e nota Headroom', () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-cli-cache-'));
  const raw = JSON.stringify({ session_id: 's1', hook_event_name: 'SessionStart' });
  const first = JSON.parse(runSession('claude', raw, cache));
  assert.equal(first.continue, true);
  assert.match(first.systemMessage, /auditoria periódica/);
  assert.match(first.hookSpecificOutput.additionalContext, /2\.1\.296/);
  assert.match(first.hookSpecificOutput.additionalContext, /autoCompactWindow/);
  assert.doesNotMatch(JSON.stringify(first), /fable/i);
});

test('instalador de plugins não chama o claude real: ausente, velho e novo', () => {
  const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';
  if (!fs.existsSync(bash) && process.platform === 'win32') return;
  const toPosix = (p) => p.replace(/\\/g, '/');
  const missingBin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-noclaude-')), 'claude');
  const missing = execFileSync(bash, [toPosix(INSTALL)], {
    encoding: 'utf8',
    env: { ...process.env, VJP_CLAUDE_BIN: toPosix(missingBin) },
  });
  assert.match(missing, /claude ausente/);

  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-fake-claude-'));
  const log = path.join(bin, 'log.txt');
  const fakePath = path.join(bin, 'claude');
  const writeFake = (version) => {
    const body = [
      '#!/usr/bin/env bash',
      'if [ "${1:-}" = "--version" ]; then echo "' + version + '"; exit 0; fi',
      'printf "%s\\n" "$*" >> "' + toPosix(log) + '"',
      'exit 0',
      '',
    ].join('\n');
    fs.writeFileSync(fakePath, body);
    fs.chmodSync(fakePath, 0o755);
  };
  writeFake('2.1.295 (Claude Code)');
  const old = execFileSync(bash, [toPosix(INSTALL)], {
    encoding: 'utf8',
    env: { ...process.env, VJP_CLAUDE_BIN: toPosix(fakePath) },
  });
  assert.match(old, /2\.1\.295 < 2\.1\.296/);
  assert.equal(fs.existsSync(log), false);

  writeFake('2.1.296 (Claude Code)');
  const fresh = execFileSync(bash, [toPosix(INSTALL)], {
    encoding: 'utf8',
    env: { ...process.env, VJP_CLAUDE_BIN: toPosix(fakePath) },
  });
  assert.match(fresh, /claude-code-setup@claude-plugins-official/);
  const recorded = fs.readFileSync(log, 'utf8');
  assert.match(recorded, /plugin marketplace add anthropics\/claude-plugins-official/);
  assert.match(recorded, /plugin install claude-code-setup@claude-plugins-official --scope user -y/);
  assert.match(recorded, /plugin install receipts@claude-plugins-official --scope user -y/);
});
