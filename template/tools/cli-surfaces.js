/**
 * Superfícies de CLI do V-JP Harness (escopo clis).
 * O sync-rules.js é o roteador: ao instalar, grava o destino de cada CLI.
 * Não inventa chave de config. Codex só recebe features.worktrees (oficial, estável,
 * default true desde o CLI 0.162). O mapa de caminhos fica em .codex/vjp-cli.json
 * porque --strict-config rejeita campo desconhecido no config.toml.
 */
export const SESSION_HOOK_SCRIPT = 'cli-session-start.sh';
export const SESSION_HOOK_MODULE = 'cli-session-start.mjs';
export const CODEX_CONFIG_START = '# vjp-harness:codex:start';
export const CODEX_CONFIG_END = '# vjp-harness:codex:end';
export const CODEX_SESSION_MATCHER = 'startup|resume|clear|compact';
export const CLAUDE_SESSION_MATCHER = 'startup|resume|clear|compact|fork';
export const CLAUDE_MIN_VERSION = '2.1.296';
export const OFFICIAL_PLUGINS = ['claude-code-setup', 'receipts'];
export const OFFICIAL_MARKETPLACE = 'claude-plugins-official';
export const OFFICIAL_MARKETPLACE_REPO = 'anthropics/claude-plugins-official';

const CODEX_BLOCK = `${CODEX_CONFIG_START}
# features.worktrees — Codex CLI >= 0.162, chave oficial, estágio estável, default true.
# Mapa de caminhos: .codex/vjp-cli.json (não entra no config.toml: --strict-config recusa chave desconhecida).
[features]
worktrees = true
${CODEX_CONFIG_END}
`;

