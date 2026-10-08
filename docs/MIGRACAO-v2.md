# Migração v1.22 → v2.0.0

A v2 **não remove** nada da v1: `bsd.js`, gates, Dial, prova viva, skills, Headroom e hooks seguem iguais. O que muda é **de onde vêm as regras**: agora de `core/`, renderizadas por `template/tools/sync-rules.js` para cada ferramenta. Toda escrita é **idempotente** e feita em **blocos gerenciados** (`<!-- vjp-harness:start -->` … `<!-- vjp-harness:end -->`); o que estiver fora dos marcadores é preservado.

Pré-requisito em todos os ambientes: **Node ≥ 18** (o sync não tem dependências).

## 1. O que muda, arquivo por arquivo

| Antes (v1) | Agora (v2) | Ação na migração |
|---|---|---|
| `machine/export/HARNESS.md` editado à mão; `AGENTS.md` espelho manual (tinha derrapado) | Os dois gerados de `core/` e idênticos | Edite `core/`, rode `node template/tools/sync-rules.js` |
| `bootstrap.sh` copiava para `~/AGENTS.md` (o Codex **não** lê esse caminho) | `~/.codex/AGENTS.md` (bloco) | Automática no `bootstrap.sh` / `sync-rules.js --global` |
| — | `~/.gemini/GEMINI.md` (bloco) para o Antigravity | Automática |
| `~/.claude/HARNESS.md` copiado | `~/.claude/HARNESS.md` gerado (arquivo inteiro) | Automática; o `~/.claude/CLAUDE.md` continua com `@HARNESS.md` |
| Skills só em `~/.claude/skills` | Também em `~/.agents/skills` (Codex), `~/.gemini/config/skills` e `~/.gemini/antigravity-cli/skills` (AGY), só as reais (symlinks do gstack ficam fora) | Automática |
| `CLAUDE.md` do projeto com bloco v1 (apontava para `AGENT_RULES.md`) | Mesmo marcador, agora com `@.harness/core/…` (imports) | O `install.sh` substitui o bloco no lugar |
| — | `AGENTS.md` do projeto (bloco), `.agents/rules/vjp-projeto-novo.md`, `.cursor/rules/vjp-projeto-novo.mdc`, skill `projeto-novo` em `.agents/skills` e `.claude/skills`, `.harness/core/` | Criados pelo `install.sh` |
| `.codex/hooks.json` com caminho relativo (`machine/hooks/…`) que falhava fora da raiz | Caminho via `$(git rev-parse --show-toplevel)`; sai 0 se o script não existir | Merge automático; hooks seus são preservados |
| `chrome-devtools-mcp@latest` | `chrome-devtools-mcp@1.10.1` | Rode o bootstrap de novo ou edite o `~/.claude/settings.json` |

**`~/AGENTS.md` legado:** não é apagado. Se já contiver os marcadores ou o cabeçalho v1 (`# V-JP Harness — Regras Globais`), o sync atualiza; se não for nosso, não é tocado. Pode removê-lo à mão depois de confirmar que nenhuma ferramenta sua depende dele (o Codex usa `~/.codex/AGENTS.md`).

## 2. Mac

```bash
cd ~/.local/share/vjp-harness && git pull           # (quando a v2 estiver no remoto)
node template/tools/sync-rules.js --global          # regras globais + skills das 3 ferramentas
node template/tools/sync-rules.js --global --check  # confirma: exit 0
# por projeto (o instalador já trata o sed do macOS):
bash ~/.local/share/vjp-harness/install.sh --target ~/code/meu-projeto --force --yes
```

O `machine/bootstrap.sh` é escrito para Linux/WSL2 (nvm, Headroom via uv, settings). No Mac, o caminho seguro para as regras é o `sync-rules.js --global` acima; o resto do bootstrap não foi testado no macOS.

## 3. Windows

**Recomendado: WSL2** (é a máquina de referência). Dentro do WSL, siga o fluxo Linux:

```bash
bash machine/bootstrap.sh            # passo 6 já roda sync-rules --global
bash install.sh --target <projeto> --force --yes
```

**CLIs instaladas no Windows nativo** (fora do WSL) leem `%USERPROFILE%\.codex`, `%USERPROFILE%\.claude` e `%USERPROFILE%\.gemini`, não o `$HOME` do WSL. Nesse caso, rode o sync com Node do Windows (PowerShell), que não precisa de bash:

```powershell
node template\tools\sync-rules.js --global --home $env:USERPROFILE
node template\tools\sync-rules.js --global --home $env:USERPROFILE --check
```

O hook do orçamento do Codex em projeto usa `bash` e `git`; no Windows nativo ele só funciona com Git Bash no PATH. Sem bash, o hook não roda e o orçamento fica só no `test-budget.js` manual. [Não verificável] neste ambiente.

## 4. Box (Linux compartilhado)

As CLIs já estão instaladas e logadas; não rode o bootstrap inteiro (instala nvm, Headroom e troca o `settings.json`). Basta:

```bash
node template/tools/sync-rules.js --global           # ~/.codex/AGENTS.md, ~/.claude/HARNESS.md, ~/.gemini/GEMINI.md + skills
bash install.sh --target <projeto> --yes             # por projeto
```

Para testar sem tocar o HOME real: `node template/tools/sync-rules.js --global --home /tmp/home-teste`.

## 5. Passos manuais (não automatizáveis)

1. **Codex — confiança dos hooks.** O Codex só roda hook de projeto confiável e aprovado. Abra o projeto no Codex, aceite a confiança e aprove o hook do orçamento em **`/hooks`**. (Em `codex exec` não interativo existe `--dangerously-bypass-hook-trust`; use só em ambiente controlado.) O `AGENTS.md` do projeto foi carregado mesmo sem confiança no codex-cli 0.153.1 (conferido com `codex debug prompt-input`), mas a confiança continua necessária para os hooks.
2. **Cursor — regra global.** Não existe arquivo global; se quiser as regras fora dos projetos com harness, cole o bundle (`machine/export/AGENTS.md`) em *Settings → Rules → User Rules*.
3. **Antigravity — workflows.** A v2 não usa workflows (saem de linha em 2026-10-19); o projeto novo é a skill `projeto-novo`.
4. **Logins**: nenhum passo da migração mexe em login de CLI.

## 6. Conferir

```bash
node template/tools/sync-rules.js --check                 # repo: espelhos sem drift
node template/tools/sync-rules.js --global --check        # máquina
(cd <projeto>/.harness/tools && node sync-rules.js --check)   # projeto
(cd template/tools && npm run check)                      # suíte + verify + sync --check
node template/tools/bsd.js --doctor
```

## 7. Voltar para a v1

`git checkout main` no repo (v1.22.0, commit `1c23572`) e rode o `install.sh` antigo com `--force`. Os arquivos que a v2 criou nos projetos (`AGENTS.md`, `.agents/`, `.cursor/rules/vjp-projeto-novo.mdc`, `.harness/core/`) podem ser apagados à mão; o bloco do `CLAUDE.md` volta ao formato v1 no próximo `install.sh` v1 (mesmos marcadores). No HOME, os blocos de `~/.codex/AGENTS.md` e `~/.gemini/GEMINI.md` saem removendo o trecho entre os marcadores.
