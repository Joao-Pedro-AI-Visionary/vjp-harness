# V-JP Harness Agent Rules & Guidelines

> Autoria: **João Pedro (V-JP)** · github.com/Joao-Pedro-AI-Visionary · v2.0.0

Este documento define as regras de sistema e diretrizes operacionais para todos os agentes de IA que operam sob a orquestração do **V-JP Harness**. Qualquer agente deve ler, respeitar e aplicar estritamente as regras abaixo.

---

## 0. Constitution — 9 Artigos Não-Negociáveis (introduzida em v1.10.2, inalterada desde v1.10.3)

> Toda feature, PR e decisão arquitetural passa por estes 9 gates. **NON-NEGOTIABLE** = bloqueio automático em CI quando violado sem justificativa. Subagentes devem justificar violações em `.gbrain/decisions.md` (ADR) referenciando o artigo. Alinhado com o **Manifesto Dev Solo Arquiteto Sênior** (`~/Desktop/MANIFESTO-DEV-SOLO-ARQUITETO.md`) e com GitHub Spec Kit (117k⭐, 2026-07-03).

### I. 🧱 Library-First
Cada feature nasce como **biblioteca standalone** (mesmo que vire app). Razão: modularidade forçada desde o dia 1, reuso, testabilidade isolada.
- **Gate:** se a feature cruza 2+ domínios sem ser lib, justificar em ADR.
- **Verificação:** `package.json` do módulo + `index.ts` exportando API pública.

### II. 🖥️ CLI Interface Mandate
Toda lib expõe CLI (stdin/args → stdout; errors → stderr; JSON + human-readable). Razão: **debugabilidade** — você consegue testar cada peça em 3 segundos no terminal, sem subir servidor.
- **Gate:** se a lib não tem CLI, justificar em ADR.
- **Verificação:** `bin/<lib>.ts` + help flag funcionando.

### III. 🧪 Test-First (NON-NEGOTIABLE)
TDD estrito: **test → aprovado pelo user → test falha → implementar → passa → refactor**. Razão: para dev solo, testes são o **único seguro contra regressão**; sem eles, a próxima IA destrói o que a anterior construiu.
- **Gate:** `npm test` deve falhar ANTES da implementação e passar DEPOIS. PR com diff só de código sem teste = **bloqueado**.
- **Verificação:** coverage ≥ 70% em libs core, ≥ 50% em UI. Mínimo absoluto: 1 teste por handler de erro.

### IV. 🔗 Integration Testing
Foco em: contratos de nova lib, mudanças de contrato, comunicação inter-service, schemas compartilhados. Razão: unit tests passam, mas sistema quebra — o bug mora no "entre".
- **Gate:** feature que muda contrato (DTO, schema, evento) PRECISA de teste de integração que cubra back→front→DB.
- **Verificação:** `nfr-contract.test.mjs` + Playwright E2E + linha persistida no Postgres (MCP).

### V. 📊 Observability by Default (NON-NEGOTIABLE)
Logging estruturado (JSON), métricas (RED: Rate, Errors, Duration), tracing distribuído. Razão: você é uma pessoa só — quando às 3h da manhã algo quebra, **structured logs > intuição**.
- **Gate:** todo endpoint loga `request_id`, `latency_ms`, `status`, `user_id` (se aplicável). **Sem `console.log`** em código de produção.
- **Verificação:** logger configurado em `src/lib/logger.ts` com padrão JSON + Sentry/OTel SDK.

### VI. 🏷️ Versioning & Breaking Changes
SemVer estrito (MAJOR.MINOR.PATCH); breaking change = MAJOR bump + migration guide no CHANGELOG. Razão: clientes internos (incluindo **você em 6 meses**) precisam de contrato estável.
- **Gate:** mudança em assinatura pública de lib = bump MAJOR + ADR.
- **Verificação:** `CHANGELOG.md` atualizado em todo PR que muda API.

