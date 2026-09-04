---
name: prepush
description: Gate de segurança e qualidade antes de QUALQUER push ou PR — pull/rebase obrigatório, varredura de segredos e dados pessoais (gitleaks), estático, suíte completa, depois os portões do harness V-JP (test-gate = testes da mudança com prova viva, pr-review = revisor cético) mais /code-review como segundo revisor e CodeRabbit CLI opcional, e só então push/PR. Use quando o usuário pedir para subir, dar push, abrir PR, "mandar pro remoto", "rodar o prepush", validar antes de subir, ou ao terminar qualquer trabalho que vá para uma branch compartilhada.
user-invocable: true
---

# prepush — nada sobe sem passar pelas camadas

Uma branch só vai para o remoto depois de atravessar, **nesta ordem**, as camadas abaixo. As camadas 0–5 são um script determinístico; as 6–8 são suas e reusam os portões que o harness V-JP já tem (`test-gate`, `pr-review`, `dial`, `prova-viva`). Cada camada bloqueada **para o fluxo**: corrija, reexecute a camada, siga. Nunca pule camada por conta própria — só o usuário pode, e a resposta final registra o que foi pulado e por quê.

Regras invioláveis:
- **Pull antes de push, sempre.** A camada 1 faz `fetch` + `rebase` na base; conflito é resolvido à mão com o usuário olhando, nunca com `--force`.
- **Nunca `git push --force`** nem `--no-verify`. Se o usuário pedir, explique o custo e peça confirmação explícita.
- **Push em branch compartilhada** (`homol`, `develop`, `main`, `master`) exige confirmação do usuário na hora, mesmo com gate verde. Feature branch sobe direto quando ele já pediu.
- Sem evidência, não está pronto (harness §8.5): a resposta final cola a saída real do gate, dos testes e da revisão.
- Não spawne subagentes em paralelo daqui (máquina de 8 GB, §1.6). `/code-review` já roda em subagente próprio; espere ele terminar.

## Camada 0–5 · gate mecânico (script)

```bash
bash ~/.claude/skills/prepush/scripts/gate.sh [--base <branch>] [--json /tmp/prepush.json]
```

| # | Camada | O que faz | Bloqueia? |
|---|---|---|---|
| 0 | contexto | branch, base (`prepush.base` → upstream → homol/develop/main/master), commits a subir. Busca a base por refspec explícito e avisa se o remoto está sem `remote.origin.fetch` (senão `origin/<base>` fica velho para sempre) | — |
| 1 | sincronizar | `fetch`; se a branch não contém a base ou o upstream, **rebase**; conflito aborta e bloqueia; árvore suja só bloqueia quando precisa rebasear | sim |
| 2 | segredos | `gitleaks` nos commits a subir + varredura interna (AWS, chave privada, GitHub, Google, Slack, Stripe, JWT, URL com senha, `password=`), `.env` entrando, **caminho de máquina pessoal** (`/home/fulano`, `C:\Users\fulano` — placeholders passam) | sim |
| 3 | estático | `npm run typecheck/lint` se existirem; `npm audit` high+ em prod (aviso; `git config prepush.audit block` trava); `ruff` em Python | sim (audit: aviso) |
| 4 | testes | `prepush.testcmd` → `hooks.testcmd` → `npm test` / `pytest` / `go test` — **suíte completa**, log em `$TMPDIR/prepush-<repo>/testes.log` | sim |
| 5 | cobertura da mudança | lista arquivo alterado sem teste vizinho; com `.harness/tools/cbm.js` (harness ≥ 1.21) anexa o **raio de impacto** do grafo (símbolos mudados, quem os chama, specs que já os cobrem) — uma chamada, ~300 tokens, nunca bloqueia | aviso → camada 6 |

Saída: relatório em stderr, `PREPUSH_RESULT=ok|bloqueado` em stdout, JSON opcional. Códigos: 0 ok, 1 bloqueado, 2 ambiente. Primeira publicação (sem base no remoto) varre toda a história.

**Suíte falhando na camada 4:** antes de dizer "pré-existente", **prove**: `git worktree add /tmp/base-<repo> origin/<base>`, rode só as suítes que falharam lá, compare. Falha que já existe na base vai ao usuário com nome da suíte e motivo; ele decide se aceita (`--skip=testes` não é decisão sua). Falha nova é sua para corrigir. Suíte que exige serviço ausente (Postgres, Redis) é "ambiente", diga isso.

## Camada 6 · testes da mudança → skill `test-gate`

Se `~/.claude/skills/test-gate` existir (harness ≥ 1.19), **invoque a Skill `test-gate`**: ela detecta o runner do repo, escreve só os specs dos símbolos mudados, roda o comando mais estreito, teto de 2 tentativas, e deixa `.bsd/prova-viva.json` com o carimbo do `HEAD`. Se o projeto tem `.harness/`, o Dial decide se roda: `node .harness/tools/dial.js --class <config|frontend|backend|db|migration|prod> --json` → `stages["test-gate"]`. Classe `config` não roda; diga isso em uma linha.

