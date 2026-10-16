#!/usr/bin/env bash
# harness-guard.sh — V-JP Harness: guard de sessão (AVISA, nunca bloqueia).
#
# Objetivo (João Pedro): "não quero correr risco de trabalhar sem isso preconfigurado."
# Ao editar CÓDIGO-FONTE num projeto SEM .harness/, avisa e oferece o comando de instalar.
#
# Decisão de força: AVISAR, NUNCA BLOQUEAR (ver specs/harness-ambiente/spec.md).
#   Bloquear dispararia em todo repo de terceiro e viraria estorvo -> o usuário desligaria
#   o guard inteiro (proteção zero). Um aviso que ele VÊ vale mais que um bloqueio que contorna.
#
# Contrato Claude Code (PreToolUse, type=command):
#   stdin  : JSON com .session_id e .tool_input.file_path
#   stdout : JSON { "systemMessage": "..." }  (mostrado ao usuário)
#   exit   : SEMPRE 0 — o guard jamais impede o trabalho (nem quando ele próprio falha).
#
# Silencia quando: projeto tem .harness/ · tem .harness-opt-out · arquivo não é código-fonte ·
#                  já avisou neste projeto nesta sessão · qualquer erro interno.
#
# Autor: João Pedro (V-JP)

# Blindagem: qualquer erro daqui pra frente sai quieto com 0 (nunca trava o usuário).
trap 'exit 0' ERR

INPUT="$(cat 2>/dev/null || true)"
[ -z "$INPUT" ] && exit 0

# --- extrai file_path e session_id do JSON (node é garantido: o harness exige Node >= 18) ---
read -r FILE SESSION <<EOF
$(printf '%s' "$INPUT" | node -e '
  let s = "";
  process.stdin.on("data", d => s += d).on("end", () => {
    try {
      const j = JSON.parse(s);
      const raw = (j.tool_input && (j.tool_input.file_path || j.tool_input.path)) || "";
      const f = raw.replace(/\\/g, "/");
      const sid = j.session_id || "nosession";
      if (!f || /\s/.test(f)) { console.log(" " + sid); return; }  // path vazio/com espaço: ignora
      console.log(f + " " + sid);
    } catch { console.log(" nosession"); }
  });
' 2>/dev/null || true)
EOF

[ -z "${FILE:-}" ] && exit 0
[ -e "$FILE" ] || [ -d "$(dirname "$FILE")" ] || exit 0

# --- 1) é código-fonte? (doc/config/teste não avisam) ---
case "$FILE" in
  *.test.*|*.spec.*|*/__tests__/*|*/test/*|*/tests/*|*/e2e/*|*/__mocks__/*) exit 0 ;;
esac
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py|*.go|*.rb|*.rs|*.java|*.kt|*.php|*.cs|*.cpp|*.c|*.h|*.sql|*.sh|*.vue|*.svelte) : ;;
  *) exit 0 ;;   # .md, .json, .yaml, .toml, etc.
esac

# --- 2) acha a raiz do projeto (git; senão, o diretório do arquivo) ---
DIR="$(dirname "$FILE")"
ROOT="$(git -C "$DIR" rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$ROOT" ] && exit 0            # fora de repo: não é "projeto" — fica quieto

# --- 3) já tem harness? tem opt-out? ---
[ -d "$ROOT/.harness" ] && exit 0
[ -e "$ROOT/.harness-opt-out" ] && exit 0

# --- 4) já avisou neste projeto nesta sessão? (1x por projeto/sessão) ---
STATE_DIR="${VJP_GUARD_STATE_DIR:-${TMPDIR:-/tmp}/vjp-harness-guard}"
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0
# node, não shasum: no Windows o perl do shasum sai vazio quando o PATH é o do processo pai.
KEY="$(printf '%s|%s' "${SESSION:-nosession}" "$ROOT" | node -e '
  let s = "";
  process.stdin.on("data", d => s += d).on("end", () => {
    process.stdout.write(require("crypto").createHash("sha256").update(s).digest("hex").slice(0, 32));
  });
' 2>/dev/null || true)"
[ -z "$KEY" ] && exit 0
MARK="$STATE_DIR/$KEY"
[ -e "$MARK" ] && exit 0             # já avisou: silêncio
: > "$MARK" 2>/dev/null || true

# --- 5) avisa (e deixa passar) ---
PROJ="$(basename "$ROOT")"
MSG="⚠  PROJETO SEM HARNESS — ${PROJ}

Você está editando código em um projeto sem .harness/ — sem portões (definição de pronto),
sem spec-driven, sem registro de decisão. O método V-JP não está ativo aqui.

Para instalar:
  bash ~/.local/share/vjp-harness/install.sh --target \"${ROOT}\" --name \"${PROJ}\" --yes

Para silenciar neste projeto (ex.: repo de terceiro):
  touch \"${ROOT}/.harness-opt-out\"

(a edição continua normalmente — este guard nunca bloqueia)"

printf '%s' "$MSG" | node -e '
  let s = "";
  process.stdin.on("data", d => s += d).on("end", () => {
    process.stdout.write(JSON.stringify({ systemMessage: s }));
  });
' 2>/dev/null || true

exit 0
