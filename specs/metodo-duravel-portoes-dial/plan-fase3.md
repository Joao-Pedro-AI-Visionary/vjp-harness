# Método Durável — Fase 3: Aferidor Analisador (promoção/demoção) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** O analisador que responde "o modelo melhorou?" — lê o `.bsd/history.jsonl`, janela por `task_class × model_id`, e produz um **nível recomendado** que alimenta o Dial (`selectLevel({recommended})`). **Demove** (aperta) na regressão (`first_try_pass < 80%`); **promove** (afrouxa) na evidência forte (`≥ 90%` + zero intervenção humana); **cold start / model_id novo → conservador**. Já usa a **sombra** (Fase 4) quando `shadow_first_try_pass` existir; sem sombra, promove pelo sucesso no nível atual.

**Architecture:** Novo módulo puro `template/tools/aferidor-analise.js` (readRecords + recommendLevel + CLI). Thresholds em `template/config/dial.json`. Wiring no `bsd.js`: troca o `recommended: null` da Fase 2 pela recomendação medida. Como o `history.jsonl` começa sem `N` RUN_RECORDs por classe, o cold start devolve o conservador (3) — comportamento inalterado até acumular janela.

**Tech Stack:** Node ESM, `node --test`. Sem deps novas.

---

## File Structure
| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `template/tools/aferidor-analise.js` | Cria | `readRecords`, `recommendLevel` (puro) + CLI |
| `template/tools/tests/aferidor-analise.test.mjs` | Cria | TDD |
| `template/config/dial.json` | Modifica | + `demoteThreshold`, `promoteThreshold`, `minShadow` |
| `template/tools/bsd.js` | Modifica | usa `recommendLevel` no lugar de `recommended: null` |
| `template/tools/tests/spec-tasks.test.mjs` | Modifica | + `aferidor-analise.js` na lista de cópia |
| `registry.json`,`REGISTRY.md`,`VERSION`,`harness.yaml`,`aferidor-analise.md` | Modifica/Cria | registra; bump 1.13.0 |

---

## Task 1: dial.json thresholds + aferidor-analise.js (puro)

- [ ] **Step 1:** Em `template/config/dial.json`, adicione 3 chaves no objeto raiz (após `"windowSize": 20,`):
```json
  "demoteThreshold": 0.80,
  "promoteThreshold": 0.90,
  "minShadow": 5,
```

