#!/usr/bin/env bash
# PostToolUse (Edit|Write) genérico: eslint --fix no arquivo recém-tocado.
# Portável: só age se o projeto tiver config de ESLint; nunca bloqueia (exit 0 sempre).
set -uo pipefail

FILE="$(python3 -c 'import json,sys;print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
ls eslint.config.* .eslintrc* >/dev/null 2>&1 || exit 0

if   [ -f pnpm-lock.yaml ]; then EXEC="pnpm exec"
elif [ -f yarn.lock ];      then EXEC="yarn exec"
elif [ -f bun.lock ] || [ -f bun.lockb ]; then EXEC="bunx"
else EXEC="npx"
fi

$EXEC eslint --fix "$FILE" >/dev/null 2>&1 || true
exit 0
