# V-JP Harness — Registro de Componentes

> Matriz determinística de instalação. Espelho legível de [`registry.json`](./registry.json) — a **fonte da verdade** machine-readable consumida pelo verificador (`tools/verify.js`).
>
> **Regra de ouro:** toda versão é **pinada**. Nada de `@latest`. O `--doctor` falha em drift.
> **v1.22.0:** Compressor de Contexto trocado: RTK (hook no Bash) → **Headroom** `0.39.1` (proxy local por sessão via `headroom wrap claude`, comprime toda a janela, telemetria `HEADROOM_BEACON=off`). Spec em `specs/headroom-no-lugar-do-rtk/`.
> **v1.21.1:** Orçamento mecânico de testes (`tools/test-budget.js` + `dial.testBudget`) — anti-loop Codex (`VJP_CODEX=1` / `VJP_TEST_BUDGET=1`). Contador em `.bsd/test-budget.json`; stop-continue não zera. Default Codex 1 run + 1 edit; Dial 3 no máximo 2/2.
> **v1.10.2:** Constitution 9 artigos + OWASP Security em `AGENT_RULES.md §0/§0.1`; skill `vjp-orchestration` (Context Bundle, Adversarial Review, Kanban); Hono+Drizzle+Zod homologado como **stack alternativa** (NÃO substitui NestJS+Prisma). ADR completo em `.gbrain/decisions.md`.
> **v1.11.0:** Portões — Definição de Pronto (`gates.js`) e Aferidor de Confiança — Camada de Dados (`aferidor-log.js`) registrados como componentes `core` obrigatórios. Ver `tools/gates.md` e `specs/metodo-duravel-portoes-dial/spec.md`.
> **v1.12.0:** Dial de Rigor (Fase 2)
> **v1.13.0:** Aferidor Analisador (Fase 3)
> **v1.14.0:** Probe Sombra + Conjunto-Canário (Fase 4)
> **v1.15.0:** Portas (adaptadores c/ fallback) + Mirror de Upstreams (Fase 5)
> **v1.16.0:** Sombra de Verdade — runner LLM (amostrado)
> **v1.18.0:** Gate local de push (`tools/hooks/pre-push`) — bloqueia push com teste falhando; substitui a branch protection do GitHub, indisponível em repo privado sem plano Pro. Torna mecânicos o Art. III, a §2 e a §8.4.
> **v1.20.0:** Skill global `/prepush` (`machine/export/skills/prepush/`) — gate em camadas antes de **qualquer** push: fetch+rebase obrigatório na base (pull antes de push, mecânico), gitleaks + varredura de segredos/`.env`/caminho pessoal, estático, suíte completa, cobertura da mudança; depois orquestra `test-gate` (prova viva) → `pr-review` + `/code-review` (+ CodeRabbit/Greptile CLI opcionais) → push/PR/CI. O hook `tools/hooks/pre-push` passa a chamar o gate mecânico dela quando instalada (bloqueia branch **atrás**, segredo e teste quebrado); sem ela mantém o v1.18. Registrada no `registry.json` (tier `skill`, verificada pelo `--doctor`). Levantamento de mercado em `skills/prepush/reference/camadas-e-mercado.md`.
> **v1.19.0:** Portões de qualidade `test-gate` + `pr-review` como skills GLOBAIS (`~/.claude/skills/`, instaladas pelo `bootstrap.sh` passo 6, verificadas pelo `--doctor`). Fia o portão **`prova-viva`** no `gates.js`: recibo em `.bsd/prova-viva.json` conferido contra o `HEAD` — **verde de outro commit conta como vermelho**. Rigor proporcional pelo Dial (`stageMinLevel: test-gate=1, pr-review=2`), sem lei nova. `contrato-bate` e `owasp` seguem `unknown` por decisão consciente (ADR). Ver `specs/quality-gates-pr-review-test-gate/spec.md`.
> **v1.17.0:** `AGENT_RULES.md §8` — Protocolo de Orquestração de Grafos & Verificação Adversarial (nó verificador cético separado do executor; gate de reatividade de estado + propagação de dado; formato de resposta com evidência obrigatória). Corrige também o cabeçalho do `AGENT_RULES.md`, defasado em v1.10.3 desde a série 1.11–1.16.

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
| 2 | **Compressor de Contexto** | Proxy / CLI (PyPI) | [`headroomlabs-ai/headroom`](https://github.com/headroomlabs-ai/headroom) (Headroom) | `0.39.1` | runtime (`uv tool`; `headroom wrap claude`) | ⬜ |
| 3 | **Memória Persistente** | Engine / Memória | [`garrytan/gbrain`](https://github.com/garrytan/gbrain) (GBrain) | `0.35.1.0` | `.harness/tools/gbrain/` (persiste em `.gbrain/`) | ⬜ |
| 4 | **Empacotador de Repositório** | CLI (NPM) | [`yamadashy/repomix`](https://github.com/yamadashy/repomix) (Repomix) | `1.16.0` | `.harness/tools/` | ✅ |
| 5 | **Planejador Spec-Driven** | CLI (NPM) | [`open-gsd/get-shit-done-redux`](https://github.com/open-gsd/get-shit-done-redux) (GSD) | `1.1.0` | `.harness/tools/` | ✅ |
| 6 | **Padrões Reutilizáveis / Skills** | CLI / Engine | [`obra/superpowers`](https://github.com/obra/superpowers) (Superpowers) | `v5.1.0` | `.harness/tools/superpowers/` | ⬜ |
| 7 | ~~**Validador de Banco (legado)**~~ | Servidor MCP | [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) (PostgreSQL MCP) | ~~`0.6.2`~~ | ❌ **REMOVIDO na v1.7.0** (SQLi + arquivado) → use #12 | ⬜ |
| 8 | **Validador de UI / E2E** | Servidor MCP | [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) (Playwright MCP) | `0.0.75` | runtime (Claude/Cursor) via `config/mcp.json` | ⬜ |
| 9 | **Guia de Design de UI** | Skill / Spec | [`anthropics/skills`](https://github.com/anthropics/skills) (Frontend Designer) | `main` | `.harness/tools/frontend-designer.md` | ⬜ |
| 10 | **Banco Supabase (opcional)** | Servidor MCP | [`supabase-community/supabase-mcp`](https://github.com/supabase-community/supabase-mcp) | `0.8.2` | runtime — **só projetos Supabase pontuais** | ⬜ |
| 11 | **Mapa de Código** | Binário via NPM (modo `cli`) + MCP opcional | [`DeusData/codebase-memory-mcp`](https://github.com/DeusData/codebase-memory-mcp) | `0.10.8` | `.harness/tools/` — chamado pela porta #25; MCP só em escopo local | ⬜ |
| 12 | 🆕 **Validador de Banco (EXPLAIN/índices)** | Servidor MCP (pip/Docker) | [`crystaldba/postgres-mcp`](https://github.com/crystaldba/postgres-mcp) (Postgres MCP Pro) | `0.3.0` | runtime — **Revisor** (EXPLAIN + HypoPG), substitui #7 | ⬜ |
| 13 | 🆕 **Stack Alternativa — Hono + Drizzle + Zod (Bun)** | Stack externa | [`hono`](https://hono.dev/) + [`drizzle-orm`](https://orm.drizzle.team/) + [`zod`](https://zod.dev/) + [`bun`](https://bun.sh/) | n/a (escolha por projeto) | projeto (NÃO em `.harness/`) — ver `tools/hono-drizzle.md` + ADR v1.10.2 | ⬜ |
| 14 | 🆕 **Arquiteto Vertical Slice + DDD** | Skill / Arquitetura | Skill nativa VJP Harness | `1.0.0` | `.harness/tools/vertical-slice-ddd.md` | ⬜ |
| 15 | 🆕 **Designer API-First (OpenAPI/AsyncAPI)** | Skill / API | Spec vendorizada VJP Harness | `1.0.0` | `.harness/tools/api-first.md` + `config/openapi-template.yaml` | ⬜ |
| 16 | 🆕 **Documentador Diátaxis** | Skill / Framework | Framework [diátaxis (divirgat.io)](https://diataxis.fr/) | `1.0.0` | `.harness/tools/diataxis-docs.md` + `docs/` | ⬜ |
| 17 | 🆕 **Portões — Definição de Pronto** | Script / Gate | Nativo V-JP Harness (João Pedro) | `1.11.0` | `.harness/tools/gates.js` | ✅ |
| 18 | 🆕 **Aferidor de Confiança — Camada de Dados** | Script / Telemetria | Nativo V-JP Harness (João Pedro) | `1.11.0` | `.harness/tools/aferidor-log.js` | ✅ |
| 19 | 🆕 **Dial de Rigor** | Script / Rigor | Nativo V-JP Harness (João Pedro) | `1.12.0` | `.harness/tools/dial.js` | ✅ |
| 20 | 🆕 **Aferidor de Confiança — Analisador** | Script / Telemetria | Nativo V-JP Harness (João Pedro) | `1.13.0` | `.harness/tools/aferidor-analise.js` | ✅ |
| 21 | 🆕 **Probe Sombra + Conjunto-Canário** | Script / Probe | Nativo V-JP Harness (João Pedro) | `1.14.0` | `.harness/tools/sombra.js` | ✅ |
| 22 | 🆕 **Portas — Adaptadores por Papel** | Script / Porta | Nativo V-JP Harness (João Pedro) | `1.15.0` | `.harness/tools/ports.js` | ✅ |
| 23 | 🆕 **Mirror de Upstreams** | Script / Mirror | Nativo V-JP Harness (João Pedro) | `1.15.0` | `.harness/tools/mirror.js` | ✅ |

**Opcionais:** instalados sob demanda; o `--doctor` os reporta como `[opt]` sem bloquear (a menos que `--strict`).
**Novidades v1.21.0:** #25 `cbm.js` liga o #11 aos portões (`pr-review` §2, `test-gate` §5, `prepush` camada 5) com orçamento fixo de contexto; pin do #11 0.8.1 → 0.10.8. Spec em `specs/codebase-memory-portoes/`.
**Novidades v1.7.0:** #11 codebase-memory-mcp (npm, pinado), #12 Postgres MCP Pro (substitui o #7 vulnerável; roda via `uvx`/Docker). Detalhes e justificativa em [`../.gbrain/decisions.md`](../.gbrain/decisions.md) e `upgrades/v1.7.0/`.

## Notas de pinagem

- **GSD Redux**: o repo canônico é `open-gsd/get-shit-done-redux` (pacote npm `@opengsd/get-shit-done-redux`).
- **GBrain**: tag mais recente `eval-run-v0.35.1.0-baseline` (→ `0.35.1.0`). Instalado via `/setup-gbrain` (binário bun).
- **MCPs (npm)**: `@playwright/mcp@0.0.75` e `codebase-memory-mcp@0.10.8` são pinados via `package-lock.json` em `.harness/tools`. Playwright é injetado no runtime via `config/mcp.json`; o codebase-memory é chamado pela porta `tools/cbm.js` (modo `cli`, sem servidor) e só vira MCP em escopo local do projeto, nunca global. Nunca `@latest`.
- **Postgres MCP Pro** (`crystaldba/postgres-mcp@0.3.0`): roda fora do npm — `uvx postgres-mcp==0.3.0` (Python 3.12+) ou Docker `crystaldba/postgres-mcp:0.3.0`. Substitui o antigo `server-postgres@0.6.2`, **removido na v1.7.0** por SQL injection e descontinuação upstream.

## Tiers de determinismo

| Tier | Mecanismo de pin | Garantia |
|---|---|---|
| npm (Repomix, GSD, MCPs) | `package-lock.json` + `npm ci` | **Total** — árvore idêntica byte-a-byte |
| git (GBrain, Superpowers) | tag / commit SHA | **Total** se instalar pelo ref pinado |
| pip (Headroom, Postgres MCP Pro) | `==versão` + `headroom --version` | **Alta** — verificada, origem externa |
| skill/spec (Frontend Designer) | ref do `anthropics/skills` | spec vendorizada em `tools/` |

| 25 | 🆕 **Porta do Mapa de Código** | Script / Porta | Nativo V-JP Harness (João Pedro) | `1.21.0` | `.harness/tools/cbm.js` — `impact`/`callers`/`find`, ~300 tokens, chamado por `pr-review`, `test-gate`, `prepush` | ⬜ |
| 22 | 🆕 **Portão de Teste — prova viva** | Skill (bundled) | V-JP (base: pacote `claude-code-quality-skills`) | `1.19.0` | `~/.claude/skills/test-gate/` — escreve `.bsd/prova-viva.json` | ⬜ |
| 23 | 🆕 **Portão de Review — revisor cético** | Skill (bundled) | V-JP (base: pacote `claude-code-quality-skills`) | `1.19.0` | `~/.claude/skills/pr-review/` — lê `.gbrain/lessons.md` antes do diff | ⬜ |

## Atualizando um pin

1. Edite a versão em `registry.json` **e** na origem (`package.json` / tag).
2. `npm install` em `.harness/tools` para regenerar o `package-lock.json`.
3. `--doctor` para confirmar.
4. Registre em `.gbrain/decisions.md` (ADR).
