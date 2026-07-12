# Spec — Método Durável: Portões, Dial de Rigor e Aferidor de Confiança

> **Data:** 2026-07-11 · **Autor:** João Pedro (V-JP) · **Status:** Design (aguardando revisão)
> **Slug:** `metodo-duravel-portoes-dial` · **Branch:** `feat/metodo-duravel-portoes-dial`
> **Estende:** `template/AGENT_RULES.md` §0 (Constituição de 9 Artigos)

---

## 1. Contexto e Problema

O V-JP Harness é hoje uma **junção de ~10 ferramentas de terceiros** (Repomix, RTK, GBrain, GSD, Superpowers, Frontend Designer, Postgres MCP Pro, Playwright, Codebase Memory, BSD/gstack) orquestradas por um método próprio. Ele já tem três camadas de durabilidade: **versões pinadas** (`registry.json`), **vendorização com assert de commit** (`vendor.js`) e **nomeação por papel** (Maestro=BSD, Compressor=RTK…).

Restam **quatro riscos** não cobertos, e **uma tensão** nova:

| # | Risco | Cobertura hoje |
|---|---|---|
| A | Ferramenta **muda comportamento/interface** ao atualizar | Parcial (pin protege enquanto não atualiza; sem teste que trave comportamento) |
| B | Ferramenta **some** (repo apagado, pacote despublicado) | Parcial (clone vai pro `.gitignore`; depende do ref ainda existir upstream) |
| C | **Resultados acumulados** (memória, ADRs, specs) presos no formato da ferramenta | ❌ Não coberto — risco real de lock-in |
| D | **Método** só existe "colado" às ferramentas (sem contrato que permita troca) | Parcial (nomeação por papel ajuda; falta o contrato) |

**Tensão nova (evolução das LLMs):** os modelos melhoram continuamente e já executam loops multi-passo sozinhos. A **rigor** atual (forçar o modelo pelo pipeline de 4 agentes, decompor em micro-passos) dá **previsibilidade**, mas cobra um **imposto de tokens** que cresce à medida que o modelo fica capaz de fazer o loop sem tutela. O usuário precisa de um meio-termo **medido**, não chutado: nem cauteloso demais (queima tokens), nem frouxo demais (perde previsibilidade).

## 2. Princípio Central

> **Trave o RESULTADO (portão), não o CAMINHO (rigor). Ao longo do tempo, migre orçamento de rigor → portão, e só afrouxe o rigor quando o modelo *provar* melhora contra a sua própria régua.**

### 2.1. A assimetria que fundamenta o princípio

- **Rigor** (impor os passos): custo vira **desperdício** conforme os modelos melhoram — paga-se para obrigar um modelo capaz a dar passinhos que ele daria sozinho. *Piora com o tempo.*
- **Portão** (checar o resultado): valor **cresce** conforme se solta o modelo — quanto mais livre, mais se precisa de checagem dura, barata e determinística de que a régua foi batida. *Melhora com o tempo.*

Logo, a estratégia não é um número fixo, é uma **direção**: investir no portão, afinar o rigor.

### 2.2. Como o princípio mata os 4 riscos + a tensão

É o **mesmo** princípio para tudo. Se o que é do V-JP é o **contrato** (Constituição + Portões) e tudo abaixo é implementação descartável:

- **Risco A/B** → troca-se a implementação atrás do portão; o portão não muda.
- **Risco C** → o portão **exige** a saída em formato aberto e próprio (`spec.md`, `decisions.md`, log de prova viva); o dado nasce do V-JP, não da ferramenta.
- **Risco D** → o método vira contrato explícito (invariantes verificáveis), não uma sequência amarrada à marca da peça.
- **Tensão LLM** → afina-se só o rigor (dial); a previsibilidade mora no portão, que permanece.

## 3. Arquitetura — Componentes

