#!/usr/bin/env bash
# bootstrap.sh — replica o harness Claude Code do JP em um PC novo (Linux/WSL2).
# Idempotente: re-rodar é seguro. Detalhes e racional em MACHINE.md.
#
# Uso:
#   bash machine/bootstrap.sh                # instalação completa
#   bash machine/bootstrap.sh --with-memory  # também restaura a memória pessoal (se export/memory/ existir)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPORT="$HERE/export"
CLAUDE_DIR="$HOME/.claude"
HEADROOM_VERSION="0.39.1"
NODE_VERSION="24"

WITH_MEMORY=0
[ "${1:-}" = "--with-memory" ] && WITH_MEMORY=1

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------- runtimes
step "1/8 Node.js $NODE_VERSION (via nvm)"
if ! have node || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_VERSION" ]; then
  if [ ! -d "$HOME/.nvm" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  fi
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
  nvm install "$NODE_VERSION" && nvm alias default "$NODE_VERSION"
fi
echo "node: $(node -v)"

step "2/8 Bun"
if ! have bun && [ ! -x "$HOME/.bun/bin/bun" ]; then
  curl -fsSL https://bun.sh/install | bash
fi
export PATH="$HOME/.bun/bin:$PATH"
echo "bun: $(bun --version)"

# ---------------------------------------------------------------- claude code
step "3/8 Claude Code"
have claude || npm install -g @anthropic-ai/claude-code
echo "claude: $(claude --version)"

# ---------------------------------------------------------------- headroom
# Compressor de Contexto (substitui o RTK desde a v1.22.0). Proxy local por sessão:
# `cch` = headroom wrap claude. Sem [ml]/[all]: o torch não faz falta (Kompress em ONNX).
step "4/8 Headroom v$HEADROOM_VERSION"
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
export HEADROOM_BEACON=off
have uv || curl -LsSf https://astral.sh/uv/install.sh | sh
HEADROOM_ATUAL="$(headroom --version 2>/dev/null || true)"
if [[ "$HEADROOM_ATUAL" != *"$HEADROOM_VERSION"* ]]; then
  uv tool install --force --python 3.13 "headroom-ai[proxy,code]==${HEADROOM_VERSION}" || {
    echo "⚠️  instalação do headroom falhou — rode manualmente: uv tool install --python 3.13 \"headroom-ai[proxy,code]==${HEADROOM_VERSION}\""; }
fi
headroom --version || true
# Telemetria é opt-out e vem ligada; porta 8790 porque a 8787 colide com serviço do WSL.
if ! grep -q "# vjp-harness: headroom" "$HOME/.bashrc" 2>/dev/null; then
  cat >> "$HOME/.bashrc" <<'RC'

# vjp-harness: headroom
export HEADROOM_BEACON=off
cch() { headroom wrap claude --port 8790 --code-memory none -- "$@"; }
RC
  echo "HEADROOM_BEACON=off e atalho cch adicionados ao ~/.bashrc"
fi

# ---------------------------------------------------------------- configs ~/.claude
step "5/8 Configs em ~/.claude"
mkdir -p "$CLAUDE_DIR"
for f in CLAUDE.md HEADROOM.md HARNESS.md statusline-context.js; do
  cp -v "$EXPORT/$f" "$CLAUDE_DIR/$f"
done
# v2.0.0: HARNESS.md e AGENTS.md são GERADOS de core/ (sync-rules.js). As regras globais de
# Codex (~/.codex/AGENTS.md — o Codex NÃO lê ~/AGENTS.md), Antigravity (~/.gemini/GEMINI.md)
# e o fan-out das skills saem do sync-rules --global no passo 6.
if [ -f "$CLAUDE_DIR/settings.json" ]; then
  cp "$CLAUDE_DIR/settings.json" "$CLAUDE_DIR/settings.json.pre-bootstrap.$(date +%Y%m%d-%H%M%S)"
  echo "backup do settings.json existente criado"
fi
# Template traz paths /home/jp — reescreve para o $HOME e o node atuais.
NODE_BIN="$(command -v node)"
sed -e "s|/home/jp|$HOME|g" \
    -e "s|$HOME/.nvm/versions/node/v[0-9.]*/bin/node|$NODE_BIN|g" \
    "$EXPORT/settings.template.json" > "$CLAUDE_DIR/settings.json"
echo "settings.json instalado (statusline, guard V-JP, MCPs chrome-devtools+gbrain+context7)"
# RTK aposentado na v1.22.0: remove a referência antiga se sobrou de um bootstrap anterior.
rm -f "$CLAUDE_DIR/RTK.md"

# ---------------------------------------------------------------- skills
step "6/8 Skills (gstack-family + fullstack-validate + arch-review + test-gate + pr-review + prepush + projeto-novo) + regras globais cross-CLI"
mkdir -p "$CLAUDE_DIR/skills"
cp -rv "$EXPORT/skills/." "$CLAUDE_DIR/skills/" | tail -1
echo "skills instaladas: $(ls "$CLAUDE_DIR/skills" | wc -l)"
# v2.0.0 — fonte única core/ → regras globais de cada CLI + skills reais (não-symlink) em
# ~/.claude/skills, ~/.agents/skills (Codex), ~/.gemini/config/skills e ~/.gemini/antigravity-cli/skills (AGY).
# Blocos gerenciados preservam o que já existir em ~/.codex/AGENTS.md e ~/.gemini/GEMINI.md.
SYNC_RULES="$HERE/../template/tools/sync-rules.js"
if [ -f "$SYNC_RULES" ]; then
  node "$SYNC_RULES" --global --quiet || echo "⚠️  sync-rules --global falhou (rode: node $SYNC_RULES --global)"
fi
# prepush: hook global de push (core.hooksPath ~/.githooks) — v1.20
[ -f "$CLAUDE_DIR/skills/prepush/reinstall.sh" ] && bash "$CLAUDE_DIR/skills/prepush/reinstall.sh" | tail -2
echo "⚠️  a skill 'gstack' (browse daemon, 1.5GB) não é vendorizada:"
echo "    instale o gstack pelo instalador oficial e rode /gstack-upgrade na primeira sessão."

# ui-ux-pro-max: skill self-contained (NÃO via plugin marketplace — registry tem paths Windows).
# Clona o repo oficial e re-aplica o patch de caminho. Idempotente.
UIUX_REINSTALL="$HERE/../skills/ui-ux-pro-max/reinstall.sh"
if [ -f "$UIUX_REINSTALL" ]; then
  echo "→ instalando/atualizando skill ui-ux-pro-max"
  bash "$UIUX_REINSTALL" || echo "⚠️  ui-ux-pro-max falhou (rode manualmente: bash $UIUX_REINSTALL)"
fi

# ---------------------------------------------------------------- gbrain
step "7/8 GBrain"
if [ ! -x "$HOME/.bun/bin/gbrain" ]; then
  echo "gbrain ausente — use a skill /setup-gbrain na primeira sessão do Claude Code,"
  echo "ou vendorize pelo registry: node .harness/tools/bsd.js --vendor --only gbrain"
else
  echo "gbrain: $("$HOME/.bun/bin/gbrain" --version)"
fi

# ---------------------------------------------------------------- memória
step "8/8 Memória pessoal"
if [ "$WITH_MEMORY" = 1 ] && [ -d "$EXPORT/memory" ]; then
  MEM_DIR="$CLAUDE_DIR/projects/-home-${USER}/memory"
  mkdir -p "$MEM_DIR" && cp -rv "$EXPORT/memory/." "$MEM_DIR/"
else
  echo "pulada (use --with-memory após copiar ~/.claude/projects/*/memory para export/memory/)"
fi

cat <<'EOF'

✅ Bootstrap concluído. Passos manuais finais:

  1. claude              → fazer /login (credenciais nunca são replicadas)
  2. Instalar gstack     → /gstack-upgrade (recria a skill gstack + browse daemon)
  3. Plugins             → /plugin: reinstalar frontend-design se desejar (vercel já vem no settings)
  4. MCPs com chave      → adicionar só os que usar, com chaves NOVAS (as antigas devem ser rotacionadas):
       claude mcp add brave-search -s user -e BRAVE_API_KEY=<nova> -- npx -y @modelcontextprotocol/server-brave-search
  5. Por projeto         → bash vjp-harness/install.sh --name <projeto>
  6. Codex               → abrir o projeto e aprovar o hook do orçamento em /hooks (o Codex só roda hook confiável)
EOF
