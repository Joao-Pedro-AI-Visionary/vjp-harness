/**
 * SessionStart do V-JP (Codex e Claude Code).
 * stdout: um JSON. exit 0. Não bloqueia.
 * additionalContext entra no modelo. systemMessage avisa a pessoa, no máximo
 * 1x/dia (daemon Codex) ou 1x/7 dias (auditoria Claude).
 * Segunda invocação na mesma session_id devolve {} para não duplicar
 * quando o hook global e o do projeto disparam juntos.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const surface = process.argv[2] === 'codex' ? 'codex' : 'claude';

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function cacheDir() {
  const dir = process.env.VJP_CLI_CACHE_DIR || path.join(os.homedir(), '.cache', 'vjp-harness');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sessionId(raw) {
  try {
    const id = JSON.parse(raw).session_id;
    if (!id) return '';
    return String(id).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80);
  } catch { return ''; }
}

function loadMap() {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const p = path.join(root, '.codex', 'vjp-cli.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { /* fora de um git com mapa */ }
  return null;
}

function codexContext(map) {
  const managed = map?.managedRoot || '$CODEX_HOME/worktrees';
  const maestro = map?.maestroRoot || '.bsd/worktrees/<feature>';
  const flag = map?.invoke?.flag || '--worktree';
  const daemon = map?.daemon || {};
  return [
    'Codex CLI >= 0.162: worktrees gerenciadas (feature worktrees, estável, default true).',
    `Invocação oficial: ${flag}, /worktree, ferramentas create_worktree, get_worktree_creation_status, list_worktrees.`,
    `Checkout gerenciado: ${managed} (detached HEAD). Checkout do Maestro: ${maestro} (branch própria). São diretórios diferentes.`,
    `Desde o Codex ${daemon.since || '0.157.0'} a feature ${daemon.feature || 'daemon_auto_start'} (default ligada) pode manter o app-server em segundo plano depois da sessão.`,
    `Opt-out oficial: ${daemon.disable || 'codex features disable daemon_auto_start'}. Sessão avulsa: ${daemon.sessionFlag || '--no-daemon'}. Parar: ${daemon.stop || 'codex app-server daemon stop'}.`,
  ].join(' ');
}

function claudeContext() {
  const wrapped = /127\.0\.0\.1|localhost/.test(process.env.ANTHROPIC_BASE_URL || '');
  const headroom = wrapped
    ? 'ANTHROPIC_BASE_URL aponta para um proxy local: trate como Headroom já ativo e não empilhe outro compressor.'
    : 'Se a sessão estiver sob headroom wrap claude (atalho cch), não empilhe rtk, lean-ctx nem um segundo proxy.';
  return [
    'Claude Code deste harness: plugins oficiais claude-code-setup e receipts (@claude-plugins-official) são instalados quando claude --version é >= 2.1.296.',
    'Auditoria periódica: se o aviso de 7 dias estiver nesta mensagem, ofereça o relatório do plugin receipts e uma passada do claude-code-setup. Não rode a auditoria sozinho e não bloqueie a sessão.',
    headroom,
    'Não abaixe autoCompactWindow só porque o Headroom já comprimiu tool output. O auto-compact resume o histórico; é outra camada.',
  ].join(' ');
}

function due(file, maxAgeMs) {
  let prev = 0;
  try { prev = Number(fs.readFileSync(file, 'utf8')); } catch { prev = 0; }
  if (!prev || Date.now() - prev >= maxAgeMs) {
    fs.writeFileSync(file, String(Date.now()));
    return true;
  }
  return false;
}

function main() {
  const raw = readStdin();
  const cache = cacheDir();
  const sid = sessionId(raw);
  if (sid) {
    const seen = path.join(cache, `session-${sid}`);
    if (fs.existsSync(seen)) {
      process.stdout.write('{}\n');
      return;
    }
    fs.writeFileSync(seen, '');
  }
  const out = { continue: true, hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' } };
  if (surface === 'codex') {
    out.hookSpecificOutput.additionalContext = codexContext(loadMap());
    if (due(path.join(cache, 'daemon-alert-at'), 24 * 3600 * 1000)) {
      out.systemMessage = 'V-JP: Codex 0.157+ pode deixar o app-server em segundo plano (daemon_auto_start, default ligado). Para desligar: codex features disable daemon_auto_start. Esta sessão não foi bloqueada.';
    }
  } else {
    out.hookSpecificOutput.additionalContext = claudeContext();
    if (due(path.join(cache, 'audit-suggest-at'), 7 * 24 * 3600 * 1000)) {
      out.systemMessage = 'V-JP: auditoria periódica disponível pelos plugins receipts e claude-code-setup. A sessão segue; peça o relatório se quiser.';
    }
  }
  process.stdout.write(JSON.stringify(out) + '\n');
}

try { main(); } catch { process.stdout.write('{}\n'); }
