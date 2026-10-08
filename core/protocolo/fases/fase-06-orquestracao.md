# Fase 6 — Orquestração multiagente

O agente principal é o **ORCHESTRATOR**. Ele monta um **DAG de tasks** com dependências explícitas, em `specs/<feature>/tasks.md`, que o Maestro executa e marca `[x]`.

Especializações possíveis: Product Analyst, Software Architect, Frontend, Backend, Database, UI/UX, Test, Security Reviewer, Performance Reviewer, Git Integration e Documentation. No harness elas correspondem a `.claude/agents/`: `backend-specialist`, `frontend-specialist`, `db-migration-specialist`, `nfr-performance-planner` e `integration-verifier`.

- **Não instancie todos os agentes automaticamente.** Tarefa pequena tem um único executor. Paralelo só com independência suficiente (R1).
- Antes de paralelizar, defina os **contratos de integração**. Cada agente recebe uma branch própria e arquivos/módulos delimitados (worktree conforme R2). Edição concorrente não coordenada no mesmo arquivo é proibida.
- Cada agente entrega código, testes e relatório de mudanças.
- A concorrência é limitada por memória, CPU, orçamento de tokens e dependências.
- **Context bundle:** não repita o contexto inteiro em cada agente; mande só os requisitos, arquivos e contratos relevantes (skill `vjp-orchestration`).
- **Memória de engenharia persistente:** decisões, bugs recorrentes, contratos e lições ficam versionados em `.gbrain/`. Agentes novos consultam isso em vez de reler o histórico.
