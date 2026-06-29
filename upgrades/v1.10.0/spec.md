# spec.md — v1.10.0: Especialistas Front/Back/DB + Contrato-primeiro + Verificação E2E + NFR

> Nível 3 escolhido pelo usuário. Dor: "back feito mas front quebra / não persiste / pesado / sem fila".
> Causa-raiz: pipeline com 1 executor genérico e gate só de teste unitário do back — ninguém verifica o fluxo REAL front→API→DB nem os requisitos não-funcionais (NFR).

## Objetivo
Transformar o fluxo genérico em **especialistas por camada** com **contrato compartilhado** e **verificação ponta-a-ponta real**, fechando as 4 dores:
1. front quebra → **Contrato-primeiro** (endpoints/DTO in-out/status/erros) que back e front consomem.
2. não persiste → **Verificador de Integração** confirma a **linha no banco** (Postgres MCP) após a ação real (Playwright).
3. pesado → **Gate de Performance** (EXPLAIN/índice/N+1/payload).
4. sem fila/paralelismo → **Planejador de NFR** decide async/fila/idempotência no início e bloqueia operação pesada não preparada.

## Onde cada peça vive (camada importa)
- **Camada interativa (Claude Code/Cursor — onde o usuário opera):** os MCPs funcionam → é aqui que a verificação REAL acontece. Entregue como **subagentes** (`.claude/agents/`) + lei no `AGENT_RULES.md`.
- **Pipeline headless (`bsd.js --execute`):** sem cliente MCP → recebe **contrato + NFR** no prompt dos builders/revisor (paridade de disciplina), e gera os **artefatos de teste E2E** (spec Playwright + asserção de persistência) que o `testCommand` roda.

## Entregáveis
1. `AGENT_RULES.md`: doutrina Nível 3 — especialistas Backend/Frontend/DB, Contrato-primeiro, Verificador de Integração (front→API→DB real), Gate de Performance, Planejador de NFR/Fila.
2. Subagentes dispatcháveis em `template/agents/` (copiados p/ `.claude/agents/` pelo install): `backend-specialist`, `frontend-specialist`, `db-migration-specialist`, `integration-verifier`, `nfr-performance-planner`.
3. `agents.js`: novos passos `runNfrPlanner` + `runContract`; executor/revisor passam a receber `contract`+`nfr`; helpers PUROS testáveis (`contractGaps`, `nfrSummary`). DRY estendido.
4. `bsd.js`: pipeline enriquecido — Planejador → NFR → Contrato → Pesquisador → Executor(contrato/NFR) ⇄ Revisor(integração/perf). `mergeGate` intacto.
5. `harness.yaml`: registra agentes especialistas + nfr.
6. Testes `node:test` p/ os helpers novos (contractGaps, nfrSummary). Os 23 atuais seguem verdes.
7. README/REGISTRY/decisions + bump 1.10.0. Reinstalar nos 6 projetos.

## Prova viva
- `npm test` verde incl. novos casos (contrato incompleto detectado; NFR decide fila por volume/lote).
- `--dry-run` exercita o pipeline novo (DRY stubs).
- doctor 11/11.

## Fora de escopo
- Tornar o headless cliente MCP (segue gerando artefatos E2E p/ o testCommand rodar).
- Frameworks de fila específicos embarcados (recomenda BullMQ etc., não instala).

## Gate
Bump 1.10.0 pinado, testes verdes, docs coerentes, decisões registradas. Push após validação.
