#!/usr/bin/env bash
#
# V-JP Harness — instalador / bootstrap
# Copia o motor do harness para .harness/ no projeto-alvo, renderiza as regras da
# fonte única core/ para Codex/Claude Code/Antigravity/Cursor (sync-rules.js), instala as
# ferramentas pinadas e faz o scaffold de .gbrain/ e .bsd/.
#
# Uso:
#   bash install.sh [DIRETORIO_ALVO] [opções]
#
# Opções:
#   --target <dir>   Projeto-alvo (default: diretório atual)
#   --name <nome>    Nome do projeto no harness.yaml (default: basename do alvo)
#   --no-install     Não roda `npm install` (copia só os arquivos)
#   --no-vendor      Não clona os componentes git pinados (GBrain/Superpowers)
#   --force          Sobrescreve um .harness/ já existente
#   --yes            Modo não-interativo (CI): assume "sim" em tudo
#   --help           Mostra esta ajuda
#
set -euo pipefail

# ---- localização do próprio repositório (onde vivem template/ e seed/) ----
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
REPO_DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"
TEMPLATE_DIR="$REPO_DIR/template"
SEED_DIR="$REPO_DIR/seed"

# ---- cores ----
if [ -t 1 ]; then
  C_RESET='\033[0m'; C_BOLD='\033[1m'; C_DIM='\033[2m'
  C_RED='\033[31m'; C_GREEN='\033[32m'; C_YELLOW='\033[33m'; C_CYAN='\033[36m'
else
  C_RESET=''; C_BOLD=''; C_DIM=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_CYAN=''
fi
info()  { printf "${C_CYAN}▸${C_RESET} %s\n" "$1"; }
ok()    { printf "${C_GREEN}✔${C_RESET} %s\n" "$1"; }
warn()  { printf "${C_YELLOW}⚠${C_RESET} %s\n" "$1"; }
err()   { printf "${C_RED}✗ %s${C_RESET}\n" "$1" >&2; }
die()   { err "$1"; exit 1; }
sed_in_place() {
  local expr="$1"; shift
  if sed --version >/dev/null 2>&1; then
    sed -i "$expr" "$@"
  else
    sed -i '' "$expr" "$@"
  fi
}

MIN_NODE_MAJOR=18

usage() { awk '/^set -euo pipefail/{exit} NR>=2{sub(/^# ?/,""); print}' "$SOURCE"; exit 0; }

# ---- parse de argumentos ----
TARGET=""; PROJECT_NAME=""; DO_INSTALL=1; FORCE=0; ASSUME_YES=0; DO_VENDOR=1
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="${2:-}"; shift 2;;
    --name)   PROJECT_NAME="${2:-}"; shift 2;;
    --no-install) DO_INSTALL=0; shift;;
    --no-vendor) DO_VENDOR=0; shift;;
    --force)  FORCE=1; shift;;
    --yes|-y) ASSUME_YES=1; shift;;
    --help|-h) usage;;
    -*) die "Opção desconhecida: $1 (use --help)";;
    *)  [ -z "$TARGET" ] && TARGET="$1" || die "Argumento extra: $1"; shift;;
  esac
done

TARGET="${TARGET:-$(pwd)}"
[ -d "$TARGET" ] || die "Diretório-alvo não existe: $TARGET"
TARGET="$(cd "$TARGET" && pwd)"
PROJECT_NAME="${PROJECT_NAME:-$(basename "$TARGET")}"

printf "\n${C_BOLD}${C_CYAN}=== V-JP Harness — instalação ===${C_RESET}\n"
info "Projeto-alvo : $TARGET"
info "Nome         : $PROJECT_NAME"
info "Fonte        : $REPO_DIR"

# ---- pré-requisitos ----
[ -d "$TEMPLATE_DIR" ] || die "template/ não encontrado em $REPO_DIR (repo corrompido?)"
command -v node >/dev/null 2>&1 || die "Node.js não encontrado no PATH."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  die "Node $MIN_NODE_MAJOR+ requerido (encontrado: $(node --version))."
fi
ok "Node $(node --version) OK"
command -v git >/dev/null 2>&1 && ok "git disponível (worktrees habilitadas)" \
  || warn "git não encontrado — bsd.js cairá no modo de diretório isolado (fallback)."

# ---- proteção contra sobrescrita ----
HARNESS_DIR="$TARGET/.harness"
if [ -d "$HARNESS_DIR" ] && [ "$FORCE" -ne 1 ]; then
  if [ "$ASSUME_YES" -eq 1 ]; then
    die ".harness/ já existe. Use --force para sobrescrever."
  fi
  printf "${C_YELLOW}.harness/ já existe.${C_RESET} Sobrescrever o motor (gbrain/bsd preservados)? [y/N] "
  read -r ans; [[ "$ans" =~ ^[Yy]$ ]] || die "Abortado pelo usuário."
  FORCE=1