```
                 classifica risco (trigger: prod/migration/.tsx/...)
Tarefa ───────────────────────┐
                              ▼
                     ┌──────────────────┐   consulta   ┌───────────────────────┐
                     │   DIAL DE NÍVEL   │◄────────────►│  AFERIDOR DE CONFIANÇA │
                     │  (0..3 rigor)│  confiança   │ (history.jsonl + probe)│
                     └────────┬─────────┘  por classe   └───────────▲───────────┘
                              ▼                                      │ grava run
             executa no nível escolhido (rigor)               │
             [Maestro/BSD · adaptadores das ferramentas]            │
                              ▼                                      │
                     ┌──────────────────┐                           │
                     │      PORTÕES      │── passou/falhou ─────────┘
                     │ (garantia+sensor) │
                     └────────┬─────────┘
                              ▼
             saída em formato aberto (spec.md, decisions.md, prova-viva.log)
```

### 3.1. Constituição (invariantes) — o IP durável

Os invariantes que definem "pronto" **independente de ferramenta e de modelo**. Já existem 9 artigos em `AGENT_RULES.md §0`; esta spec **não os reescreve** — ela os classifica em duas naturezas para tornar o dial possível:

- **Invariantes de RESULTADO** (viram Portão; nunca afrouxam): código nasce de spec (Art. materializado em `spec.md`); prova viva antes de "pronto" (Art. III/IV); contrato-primeiro back↔front↔DB (Art. IV); decisão registrada com alternativa+porquê (ADR em `.gbrain/decisions.md`); segurança OWASP (Art. IX); saída em formato aberto e próprio (novo — cobre Risco C).
- **Invariantes de CAMINHO** (viram Rigor; afrouxáveis pelo dial): pipeline de 4 agentes, decomposição em micro-passos, especialistas por camada, número de retries.

> **Regra de ouro:** um invariante só entra na Rigor (afrouxável) se sua ausência puder ser **detectada pelo Portão**. Se não dá pra detectar no resultado, ele **tem** que ser invariante de resultado.

### 3.2. Portões (gates) — garantia + sensor

Checagens **determinísticas** que rodam ao fim de toda tarefa. Papel duplo: (1) garantem o resultado; (2) emitem o dado que alimenta o Aferidor. Mapeamento com o que já existe:

| Portão | Verifica | Implementação (existente / nova) |
|---|---|---|
| `spec-presente` | tarefa tem `spec.md`/`tasks.md` | hook SDD (PreToolUse) + `bsd.js` (já lê spec desde v1.10.3) |
| `determinismo` | componentes batem versão pinada | `bsd.js --doctor` / `verify.js` (existe) |
| `prova-viva` | fluxo real executado e verde (E2E front→API→DB) | `integration-verifier` + Playwright + Postgres MCP (existe; consolidar em 1 gate com log) |
| `adr-presente` | decisão arquitetural tem ADR c/ alternativa+porquê | novo — checar `.gbrain/decisions.md` tocado quando há decisão de design |
| `contrato-bate` | DTO/schema/response coerentes back↔front↔DB | Art. IV (existe parcial; formalizar como gate) |
| `owasp` | checklist mínimo preenchido | `AGENT_RULES §0.1` + `npm audit` (existe) |
| `saida-aberta` | artefatos em formato aberto e próprio existem no repo | **novo** — cobre Risco C |

Cada execução de portão **emite um registro** (ver §3.4). Gate é barato e não depende do modelo — por isso serve de sensor.

### 3.3. Dial de Nível — quanto rigor

Nível = quantidade de rigor imposta. Escolhido por **`risco da tarefa × confiança medida`** (não por sensação). Os **Portões rodam em TODO nível** — o que muda é só o rigor.

| Nível | Rigor | Quando |
|---|---|---|
| **0 — Só Portões** | Modelo faz o loop sozinho; harness só aplica os portões no fim | Baixo risco **e** confiança alta medida na classe |
| **1 — Leve** | Plano curto + portões | Risco médio, ou confiança ainda em formação |
| **2 — Pipeline** | Planner→Researcher→Executor→Reviewer + portões | Risco alto, ou confiança baixa na classe |
| **3 — Pipeline + Especialistas** | Nível 2 + especialistas por camada + NFR upfront | Risco crítico (prod, migração, pagamento) — **piso fixo, ignora confiança** |

