# Spec — Harness Ambiente: guard de sessão em toda terminal

> **Data:** 2026-07-12 · **Autor:** João Pedro (V-JP) · **Branch:** `feat/harness-ambient-guard`

## 1. Problema

O harness é **opt-in por projeto**: se o `.harness/` não estiver lá, o método simplesmente não existe — e nada avisa. Nas palavras do usuário: *"não quero correr risco de trabalhar sem isso preconfigurado."* Hoje o `~/.claude/CLAUDE.md` global **aponta** para a lei do harness, mas isso é **convenção**, não **garantia**: nada detecta um projeto sem `.harness/`.

## 2. Decisão de força (escolha do usuário)

**AVISAR + oferecer instalar. NUNCA bloquear.**

Alternativas descartadas: (B) bloquear de verdade; (C) bloquear com escape (`.harness-opt-out`).

**Porquê:** um bloqueio dispararia em **todo** repositório aberto — clone de terceiro, script de 5 linhas, repo do colega (docmind). Viraria estorvo, e estorvo leva a **desligar o guard inteiro** — o pior resultado possível (proteção zero). Um aviso que ele **vê** vale mais que um bloqueio que ele **contorna**. O aviso é barato, informativo e não tem custo de fricção.

## 3. Arquitetura

Hook **PreToolUse** do tipo `command` (bash puro, determinístico, ~1ms) — **não** `agent` (o gate SDD do usuário é `agent` e custa uma chamada de IA por edição; o guard não pode ter esse custo).

**Aditivo:** entra ao lado do gate SDD existente, **sem** removê-lo (o gate SDD está ancorado desde 2026-07-04 e é lei do usuário).

### Quando avisa
Avisa **apenas** se TODAS forem verdadeiras:
1. O arquivo editado é **código-fonte** (`.ts .tsx .js .jsx .py .go .rb .rs .java .kt .php .cs .cpp .c .sql .sh .vue .svelte`), **não** doc/config/teste.
2. A raiz do projeto **não tem** `.harness/`.
3. O projeto **não tem** `.harness-opt-out` (escape p/ repos de terceiro).
4. **Ainda não avisou** para este projeto **nesta sessão** (1x por projeto/sessão — não spamma).

### Nunca bloqueia
Sai **sempre com código 0**. Falha do próprio guard (bug, path estranho) → silencioso, some do caminho. **O guard nunca pode impedir o trabalho.**

### Onde vive
- `machine/hooks/harness-guard.sh` — o script (versionado no repo do harness).
- `~/.claude/settings.json` — registrado como PreToolUse `command` (máquina atual).
- `machine/export/settings.template.json` — para uma **máquina nova** herdar via `bootstrap.sh`.

## 4. Contrato de I/O (Claude Code hooks)

**Entrada:** JSON no stdin, com `tool_input.file_path` e `session_id`.
**Saída:** JSON no stdout com `systemMessage` (mostrado ao usuário). Exit **0** sempre.

## 5. Cenários (bons e ruins)

| Cenário | Esperado |
|---|---|
| Edita `.ts` em projeto SEM harness | **avisa** (1x) |
| Edita 2º `.ts` no mesmo projeto/sessão | **silencioso** (já avisou) |
| Edita `.ts` em projeto COM `.harness/` | silencioso |
| Edita `README.md` / `package.json` / `*.test.ts` | silencioso (não é código-fonte) |
| Projeto com `.harness-opt-out` | silencioso (terceiro) |
| Arquivo fora de repo git / path esquisito / stdin inválido | silencioso, **exit 0** |
| Qualquer erro interno do guard | silencioso, **exit 0** (nunca trava) |

## 6. Fora de escopo (YAGNI)
- Bloqueio (decisão explícita do usuário).
- Auto-instalar o harness sem consentimento (instalar muda o repo do usuário — sempre ação dele).
- Suporte a outros harnesses/IDEs além do Claude Code.
