# V-JP Harness

Ecossistema de engenharia de software orientado a IA — empacotado para instalação **determinística** em qualquer projeto.

Combina compressão de contexto, memória persistente, planejamento spec-driven, execução autônoma, revisão automática e especialização por agentes — transformando a IA de gerador de código em um sistema que **planeja, pesquisa, implementa, revisa, aprende e evolui**.

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
    MCPs["MCPs (Postgres/Playwright)"] --> Reviewer
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
```

### Componentes (pinados — Registro Definitivo)

| Componente | Repositório oficial | Versão |
|---|---|---|
| BSD | baseado em `garrytan/gstack` | `1.2.0` |
| RTK | `rtk-ai/rtk` | `0.39.0` |
| GBrain | `garrytan/gbrain` | `0.35.1.0` |
| Repomix | `yamadashy/repomix` (npm) | `0.2.14` |
| GSD Redux | `open-gsd/get-shit-done-redux` (npm) | `1.1.0` |
| Superpowers | `obra/superpowers` | `v5.1.0` |
| PostgreSQL MCP | `modelcontextprotocol/servers` | `0.6.2` |
| Playwright MCP | `modelcontextprotocol/servers` | `0.0.75` |
| Frontend Designer | `anthropics/skills` (`frontend-design`) | `main` |

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

## ⚠️ Estado atual

O `bsd.js` implementa o **esqueleto transacional completo** (worktrees, logging
crash-safe, STATE.md, retomada, retry, doctor). As etapas dos 4 agentes
(`PLANNER/RESEARCHER/EXECUTOR/REVIEWER`) ainda são **stubs simulados** — a
integração real com agentes de IA é o próximo passo. O contrato
(`AGENT_RULES.md` + `.gbrain/` + `registry.json`) já está definido.

Versão: ver [`VERSION`](./VERSION).
