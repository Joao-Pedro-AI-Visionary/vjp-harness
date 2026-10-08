# Dial de rigor — quanto processo cada mudança paga

`node .harness/tools/dial.js --class <config|frontend|backend|db|migration|prod> --json` devolve o nível e os `stages`. O nível é `clamp(max(piso, recomendado), 0, 3)`. Pisos por classe: prod 3, migration 3, db 2, backend 1, frontend 1, config 0. Sem histórico, o padrão conservador é 3.

| Nível | O que roda |
|---|---|
| 0 Só portões | o modelo faz o loop; sem `test-gate` nem `pr-review` (classe `config`) |
| 1 Leve | plano curto + `test-gate` (prova viva) |
| 2 Pipeline | planner→researcher→executor→reviewer + contrato + `test-gate` + `pr-review` |
| 3 Completo | nível 2 + especialistas + NFR antes do código + revisão adversarial de arquitetura |

O Dial também dosa o protocolo de projeto novo; a tabela Fase × nível fica na skill `projeto-novo`. Projeto sem `.harness/`: mudança de risco real (auth, dinheiro, dado de cliente, contrato de API) roda `test-gate` e `pr-review`. Rigor é decisão do Dial, não de regra fixa nem do humor do agente.
