#!/usr/bin/env bash
# Instala/atualiza a skill /prepush como skill GLOBAL do Claude Code e o hook
# pre-push global do git. Idempotente. Roda em Git Bash (Windows) e WSL.
#
#   bash skills/prepush/reinstall.sh            # a partir do clone do vjp-harness
#   PREPUSH_SEM_HOOK=1 bash reinstall.sh        # só a skill, sem mexer no git config
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${PREPUSH_DEST:-$HOME/.claude/skills/prepush}"

echo "→ skill: $SRC → $DEST"
if [ "$(cd "$DEST" 2>/dev/null && pwd -P)" = "$(cd "$SRC" && pwd -P)" ]; then
  echo "→ origem == destino; mantendo a skill instalada"
else
  mkdir -p "$(dirname "$DEST")"; rm -rf "$DEST"; cp -r "$SRC" "$DEST"
fi
find "$DEST" -type f \( -name '*.sh' -o -name '*.md' \) -exec sed -i 's/\r$//' {} + 2>/dev/null || true
chmod +x "$DEST"/scripts/*.sh "$DEST"/reinstall.sh
bash -n "$DEST/scripts/gate.sh"

if [ "${PREPUSH_SEM_HOOK:-0}" != "1" ]; then
  echo "→ hook global: ~/.githooks/pre-push"
  mkdir -p "$HOME/.githooks"; cp "$DEST/scripts/pre-push-hook.sh" "$HOME/.githooks/pre-push"; chmod +x "$HOME/.githooks/pre-push"
  git config --global core.hooksPath "$HOME/.githooks"
fi

if command -v gitleaks >/dev/null 2>&1; then echo "→ gitleaks: $(gitleaks version 2>/dev/null | head -1)"
else echo "⚠ gitleaks ausente — o gate usa a varredura interna. Instale: winget install Gitleaks.Gitleaks | brew install gitleaks | apt/binário da release"; fi
echo "✓ /prepush instalada em $DEST"
