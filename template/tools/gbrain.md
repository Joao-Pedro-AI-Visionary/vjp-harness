# GBrain — Memória Persistente

**Tier:** core · **Versão pinada:** `0.35.1.0` (tag `eval-run-v0.35.1.0-baseline`) · **Origem:** git `garrytan/gbrain` (https://github.com/garrytan/gbrain) · **Destino:** `.harness/tools/gbrain/` (persiste em `.gbrain/`)

## Responsabilidade
Memória persistente do projeto: decisões arquiteturais, bugs recorrentes, soluções, contexto de negócio, padrões internos. Os agentes **consultam** o GBrain antes de propor design.

## Estrutura (em `.gbrain/`)
`project.md · architecture.md · decisions.md · lessons.md · patterns.md · people.md · commands.md · bugs.md` + `config.json` + `brain.pglite/` (engine PGLite).

## Papel no pipeline
`GBrain → GSD` (informa o planejamento) e `Reviewer → GBrain` (registra aprendizados ao fim de cada task).

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
