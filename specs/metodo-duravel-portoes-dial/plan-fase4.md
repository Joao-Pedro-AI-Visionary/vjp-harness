# Método Durável — Fase 4: Probe Sombra + Conjunto-Canário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** O probe sombra que popula `shadow_level` + `shadow_first_try_pass` no `RUN_RECORD`, para o analisador (Fase 3) promover com base na evidência do nível MAIS FROUXO (de-riscado), não só no sucesso do nível atual. Entrega: conjunto-canário fixo/versionado, lógica pura de agregação, orquestração com **runner plugável**, e wiring no `bsd.js` **off por padrão** (`VJP_SHADOW`).

**Fidelidade (honesto):** o probe de *qualidade do modelo* exige rodar a pipeline LLM ao vivo no nível-sombra (custo/conectividade) — é um runner de PRODUÇÃO injetável. O runner embutido, determinístico e sem-LLM, é um **self-check do Dial** (valida que o Dial produz nível/estágios esperados nos fixtures dourados). O mecanismo, canário e wiring são completos e testados; a troca do runner pelo LLM é o gancho de produção. Default OFF ⇒ zero mudança de comportamento.

**Tech Stack:** Node ESM, `node --test`. Sem deps novas.

---

## File Structure
| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `template/config/canary.json` | Cria | Conjunto-canário fixo (tarefas douradas) |
| `template/tools/sombra.js` | Cria | `shadowLevelFor`,`aggregateShadow`,`loadCanary`,`runCanaryProbe`,`dialConsistencyRunner` + CLI |
| `template/tools/tests/sombra.test.mjs` | Cria | TDD |
| `template/tools/bsd.js` | Modifica | probe sombra opt-in (`VJP_SHADOW`) → popula shadow_* no RUN_RECORD |
| `template/tools/tests/spec-tasks.test.mjs` | Modifica | + `sombra.js` na lista de cópia |
| `registry.json`,`REGISTRY.md`,`VERSION`,`harness.yaml`,`sombra.md` | Modifica/Cria | registra; bump 1.14.0 |

---

## Task 1: canary.json + sombra.js (puro)

- [ ] **Step 1:** Create `template/config/canary.json`:
```json
{
  "version": 1,
  "comment": "Conjunto-canário: tarefas douradas p/ o probe sombra. Fixo, determinístico, versionado. expectLevel/expectStages = comportamento correto do Dial dado 'recommended'.",
  "fixtures": [
    { "id": "frontend-tsx", "taskClass": "frontend", "recommended": 0, "expectLevel": 1, "expectStages": { "planner": true, "nfr": false, "contract": false, "researcher": false } },
    { "id": "backend-service", "taskClass": "backend", "recommended": 0, "expectLevel": 1, "expectStages": { "planner": true, "nfr": false, "contract": false, "researcher": false } },
    { "id": "config-doc", "taskClass": "config", "recommended": 0, "expectLevel": 0, "expectStages": { "planner": false, "nfr": false, "contract": false, "researcher": false } },
    { "id": "prod-critico", "taskClass": "prod", "recommended": 0, "expectLevel": 3, "expectStages": { "planner": true, "nfr": true, "contract": true, "researcher": true } }
  ]
}
```

