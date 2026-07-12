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
| `prova-viva` | ⏳ | (sinal externo — fase futura) |
| `contrato-bate` | ⏳ | (sinal externo — fase futura) |
| `owasp` | ⏳ | (sinal externo — fase futura) |

## Uso
```bash
node .harness/tools/gates.js --feature <slug> [--json]
```

Ver spec: `specs/metodo-duravel-portoes-dial/spec.md`.