**Piso por risco:** tarefas críticas (`prod`, `migration`, pagamento, deleção em massa) têm **nível mínimo travado** independente de quão bom o modelo pareça. Confiança **nunca** rebaixa abaixo do piso da classe.

### 3.4. Aferidor de Confiança — como saber que o modelo melhorou

> **Não se pergunta se o modelo melhorou; mede-se — e o instrumento é o próprio Portão.** A melhora cai de graça do exhaust dos gates que já rodam.

**Fonte:** estende `.bsd/history.jsonl` (já existe). Cada run grava:

```jsonc
{
  "ts": "2026-07-11T14:00:00Z",
  "model_id": "claude-opus-4-8",      // statusline-context.js já sabe
  "task_class": "frontend",            // do trigger (prod|migration|frontend|backend|db|config)
  "level": 0,                          // nível de rigor usado
  "shadow_level": 1,                   // nível do probe sombra rodado em paralelo (ou null)
  "first_try_pass": true,              // passou TODOS os portões sem retry?
  "shadow_first_try_pass": true,       // idem para o probe sombra
  "retries": 0,
  "human_intervened": false,
  "gates": { "prova-viva": "green", "contrato-bate": "green", ... },
  "tokens": 18342
}
```

**Regra de promoção/demoção (por `task_class`, janela móvel de N=20 runs):**

1. Toda classe começa **conservadora** (nível alto).
2. Em paralelo ao nível seguro, roda-se um **probe sombra** um degrau mais frouxo — sobre um **conjunto-canário fixo** (tarefas douradas, determinístico, sem risco) ou comparando saída-sombra vs. resultado real.
3. **Promove** (afrouxa 1 nível) se, na janela: `shadow_first_try_pass ≥ 90%` **E** `human_intervened == 0`.
4. **Demove** (aperta 1 nível), automático, se no nível atual `first_try_pass < 80%` na janela — pega regressão, troca silenciosa de pesos do fornecedor, ou leva de tarefas mais difícil. **Honesto nas duas direções.**
5. **`model_id` novo = gatilho, não prova.** Ao detectar novo `model_id`: mantém o nível seguro atual, **zera** a confiança daquele modelo e **inicia probe sombra imediatamente**, para o modelo *ganhar* promoção rápido se merecer. Nunca afrouxa por release/blog do fornecedor.
6. **Cold start / dados insuficientes** (< N runs na classe): permanece conservador; sem promoção sem evidência.

Batismo por-papel: **"Aferidor de Confiança"** (procedência: `history.jsonl` + os Portões).

### 3.5. Adaptadores (ports) — só onde pagam a pena

Cada ferramenta de terceiro fica atrás de uma **interface fina por papel** (`Memory`, `Planner`, `Verifier`, `ContextCompressor`…) **apenas quando há necessidade real e presente de troca** (que existe: o objetivo é sobreviver à troca de ferramenta/modelo). Uma implementação-referência **própria e mínima** (formato aberto) serve de fallback quando a ferramenta some.

> **Reconciliação com a Constituição (Art. VIII Anti-Abstraction, Art. VII YAGNI):** o Art. VIII proíbe wrapper "pra caso troque" sem 2+ implementações concretas. Aqui a troca **é** o requisito de hoje (durabilidade contra sumiço/mudança), e há 2+ implementações concretas por papel (a ferramenta + o fallback próprio). Portanto **justificado via ADR**, não violação. Adaptador que não tiver fallback próprio real **não** é criado (YAGNI).

### 3.6. Portabilidade de resultados — cobre Risco B e C

- **Formato aberto por padrão:** todo resultado nasce em `spec.md`, `tasks.md`, `.gbrain/decisions.md`, `prova-viva.log` — markdown/JSON que o V-JP controla e lê sem a ferramenta.
- **Espelho de código (Risco B):** além do vendoring atual (clone no `.gitignore`), manter **mirror próprio** dos repos pinados (fork ou tarball versionado) para o caso de o upstream sumir. Registrado no `registry.json`.

## 4. Fluxo de Dados (uma tarefa)

