---
name: test-gate
description: Gera e roda os testes da mudança atual (NestJS/TypeScript), corrige uma causa-raiz por vez e deixa a prova viva assinada em .bsd/prova-viva.json. Use quando pedirem testes, test gate, cobertura, Jest, Vitest, Playwright, E2E, "roda os testes", ou antes de merge. Prefere o runner que o repo já tem — nunca instala SaaS de teste.
---

# Test Gate — gerar, rodar, provar

Portão de qualidade da mudança atual. O objetivo é **prova de que o comportamento novo
funciona**, não um muro de specs gerados.

Parte do **V-JP Harness** — a lei é `.harness/AGENT_RULES.md`. Esta skill implementa o
Art. III (Test-First) e a §8.4 (checklist mecânica).

## 0. Antes de tudo: o Dial decide se você roda

O rigor escala com o risco. Consulte o oráculo:

```bash
node .harness/tools/dial.js --class <config|frontend|backend|db|migration|prod> --json
```

Se `stages["test-gate"]` for `false` (classe `config`, nível 0), **não rode** — diga isso
em uma linha e siga. Sem `.harness/` no projeto, assuma que roda.

## 1. Detecte (não presuma)

Leia nesta ordem, pare ao achar:

1. `package.json` → scripts `test`, `test:e2e`, `test:cov`
2. `jest.config.*`, `vitest.config.*`, `playwright.config.*`
3. Specs já existentes ao lado do arquivo mudado (`*.spec.ts`, `*.test.ts`, `test/`)
4. Estilo Nest já usado no repo (`@nestjs/testing`, `supertest`)

Combine com o repo. **Nunca introduza Jest onde o repo usa Vitest** (nem o contrário).

## 2. O que testar (prioridade)

1. Use-case da aplicação que mudou — caminho feliz + 1 rejeição de domínio + 1 falha de infra
2. Mapeamento HTTP — status codes e erros de validação do DTO
3. Adapter de persistência — só se a query/transação for nova e não-trivial
4. Idempotência de webhook/pagamento, se esses arquivos mudaram
5. E2E — só o fluxo de usuário que mudou

Não gere teste para getter, wiring de módulo Nest ou tipo gerado pelo Prisma.

## 3. Camadas de dublê (a lei do harness, resolvida)

O AGENT_RULES §2 proíbe "mock volátil de banco" e manda Testcontainers + Nock. Isso **não**
conflita com fake de port — cada dublê tem sua camada:

| Camada | Dublê | Por quê |
|---|---|---|
| Banco (integração) | **Testcontainers** | mock de banco mente sobre constraint, transação e tipo |
| HTTP externo (Asaas, ClickSign, WhatsApp, mail) | **Nock** | determinístico e sem tocar no serviço real |
| Port de domínio, no unit do use-case | **fake in-memory** | o objetivo ali é a regra de negócio, não a infra |

Nunca bata em Asaas/ClickSign/WhatsApp de verdade. Nunca mocke o Prisma dentro do teste
do use-case (mocke o **port**). Nunca mocke o use-case quando o alvo é o use-case.

## 4. E2E — escopo, não dogma

A §4.4 exige fluxo real ponta-a-ponta. Isso se lê assim:

- Mudança **com superfície de UI** → Playwright no fluxo que mudou.
- Mudança **backend-only** → `supertest`/HTTP contra a app cumpre a §4.4. **Não instale
  Playwright num repo sem UI** só para satisfazer a letra da regra.

Regras: bata em localhost ou na `DATABASE_URL` do `.env.test`. Um spec por fluxo,
locators resilientes, nada de `waitForTimeout`. Nenhum runner hospedado/SaaS.

## 5. O loop (teto de 2 — §2 do AGENT_RULES)

1. Identifique os símbolos mudados. Com harness ≥ 1.21, **uma** chamada resolve e diz quais
   specs já exercitam cada símbolo (linhas `spec Module`): símbolo mudado sem spec no raio
   de impacto é o que você escreve.
   ```bash
   node .harness/tools/cbm.js impact --base origin/<base>   # código 3 = sem grafo, siga com git diff
   ```
   Sem harness: `git diff` + abrir os arquivos. Nunca mais de 2 chamadas ao grafo aqui.
2. Escreva/ajuste **só** os specs que cobrem esses símbolos.
3. Rode o **comando mais estreito** que os exercita.
   Ex.: `npx jest src/billing/application/charge-invoice.usecase.spec.ts --runInBand`
   Fallback: o script que o CI já usa.
4. Se falhar: leia o erro, forme **uma** hipótese de causa-raiz e corrija **ou** o código
   **ou** o teste — não os dois no mesmo tiro, salvo se o teste estiver claramente errado.
5. Rode o mesmo comando de novo.
6. **Pare após 2 tentativas falhas.** Reporte o último erro + a hipótese e registre em
   `.bsd/STATE.md`. Não fique mutando.

Não rode a suíte inteira na primeira passada, salvo repo pequeno ou pedido explícito.

## 6. Higiene de recursos (máquina de 8 GB — §1.6)

- **Um servidor de dev por vez.** Cheque a porta (`lsof -ti :3000`) e reaproveite; derrube
  o que você subiu.
- Não rode build/typecheck global em paralelo com a suíte — estoura o heap do V8.
- Não spawne subagentes daqui. O paralelismo é decidido pelo orquestrador (teto de 2).
- Colima/Docker só quando o teste realmente exigir banco — a VM come 2 GB.

## 7. A prova viva (obrigatório ao terminar)

Escreva `.bsd/prova-viva.json` — é o recibo que o `gates.js` confere:

```bash
node -e '
const {execSync}=require("child_process");
const commit=execSync("git rev-parse HEAD").toString().trim();
require("fs").writeFileSync(".bsd/prova-viva.json", JSON.stringify({
  feature:"<slug>", runner:"jest", command:"<comando exato>", result:"pass",
  commit, at:new Date().toISOString(), specs:["<path>"], loops:1
},null,2));'
```

O portão compara `commit` com o `HEAD` atual: **verde de outro commit vira vermelho.**
Recibo velho não paga a compra de hoje. Por isso escreva o recibo **depois** do último
commit da mudança — ou reescreva se commitar de novo.

Confira com:
```bash
node .harness/tools/gates.js --feature <slug> --json   # prova-viva: green|red|unknown
```

`result:"fail"` também deve ser escrito quando o gate fecha vermelho. **Nunca escreva
`pass` sem ter visto a saída verde do comando** — isso é falsificar o único sinal
mecânico do harness.

## 8. Saída (formato obrigatório)

```markdown
# Test gate
**Dial:** classe X → nível N (test-gate: on/off)
**Runner:** jest | vitest | playwright | mixed
**Comando:** [comando exato]
**Resultado:** pass | fail
**Tentativas:** N/2
**Prova viva:** .bsd/prova-viva.json @ <commit curto>

## Specs criados/alterados
- `path` — casos: [nomes]

## Não testado (risco aceito)
- [comportamento] — por quê

## Falhas restantes
- [erro + file:line + hipótese + próxima ação]
```

Isso alimenta a **Evidência de Funcionamento** exigida pela §8.5 do AGENT_RULES.

## Regras de engajamento

- Testes compilam com o tsconfig do projeto.
- **Proibido** baixar threshold de cobertura, `.skip`, `.only`, `@ts-ignore` ou apagar
  teste para o gate ficar verde.
- Sem snapshot de JSON de API.
- Se o repo não tem runner nenhum: proponha o setup mínimo Jest/Nest e **espere
  confirmação** antes de fazer scaffold.
