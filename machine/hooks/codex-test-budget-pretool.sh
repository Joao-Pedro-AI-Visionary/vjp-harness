#!/usr/bin/env bash
# Stub PreToolUse (Codex): deny runner de teste / patch em spec quando o orçamento esgotou.
# Não reseta .bsd/test-budget.json. stdin = JSON do hook.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-.}}" 2>/dev/null || exit 0

CLI=""
if [ -f .harness/tools/test-budget.js ]; then CLI=".harness/tools/test-budget.js"
elif [ -f "$(dirname "$0")/../../template/tools/test-budget.js" ]; then
  CLI="$(dirname "$0")/../../template/tools/test-budget.js"
else
  exit 0
fi

[ "${VJP_CODEX:-0}" = "1" ] || [ "${VJP_TEST_BUDGET:-0}" = "1" ] || exit 0

INPUT="$(cat)"
is_test_run="$(printf '%s' "$INPUT" | python3 -c '
import json,sys,re
try: d=json.load(sys.stdin)
except Exception: sys.exit(1)
tool=(d.get("tool_name") or d.get("tool") or "")
cmd=str(d.get("command") or d.get("tool_input",{}).get("command") or "")
blob=cmd+" "+tool
pat=r"(npm test|pnpm test|yarn test|jest|vitest|pytest|playwright test|go test)"
sys.exit(0 if re.search(pat, blob, re.I) else 1)
' 2>/dev/null)" && IS_RUN=1 || IS_RUN=0

is_test_edit="$(printf '%s' "$INPUT" | python3 -c '
import json,sys,re
try: d=json.load(sys.stdin)
except Exception: sys.exit(1)
tool=(d.get("tool_name") or d.get("tool") or "")
inp=d.get("tool_input") or {}
paths=" ".join(str(inp.get(k,"")) for k in ("path","file_path","target_file"))
blob=json.dumps(d)
if tool in ("apply_patch","Edit","Write","StrReplace") and re.search(r"(\.spec\.|\.test\.|/tests?/)", blob+paths):
    sys.exit(0)
sys.exit(1)
' 2>/dev/null)" && IS_EDIT=1 || IS_EDIT=0

if [ "$IS_RUN" = 1 ]; then
  node "$CLI" --consume-run --json >/dev/null
  code=$?
  if [ "$code" = 3 ]; then
    echo "ESGOTADO: orçamento de test-run. Entregue se prova-viva verde; senão reporte blockers. Não invente spec." >&2
    exit 2
  fi
fi
if [ "$IS_EDIT" = 1 ]; then
  node "$CLI" --consume-edit --json >/dev/null
  code=$?
  if [ "$code" = 3 ]; then
    echo "ESGOTADO: orçamento de test-edit. Prefira corrigir produção." >&2
    exit 2
  fi
fi
exit 0
