# Codebase Memory MCP

**Tier:** mcp · **Versão pinada:** `0.8.1` · **Origem:** `DeusData/codebase-memory-mcp` (https://github.com/DeusData/codebase-memory-mcp) · **Licença:** MIT · **Destino:** runtime (injetado no Claude/Cursor) · **Adicionado:** v1.7.0

## Responsabilidade
Inteligência de código via **grafo persistente de símbolos** (SQLite local). Reforça o agente **Researcher** na camada interativa:
- mapeia o **diff do git → símbolos afetados** + blast radius / classificação de risco;
- **detecta código morto** (funções sem callers, fora entry points);
- resolve o **grafo de chamadas** (import-aware, type-inferred, cross-file).

## Complementa — não substitui — Repomix+RTK
- **Repomix + RTK:** visão do **todo**, comprimida (contexto amplo).
- **Codebase Memory:** query **cirúrgica** de impacto (poucos tokens).
São propósitos diferentes; o Researcher usa os dois.

## Cobertura do stack V-JP
Resolução **semântica real** (tipos/símbolos) cobre **TypeScript e C#** — além de Python, Go, Java, Rust, C/C++, PHP, Kotlin. As demais ~158 linguagens são só sintáticas (tree-sitter).

## Instalação
Pinado em `.harness/tools/package.json`, instalado via `npm ci`. Registre no cliente mesclando [`../config/mcp.json`](../config/mcp.json):
```json
"codebase-memory": {
  "command": "node",
  "args": [".harness/tools/node_modules/codebase-memory-mcp/bin.js"]
}
```

## Verificação
```bash
test -f .harness/tools/node_modules/codebase-memory-mcp/bin.js && echo OK
```

## Determinismo / ressalva
Pin exato `0.8.1` + `package-lock.json`. **Ressalva** (em `.gbrain/decisions.md`): o headline "~99% menos tokens" é auto-reportado para repos gigantes; em repo NestJS médio o ganho real é moderado. Só camada interativa — o **BSD headless não é cliente MCP**.