- [ ] **Step 2:** Test `template/tools/tests/sombra.test.mjs`:
```js
// sombra.js: probe sombra + conjunto-canário (Fase 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadowLevelFor, aggregateShadow, runCanaryProbe, dialConsistencyRunner, loadCanary } from '../sombra.js';

const cfg = {
  levels: { "0": "z", "1": "a", "2": "b", "3": "c" }, conservativeDefault: 3,
  pisos: { prod: 3, migration: 3, db: 2, backend: 1, frontend: 1, config: 0 },
  stageMinLevel: { planner: 1, nfr: 3, contract: 2, researcher: 2 },
};

test('shadowLevelFor: um degrau mais frouxo, respeitando o piso', () => {
  assert.equal(shadowLevelFor(2, 'frontend', cfg), 1); // piso 1
  assert.equal(shadowLevelFor(1, 'frontend', cfg), null); // já no piso -> sem sombra
  assert.equal(shadowLevelFor(3, 'prod', cfg), null);    // piso 3 -> sem espaço
  assert.equal(shadowLevelFor(2, 'config', cfg), 1);
});

test('aggregateShadow: só true se TODAS passaram; ignora não-booleanos', () => {
  assert.deepEqual(aggregateShadow([{ passed: true }, { passed: true }]), { shadow_first_try_pass: true, rate: 1, n: 2 });
  assert.deepEqual(aggregateShadow([{ passed: true }, { passed: false }]), { shadow_first_try_pass: false, rate: 0.5, n: 2 });
  assert.deepEqual(aggregateShadow([]), { shadow_first_try_pass: null, rate: null, n: 0 });
  assert.deepEqual(aggregateShadow([{ passed: null }]), { shadow_first_try_pass: null, rate: null, n: 0 });
});

test('dialConsistencyRunner: passa quando o Dial bate o fixture dourado', () => {
  const runner = dialConsistencyRunner(cfg);
  assert.equal(runner({ taskClass: 'frontend', recommended: 0, expectLevel: 1, expectStages: { planner: true, nfr: false, contract: false, researcher: false } }).passed, true);
  assert.equal(runner({ taskClass: 'config', recommended: 0, expectLevel: 0, expectStages: { planner: false, nfr: false, contract: false, researcher: false } }).passed, true);
});

test('dialConsistencyRunner: falha se o esperado não bate (detecta quebra do Dial)', () => {
  const runner = dialConsistencyRunner(cfg);
  assert.equal(runner({ taskClass: 'config', recommended: 0, expectLevel: 3, expectStages: {} }).passed, false);
  assert.equal(runner({ taskClass: 'frontend', recommended: 0, expectLevel: 1, expectStages: { nfr: true } }).passed, false);
});

test('runCanaryProbe: agrega o resultado do runner sobre os fixtures', () => {
  const canary = { fixtures: [
    { taskClass: 'frontend', recommended: 0, expectLevel: 1, expectStages: { planner: true, nfr: false, contract: false, researcher: false } },
    { taskClass: 'config', recommended: 0, expectLevel: 0, expectStages: { planner: false, nfr: false, contract: false, researcher: false } },
  ] };
  const agg = runCanaryProbe({ canary, runner: dialConsistencyRunner(cfg) });
  assert.equal(agg.shadow_first_try_pass, true);
  assert.equal(agg.n, 2);
});

test('loadCanary lê o canary.json real (>= 3 fixtures)', () => {
  const c = loadCanary();
  assert.ok(Array.isArray(c.fixtures) && c.fixtures.length >= 3);
});
```

- [ ] **Step 3:** Run — expect FAIL.

