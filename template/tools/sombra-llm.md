# Sombra de Verdade — Runner LLM (V-JP)

Mede o **MODELO** (não o Dial). A IA resolve tarefas douradas (`config/canary-llm.json`) e um
**juiz determinístico** (código, não IA) compara com o gabarito. O resultado vira
`shadow_first_try_pass` → o Aferidor usa pra **promover** (afrouxar) com evidência.

**Automático amostrado:** roda 1 a cada `shadowSampleEvery` execuções (default 5); nas demais,
usa o self-check barato do Dial. Amostragem **determinística** (sem `Math.random`).

**Constituição:**
- **Art. LLM05** — *nunca* `eval()` em saída de IA → as tarefas pedem **JSON estruturado**, não código executável.
- **Art. LLM10** — consumo limitado → amostragem + `shadowMaxFixtures`.

**Sem LLM configurado / sem rede → `null`** (`null ≠ pass`: nunca "passa" por omissão).

Uso manual: `node .harness/tools/sombra-llm.js --probe [--json]` (**gasta token**).
