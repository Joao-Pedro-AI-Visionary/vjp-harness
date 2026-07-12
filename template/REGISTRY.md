# V-JP Harness — Registro de Componentes

> Matriz determinística de instalação. Espelho legível de [`registry.json`](./registry.json) — a **fonte da verdade** machine-readable consumida pelo verificador (`tools/verify.js`).
>
> **Regra de ouro:** toda versão é **pinada**. Nada de `@latest`. O `--doctor` falha em drift.
> **v1.10.2:** Constitution 9 artigos + OWASP Security em `AGENT_RULES.md §0/§0.1`; skill `vjp-orchestration` (Context Bundle, Adversarial Review, Kanban); Hono+Drizzle+Zod homologado como **stack alternativa** (NÃO substitui NestJS+Prisma). ADR completo em `.gbrain/decisions.md`.
> **v1.11.0:** Portões — Definição de Pronto (`gates.js`) e Aferidor de Confiança — Camada de Dados (`aferidor-log.js`) registrados como componentes `core` obrigatórios. Ver `tools/gates.md` e `specs/metodo-duravel-portoes-dial/spec.md`.
> **v1.12.0:** Dial de Coreografia (Fase 2)
> **v1.13.0:** Aferidor Analisador (Fase 3)
> **v1.14.0:** Probe Sombra + Conjunto-Canário (Fase 4)
> **v1.15.0:** Portas (adaptadores c/ fallback) + Mirror de Upstreams (Fase 5)

## Como verificar

```bash
node .harness/tools/bsd.js --doctor          # checa todos os componentes
node .harness/tools/bsd.js --doctor --strict # falha se QUALQUER opcional faltar
node .harness/tools/bsd.js --doctor --json   # saída para CI
```

## Registro Definitivo de Repositórios e Fontes

