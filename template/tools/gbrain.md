# GBrain — Memória Persistente

**Tier:** core · **Versão pinada:** `0.35.1.0` (tag `eval-run-v0.35.1.0-baseline`) · **Origem:** git `garrytan/gbrain` (https://github.com/garrytan/gbrain) · **Destino:** `.harness/tools/gbrain/` (persiste em `.gbrain/`)

## Responsabilidade
Memória persistente do projeto: decisões arquiteturais, bugs recorrentes, soluções, contexto de negócio, padrões internos. Os agentes **consultam** o GBrain antes de propor design.

## Estrutura (em `.gbrain/`)
`project.md · architecture.md · decisions.md · lessons.md · patterns.md · people.md · commands.md · bugs.md` + `config.json` + `brain.pglite/` (engine PGLite).

## Papel no pipeline
`GBrain → GSD` (informa o planejamento) e `Reviewer → GBrain` (registra aprendizados ao fim de cada task).

## Captura nativa de decisão (v1.7.0)
Para combater a dor "esqueci de gravar a decisão" **sem** depender de uma camada de auto-captura externa não-determinística (rohitg00/agentmemory foi **avaliado e rejeitado** — ver `.gbrain/decisions.md`), o harness traz um helper nativo e determinístico:
```bash
node .harness/tools/gbrain-decision.js "<o quê>" --alt "<alternativa descartada>" --why "<porquê>"
```
Faz append **idempotente** em `.gbrain/decisions.md` no formato defensável do método V-JP. Há ainda um Stop hook opt-in (`machine/hooks/gbrain-decision-reminder.sh`) que lembra de registrar a decisão do dia quando houve mudança de código. Prova viva: `node .harness/tools/gbrain-decision.test.mjs`.

## Instalação
Fonte clonada pinada (tag `eval-run-v0.35.1.0-baseline`, commit `3933eb6a7915`, shallow ~51MB) em `.harness/tools/gbrain/` pelo `install.sh`. Para o binário runnable + MCP:
```bash
/setup-gbrain      # registra o MCP; binário em ~/.bun/bin/gbrain (gbrain serve)
```
Re-vendorize com `node .harness/tools/bsd.js --vendor --only gbrain`.

## Verificação
```bash
gbrain --version
```

## Determinismo
Herda o pin do gstack. O conteúdo de `.gbrain/*.md` é versionado no git do projeto.