- [ ] **Step 2:** Test `template/tools/tests/aferidor-analise.test.mjs`:
```js
// aferidor-analise.js: recomendação de nível por janela (Fase 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { readRecords, recommendLevel } from '../aferidor-analise.js';

const cfg = { windowSize: 5, conservativeDefault: 3, demoteThreshold: 0.80, promoteThreshold: 0.90, minShadow: 5,
  pisos: { config: 0 } };

function rec(over = {}) {
  return { event: 'RUN_RECORD', model_id: 'm1', task_class: 'frontend', level: 2,
    first_try_pass: true, shadow_first_try_pass: null, human_intervened: false, ...over };
}

test('cold start (< janela) -> conservador', () => {
  const recs = [rec(), rec(), rec()]; // 3 < 5
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: cfg }), 3);
});

test('model_id novo -> conservador (reset): só vê os registros DELE', () => {
  const old = Array.from({ length: 5 }, () => rec({ model_id: 'm0', first_try_pass: true, level: 2 }));
  const neu = [rec({ model_id: 'm1' })]; // só 1 do modelo novo
  assert.equal(recommendLevel({ records: [...old, ...neu], taskClass: 'frontend', modelId: 'm1', config: cfg }), 3);
});

test('regressão (first_try < 80%) -> demove (aperta baseline+1)', () => {
  // baseline = level do último = 2; taxa 2/5 = 40% < 80%
  const recs = [rec({ first_try_pass: false }), rec({ first_try_pass: false }), rec({ first_try_pass: false }),
    rec({ first_try_pass: true }), rec({ first_try_pass: true, level: 2 })];
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: cfg }), 3); // 2+1
});

test('evidência forte (≥90% first_try, 0 intervenção, sem sombra) -> promove (baseline-1)', () => {
  const recs = Array.from({ length: 5 }, () => rec({ first_try_pass: true, level: 2, human_intervened: false }));
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: cfg }), 1); // 2-1
});

test('intervenção humana bloqueia promoção mesmo com sucesso', () => {
  const recs = Array.from({ length: 5 }, (_, i) => rec({ first_try_pass: true, level: 2, human_intervened: i === 0 }));
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: cfg }), 2); // mantém
});

test('zona morna (80–90%) -> mantém baseline', () => {
  // 4/5 = 80% -> nem demove (>=80) nem promove (<90)
  const recs = [rec({ first_try_pass: false }), rec(), rec(), rec(), rec({ level: 2 })];
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: cfg }), 2);
});

test('sombra forte (Fase 4) promove mesmo com nível atual só ok', () => {
  const c2 = { ...cfg, minShadow: 3 };
  // first_try 100% e shadow 100% em >=3 -> promove
  const recs = Array.from({ length: 5 }, () => rec({ first_try_pass: true, level: 2, shadow_first_try_pass: true }));
  assert.equal(recommendLevel({ records: recs, taskClass: 'frontend', modelId: 'm1', config: c2 }), 1);
});

test('readRecords ignora não-RUN_RECORD e linhas corrompidas', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-an-'));
  const h = path.join(d, 'history.jsonl');
  fs.writeFileSync(h, [
    JSON.stringify({ event: 'START_FEATURE' }),
    '{lixo corrompido',
    JSON.stringify({ event: 'RUN_RECORD', task_class: 'db' }),
  ].join('\n') + '\n');
  const r = readRecords(h);
  assert.equal(r.length, 1);
  assert.equal(r[0].task_class, 'db');
  assert.equal(readRecords(path.join(d, 'nao-existe.jsonl')).length, 0); // arquivo ausente -> []
  fs.rmSync(d, { recursive: true, force: true });
});
```

- [ ] **Step 3:** Run — expect FAIL (module missing).

