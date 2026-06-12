#!/usr/bin/env bash
# Instala os hooks de validação genéricos num projeto, sob demanda.
# Uso: bash install-hooks.sh [dir-do-projeto]   (default: diretório atual)
# Idempotente; se já existir .claude/settings.json, faz merge sem destruir nada.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$(cd "${1:-$PWD}" && pwd)"

[ -f "$TARGET/package.json" ] || { echo "⚠️  $TARGET não tem package.json — hooks são para projetos Node/TS."; exit 1; }

mkdir -p "$TARGET/.claude/hooks"
install -m755 "$HERE/stop-typecheck.sh" "$HERE/post-lint.sh" "$TARGET/.claude/hooks/"

python3 - "$TARGET/.claude/settings.json" <<'PY'
import json, os, sys
path = sys.argv[1]
cfg = {}
if os.path.exists(path):
    with open(path) as f:
        cfg = json.load(f)
hooks = cfg.setdefault("hooks", {})

def ensure(event, entry):
    lst = hooks.setdefault(event, [])
    if not any(json.dumps(e, sort_keys=True) == json.dumps(entry, sort_keys=True) for e in lst):
        lst.append(entry)

ensure("PostToolUse", {
    "matcher": "Edit|Write",
    "hooks": [{"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/post-lint.sh"}],
})
ensure("Stop", {
    "hooks": [{"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-typecheck.sh"}],
})

with open(path, "w") as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"hooks registrados em {path}")
PY

echo "✅ Pronto. Na próxima sessão do Claude Code em $TARGET:"
echo "   - Stop bloqueado enquanto o typecheck falhar (só quando houver TS mexido)"
echo "   - eslint --fix automático em cada arquivo editado (se o projeto tiver ESLint)"
echo "Para remover: apague .claude/hooks/ e as entradas em .claude/settings.json."
