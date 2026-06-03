# V-JP Harness — Registro de Componentes

> Matriz determinística de instalação. Espelho legível de [`registry.json`](./registry.json) — a **fonte da verdade** machine-readable consumida pelo verificador (`tools/verify.js`).
>
> **Regra de ouro:** toda versão é **pinada**. Nada de `@latest`. O `--doctor` falha em drift.

## Como verificar

```bash
node .harness/tools/bsd.js --doctor          # checa todos os componentes
node .harness/tools/bsd.js --doctor --strict # falha se QUALQUER opcional faltar
node .harness/tools/bsd.js --doctor --json   # saída para CI
```

## Registro Definitivo de Repositórios e Fontes

| # | Componente | Tipo | Repositório oficial | Versão pinada | Destino no ecossistema | Obrigatório |
|--:|---|---|---|---|---|:--:|
| 1 | **BSD** | Core Script | baseado em [`garrytan/gstack`](https://github.com/garrytan/gstack) | `1.2.0` | `.harness/tools/bsd.js` | ✅ |
| 2 | **RTK** | Engine / CLI | [`rtk-ai/rtk`](https://github.com/rtk-ai/rtk) | `0.39.0` | `.harness/tools/rtk/` | ⬜ |
| 3 | **GBrain** | Engine / Memória | [`garrytan/gbrain`](https://github.com/garrytan/gbrain) | `0.35.1.0` | `.harness/tools/gbrain/` (persiste em `.gbrain/`) | ⬜ |
| 4 | **Repomix** | CLI (NPM) | [`yamadashy/repomix`](https://github.com/yamadashy/repomix) | `0.2.14` | `.harness/tools/` | ✅ |
| 5 | **GSD Redux** | CLI (NPM) | [`open-gsd/get-shit-done-redux`](https://github.com/open-gsd/get-shit-done-redux) | `1.1.0` | `.harness/tools/` | ✅ |
| 6 | **Superpowers** | CLI / Engine | [`obra/superpowers`](https://github.com/obra/superpowers) | `v5.1.0` | `.harness/tools/superpowers/` | ⬜ |
| 7 | **PostgreSQL MCP** | Servidor MCP | [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) | `0.6.2` | runtime (Claude/Cursor) via `config/mcp.json` | ⬜ |
| 8 | **Playwright MCP** | Servidor MCP | [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) | `0.0.75` | runtime (Claude/Cursor) via `config/mcp.json` | ⬜ |
| 9 | **Frontend Designer** | Skill / Spec | [`anthropics/skills`](https://github.com/anthropics/skills) (`frontend-design`) | `main` | `.harness/tools/frontend-designer.md` | ⬜ |

**Obrigatórios (núcleo determinístico):** BSD, Repomix, GSD Redux — pinados via `package-lock.json` (`npm ci`).
**Opcionais:** instalados sob demanda; o `--doctor` os reporta como `[opt]` sem bloquear (a menos que `--strict`).

## Notas de pinagem

- **GSD Redux**: o repo canônico é `open-gsd/get-shit-done-redux` (pacote npm `@opengsd/get-shit-done-redux`).
- **GBrain**: tag mais recente `eval-run-v0.35.1.0-baseline` (→ `0.35.1.0`). Instalado via `/setup-gbrain` (binário bun).
- **MCPs**: a origem de provenance é `modelcontextprotocol/servers`; o **artefato de install determinístico** é o pacote npm pinado (`@modelcontextprotocol/server-postgres@0.6.2`, `@playwright/mcp@0.0.75`) em `.harness/tools`, injetado no runtime via `config/mcp.json`. Nunca `@latest`.

## Tiers de determinismo

| Tier | Mecanismo de pin | Garantia |
|---|---|---|
| npm (Repomix, GSD, MCPs) | `package-lock.json` + `npm ci` | **Total** — árvore idêntica byte-a-byte |
| git (GBrain, Superpowers, RTK) | tag / commit SHA | **Total** se instalar pelo ref pinado |
| binário (RTK) | versão + `rtk --version` | **Alta** — verificada, origem externa |
| skill/spec (Frontend Designer) | ref do `anthropics/skills` | spec vendorizada em `tools/` |

## Atualizando um pin

1. Edite a versão em `registry.json` **e** na origem (`package.json` / tag).
2. `npm install` em `.harness/tools` para regenerar o `package-lock.json`.
3. `--doctor` para confirmar.
4. Registre em `.gbrain/decisions.md` (ADR).
