#!/usr/bin/env bash
#
# V-JP Harness — instalador / bootstrap
# Copia o motor do harness para .harness/ no projeto-alvo, instala as
# ferramentas pinadas e faz o scaffold de .gbrain/ e .bsd/.
#
# Uso:
#   bash install.sh [DIRETORIO_ALVO] [opções]
#
# Opções:
#   --target <dir>   Projeto-alvo (default: diretório atual)
#   --name <nome>    Nome do projeto no harness.yaml (default: basename do alvo)
#   --no-install     Não roda `npm install` (copia só os arquivos)
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

MIN_NODE_MAJOR=18

usage() { sed -n '2,22p' "$SOURCE" | sed 's/^# \{0,1\}//'; exit 0; }

# ---- parse de argumentos ----
TARGET=""; PROJECT_NAME=""; DO_INSTALL=1; FORCE=0; ASSUME_YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="${2:-}"; shift 2;;
    --name)   PROJECT_NAME="${2:-}"; shift 2;;
    --no-install) DO_INSTALL=0; shift;;
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
sed -i "s|__PROJECT_NAME__|$PROJECT_NAME|g" "$HARNESS_DIR/harness.yaml"
ok "Motor copiado (harness.yaml, AGENT_RULES.md, tools/, config/)"

# ---- scaffold do .gbrain (preserva existente) ----
GBRAIN_DIR="$TARGET/.gbrain"
if [ -d "$GBRAIN_DIR" ]; then
  warn ".gbrain/ já existe — preservado (não sobrescrito)."
else
  info "Criando .gbrain/ a partir dos seeds ..."
  mkdir -p "$GBRAIN_DIR"
  cp -R "$SEED_DIR/gbrain/." "$GBRAIN_DIR/"
  sed -i "s|__PROJECT_NAME__|$PROJECT_NAME|g" "$GBRAIN_DIR/project.md"
  sed -i "s|__GBRAIN_DB_PATH__|$GBRAIN_DIR/brain.pglite|g" "$GBRAIN_DIR/config.json"
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
  add_ignore ".harness/context/"
  add_ignore ".bsd/worktrees/"
  add_ignore ".bsd/history.jsonl"
  add_ignore ".gbrain/brain.pglite/"
  ok ".gitignore atualizado"
fi

# ---- instalação das ferramentas pinadas ----
if [ "$DO_INSTALL" -eq 1 ]; then
  info "Instalando ferramentas pinadas (repomix, gsd) ..."
  ( cd "$HARNESS_DIR/tools" && npm install --no-audit --no-fund --loglevel=error )
  ok "Ferramentas instaladas em .harness/tools/node_modules/"
else
  warn "npm install pulado (--no-install). Rode depois: (cd .harness/tools && npm install)"
fi

printf "\n${C_BOLD}${C_GREEN}✔ Harness instalado em %s${C_RESET}\n" "$TARGET"
printf "${C_DIM}Próximos passos:${C_RESET}\n"
printf "  1. Edite ${C_BOLD}.gbrain/project.md${C_RESET} e ${C_BOLD}.gbrain/architecture.md${C_RESET} com o contexto do projeto\n"
printf "  2. Rode ${C_BOLD}node .harness/tools/bsd.js --status${C_RESET} para ver o painel\n"
printf "  3. Execute uma feature: ${C_BOLD}node .harness/tools/bsd.js --execute minha-feature${C_RESET}\n\n"
