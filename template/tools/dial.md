# Dial de Coreografia (V-JP)

Escolhe QUANTA coreografia rodar. `nível = clamp(max(piso_da_classe, recomendado), 0, 3)`.
MAIOR = MAIS coreografia. O **piso** por classe é o mínimo de segurança e nunca é rebaixado
(ex.: `prod`/`migration` = 3). `recomendado` vem da confiança medida (Aferidor, Fase 3);
sem confiança, usa `conservativeDefault` (3, coreografia máxima). Config: `.harness/config/dial.json`.

| Nível | Coreografia |
|---|---|
| 0 | Só Portões (modelo faz o loop) |
| 1 | Leve (plano curto + portões) |
| 2 | Pipeline (planner→researcher→executor→reviewer) |
| 3 | Pipeline + Especialistas + NFR upfront |

O `bsd.js` pula estágios upfront abaixo do limiar (`stageMinLevel`), usando o stub DRY.
Uso: `node .harness/tools/dial.js --class <classe> [--recommended <0-3>] [--json]`.
Ver spec: `specs/metodo-duravel-portoes-dial/spec.md` §3.3.
