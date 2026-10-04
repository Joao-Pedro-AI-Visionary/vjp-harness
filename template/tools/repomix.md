# Repomix

**Tier:** core · **Versão pinada:** `1.16.0` · **Origem:** npm `repomix` (repo `yamadashy/repomix`, https://github.com/yamadashy/repomix)

## Responsabilidade
Empacota o repositório inteiro num único documento consolidado, criando a visão global do código consumida pelo Headroom.

## Papel no pipeline
`Repositório → Repomix → Headroom`.

## Instalação
Pinado em `.harness/tools/package.json`, instalado via `npm ci` (lockfile).
```bash
node .harness/tools/node_modules/repomix/bin/repomix.cjs --config .harness/config/repomix.config.json
```
Saída em `.harness/context/repo-packed.md`.

## Verificação
```bash
test -f .harness/tools/node_modules/repomix/bin/repomix.cjs && echo OK
```

## Determinismo
Total — versão exata + `package-lock.json`.
