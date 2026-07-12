# Método Durável — Fase 2: Dial de Rigor (0–3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Um dial que escolhe QUANTO rigor rodar por `risco da classe × confiança`, `nível = clamp(max(piso_da_classe, recomendado), 0, 3)`, com piso de segurança que nunca é rebaixado. O `bsd.js` passa a computar o nível no início da feature, **honrar** o nível pulando estágios upfront (via stub DRY) e **registrar o nível real** no `RUN_RECORD` (não mais fixo 0). A entrada `recomendado` é plugável — na Fase 2 é sempre o padrão conservador (rigor máximo); a Fase 3 injeta a confiança medida.

**Architecture:** Novo módulo puro `template/tools/dial.js` + config `template/config/dial.json` (mesmo padrão de `gates.js`/`verify.js`). Wiring mínimo e seguro no `bsd.js`: como o nível-default é 3 (todos os estágios habilitados), o comportamento atual não muda até a Fase 3 baixar o nível.

**Tech Stack:** Node ESM, `node --test`. Sem deps novas.

---

## File Structure
| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `template/config/dial.json` | Cria | Níveis, pisos por classe, limiares de estágio, janela |
| `template/tools/dial.js` | Cria | `loadDialConfig`, `selectLevel`, `stageEnabled`, `describeLevel` + CLI |
| `template/tools/tests/dial.test.mjs` | Cria | TDD dos puros |
| `template/tools/bsd.js` | Modifica | computa nível upfront, honra via stub DRY, registra nível real |
| `template/tools/tests/spec-tasks.test.mjs` | Modifica | add `dial.js` à lista de cópia do subprocess |
| `template/registry.json`,`REGISTRY.md`,`VERSION`,`harness.yaml`,`template/tools/dial.md` | Modifica/Cria | registra dial; bump 1.12.0 |

---

## Task 1: dial.json + funções puras de dial.js

**Files:** Create `template/config/dial.json`, `template/tools/dial.js`, `template/tools/tests/dial.test.mjs`

- [ ] **Step 1: Create the config** `template/config/dial.json`:
```json
{
  "comment": "Dial de rigor (Fase 2). Nível MAIOR = MAIS rigor. Piso = mínimo por classe (segurança). selectLevel = clamp(max(piso, recomendado), 0, 3).",
  "levels": {
    "0": "Só Portões — modelo faz o loop; harness só aplica os portões",
    "1": "Leve — plano curto + portões",
    "2": "Pipeline — planner→researcher→executor→reviewer + portões",
    "3": "Pipeline + Especialistas + NFR upfront"
  },
  "windowSize": 20,
  "conservativeDefault": 3,
  "pisos": { "prod": 3, "migration": 3, "db": 2, "backend": 1, "frontend": 1, "config": 0 },
  "stageMinLevel": { "planner": 1, "nfr": 3, "contract": 2, "researcher": 2 }
}
```

