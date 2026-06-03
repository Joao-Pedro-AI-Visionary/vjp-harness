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
node .harness/tools/bsd.js --execute <feature>   # inicia pipeline
node .harness/tools/bsd.js --continue            # retoma
node .harness/tools/bsd.js --status              # painel STATE.md
node .harness/tools/bsd.js --reset               # limpa worktrees/histórico
node .harness/tools/bsd.js --doctor [--strict|--json]   # verifica determinismo
```

## Estado
- `.bsd/history.jsonl` — append-only, crash-safe, fonte da verdade, auditável.
- `.bsd/STATE.md` — painel humano (progresso, última task, próximos passos).
- `.bsd/worktrees/` — isolamento por feature.

## Verificação
```bash
test -f .harness/tools/bsd.js && echo OK
```

## ⚠️ Estado atual
O esqueleto transacional é completo (worktrees, logging, retomada, retry). As etapas dos 4 agentes ainda são **stubs simulados** (`setTimeout`) — a integração real com os agentes de IA é o próximo passo. O contrato (`AGENT_RULES.md` + `.gbrain/`) já está definido.