- [ ] **Step 4:** Implement `template/tools/sombra.js`:
```js
#!/usr/bin/env node
/**
 * V-JP Harness: Probe Sombra + Conjunto-Canário (Fase 4).
 * Roda o canário no nível MAIS FROUXO (sombra) e agrega em shadow_first_try_pass,
 * pra o analisador (Fase 3) promover com evidência de-riscada. runner PLUGÁVEL:
 * embutido = self-check determinístico do Dial (sem LLM); produção injeta a pipeline LLM.
 * — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { selectLevel, stageEnabled, loadDialConfig } from './dial.js';

// Nível-sombra = um degrau mais frouxo que o atual, sem furar o piso. null = já no piso (sem sombra).
export function shadowLevelFor(currentLevel, taskClass, config) {
  const piso = config.pisos[taskClass] ?? config.pisos.config ?? 0;
  const shadow = currentLevel - 1;
  return shadow >= piso ? shadow : null;
}

// shadow_first_try_pass = TRUE só se todas as amostras passaram. Ignora resultados não-booleanos.
export function aggregateShadow(results) {
  const scored = (results || []).filter((r) => r && typeof r.passed === 'boolean');
  if (!scored.length) return { shadow_first_try_pass: null, rate: null, n: 0 };
  const passed = scored.filter((r) => r.passed).length;
  return { shadow_first_try_pass: passed === scored.length, rate: passed / scored.length, n: scored.length };
}

export function loadCanary(canaryPath) {
  const p = canaryPath || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../config/canary.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Roda cada fixture pelo runner e agrega. runner(fixture) -> { passed: boolean|null }.
export function runCanaryProbe({ canary, runner }) {
  return aggregateShadow((canary.fixtures || []).map((fx) => runner(fx)));
}

// Runner embutido (determinístico, SEM LLM): valida que o Dial produz o nível/estágios dourados.
// NÃO mede qualidade do modelo — é um self-check do harness. Produção injeta um runner LLM.
export function dialConsistencyRunner(config) {
  return (fx) => {
    const level = selectLevel({ taskClass: fx.taskClass, recommended: fx.recommended, config });
    if (level !== fx.expectLevel) return { passed: false };
    const stagesOk = Object.entries(fx.expectStages || {}).every(([s, exp]) => stageEnabled(level, s, config) === exp);
    return { passed: stagesOk };
  };
}

// ---- CLI (Art. II): node sombra.js --probe [--config <path>] [--canary <path>] [--json] ----
function main() {
  const argv = process.argv.slice(2);
  const get = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  if (!argv.includes('--probe')) { console.error('uso: node sombra.js --probe [--config <path>] [--canary <path>] [--json]'); process.exit(2); }
  const config = loadDialConfig(get('--config'));
  const canary = loadCanary(get('--canary'));
  const agg = runCanaryProbe({ canary, runner: dialConsistencyRunner(config) });
  const out = { fixtures: canary.fixtures.length, ...agg, runner: 'dial-consistency (self-check, sem LLM)' };
  console.log(argv.includes('--json') ? JSON.stringify(out, null, 2)
    : `canário: ${agg.n} fixtures, sombra_pass=${agg.shadow_first_try_pass} (taxa ${agg.rate}) [runner: self-check do Dial]`);
  process.exit(agg.shadow_first_try_pass ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

- [ ] **Step 5:** Run — expect PASS (6). Smoke: `node sombra.js --probe` → `canário: 4 fixtures, sombra_pass=true ...`. Report.

- [ ] **Step 6:** Commit:
```bash
git add template/config/canary.json template/tools/sombra.js template/tools/tests/sombra.test.mjs
git commit -m "feat(sombra): probe sombra + conjunto-canário + runner plugável (Fase 4)"
```

---

## Task 2: Wire o probe sombra no bsd.js (opt-in VJP_SHADOW)

Contexto: no bloco `--- Dial de Rigor`, após computar `taskLevel`, `upfrontClass`, `dialConfig`. O bloco `RUN_RECORD` chama `buildRunRecord({ now, modelId, taskClass, level: taskLevel, gates })` — buildRunRecord aceita `shadowLevel`/`shadowFirstTryPass` (default null).

- [ ] **Step 1:** Import após a linha do aferidor-analise:
```js
import { shadowLevelFor, runCanaryProbe, dialConsistencyRunner, loadCanary } from './sombra.js';
```

- [ ] **Step 2:** Declare as variáveis de sombra no escopo da função (junto de `let dialConfig = null, taskLevel = 3, upfrontClass = 'config';`), mudando a linha para:
```js
  let dialConfig = null, taskLevel = 3, upfrontClass = 'config', shadowLevel = null, shadowPass = null;