| # | Papel (o que faz) | Tipo | Procedência (repositório) | Versão pinada | Destino no ecossistema | Obrigatório |
|--:|---|---|---|---|---|:--:|
| 1 | **Maestro** | Core Script | BSD — baseado em [`garrytan/gstack`](https://github.com/garrytan/gstack) | `1.6.0` | `.harness/tools/bsd.js` | ✅ |
| 2 | **Compressor de Contexto** | Engine / CLI | [`rtk-ai/rtk`](https://github.com/rtk-ai/rtk) (RTK) | `0.42.4` | `.harness/tools/rtk/` | ⬜ |
| 3 | **Memória Persistente** | Engine / Memória | [`garrytan/gbrain`](https://github.com/garrytan/gbrain) (GBrain) | `0.35.1.0` | `.harness/tools/gbrain/` (persiste em `.gbrain/`) | ⬜ |
| 4 | **Empacotador de Repositório** | CLI (NPM) | [`yamadashy/repomix`](https://github.com/yamadashy/repomix) (Repomix) | `1.16.0` | `.harness/tools/` | ✅ |
| 5 | **Planejador Spec-Driven** | CLI (NPM) | [`open-gsd/get-shit-done-redux`](https://github.com/open-gsd/get-shit-done-redux) (GSD) | `1.1.0` | `.harness/tools/` | ✅ |
| 6 | **Padrões Reutilizáveis / Skills** | CLI / Engine | [`obra/superpowers`](https://github.com/obra/superpowers) (Superpowers) | `v5.1.0` | `.harness/tools/superpowers/` | ⬜ |
| 7 | ~~**Validador de Banco (legado)**~~ | Servidor MCP | [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) (PostgreSQL MCP) | ~~`0.6.2`~~ | ❌ **REMOVIDO na v1.7.0** (SQLi + arquivado) → use #12 | ⬜ |
| 8 | **Validador de UI / E2E** | Servidor MCP | [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) (Playwright MCP) | `0.0.75` | runtime (Claude/Cursor) via `config/mcp.json` | ⬜ |
| 9 | **Guia de Design de UI** | Skill / Spec | [`anthropics/skills`](https://github.com/anthropics/skills) (Frontend Designer) | `main` | `.harness/tools/frontend-designer.md` | ⬜ |
| 10 | **Banco Supabase (opcional)** | Servidor MCP | [`supabase-community/supabase-mcp`](https://github.com/supabase-community/supabase-mcp) | `0.8.2` | runtime — **só projetos Supabase pontuais** | ⬜ |
| 11 | 🆕 **Mapa de Código** | Servidor MCP (NPM) | [`DeusData/codebase-memory-mcp`](https://github.com/DeusData/codebase-memory-mcp) | `0.8.1` | runtime — reforça o **Pesquisador** (TS/C#) | ⬜ |
| 12 | 🆕 **Validador de Banco (EXPLAIN/índices)** | Servidor MCP (pip/Docker) | [`crystaldba/postgres-mcp`](https://github.com/crystaldba/postgres-mcp) (Postgres MCP Pro) | `0.3.0` | runtime — **Revisor** (EXPLAIN + HypoPG), substitui #7 | ⬜ |
| 13 | 🆕 **Stack Alternativa — Hono + Drizzle + Zod (Bun)** | Stack externa | [`hono`](https://hono.dev/) + [`drizzle-orm`](https://orm.drizzle.team/) + [`zod`](https://zod.dev/) + [`bun`](https://bun.sh/) | n/a (escolha por projeto) | projeto (NÃO em `.harness/`) — ver `tools/hono-drizzle.md` + ADR v1.10.2 | ⬜ |
| 14 | 🆕 **Arquiteto Vertical Slice + DDD** | Skill / Arquitetura | Skill nativa VJP Harness | `1.0.0` | `.harness/tools/vertical-slice-ddd.md` | ⬜ |
| 15 | 🆕 **Designer API-First (OpenAPI/AsyncAPI)** | Skill / API | Spec vendorizada VJP Harness | `1.0.0` | `.harness/tools/api-first.md` + `config/openapi-template.yaml` | ⬜ |
| 16 | 🆕 **Documentador Diátaxis** | Skill / Framework | Framework [diátaxis (divirgat.io)](https://diataxis.fr/) | `1.0.0` | `.harness/tools/diataxis-docs.md` + `docs/` | ⬜ |
| 17 | 🆕 **Portões — Definição de Pronto** | Script / Gate | Nativo V-JP Harness (João Pedro) | `1.11.0` | `.harness/tools/gates.js` | ✅ |
| 18 | 🆕 **Aferidor de Confiança — Camada de Dados** | Script / Telemetria | Nativo V-JP Harness (João Pedro) | `1.11.0` | `.harness/tools/aferidor-log.js` | ✅ |
| 19 | 🆕 **Dial de Coreografia** | Script / Coreografia | Nativo V-JP Harness (João Pedro) | `1.12.0` | `.harness/tools/dial.js` | ✅ |
| 20 | 🆕 **Aferidor de Confiança — Analisador** | Script / Telemetria | Nativo V-JP Harness (João Pedro) | `1.13.0` | `.harness/tools/aferidor-analise.js` | ✅ |
| 21 | 🆕 **Probe Sombra + Conjunto-Canário** | Script / Probe | Nativo V-JP Harness (João Pedro) | `1.14.0` | `.harness/tools/sombra.js` | ✅ |
| 22 | 🆕 **Portas — Adaptadores por Papel** | Script / Porta | Nativo V-JP Harness (João Pedro) | `1.15.0` | `.harness/tools/ports.js` | ✅ |
| 23 | 🆕 **Mirror de Upstreams** | Script / Mirror | Nativo V-JP Harness (João Pedro) | `1.15.0` | `.harness/tools/mirror.js` | ✅ |

**Obrigatórios (núcleo determinístico):** Maestro, Empacotador de Repositório, Planejador Spec-Driven, Portões, Aferidor de Confiança, Dial de Coreografia, Aferidor de Confiança — Analisador, Probe Sombra + Conjunto-Canário, Portas — Adaptadores por Papel, Mirror de Upstreams — pinados via `package-lock.json` (`npm ci`) ou nativos do harness (`gates.js`/`aferidor-log.js`/`dial.js`/`aferidor-analise.js`/`sombra.js`/`ports.js`/`mirror.js`).
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
