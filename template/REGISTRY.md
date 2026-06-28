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
| 1 | **BSD** | Core Script | baseado em [`garrytan/gstack`](https://github.com/garrytan/gstack) | `1.6.0` | `.harness/tools/bsd.js` | ✅ |
| 2 | **RTK** | Engine / CLI | [`rtk-ai/rtk`](https://github.com/rtk-ai/rtk) | `0.42.3` | `.harness/tools/rtk/` | ⬜ |
| 3 | **GBrain** | Engine / Memória | [`garrytan/gbrain`](https://github.com/garrytan/gbrain) | `0.35.1.0` | `.harness/tools/gbrain/` (persiste em `.gbrain/`) | ⬜ |
| 4 | **Repomix** | CLI (NPM) | [`yamadashy/repomix`](https://github.com/yamadashy/repomix) | `0.2.14` | `.harness/tools/` | ✅ |
| 5 | **GSD Redux** | CLI (NPM) | [`open-gsd/get-shit-done-redux`](https://github.com/open-gsd/get-shit-done-redux) | `1.1.0` | `.harness/tools/` | ✅ |
| 6 | **Superpowers** | CLI / Engine | [`obra/superpowers`](https://github.com/obra/superpowers) | `v5.1.0` | `.harness/tools/superpowers/` | ⬜ |
| 7 | ~~**PostgreSQL MCP**~~ | Servidor MCP | [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) | ~~`0.6.2`~~ | ❌ **REMOVIDO na v1.7.0** (SQLi + arquivado) → use #12 | ⬜ |
| 8 | **Playwright MCP** | Servidor MCP | [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) | `0.0.75` | runtime (Claude/Cursor) via `config/mcp.json` | ⬜ |
| 9 | **Frontend Designer** | Skill / Spec | [`anthropics/skills`](https://github.com/anthropics/skills) (`frontend-design`) | `main` | `.harness/tools/frontend-designer.md` | ⬜ |
| 10 | **Supabase MCP** | Servidor MCP | [`supabase-community/supabase-mcp`](https://github.com/supabase-community/supabase-mcp) | `0.8.2` | runtime — **só projetos Supabase pontuais** | ⬜ |
| 11 | 🆕 **Codebase Memory MCP** | Servidor MCP (NPM) | [`DeusData/codebase-memory-mcp`](https://github.com/DeusData/codebase-memory-mcp) | `0.8.1` | runtime — reforça o **Researcher** (TS/C#) | ⬜ |
| 12 | 🆕 **Postgres MCP Pro** | Servidor MCP (pip/Docker) | [`crystaldba/postgres-mcp`](https://github.com/crystaldba/postgres-mcp) | `0.3.0` | runtime — **Reviewer** (EXPLAIN + HypoPG), substitui #7 | ⬜ |

**Obrigatórios (núcleo determinístico):** BSD, Repomix, GSD Redux — pinados via `package-lock.json` (`npm ci`).
**Opcionais:** instalados sob demanda; o `--doctor` os reporta como `[opt]` sem bloquear (a menos que `--strict`).
**Novidades v1.7.0:** #11 codebase-memory-mcp (npm, pinado), #12 Postgres MCP Pro (substitui o #7 vulnerável; roda via `uvx`/Docker). Detalhes e justificativa em [`../.gbrain/decisions.md`](../.gbrain/decisions.md) e `upgrades/v1.7.0/`.

## Notas de pinagem

- **GSD Redux**: o repo canônico é `open-gsd/get-shit-done-redux` (pacote npm `@opengsd/get-shit-done-redux`).
- **GBrain**: tag mais recente `eval-run-v0.35.1.0-baseline` (→ `0.35.1.0`). Instalado via `/setup-gbrain` (binário bun).
- **MCPs (npm)**: `@playwright/mcp@0.0.75` e `codebase-memory-mcp@0.8.1` são pinados via `package-lock.json` em `.harness/tools` e injetados no runtime via `config/mcp.json`. Nunca `@latest`.
- **Postgres MCP Pro** (`crystaldba/postgres-mcp@0.3.0`): roda fora do npm — `uvx postgres-mcp==0.3.0` (Python 3.12+) ou Docker `crystaldba/postgres-mcp:0.3.0`. Substitui o antigo `server-postgres@0.6.2`, **removido na v1.7.0** por SQL injection e descontinuação upstream.

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
