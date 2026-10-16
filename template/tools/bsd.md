# BSD — Build Spec Development (Orquestrador)

**Tier:** core · **Versão pinada:** `1.2.0` · **Origem:** bundled — baseado em `garrytan/gstack` (https://github.com/garrytan/gstack) · **Destino:** `.harness/tools/bsd.js`

## Responsabilidade
Executa automaticamente as tasks geradas pelo GSD. Elimina execução manual após o `tasks.md`. Pipeline transacional por task, isolado em Git Worktree, crash-safe.

## Pipeline por task
```
PLANNER → RESEARCHER → EXECUTOR → REVIEWER → APPROVED?
  └ Sim → próxima task
  └ Não → retry em worktree (máx. 2 tentativas) → aborta + notifica STATE.md
```

## Comandos
```bash
node .harness/tools/bsd.js --execute <feature>            # pipeline real (4 agentes)
node .harness/tools/bsd.js --execute <feature> --dry-run  # mecânica sem LLM
node .harness/tools/bsd.js --check-llm                    # testa o backend LLM
node .harness/tools/bsd.js --continue                     # retoma
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

## Agentes (integração real)
Os 4 agentes rodam de verdade via `tools/agents.js` + `tools/llm.js` (provider-agnostic). Cada um monta o system prompt a partir de `AGENT_RULES.md` + memória `.gbrain/` e devolve JSON estruturado:
- **PLANNER** → `{risk, strategy, needsResearch, acceptanceCriteria}`
- **RESEARCHER** → `{impactedFiles, approach, dependencies}`
- **EXECUTOR** → `{files:[{path,content}], commitMessage}` — o orquestrador escreve os arquivos na worktree (com proteção contra path traversal) e commita.
- **REVIEWER** → `{approved, reason, requiredChanges}` — gate objetivo = resultado dos testes (`pipeline.testCommand`).

Loop: até `pipeline.maxRetries` tentativas Executor→testes→Reviewer; se aprovado e `autoMerge`, faz `git merge --no-ff` na branch principal e limpa a worktree. Caso contrário, aborta e registra em `STATE.md`.

Configuração em [`../config/agents.json`](../config/agents.json). Ver [`agents.md`](./agents.md).