- [ ] **Step 2: Write the failing test** `template/tools/tests/dial.test.mjs`:
```js
// dial.js: escolha de rigor por risco × confiança (Fase 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectLevel, stageEnabled, describeLevel, loadDialConfig } from '../dial.js';

const cfg = {
  levels: { "0": "z", "1": "a", "2": "b", "3": "c" },
  conservativeDefault: 3,
  pisos: { prod: 3, migration: 3, db: 2, backend: 1, frontend: 1, config: 0 },
  stageMinLevel: { planner: 1, nfr: 3, contract: 2, researcher: 2 },
};

test('sem recomendado -> usa conservativeDefault (rigor máximo)', () => {
  assert.equal(selectLevel({ taskClass: 'frontend', recommended: null, config: cfg }), 3);
  assert.equal(selectLevel({ taskClass: 'config', config: cfg }), 3);
});

test('piso nunca é rebaixado, mesmo com recomendado baixo', () => {
  assert.equal(selectLevel({ taskClass: 'prod', recommended: 0, config: cfg }), 3);       // piso 3
  assert.equal(selectLevel({ taskClass: 'db', recommended: 0, config: cfg }), 2);         // piso 2
  assert.equal(selectLevel({ taskClass: 'frontend', recommended: 0, config: cfg }), 1);   // piso 1
  assert.equal(selectLevel({ taskClass: 'config', recommended: 0, config: cfg }), 0);     // piso 0 -> pode 0
});

test('recomendado ALTO empurra pra CIMA (baixa confiança = mais rigor)', () => {
  assert.equal(selectLevel({ taskClass: 'config', recommended: 2, config: cfg }), 2);
});

test('clamp 0..3', () => {
  assert.equal(selectLevel({ taskClass: 'prod', recommended: 9, config: cfg }), 3);
  assert.equal(selectLevel({ taskClass: 'config', recommended: -5, config: cfg }), 0);
});

test('classe desconhecida cai no piso de config', () => {
  assert.equal(selectLevel({ taskClass: 'inexistente', recommended: 0, config: cfg }), 0);
});

test('stageEnabled respeita stageMinLevel', () => {
  assert.equal(stageEnabled(0, 'planner', cfg), false);
  assert.equal(stageEnabled(1, 'planner', cfg), true);
  assert.equal(stageEnabled(2, 'nfr', cfg), false);
  assert.equal(stageEnabled(3, 'nfr', cfg), true);
  assert.equal(stageEnabled(2, 'contract', cfg), true);
  assert.equal(stageEnabled(0, 'executor', cfg), true); // estágio sem limiar -> sempre
});

test('describeLevel devolve a descrição do nível', () => {
  assert.equal(describeLevel(2, cfg), 'b');
});

test('loadDialConfig lê o dial.json real do harness', () => {
  const real = loadDialConfig();
  assert.equal(real.conservativeDefault, 3);
  assert.equal(real.pisos.prod, 3);
});
```

- [ ] **Step 3: Run — expect FAIL** (`Cannot find module '../dial.js'`): `cd template/tools && node --test tests/dial.test.mjs`

- [ ] **Step 4: Implement** `template/tools/dial.js`:
```js
#!/usr/bin/env node
/**
 * V-JP Harness: Dial de Rigor (Fase 2).
 * Escolhe QUANTO rigor por (risco da classe × confiança medida).
 * nível = clamp(max(piso_da_classe, recomendado), 0, 3). MAIOR = MAIS rigor.
 * Piso nunca é rebaixado (segurança). recomendado=null -> conservativeDefault. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function defaultConfigPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../config/dial.json');
}

export function loadDialConfig(configPath) {
  return JSON.parse(fs.readFileSync(configPath || defaultConfigPath(), 'utf8'));
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// nível efetivo. recomendado null/undefined -> conservativeDefault (rigor máximo, sem confiança).
export function selectLevel({ taskClass, recommended = null, config }) {
  const piso = config.pisos[taskClass] ?? config.pisos.config ?? 0;
  const rec = (recommended == null) ? config.conservativeDefault : recommended;
  return clamp(Math.max(piso, rec), 0, 3);
}

// Um estágio upfront roda se o nível atinge o mínimo configurado; estágio sem limiar roda sempre.
export function stageEnabled(level, stage, config) {
  const min = config.stageMinLevel[stage];
  return min == null ? true : level >= min;
}

export function describeLevel(level, config) {
  return config.levels[String(level)] || `nível ${level}`;
}

// ---- CLI (Art. II): node dial.js --class <classe> [--recommended <0-3>] [--config <path>] [--json] ----
function main() {
  const argv = process.argv.slice(2);
  const get = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const taskClass = get('--class');
  if (!taskClass) { console.error('uso: node dial.js --class <classe> [--recommended <0-3>] [--config <path>] [--json]'); process.exit(2); }
  const config = loadDialConfig(get('--config'));
  const recommended = get('--recommended') != null ? Number(get('--recommended')) : null;
  const level = selectLevel({ taskClass, recommended, config });
  const out = {
    taskClass, recommended, level, description: describeLevel(level, config),
    stages: Object.fromEntries(['planner', 'nfr', 'contract', 'researcher'].map((s) => [s, stageEnabled(level, s, config)])),
  };
  console.log(argv.includes('--json') ? JSON.stringify(out, null, 2)
    : `classe=${taskClass} recomendado=${recommended == null ? '(conservador)' : recommended} -> nível ${level} (${out.description})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

