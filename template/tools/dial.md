# Dial de Rigor (V-JP)

Escolhe QUANTO rigor de processo aplicar. `nível = clamp(max(piso_da_classe, recomendado), 0, 3)`.
MAIOR = MAIS rigor. O **piso** por classe é o mínimo de segurança e nunca é rebaixado
(ex.: `prod`/`migration` = 3). `recomendado` vem da confiança medida (Aferidor, Fase 3);
sem confiança, usa `conservativeDefault` (3, rigor máximo). Config: `.harness/config/dial.json`.

| Nível | Rigor |
|---|---|
| 0 | Só Portões (modelo faz o loop) |
| 1 | Leve (plano curto + portões) |
| 2 | Pipeline (planner→researcher→executor→reviewer) |
| 3 | Pipeline + Especialistas + NFR upfront |

O `bsd.js` pula estágios upfront abaixo do limiar (`stageMinLevel`), usando o stub DRY.

## Portões de qualidade no Dial (v1.19.0)

`stageMinLevel` ganhou `test-gate: 1` e `pr-review: 2`. Cruzando com os `pisos`, o rigor
escala com o risco em vez de ser lei fixa:

| Classe | Piso | `test-gate` | `pr-review` |
|---|:--:|:--:|:--:|
| `config` | 0 | ❌ | ❌ |
| `frontend` / `backend` | 1 | ✅ | ❌ |
| `db` | 2 | ✅ | ✅ |
| `migration` / `prod` | 3 | ✅ | ✅ |

Na camada interativa (Claude Code), o Dial é o **oráculo**: as skills consultam
`dial.js --class <classe> --json` e obedecem o campo `stages`. Mexer num JSON de config
não dispara review; migration não passa sem os dois.
Uso: `node .harness/tools/dial.js --class <classe> [--recommended <0-3>] [--json]`.
Ver spec: `specs/metodo-duravel-portoes-dial/spec.md` §3.3.

## Orçamento de testes (v1.21.1, anti-loop Codex)

O Dial também declara `testBudget` em `dial.json`. O **contador é mecânico**
(`.bsd/test-budget.json` via `tools/test-budget.js`) — markdown "pare depois de 2"
não basta. Stop-continue **não** zera.

| Knob | Efeito |
|---|---|
| `VJP_CODEX=1` | liga o orçamento; sem `--level`/`--class` usa `codexProfile` (1 run + 1 edit) |
| `VJP_TEST_BUDGET=1` | liga o orçamento mesmo fora do Codex |
| `dial.testBudget.enabledByDefault` | default `false` |
| `dial.testBudget.byLevel` | 0→0/0 · 1→1/1 · 2→2/1 · 3→2/2 (nunca uncapped) |
| `VJP_TASK_ID` / `--task-id` | identidade da tarefa; id novo zera; o mesmo id persiste |

CLI: `node .harness/tools/test-budget.js --status|--consume-run|--consume-edit|--reset [--json]`.
Segundo `--consume-run` no perfil Codex sai código `3` (deny). Prefira corrigir
produção, não o spec. Prova viva permanece obrigatória.
