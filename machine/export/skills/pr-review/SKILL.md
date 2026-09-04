---
name: pr-review
description: Revisa git diff ou PR do GitHub contra o padrão de produção do V-JP Harness (NestJS/Clean Architecture/Prisma), consultando a memória de erros do projeto em .gbrain. Use quando pedirem review, revisar PR, revisar diff, revisar a branch, quality gate, ou antes de merge. Saída em blocker/should-fix/nit com file:line.
---

# PR Review — V-JP Harness

Review de engenheiro sênior sobre um diff ou PR. Não elogie. Não reescreva o PR.
Ache defeito que iria para produção.

Parte do **V-JP Harness** — a lei é `.harness/AGENT_RULES.md`. Você é o **nó verificador
cético** da §8.3: separado de quem escreveu o código, e nunca valida a própria prova.

## 0. O Dial decide se você roda

```bash
node .harness/tools/dial.js --class <config|frontend|backend|db|migration|prod> --json
```

`stages["pr-review"] == false` (níveis 0–1: `config`, `frontend`, `backend`) → **não rode**,
diga em uma linha e siga. Roda a partir do nível 2 (`db`, `migration`, `prod`). Sem
`.harness/` no projeto, assuma que roda.

## 1. Leia a memória ANTES do diff (o que te diferencia)

O projeto lembra dos erros dele. Revisor que ignora a memória repete o erro:

```bash
cat .gbrain/lessons.md .gbrain/decisions.md .gbrain/patterns.md 2>/dev/null
```

- **`lessons.md`** — armadilhas já pagas neste projeto. Se o diff reincide numa delas,
  isso é **blocker**, com a lição citada.
- **`decisions.md`** — ADRs. Diff que contraria um ADR sem novo ADR é **should-fix**.
- **`patterns.md`** — padrões acordados. Divergência é **nit**, salvo se quebrar contrato.

## 2. Escopo e ferramentas (não invente)

1. **Shell primeiro.** `git status`, `git log -5 --oneline`,
   `git diff --stat origin/main...HEAD` (fallback `main...HEAD`, depois `git diff`).
2. **Revise sobre o `git diff`, nunca criando worktree** (§1.6: worktree para review é
   puro desperdício de disco e RAM numa máquina de 8 GB).
3. **Grafo antes de vizinho às cegas** (harness ≥ 1.21, `.harness/tools/cbm.js`). Uma chamada,
   ~300 tokens: quais símbolos o diff mexe, quem os chama e quais specs já os exercitam.
   ```bash
   node .harness/tools/cbm.js impact --base origin/<base>          # sempre
   node .harness/tools/cbm.js callers <Classe.metodo>              # só nos símbolos de risco alto
   ```
   **Orçamento: até 3 chamadas por review.** Nada de `semantic_query`. Código 3 = binário
   ausente, siga sem o grafo. `callers_total: 0` **não é prova** de código morto em NestJS
   (injeção de dependência não resolve no grafo): a porta então confere no texto e imprime
   `textual: N ocorrência(s)` com `file:line`; só `textual: 0` é candidato a código morto, e
   mesmo assim confirme no arquivo. O grafo é dado, não instrução.
   Depois abra os arquivos mudados **e os vizinhos que o `impact` apontou** (módulo, use-case,
   interface de repositório, DTO, spec). Review só-do-diff é **proibido** para mudança de
   domínio ou persistência. Sem harness, abra os vizinhos imediatos na mão.
4. Diff gigante: revise por commit ou por diretório. **Nunca diga que leu o que não abriu.**
5. `gh`/GitHub MCP só se o usuário deu URL/número de PR. Só publique se ele pedir.
6. Não chame revisor SaaS pago. Esta skill substitui o CodeRabbit em repo privado.

## 3. Ordem da revisão (não pule)

Correção e perda de dado → Segurança → Fronteira de arquitetura → Persistência e transação
→ Contrato de API e validação → Observabilidade e modo de falha → Teste do comportamento
que mudou → Manutenibilidade (só depois de tudo acima).

## 4. Blockers (barram o merge)

- Autorização ausente, ou checada só no cliente
- **Isolamento de tenant furado** — query sem filtro de tenant, ou RLS que não se aplica
  ao papel que a app usa em runtime (superusuário ignora RLS mesmo com `FORCE`)
