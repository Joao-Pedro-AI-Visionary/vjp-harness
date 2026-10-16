#!/usr/bin/env bash
# Instala os plugins oficiais claude-code-setup e receipts no escopo user.
# Não falha o install.sh/bootstrap: claude ausente, versão < 2.1.296 ou rede
# viram aviso. Comandos conferidos em code.claude.com/docs (plugin install --scope user -y).
# VJP_CLAUDE_BIN, se existir, aponta para um binário/script no lugar de `claude` (teste).
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
MIN="2.1.296"
MARKETPLACE="anthropics/claude-plugins-official"
PLUGINS="claude-code-setup receipts"

say() { printf '%s\n' "$*"; }

claude_run() {
  if [ -n "${VJP_CLAUDE_BIN:-}" ]; then
    bash "$VJP_CLAUDE_BIN" "$@"
    return $?
  fi
  if command -v claude >/dev/null 2>&1; then
    command claude "$@"
    return $?
  fi
  # npm no Windows publica claude.cmd. O Git Bash nem sempre acha o nome sem extensão.
  if command -v claude.cmd >/dev/null 2>&1; then
    cmd.exe //c claude.cmd "$@"
    return $?
  fi
  return 127
}

if [ -n "${VJP_CLAUDE_BIN:-}" ]; then
  if [ ! -f "$VJP_CLAUDE_BIN" ]; then
    say "claude ausente — plugins oficiais não instalados (claude-code-setup, receipts)."
    exit 0
  fi
elif ! command -v claude >/dev/null 2>&1 && ! command -v claude.cmd >/dev/null 2>&1; then
  say "claude ausente — plugins oficiais não instalados (claude-code-setup, receipts)."
  exit 0
fi
if ! command -v node >/dev/null 2>&1; then
  say "node ausente — não deu para comparar a versão do Claude Code."
  exit 0
fi

cd "$REPO" || exit 0
VER="$(claude_run --version 2>&1 | tr -d '\r' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)"
if [ -z "$VER" ]; then
  say "claude --version sem semver — plugins oficiais não instalados."
  exit 0
fi
if ! node -e "const p=s=>String(s).split('.').map(n=>{const x=parseInt(n,10); return Number.isFinite(x)?x:0}); const a=p(process.argv[1]), b=p(process.argv[2]); let ok=true; for (let i=0;i<3;i++){ if(a[i]>b[i]) break; if((a[i]||0)<(b[i]||0)){ ok=false; break; } } process.exit(ok?0:1)" "$VER" "$MIN"; then
  say "Claude Code $VER < $MIN — plugins oficiais não instalados (a validação de nome de marketplace pede >= $MIN)."
  exit 0
fi
say "Claude Code $VER: registrando marketplace oficial e plugins (escopo user, sem prompt)."
claude_run plugin marketplace add "$MARKETPLACE" || say "marketplace oficial não registrado (rede ou política). Plugins ficam pendentes."
for name in $PLUGINS; do
  if claude_run plugin install "${name}@claude-plugins-official" --scope user -y; then
    say "plugin ${name}@claude-plugins-official instalado (ou já estava)."
  else
    say "plugin ${name} não instalado — o install do harness segue."
  fi
done
exit 0
