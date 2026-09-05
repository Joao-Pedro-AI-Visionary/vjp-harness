# Spec — Portões de qualidade `test-gate` + `pr-review` (v1.19.0)

> Autoria: **João Pedro (V-JP)** · 2026-08-29
> Origem: pacote `claude-code-quality-skills` (2 skills + CLAUDE.md), integrado ao harness.

## 1. Problema

O harness tem o **papel** de REVISOR (§2) e o **grafo adversarial** (§8), mas nenhuma
checklist concreta de review nem de teste. Pior: o `gates.js` declara três portões
(`prova-viva`, `contrato-bate`, `owasp`) que **nunca saem de `unknown`** — lei escrita
que nada cobra. A §8.4 já diagnostica isso: *"sem ele, os artigos III e §2 são só texto"*.

Somar dois portões sempre-ligados a uma lei que já não é cobrada piora o problema:
regra ignorada em mudança pequena ensina que regra é opcional, e a erosão contamina
as regras que importam (migration, prod).

## 2. Objetivo

1. Adotar as skills `pr-review` e `test-gate` como componentes de 1ª classe do harness.
2. **Fiar um** dos três portões mortos — `prova-viva` — com sinal objetivo e à prova de
   sinal velho.
3. Fazer o rigor **escalar com o risco**, reusando o `dial.js` que já existe (§7:
   "reutilize o que já existe antes de criar"), em vez de criar lei nova.

## 3. Não-objetivos (YAGNI — Art. VII)

- Não fiar `contrato-bate` nem `owasp`. Seguem `unknown` por **decisão consciente**,
  registrada em ADR — não por esquecimento.
- Não alterar `ENFORCED_GATES`. Nenhum projeto instalado pode quebrar no upgrade.
- Não tocar na §8 (grafo adversarial).
- Não instalar as skills por projeto (`install.sh` intocado) — são globais.

## 4. Decisões

### 4.1 Instalação: global, verificada pelo registry
Fonte canônica em `machine/export/skills/{pr-review,test-gate}/SKILL.md`, que o
`bootstrap.sh` passo 6 já copia para `~/.claude/skills/`. O `verify.js` resolve
`verify.type == "skill"` procurando em `~/.claude/skills/` — logo o `--doctor` passa a
acusar ausência **sem máquina de instalação nova**.

### 4.2 Rigor proporcional pelo Dial (não por lei nova)
Duas chaves em `config/dial.json → stageMinLevel`: `test-gate: 1`, `pr-review: 2`.
Cruzando com os `pisos` já calibrados:

| Classe | Piso | test-gate | pr-review |
|---|:--:|:--:|:--:|
| `config` | 0 | ❌ | ❌ |
| `frontend` / `backend` | 1 | ✅ | ❌ |
| `db` | 2 | ✅ | ✅ |
| `migration` / `prod` | 3 | ✅ | ✅ |

`bsd.js:331` (`stageOn`) já lê stage por nome genérico — nenhuma mudança no motor.
Na camada interativa, o `dial.js` é o **oráculo**: o agente consulta
`node .harness/tools/dial.js --class <classe> --json` e obedece o campo `stages`.

### 4.3 Portão `prova-viva` — sinal com carimbo de commit
`test-gate` escreve `.bsd/prova-viva.json`:

```json
{ "feature": "<slug>", "runner": "jest|vitest|playwright|mixed",
  "command": "<comando exato>", "result": "pass|fail",
  "commit": "<sha do HEAD no momento do teste>", "at": "<ISO8601>",
  "specs": ["<path>"], "loops": 1 }
```

`checkProvaViva()` no `gates.js`:

| Situação | Portão | Razão |
|---|---|---|
| arquivo ausente | `unknown` | infra ausente não polui a medição (regra existente) |
| JSON inválido | `unknown` | idem — não é prova de falha |
| `result != "pass"` | `red` | teste vermelho |
| `commit != HEAD` | `red` | **verde de outro commit não prova o código atual** |
| `pass` + commit atual | `green` | prova viva |