- [ ] **Step 5: Run — expect PASS** (9 tests). Smoke the CLI:
`node dial.js --class prod --recommended 0` → `... -> nível 3 (Pipeline + Especialistas + NFR upfront)`
`node dial.js --class config --recommended 0 --json` → JSON com `"level": 0` e `stages.planner:false`.

- [ ] **Step 6: Commit**
```bash
git add template/config/dial.json template/tools/dial.js template/tools/tests/dial.test.mjs
git commit -m "feat(dial): selectLevel/stageEnabled + config dial.json (Fase 2)"
```

---

## Task 2: Wire o Dial no bsd.js (computa nível, honra estágios, registra nível real)

**Files:** Modify `template/tools/bsd.js`, `template/tools/tests/spec-tasks.test.mjs`

Contexto verificado: `bsd.js` já importa `{ buildRunRecord, classifyTaskClass, appendRunRecord }` de `./aferidor-log.js`. A pipeline por unit chama Planner/NFR/Contract/Researcher com o padrão `() => dryRun ? DRY.x() : runX(...)`. O bloco `RUN_RECORD` (Fase 1) usa `level: 0`. `specMd` está no escopo da função `executeFeature`.

- [ ] **Step 1: Add import** logo após a linha `import { evaluateGates } from './gates.js';`:
```js
import { loadDialConfig, selectLevel, stageEnabled } from './dial.js';
```

- [ ] **Step 2: Compute o nível upfront.** Dentro de `executeFeature`, LOGO ANTES do laço `for (const unit of units) {`, insira:
```js
  // --- Dial de Rigor (Fase 2): classe upfront (do spec) + nível ---
  let dialConfig = null, taskLevel = 3, upfrontClass = 'config';
  try {
    dialConfig = loadDialConfig();
    const specPaths = (String(specMd || '').match(/[\w./-]+\.(?:ts|tsx|cs|sql|ya?ml|prisma)/g) || []);
    upfrontClass = classifyTaskClass(specPaths.length ? specPaths : [feature]);
    taskLevel = selectLevel({ taskClass: upfrontClass, recommended: null, config: dialConfig }); // Fase 3 injeta 'recommended'
    console.log(`  ${COLORS.dim}Dial: classe=${upfrontClass} → nível ${taskLevel}${COLORS.reset}`);
  } catch (e) { /* sem config: mantém nível 3 (conservador) */ }
  const stageOn = (s) => !dialConfig || stageEnabled(taskLevel, s, dialConfig);
```

- [ ] **Step 3: Honrar o nível** — troque a condição `dryRun ?` por `(dryRun || !stageOn('<estágio>')) ?` nos QUATRO estágios upfront:
  - Planner: `() => (dryRun || !stageOn('planner')) ? DRY.planner() : runPlanner({ feature: unitLabel, ctx, cfg, spec: specMd })`
  - NFR: `() => (dryRun || !stageOn('nfr')) ? DRY.nfrPlanner() : runNfrPlanner({ feature: unitLabel, plan, ctx, cfg, spec: specMd })`
  - Contrato: `() => (dryRun || !stageOn('contract')) ? DRY.contract() : runContract({ feature: unitLabel, plan, ctx, cfg, spec: specMd })`
  - Researcher: `() => (dryRun || !stageOn('researcher')) ? DRY.researcher() : runResearcher({ feature: unitLabel, plan, ctx, cfg, spec: specMd })`
  (Mantenha os args originais de cada `runX(...)` exatamente como estão — só troque a condição do ternário.)

- [ ] **Step 4: Registrar o nível real** — no bloco `RUN_RECORD` (Fase 1), troque `level: 0,` por `level: taskLevel,`.

- [ ] **Step 5: Add `dial.js` ao subprocess de teste.** Em `template/tools/tests/spec-tasks.test.mjs`, nas DUAS listas de cópia, acrescente `'dial.js'`:
`['bsd.js', 'agents.js', 'llm.js', 'aferidor-log.js', 'gates.js', 'verify.js', 'dial.js']`
(dial.json não é copiado; o `loadDialConfig` no bsd.js está em try/catch → nível 3 no sandbox, comportamento inalterado.)

