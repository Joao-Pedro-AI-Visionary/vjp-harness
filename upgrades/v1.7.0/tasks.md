# tasks.md — Upgrade v1.7.0 (uma área por vez, prova viva por item)

> Ordem obrigatória do briefing (gate 4): Achado 2 → Manutenção → registrar decisões 1 e 3 → versionar/doc.
> Cada task só fecha com prova viva. ❌ mock volátil de banco.

## Área A — Achado 2: codebase-memory-mcp (MCP interativo)
- [ ] A1. Confirmar nome exato do pacote de distribuição + binário/entrypoint MCP e a versão pinável (v0.8.1). (`npm view` / release).
- [ ] A2. `registry.json`: novo componente `codebase-memory-mcp`, tier mcp, pin v0.8.1, MIT, `verify` adequado (file se npm; senão command).
- [ ] A3. `config/mcp.json`: server `codebase-memory` pinado (stdio).
- [ ] A4. Se npm: `package.json` + lockfile pinados.
- [ ] A5. `AGENT_RULES.md`: Researcher passa a citar codebase-memory (impacto cirúrgico) ao lado de Repomix+RTK.
- [ ] A6. `tools/codebase-memory-mcp.md`: doc curta (o quê, por quê, como roda, pin).
- [ ] PROVA A: `node tools/verify.js --json` lista o componente OK; `mcp.json` parse válido.

## Área B — Manutenção: Postgres MCP → Postgres MCP Pro (crystaldba)
- [ ] B1. Confirmar comando de execução pinado (uvx `postgres-mcp==0.3.0` ou Docker `crystaldba/postgres-mcp:0.3.0`) + flags `--access-mode`.
- [ ] B2. `registry.json`: marcar `server-postgres` como `removed:true`/deprecated; adicionar `postgres-mcp-pro` pin v0.3.0, MIT, com `securityNote` (substitui o vulnerável) e ressalva de atividade.
- [ ] B3. `config/mcp.json`: trocar server `postgres` para crystaldba (restricted por padrão; connection string via env).
- [ ] B4. `package.json`: remover `@modelcontextprotocol/server-postgres`; lockfile regenerado.
- [ ] B5. `AGENT_RULES.md` regra 7 + Reviewer: Postgres MCP Pro (EXPLAIN cost model + índice hipotético HypoPG) **e** `prisma migrate diff/validate` como gate barato.
- [ ] B6. `tools/postgres-mcp.md`: reescrever (Pro + por que trocou + ressalva + modos restricted/unrestricted).
- [ ] PROVA B: verify verde; nota de validação manual do EXPLAIN ao vivo (exige Postgres) registrada como pendência de confirmação antes do fechamento.

## Área C — Achado 1: hook nativo de captura de decisão (GBrain)
- [ ] C1. `tools/gbrain-decision.js`: CLI `decision "<o quê>" --alt "<descartada>" --why "<porquê>"` que faz append formatado e idempotente em `.gbrain/decisions.md`.
- [ ] C2. Hook opcional (`machine/hooks/`) Stop/SessionEnd que lembra/append stub de decisão do dia se ausente.
- [ ] C3. Teste node real (`tools/gbrain-decision.test.mjs` ou similar): append duplo → idempotência + formato. Sem mock.
- [ ] C4. `tools/gbrain.md` / doc: documentar o helper nativo (e por que NÃO agentmemory).
- [ ] PROVA C: rodar o teste e mostrar verde.

## Área D — Bernstein: gate de merge por sinal concreto
- [ ] D1. Em `bsd.js`, garantir/clarificar que o gate de merge é `testPassed` (sinal objetivo) — o `approved` do LLM-reviewer não pode sobrepor teste falho (já é `approved && testPassed`; documentar/endurecer e comentar).
- [ ] D2. `AGENT_RULES.md` Reviewer: explicitar "não confiar na alegação do agente; sinal concreto manda".
- [ ] PROVA D: dry-run `--execute X --dry-run` mostra a mecânica intacta.

## Área E — Versionamento, decisões e docs
- [ ] E1. Reaplicar a correção de portabilidade do `install.sh` (stash) + atualizar msg da linha de deps instaladas.
- [ ] E2. `VERSION`, `harness.yaml`, `registry.json` → 1.7.0; `REGISTRY.md` espelhado.
- [ ] E3. `.gbrain/decisions.md`: 4 decisões (1 rejeição + 3 adoções/manutenção) com alternativa + porquê.
- [ ] E4. `README.md` + mapa do harness refletindo v1.7.0.
- [ ] E5. `verify.js --json` final verde; `package-lock.json` consistente.
- [ ] PROVA E: doctor verde + diff revisado.

## Gate de saída
- [ ] Resumo final: o que entrou, o que ficou de fora, porquê.
- [ ] **Pausa para aprovação humana antes de merge na main + push** (briefing).