**Não entra em `ENFORCED_GATES`**: avisa (vermelho visível no `--doctor`), não barra.
Quem barra hoje é o `hooks/pre-push`, que já bloqueia push com teste falhando.
Para fazer barrar: incluir `'prova-viva'` em `ENFORCED_GATES` (uma linha) — decisão
adiada de propósito, ver §6.

### 4.4 Reconciliação dos conflitos pacote × lei do harness

| Conflito | Decisão |
|---|---|
| skill: 3 loops · §2: 2 tentativas | **2** — a lei vence; é o número consciente do orçamento de 8 GB (§1.6) |
| skill: port (should-fix) · Art. VIII Anti-Abstraction | Port se justifica com **2+ implementações concretas** OU **efeito colateral externo** (Asaas/ClickSign/WhatsApp/mail — a 2ª impl é o fake de teste). Repository Prisma atrás de port com 1 impl e sem fake = violação do Art. VIII → exige ADR |
| skill: "sem Playwright sem UI" · §4.4 E2E obrigatório | E2E obrigatório **quando a mudança tem superfície de UI**; backend-only cumpre a §4.4 com supertest/HTTP. Escopado, não é contradição |
| skill: "port fakes" · §2: Testcontainers + Nock | Em camadas: banco = **Testcontainers** (nunca mock volátil), HTTP externo = **Nock**, port de domínio = **fake in-memory** no unit do use-case |

### 4.5 Enxugamento das skills (contra a inflação de checklist)
- `pr-review` **referencia** a §0.1 OWASP e checa só os itens que o diff encosta —
  não duplica os ~30 itens.
- Teto de achados: **10** por severidade (era 20). Review de 20 itens em diff de 30
  linhas é o que faz review ser ignorado.
- `pr-review` lê `.gbrain/lessons.md` e `.gbrain/decisions.md` antes de revisar.
  É o ganho que uma skill genérica nunca teria: revisor que ignora a memória de erro
  do projeto repete o erro.

## 5. Escopo de arquivos

**Novos**: `machine/export/skills/{pr-review,test-gate}/SKILL.md`, esta spec, `tasks.md`.
**Editados**: `template/tools/gates.js` · `template/tools/tests/gates.test.mjs` ·
`template/config/dial.json` · `template/tools/dial.js` (CLI lista stages do config) ·
`template/tools/{dial,gates}.md` · `template/registry.json` · `template/REGISTRY.md` ·
`template/harness.yaml` · `VERSION` · `template/AGENT_RULES.md` (versão + §2 + §7) ·
`machine/{MACHINE.md,bootstrap.sh}` · `machine/export/HARNESS.md`.
**Intocados**: `install.sh`, os 5 subagentes, a §8.

## 6. Riscos aceitos

1. **`prova-viva` avisa mas não barra.** Sinal verdadeiro, porém não bloqueante.
   Mitigação atual: o `pre-push` já barra teste vermelho. Ligar o barramento é uma
   linha, adiada conscientemente para não quebrar projeto instalado no upgrade.
2. **Qualidade do review continua sendo juízo de LLM.** O que fica mecânico é a
   *existência* e a *frescura* da prova, não o acerto do parecer. Nenhuma skill
   resolve isso e a spec não finge que resolve.
3. **Skills globais podem divergir do `registry.json`** se editadas à mão em
   `~/.claude/skills/`. O `--doctor` detecta ausência, não drift de conteúdo.

## 6.1 v1.21.1 — orçamento mecânico (anti-loop Codex)

O teto de loops do §4.4 ("2") no Claude permanece. No Codex (`VJP_CODEX=1` /
`VJP_TEST_BUDGET=1`) o teto é o contador `.bsd/test-budget.json` (`test-budget.js`):
1 run + 1 edit por default; Dial 3 no máximo 2/2. Stop-continue não reseta.
`test-gate` prefere corrigir produção; `prepush` camadas 6/7 não reabrem a fábrica
de specs se o orçamento esgotou. A prova viva **não** é desligada.

## 7. Prova viva desta própria spec

`(cd template/tools && npm run check)` — os testes novos de `checkProvaViva` verdes +
`verify.js` sem `required` em drift.
