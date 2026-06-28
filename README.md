# V-JP Harness

> **Autor:** João Pedro (V-JP) · [github.com/Joao-Pedro-AI-Visionary](https://github.com/Joao-Pedro-AI-Visionary) · dev.jp.991@gmail.com
> **Versão:** 1.7.3 · Licença MIT · *método de engenharia de software orientado a IA*

Ecossistema de engenharia de software orientado a IA — empacotado para instalação **determinística** em qualquer projeto.

Combina compressão de contexto, memória persistente, planejamento spec-driven, execução autônoma, revisão automática e especialização por agentes — transformando a IA de gerador de código em um sistema que **planeja, pesquisa, implementa, revisa, aprende e evolui**.

> Este harness é o método de engenharia pessoal de **João Pedro (V-JP)**. Use, estude e adapte (MIT) — mantendo o crédito de autoria.

---

## Arquitetura

```mermaid
flowchart TD
    Repo["Repositório"] --> Repomix["Repomix"]
    Repomix --> RTK["RTK"]
    RTK --> GSD["GSD Redux"]
    GBrain["GBrain (Memória)"] --> GSD
    GSD --> BSD["BSD (Orquestrador)"]
    BSD --> Planner["Planner"]
    BSD --> Researcher["Researcher"]
    BSD --> Executor["Executor"]
    Executor --> Reviewer["Reviewer"]
    Reviewer --> GBrain
    Superpowers["Superpowers"] --> Planner
    FrontendDesigner["Frontend Designer"] --> Researcher
    CodebaseMem["Codebase Memory MCP"] --> Researcher
    MCPs["MCPs (Postgres Pro/Playwright)"] --> Reviewer
```

O **GStack** é a camada operacional que conecta RTK, GBrain, GSD Redux e BSD numa arquitetura coesa e reutilizável.

---

## Instalação determinística

```bash
git clone https://github.com/Joao-Pedro-AI-Visionary/vjp-harness.git
cd meu-projeto
bash /caminho/para/vjp-harness/install.sh --name meu-projeto
```

O instalador é **idempotente** e usa `npm ci` (lockfile) para o núcleo. Detalhes completos em [`template/INSTALL.md`](./template/INSTALL.md).

| Flag | Efeito |
|---|---|
| `--target <dir>` | Projeto-alvo (default: diretório atual) |
| `--name <nome>` | Nome do projeto em `harness.yaml` |
| `--no-install` | Copia sem rodar `npm ci` |
| `--force` | Sobrescreve `.harness/` existente |
| `--yes` / `-y` | Não-interativo (CI) |

**Pré-requisitos:** Node ≥ 18; `git` opcional (habilita worktrees isoladas).

---

## Determinismo (o núcleo do projeto)

Toda dependência é **pinada** e **verificável**. A fonte da verdade é
[`template/registry.json`](./template/registry.json) (espelhada em
[`REGISTRY.md`](./template/REGISTRY.md)), consumida pelo verificador:

```bash
node .harness/tools/bsd.js --doctor            # checa cada componente vs versão pinada
node .harness/tools/bsd.js --doctor --strict   # falha também em opcionais ausentes
node .harness/tools/verify.js --json           # saída para CI (exit 1 se obrigatório falhar)
node .harness/tools/bsd.js --vendor            # clona componentes git pinados (assert de commit)
node .harness/tools/bsd.js --vendor --only superpowers   # vendoriza um só
```

### Vendorização determinística

O `install.sh` clona os componentes git **pinados no commit** para dentro de `.harness/tools/`:

| Componente | Repo | Ref | Destino |
|---|---|---|---|
| RTK | `rtk-ai/rtk` | `v0.42.4` @ `8a7dd7e5570d` | `.harness/tools/rtk/` |
| GBrain | `garrytan/gbrain` | `eval-run-v0.35.1.0-baseline` @ `3933eb6a7915` | `.harness/tools/gbrain/` |
| Superpowers | `obra/superpowers` | `v5.1.0` @ `f2cbfbefebbf` | `.harness/tools/superpowers/` |

`vendor.js` faz shallow clone na tag e **asserta o commit** (`startsWith`) — se a tag se mover, reporta DRIFT. Idempotente (pula se já no commit certo). Os clones entram no `.gitignore` do projeto (reproduzíveis pelo ref). Pule com `--no-vendor`.

### Componentes (pinados — Registro Definitivo)

| Componente | Repositório oficial | Versão |
|---|---|---|
| BSD | baseado em `garrytan/gstack` | `1.6.0` |
| RTK | `rtk-ai/rtk` | `0.42.4` |
| GBrain | `garrytan/gbrain` | `0.35.1.0` |
| Repomix | `yamadashy/repomix` (npm) | `0.2.14` |
| GSD Redux | `open-gsd/get-shit-done-redux` (npm) | `1.1.0` |
| Superpowers | `obra/superpowers` | `v5.1.0` |
| ~~PostgreSQL MCP~~ | ~~`modelcontextprotocol/servers`~~ | ❌ removido v1.7.0 |
| Playwright MCP | `modelcontextprotocol/servers` | `0.0.75` |
| Frontend Designer | `anthropics/skills` (`frontend-design`) | `main` |
| 🆕 Codebase Memory MCP | `DeusData/codebase-memory-mcp` (npm) | `0.8.1` |
| 🆕 Postgres MCP Pro | `crystaldba/postgres-mcp` (pip/Docker) | `0.3.0` |

> Núcleo obrigatório (BSD, Repomix, GSD Redux) é totalmente determinístico via
> `package-lock.json`. Opcionais são reportados pelo doctor sem bloquear.
> Matriz completa + notas de pinagem em [`template/REGISTRY.md`](./template/REGISTRY.md).

---

## Estrutura instalada no projeto

```
meu-projeto/
├── .harness/                 # MOTOR (versionável)
│   ├── harness.yaml              # manifesto: agentes, MCPs, tools pinadas
│   ├── registry.json             # ← fonte da verdade determinística
│   ├── REGISTRY.md  INSTALL.md   # matriz de instalação + guia
│   ├── AGENT_RULES.md            # regras dos 4 agentes
│   ├── tools/
│   │   ├── bsd.js                # orquestrador (--execute/--continue/--status/--reset/--doctor)
│   │   ├── verify.js             # verificador de determinismo
│   │   ├── package.json + lock   # tools pinadas (npm ci)
│   │   └── *.md                  # doc de cada componente
│   ├── config/{repomix,mcp}.json
│   └── context/                  # contexto compactado (regenerável)
├── .gbrain/                  # MEMÓRIA persistente (8 arquivos + PGLite)
└── .bsd/                     # ESTADO de execução (STATE.md, history.jsonl, worktrees/)
```

---

## Pipeline por task (BSD)

```
PLANNER → RESEARCHER → EXECUTOR → REVIEWER → APPROVED?
  └ Sim → próxima task        └ Não → retry em worktree (máx. 2) → aborta + STATE.md
```

```bash
node .harness/tools/bsd.js --execute <feature>
node .harness/tools/bsd.js --continue
node .harness/tools/bsd.js --status
node .harness/tools/bsd.js --reset
```

---

## Princípios

1. Contexto mínimo, informação máxima. 2. Planejar antes de implementar.
3. Pesquisar antes de modificar. 4. Revisar antes de aprovar.
5. Registrar decisões. 6. Aprender com erros. 7. Automatizar o repetitivo.
8. Agentes especializados. 9. Preservar histórico. 10. Evoluir o conhecimento.

---

## Agentes de IA (integração real)

Os 4 agentes rodam de verdade (`tools/agents.js` + `tools/llm.js`), **provider-agnostic**:
use **qualquer** provider — OpenAI, DeepSeek, Kimi, GLM, MiniMax, Groq, OpenRouter,
Together (todos via adapter `openai`), Anthropic ou Ollama local. Presets prontos +
override por ENV, sem fixar nada globalmente.

```bash
# 1. escolha o provider via ENV (sem editar arquivo) — troque quando quiser
export VJP_LLM_PRESET=deepseek            # ou kimi, glm, openrouter, ollama, cliproxy...
export VJP_LLM_MODEL=deepseek-chat
export VJP_LLM_API_KEY=sk-...             # ollama não precisa

# 2. valide a conectividade
node .harness/tools/bsd.js --check-llm

# 3. rode uma feature (EXECUTOR escreve+commita na worktree; merge se os testes passarem)
node .harness/tools/bsd.js --execute minha-feature

# (mecânica sem LLM, para testar o fluxo)
node .harness/tools/bsd.js --execute minha-feature --dry-run
```

> Fixar um modelo é **opcional** (só pra reproduzir um projeto) — não há provider
> default obrigatório. Presets em [`template/config/agents.json`](./template/config/agents.json).

Cada agente recebe `AGENT_RULES.md` + `.gbrain/*.md` como contexto e devolve JSON
estruturado. O EXECUTOR não recebe shell — só conteúdo de arquivos, aplicados na
git worktree isolada com proteção contra path traversal; o merge só acontece após
os testes verdes (`pipeline.testCommand`). Detalhes em [`template/tools/agents.md`](./template/tools/agents.md).

---

## Novidades — v1.7.0 (por João Pedro / V-JP)

Avaliação criteriosa de 3 achados de uma varredura (jun/2026) + 1 manutenção. Critério: **rejeição justificada > adoção apressada**. Spec/tasks e racional completo em [`upgrades/v1.7.0/`](./upgrades/v1.7.0/); decisões em [`.gbrain/decisions.md`](./.gbrain/decisions.md).

**Entrou:**
- 🆕 **Codebase Memory MCP** (`DeusData/codebase-memory-mcp@0.8.1`) — reforça o Researcher com grafo de símbolos (diff→impacto, dead code, call graph). Cobre TS e C#. **Complementa** Repomix+RTK.
- 🆕 **Postgres MCP Pro** (`crystaldba/postgres-mcp@0.3.0`) — substitui o `server-postgres` (SQLi, arquivado). EXPLAIN com cost model + índice hipotético (HypoPG); modo restricted seguro p/ produção. Gate barato complementar: `prisma migrate diff/validate`.
- 🆕 **Captura nativa de decisão** (`tools/gbrain-decision.js` + Stop hook opt-in) — append idempotente em `.gbrain/decisions.md`. Resolve a dor do GBrain manual **sem** dependência externa.
- 🛡️ **Gate de merge por sinal concreto** no BSD (padrão Janitor/Bernstein): teste verde manda; aprovação do LLM não sobrepõe teste falho.

**Ficou de fora (rejeição justificada):**
- ❌ **agentmemory** — instável, token-burn reaberto, MCP não-determinístico que fere a tese do harness e não alcança o BSD headless. Dor resolvida nativamente.
- ❌ **Substituir Repomix+RTK** / **refatorar o scheduling do BSD** (já é determinístico) / **FSM+audit estilo Bernstein** — fora do escopo "enxuto".

**Patches:**
- **v1.7.1** — pin do RTK `0.42.3 → 0.42.4` (alinha com o binário global; elimina drift do doctor).
- **v1.7.2** — Postgres MCP Pro (crystaldba) **validado ao vivo** (EXPLAIN cost model + índice hipotético HypoPG via Docker contra Postgres efêmero): `Seq Scan 2281 → Index Scan 241`; recomendação de índice `2281 → 8.1` (283x). Regra 7 provada de ponta a ponta.
- **v1.7.3** — corrige o `verify` do Postgres MCP Pro (`postgres-mcp` não tem `--version`; usa `--help` + token `access-mode`). Com `uv` instalado, doctor fica **11/11**.

---

Versão: ver [`VERSION`](./VERSION).
