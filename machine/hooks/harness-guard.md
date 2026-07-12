# Guard de Sessão — Harness Ambiente (V-JP)

Resolve: *"não quero correr risco de trabalhar sem isso preconfigurado."*

Ao editar **código-fonte** num projeto **sem `.harness/`**, o guard **avisa** e oferece o comando
de instalar. **Nunca bloqueia** — sai sempre com código 0, mesmo se ele próprio falhar.

## Por que avisar e não bloquear
Bloquear dispararia em **todo** repo aberto (clone de terceiro, script de 5 linhas, repo do colega).
Viraria estorvo → você desligaria o guard → **proteção zero**. Um aviso que você **vê** vale mais
que um bloqueio que você **contorna**.

## Fica quieto quando
- o projeto **tem** `.harness/`
- o projeto tem **`.harness-opt-out`** (escape p/ repos de terceiro, ex.: docmind)
- o arquivo **não é código-fonte** (`.md`, `.json`, `.yaml`, testes…)
- **já avisou** naquele projeto naquela sessão (1x por projeto/sessão — não spamma)
- qualquer erro interno (falha segura)

## Instalação
Registrado como hook `PreToolUse` (type `command`, bash puro — **não** custa chamada de IA) em
`~/.claude/settings.json`, **ao lado** do gate SDD (não o substitui). Máquina nova herda via
`machine/export/settings.template.json` + `bootstrap.sh`.

Testes: `template/tools/tests/harness-guard.test.mjs` (dirige o script de verdade).
Spec: `specs/harness-ambiente/spec.md`.
