---
name: vjp-orchestration
description: Padrões de orquestração multi-agente para o V-JP Harness — Context Bundle, Adversarial Review e Kanban Agentic. Use sempre que for despachar 2+ subagentes em paralelo, especialmente em features críticas (auth, payments, data export, security). Complementa os specialists em .claude/agents/ (v1.10.0).
---

# V-JP Orchestration Patterns

> Complementa `template/AGENT_RULES.md` (Constitution §I–IX + Security §0.1) e os specialists em `.claude/agents/` (v1.10.0: backend-specialist, db-migration-specialist, frontend-specialist, nfr-performance-planner, integration-verifier). Alinhado com o **Manifesto Dev Solo Arquiteto Sênior**.

O V-JP Harness já dá o **motor** (Maestro, GSD Redux, gate por teste verde, 4 agentes). Esta skill padroniza **como despachar subagentes de forma eficaz** — 3 padrões que evitam os dois anti-patterns mais comuns: (1) subagente que inventa requisitos porque não recebeu contexto, (2) reviewer que valida o que foi feito mas não busca ativamente o que está mal.

---

## Padrão 1: Context Bundle (delegação eficaz)

**Problema:** subagente não tem memória da sua conversa. Sem bundle, ele inventa requisitos, erra stack, esquece constraints — e você descobre só no PR.

**Solução:** SEMPRE passe um `context-bundle.md` ao despachar um subagente.

### Template completo

```yaml
# context-bundle.md
goal: "<1 linha: o que entregar>"
scope:
  in:
    - "<o que está INCLUÍDO>"
  out:
    - "<o que está FORA (anti-escopo)>"
files_to_touch:
  - "<caminho absoluto do arquivo>"
  - "<caminho absoluto do arquivo>"
constraints:
  constitution_articles: [I, III, IV, V, IX]   # 9 artigos aplicáveis (ver AGENT_RULES.md §0)
  security_owasp: [LLM05, "Web-Injection"]      # OWASP checks aplicáveis (ver §0.1)
  stack:
    backend: "NestJS + Prisma + class-validator"
    frontend: "Next.js + tRPC + Zod"
    db: "PostgreSQL 16 + Testcontainers em test"
  deps:
    forbidden: ["moment", "lodash"]              # deps banidas
    require_approval: ["qualquer dep nova"]      # trava
acceptance:
  - "Testes passam (npm test) — gate Constitution Article III"
  - "Coverage ≥ 70% no módulo"
  - "Linha persistida no DB confirmada (Postgres MCP)"
  - "E2E Playwright verde para user journey crítico"
  - "Sem `console.log`, sem secrets, sem `any`"
relevant_artifacts:
  spec: "specs/003-orders/spec.md#FR-001"
  plan: "specs/003-orders/plan.md#data-model"
  contract: "specs/003-orders/contracts/orders.openapi.yaml"
  gbrain_context:
    - ".gbrain/architecture.md#stack"
    - ".gbrain/patterns.md#error-handling"
stop_conditions:
  - "Se spec ambíguo: PARAR e perguntar, NÃO inventar"
  - "Se dep nova necessária: PARAR e perguntar"
  - "Se coverage < 70%: continuar, listar gaps no report"
  - "Se quebrar teste existente: reverter, NÃO commitar"
output_format:
  - "Lista de arquivos criados/modificados (caminho absoluto + diff stats)"
  - "Resultado de `npm test` (último run com timestamp)"
  - "Resultado de `npm run typecheck` e `npm run lint`"
  - "Self-review contra Constitution (gates III, V, VII, VIII, IX)"
  - "Pendências / dúvidas para o Tech Lead"
```

### Como usar com o harness

```bash
# 1. Criar context-bundle.md no worktree
cat > /tmp/context-bundle-orders.md <<EOF
... (preencher o template acima)
EOF

# 2a. Camada interativa (Claude Code/Cursor): passar o bundle no prompt
#    Prompt: "Implemente orders API. Use o context bundle em /tmp/context-bundle-orders.md.
#             Despache backend-specialist + frontend-specialist em paralelo."

# 2b. Pipeline headless (BSD): o EXECUTOR já recebe AGENT_RULES + .gbrain/*
#     Estender passando o bundle via prompt override em tools/agents.js

# 3. Validar output: o EXECUTOR deve CITAR o bundle no report
#    E respeitar os stop_conditions
```

---

## Padrão 2: Adversarial Review (pega o que você não vê)

**Problema:** um subagente só vê um lado. O REVIEWER padrão do harness valida testes/contrato, mas não busca ativamente vulnerabilidades ou anti-patterns.

**Solução:** rodar **2 subagentes com prompts opostos** em paralelo. O segundo é o "Red Team" do primeiro.

### Template

**Subagente A — Implementer** (papel do EXECUTOR):
```
Você é <papel-ex: backend-specialist>. Implemente <feature> seguindo o context-bundle.md
em anexo. Otimize para legibilidade, manutenibilidade e aderência à Constitution
(AGENT_RULES.md §0, 9 artigos). Output: código + testes + relatório de implementação.
```