```

- [ ] **Step 3:** DENTRO do try do Dial, LOGO APÓS a linha `taskLevel = selectLevel({ taskClass: upfrontClass, recommended, config: dialConfig });`, insira:
```js
    // Probe sombra (Fase 4, opt-in via VJP_SHADOW): mede o nível mais frouxo p/ de-riscar promoção.
    if (process.env.VJP_SHADOW && dialConfig) {
      shadowLevel = shadowLevelFor(taskLevel, upfrontClass, dialConfig);
      if (shadowLevel != null) {
        try {
          const agg = runCanaryProbe({ canary: loadCanary(), runner: dialConsistencyRunner(dialConfig) });
          shadowPass = agg.shadow_first_try_pass;
          console.log(`  ${COLORS.dim}Sombra: nível ${shadowLevel} → pass=${shadowPass}${COLORS.reset}`);
        } catch { /* canário ausente: sombra fica null */ }
      }
    }
```

- [ ] **Step 4:** No bloco `RUN_RECORD`, adicione os dois campos de sombra à chamada `buildRunRecord({...})` (junto de `level: taskLevel,`):
```js
        shadowLevel,
        shadowFirstTryPass: shadowPass,
```

- [ ] **Step 5:** `spec-tasks.test.mjs` — nas DUAS listas de cópia, adicione `'sombra.js'`:
`[..., 'dial.js', 'aferidor-analise.js', 'sombra.js']`

- [ ] **Step 6:** Verify — `cd template/tools && node --test tests/*.test.mjs` (0 novos fails) + boot `cd <worktree-root> && node template/tools/bsd.js 2>&1 | head -4` sem stack trace. E teste opt-in: `cd template/tools && node -e "process.env.VJP_SHADOW='1'; import('./sombra.js').then(m=>{const c=require('../config/dial.json');console.log('shadowLevelFor(2,frontend)=',m.shadowLevelFor(2,'frontend',c))})"` → 1.

- [ ] **Step 7:** Commit:
```bash
git add template/tools/bsd.js template/tools/tests/spec-tasks.test.mjs
git commit -m "feat(bsd): probe sombra opt-in popula shadow_* no RUN_RECORD (Fase 4)"
```

---

## Task 3: Registrar, doc, bump 1.14.0

- [ ] **Step 1:** `registry.json`: `harnessVersion` → `1.14.0`; append:
```json
{
  "id": "sombra",
  "name": "Probe Sombra + Conjunto-Canário (V-JP)",
  "tier": "core",
  "priority": 18,
  "required": true,
  "source": { "type": "bundled", "author": "João Pedro (V-JP)" },
  "dest": ".harness/tools/sombra.js",
  "version": "1.14.0",
  "install": "Incluído no harness (template/tools/sombra.js).",
  "verify": { "type": "file", "path": "tools/sombra.js" }
}
```
- [ ] **Step 2:** `VERSION` → `1.14.0`; `harness.yaml` `version:` → `"1.14.0"`.
- [ ] **Step 3:** Create `template/tools/sombra.md`:
```markdown
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
```
- [ ] **Step 4:** `REGISTRY.md`: 1 linha (Probe Sombra + Conjunto-Canário, V-JP, 1.14.0) + changelog `**v1.14.0:** Probe Sombra + Conjunto-Canário (Fase 4)`.
- [ ] **Step 5:** `cd template/tools && npm run check` — verde + Determinismo OK (conta `sombra`). Cole o tail.
- [ ] **Step 6:** Commit:
```bash
git add template/registry.json template/REGISTRY.md template/tools/sombra.md VERSION template/harness.yaml
git commit -m "chore(registry): registra sombra; doc; bump 1.14.0 (Fase 4)"
```

---

## Self-Review
- Probe sombra: nível-sombra respeita piso, agrega, runner plugável (Task 1). ✅ (spec §3.4)
- Wiring opt-in popula shadow_* (Task 2); default OFF → sem mudança. ✅
- Fidelidade documentada (self-check ≠ qualidade do modelo; LLM runner = produção). ✅ honesto
- Art. II/III/VI/VII. ✅ Fora de escopo: adaptadores/mirror (Fase 5). ✅
