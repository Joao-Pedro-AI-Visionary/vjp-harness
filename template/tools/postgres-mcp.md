# PostgreSQL MCP

**Tier:** mcp · **Versão pinada:** `0.6.2` · **Origem:** npm `@modelcontextprotocol/server-postgres`

## Responsabilidade
Inspecionar schema, validar queries, verificar índices, analisar relacionamentos e validar plano de execução (`EXPLAIN`). Usado pelo agente **Reviewer**.

## Gatilhos (harness.yaml)
Extensões `.repository.ts`, `.entity.ts`, `prisma`.

## Instalação
Pinado em `.harness/tools/package.json`, instalado via `npm ci`. Registre no cliente mesclando [`../config/mcp.json`](../config/mcp.json):
```json
"postgres": {
  "command": "node",
  "args": [".harness/tools/node_modules/@modelcontextprotocol/server-postgres/dist/index.js",
           "postgresql://localhost:5432/SEU_DB"]
}
```

## Verificação
```bash
test -f .harness/tools/node_modules/@modelcontextprotocol/server-postgres/dist/index.js && echo OK
```

## Determinismo
Total — versão exata + `package-lock.json`. Sem `@latest`.
