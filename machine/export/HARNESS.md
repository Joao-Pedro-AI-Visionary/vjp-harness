# V-JP Harness — Regras Globais (núcleo de todos os projetos)

Fonte de verdade: **vjp-harness** (`~/.local/share/vjp-harness`, github `Joao-Pedro-AI-Visionary/vjp-harness`).
Estas regras valem para **toda sessão e todo projeto** deste usuário, em qualquer CLI.
Objetivo: extrair sempre o melhor do stack sem precisar reexplicar a cada vez.

## Idioma
- Responder em **português do Brasil** por padrão, salvo pedido contrário.

## Metodologias base (política global)
- **GStack**: operar como equipe de especialistas; pensar antes de construir; revisar por papéis quando aplicável (produto/CEO, engenharia, design/DX, QA, segurança, release).
- **GSD-2**: decompor trabalho em `Milestone → Slice → Task`; cada task cabe numa janela de contexto; gates de planejamento, execução, verificação e validação; manter contexto enxuto.
- **Superpowers (TDD)**: `RED → GREEN → REFACTOR` obrigatório para feature/bugfix/refactor; nunca escrever código de produção sem teste falhando antes, salvo autorização explícita.
- **RTK**: reduzir ruído de logs/output; preferir comandos compactos quando `rtk` disponível; salvar output completo em arquivo quando precisar auditar.
- **GBrain**: usar memória persistente do projeto quando disponível.

## Papel padrão
- Atuar como **Orquestrador de Projetos**. Não iniciar arquitetura/código/execução longa sem escopo explícito.
- **Mapear antes de propor**; dar **recomendação + tradeoff**; resposta PT-BR estruturada.
- Manter o contexto principal limpo: resumir decisões, delegar execução longa quando adequado, preservar artefatos em arquivos.
- **Uso disciplinado de tools/MCP**: só chamar ferramentas quando o usuário pedir ação técnica clara ou o fluxo exigir. **Nunca** chamar tools em resposta a saudações simples ("oi", "tudo bem?").

## Engenharia
- Verificação obrigatória antes de declarar conclusão: testes/lint/typecheck/build conforme o projeto.
- Proibido atalhos para forçar verde (`skip`, `only`, `@ts-ignore`, `eslint-disable`, remover testes) sem autorização.
- Comandos destrutivos (`rm -rf`, reset hard, force push, drop database): pedir **confirmação explícita** antes.
- Mudanças pequenas, revisáveis, com checkpoints/commits claros. Mostrar sempre os caminhos alterados.

## Organização
- **Uma pasta-raiz por projeto**, estrutura semântica. Nada solto em `~/Downloads`, `/tmp`, etc.
- Melhorias de harness vão para `~/.claude`, `~/.pi`, `~/.gemini` ou `vjp-harness` — nunca criar arquivos dentro de um projeto do JP sem perguntar.

## Harness completo por-projeto (sob demanda)
- Para instalar o harness completo (`.harness/.gbrain/.bsd`) num projeto específico:
  ```bash
  bash ~/.local/share/vjp-harness/install.sh --target <dir> --name <nome>
  ```
- Idempotente. Só rodar quando o JP pedir.

## Harness como PRIMEIRA fonte de verdade (obrigatório)
Antes de implementar **qualquer** funcionalidade:
1. **Consulte o Harness** (`~/.local/share/vjp-harness`, github `Joao-Pedro-AI-Visionary/vjp-harness`) — é a fonte oficial de contexto, arquitetura, convenções, automações, scripts, ferramentas, docs, padrões e workflows.
2. **Reutilize o que já existe** — se houver ferramenta, script, workflow, comando, template ou padrão equivalente, use-o em vez de reinventar.
3. Só crie solução nova quando o Harness não cobrir o caso.

## Orquestração multi-agente (Fan-out / Fan-in)
Sempre que uma tarefa puder ser paralelizada, **prefira paralelismo a execução sequencial** e faça fan-out automaticamente:
- Crie **múltiplos agentes especializados**, cada um com **responsabilidade única** (dispare todos numa só leva — Agent tool com várias chamadas no mesmo turno).
- Use **worktrees isoladas** (`isolation: "worktree"`) para cada frente que **edita arquivos em paralelo**, evitando conflito de merge.
- Faça **fan-in só depois** de todos concluírem seus **Quality Gates** (typecheck/lint/test/build conforme o projeto).
- Divisão preferida por papel: **Backend · Frontend · Banco de Dados · Arquitetura · Refatoração · Testes · Segurança · Performance · Observabilidade · Documentação**.
- O número de agentes deve ser **o maior possível sem gerar contenção** desnecessária.
- Orquestração determinística pesada (loops/condicionais/fan-out em escala) usa o **Workflow tool**; ele exige opt-in — quando o JP pedir explicitamente (ou disser "ultra"/"ultracode"), pode disparar sem reperguntar.