Sem a skill: para cada arquivo da camada 5 e cada comportamento novo do diff, escreva testes que **executam a interface pública** e afirmam comportamento observável (entrada → saída, estado, efeito, modo de falha). Proibido teste que só faz grep/snapshot do fonte. Rode os novos, depois a camada 4 de novo.

Opcional, só com o sim do usuário: TestSprite MCP (`mcp__TestSprite__*`) contra ambiente vivo (`git config prepush.e2eurl`) — é nuvem, custa crédito, manda o app para fora.

**Recibo:** se commitou depois do `test-gate`, o recibo morreu (`commit != HEAD` = vermelho). Reescreva-o depois do último commit. Confira: `node .harness/tools/gates.js --feature <slug> --json`.

## Camada 7 · revisão adversarial → `pr-review` + `/code-review` (+ CodeRabbit)

Quem implementou não aprova o próprio código (§8.3). Dois revisores de naturezas diferentes:

1. **Skill `pr-review`** (harness): lê `.gbrain/lessons.md`/`decisions.md` antes do diff, revisa sobre `git diff origin/<base>...HEAD` sem worktree, saída blocker/should-fix/nit com `file:line`, teto de 10. Dial: roda a partir do nível 2 (`db`, `migration`, `prod`); abaixo disso rode mesmo assim quando a mudança toca auth, dinheiro, dado de cliente ou contrato de API — o `/prepush` é o momento de pagar esse custo.
2. **`/code-review high`** (Skill `code-review`, subagente separado): pega lógica, borda e regressão que a checklist não lista. **Armadilha:** nesta máquina o nome `code-review` resolve para a skill do plugin GSD (revisão por fase, exige `.planning/`), não para o `/code-review` nativo. Se a skill carregada falar em "phase"/`REVIEW.md` do GSD, não rode: dispare um `Agent` general-purpose como revisor independente (sem o seu contexto de autor, só leitura, sem jest), com o mesmo formato blocker/should-fix/nit e `file:line`.
3. **CodeRabbit CLI** se instalado (`cr review --base <base> --agent`, grátis 3/h) ou **Greptile CLI** (`greptile review --branch <base> --agent`): segunda opinião de outro fornecedor.

Loop de correção: **blocker** e qualquer coisa de segurança → corrija → camada 4 de novo → rerevise. **Máximo 2 rodadas** (§2); se a terceira ainda tiver blocker, pare e leve ao usuário. Should-fix vai para a resposta; nits idem, não bloqueiam.

PR grande ou área sensível: ofereça `/code-review ultra` (nuvem, US$ 5–20) — só com o sim do usuário.

## Camada 8 · subir

1. `.harness/` presente: `node .harness/tools/gates.js --feature <slug> --json` — `prova-viva` vermelho não sobe.
2. Harness ativo e ambiente vivo: `integration-verifier` antes do push (front → API → DB).
3. `git push -u origin <branch>` (o hook global roda o gate de novo; sem `--force`). Branch compartilhada: confirme antes.
4. PR quando pedido ou quando a base é protegida por convenção: `gh pr create --base <base>` com corpo em 3 blocos (o que mudou · como validar · evidência) e o rodapé padrão da sessão.
5. `git config prepush.ci watch` → `gh pr checks --watch`; CI vermelho é seu (volta à camada 4).

## Flags do usuário

| Pedido | Ação |
|---|---|
| `/prepush` | camadas 0–8 sem PR |
| `/prepush --pr` | idem + PR na base |
| `/prepush --base <b>` | força a base |
| `/prepush --sem-revisao` | pula camada 7 (registrar na resposta) |
| `/prepush --so-gate` | só camadas 0–5, nada de IA |
| `/prepush --instalar-hook` | `bash ~/.claude/skills/prepush/reinstall.sh` — skill + hook global (`core.hooksPath ~/.githooks`) que bloqueia push com branch atrás, segredo ou teste quebrado, mesmo fora do Claude |

## Resposta final (obrigatória — formato §8.5)

1. **O que subiu** — branch, base, commits, PR (link).
2. **Camadas** — tabela camada · resultado · evidência (linha real da saída). Pulada = por quem e por quê.
3. **Revisão** — blockers corrigidos (`file:line`), should-fix e nits pendentes.
4. **Prova viva** — `.bsd/prova-viva.json @ <commit>` ou "sem harness".
5. **Não verificado** — o que ficou fora (ambiente ausente, suíte pré-existente falhando, ultra não rodado).

Ferramentas, instalação, config por repo e o levantamento de mercado: `reference/camadas-e-mercado.md`.
