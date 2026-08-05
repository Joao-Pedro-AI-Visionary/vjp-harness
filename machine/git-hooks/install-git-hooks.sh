#!/usr/bin/env bash
# Instala os git hooks globais da maquina (padrao de commit V-JP).
# Uso: bash install-git-hooks.sh
# Idempotente. Desinstalar: git config --global --unset core.hooksPath
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${XDG_CONFIG_HOME:-$HOME/.config}/git/hooks"

# Se ja houver um hooksPath global apontando pra outro lugar, nao sequestra em silencio.
ATUAL="$(git config --global core.hooksPath || true)"
if [ -n "$ATUAL" ] && [ "$ATUAL" != "$DEST" ]; then
  echo "⚠️  core.hooksPath global ja aponta para: $ATUAL"
  echo "   Nao vou sobrescrever. Resolva a mao ou rode:"
  echo "   git config --global core.hooksPath \"$DEST\""
  exit 1
fi

mkdir -p "$DEST"
install -m755 "$HERE/commit-msg" "$DEST/commit-msg"
install -m755 "$HERE/_delegate" "$DEST/_delegate"

# Delegadores: sem isto, core.hooksPath global engole os hooks locais dos repos.
for h in pre-commit prepare-commit-msg post-commit pre-push post-merge post-checkout pre-rebase; do
  cp -f "$HERE/_delegate" "$DEST/$h"
  chmod 755 "$DEST/$h"
done

git config --global core.hooksPath "$DEST"

echo "✅ Guard de commit ativo em TODOS os repos da maquina."
echo "   Formato exigido: [jp] feat|fix(escopo): descricao"
echo "   Pular uma vez:   git commit --no-verify"
echo "   Desinstalar:     git config --global --unset core.hooksPath"
