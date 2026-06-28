# Postgres MCP Pro (crystaldba)

**Tier:** mcp · **Versão pinada:** `0.3.0` · **Origem:** `crystaldba/postgres-mcp` (https://github.com/crystaldba/postgres-mcp) · **Licença:** MIT · **Destino:** runtime (injetado no Claude/Cursor) · **Adicionado:** v1.7.0

> ⚠️ **Substituiu (v1.7.0)** o antigo `@modelcontextprotocol/server-postgres@0.6.2`, **removido** por SQL injection (burla do read-only via múltiplos statements) e por estar descontinuado/arquivado upstream (jul/2025). O crystaldba é projeto **distinto e seguro**.

## Responsabilidade
Inspecionar schema, validar migrations e analisar o plano de execução (`EXPLAIN` com o **cost model do planner**), além de **simular índices hipotéticos (HypoPG)** antes de criá-los. Usado pelo agente **Reviewer** (regra 7).

## Por que este (e não Supabase)
Postgres **puro** via connection string — bate com a stack principal V-JP (Prisma + PostgreSQL em EC2). Supabase MCP fica só para projetos Supabase pontuais (`registry.json#supabase-mcp`).

## Modos de acesso
- `--access-mode=restricted` → **read-only** com transações limitadas. Use **contra produção**.
- `--access-mode=unrestricted` → leitura/escrita. Use em dev/homologação.

## Execução (pinada)
Roda **fora do npm** (Python). Duas formas pinadas:
```bash
# uvx (Python 3.12+)
uvx postgres-mcp==0.3.0 --access-mode=restricted

# Docker
docker run -i --rm -e DATABASE_URI crystaldba/postgres-mcp:0.3.0 --access-mode=restricted
```
Registre no cliente mesclando [`../config/mcp.json`](../config/mcp.json) (server `postgres`); informe `DATABASE_URI=postgresql://user:pass@host:5432/db` por env.

**Extensões recomendadas no banco:** `pg_stat_statements` (estatísticas) e `hypopg` (índice hipotético). Funciona sem elas, com recursos reduzidos.

## Gate barato complementar (sem banco ao vivo)
`prisma migrate diff` / `prisma validate` — valida a migration sem subir Postgres. O MCP Pro entra quando há banco para o EXPLAIN/HypoPG reais.

## Verificação
```bash
uvx postgres-mcp==0.3.0 --version   # espera 0.3.0
```

## Determinismo / ressalva
Pin exato `==0.3.0` (uvx) ou tag `:0.3.0` (Docker). **Ressalva** (em `.gbrain/decisions.md`): projeto desacelerou — último commit ~jan/2026, release v0.3.0 de mai/2025. É o Postgres MCP mais popular (MIT); candidato a fork se abandonar.