export function versionAtLeast(found, min) {
  const parse = (s) => String(s || '').split('.').map((n) => {
    const x = parseInt(n, 10);
    return Number.isFinite(x) ? x : 0;
  });
  const a = parse(found);
  const b = parse(min);
  for (let i = 0; i < 3; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true;
}

export function renderCodexWorktreeMap() {
  return JSON.stringify({
    surface: 'codex',
    router: 'sync-rules destino codex',
    minCli: '0.162.0',
    feature: 'worktrees',
    featureStage: 'stable',
    featureDefault: true,
    invoke: {
      flag: '--worktree',
      slash: '/worktree',
      tools: ['create_worktree', 'get_worktree_creation_status', 'list_worktrees'],
    },
    managedRoot: '$CODEX_HOME/worktrees',
    managedCheckout: 'detached HEAD',
    maestroRoot: '.bsd/worktrees/<feature>',
    maestroCheckout: 'branch própria do Maestro (bsd.js)',
    daemon: {
      since: '0.157.0',
      feature: 'daemon_auto_start',
      featureStage: 'stable',
      defaultEnabled: true,
      sessionFlag: '--no-daemon',
      disable: 'codex features disable daemon_auto_start',
      stop: 'codex app-server daemon stop',
    },
  }, null, 2) + '\n';
}

function ensureNl(s) {
  return s.replace(/\n*$/, '\n');
}

// Acrescenta features.worktrees = true só quando a chave ainda não existe.
// Opt-out do usuário (worktrees = false) permanece.
export function mergeCodexConfig(currentText) {
  const raw = currentText == null ? '' : String(currentText);
  const cur = raw.replace(/\r\n?/g, '\n');
  const i = cur.indexOf(CODEX_CONFIG_START);
  const j = i >= 0 ? cur.indexOf(CODEX_CONFIG_END, i) : -1;
  if (i >= 0 && j >= 0) {
    return ensureNl(cur.slice(0, i) + CODEX_BLOCK + cur.slice(j + CODEX_CONFIG_END.length));
  }
  if (/^\s*worktrees\s*=/m.test(cur)) return raw === '' ? raw : (raw.endsWith('\n') ? raw : raw + '\n');
  const base = cur.trim() ? cur.replace(/\n*$/, '\n\n') : '';
  return base + CODEX_BLOCK;
}

export function sessionHookCommand(scriptRel, surface) {
  if (surface !== 'codex' && surface !== 'claude') throw new Error(`superfície desconhecida: ${surface}`);
  return `f="$(git rev-parse --show-toplevel 2>/dev/null)/${scriptRel}"; [ -f "$f" ] || exit 0; exec bash "$f" ${surface}`;
}

export function absoluteSessionCommand(scriptAbs, surface) {
  if (surface !== 'codex' && surface !== 'claude') throw new Error(`superfície desconhecida: ${surface}`);
  const q = '"' + String(scriptAbs).replace(/\\/g, '/').replace(/"/g, '\\"') + '"';
  return `[ -f ${q} ] || exit 0; exec bash ${q} ${surface}`;
}

function mergeNamedHook(obj, event, matcher, command, marker) {
  obj.hooks = obj.hooks || {};
  obj.hooks[event] = obj.hooks[event] || [];
  let found = false;
  for (const group of obj.hooks[event]) {
    for (const h of group.hooks || []) {
      if (typeof h.command === 'string' && h.command.includes(marker)) {
        if (found) continue;
        h.type = 'command';
        h.command = command;
        if (!group.matcher) group.matcher = matcher;
        found = true;
      }
    }
  }
  if (!found) obj.hooks[event].push({ matcher, hooks: [{ type: 'command', command }] });
}

export function mergeCodexSessionHook(obj, sessionCommand) {
  mergeNamedHook(obj, 'SessionStart', CODEX_SESSION_MATCHER, sessionCommand, SESSION_HOOK_SCRIPT);
}

// Só SessionStart. Não cria PreToolUse (o hook global não tem o script do orçamento).
export function mergeCodexSessionFile(currentText, sessionCommand) {
  let obj = {};
  if (currentText && String(currentText).trim()) {
    try { obj = JSON.parse(currentText); } catch (e) {
      throw new Error(`.codex/hooks.json inválido (não sobrescrevo): ${e.message}`);
    }
  }
  mergeCodexSessionHook(obj, sessionCommand);
  return JSON.stringify(obj, null, 2) + '\n';
}

export function mergeClaudeSessionHook(currentText, command) {
  let obj = {};
  if (currentText && String(currentText).trim()) {
    try { obj = JSON.parse(currentText); } catch (e) {
      throw new Error(`.claude/settings.json inválido (não sobrescrevo): ${e.message}`);
    }
  }
  mergeNamedHook(obj, 'SessionStart', CLAUDE_SESSION_MATCHER, command, SESSION_HOOK_SCRIPT);
  return JSON.stringify(obj, null, 2) + '\n';
}

function yamlQuote(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

export function renderAgyCliRule() {
  const description = 'Carrega sozinha em toda sessão agy: comando agy (Gemini CLI de conta individual descontinuado), caminhos oficiais e modelo.';
  return [
    '---',
    'trigger: always_on',
    `description: ${yamlQuote(description)}`,
    '---',
    '',
    'Superfície AGY, já ativa neste projeto (trigger always_on). Não espere o usuário pedir.',
    '',
    '- O comando é `agy` (Antigravity CLI). O Gemini CLI (`gemini`) deixou de atender contas individuais em 18/06/2026. Licença Enterprise ou API key pode continuar no binário antigo; sem esse pedido explícito, use `agy`.',
    '- Ajustes persistentes: `~/.gemini/antigravity-cli/settings.json`.',
    '- Regras globais: `~/.gemini/GEMINI.md`. Skills globais: `~/.gemini/antigravity-cli/skills/`. Skills do projeto: `.agents/skills/`.',
    '- Regras do projeto: `AGENTS.md`, `GEMINI.md` e `.agents/rules/`. MCP global: `~/.gemini/config/mcp_config.json`. MCP do projeto: `.agents/mcp_config.json`.',
    '- O caminho antigo `~/.gemini/skills/` e `.gemini/skills/` é do Gemini CLI. O AGY lê `~/.gemini/antigravity-cli/skills/` e `.agents/skills/`.',
    '- Gemini 4 Argon está no Antigravity CLI (App e CLI; não no IDE) para Google AI Pro/Ultra pagos e Enterprise. A documentação não o define como modelo padrão. Persistência oficial: `/model`. Uma execução: `agy --model="Gemini 4 Argon"`. Não grave modelo em settings.json: a chave persistente não está documentada.',
    '- Headroom (`cch` = `headroom wrap claude`) comprime a sessão do Claude Code. Não envolva `agy` nesse proxy e não empilhe outro compressor (rtk, lean-ctx ou um segundo `ANTHROPIC_BASE_URL`).',
    '',
  ].join('\n');
}

export function renderCursorCliRule() {
  const description = 'Carrega sozinha no Cursor (CLI e IDE): superfícies Codex, AGY e Claude Code deste harness.';
  return [
    '---',
    `description: ${yamlQuote(description)}`,
    'globs:',
    'alwaysApply: true',
    '---',
    '',
    'Superfície Cursor, já ativa (alwaysApply). Não espere o usuário pedir.',
    '',
    '- Codex CLI >= 0.162: worktrees gerenciadas em `$CODEX_HOME/worktrees` (detached HEAD; `codex --worktree`, `/worktree`). O Maestro usa `.bsd/worktrees/<feature>` com branch própria. São checkouts diferentes. Mapa gerado: `.codex/vjp-cli.json`.',
    '- Codex >= 0.157: `daemon_auto_start` (default ligado) pode deixar `codex app-server` em segundo plano depois que a janela fecha. Aviso ao usuário, sem bloquear. Opt-out oficial: `codex features disable daemon_auto_start`. Sessão avulsa: `--no-daemon`. Parar: `codex app-server daemon stop`.',
    '- AGY: comando `agy`. Gemini CLI de conta individual descontinuado em 18/06/2026. Gemini 4 Argon não é o default documentado; `/model` ou `agy --model="Gemini 4 Argon"` quando o plano permitir.',
    '- Claude Code: plugins oficiais `claude-code-setup` e `receipts` (`@claude-plugins-official`) só entram se `claude` for >= 2.1.296. O hook SessionStart sugere auditoria periódica e não bloqueia.',
    '- Headroom comprime tool output do Claude Code via proxy local. Não empilhe rtk, lean-ctx nem um segundo proxy. Não abaixe `autoCompactWindow` só porque o Headroom já comprimiu a ferramenta: o auto-compact resume o histórico, é outra camada.',
    '',
  ].join('\n');
}