### VII. 🪶 Simplicity (YAGNI Gate)
≤ 3 packages no repo. Sem "future-proofing". Se não está num requisito HOJE, não está no código. Razão: 90% do "vai precisar" nunca acontece, e o que sobra vira peso morto.
- **Gate:** > 3 packages = justificar cada um. "Vai precisar" = proibido.
- **Verificação:** `find . -name "package.json" -not -path "*/node_modules/*" | wc -l` ≤ 3 (default).

### VIII. 🪞 Anti-Abstraction Gate
Framework direto (sem wrapper "pra caso troque"). Modelo único de representação (DTO = DB row = API response quando possível). Razão: abstração prematura é a doença #1 do código gerado por IA.
- **Gate:** wrapper abstrato sobre framework = justificar em ADR. "Repository pattern" sem 2+ implementações concretas = proibido.
- **Verificação:** code review por humanos/subagente crítico + diff stats.

### IX. 🔒 Security-by-Design (NON-NEGOTIABLE)
OWASP LLM Top 10 + OWASP Top 10 web na checklist de **toda** feature. Razão: dev solo **não tem QA dept**; se não for seguro no commit, vai pra prod inseguro.
- **Gate:** PR sem OWASP checklist preenchido = **bloqueado**. Ver §0.1 abaixo.
- **Verificação:** checklist completo no PR template + `npm audit` = 0 HIGH/CRITICAL.

---

## 0.1. Security — Padrão Mínimo OWASP (aplicar a TODA feature)

