# Diátaxis Documentation Framework

**Tier:** skill · **Origem:** Framework [diátaxis (divirgat.io)](https://diataxis.fr/) · **Versão:** `1.0.0` · **Destino:** `.harness/tools/diataxis-docs.md` + `docs/` (por projeto)

## Responsabilidade
Estruturar toda a documentação do ecossistema nos **4 quadrantes** do framework Diátaxis, garantindo que cada artefato gerado atenda a uma necessidade clara do usuário: aprender, fazer, consultar ou compreender.

## Os 4 Quadrantes

```
                  ┌───────────────────┬───────────────────┐
                  │  Aprender         │   Fazer           │
    Usuário       │                   │                   │
    (novato       │  TUTORIALS        │  HOW-TO GUIDES    │
    → experto)    │  learning-        │  task-oriented    │
                  │  oriented         │                   │
                  ├───────────────────┼───────────────────┤
                  │  Consultar        │   Compreender     │
                  │                   │                   │
                  │  REFERENCE        │  EXPLANATION      │
                  │  information-     │  understanding-   │
                  │  oriented         │  oriented         │
                  └───────────────────┴───────────────────┘
                      Teórico             Prático
                      (o que é)           (como funciona)
```

| Quadrante | Orientação | Público | O que responde |
|---|---|---|---|
| **Tutorial** | learning-oriented | Iniciantes (primeiro contato) | "Como aprender isso do zero?" |
| **How-to Guide** | task-oriented | Usuários com um problema | "Como resolver um problema específico?" |
| **Reference** | information-oriented | Desenvolvedores / técnicos | "Qual a descrição exata de X?" |
| **Explanation** | understanding-oriented | Qualquer um que queira compreender | "Por que isso é assim? Qual o contexto?" |

## Papel no pipeline VJP Harness

O framework Diátaxis é ativado como skill nos agentes **REVIEWER** (validação) e **EXECUTOR** (geração):

```
 GSD Redux ── Tarefa ──▶ EXECUTOR  ── código + testes + docs ──▶ REVIEWER  ── valida Diátaxis ──▶ merge
                                          ↑                              │
                                          └────── retry com feedback ────┘
```

### 🛡️ REVIEWER — Validação de Documentação
- Verificar se toda **feature nova** tem documentação no quadrante apropriado
- Conferir checklist Diátaxis antes de aprovar merge
- Rejeitar features sem doc ou com doc no quadrante errado (ex.: reference com conteúdo de tutorial)

### 💻 EXECUTOR — Geração de Documentação
- Gerar/atualizar `docs/` junto com código e testes
- Tutorial quando há onboarding/setup novos
- How-to para features orientadas a tarefa
- Reference para API, endpoints, configuração, CLI
- Explanation para ADRs, visão geral, decisões arquiteturais

## Estrutura de diretórios sugerida

```
docs/
├── README.md                   # Índice da documentação
├── 01-tutorials/               # learning-oriented
│   ├── README.md               # template de tutorial
│   ├── getting-started.md
│   └── first-pipeline.md
├── 02-how-to/                  # task-oriented
│   ├── README.md               # template de how-to
│   ├── configure-auth.md
│   └── deploy-with-docker.md
├── 03-reference/               # information-oriented
│   ├── README.md               # template de referência
│   ├── api-endpoints.md
│   ├── configuration.md
│   └── cli-commands.md
└── 04-explanation/             # understanding-oriented
    ├── README.md               # template de explanation
    ├── architecture-overview.md
    └── adr-xxx-decision-log.md
```

> Os templates de cada quadrante estão em `seed/docs/` e servem como ponto de partida para qualquer novo projeto.

## Checklist Diátaxis para o REVIEWER

```
[ ] 1. QUADRANTE CORRETO — A documentação está no quadrante adequado?
     - Tutorial → passo-a-passo, sem pressupor conhecimento prévio
     - How-to → orientado a tarefa, focando em solução, não em conceitos
     - Reference → descrição precisa, exaustiva, formatada (tabelas, schemas)
     - Explanation → contexto, decisões, porquês, discussão aberta

[ ] 2. COMPLETUDE — Cada quadrante cobre o necessário?
     - Tutorial: tem pré-requisitos, passos numerados, resultado esperado?
     - How-to: tem problema claro, solução reproduzível, exemplos?
     - Reference: tem parâmetros, tipos, valores padrão, exemplos de uso?
     - Explanation: tem motivação, alternativas consideradas, referências?

[ ] 3. CONSISTÊNCIA — A doc é fiel ao código implementado?
     - Parâmetros, endpoints, schemas refletem a implementação real
     - Exemplos de código compilam/executam
     - Links e referências cruzadas não estão quebrados

[ ] 4. SEM DUPLICAÇÃO — Cada informação existe em UM quadrante apenas
     - Conceitos introdutórios → vão em Tutorial, não em Reference
     - Detalhes técnicos → vão em Reference, não em How-to
     - Decisões de design → vão em Explanation, não em How-to

[ ] 5. REGRA DE OURO — Nenhuma feature está completa sem documentação
     - Feature sem doc → REJECT (feedback: "adicione doc no quadrante X")
     - Feature com doc no quadrante errado → REJECT (feedback: "mova para tutorials/how-to/reference/explanation")
```

## Quando usar cada quadrante

| Situação | Quadrante | Exemplo |
|---|---|---|
| Onboarding de novo desenvolvedor | Tutorial | "Primeiro pipeline com VJP Harness" |
| Nova feature de autenticação | How-to | "Como configurar autenticação JWT" |
| Nova rota de API | Reference | "POST /api/users — CreateUser" |
| Decisão arquitetural (ADR) | Explanation | "Por que escolhemos NestJS sobre Express" |
| Mudança em configuração | Reference | "Variáveis de ambiente e config.yaml" |
| Bug fix com mudança de comportamento | How-to + Explanation | "Como migrar de X para Y" + "Motivação da migração" |
| Setup de ambiente de desenvolvimento | Tutorial | "Configurando o ambiente local" |

## Templates de cada quadrante

Os templates completos estão em `seed/docs/01-tutorials/README.md`, `seed/docs/02-how-to/README.md`, `seed/docs/03-reference/README.md` e `seed/docs/04-explanation/README.md`.

## Instalação
Skill vendorizada como este documento em `.harness/tools/diataxis-docs.md`. Os templates estão em `seed/docs/`.

## Verificação
```bash
test -f .harness/tools/diataxis-docs.md && echo OK
test -d docs/01-tutorials && echo "docs scaffolded"
```

## Determinismo
Framework conceitual estável (versão `1.0.0`). Templates revisados conforme a evolução do ecossistema.
