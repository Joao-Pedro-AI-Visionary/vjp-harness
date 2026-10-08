# Changelog

Formato: versão · data · o que mudou. Histórico anterior à v2: `README.md` (Novidades), `machine/MACHINE.md` §6 e o `git log`.

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
