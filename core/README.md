# core/ — fonte única de regras do V-JP Harness (v2)

Tudo o que um agente precisa obedecer mora **aqui**, uma regra por tema. Os arquivos que cada ferramenta lê são **gerados** daqui por `template/tools/sync-rules.js` (Node ≥ 18, sem dependências, determinístico). Não edite os gerados à mão: o `--check` acusa drift.

## Mapa

| Arquivo | Dono do tema |
|---|---|
| `00-precedencia.md` | sentinela, fonte única, ordem de precedência 1–7, índice "uma regra por tema" |
| `10-principios.md` | princípios globais de engenharia, anti-alucinação, escala de confiança |
| `11-comportamento-e-tom.md` | Diretrizes de colaboração técnica do João (substituem "Comportamento e Tom"; sentinela própria) |
| `12-verificacao.md` | confiança × estado de verificação; gates `green/red/unknown`; `unknown ≠ green` |
| `13-anti-falso-consenso.md` | revisor independente, pressão, revisão adversarial de arquitetura |
| `20-operacao.md` | idioma, papel, método, engenharia, organização, cbm, frontend |
| `30-execucao.md` | R1–R9: paralelismo, worktree, tentativas, portões, browser, versões, arquivos de regra, git, limpeza |
| `40-dial.md` | rigor por mudança (níveis 0–3) |
| `checklists/50…54` | início, antes de codar, antes de concluir, antes do push, projeto novo |
| `protocolo/` | skill `projeto-novo` (corpo + Fases 0–12 em `fases/`, carregadas sob demanda) |
| `manifest.json` | ordem de renderização, sentinela, skills, regras condicionais, limites de tamanho |
| `decisoes/` | registro das decisões da v2 (não é copiado para projetos) |

## O que é gerado e quem lê

| Destino | Ferramenta | Como |
|---|---|---|
| `AGENTS.md` (projeto, bloco `<!-- vjp-harness:start/end -->`) | Codex, Antigravity, Cursor | bundle completo |
| `CLAUDE.md` (projeto, bloco) | Claude Code | `@.harness/core/<arquivo>` (imports) |
| `.agents/rules/vjp-projeto-novo.md` | Antigravity | `trigger: model_decision` |
| `.cursor/rules/vjp-projeto-novo.mdc` | Cursor | `alwaysApply: false` + `description` |
| `.agents/skills/projeto-novo/`, `.claude/skills/projeto-novo/` | Codex/AGY · Claude Code | skill |
| `.codex/hooks.json` (merge) | Codex | hook de orçamento de testes via `git rev-parse --show-toplevel` |
| `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md` (bloco) | Codex · Antigravity | bundle global |
| `~/.claude/HARNESS.md` (arquivo inteiro) | Claude Code | bundle global |
| `~/.claude/skills`, `~/.agents/skills`, `~/.gemini/config/skills`, `~/.gemini/antigravity-cli/skills` | todas | fan-out das skills reais + `projeto-novo` |
| `machine/export/AGENTS.md` = `HARNESS.md`, `machine/export/skills/projeto-novo/`, bloco R1–R9 em `template/AGENT_RULES.md` | repo | espelhos versionados |

## Comandos

```bash
node template/tools/sync-rules.js            # repo: regenera os espelhos
node template/tools/sync-rules.js --check    # repo: exit 1 se houver drift
node template/tools/sync-rules.js --target <projeto>   # projeto (o install.sh já faz)
node template/tools/sync-rules.js --global             # máquina (o bootstrap.sh já faz)
node template/tools/sync-rules.js --list               # mostra os alvos sem escrever
# dentro de um projeto instalado: node .harness/tools/sync-rules.js [--check]
```

Saída: `0` ok · `1` drift (`--check`) · `2` erro (core inválido, tamanho estourado, JSON de hooks inválido).

## Limites que o sync impõe

- Bundle sempre ≤ **24.000 bytes** (limite por arquivo do Antigravity; acima disso ele trunca). O Codex lê até 32 KiB por padrão.
- A sentinela tem de aparecer no bundle; serve de prova de carregamento.
- Conteúdo fora dos marcadores `<!-- vjp-harness:start/end -->` nunca é tocado; hooks alheios em `.codex/hooks.json` são preservados.
