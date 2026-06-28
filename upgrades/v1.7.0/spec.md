# spec.md — Upgrade VJP-HARNESS v1.6.0 → v1.7.0

> Gate 1 do briefing (HARNESS-UPGRADE-BRIEFING.md). Nada vira código sem esta spec.
> Origem: avaliação de 3 achados + 1 manutenção. Due diligence ao vivo (jun/2026) registrada em `decisions.md`.

## Objetivo

Integrar ao harness **apenas** o que traz ganho real ao contexto do João (solo/dupla, NestJS/Prisma/PostgreSQL/EC2, eventual C#), rejeitando o resto com justificativa escrita. Resultado puxável via `install.sh` em qualquer máquina, com `verify.js --json` sem drift.

## Descoberta estrutural que guia o design

O harness tem **duas camadas**, que os documentos tratavam como uma:

| Camada | Arquivos | Usa MCP? | Lê GBrain? |
|--------|----------|----------|------------|
| **BSD headless** (autônomo `--execute`) | `tools/bsd.js`, `tools/agents.js`, `tools/llm.js` | ❌ não há cliente MCP no processo | ✅ lê `.gbrain/*.md` |
| **Camada interativa** (Claude Code/Cursor seguindo AGENT_RULES) | `config/mcp.json` mesclado em `~/.claude/settings.json` | ✅ | ✅ |

Logo: MCPs (codebase-memory, postgres) servem a camada **interativa** (Researcher/Reviewer humano+IA). O BSD headless continua determinístico e isolado. Nada aqui transforma `agents.js` em cliente MCP (fora do escopo "enxuto").

## Decisões (detalhe + porquê em `.gbrain/decisions.md`)

- **Achado 1 — agentmemory:** ❌ REJEITAR a dependência externa (instável: hotfix quase diário; token-burn issue #143 reaberta; benchmark auto-reportado; MCP de 53 tools = não-determinístico → fere a tese do harness; e não chega ao BSD headless). ✅ Resolver a dor real ("esqueci de gravar a decisão") com **hook nativo** que faz append de stub de decisão em `.gbrain/decisions.md`. Zero dep nova, determinístico, alimenta o BSD.
- **Achado 2 — codebase-memory-mcp:** ✅ ADOTAR como MCP da camada interativa (pin v0.8.1), **complementando** Repomix+RTK (não substituindo). Cobre TS+C# com resolução semântica. Reforça o papel Researcher.
- **Achado 3 — Bernstein:** ✅ MANTER scheduling do BSD (já 100% determinístico — ordem hardcoded em `bsd.js`, LLM só gera conteúdo). Importar só o padrão barato: endurecer o gate de merge para **sinal concreto** (testes), e anotar FSM/audit assinado como futuro. Sem refatorar scheduling.
- **Manutenção — Postgres MCP:** ✅ Substituir o vulnerável `@modelcontextprotocol/server-postgres@0.6.2` por **Postgres MCP Pro `crystaldba/postgres-mcp@0.3.0`** na regra 7 + `registry.json` + `config/mcp.json`. Manter `prisma migrate diff/validate` como gate barato complementar. Registrar ressalva: crystaldba desacelerou (última release v0.3.0 mai/2025). Item 97 do briefing ("→ Supabase") é erro de digitação — confirmado pelo usuário que o substituto é crystaldba, não Supabase. `supabase-mcp` permanece opcional (projetos Supabase pontuais).

## Critérios de aceite

1. `registry.json`: harnessVersion 1.7.0; codebase-memory-mcp adicionado (pin v0.8.1); postgres-mcp-pro adicionado (pin v0.3.0); `server-postgres` marcado removido; tudo com `verify` válido.
2. `config/mcp.json`: server `postgres` aponta para crystaldba pinado; novo server `codebase-memory` pinado; sem referência ao server vulnerável.
3. `package.json`: remove `@modelcontextprotocol/server-postgres`; adiciona codebase-memory (se distribuído via npm) pinado; lockfile regenerado.
4. Hook nativo de captura de decisão: script + teste real (append idempotente em `decisions.md`), registrado e documentado.
5. `AGENT_RULES.md`: Researcher cita codebase-memory MCP; regra 7 cita Postgres MCP Pro (EXPLAIN+HypoPG) + Prisma; gate de merge por sinal concreto refletido.
6. `harness.yaml`, `VERSION` → 1.7.0; `install.sh` (msg + novas deps) atualizado; correção de portabilidade do `install.sh` incorporada.
7. `node tools/verify.js --json` passa sem drift (componentes required OK).
8. `README.md` / mapa do harness refletem a v1.7.0.
9. Cada decisão gravada em `.gbrain/decisions.md` com alternativa descartada + porquê.

## Prova viva (adaptada à realidade deste repo: tooling/config, não NestJS)

- Hook nativo: teste node real que cria um `decisions.md` temporário, roda o append duas vezes e assere idempotência + formato (sem mock).
- `verify.js --json`: roda e mostra saída verde.
- `mcp.json` e `registry.json`: parse válido (node -e JSON.parse).
- crystaldba: confirmar que `EXPLAIN` funciona via o novo MCP **antes de fechar** (gate de manutenção) — validação manual documentada, pois exige um Postgres ao vivo.

## Fora de escopo

- Transformar `agents.js`/BSD headless em cliente MCP.
- Refatorar scheduling do BSD (já determinístico).
- Vendorizar agentmemory ou qualquer FSM/audit-chain estilo Bernstein agora.

## Gate de saída

Bump 1.7.0 pinado, verify verde, docs coerentes, decisões registradas. **Push só após aprovação humana** (briefing: não é autorização de merge automático).
