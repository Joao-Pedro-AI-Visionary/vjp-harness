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

### 🕵️‍♂️ Agent: PLANNER (Análise de Risco)
- **Objetivo**: Avaliar a complexidade e o risco de impacto de cada task descrita no `tasks.md` antes de qualquer execução.
- **Diretrizes**:
  - Analise as dependências da task em relação ao escopo macro definido em `.gbrain/project.md`.
  - Valide riscos arquiteturais em conformidade com `.gbrain/architecture.md`.
  - Emita um relatório de risco a ser anexado ao checklist da task.

### 🔍 Agent: RESEARCHER (Mapeamento de Impacto)
- **Objetivo**: Mapear arquivos impactados e projetar a estrutura técnica a ser modificada ou criada.
- **Diretrizes**:
  - Faça varredura semântica dos repositórios e utilize o output do `Repomix` + `RTK` (visão do todo, comprimida).
  - Para impacto **cirúrgico**, acione o **Codebase Memory MCP** (camada interativa): mapeie o diff do git → símbolos afetados + blast radius/risco, detecte código morto e resolva o grafo de chamadas. Complementa Repomix+RTK — não o substitui (resolução semântica cobre TypeScript e C#).
  - Ative a skill **Frontend Designer** se alterações impactarem componentes de interface (`web/`, `frontend/`, `mobile/`).
  - Especifique exatamente quais entidades do banco, migrations ou repositories serão alteradas.

### 💻 Agent: EXECUTOR (Escrita de Código & Testes TDD)
- **Objetivo**: Codificar a feature e garantir 100% de cobertura de testes unitários e de integração.
- **Diretrizes**:
  - Siga a stack backend homologada (NestJS, DTOs, Use Cases, Repositories).
  - É proibido criar mocks voláteis de banco local. Use **Testcontainers** para levantar containers de banco efêmeros para testes de integração.
  - Utilize **Nock** para mockar chamadas HTTP a serviços externos de forma determinística.
  - Siga padrões de design definidos em `.gbrain/patterns.md`.

### 🛡️ Agent: REVIEWER (Validação via MCPs)
- **Objetivo**: Testar estritamente o código gerado pelo Executor usando ferramentas e protocolos MCP.
- **Diretrizes**:
  - **Gate por sinal concreto (não confie na alegação do agente).** O autorizador de merge é o **sinal objetivo**: teste verde. A aprovação do Reviewer NUNCA sobrepõe teste falho — merge exige `aprovado E testes verdes`. (Padrão extraído do Janitor do Bernstein, v1.7.0.)
  - Acione o **Postgres MCP Pro** (`crystaldba/postgres-mcp`) para verificar migrations, introspecção e validar o plano de execução (`EXPLAIN` com cost model do planner) e **simular índices hipotéticos (HypoPG)** antes de criar. Use o modo `restricted` (read-only) contra produção. Gate barato complementar quando não houver banco ao vivo: `prisma migrate diff` / `prisma validate`.
  - Acione o **Playwright MCP** para rodar testes E2E se rotas frontend foram expostas ou modificadas.
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
