# SPEC — Guard de mensagem de commit (git `commit-msg`, máquina inteira)

**Data:** 2026-08-05
**Autor:** JP (via Claude)
**Status:** implementar

## Problema

JP declarou como regra geral que **todo** commit, em qualquer repo, segue
`[jp] feat|fix(escopo): descricao`. Antes isso valia só nos projetos do Dr. Lima.

A regra hoje só existe na memória do agente. Quando o JP commita à mão, nada o
lembra — e a intenção declarada foi justamente "para eu já me acostumar com isso".
Sem um sinal na hora do commit, o hábito não se forma.

## Objetivo

Recusar, em qualquer repositório da máquina, commit cuja primeira linha não case com
o padrão — mostrando o formato correto no erro.

## Escopo

**Dentro:** hook `commit-msg` global via `core.hooksPath`; delegação para hooks locais
do repo; instalador idempotente.
**Fora:** reescrever histórico já publicado; validar corpo do commit; validar nome de branch.

## Formato aceito

```
[jp] feat|fix(escopo): descricao
```

- `[jp]` obrigatório
- tipo: só `feat` (coisa nova) ou `fix` (bug ou qualquer correção pequena)
- escopo: **opcional** — ver Decisão D-02
- descrição: não vazia

**Passam sem validação:** `Merge *`, `Revert *`, `Reapply *`, `fixup! *`, `squash! *`,
`amend! *` — são mensagens que o próprio git gera. Escape manual: `git commit --no-verify`.

## Decisões

### D-01 — `core.hooksPath` global, com delegação
**Alternativa considerada:** instalar o hook em `.git/hooks/` de cada repo (script que
varre a máquina). **Rejeitada:** não cobre repo clonado depois, e obriga rodar de novo
a cada clone.

**Escolhido:** `git config --global core.hooksPath ~/.config/git/hooks`. Cobre todo repo,
inclusive os futuros, sem manutenção.

**Custo aceito e mitigado:** `core.hooksPath` **desliga** o `.git/hooks/` do repo. Hoje
nenhum repo da máquina tem hook local (verificado em 05/08/2026) e nenhum usa husky, mas
isso pode mudar. Mitigação: cada hook global termina delegando (`exec`) para o hook
homônimo do repo, se existir. Um `_delegate` genérico cobre os demais eventos, para que
um `pre-push` instalado por um projeto continue rodando.

### D-02 — Escopo opcional
**Alternativa:** exigir `(escopo)` sempre, como nos exemplos do JP.
**Rejeitada:** mudança que atinge o repo inteiro (`.gitignore`, faxina) não tem escopo
natural, e forçar `(repo)` gera ruído. Guard que bloqueia commit legítimo é guard que o
usuário desliga. Escopo fica recomendado no texto do erro, não obrigatório.

### D-03 — Bloquear, não avisar
Escolha explícita do JP. Justificativa: aviso que não bloqueia é ignorado, e o objetivo
declarado é formar hábito. Reversível com um comando, documentado no cabeçalho do hook.

## Arquivos

- `machine/git-hooks/commit-msg` — o validador
- `machine/git-hooks/_delegate` — repassa para hook local do repo
- `machine/git-hooks/install-git-hooks.sh` — copia para `~/.config/git/hooks` e seta o config

## Prova viva

1. `git commit -m "arruma o header"` num repo de teste → recusado, com o formato na tela.
2. `git commit -m "[jp] fix(header): logo somia no mobile"` → aceito.
3. `git commit -m "[jp] fix: sem escopo"` → aceito (D-02).
4. `git merge --no-ff` gerando `Merge branch ...` → aceito.
5. Hook local em `.git/hooks/commit-msg` do repo → continua sendo executado (D-01).
