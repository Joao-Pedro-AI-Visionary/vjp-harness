# V-JP Harness

Ecossistema de engenharia orientado a IA — empacotado para uso em qualquer projeto.

Orquestra um pipeline determinístico, isolado e *crash-safe* sobre 4 agentes
(**PLANNER → RESEARCHER → EXECUTOR → REVIEWER**), com memória persistente
(`.gbrain/`) e estado auditável (`.bsd/`).

---

## Instalação num projeto

Clone este repositório uma vez e rode o instalador apontando para o projeto-alvo:

```bash
git clone <url-deste-repo> vjp-harness
cd meu-projeto
bash /caminho/para/vjp-harness/install.sh
```

Ou instalando num diretório específico:

```bash
bash /caminho/para/vjp-harness/install.sh --target ~/projetos/api --name api
```

O instalador é **idempotente**: roda quantas vezes quiser. Ele preserva
`.gbrain/` e `.bsd/` existentes e só sobrescreve o motor com `--force`.

### Opções do `install.sh`

| Flag | Efeito |
|---|---|
| `--target <dir>` | Projeto-alvo (default: diretório atual) |
| `--name <nome>` | Nome do projeto em `harness.yaml` (default: basename do alvo) |
| `--no-install` | Copia os arquivos sem rodar `npm install` |
| `--force` | Sobrescreve um `.harness/` existente |
| `--yes` / `-y` | Modo não-interativo (CI) |
| `--help` | Ajuda |

**Pré-requisitos:** Node ≥ 18 e (opcional) `git` para worktrees isoladas.
Sem git, o orquestrador cai num modo de diretório isolado (fallback).

---

## O que é instalado no projeto

```
meu-projeto/
├── .harness/            # MOTOR (versionável)
│   ├── harness.yaml         # manifesto: agentes, MCPs, tools pinadas, pipeline
│   ├── AGENT_RULES.md       # regras de sistema dos 4 agentes
│   ├── tools/
│   │   ├── bsd.js           # orquestrador CLI (Build Spec Development)
│   │   └── package.json     # repomix + gsd (versões travadas)
│   └── config/repomix.config.json
├── .gbrain/             # MEMÓRIA persistente dos agentes (preencher!)
│   ├── project.md  architecture.md  patterns.md
│   ├── decisions.md  lessons.md  bugs.md  commands.md
│   └── config.json
└── .bsd/                # ESTADO de execução (gerado em runtime)
    ├── STATE.md  history.jsonl  worktrees/
```

`node_modules`, `context/` e o estado de runtime entram automaticamente no
`.gitignore` do projeto. Versione `.harness/` (motor) e `.gbrain/*.md` (memória).

---

## Comandos (CLI BSD)

```bash
node .harness/tools/bsd.js --execute <feature>   # inicia o pipeline transacional
node .harness/tools/bsd.js --continue            # retoma o último pipeline
node .harness/tools/bsd.js --status              # painel de progresso + histórico
node .harness/tools/bsd.js --reset               # limpa worktrees e histórico
```

---

## Primeiros passos após instalar

1. Edite `.gbrain/project.md` e `.gbrain/architecture.md` com o contexto real do projeto — os agentes consultam isso antes de propor qualquer design.
2. Ajuste a stack homologada em `AGENT_RULES.md` se não for NestJS/Prisma.
3. Rode `node .harness/tools/bsd.js --status`.

---

## ⚠️ Estado atual

O orquestrador `bsd.js` implementa o **esqueleto transacional completo**
(worktrees, logging crash-safe, STATE.md, retomada, retry), mas as etapas dos
agentes (`PLANNER/RESEARCHER/EXECUTOR/REVIEWER`) ainda são **stubs simulados**
(`setTimeout`). A integração real com agentes de IA é o próximo passo —
o contrato (`AGENT_RULES.md` + `.gbrain/`) já está definido para isso.

## Versão

Ver [`VERSION`](./VERSION).