**Subagente B — Adversarial Reviewer** (NOVO papel, pode substituir o REVIEWER padrão):
```
Você é um SECURITY/QUALITY REVIEWER adversarial. Receba o output do Subagente A
(arquivos criados + diff + relatório) e ENCONTRE TODAS AS FALHAS. Use como
referência:
- Constitution (9 artigos em AGENT_RULES.md §0)
- OWASP LLM Top 10 + OWASP Top 10 Web (em AGENT_RULES.md §0.1)
- .gbrain/architecture.md e .gbrain/patterns.md
- "Boring tech" — flag qualquer complexidade desnecessária (Article VII/VIII)

Formato do output:
| Severidade | Categoria | Linha | Descrição | Sugestão de fix |
| CRITICAL | <cat> | <path:line> | <desc> | <fix> |
| HIGH | ... |
| MEDIUM | ... |
| LOW | ... |

Depois de listar TODAS as falhas, REESCREVA o código corrigido.
Output final: tabela de findings + código corrigido + diff vs. A.
```

### Quando usar

| Cenário | Vale rodar Adversarial? |
|---------|------------------------|
| Auth, payment, data export, key rotation | **SEMPRE** |
| Feature crítica com PII/secrets | **SEMPRE** |
| Refactor de módulo grande | **SIM** |
| Bug fix de produção | **SIM** |
| Feature trivial de UI | **NÃO** (REVIEWER padrão basta) |
| Docs/CHANGELOG | **NÃO** |

### Como integrar no pipeline do harness

**Opção A — camada interativa (Claude Code/Cursor) — recomendada:**
1. Subagente A: usa EXECUTOR padrão + specialists
2. Subagente B: novo `.claude/agents/adversarial-reviewer.md` (modelo diferente é melhor — ex: opus vs sonnet)
3. Rodar em paralelo; pegar findings; pedir fix ao A
4. Merge só quando findings CRITICAL = 0 E HIGH = 0 (ou justificados)

**Opção B — pipeline headless (BSD) — extensão futura:**
1. Adicionar passo `ADVERSARIAL` no Maestro após `REVIEWER`
2. Se `findings.critical > 0` OU `findings.high > 0`: retry com feedback
3. Se passou: merge normal
4. (Não implementado em v1.10.2 — trackear como sugestão para v1.11.0)

**Opção C — workflow manual (solo dev) — funciona hoje:**
1. Após EXECUTOR terminar, rodar Claude Code/Gemini em outra janela
2. Prompt adversarial acima
3. Comparar findings; aplicar fixes; commit

---

## Padrão 3: Kanban Agentic (parallelização real)

**Problema:** tarefas sequenciais desperdiçam wall time.

**Solução:** despachar subagentes em paralelo quando o `tasks.md` marca `[P]` (paralelo), dentro do teto da regra **R1** (`core/30-execucao.md`).

### Regras

- Paralelismo segue **R1** (fonte única: `core/30-execucao.md`): padrão 1 executor + 1 revisor; teto 2 em paralelo (3 se forem só leitura), só sobe com medição da Fase 0. O limite técnico `delegation.max_concurrent_children` continua 3 — é teto do runtime, não meta.
- Worktree segue **R2**: obrigatório quando 2+ agentes escrevem ao mesmo tempo (`bsd.js` sempre usa um)
- Commit em branch próprio: `feat/<story>-<task-id>`
- Master (você) faz merge incremental após cada um
- Use a skill `kanban-orchestrator` ou `process-dashboard` para visualizar progresso

### Quando quebrar em paralelo

- Tasks com `[P]` no `tasks.md` (formato do GSD Redux)
- Stories independentes em features grandes
- Múltiplas dependências novas a serem avaliadas
- Verificação de impacto em paralelo: code search + contract diff + deps check

### Quando NÃO quebrar

- Tasks com dependência explícita (T014 depende de T012, T013)
- Tasks que tocam o mesmo arquivo (race condition no merge)
- Tasks onde output de uma alimenta a próxima (sequencial é obrigatório)

---

## Anti-patterns de orquestração (recapitulando AGENT_RULES.md)

| Anti-pattern | Consequência | Solução |
|--------------|--------------|---------|
| Despachar sem context bundle | Subagente inventa 30% do que fez | Sempre usar Padrão 1 |
| Só rodar REVIEWER padrão | Falhas de segurança/Constitution passam | Em features críticas, Padrão 2 |
| Despachar acima do teto R1 | Conflitos de merge, context window saturado, máquina travada | Respeite R1 (padrão 1+1, teto 2/3) e R2 (worktree por escritor) |
| Subagente roda sem `npm test` local | Quebra build no PR | Sempre rodar testCommand antes de commitar |
| "Confiar na alegação" do subagente | Subagente diz "testes passam" sem rodar | Maestro (BSD) executa testCommand objetivo; nunca confiar só na alegação |

---

## Referências

- `template/AGENT_RULES.md` §0 (Constitution 9 artigos) e §0.1 (OWASP Security)
- `template/tools/agents.md` — definição dos 4 agentes e camada LLM
- `template/tools/bsd.md` — Maestro (orquestrador) e comandos
- `template/agents/` — specialists Nível 3 (v1.10.0)
- `~/Desktop/MANIFESTO-DEV-SOLO-ARQUITETO.md` — Manifesto base
- `~/Desktop/INTEGRACAO-VJP-HARNESS-MANIFESTO.md` — Análise de gaps e plano de patch