- [ ] **Step 6: Verify.** `cd template/tools && node --test tests/*.test.mjs` — todos verdes, exceto NENHUM novo fail (mesma baseline). E boot: `cd <worktree-root> && node template/tools/bsd.js 2>&1 | head -4` sem stack trace.

- [ ] **Step 7: Commit**
```bash
git add template/tools/bsd.js template/tools/tests/spec-tasks.test.mjs
git commit -m "feat(bsd): computa/honra nível do Dial e registra nível real (Fase 2)"
```

---

## Task 3: Registrar dial, doc, bump 1.12.0, gate verde

**Files:** Modify `template/registry.json`, `REGISTRY.md`, `VERSION`, `template/harness.yaml`; Create `template/tools/dial.md`

- [ ] **Step 1: registry.json** — bump `harnessVersion` → `1.12.0`; append componente:
```json
{
  "id": "dial",
  "name": "Dial de Rigor (V-JP)",
  "tier": "core",
  "priority": 16,
  "required": true,
  "source": { "type": "bundled", "author": "João Pedro (V-JP)" },
  "dest": ".harness/tools/dial.js",
  "version": "1.12.0",
  "install": "Incluído no harness (template/tools/dial.js).",
  "verify": { "type": "file", "path": "tools/dial.js" }
}
```

- [ ] **Step 2:** `VERSION` → `1.12.0`; `template/harness.yaml` `version:` → `"1.12.0"`.

- [ ] **Step 3: Create** `template/tools/dial.md`:
```markdown
# Dial de Rigor (V-JP)

Escolhe QUANTO rigor rodar. `nível = clamp(max(piso_da_classe, recomendado), 0, 3)`.
MAIOR = MAIS rigor. O **piso** por classe é o mínimo de segurança e nunca é rebaixado
(ex.: `prod`/`migration` = 3). `recomendado` vem da confiança medida (Aferidor, Fase 3);
sem confiança, usa `conservativeDefault` (3, rigor máximo). Config: `.harness/config/dial.json`.

| Nível | Rigor |
|---|---|
| 0 | Só Portões (modelo faz o loop) |
| 1 | Leve (plano curto + portões) |
| 2 | Pipeline (planner→researcher→executor→reviewer) |
| 3 | Pipeline + Especialistas + NFR upfront |

O `bsd.js` pula estágios upfront abaixo do limiar (`stageMinLevel`), usando o stub DRY.
Uso: `node .harness/tools/dial.js --class <classe> [--recommended <0-3>] [--json]`.
Ver spec: `specs/metodo-duravel-portoes-dial/spec.md` §3.3.
```

- [ ] **Step 4:** `REGISTRY.md` — add 1 linha (Dial de Rigor, V-JP, 1.12.0) no mesmo formato das demais + nota de changelog `**v1.12.0:** Dial de Rigor (Fase 2)`.

- [ ] **Step 5: Gate verde** — `cd template/tools && npm run check` → todos os testes verdes + `Determinismo OK` (agora contando `dial`). Cole o tail.

- [ ] **Step 6: Commit**
```bash
git add template/registry.json template/REGISTRY.md template/tools/dial.md VERSION template/harness.yaml
git commit -m "chore(registry): registra dial; doc; bump 1.12.0 (Fase 2)"
```

---

## Self-Review
- Dial computa nível por classe×confiança, piso nunca rebaixado (Task 1). ✅ (spec §3.3)
- `recomendado` plugável, default conservador (Fase 3 injeta). ✅
- bsd.js honra o nível (pula estágios via DRY) e registra nível real. ✅ Default 3 → sem mudança de comportamento até Fase 3.
- Art. II (CLI), III (TDD), VI (SemVer 1.12.0), VII (sem deps). ✅
- Fora de escopo: analisador/promoção (Fase 3), sombra (Fase 4), adaptadores (Fase 5). ✅
