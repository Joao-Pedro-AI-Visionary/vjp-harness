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

## Matriz de componentes

| # | Componente | Tier | Origem | Versão pinada | Instalação | Obrigatório |
|--:|---|---|---|---|---|:--:|
| 1 | **BSD** | core | bundled (este repo) | `1.1.0` | incluído | ✅ |
| 2 | **RTK** | core | binário `rtk-ai` | `0.39.0` | `~/.local/bin/rtk` · [doc](./tools/rtk.md) | ⬜ |
| 3 | **GBrain** | core | gstack (bun) | `1.55.1.0` | `/setup-gbrain` · [doc](./tools/gbrain.md) | ⬜ |
| 4 | **Repomix** | core | npm `repomix` | `0.2.14` | `npm ci` (tools) | ✅ |
| 5 | **GSD Redux** | core | npm `@opengsd/get-shit-done-redux` | `1.1.0` | `npm ci` (tools) | ✅ |
| 6 | **GStack** | platform | git `garrytan/gstack` | `1.55.1.0` @ `c43c850cae77` | plugin marketplace · [doc](./tools/gstack.md) | ⬜ |
| 7 | **Superpowers** | skill | git `obra/superpowers` | `v5.1.0` @ `f2cbfbefebbf` | plugin · [doc](./tools/superpowers.md) | ⬜ |
| 8 | **Frontend Designer** | skill | gstack (skills `design-*`) | `1.55.1.0` | incluído no gstack · [doc](./tools/frontend-designer.md) | ⬜ |
| 9 | **PostgreSQL MCP** | mcp | npm `@modelcontextprotocol/server-postgres` | `0.6.2` | `npm ci` + `config/mcp.json` · [doc](./tools/postgres-mcp.md) | ⬜ |
| 10 | **Playwright MCP** | mcp | npm `@playwright/mcp` | `0.0.75` | `npm ci` + `config/mcp.json` · [doc](./tools/playwright-mcp.md) | ⬜ |

**Obrigatórios (core mínimo determinístico):** BSD, Repomix, GSD Redux — todos pinados via `package-lock.json` (`npm ci`).
**Opcionais:** instalados sob demanda; o `--doctor` os reporta como `[opt]` sem bloquear (a menos que `--strict`).

## Tiers de determinismo

| Tier | Mecanismo de pin | Garantia |
|---|---|---|
| npm (Repomix, GSD, MCPs) | `package-lock.json` + `npm ci` | **Total** — árvore idêntica byte-a-byte |
| git (GStack, Superpowers) | commit SHA / tag | **Total** se instalar pelo commit pinado |
| binário (RTK) | versão + `rtk --version` | **Alta** — verificada, mas origem externa |
| gstack/skill (GBrain, Frontend Designer) | versão do gstack | herda o pin do gstack |

## Atualizando um pin

1. Edite a versão em `registry.json` **e** no `package.json`/origem correspondente.
2. Rode `npm install` em `.harness/tools` para regenerar o `package-lock.json`.
3. Rode `--doctor` para confirmar.
4. Registre a mudança em `.gbrain/decisions.md` (ADR).