- [ ] **Step 4:** Implement `template/tools/aferidor-analise.js`:
```js
#!/usr/bin/env node
/**
 * V-JP Harness: Aferidor de Confiança — analisador (Fase 3).
 * Lê history.jsonl, janela por task_class × model_id, e recomenda um nível pro Dial.
 * Demove (aperta) na regressão; promove (afrouxa) na evidência forte + zero intervenção.
 * Cold start / model_id novo -> conservador. Usa a sombra (Fase 4) quando disponível. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Lê os registros RUN_RECORD do history.jsonl (append-only). Arquivo ausente -> []. Linha corrompida -> ignora.
export function readRecords(historyPath) {
  let raw;
  try { raw = fs.readFileSync(historyPath, 'utf8'); } catch { return []; }
  const out = [];
  for (const line of raw.split('\n')) {
    const s = line.trim(); if (!s) continue;
    try { const o = JSON.parse(s); if (o && o.event === 'RUN_RECORD') out.push(o); } catch { /* ignora */ }
  }
  return out;
}

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// Recomenda um nível de rigor p/ (task_class × model_id). PURA. Maior = mais rigor.
// O Dial aplica o piso depois (max(piso, recomendado)); aqui podemos recomendar abaixo do piso.
export function recommendLevel({ records, taskClass, modelId = null, config }) {
  const N = config.windowSize ?? 20;
  const rel = records.filter((r) => r.task_class === taskClass && (!modelId || r.model_id === modelId));
  if (rel.length < N) return config.conservativeDefault;                       // cold start / model novo
  const win = rel.slice(-N);
  const last = win[win.length - 1];
  const baseline = Number.isInteger(last.level) ? last.level : config.conservativeDefault;
  const firstTryRate = mean(win.map((r) => (r.first_try_pass ? 1 : 0)));
  const humanIntervened = win.some((r) => r.human_intervened);
  const demote = config.demoteThreshold ?? 0.80;
  const promote = config.promoteThreshold ?? 0.90;
  const minShadow = config.minShadow ?? 5;

  if (firstTryRate < demote) return clamp(baseline + 1, 0, 3);                  // regressão -> aperta

  const shadows = win.filter((r) => r.shadow_first_try_pass != null);
  const strong = shadows.length >= minShadow
    ? mean(shadows.map((r) => (r.shadow_first_try_pass ? 1 : 0))) >= promote    // Fase 4: baseado na sombra
    : firstTryRate >= promote;                                                  // Fase 3: sucesso no nível atual
  if (strong && !humanIntervened) return clamp(baseline - 1, 0, 3);            // evidência forte -> afrouxa
  return baseline;                                                              // zona morna -> mantém
}

// ---- CLI (Art. II): node aferidor-analise.js --class <c> [--model <id>] [--history <path>] [--config <path>] [--json] ----
function main() {
  const argv = process.argv.slice(2);
  const get = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const taskClass = get('--class');
  if (!taskClass) { console.error('uso: node aferidor-analise.js --class <c> [--model <id>] [--history <path>] [--config <path>] [--json]'); process.exit(2); }
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const configPath = get('--config') || path.resolve(dir, '../config/dial.json');
  const historyPath = get('--history') || path.resolve(dir, '../../.bsd/history.jsonl');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const records = readRecords(historyPath);
  const modelId = get('--model');
  const recommended = recommendLevel({ records, taskClass, modelId, config });
  const n = records.filter((r) => r.task_class === taskClass && (!modelId || r.model_id === modelId)).length;
  const out = { taskClass, modelId: modelId || '(qualquer)', samples: n, windowSize: config.windowSize, recommended };
  console.log(argv.includes('--json') ? JSON.stringify(out, null, 2)
    : `classe=${taskClass} modelo=${out.modelId} amostras=${n} -> recomendado nível ${recommended}${n < (config.windowSize ?? 20) ? ' (cold start/conservador)' : ''}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

- [ ] **Step 5:** Run — expect PASS (8). Smoke: `node aferidor-analise.js --class frontend` → deve dizer cold start/conservador nível 3 (sem RUN_RECORDs reais ainda). Report.

- [ ] **Step 6:** Commit:
```bash
git add template/config/dial.json template/tools/aferidor-analise.js template/tools/tests/aferidor-analise.test.mjs
git commit -m "feat(aferidor): analisador recommendLevel (janela, promoção/demoção) — Fase 3"
```

---

## Task 2: Wire a recomendação no bsd.js

Contexto: `bsd.js` (Fase 2) tem `taskLevel = selectLevel({ taskClass: upfrontClass, recommended: null, config: dialConfig });` dentro do bloco `--- Dial de Rigor (Fase 2)`.

- [ ] **Step 1:** Add import após `import { loadDialConfig, selectLevel, stageEnabled } from './dial.js';`:
```js
import { readRecords, recommendLevel } from './aferidor-analise.js';
```

- [ ] **Step 2:** No bloco do Dial, troque a linha:
```js
    taskLevel = selectLevel({ taskClass: upfrontClass, recommended: null, config: dialConfig }); // Fase 3 injeta 'recommended'
```
por:
```js
    const recs = readRecords(HISTORY_FILE);
    const recommended = recommendLevel({ records: recs, taskClass: upfrontClass, modelId: process.env.VJP_MODEL_ID || 'unknown', config: dialConfig });
    taskLevel = selectLevel({ taskClass: upfrontClass, recommended, config: dialConfig });
```
(`HISTORY_FILE` já está no escopo do módulo. Tudo dentro do try/catch existente do Dial — se algo falhar, cai em nível 3.)

