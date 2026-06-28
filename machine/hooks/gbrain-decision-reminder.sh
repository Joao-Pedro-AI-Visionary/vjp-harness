#!/usr/bin/env bash
# V-JP Harness (João Pedro) — Stop hook NÃO-bloqueante: lembra de gravar a decisão do dia
# no GBrain quando houve mudança de código e ainda não há entrada de hoje em .gbrain/decisions.md.
# Resolve a dor "esqueci de gravar a decisão" de forma nativa e determinística (sem agentmemory).
# Sempre exit 0 (apenas informa; nunca bloqueia o encerramento).
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
DEC=".gbrain/decisions.md"
[ -f "$DEC" ] || exit 0

# Só lembra se houve commit hoje OU arquivos de código modificados no working tree.
TODAY="$(date +%Y-%m-%d)"
CHANGED=0
git status --porcelain 2>/dev/null | grep -qE '\.(ts|tsx|js|mjs|cs|prisma)$' && CHANGED=1
git log --since="$TODAY 00:00" --oneline 2>/dev/null | grep -q . && CHANGED=1
[ "$CHANGED" -eq 1 ] || exit 0

# Já tem decisão registrada hoje? então silêncio.
grep -q "## ${TODAY} —" "$DEC" 2>/dev/null && exit 0

{
  echo "🧠 Lembrete V-JP: houve mudança de código hoje e nenhuma decisão registrada em $DEC."
  echo "   Grave a decisão (o quê + alternativa descartada + porquê):"
  echo "   node .harness/tools/gbrain-decision.js \"<o quê>\" --alt \"<descartada>\" --why \"<porquê>\""
} >&2
exit 0