1. **Classifica risco** — trigger por caminho/extensão (`prod`, `migration`, `.tsx`, `.repository.ts`…) → `task_class`.
2. **Escolhe nível** — Dial consulta o Aferidor: `nível = max(piso_da_classe, nível_recomendado_pela_confiança)`.
3. **Executa** — rigor do nível escolhido, ferramentas atrás dos adaptadores; probe sombra roda em paralelo se aplicável.
4. **Portões** — todos rodam; garantem o resultado e emitem registro.
5. **Grava** — append em `history.jsonl` (§3.4).
6. **Aferidor atualiza** — recalcula janela; promove/demove a classe se cruzar limiar.

## 5. Tratamento de Erro / Edge Cases

- **Infra do portão falha** (ex.: Postgres MCP fora): portão retorna `unknown` ≠ `green`; tarefa **não** é marcada pronta; não conta como pass no Aferidor (não polui a medição).
- **Modelo regride:** demoção automática (§3.4.4).
- **Fornecedor troca pesos sem trocar `model_id`:** demoção pega pela queda de `first_try_pass` (§3.4.4) mesmo sem gatilho de identidade.
- **Poucos dados:** conservador (§3.4.6).
- **Conjunto-canário desatualizado:** canário versionado no repo; parte da spec-driven (muda via spec).

## 6. Fora de Escopo (YAGNI)

- Dashboard/UI de telemetria — `history.jsonl` + um comando CLI de leitura bastam.
- Adaptador para ferramenta sem fallback próprio.
- Auto-upgrade de versões pinadas — pin continua manual e deliberado.
- Multi-máquina/sincronização de confiança entre repos — confiança é por-repo por ora.

## 7. Critérios de Sucesso (prova viva do próprio harness)

1. Trocar uma ferramenta atrás de um adaptador **sem** alterar os Portões nem quebrar tarefas verdes.
2. Deletar/mover um upstream pinado e o harness continuar instalável pelo mirror.
3. Ler 100% dos resultados acumulados (specs, ADRs, memória) **sem** a ferramenta que os gerou.
4. Em classe de baixo risco, o Aferidor **promover** para nível 0 após janela verde — e **demover** ao injetar falhas — automaticamente.
5. Tarefa crítica (`prod`/`migration`) **nunca** rodar abaixo do piso, mesmo com confiança máxima.

## 8. Decisões (ADR — alternativa + porquê)

- **D1: Portão como sensor (vs. benchmark separado).** Alternativa: suíte de benchmark isolada para medir o modelo. Escolhido reusar os Portões porque o dado cai de graça, é específico da classe real de tarefa, e não adiciona superfície. *Trade-off:* medição enviesada pelo mix de tarefas reais — mitigado pelo conjunto-canário fixo.
- **D2: Confiança por `task_class` (vs. global).** Modelo melhora de forma desigual (craque em frontend, perigoso em migração). Global promoveria cedo demais em classe fraca. *Trade-off:* mais dados por classe → cold start mais longo — aceito.
- **D3: `model_id` novo = gatilho, não prova.** Evita afrouxar por marketing de release. *Trade-off:* atraso até acumular janela — aceito, priorizando previsibilidade.
- **D4: Adaptadores só com fallback real.** Reconcilia durabilidade com Art. VII/VIII. Sem fallback = sem adaptador.
- **D5: Piso de risco trava o dial.** Confiança nunca rebaixa abaixo do piso em classe crítica. Segurança > economia de tokens em prod.

## 9. Implementação (faseável — MVP primeiro)

Sugestão de fatiamento (o plano detalhado sai no writing-plans):

- **Fase 1 (MVP):** consolidar os Portões existentes em uma "definição de pronto" única + gate `saida-aberta`; logar os campos novos em `history.jsonl`. *Entrega valor sem nada novo de risco.*
- **Fase 2:** Dial de Nível + pisos por classe (config + seleção em `bsd.js`).
- **Fase 3:** Aferidor — analisador de janela + regra de promoção/demoção (leitura de `history.jsonl`).
- **Fase 4:** Probe sombra + conjunto-canário.
- **Fase 5:** Adaptadores com fallback + mirror de upstream (Risco A/B).
