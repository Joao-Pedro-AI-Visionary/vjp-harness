# Portões — Definição de Pronto (V-JP)

Papel: consolidar os invariantes de RESULTADO da Constituição numa checagem determinística
única. Cada portão retorna `green | red | unknown`. `unknown ≠ green`: infra do portão
indisponível NÃO marca "pronto" e NÃO conta na medição do Aferidor.

## Portões (Fase 1)
| Portão | Forçado? | Verifica |
|---|:--:|---|
| `spec-presente` | ✅ | `specs/<feature>/spec.md` existe |
| `adr-presente` | ✅ | `.gbrain/decisions.md` existe e não-vazio |
| `saida-aberta` | ✅ | artefatos em formato aberto e próprio existem (cobre Risco C) |
| `determinismo` | ✅ | `evaluateRegistry` sem required em drift/missing |
| `prova-viva` | ⚠️ | **fiado na v1.19.0** — sinal do `test-gate` em `.bsd/prova-viva.json`, conferido contra o `HEAD` |
| `contrato-bate` | ⏳ | (sinal externo — fase futura) |
| `owasp` | ⏳ | (sinal externo — fase futura) |

## `prova-viva` — o recibo com carimbo de commit (v1.19.0)

A skill `test-gate` escreve `.bsd/prova-viva.json` ao terminar:

```json
{ "feature": "slug", "runner": "jest", "command": "npx jest x.spec.ts",
  "result": "pass", "commit": "<sha do HEAD no momento do teste>",
  "at": "2026-08-29T14:32:00Z", "specs": ["x.spec.ts"], "loops": 1 }
```

| Situação | Portão | Razão |
|---|---|---|
| arquivo ausente / JSON inválido | `unknown` | infra do portão indisponível não marca pronto |
| `result != "pass"` | `red` | teste vermelho |
| `commit != HEAD` | `red` | **verde de outro commit não prova o código atual** |
| sem `commit`, ou `HEAD` irresolvível | `unknown` | frescura não provável |
| `pass` + commit atual | `green` | prova viva |

⚠️ **Avisa, não barra.** `prova-viva` NÃO está em `ENFORCED_GATES` — fica vermelho visível
sem bloquear projeto instalado. Quem barra hoje é `tools/hooks/pre-push` (teste vermelho
trava o push). Para fazer barrar de verdade: acrescente `'prova-viva'` a `ENFORCED_GATES`
em `gates.js` — uma linha, com o custo de exigir o sinal em toda feature.

## Uso
```bash
node .harness/tools/gates.js --feature <slug> [--json]
```

Ver spec: `specs/metodo-duravel-portoes-dial/spec.md`.
