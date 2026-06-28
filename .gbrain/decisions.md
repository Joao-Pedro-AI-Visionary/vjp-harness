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
## 2026-06-28 — Manutenção v1.7.1 — Bumpar pin do RTK 0.42.3 → 0.42.4
- **Decisão:** Manutenção v1.7.1 — Bumpar pin do RTK 0.42.3 → 0.42.4
- **Alternativa descartada:** Manter 0.42.3 e fazer downgrade do binário global da máquina para casar o pin
- **Porquê:** O binário global já roda 0.42.4 (release legítima, tag v0.42.4 @ 8a7dd7e5570d). Alinhar o pin ao que de fato roda elimina o drift do doctor sem downgrade. Determinismo preservado: tag+commit pinados.
## 2026-06-28 — Validação v1.7.2 — Postgres MCP Pro (crystaldba) confirmado AO VIVO (EXPLAIN + HypoPG via Docker)
- **Decisão:** Validação v1.7.2 — Postgres MCP Pro (crystaldba) confirmado AO VIVO (EXPLAIN + HypoPG via Docker)
- **Alternativa descartada:** Fechar o item só com a documentação, sem teste contra banco real
- **Porquê:** Briefing exigia confirmar o EXPLAIN antes de fechar. Sem uvx na máquina, usei Docker+Colima contra Postgres 16 efêmero (100k linhas) e dirigi o MCP por cliente stdio: explain_query baseline=Seq Scan 2281; com hypothetical_indexes=Index Scan 241; analyze_query_indexes=2281→8.1 (283x). Regra 7 provada de ponta a ponta; pendência fechada.
## 2026-06-28 — Bugfix v1.7.3 — verify do Postgres MCP Pro usava flag --version inexistente
- **Decisão:** Bugfix v1.7.3 — verify do Postgres MCP Pro usava flag --version inexistente
- **Alternativa descartada:** Manter --version e aceitar o ✗ permanente no doctor como 'precisa de uvx'
- **Porquê:** Validação /goal (cenário ruim) revelou que postgres-mcp não tem --version → verify sempre falhava mesmo com uvx. Troquei p/ 'uvx postgres-mcp==0.3.0 --help' (exit 0, contém 'access-mode'); o pin ==0.3.0 garante a versão. Agora o doctor fica 11/11 com uv instalado.
