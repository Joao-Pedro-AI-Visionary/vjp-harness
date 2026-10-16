# Changelog

Formato: versão · data · o que mudou. Histórico anterior à v2: `README.md` (Novidades), `machine/MACHINE.md` §6 e o `git log`.

## 2.2.0 — 2026-10-16 — remoção da camada LLM própria

O João não usa a camada LLM do harness: a execução fica com as CLIs (Claude Code, Codex, AGY, Cursor) e seus subagentes por fase.

### Removido
- `template/tools/llm.js` (adapters openai/anthropic/ollama e presets cliproxy, openai, deepseek, kimi, glm, minimax, openrouter, groq, together, anthropic, ollama).
- `template/config/agents.json` inteiro (bloco `llm`, `presets` e os blocos `agents`/`pipeline`, que só o pipeline headless lia).
- `template/tools/agents.js` + `agents.md` (os 4 agentes HTTP do Maestro).
- `bsd.js --execute`, `--continue`, `--check-llm` e o `--dry-run` deles. Ficam `--status`, `--reset`, `--doctor`/`--check` e `--vendor`.
- `template/tools/sombra-llm.js` + `sombra-llm.md` + `config/canary-llm.json` e o componente `sombra-llm` do registry.
- `rules-eval.js --llm` / `sync-rules.js --eval --llm`. O eval de texto (sem modelo) continua.
- Checagem `VJP_LLM_API_KEY` no checklist/doctor; menções em README, `bsd.md`, `core/20-operacao.md`, `install.sh` e seed do GBrain.
- Testes do pipeline headless (integração `--execute --dry-run`, `nfr-contract`, `sombra-llm`, partes de agents/model-router).

### Mantido
- `model-router.js` (modelos por fase das CLIs) não dependia de `llm.js`.
- Helpers puros do `bsd.js` (`applyFiles`, `mergeGate`, `parseTasks`, `findFeatureSpec`, `markTaskDone`) e os módulos `gates.js`, `dial.js`, `aferidor-*.js`, `sombra.js` (usados por skills/regras ou testados à parte).

### Checklist
- A correção sugerida para `superpowers` agora é a que funciona: `vendor.js --only superpowers` + cópia para `~/.claude/plugins/superpowers` + `claude plugin marketplace add` / `claude plugin install superpowers@superpowers-dev`.
- GBrain é encontrado também em `<repo>/.harness/tools/gbrain` (onde o `vendor.js` grava quando roda a partir do clone), além do PATH.

## 2.1.0 — 2026-10-16 — modelos por fase, superfícies de CLI e checklist

Três frentes entraram juntas. Nenhuma depende de o usuário pedir o recurso numa conversa: `install.sh` e `machine/bootstrap.sh` disparam.

### Modelos por fase
- `template/tools/model-router.js` grava, no install e no bootstrap, o modelo de cada subagente. Claude Code: alias `opus` (planner, reviewer, nfr, integration-verifier) e `sonnet` (researcher, executor e especialistas), com `experimental.cacheTtl: 1h` só em quem espera teste. Cursor: `claude-opus-5-5` / `claude-sonnet-5-5`. Codex: `gpt-6.1-sol` + `medium` e `gpt-6-luna` + `high`, campos do exemplo oficial de subagentes. AGY não recebe chave de modelo: a doc de `settings.json` não tem essa chave.
- A status line do Claude Code mostra a contagem do `prompt_cache` da conversa principal quando o CLI envia o objeto (v2.1.251+).
- O adapter do Maestro não manda o alias `opus`/`sonnet` para a API. `llm.phaseModels` continua o gancho opcional de id real.

### Superfícies de CLI
- `sync-rules.js` passa a gravar SessionStart (Codex e Claude Code), `.codex/vjp-cli.json`, a regra AGY `vjp-cli.md` (`always_on`) e a regra Cursor `vjp-cli.mdc` (`alwaysApply`). No Windows o hook do Codex ganha `commandWindows` com `node`, campo oficial, porque o comando bash não roda no cmd.
- O mapa separa a worktree gerenciada do Codex (`$CODEX_HOME/worktrees`, detached HEAD, escolha Worktree no app) da worktree do Maestro (`.bsd/worktrees/<feature>`, branch própria).
- Plugins oficiais `claude-code-setup` e `receipts` entram no install e no bootstrap quando `claude --version` é ≥ 2.1.296. Abaixo disso, sem binário ou sem rede, o install segue. No Windows o instalador também aceita `claude.cmd`.

### Checklist
- `checklist.js` imprime OK / FALTA / AVISO com o comando de correção de `win32`, `darwin` ou `linux`. FALTA (Node, Repomix) sai com código 1. AVISO não bloqueia, salvo `--strict`. Valor de variável de ambiente não é impresso.
- `bsd.js --doctor` e `--check` (alias neste comando, não o drift do `sync-rules`) e o fim do `install.sh` / `bootstrap.sh` mostram o relatório sozinhos.
- `sync-rules.js --eval` compara o mesmo prompt com e sem cada regra de `core/`. Não roda na instalação. `--llm` gasta API e continua opt-in.

