#!/usr/bin/env bash
# SessionStart V-JP (Codex ou Claude Code). Exit 0 sempre. Não bloqueia.
# Uso: cli-session-start.sh codex|claude
# stdout do node é o único JSON. Falha do node vira sucesso vazio.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SURFACE="${1:-claude}"
if [ "$SURFACE" != "codex" ] && [ "$SURFACE" != "claude" ]; then
  SURFACE="claude"
fi
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '{}'
  exit 0
fi
node "$HERE/cli-session-start.mjs" "$SURFACE" 2>/dev/null || printf '%s\n' '{}'
exit 0
