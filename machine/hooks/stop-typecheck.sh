#!/usr/bin/env bash
# Stop hook genérico: impede o Claude de encerrar o turno com typecheck quebrado.
# Portável — zero referência a projeto: detecta o gerenciador pelo lockfile e o
# comando pelo package.json. Se o projeto não tem TS, sai em silêncio.
# exit 2 = bloqueia o Stop e devolve o erro ao Claude para corrigir.
set -uo pipefail

INPUT="$(cat)"
# Se este hook já bloqueou neste ciclo, libera (evita loop infinito).
ACTIVE="$(printf '%s' "$INPUT" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("stop_hook_active",False))' 2>/dev/null || echo False)"
[ "$ACTIVE" = "True" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f package.json ] || exit 0

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
{
  echo "BLOQUEADO: '$CMD' falhou — corrija antes de finalizar."
  printf '%s\n' "$OUT" | tail -30
} >&2
exit 2
