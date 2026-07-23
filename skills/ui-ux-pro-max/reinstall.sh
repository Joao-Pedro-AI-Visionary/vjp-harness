#!/usr/bin/env bash
# Reinstala/atualiza a skill ui-ux-pro-max como skill GLOBAL self-contained
# (sem depender do sistema de plugins / CLAUDE_PLUGIN_ROOT, que aqui aponta p/ paths Windows).
# Instalação original: sessão 2026-07-23. Idempotente.
set -euo pipefail

REPO="https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git"
TMP="$(mktemp -d)"
# Portável: respeita $HOME (máquina nova) mas mantém o default /home/jp.
# Override explícito via UIUX_DEST=... se precisar.
DEST="${UIUX_DEST:-${HOME:-/home/jp}/.claude/skills/ui-ux-pro-max}"

echo "→ clonando $REPO"
git clone --depth 1 "$REPO" "$TMP/repo"

SRC="$TMP/repo/.claude/skills/ui-ux-pro-max"
[ -d "$SRC" ] || { echo "ERRO: layout do repo mudou, $SRC não existe"; exit 1; }

echo "→ substituindo $DEST"
rm -rf "$DEST"
cp -r "$SRC" "$DEST"

echo "→ corrigindo caminhos (plugin-root → absoluto, python → python3)"
sed -i "s#\${CLAUDE_PLUGIN_ROOT}/\.claude/skills/ui-ux-pro-max#$DEST#g" "$DEST/SKILL.md"
sed -i 's#^python #python3 #g; s#`python #`python3 #g' "$DEST/SKILL.md"
cp "$0" "$DEST/reinstall.sh" 2>/dev/null || true

echo "→ smoke test"
python3 "$DEST/scripts/search.py" "landing hero" --domain style --max-results 1 >/dev/null && echo "OK: search.py funcional"

rm -rf "$TMP"
echo "✓ ui-ux-pro-max atualizada em $DEST"
