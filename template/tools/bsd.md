# BSD — Build Spec Development (Orquestrador)

**Tier:** core · **Versão pinada:** `1.2.0` · **Origem:** bundled — baseado em `garrytan/gstack` (https://github.com/garrytan/gstack) · **Destino:** `.harness/tools/bsd.js`

## Responsabilidade
Painel de estado (`.bsd/`), reset, doctor/checklist e vendorização. Desde a v2.2.0 não executa tasks sozinho: a execução fica com as CLIs.

## Pipeline por task
```
PLANNER → RESEARCHER → EXECUTOR → REVIEWER → APPROVED?
  └ Sim → próxima task
  └ Não → retry em worktree (máx. 2 tentativas) → aborta + notifica STATE.md
```

## Comandos
```bash
node .harness/tools/bsd.js --status                       # painel STATE.md
node .harness/tools/bsd.js --reset                        # limpa worktrees/histórico
node .harness/tools/bsd.js --doctor [--strict|--json]     # determinismo + checklist OK/FALTA/AVISO
node .harness/tools/bsd.js --check [--strict|--json]      # alias de --doctor (não é o drift do sync-rules)
node .harness/tools/bsd.js --vendor [--only <id>]         # clona componentes git pinados
```

## Estado
- `.bsd/history.jsonl` — append-only, crash-safe, fonte da verdade, auditável.
- `.bsd/STATE.md` — painel humano (progresso, última task, próximos passos).
- `.bsd/worktrees/` — isolamento por feature.

## Verificação
```bash
test -f .harness/tools/bsd.js && echo OK
```

## v2.2.0
O pipeline headless (`--execute`, `--continue`, `--check-llm`, `--dry-run`) e a camada LLM própria (`llm.js`, `agents.js`, `config/agents.json`) foram removidos. A execução por task roda nas CLIs (Claude Code, Codex, AGY, Cursor) com os subagentes por fase.