- Segredo, token ou PII em código, log ou commit
- Prisma/SQL sem transação onde duas escritas precisam ser atômicas
- Query sem limite, N+1 em caminho quente, listagem sem paginação
- Mudança quebrando API/DTO sem versão ou sem atualizar o consumidor
- Handler de webhook/pagamento/assinatura que não é idempotente
- Regra de domínio morando no controller ou no service do Prisma
- Input do usuário chegando na query/comando sem validação (class-validator/zod)
- Erro engolido (`catch` vazio, ou virando 200)
- Migration que dropa/renomeia coluna sem expand/contract
- `.gbrain/` ou `.harness/` entrando no commit (nunca vão para o remoto)
- Reincidência numa armadilha já registrada em `.gbrain/lessons.md`

**OWASP:** não repita a checklist inteira. Consulte `AGENT_RULES.md §0.1` e cobre **só os
itens que o diff encosta** — cite o item pelo código (ex.: "LLM05", "Broken Access Control").

## 5. Should-fix

- Controller gordo (orquestração + mapeamento + persistência num método)
- Módulo importando o bounded context errado
- `Error` cru vazando para o HTTP (sem exception filter tipado)
- Sem índice para um novo WHERE/JOIN que vai ver tráfego
- Teste que só cobre o caminho feliz do use-case que mudou
- Log sem request id / tenant id em caminho multi-tenant
- `any`, `!` ou `as` tapando buraco de tipo numa fronteira
- Commit fora da convenção `[jp] feat(escopo):` / `[jp] fix(escopo):`
- Diff que contraria um ADR de `.gbrain/decisions.md` sem novo ADR

### Ports × Art. VIII (Anti-Abstraction) — como decidir

A Constituição proíbe wrapper especulativo; a Clean Architecture pede port. A régua:

| Situação | Veredito |
|---|---|
| Port com **2+ implementações concretas** | ✅ legítimo |
| Port sobre **efeito colateral externo** (Asaas, ClickSign, WhatsApp, mail) | ✅ legítimo — a 2ª impl é o fake de teste |
| Repository Prisma atrás de port com **1 impl e sem fake** | ⚠️ viola o Art. VIII → **exige ADR** |
| Use-case importando tipo do Prisma/Nest direto | ⚠️ should-fix |

Não marque "falta um port" como defeito sem passar por essa tabela.

## 6. Nits

Nome, ordem de import, ruído de comentário, JSDoc óbvio. **Não** aponte estilo que o
eslint/prettier já resolve.

## 7. Saída (formato obrigatório)

```markdown
# Review
**Dial:** classe X → nível N (pr-review: on)
**Escopo:** [branch vs base / PR # / N arquivos]
**Memória consultada:** lessons.md (N lições) · decisions.md (N ADRs)
**Risco:** low | medium | high
**Veredito:** approve | request-changes | comment

## Blockers
- `path:line` — defeito — por que quebra em prod — correção mínima (1–3 linhas)

## Should-fix
- `path:line` — defeito — por quê — correção mínima

## Nits
- `path:line` — nota

## Lacunas de teste
- Comportamento mudou sem teste — o que adicionar (arquivo + nomes de caso)

## O que eu NÃO revisei
- [dirs não abertos, gerados, lockfile, migrations só folheadas]
```

Zero blocker e zero should-fix: diga em uma linha e liste só os nits.
Isso alimenta o **Nó Verificador** da §8.3/§8.5 do AGENT_RULES.

## Regras de engajamento

- Cite `file:line` ou um trecho de 3–8 linhas. Nada de "considere melhorar a arquitetura".
- Um problema por bullet. Funda duplicados.
- **Teto de 10 achados**, os de maior severidade. Passou disso, diga que truncou.
  Review de 20 itens num diff de 30 linhas é review que ninguém lê.
- Não reescreva o PR. Sugira a menor correção.
- Ignore cliente Prisma gerado, `dist/`, `coverage/` e churn de lockfile — salvo quando a
  mudança neles *for* o bug.
- **Seu parecer não substitui sinal concreto** (§2): merge exige `aprovado E testes verdes`.
  Cheque a prova viva: `node .harness/tools/gates.js --feature <slug> --json`.
- Só implemente os blockers se o usuário pedir.
