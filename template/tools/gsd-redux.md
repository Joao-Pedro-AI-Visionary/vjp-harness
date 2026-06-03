# Open GSD Redux

**Tier:** core · **Versão pinada:** `1.1.0` · **Origem:** npm `@opengsd/get-shit-done-redux`

## Responsabilidade
Planejamento e estruturação spec-driven. Transforma intenção em artefatos: `spec.md`, `design.md`, `tasks.md`, `roadmap.md`.

## Papel no pipeline
`RTK → GSD Redux → BSD`. O GSD produz o `tasks.md`; o BSD executa cada task.

## Instalação
Pinado em `.harness/tools/package.json`, via `npm ci`.
```bash
node .harness/tools/node_modules/@opengsd/get-shit-done-redux/bin/gsd-sdk.js
```

## Verificação
```bash
test -f .harness/tools/node_modules/@opengsd/get-shit-done-redux/bin/gsd-sdk.js && echo OK
```

## Determinismo
Total — versão exata + `package-lock.json`. (Decisão ADR-001: nunca `npx ...@latest`.)
