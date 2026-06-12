#!/usr/bin/env bash
# Remove os MCPs legados do Windows (cmd /c, paths C:/Users/JPDEV) do escopo user.
# ⚠️  Rodar com o Claude Code FECHADO — ele regrava ~/.claude.json durante a sessão
#     e pode desfazer a remoção. Backup automático antes de qualquer mudança.
# Não mexe nos MCPs ativos (chrome-devtools, gbrain, context7 — ficam no settings.json).
set -euo pipefail

STALE=(playwright postgres filesystem memory sequential-thinking brave-search browserbase stitch obsidian-vault)

if pgrep -f "claude" >/dev/null 2>&1; then
  echo "⚠️  Parece haver uma sessão do Claude Code aberta. Feche-a e rode de novo."
  echo "    (prosseguir mesmo assim pode ter a remoção desfeita ao sair da sessão)"
  read -rp "Continuar mesmo assim? [s/N] " ans
  [ "${ans:-n}" = "s" ] || exit 1
fi

cp ~/.claude.json ~/.claude.json.pre-mcp-cleanup.$(date +%Y%m%d-%H%M%S)
echo "backup criado"

for name in "${STALE[@]}"; do
  claude mcp remove --scope user "$name" 2>/dev/null && echo "removido: $name" || echo "já ausente: $name"
done

echo
echo "✅ Limpeza concluída. Lembrete: as chaves que estavam nesses configs"
echo "   (Brave, Browserbase, Stitch/Google) devem ser ROTACIONADAS nos respectivos painéis."