### Correções da integração
- `features.worktrees` saiu do que o instalador grava. A config reference oficial do Codex não lista essa chave, e `--strict-config` recusa campo desconhecido. Um bloco antigo entre os marcadores `vjp-harness:codex` é removido na próxima aplicação. O mesmo vale para comandos de daemon e de worktree que não aparecem no manual oficial: o hook não os cita.
- O `settings.template.json` que o bootstrap copia para `~/.claude/settings.json` deixa de nomear o modelo proibido. O modelo da sessão passa a ser o alias oficial `opus`.

## 2.0.0+colab — 2026-10-11 — diretrizes de colaboração técnica

- `core/11` passa a conter as **Diretrizes de colaboração técnica** do João (independência de julgamento, confiança por evidência, discordância útil com trade-offs, consistência sem teimosia, inspeção antes de alterar, validação proporcional, entrega objetiva), com sentinela própria. Conflitos com o texto antigo em `core/decisoes/CONTRADICOES.md` (#36–41).
- Duplicações em `10`, `13` e `51` viram ponteiros para `11`; bundle segue ≤ 24.000 bytes.
- Novo `tests/colaboracao-tecnica.test.mjs`: regra + sentinela em AGENTS.md, CLAUDE.md (@import), HARNESS.md, ~/.codex/AGENTS.md e ~/.gemini/GEMINI.md.

## 2.0.0 — 2026-10-08 — fonte única portável

**Por que major:** muda o lugar canônico das regras (de `machine/export/HARNESS.md` para `core/`) e os arquivos que o `install.sh`/`bootstrap.sh` escrevem. Nada da v1 foi removido; a migração está em [`docs/MIGRACAO-v2.md`](docs/MIGRACAO-v2.md).

### Novo
- **`core/`** — fonte única de regras, guardrails e checklists, uma regra por tema, com precedência declarada (`00-precedencia.md`) e sentinela de carregamento. Incorpora o documento de engenharia: princípios globais (`10`), Diretrizes de Comportamento e Tom do João **literais** (`11`), confiança × verificação (`12`), anti-falso-consenso e revisão adversarial de arquitetura (`13`).
- **`core/30-execucao.md` (R1–R9)** — uma regra para cada tema que estava contraditório: paralelismo, worktree, tentativas, precedência dos 4 portões de conclusão, browser/Playwright MCP, versões (`@latest`), arquivos de regra, git/remoto, limpeza.
- **Skill `projeto-novo`** — Fases 0–12 (Fase 3 = benchmark tecnológico global), com um único gate de aprovação antes da implementação e o FORMATO OBRIGATÓRIO; corpo pequeno, fases carregadas sob demanda.
- **`template/tools/sync-rules.js`** — gerador Node ≥ 18, sem dependências, determinístico, com `--check` (drift = exit 1), `--list`, `--global`, `--target`, `--home`. Renderiza: `AGENTS.md` (Codex/AGY/Cursor), `CLAUDE.md` com `@imports`, `~/.codex/AGENTS.md`, `~/.claude/HARNESS.md`, `~/.gemini/GEMINI.md`, `.agents/rules/*.md` (frontmatter `trigger` validado), `.cursor/rules/*.mdc`, fan-out de skills e merge do `.codex/hooks.json`. Falha se o bundle passar de 24.000 bytes (limite do Antigravity).
- **`core/decisoes/`** — `CONTRADICOES.md` (decisão + motivo) e `PARA-O-JOAO.md` (decisões a confirmar).
- **15 testes** em `template/tools/tests/sync-rules.test.mjs`; `npm run check` passa a incluir `sync-rules.js --check`.
- Componentes `sync-rules` (obrigatório) e `projeto-novo` (opcional) no `registry.json`.

### Mudou
- `install.sh`: o bloco Python do `CLAUDE.md` virou `sync-rules.js --target` (mesmos marcadores; o bloco v1 é migrado no lugar). Falha do sync vira aviso, não aborta.
- `machine/bootstrap.sh`: para de copiar para `~/AGENTS.md` (o Codex não lê esse caminho) e roda `sync-rules.js --global` no passo 6; novo passo manual (confiança do hook no Codex).
- `machine/export/AGENTS.md` e `HARNESS.md`: gerados e idênticos (o espelho manual tinha derrapado).
- `template/AGENT_RULES.md` v2.0.0: §1 itens 1 e 6, §5, §7 e §8.4 harmonizados com R1–R3; bloco gerado "§1.1 Execução unificada (R1–R9)". Constituição I–IX e §0.1 OWASP intactos.
- Skill `vjp-orchestration`: paralelismo e worktree passam a apontar para R1/R2.
- Hook de orçamento do Codex: comando resolve a raiz por `git rev-parse --show-toplevel` (falhava em subdiretório); o script aceita a raiz git como fallback.
- `chrome-devtools-mcp@latest` → `chrome-devtools-mcp@1.10.1` (`settings.template.json`, `MACHINE.md`).
- `VERSION`, `registry.json` (`harnessVersion`), `harness.yaml`: 2.0.0. `template/tools/package.json` mantém `1.10.2` para não mexer no lockfile.

### Removido
- E-mail pessoal de `LICENSE`, `README.md`, `registry.json`, `harness.yaml` e `package.json`; referência a empresa em `prepush/reference/camadas-e-mercado.md`.

### Compatibilidade
- `bsd.js`, `gates.js` (4 portões ENFORCED + `prova-viva` avisa), Dial (pisos, `stageMinLevel`, `testBudget`), skills existentes e Headroom: sem mudança de comportamento.