fi

# ---- copia do motor ----
info "Copiando motor para .harness/ ..."
mkdir -p "$HARNESS_DIR"
cp -R "$TEMPLATE_DIR/." "$HARNESS_DIR/"
# substituição de placeholders
sed_in_place "s|__PROJECT_NAME__|$PROJECT_NAME|g" "$HARNESS_DIR/harness.yaml"
# diretório de contexto (regenerável)
mkdir -p "$HARNESS_DIR/context"
[ -f "$SEED_DIR/context/README.md" ] && cp "$SEED_DIR/context/README.md" "$HARNESS_DIR/context/README.md"
ok "Motor copiado (harness.yaml, registry.json, REGISTRY.md, INSTALL.md, AGENT_RULES.md, tools/, config/)"

# ---- subagentes especialistas (camada interativa Claude Code) ----
if [ -d "$TEMPLATE_DIR/agents" ]; then
  AGENTS_DIR="$TARGET/.claude/agents"
  mkdir -p "$AGENTS_DIR"
  cp "$TEMPLATE_DIR"/agents/*.md "$AGENTS_DIR/" 2>/dev/null || true
  ok "Subagentes instalados em .claude/agents/ (backend/frontend/db/integration-verifier/nfr-performance-planner)"
fi

# ---- regras da fonte única core/ → cada ferramenta (v2.0.0, idempotente) ----
# AGENTS.md (Codex/AGY/Cursor) e CLAUDE.md (@imports) recebem um BLOCO GERENCIADO
# (<!-- vjp-harness:start/end -->): o resto do arquivo do projeto é preservado, e o bloco v1
# (que apontava para .harness/AGENT_RULES.md) é migrado no lugar. Também grava .harness/core/,
# .agents/rules/ (AGY, trigger), .cursor/rules/*.mdc, skill projeto-novo (.agents/ e .claude/)
# e o hook Codex do orçamento de teste em .codex/hooks.json (caminho via git rev-parse).
SYNC_RULES="$TEMPLATE_DIR/tools/sync-rules.js"
if [ -f "$SYNC_RULES" ] && [ -f "$REPO_DIR/core/manifest.json" ]; then
  if node "$SYNC_RULES" --target "$TARGET" --quiet; then
    ok "Regras de core/ renderizadas: AGENTS.md · CLAUDE.md (@imports) · .agents/rules · .cursor/rules · skill projeto-novo · .codex/hooks.json"
  else
    warn "sync-rules falhou (mensagem acima) — o resto da instalação segue. Corrija e rode: node .harness/tools/sync-rules.js"
  fi
else
  warn "core/ ou sync-rules.js ausente neste checkout — regras cross-tool não renderizadas."
fi

# ---- scaffold do .gbrain (preserva existente) ----
GBRAIN_DIR="$TARGET/.gbrain"
if [ -d "$GBRAIN_DIR" ]; then
  warn ".gbrain/ já existe — preservado (não sobrescrito)."
else
  info "Criando .gbrain/ a partir dos seeds ..."
  mkdir -p "$GBRAIN_DIR"
  cp -R "$SEED_DIR/gbrain/." "$GBRAIN_DIR/"
  sed_in_place "s|__PROJECT_NAME__|$PROJECT_NAME|g" "$GBRAIN_DIR/project.md"
  sed_in_place "s|__GBRAIN_DB_PATH__|$GBRAIN_DIR/brain.pglite|g" "$GBRAIN_DIR/config.json"
  ok ".gbrain/ criado (memória persistente dos agentes)"
fi

# ---- scaffold do .bsd ----
BSD_DIR="$TARGET/.bsd"
if [ ! -d "$BSD_DIR" ]; then
  info "Criando .bsd/ (estado de execução) ..."
  mkdir -p "$BSD_DIR/worktrees"
  : > "$BSD_DIR/history.jsonl"
  printf '# 📊 Painel de Controle BSD\n\nNenhum pipeline ativo. Use `node .harness/tools/bsd.js --execute <feature>`.\n' > "$BSD_DIR/STATE.md"
  ok ".bsd/ criado"
else
  warn ".bsd/ já existe — preservado."
fi

# ---- .gitignore do projeto ----
GITIGNORE="$TARGET/.gitignore"
add_ignore() { grep -qxF "$1" "$GITIGNORE" 2>/dev/null || echo "$1" >> "$GITIGNORE"; }
if [ -e "$GITIGNORE" ] || [ -d "$TARGET/.git" ]; then
  info "Atualizando .gitignore ..."
  add_ignore ".harness/tools/node_modules/"
  add_ignore ".claude/settings.local.json"
  add_ignore ".harness/tools/gbrain/"
  add_ignore ".harness/tools/superpowers/"
  add_ignore ".harness/context/repo-packed.md"
  add_ignore ".bsd/worktrees/"
  add_ignore ".bsd/history.jsonl"
  add_ignore ".gbrain/brain.pglite/"
  add_ignore ".codebase-memory/"
  ok ".gitignore atualizado"
fi

# ---- instalação determinística das ferramentas pinadas ----
if [ "$DO_INSTALL" -eq 1 ]; then
  if [ -f "$HARNESS_DIR/tools/package-lock.json" ]; then
    info "Instalando ferramentas pinadas via npm ci (lockfile — determinístico) ..."
    ( cd "$HARNESS_DIR/tools" && npm ci --no-audit --no-fund --loglevel=error )
  else
    warn "Sem package-lock.json — usando npm install (menos determinístico)."
    ( cd "$HARNESS_DIR/tools" && npm install --no-audit --no-fund --loglevel=error )
  fi
  ok "Ferramentas instaladas (repomix, gsd, codebase-memory-mcp 0.10.8, playwright-mcp)"
  # v1.21.0 — grafo de código: sem UI (porta 9749) nem watcher; a porta cbm.js chama em modo cli
  CBM_BIN="$HARNESS_DIR/tools/node_modules/codebase-memory-mcp/bin.js"
  if [ -f "$CBM_BIN" ]; then
    node "$CBM_BIN" config set ui_enabled false >/dev/null 2>&1 || true
    node "$CBM_BIN" config set auto_watch false >/dev/null 2>&1 || true
    if command -v claude >/dev/null 2>&1 && ! ( cd "$TARGET" && claude mcp get codebase-memory >/dev/null 2>&1 ); then
      ( cd "$TARGET" && claude mcp add -s local codebase-memory -- node .harness/tools/node_modules/codebase-memory-mcp/bin.js >/dev/null 2>&1 ) \
        && ok "MCP codebase-memory registrado em escopo LOCAL deste projeto (nunca global)" \
        || warn "não registrei o MCP local; opcional — a porta cbm.js funciona sem ele"
    fi
    info "Indexe quando quiser: node .harness/tools/cbm.js index  (impact/callers/find — ver tools/codebase-memory-mcp.md)"
  fi
  info "Postgres MCP Pro (crystaldba) roda fora do npm: 'uvx postgres-mcp==0.3.0' ou Docker. Ver tools/postgres-mcp.md."
else
  warn "npm install pulado (--no-install). Rode depois: (cd .harness/tools && npm ci)"
fi

# ---- vendorização determinística dos componentes git ----
if [ "$DO_VENDOR" -eq 1 ]; then
  if command -v git >/dev/null 2>&1; then
    info "Vendorizando componentes git pinados (GBrain/Superpowers) ..."
    ( cd "$TARGET" && node .harness/tools/vendor.js ) || warn "Vendorização com pendências (rede?). Rode depois: node .harness/tools/bsd.js --vendor"
  else
    warn "git ausente — vendorização pulada."
  fi
else
  warn "Vendorização pulada (--no-vendor). Rode depois: node .harness/tools/bsd.js --vendor"
fi

# ---- verificação de determinismo (doctor) ----
if [ "$DO_INSTALL" -eq 1 ]; then
  info "Verificando determinismo (registry.json) ..."
  if ( cd "$TARGET" && node .harness/tools/verify.js ); then
    :
  else
    warn "Doctor reportou pendências (opcionais ausentes não bloqueiam). Veja acima e REGISTRY.md."
  fi
fi

printf "\n${C_BOLD}${C_GREEN}✔ Harness instalado em %s${C_RESET}\n" "$TARGET"
printf "${C_DIM}Próximos passos:${C_RESET}\n"
printf "  1. Edite ${C_BOLD}.gbrain/project.md${C_RESET} e ${C_BOLD}.gbrain/architecture.md${C_RESET} com o contexto do projeto\n"
printf "  2. Rode ${C_BOLD}node .harness/tools/bsd.js --status${C_RESET} para ver o painel\n"
printf "  3. Execute uma feature: ${C_BOLD}node .harness/tools/bsd.js --execute minha-feature${C_RESET}\n"
printf "  4. Projeto do zero: skill ${C_BOLD}projeto-novo${C_RESET} (Claude /projeto-novo · Codex \$projeto-novo · AGY /projeto-novo)\n"
printf "  5. Regras vêm de ${C_BOLD}core/${C_RESET} do vjp-harness (não edite os gerados); drift: ${C_BOLD}node .harness/tools/sync-rules.js --check${C_RESET}\n\n"