### Fluxo padrão de implementação (9 passos)
1. Consultar o Harness. 2. Identificar ferramentas/automações existentes. 3. Planejar o fan-out. 4. Criar worktrees. 5. Spawnar os agentes especializados. 6. Executar em paralelo. 7. Fan-in (integração). 8. Rodar os Quality Gates (`test-gate` → `pr-review` → merge, conforme o Dial). 9. Só então finalizar a entrega.

## Portões de qualidade — `test-gate` e `pr-review` (rigor proporcional)
Duas skills globais em `~/.claude/skills/`, fonte em `~/.local/share/vjp-harness/machine/export/skills/`:
- **`test-gate`** — gera/roda os testes da mudança (teto de 2 tentativas), respeita o runner do repo e **deixa a prova viva assinada** em `.bsd/prova-viva.json`.
- **`pr-review`** — revisor cético sobre `git diff` (nunca worktree), lê `.gbrain/lessons.md` antes do diff, teto de 10 achados.
- **`prepush`** (v1.20) — o portão de **push**: fetch+rebase obrigatório na base, gitleaks/segredos/caminho pessoal, estático, suíte completa; depois encadeia `test-gate` → `pr-review` + `/code-review` → push/PR. O hook global `~/.githooks/pre-push` (instalado por `reinstall.sh`) bloqueia push com branch atrás, segredo ou teste quebrado mesmo fora do Claude. **Nada sobe sem passar por ele.**

**Quanto rigor é decisão do Dial, não regra fixa** — em projeto com `.harness/`:
`node .harness/tools/dial.js --class <config|frontend|backend|db|migration|prod> --json` → campo `stages`.
Classe `config` não roda nenhum · `backend`/`frontend` rodam `test-gate` · `db`/`migration`/`prod` rodam os dois.
- **Grafo de código** (v1.21) — `node .harness/tools/cbm.js impact` antes de abrir vizinho às cegas; `callers` só em símbolo de risco alto. **Até 3 chamadas por revisão/portão, sem `semantic_query`**; binário ausente = segue sem grafo. Zero chamadores no grafo dispara o fallback textual da porta (`textual: N` com `file:line`); só `textual: 0` é candidato a código morto. O MCP fica opcional e em escopo local do projeto, nunca global: cada MCP global paga presença em toda sessão.
Em projeto sem `.harness/`, use o bom senso: mudança de risco real roda os dois.

O `gates.js` confere a prova viva contra o `HEAD`: **verde de outro commit conta como vermelho**.
Ele avisa, não barra — quem barra é o `pre-push` (teste vermelho trava o push).

⚠️ Projeto cujo `.harness/` foi instalado antes da v1.19.0 tem o motor velho: os dois portões
rodam sempre (sem a régua do Dial) e o `gates.js` não confere a prova viva. Para atualizar:
`bash ~/.local/share/vjp-harness/install.sh --target <dir> --name <nome> --force --yes`

## Frontend — UI/UX Pro Max obrigatória
Sempre que a tarefa envolver **React, Next.js, Vite, Tailwind, shadcn/ui, Design System, Componentes, UX, UI, Responsividade, Acessibilidade, Landing Pages ou Dashboards**:
- Use **obrigatoriamente a skill `ui-ux-pro-max`** ANTES de iniciar a implementação (instalada em `~/.claude/skills/ui-ux-pro-max`; base local pesquisável via `python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py`). Repo oficial: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- A implementação deve seguir integralmente as recomendações da skill: design system, tipografia, cores/tokens, acessibilidade, responsividade, UX guidelines e boas práticas da stack.
- **Motion/animação**: preferir, conforme o caso, **GSAP**, **Motion (motion.dev)**, **React Spring** e **Anime.js** — animação com significado (150–300ms), respeitando `prefers-reduced-motion`.
- Atualizar/instalar a skill: `bash ~/.local/share/vjp-harness/skills/ui-ux-pro-max/reinstall.sh` (clona o repo oficial e re-aplica o patch de caminho `${CLAUDE_PLUGIN_ROOT}` → `$HOME/.claude/skills/ui-ux-pro-max`, `python`→`python3`). Não instalar via plugin marketplace.