- [ ] **Step 3:** `template/tools/tests/spec-tasks.test.mjs` — nas DUAS listas de cópia, adicione `'aferidor-analise.js'`:
`[..., 'verify.js', 'dial.js', 'aferidor-analise.js']`

- [ ] **Step 4:** Verify — `cd template/tools && node --test tests/*.test.mjs` (sem novos fails) + boot `node ../../template/tools/bsd.js` — na verdade rode `cd <worktree-root> && node template/tools/bsd.js 2>&1 | head -4` sem stack trace.

- [ ] **Step 5:** Commit:
```bash
git add template/tools/bsd.js template/tools/tests/spec-tasks.test.mjs
git commit -m "feat(bsd): Dial usa a confiança medida do Aferidor (Fase 3)"
```

---

## Task 3: Registrar, doc, bump 1.13.0

- [ ] **Step 1:** `registry.json`: `harnessVersion` → `1.13.0`; append componente:
```json
{
  "id": "aferidor-analise",
  "name": "Aferidor de Confiança — Analisador (V-JP)",
  "tier": "core",
  "priority": 17,
  "required": true,
  "source": { "type": "bundled", "author": "João Pedro (V-JP)" },
  "dest": ".harness/tools/aferidor-analise.js",
  "version": "1.13.0",
  "install": "Incluído no harness (template/tools/aferidor-analise.js).",
  "verify": { "type": "file", "path": "tools/aferidor-analise.js" }
}
```
- [ ] **Step 2:** `VERSION` → `1.13.0`; `harness.yaml` `version:` → `"1.13.0"`.
- [ ] **Step 3:** Create `template/tools/aferidor-analise.md`:
```markdown
# Aferidor de Confiança — Analisador (V-JP)

Responde "o modelo melhorou?" **medindo**, não perguntando. Lê `.bsd/history.jsonl`, janela
de `windowSize` por `task_class × model_id`, e recomenda um nível pro Dial:
- **Demove (aperta)** se `first_try_pass < demoteThreshold` (regressão).
- **Promove (afrouxa)** se evidência forte (`≥ promoteThreshold`) e **zero** intervenção humana.
- **Cold start / model_id novo** → conservador (sem evidência, não afrouxa).
- Usa a **sombra** (Fase 4, `shadow_first_try_pass`) quando há `≥ minShadow` amostras; senão, o sucesso no nível atual.

O Dial aplica o **piso** por cima (`max(piso, recomendado)`) — a recomendação nunca fura a segurança.
Config em `.harness/config/dial.json`. Uso: `node .harness/tools/aferidor-analise.js --class <c> [--model <id>] [--json]`.
Ver spec §3.4.
```
- [ ] **Step 4:** `REGISTRY.md`: 1 linha (Aferidor — Analisador, V-JP, 1.13.0) + changelog `**v1.13.0:** Aferidor Analisador (Fase 3)`.
- [ ] **Step 5:** `cd template/tools && npm run check` — verde + Determinismo OK (conta `aferidor-analise`). Cole o tail.
- [ ] **Step 6:** Commit:
```bash
git add template/registry.json template/REGISTRY.md template/tools/aferidor-analise.md VERSION template/harness.yaml
git commit -m "chore(registry): registra aferidor-analise; doc; bump 1.13.0 (Fase 3)"
```

---

## Self-Review
- Analisador lê janela por classe×modelo, promove/demove, cold start/modelo-novo conservador (Task 1). ✅ (spec §3.4)
- Sombra usada quando presente (forward-compat Fase 4). ✅
- Dial passa a usar confiança medida (Task 2); cold start mantém nível 3 → sem mudança até acumular janela. ✅
- Art. II/III/VI/VII. ✅ Fora de escopo: probe sombra que POPULA shadow_* (Fase 4), adaptadores (Fase 5). ✅
