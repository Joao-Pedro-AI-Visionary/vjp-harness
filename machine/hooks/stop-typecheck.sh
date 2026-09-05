#!/usr/bin/env bash
# Stop hook genérico: impede o Claude de encerrar o turno com typecheck quebrado.
# Portável — zero referência a projeto: detecta o gerenciador pelo lockfile e o
# comando pelo package.json. Se o projeto não tem TS, sai em silêncio.
# exit 2 = bloqueia o Stop e devolve o erro ao Claude para corrigir.
#
# Codex (VJP_CODEX=1): no máximo 1 continue de typecheck. NUNCA zera o
# test-budget (stop-continue não reseta .bsd/test-budget.json). Se o orçamento
# já esgotou ou este hook já continuou uma vez, libera o Stop.
set -uo pipefail

INPUT="$(cat)"
# Se este hook já bloqueou neste ciclo, libera (evita loop infinito). Claude.
ACTIVE="$(printf '%s' "$INPUT" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("stop_hook_active",False))' 2>/dev/null || echo False)"
[ "$ACTIVE" = "True" ] && [ "${VJP_CODEX:-0}" != "1" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f package.json ] || exit 0

is_codex() { [ "${VJP_CODEX:-0}" = "1" ] || [ "${CODEX:-0}" = "1" ]; }

# Localiza o CLI do orçamento sem assumir install path.
budget_cli() {
  if [ -f .harness/tools/test-budget.js ]; then echo ".harness/tools/test-budget.js"; return 0; fi
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$here/../../template/tools/test-budget.js" ]; then
    echo "$here/../../template/tools/test-budget.js"; return 0
  fi
  return 1
}

budget_exhausted() {
  local cli
  cli="$(budget_cli)" || return 1
  node "$cli" --status --json 2>/dev/null | python3 -c '
import json,sys
d=json.load(sys.stdin)
sys.exit(0 if d.get("enforced") and (d.get("exhausted") or d.get("runs_exhausted")) else 1)
' 2>/dev/null
}

# Codex: orçamento esgotado → não reabre trabalho (e NÃO chama --reset).
if is_codex && budget_exhausted; then
  exit 0
fi

CONTINUE_MARK=".bsd/typecheck-stop-continue.json"
if is_codex && [ -f "$CONTINUE_MARK" ]; then
  # Já continuou uma vez neste task — libera. Não toca no test-budget.
  exit 0
fi

# Só roda se houver .ts/.tsx modificado ou novo no working tree.
git status --porcelain -- '*.ts' '*.tsx' 2>/dev/null | grep -q . || exit 0

if   [ -f pnpm-lock.yaml ]; then RUN="pnpm run"; EXEC="pnpm exec"
elif [ -f yarn.lock ];      then RUN="yarn";     EXEC="yarn exec"
elif [ -f bun.lock ] || [ -f bun.lockb ]; then RUN="bun run"; EXEC="bunx"
else RUN="npm run"; EXEC="npx"
fi

if python3 -c 'import json,sys;sys.exit(0 if "typecheck" in json.load(open("package.json")).get("scripts",{}) else 1)' 2>/dev/null; then
  CMD="$RUN typecheck"
elif [ -f tsconfig.json ]; then
  CMD="$EXEC tsc --noEmit"
else
  exit 0
fi

OUT="$($CMD 2>&1)" && exit 0

if is_codex; then
  mkdir -p .bsd
  printf '%s\n' '{"continued":1,"note":"stop-typecheck: no máximo 1 continue; test-budget intacto"}' > "$CONTINUE_MARK"
fi

{
  echo "BLOQUEADO: '$CMD' falhou — corrija antes de finalizar."
  printf '%s\n' "$OUT" | tail -30
} >&2
exit 2