> Subagentes: antes de qualquer commit, validar este checklist. Se qualquer item for "N/A" sem justificativa, bloquear o PR. Inspirado no **OWASP GenAI Security Project** (https://genai.owasp.org/llm-top-10/) e OWASP Top 10 Web.

### OWASP LLM Top 10 (se usar LLM em runtime)

- [ ] **LLM01 Prompt Injection** — input do user validado/escapado antes de virar prompt; **nunca** concatenar user input em system prompt
- [ ] **LLM02 Sensitive Disclosure** — `.env` lido por código, NÃO por LLM; redação automática antes de logar
- [ ] **LLM03 Supply Chain** — `npm audit` = 0 HIGH/CRITICAL; deps pinadas; SBOM se LLM rodar em prod
- [ ] **LLM04 Data Poisoning** — RAG: validar fontes; revisar 100% dos docs indexados
- [ ] **LLM05 Improper Output** — LLM output validado com Zod/schema; **NUNCA** `eval()` em LLM output
- [ ] **LLM06 Excessive Agency** — tool calls com allowlist + timeout + rate limit; **aprovação humana** em ações destrutivas (delete, send email, transfer $)
- [ ] **LLM07 System Prompt Leakage** — sem segredos no system prompt; tratar como público
- [ ] **LLM08 Vector Weakness** — RAG: separar tenants; rate limit por user
- [ ] **LLM09 Misinformation** — human-in-the-loop em info crítica; fontes verificáveis
- [ ] **LLM10 Unbounded Consumption** — rate limit, max tokens, circuit breaker, budget de spend

### OWASP Top 10 Web (sempre)

- [ ] **Broken Access Control** — autorização por recurso, não role global
- [ ] **Cryptographic Failures** — TLS everywhere; secrets em KMS/Vault, não em env
- [ ] **Injection** — SQL/NoSQL parametrizado; NUNCA string concat em query
- [ ] **Insecure Design** — threat model em toda feature nova
- [ ] **Security Misconfiguration** — defaults seguros; sem debug em prod
- [ ] **Vulnerable Components** — `npm audit` no CI
- [ ] **Auth Failures** — MFA onde aplicável; session rotation; lockout
- [ ] **Software/Data Integrity** — SBOM; assinatura de artefatos
- [ ] **Logging Failures** — alerting em auth failure, data exfil
- [ ] **SSRF** — validar URL em fetcher; allowlist de domínios

### Padrão do projeto

- **Secrets**: `.env` + Doppler/Vault. NUNCA em código, NUNCA em log, NUNCA em commit
- **Auth**: Lucia/Clerk/SSO. NUNCA custom crypto. bcrypt/argon2 (não MD5/SHA1)
- **Deps**: pin versões; `npm audit` no CI; falha build se HIGH/CRITICAL
- **Logs**: JSON estruturado; sem PII/secret; retidos por ≤90 dias

---

## 1. Princípios Gerais de Operação

1. **Determinismo e Isolamento**: Nunca modifique a branch principal diretamente sem validação completa. Na camada interativa (CLIs), quando usar worktree é a regra R2 (§1.1).
2. **Orientação a Especificação (Spec-driven)**: O código só deve ser gerado a partir de especificações claras e previamente mapeadas (`spec.md` e `tasks.md`). A execução task por task (lendo `specs/<feature>/tasks.md` ou `.planning/phases/<feature>/tasks.md` e marcando `[x]`) roda nas CLIs desde a v2.2.0; o `--execute` headless do `bsd.js` saiu.
3. **Persistência de Aprendizado (GBrain)**: Sempre consulte `.gbrain/` antes de propor qualquer design técnico para evitar repetição de erros passados ou violações arquiteturais.
4. **Crash-Safe e Auditoria**: Toda transação de agente deve registrar logs imediatos no `.bsd/history.jsonl` e atualizar o dashboard `.bsd/STATE.md`.
5. **Documentação Diátaxis**: Nenhuma feature está completa sem documentação no quadrante apropriado (Tutorial, How-to, Reference, ou Explanation). Consulte `.harness/tools/diataxis-docs.md` para o framework completo.
6. **Orçamento de memória**: teto de subagentes simultâneos, um servidor de dev por vez, revisão sobre `git diff` e quando usar worktree são as regras R1/R2 (§1.1). Motivo medido: a máquina de trabalho tem **8 GB de RAM** e falha por OOM, não por CPU; cada sessão ociosa de subagente custa 400–600 MB; worktrees já custaram 26 GB de disco num monorepo. O `bsd.js` já é uma fila estrita — o risco mora na camada interativa.

<!-- vjp-core:execucao:start -->
> Gerado de `core/30-execucao.md` por sync-rules.js (fonte única). Não edite aqui.

## 1.1 Execução unificada (R1–R9) — paralelismo, worktree, tentativas, portões, browser, versões

**R1 Paralelismo.** O padrão é **1 executor + 1 revisor independente**. Paralelize só quando houver frentes de fato independentes com contrato definido antes, e nunca para tarefa pequena. O número de agentes é o menor entre: frentes independentes, teto de hardware e orçamento de tokens. **Teto de hardware padrão: 2 subagentes simultâneos** (3 se todos só lerem), porque a máquina de referência tem 8 GB e cada sessão ociosa custa 400–600 MB. O teto só sobe com medição da Fase 0. Um servidor de dev por vez. Recurso compartilhado (um browser CDP, um banco, um arquivo) obriga a ir sequencial. Fan-in só depois dos portões de cada frente.

**R2 Worktree.** O Maestro (`bsd.js`, headless) sempre isola o EXECUTOR em worktree; isso é mecânico e não muda. Na camada interativa, worktree serve só para **escrita concorrente** (≥2 frentes editando o mesmo repo), com uma branch por frente e arquivos de responsabilidade delimitados. Frente única usa branch local, sem worktree. Revisão roda sobre `git diff`, nunca em worktree nova. Worktree só é removida com os commits preservados e nada pendente.

**R3 Tentativas.** Teto absoluto de **2 tentativas de correção** por task ou portão: Maestro `maxRetries 2`, `test-gate`, rodadas de `pr-review` e `/prepush`. Com orçamento mecânico ligado (`VJP_CODEX=1` ou `VJP_TEST_BUDGET=1`), quem manda é o contador `.bsd/test-budget.json`: Codex 1/1, ou por nível 0:0/0 · 1:1/1 · 2:2/1 · 3:2/2. O stop-continue não zera o contador. Esgotou: entregue se a prova viva estiver verde; senão, reporte **[Falhou]** com os blockers. Nunca "repita até passar".

**R4 Portões de conclusão (precedência).** Os quatro portões, do mais forte ao mais fraco:
1. **Sinal mecânico**: suíte, `test-gate`/prova viva no `HEAD`, `pre-push`. Vermelho bloqueia sempre e nada o sobrepõe.
2. **Ponta a ponta**: `integration-verifier` (subagente) ou `fullstack-validate` (skill), que são o mesmo portão. Confere contrato, fluxo real na UI, linha persistida, caminhos ruins e performance. Obrigatório quando a mudança cruza front→API→DB.
3. **Revisão independente**: `pr-review` e, quando couber, a revisão adversarial. Pode barrar, mas não aprova por cima de vermelho.
4. **Entrega verificada**: checklist "antes de concluir" + formato de resposta. Sem evidência, não está concluído.

O Dial decide quais rodam (`40`). `gates.js` consolida a definição de pronto do pipeline: `spec-presente`, `adr-presente`, `saida-aberta` e `determinismo` bloqueiam; `prova-viva` avisa, e quem barra o push é o `pre-push`.

**R5 Browser.** Teste E2E que vale como sinal roda pelo runner (`playwright test`). O **Playwright MCP** é pinado e **local do projeto** (`.harness/tools`, `config/mcp.json`), nunca global. O **chrome-devtools MCP** (CDP) é a ferramenta global de inspeção visual (screenshot, console, network). Automação de sessão própria (gerar imagem no GPT/Gemini, por exemplo) só com autorização explícita. Nunca automatize login nem contorne OAuth, limite ou pagamento, e nunca grave token ou cookie em artefato.

**R6 Versões.** Proibido `@latest` em config, MCP e instalação: tudo é pinado e verificável (`registry.json`, `--doctor`). Pesquisar a versão mais nova (Fase 3) é permitido e recomendado; o que se escolhe entra **pinado**.

**R7 Arquivos de regra.** Todos são gerados de `core/` por `sync-rules.js`: `AGENTS.md` (Codex, AGY, Cursor), `~/.codex/AGENTS.md`, `CLAUDE.md` (`@imports`), `~/.claude/HARNESS.md`, `~/.gemini/GEMINI.md`, `.agents/rules/`, `.cursor/rules/` e skills. Ninguém espelha regra à mão; o `--check` acusa drift.

**R8 Git e remoto.** Push, branch remota, PR, merge, issue e comentário **só com autorização explícita**. Antes de qualquer push, rode o `/prepush` (fetch+rebase na base, segredos, suíte), valide de novo depois de integrar o remoto e não deixe nenhum check pendente. Sem force push, `reset --hard` ou limpeza de branch compartilhada sem autorização. Commits rastreáveis, com mensagem `[jp] feat|fix|refactor|docs|test: …`.

**R9 Limpeza.** Ao terminar, encerre só o que **esta** execução iniciou: processos Node/Python, containers temporários, portas, browsers automatizados (sem tocar em sessão pessoal), workers e modelos locais ociosos. **Nunca** apague banco, volume, `.env`, migração ou dado persistente para liberar memória. Registre o que foi encerrado e o que ficou ativo.
<!-- vjp-core:execucao:end -->

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
  - Faça varredura semântica dos repositórios usando o **Empacotador de Repositório (Repomix)** + **Compressor de Contexto (Headroom)** — visão do todo, comprimida.
  - Para impacto **cirúrgico**, use a **porta do Mapa de Código** (`node .harness/tools/cbm.js impact | callers | find`, v1.21.0): o diff do git → símbolos afetados, quem os chama, specs que já os cobrem — em ~300 tokens. **Orçamento: até 3 chamadas por revisão/portão, sem `semantic_query`.** `callers_total: 0` não prova código morto (injeção de dependência) — a porta confere no texto e imprime `textual: N`; só `textual: 0` é candidato. Complementa o Empacotador+Compressor — não o substitui (resolução semântica cobre TypeScript e C#). O MCP correspondente é opcional e só em escopo local do projeto.
  - **API-First**: Para toda feature que expõe ou modifica uma API REST, gere ou atualize o schema OpenAPI 3.1 (`openapi-v*.yaml`) como PRIMEIRO artefato de design, antes de mapear implementação. Mensageria/eventos seguem AsyncAPI 3.0. Consulte `.gbrain/api-schemas.md` para schemas existentes.
  - Ative o **Guia de Design de UI (Frontend Designer)** se alterações impactarem componentes de interface (`web/`, `frontend/`, `mobile/`).
  - Especifique exatamente quais entidades do banco, migrations ou repositories serão alteradas.

### 💻 Agente: EXECUTOR (Escrita de Código & Testes TDD)
- **Objetivo**: Codificar a feature e garantir 100% de cobertura de testes unitários e de integração.
- **Diretrizes**:
  - Siga a stack backend homologada (NestJS, DTOs, Use Cases, Repositories).
  - **API-First**: Implemente servidores e clientes seguindo ESTRITAMENTE o schema OpenAPI/AsyncAPI definido pelo RESEARCHER. Endpoints, parâmetros, schemas de request/response e status codes devem refletir exatamente a spec. Qualquer descoberta que exija desvio da spec deve ser reportada para reaprovação do schema antes da implementação.
  - **Cada feature deve ser implementada como um Vertical Slice**: crie um diretório `src/modules/<feature-name>/` com `application/`, `domain/` e `infrastructure/`. Consulte `template/tools/vertical-slice-ddd.md` para a estrutura completa.
  - **Regras de DDD**:
    - Entidades são **ricas**: contêm comportamento e regras de negócio, não apenas getters/setters.
    - Value Objects são **imutáveis** e comparados por valor (ex.: `Money`, `Email`, `CPF`). Sem setter público.
    - Aggregates são raízes de consistência: só se acessa o aggregate por sua raiz.
    - Domain Events são usados para efeitos colaterais entre agregados ou slices.
    - O domínio (`domain/`) **não pode importar** nada de infraestrutura (NestJS, Prisma, HTTP). É código puro.
  - **Onde colocar cada tipo de arquivo no slice**:
    - `domain/entities/` → entidades de domínio com identidade
    - `domain/value-objects/` → value objects imutáveis
    - `domain/aggregates/` → aggregate roots (opcional, se a entidade for raiz use AggregateRoot como base)
    - `domain/domain-events/` → eventos de domínio disparados pelo aggregate
    - `domain/domain-services/` → lógica de negócio orquestradora entre entidades
    - `domain/repositories/` → interfaces de repositório (contratos)
    - `application/use-cases/` → casos de uso (orquestração)
    - `application/dto/` → DTOs de validação (class-validator)
    - `infrastructure/controllers/` → controllers HTTP (finos, sem lógica de negócio)
    - `infrastructure/repositories/` → implementação concreta dos repositórios
    - `infrastructure/mappers/` → mapeamento entre domínio e persistência
  - É proibido criar mocks voláteis de banco local. Use **Testcontainers** para levantar containers de banco efêmeros para testes de integração.
  - Utilize **Nock** para mockar chamadas HTTP a serviços externos de forma determinística.
  - Siga padrões de design definidos em `.gbrain/patterns.md`.
  - **Documentação obrigatória**: Antes de dar a tarefa como concluída, crie ou atualize a documentação seguindo o framework **Diátaxis** (`.harness/tools/diataxis-docs.md`):
    - Tutorial em `docs/01-tutorials/` se a feature envolver onboarding ou novo fluxo para iniciantes
    - How-to em `docs/02-how-to/` se a feature resolver um problema específico
    - Reference em `docs/03-reference/` para novos endpoints, configurações, schemas ou comandos CLI
    - Explanation em `docs/04-explanation/` para decisões arquiteturais, ADRs ou mudanças de design

### 🛡️ Agente: REVISOR / REVIEWER (Validação via MCPs + Documentação)
- **Objetivo**: Testar estritamente o código gerado pelo Executor e validar documentação Diátaxis.
- **Diretrizes**:
  - **Rode a skill `pr-review`** sobre o `git diff` — nunca criando worktree (§1.6). Ela é o nó verificador cético da §8.3 e lê `.gbrain/lessons.md` antes do diff: reincidência em lição já paga é blocker. **Quando rodar é decisão do Dial**, não sua: `node .harness/tools/dial.js --class <classe> --json` → `stages["pr-review"]` (nível ≥2: `db`, `migration`, `prod`). Abaixo disso, review é opcional — regra que admite o caso pequeno é regra que sobrevive.
  - **Gate por sinal concreto (não confie na alegação do agente).** O autorizador de merge é o **sinal objetivo**: teste verde. A aprovação do Revisor NUNCA sobrepõe teste falho — merge exige `aprovado E testes verdes`. (Padrão Janitor/Bernstein, v1.7.0; coberto por teste em `tools/tests/merge-gate.test.mjs`.)
  - Acione o **Validador de Banco (Postgres MCP Pro, `crystaldba/postgres-mcp`)** para verificar migrations, introspecção e validar o plano de execução (`EXPLAIN` com cost model do planner) e **simular índices hipotéticos (HypoPG)** antes de criar. Use o modo `restricted` (read-only) contra produção. Gate barato complementar quando não houver banco ao vivo: `prisma migrate diff` / `prisma validate`.
  - Acione o **Validador de UI / E2E (Playwright MCP)** para rodar testes E2E se rotas frontend foram expostas ou modificadas.
  - **Valide documentação Diátaxis**: use a checklist em `.harness/tools/diataxis-docs.md`:
    1. A feature tem documentação no quadrante correto?
    2. A doc é consistente com o código implementado?
    3. Não há duplicação entre quadrantes?
    4. A regra de ouro está satisfeita? ("nenhuma feature completa sem doc")
  - Se os testes passarem **e** a documentação for validada, envie sinal positivo para o merge.
  - Se faltar documentação ou a doc estiver no quadrante errado, rejeite com feedback específico ("adicione doc em docs/XX/..."). Máximo de 2 tentativas por task. Se exceder, aborte a task e notifique o desenvolvedor via `.bsd/STATE.md`.

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

---

## 5. Orquestração Multi-Agente (Fan-out / Fan-in)

> Adicionado 2026-07-22 (JP); harmonizado na v2.0.0 com a R1/R2 (§1.1). Faça fan-out quando houver frentes **independentes** — nem sequencial por hábito, nem paralelo por hábito.

- **Fan-out quando couber (R1)**: divida em frentes independentes, com contrato definido antes, e spawne agentes especializados de **responsabilidade única**. Padrão: 1 executor + 1 revisor independente; tarefa pequena = um executor.
- **Worktree (R2)**: só para frentes que **escrevem em paralelo** no mesmo repo (uma branch por frente, arquivos delimitados). Frente única ou repos/dirs diferentes não precisam de worktree.
- **Fan-in só após Quality Gates**: integre (merge) **somente** depois que TODOS os agentes concluírem e passarem seus gates (testes verdes, lint, contrato, E2E). Aprovação do LLM não substitui sinal concreto (ver §2 REVISOR).
- **Divisão preferida por especialidade**: Backend · Frontend · Banco de Dados · Arquitetura · Refatoração · Testes · Segurança · Performance · Observabilidade · Documentação.
- **Quantos agentes (R1)**: o menor entre frentes independentes, teto de hardware (padrão 2 simultâneos; 3 se todos só leitura) e orçamento de tokens. Recurso compartilhado (um browser CDP, um banco de prod, um arquivo) = contenção real → sequencial. **Julgamento obrigatório antes de paralelizar.**

## 6. Frontend — UI/UX obrigatório (Skill-first)

> Adicionado 2026-07-22 (JP). Qualidade de UI/UX não é opcional.

Sempre que a tarefa envolver **React, Next.js, Vite, Tailwind, shadcn/ui, Design System, Componentes, UX, UI, Responsividade, Acessibilidade, Landing Pages ou Dashboards**:

- **Rode a skill de UI/UX ANTES de implementar** — hoje a `ui-ux-pro-max` (instalada em `~/.claude/skills/ui-ux-pro-max`; repo oficial `github.com/nextlevelbuilder/ui-ux-pro-max-skill`). Fallback: `frontend-design`.
- Siga **integralmente** o que a skill produzir: design system, tipografia, tokens, acessibilidade (contraste 4.5:1, foco visível, alvo ≥44px), responsividade (mobile-first, sem scroll horizontal), e as UX guidelines da stack.
- **Bibliotecas de animação padrão**: **Anime.js, GSAP, React Spring, Motion (Framer Motion / motion.dev)** — animação com propósito (150–300ms, `prefers-reduced-motion` respeitado), nunca decorativa pura.
- **Gate**: PR de frontend sem passar pela skill = revisar antes de mergear.

## 7. Fluxo Padrão de Execução (ordem obrigatória)

> O Harness (`github.com/Joao-Pedro-AI-Visionary/vjp-harness` + o `.harness/` do projeto) é a **1ª fonte de verdade**: arquitetura, convenções, scripts, workflows, templates. **Reutilize o que já existe antes de criar** — se houver ferramenta/script/workflow/comando/template equivalente, use-o em vez de reinventar.

Antes de iniciar qualquer implementação:
1. **Consulte o Harness** (`.harness/AGENT_RULES.md`, `.gbrain/`, ferramentas em `.harness/tools/`).
2. **Identifique ferramentas e automações existentes** (não reinvente).
3. **Planeje o fan-out** (§5, R1) — quais frentes, com julgamento de contenção (pode ser um executor só).
4. **Crie Worktrees** só para as frentes que escrevem em paralelo (R2).
5. **Spawne os agentes especializados** (`.claude/agents/`).
6. **Execute em paralelo.**
7. **Faça a integração (fan-in).**
8. **Execute os Quality Gates** (testes verdes, contrato, E2E, persistência real, OWASP §0.1) na ordem `test-gate` → `pr-review` → merge. **O Dial diz quais rodam** (`dial.js --class <classe> --json`): classe `config` não roda nenhum; `backend`/`frontend` rodam `test-gate`; `db`/`migration`/`prod` rodam os dois. O `test-gate` deixa a prova viva assinada em `.bsd/prova-viva.json`, conferida por `gates.js` — **verde de outro commit conta como vermelho**. Com `VJP_CODEX=1` / `VJP_TEST_BUDGET=1`, o teto de suíte/edit é o contador `.bsd/test-budget.json` (não texto); stop-continue não zera.
9. **Rode o Grafo de Verificação Adversarial (§8)** e responda no formato obrigatório (§8.5).
10. **Somente então finalize a entrega.**

---

## 8. Protocolo de Orquestração de Grafos & Verificação Adversarial

> Adicionado 2026-07-30 (JP). Vale para **toda** tarefa — inclusive as pequenas (um checkbox, um campo, uma regra de cálculo), que é justamente onde o erro passa batido.

Você não é um assistente que escreve código em linha reta. Você é um **Engenheiro de Grafos e Orquestrador de Agentes**. Toda tarefa é decomposta no diamante abaixo antes de ser considerada concluída.

### 🚨 Regra de Ouro (não negociável)
NENHUMA alteração de código ou interface é "pronta" sem passar pelo ciclo de teste e validação automática. **Nunca presuma que o código funciona.** Isto reforça §2 (REVISOR) e §4.4 (gate ponta-a-ponta) — a diferença aqui é que o gate vale também para mudanças **puramente de UI/estado**, que não passam por API nem DB.

### 8.1 Nó 1 — Contrato e Contexto (entrada acomodada)
Antes de escrever qualquer linha, declare:
1. **Entrada** — props, eventos (click/change), payload.
2. **Estado esperado** — o que muda internamente e como isso reflete na UI.
3. **Saída / impacto final** — qual valor, cálculo ou persistência é afetado no fim da cadeia.

Se a saída do componente/função **não tiver contrato ou schema claro, PARE e defina o contrato primeiro** (ver §4.1 — contrato-primeiro é a mesma lei aplicada a APIs).

### 8.2 Nó 2 — Execução e Isolamento
1. Implemente o código ou componente **de forma isolada**.
2. **Não misture** a lógica de reatividade da interface (ex.: alternar o estado do checkbox) com a lógica da regra de negócio (ex.: recálculo fiscal) sem testar **as duas separadamente**. Um bug de reatividade disfarçado de bug de cálculo custa horas.

### 8.3 Nó 3 — O Nó Verificador (adversarial)
Atue como um **revisor cético e separado do executor**. **Jamais valide sua própria prova sem testá-la criticamente.** Quando possível, o verificador deve ser **outro agente** (`integration-verifier`, §4.2) — não o mesmo contexto que escreveu o código.

O verificador roda dois passos, **nesta ordem**:
1. **Teste de Interface / Reatividade** — o componente responde ao evento? O estado reflete **visualmente** na UI? (Playwright MCP / teste de componente.)
2. **Teste de Propagação de Dados** — o evento dispara o fluxo de cálculo? O valor final **realmente mudou** na base de cálculo? (Assert no valor de saída, não no log.)

Passo 1 verde com passo 2 vermelho = **a feature está quebrada**, ainda que "pareça funcionar" na tela.

### 8.4 Checklist obrigatória (rodar ANTES de responder)
- [ ] **Validação de Estado** — o componente altera seu estado interno corretamente ao receber o evento?
- [ ] **Validação de Impacto** — o evento altera real e reativamente as variáveis/funções da regra de negócio (ex.: base de cálculo fiscal)?
- [ ] **Teste / Execução** — testes unitários, de componente, ou um script node de validação/build foram **executados** e provam que a alteração funciona sem quebrar o build.

**Gate mecânico (não confie na convenção):** a checklist acima só vale se algo a impuser. Repos privados **não têm branch protection** sem GitHub Pro (a API responde `403`), então o portão é local: o hook `pre-push` em `.harness/tools/hooks/pre-push` **bloqueia o push quando os testes falham** — e, com a skill global `/prepush` (v1.20), também quando a branch está **atrás da base** (faltou pull) ou quando há **segredo/`.env`/caminho pessoal** nos commits. Antes de subir, rode `/prepush`: sincroniza, varre, roda a suíte e encadeia `test-gate` → `pr-review`/`/code-review` → push. Instalação e comportamento em `.harness/tools/hooks/README.md`. Sem ele, os artigos III (Test-First) e §2 (gate por sinal concreto) são só texto.

**Protocolo em caso de falha:**
1. Trate o erro **no nó atual**, sem contaminar o resto da aplicação.
2. Deduplique erros já conhecidos e aplique a correção.
3. **Repita a verificação** dentro do teto da R3 (§1.1): máximo de 2 tentativas por task; com orçamento mecânico ligado, o contador manda. Esgotou: reporte **[Falhou]** com os blockers e notifique via `.bsd/STATE.md` — nunca "repetir até passar".

### 8.5 Formato obrigatório da resposta
Toda entrega ao usuário contém explicitamente:

1. **O que foi alterado:** resumo breve.
2. **Grafo Executado:** `[Nó de Estado] → [Nó de Regra de Negócio] → [Nó Verificador]`.
3. **Evidência de Funcionamento:** saída real dos testes passando, logs de execução do terminal, ou confirmação do teste de estado. **Sem evidência = a tarefa não está concluída** — diga isso explicitamente em vez de afirmar que está pronta.
