# GBrain — Memória Persistente

**Tier:** core · **Versão pinada:** `1.55.1.0` (via gstack) · **Origem:** binário bun distribuído com o gstack (`garrytan/gstack`)

## Responsabilidade
Memória persistente do projeto: decisões arquiteturais, bugs recorrentes, soluções, contexto de negócio, padrões internos. Os agentes **consultam** o GBrain antes de propor design.

## Estrutura (em `.gbrain/`)
`project.md · architecture.md · decisions.md · lessons.md · patterns.md · people.md · commands.md · bugs.md` + `config.json` + `brain.pglite/` (engine PGLite).

## Papel no pipeline
`GBrain → GSD` (informa o planejamento) e `Reviewer → GBrain` (registra aprendizados ao fim de cada task).

## Instalação
```bash
/setup-gbrain      # skill do gstack — instala o binário e registra o MCP
```
MCP de referência: `gbrain serve` (binário em `~/.bun/bin/gbrain`).

## Verificação
```bash
gbrain --version
```

## Determinismo
Herda o pin do gstack. O conteúdo de `.gbrain/*.md` é versionado no git do projeto.
