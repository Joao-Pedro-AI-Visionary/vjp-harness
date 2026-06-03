# Playwright MCP

**Tier:** mcp · **Versão pinada:** `0.0.75` · **Origem:** npm `@playwright/mcp`

## Responsabilidade
Automação E2E, testes de interface, fluxos completos, simulação de usuário real. Usado pelo agente **Reviewer** quando rotas frontend são expostas/modificadas.

## Gatilhos (harness.yaml)
Diretórios `web/`, `frontend/`, `mobile/`.

## Instalação
Pinado em `.harness/tools/package.json`, instalado via `npm ci`. Registre no cliente mesclando [`../config/mcp.json`](../config/mcp.json):
```json
"playwright": {
  "command": "node",
  "args": [".harness/tools/node_modules/@playwright/mcp/cli.js"]
}
```

## Verificação
```bash
test -f .harness/tools/node_modules/@playwright/mcp/package.json && echo OK
```

## Determinismo
Total — versão exata + `package-lock.json`. Sem `@latest`.
