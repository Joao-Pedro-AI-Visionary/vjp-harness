#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pre-push global — V-JP (v1.19)
#
# Substitui a branch protection do GitHub (que exige Pro em repo privado).
# Com a skill /prepush instalada (~/.claude/skills/prepush), roda o gate
# mecânico dela: bloqueia push com branch ATRÁS da base/upstream (faltou pull),
# segredo / .env / caminho pessoal nos commits, ou testes falhando.
# Sem a skill, cai no comportamento antigo: só os testes.
#
# Instalação (uma vez por máquina):
#   mkdir -p ~/.githooks && cp pre-push ~/.githooks/pre-push && chmod +x ~/.githooks/pre-push
#   git config --global core.hooksPath ~/.githooks
# Emergência: git push --no-verify  (fura o gate — fica no seu nome)
# ---------------------------------------------------------------------------
set -uo pipefail
say() { printf '%s\n' "$*" >&2; }

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" || exit 0

# --- 1. Só roda se houver commit novo indo pro remoto -----------------------
ZERO=$(git hash-object --stdin </dev/null | tr '[:xdigit:]' '0')
HAS_WORK=0
while read -r _lref lsha _rref _rsha; do
  [ -z "${lsha:-}" ] && continue
  [ "$lsha" = "$ZERO" ] && continue      # deleção de branch
  HAS_WORK=1
done
[ "$HAS_WORK" -eq 0 ] && exit 0

# --- 2. Node do WSL, não o node.exe do Windows ------------------------------
if [ -n "${WSL_DISTRO_NAME:-}" ] && [[ ":$PATH:" == *":/mnt/c/"* ]]; then
  PATH=$(printf '%s' "$PATH" | tr ':' '\n' | grep -v '^/mnt/c' | paste -sd:); export PATH
fi
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
fi

# --- 3. Gate em camadas (skill /prepush) ------------------------------------
GATE="$HOME/.claude/skills/prepush/scripts/gate.sh"
if [ -f "$GATE" ]; then
  SKIP="estatico,cobertura"
  [ "$(git config --get prepush.hook.testes || echo on)" = "off" ] && SKIP="$SKIP,testes"
  say ""; say "▶ pre-push: gate mecânico do /prepush ($(basename "$REPO_ROOT"))"
  if bash "$GATE" --hook --skip="$SKIP" >/dev/null; then
    say "✔ gate verde — push liberado."; say ""; exit 0
  fi
  say ""; say "✖ PUSH BLOQUEADO pelo gate. Rode /prepush no Claude para sincronizar e corrigir."
  say "  Emergência (fica no seu nome): git push --no-verify"; say ""
  exit 1
fi

# --- 4. Sem a skill: só testes (comportamento v1.18) ------------------------
TEST_CMD=$(git config --get hooks.testcmd || true); SOURCE="git config hooks.testcmd"
if [ -z "$TEST_CMD" ] && [ -f package.json ] && node -e 'process.exit(require("./package.json").scripts?.test?0:1)' 2>/dev/null; then
  TEST_CMD="npm test"; SOURCE="package.json (script test)"
fi
if [ -z "$TEST_CMD" ]; then
  say ""; say "⚠ pre-push: nenhum teste configurado neste repo — push liberado sem gate."
  say "  Para ativar:  git config hooks.testcmd \"<comando de teste>\"  (ou instale a skill /prepush)"; say ""
  exit 0
fi
say ""; say "▶ pre-push: rodando testes antes de subir ($TEST_CMD — $SOURCE)"
OUT=$(mktemp); trap 'rm -f "$OUT"' EXIT
if bash -c "$TEST_CMD" >"$OUT" 2>&1; then say "✔ gate verde — push liberado."; say ""; exit 0; fi
say "✖ PUSH BLOQUEADO — os testes falharam."; say "--- últimas 30 linhas ---"; tail -30 "$OUT" >&2; say "--- fim ---"
say "Conserte os testes antes de subir. Emergência: git push --no-verify"; say ""
exit 1
