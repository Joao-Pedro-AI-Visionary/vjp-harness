# SPEC — bsd.js passa a ler spec.md/tasks.md de verdade (fecha o gap do Princípio #2)

## Contexto

Achado durante o uso do harness no monoRepo (07/07/2026): `bsd.js --execute <feature>` não lê nenhum
`spec.md`/`tasks.md` do disco — recebe só o nome da feature como string e o LLM (Planner) inventa o
plano sozinho, do zero, a cada execução. Isso contradiz diretamente o Princípio #2 do próprio
`AGENT_RULES.md` ("O código só deve ser gerado a partir de especificações claras e previamente
mapeadas: spec.md e tasks.md") e o próprio mermaid que `updateStateMarkdown` já gera em `STATE.md`
("Task lida do tasks.md" — texto que o código nunca cumpriu).

Existem hoje 3 mecanismos "spec-driven" no ecossistema do usuário que não se conversam:
1. `bsd.js` (autônomo, não lê arquivo nenhum).
2. GSD Redux vendorizado (`gsd-sdk.js`, gera spec.md/design.md/tasks.md/roadmap.md, mas não alimenta o bsd.js).
3. O sistema `/gsd:*` de cada projeto-alvo (convenção `.planning/phases/<fase>/`, hoje só com `SUMMARY.md`
   de fases concluídas, não specs vivas).

## Objetivo

Fazer `bsd.js --execute <feature>` **preferir** spec.md/tasks.md quando existirem (localizados em
`.planning/phases/<feature>/` ou `specs/<feature>/`), executando task por task do `tasks.md` e
marcando `[x]` no arquivo real conforme cada task é aprovada pelo Reviewer — preservando 100% do
comportamento autônomo atual quando nenhum dos dois arquivos existir (retrocompatibilidade com todo
projeto que já usa o harness sem specs escritas).

## Design

- `findFeatureSpec(rootDir, feature)`: localiza a pasta da feature nas duas convenções aceitas;
  exige `tasks.md`, `spec.md` é opcional.
- `parseTasks(md)`: parseia checkboxes markdown (`- [ ] **T1.** texto`) em `{id, done, text}`.
- `markTaskDone(tasksPath, taskId)`: marca `[x]` no arquivo real, idempotente.
- `executeFeature`: passa a montar a lista de "units" a executar = tasks pendentes do tasks.md (ou,
  na ausência de spec, uma unit sintética única = a própria feature, igual ao comportamento de hoje).
  Uma worktree só por feature (todas as tasks compartilham); merge final único depois de todas
  aprovadas. `spec.md` (quando existir) é injetado como contexto extra no Planner/Researcher/
  NFR-Planner/Contract via novo parâmetro `spec`.
- `agents.js`: `runPlanner`/`runResearcher`/`runNfrPlanner`/`runContract` ganham parâmetro opcional
  `spec` (string), anexado ao `userPrompt` quando presente. Backward-compatible (parâmetro opcional).

## Alternativa descartada

Reescrever `bsd.js` para depender *obrigatoriamente* de spec.md/tasks.md (bloquear o modo autônomo).
Rejeitada porque quebraria todo projeto que já usa `--execute` sem specs escritas hoje (regressão
inaceitável em ferramenta vendorizada em 6+ projetos do usuário).

## Testes (TDD — Artigo III, NON-NEGOTIABLE)

`tests/spec-tasks.test.mjs`: unit tests de `parseTasks`/`findFeatureSpec`/`markTaskDone` (temp dirs,
sem subprocess) + 2 testes de integração via subprocess (`node bsd.js --execute ... --dry-run`) em
git repo temporário descartável: (1) com tasks.md de 2 tasks, confirma que ambas terminam `[x]`;
(2) sem spec/tasks, confirma que cai no modo autônomo de sempre (mensagem + comportamento idênticos
aos de antes da mudança).

## Critérios de aceite

- [ ] Suite completa do harness (`npm test` em `template/tools/`) permanece 100% verde.
- [ ] Teste (1) acima prova que tasks.md real é lido e atualizado.
- [ ] Teste (2) acima prova retrocompatibilidade total do modo autônomo.
- [ ] `.gbrain/decisions.md` do harness registra o ADR desta mudança.
- [ ] VERSION do harness incrementado; reinstalado no monoRepo via `install.sh --force`.
