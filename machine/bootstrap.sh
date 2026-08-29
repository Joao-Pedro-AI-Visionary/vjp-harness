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
RTK_VERSION="0.42.3"
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

# ---------------------------------------------------------------- rtk
step "4/8 RTK v$RTK_VERSION"
mkdir -p "$HOME/.local/bin"
if ! "$HOME/.local/bin/rtk" --version 2>/dev/null | grep -q "$RTK_VERSION"; then
  # Release musl estática (x86_64); para ARM use rtk-aarch64-unknown-linux-gnu.tar.gz.
  curl -fsSL "https://github.com/rtk-ai/rtk/releases/download/v${RTK_VERSION}/rtk-x86_64-unknown-linux-musl.tar.gz" \
    | tar xz -C "$HOME/.local/bin" rtk && chmod +x "$HOME/.local/bin/rtk" || {
    echo "⚠️  download do rtk falhou — instale manualmente (release manual ou cargo install)"; }
fi
"$HOME/.local/bin/rtk" --version || true

# ---------------------------------------------------------------- configs ~/.claude
step "5/8 Configs em ~/.claude"
mkdir -p "$CLAUDE_DIR"
for f in CLAUDE.md RTK.md HARNESS.md statusline-context.js; do
  cp -v "$EXPORT/$f" "$CLAUDE_DIR/$f"
done
# Regras globais cross-CLI (codex/opencode/pi genérico leem ~/AGENTS.md).
# Espelho fiel do HARNESS.md — fonte canônica é este repo.
cp -v "$EXPORT/AGENTS.md" "$HOME/AGENTS.md"
if [ -f "$CLAUDE_DIR/settings.json" ]; then
  cp "$CLAUDE_DIR/settings.json" "$CLAUDE_DIR/settings.json.pre-bootstrap.$(date +%Y%m%d-%H%M%S)"
  echo "backup do settings.json existente criado"
fi
# Template traz paths /home/jp — reescreve para o $HOME e o node atuais.
NODE_BIN="$(command -v node)"
sed -e "s|/home/jp|$HOME|g" \
    -e "s|$HOME/.nvm/versions/node/v[0-9.]*/bin/node|$NODE_BIN|g" \
    "$EXPORT/settings.template.json" > "$CLAUDE_DIR/settings.json"
echo "settings.json instalado (hook rtk, statusline, MCPs chrome-devtools+gbrain)"

# ---------------------------------------------------------------- skills
step "6/8 Skills (gstack-family + fullstack-validate + arch-review + test-gate + pr-review)"
mkdir -p "$CLAUDE_DIR/skills"
cp -rv "$EXPORT/skills/." "$CLAUDE_DIR/skills/" | tail -1
echo "skills instaladas: $(ls "$CLAUDE_DIR/skills" | wc -l)"
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
EOF
