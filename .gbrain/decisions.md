# 🧠 Decisions — Decisões Arquiteturais (GBrain · V-JP)

> O coração do método V-JP: toda escolha estrutural gravada com **alternativa descartada + porquê**.
> Entradas abaixo podem ser geradas por `tools/gbrain-decision.js` (append idempotente).

## 2026-06-28 — Achado 1 — Rejeitar agentmemory (rohitg00) como componente; resolver a captura de decisão com helper NATIVO no GBrain
- **Decisão:** Achado 1 — Rejeitar agentmemory (rohitg00) como componente; resolver a captura de decisão com helper NATIVO no GBrain
- **Alternativa descartada:** Vendorizar agentmemory como core, ou adotá-lo como MCP opcional da camada interativa
- **Porquê:** Instável (hotfix quase diário, v0.9.26 quebrada), token-burn reaberto (issue #143), benchmark 95,2% auto-reportado, MCP de 53 tools é não-determinístico (fere a tese do harness) e nem alcança o BSD headless. O helper nativo (gbrain-decision.js) resolve a dor real, é determinístico, zero dep e alimenta o GBrain que o BSD lê.
## 2026-06-28 — Achado 2 — Adotar codebase-memory-mcp v0.8.1 como MCP interativo, complementando Repomix+RTK
- **Decisão:** Achado 2 — Adotar codebase-memory-mcp v0.8.1 como MCP interativo, complementando Repomix+RTK
- **Alternativa descartada:** Substituir Repomix+RTK por ele, ou rejeitar para manter enxuto
- **Porquê:** Cobre TS e C# com resolução semântica real; faz query cirúrgica de impacto (diff→símbolos, dead code, call graph). Propósito diferente de Repomix+RTK (visão do todo), então complementa. MIT, pinável via npm ci. Substituir seria perda; o BSD headless não fala MCP, então fica na camada interativa.
## 2026-06-28 — Achado 3 — Manter o scheduling do BSD (já determinístico); importar do Bernstein só o gate por sinal concreto
- **Decisão:** Achado 3 — Manter o scheduling do BSD (já determinístico); importar do Bernstein só o gate por sinal concreto
- **Alternativa descartada:** Refatorar BSD para FSM com transition table + audit chain HMAC ao estilo Bernstein
- **Porquê:** O scheduling do BSD já é 100% determinístico (ordem hardcoded em bsd.js; LLM só gera conteúdo, nunca ordena). DAG/topo-sort/paralelismo do Bernstein não se aplica a pipeline linear de 1 feature. Importado o padrão barato: merge exige 'testes verdes E aprovado' (sinal concreto > juízo do LLM). FSM/audit assinado = nota de futuro.
## 2026-06-28 — Manutenção — Substituir server-postgres (vulnerável) por Postgres MCP Pro crystaldba v0.3.0 + gate Prisma
- **Decisão:** Manutenção — Substituir server-postgres (vulnerável) por Postgres MCP Pro crystaldba v0.3.0 + gate Prisma
- **Alternativa descartada:** Validar migration só via prisma migrate diff/validate (sem MCP), ou usar Supabase MCP (item 97 do briefing)
- **Porquê:** server-postgres tem SQL injection e foi arquivado. crystaldba é Postgres puro (Prisma/EC2), seguro (modo restricted), com EXPLAIN cost model + índice hipotético HypoPG (útil ao índice parcial pendente). Supabase NÃO é a stack principal (item 97 é erro de digitação, confirmado pelo usuário). Mantém prisma diff/validate como gate barato. Ressalva: crystaldba desacelerou (release v0.3.0 mai/2025) — candidato a fork.
