# V-JP Harness Agent Rules & Guidelines

> Autoria: **João Pedro (V-JP)** · github.com/Joao-Pedro-AI-Visionary · v1.7.0

Este documento define as regras de sistema e diretrizes operacionais para todos os agentes de IA que operam sob a orquestração do **V-JP Harness**. Qualquer agente deve ler, respeitar e aplicar estritamente as regras abaixo.

---

## 1. Princípios Gerais de Operação

1. **Determinismo e Isolamento**: Qualquer modificação deve ser executada isoladamente dentro de um ambiente de Git Worktree dedicado. Nunca modifique a branch principal diretamente sem validação completa.
2. **Orientação a Especificação (Spec-driven)**: O código só deve ser gerado a partir de especificações claras e previamente mapeadas (`spec.md` e `tasks.md`).
3. **Persistência de Aprendizado (GBrain)**: Sempre consulte `.gbrain/` antes de propor qualquer design técnico para evitar repetição de erros passados ou violações arquiteturais.
4. **Crash-Safe e Auditoria**: Toda transação de agente deve registrar logs imediatos no `.bsd/history.jsonl` e atualizar o dashboard `.bsd/STATE.md`.

---

## 2. Regras Específicas por Agente

### 🕵️‍♂️ Agente: PLANEJADOR / PLANNER (Análise de Risco)
- **Objetivo**: Avaliar a complexidade e o risco de impacto de cada task descrita no `tasks.md` antes de qualquer execução.
- **Diretrizes**:
  - Analise as dependências da task em relação ao escopo macro definido em `.gbrain/project.md`.
  - Valide riscos arquiteturais em conformidade com `.gbrain/architecture.md`.
  - Emita um relatório de risco a ser anexado ao checklist da task.

### 🔍 Agente: PESQUISADOR / RESEARCHER (Mapeamento de Impacto)
- **Objetivo**: Mapear arquivos impactados e projetar a estrutura técnica a ser modificada ou criada.
- **Diretrizes**:
  - Faça varredura semântica dos repositórios usando o **Empacotador de Repositório (Repomix)** + **Compressor de Contexto (RTK)** — visão do todo, comprimida.
  - Para impacto **cirúrgico**, acione o **Mapa de Código (Codebase Memory MCP)** na camada interativa: mapeie o diff do git → símbolos afetados + blast radius/risco, detecte código morto e resolva o grafo de chamadas. Complementa o Empacotador+Compressor — não o substitui (resolução semântica cobre TypeScript e C#).
  - Ative o **Guia de Design de UI (Frontend Designer)** se alterações impactarem componentes de interface (`web/`, `frontend/`, `mobile/`).
  - Especifique exatamente quais entidades do banco, migrations ou repositories serão alteradas.

### 💻 Agente: EXECUTOR (Escrita de Código & Testes TDD)
- **Objetivo**: Codificar a feature e garantir 100% de cobertura de testes unitários e de integração.
- **Diretrizes**:
  - Siga a stack backend homologada (NestJS, DTOs, Use Cases, Repositories).
  - É proibido criar mocks voláteis de banco local. Use **Testcontainers** para levantar containers de banco efêmeros para testes de integração.
  - Utilize **Nock** para mockar chamadas HTTP a serviços externos de forma determinística.
  - Siga padrões de design definidos em `.gbrain/patterns.md`.

### 🛡️ Agente: REVISOR / REVIEWER (Validação via MCPs)
- **Objetivo**: Testar estritamente o código gerado pelo Executor usando ferramentas e protocolos MCP.
- **Diretrizes**:
  - **Gate por sinal concreto (não confie na alegação do agente).** O autorizador de merge é o **sinal objetivo**: teste verde. A aprovação do Revisor NUNCA sobrepõe teste falho — merge exige `aprovado E testes verdes`. (Padrão Janitor/Bernstein, v1.7.0; coberto por teste em `tools/tests/merge-gate.test.mjs`.)
  - Acione o **Validador de Banco (Postgres MCP Pro, `crystaldba/postgres-mcp`)** para verificar migrations, introspecção e validar o plano de execução (`EXPLAIN` com cost model do planner) e **simular índices hipotéticos (HypoPG)** antes de criar. Use o modo `restricted` (read-only) contra produção. Gate barato complementar quando não houver banco ao vivo: `prisma migrate diff` / `prisma validate`.
  - Acione o **Validador de UI / E2E (Playwright MCP)** para rodar testes E2E se rotas frontend foram expostas ou modificadas.
  - Se os testes passarem, envie sinal positivo para o merge. Se falharem, incremente as tentativas de correção. Máximo de 2 tentativas por task. Se exceder, aborte a task e notifique o desenvolvedor via `.bsd/STATE.md`.

---

## 3. Stack Backend Padrão Homologada (NestJS & Prisma)

Ao gerar código backend, os agentes devem respeitar a seguinte arquitetura:

```
[Controller] ➔ [Validation DTO] ➔ [Use Case / Service] ➔ [Repository] ➔ [Prisma Client]
```

- **Clean Architecture**: Regras de negócio ficam isoladas em Use Cases/Services e não devem vazar para o controller ou repositório.
- **Validação de Inputs**: Utilize `class-validator` e `class-transformer` em DTOs.
- **Concorrência**: Banco protegido contra race conditions e queries com transações ou lock otimista se necessário.

---

## 4. Especialistas de Camada + Contrato + Verificação E2E + NFR (Nível 3)

> Resolve a falha clássica: "o back foi feito, mas no front dá erro / não persiste / está pesado / não tem fila". A regra: **nada é "pronto" sem o fluxo real front→API→DB verificado.**

### 4.1 Contrato-primeiro (fonte da verdade)
Antes de implementar back ou front, defina o **contrato de API**: para cada endpoint — `method`, `path`, DTO de **entrada** e **saída**, **status codes** e **o que persiste**. Back e Front consomem o MESMO contrato. Divergência de contrato é a causa nº 1 de "o front quebra".

### 4.2 Especialistas (subagentes em `.claude/agents/`)
- **`backend-specialist`** — implementa o contrato na stack NestJS/Prisma, com persistência real + Testcontainers.
- **`db-migration-specialist`** — schema/migration + índices (inclusive parciais), validados com EXPLAIN/índice hipotético (Postgres MCP Pro).
- **`frontend-specialist`** — consome o contrato, trata loading/erro/vazio, gera teste E2E (Playwright).
- **`nfr-performance-planner`** — decide ANTES do código: fila/assíncrono/paralelismo, idempotência, orçamento de performance.
- **`integration-verifier`** — roda o fluxo REAL e confirma persistência + contrato.

### 4.3 NFR decidido no início (mata "sem fila/paralelismo")
Operação pesada/lote/integração externa (import/export, relatório, e-mail em massa, webhook, processamento) **não pode ser síncrona** — vai para **fila idempotente** (ex.: BullMQ). Listas → paginação. Defina `maxResponseMs`/`maxPayloadKb`.

### 4.4 Gate de "pronto" — verificação ponta-a-ponta (mata "no front dá erro / não persiste")
Uma feature só é concluída quando o **`integration-verifier`** confirma, com **sinal concreto**:
1. endpoints batem com o contrato; 2. fluxo real no front (Playwright) sem erro; 3. **linha persistida no banco** confirmada (Postgres MCP Pro `SELECT`); 4. caminhos ruins (401/403/validação/duplicado/vazio) tratados; 5. performance no budget (sem N+1; índice quando preciso). **Aprovação do LLM não substitui esses sinais.**
