# Probe Sombra + Conjunto-Canário (V-JP)

Popula `shadow_level`/`shadow_first_try_pass` no RUN_RECORD, pra o Aferidor (Fase 3) promover
com base no nível MAIS FROUXO de-riscado (não só no sucesso do nível atual). O nível-sombra é
um degrau abaixo do atual, sem furar o piso; se já no piso, não há sombra.

**Opt-in:** só roda com `VJP_SHADOW=1`. Default OFF → shadow_* ficam null (zero mudança).

**Runner plugável:** o embutido `dialConsistencyRunner` é um self-check determinístico do Dial
(valida nível/estágios nos fixtures dourados) — **não mede qualidade do modelo**. O probe de
qualidade real exige injetar a pipeline LLM como runner (gancho de produção). O conjunto-canário
(`.harness/config/canary.json`) é fixo e versionado.

Uso: `node .harness/tools/sombra.js --probe [--json]`. Ver spec §3.4.
