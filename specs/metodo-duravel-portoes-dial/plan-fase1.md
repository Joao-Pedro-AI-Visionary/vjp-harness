# Método Durável — Fase 1 (MVP): Portões + Camada de Dados do Aferidor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a fundação verificável do método durável: uma "definição de pronto" consolidada em portões determinísticos (incluindo o novo gate `saida-aberta` que cobre o Risco C de lock-in) e a camada de dados que grava o registro de cada run no formato do Aferidor (schema §3.4 da spec).

**Architecture:** Dois módulos ESM puros novos em `template/tools/` — `gates.js` (portões) e `aferidor-log.js` (registro de run) — seguindo o padrão já usado em `verify.js` (funções puras exportadas + CLI guardada). `gates.js` reusa `evaluateRegistry` de `verify.js` para o portão de determinismo. `bsd.js` passa a emitir um evento `RUN_RECORD` no fim de cada feature. Nenhuma ferramenta de terceiro é tocada.

**Tech Stack:** Node ≥ 18 (ESM, `type: module`), test runner nativo `node --test` + `node:assert/strict`. Sem dependências novas (Art. VII YAGNI).

**Decisão de MVP (honesta):** dos 7 portões da spec §3.2, a Fase 1 **força** os 4 verificáveis por arquivo/registro (`spec-presente`, `adr-presente`, `saida-aberta`, `determinismo`) e **reporta como `unknown` (não-bloqueante)** os 3 que dependem de sinal externo ainda não fiado (`prova-viva`, `contrato-bate`, `owasp`). `unknown ≠ green` (spec §5): visível, mas não bloqueia nem polui a medição. As fases seguintes fiam os sinais externos.

---

## File Structure

| Arquivo | Cria/Modifica | Responsabilidade |
|---|---|---|
| `template/tools/aferidor-log.js` | **Cria** | Classificação de task_class (pura), construção do registro de run (pura), append + CLI |
| `template/tools/gates.js` | **Cria** | Portões individuais (puros) + consolidação `evaluateGates` + CLI |
| `template/tools/tests/aferidor-log.test.mjs` | **Cria** | Testes de `classifyTaskClass`, `buildRunRecord`, `appendRunRecord` |
| `template/tools/tests/gates.test.mjs` | **Cria** | Testes dos portões + `evaluateGates` |
| `template/tools/bsd.js` | **Modifica** (perto de `END_FEATURE`, ~linha 255) | Emitir `RUN_RECORD` ao finalizar a feature |
| `template/registry.json` | **Modifica** (array `components`) | Registrar `gates.js` e `aferidor-log.js` como componentes core verificáveis |
| `template/REGISTRY.md` | **Modifica** | Espelho legível dos 2 componentes novos |
| `template/tools/gates.md` | **Cria** | Doc do papel "Portões" |
| `VERSION` + `template/harness.yaml` | **Modifica** | Bump para 1.11.0 (feature nova → MINOR, Art. VI SemVer) |

---

## Task 1: `classifyTaskClass` — classificação determinística da task

**Files:**
- Create: `template/tools/aferidor-log.js`
- Test: `template/tools/tests/aferidor-log.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `template/tools/tests/aferidor-log.test.mjs`:

```js
// aferidor-log.js: camada de dados do Aferidor de Confiança (Fase 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTaskClass } from '../aferidor-log.js';

test('migração vence tudo (precedência do mais crítico)', () => {
  assert.equal(classifyTaskClass(['prisma/migrations/001/migration.sql']), 'migration');
});

test('caminho de deploy/prod vira prod', () => {
  assert.equal(classifyTaskClass(['infra/prod/deploy.yaml']), 'prod');
});

test('repository/entity/sql viram db', () => {
  assert.equal(classifyTaskClass(['src/user.repository.ts']), 'db');
});

test('.tsx / web / frontend viram frontend', () => {
  assert.equal(classifyTaskClass(['web/components/Card.tsx']), 'frontend');
});

test('.ts de backend/api vira backend', () => {
  assert.equal(classifyTaskClass(['backend/api/user.service.ts']), 'backend');
});

test('sem match conhecido cai em config', () => {
  assert.equal(classifyTaskClass(['README.md']), 'config');
  assert.equal(classifyTaskClass([]), 'config');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd template/tools && node --test tests/aferidor-log.test.mjs`
Expected: FAIL — `Cannot find module '../aferidor-log.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `template/tools/aferidor-log.js`:

```js
#!/usr/bin/env node
/**
 * V-JP Harness: Aferidor de Confiança — camada de dados (Fase 1).
 * Constrói e persiste o registro de run (schema §3.4 da spec metodo-duravel-portoes-dial).
 * Funções PURAS exportadas p/ teste; CLI só quando invocado direto. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Classifica a task pela lista de caminhos tocados. Determinístico; precedência do mais
// crítico ao menos crítico (a primeira regra que casar vence).
export function classifyTaskClass(paths = []) {
  const p = paths.join('\n').toLowerCase();
  if (/migrations?\/|\.migration\.|migration\.sql/.test(p)) return 'migration';
  if (/(^|\/)prod(\/|\b)|production|deploy/.test(p)) return 'prod';
  if (/\.repository\.ts|\.entity\.ts|prisma\/schema|\.sql(\b|$)/.test(p)) return 'db';
  if (/\.tsx(\b|$)|\/web\/|\/frontend\/|\/mobile\//.test(p)) return 'frontend';
  if (/\.ts(\b|$)|\.cs(\b|$)|\/api\/|\/backend\//.test(p)) return 'backend';
  return 'config';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd template/tools && node --test tests/aferidor-log.test.mjs`
Expected: PASS (6 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add template/tools/aferidor-log.js template/tools/tests/aferidor-log.test.mjs
git commit -m "feat(aferidor): classifyTaskClass determinístico por caminho"
```

---

## Task 2: `buildRunRecord` — construção do registro de run (schema §3.4)

**Files:**
- Modify: `template/tools/aferidor-log.js`
- Test: `template/tools/tests/aferidor-log.test.mjs`

- [ ] **Step 1: Write the failing test** (append ao mesmo arquivo de teste)

Adicione ao final de `template/tools/tests/aferidor-log.test.mjs`:

```js
import { buildRunRecord } from '../aferidor-log.js';

const baseInput = {
  now: '2026-07-11T14:00:00.000Z',
  modelId: 'claude-opus-4-8',
  taskClass: 'frontend',
  level: 0,
  gates: { 'spec-presente': 'green', 'saida-aberta': 'green' },
};

test('first_try_pass=true quando retries=0 e todos os portões green', () => {
  const r = buildRunRecord({ ...baseInput, retries: 0 });
  assert.equal(r.first_try_pass, true);
  assert.equal(r.event, 'RUN_RECORD');
  assert.equal(r.model_id, 'claude-opus-4-8');
  assert.equal(r.task_class, 'frontend');
  assert.equal(r.ts, '2026-07-11T14:00:00.000Z');
});

test('first_try_pass=false com retries>0 mesmo tudo green', () => {
  const r = buildRunRecord({ ...baseInput, retries: 1 });
  assert.equal(r.first_try_pass, false);
});

test('first_try_pass=false se algum portão não é green (unknown ≠ green)', () => {
  const r = buildRunRecord({ ...baseInput, gates: { 'spec-presente': 'green', 'prova-viva': 'unknown' } });
  assert.equal(r.first_try_pass, false);
});

test('defaults: shadow_level null, human_intervened false, tokens null', () => {
  const r = buildRunRecord(baseInput);
  assert.equal(r.shadow_level, null);
  assert.equal(r.human_intervened, false);
  assert.equal(r.tokens, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd template/tools && node --test tests/aferidor-log.test.mjs`
Expected: FAIL — `buildRunRecord is not a function` / export ausente.

- [ ] **Step 3: Write minimal implementation** (append em `aferidor-log.js`, antes do bloco CLI)

```js
// Constrói o registro de run (schema §3.4). PURA — recebe o clock (`now`) e os dados; não lê nada.
// first_try_pass = passou TODOS os portões sem retry. unknown/red ≠ green.
export function buildRunRecord(input) {
  const {
    now, modelId, taskClass, level,
    shadowLevel = null, gates = {}, retries = 0,
    humanIntervened = false, shadowFirstTryPass = null, tokens = null,
  } = input;
  const values = Object.values(gates);
  const firstTryPass = retries === 0 && values.length > 0 && values.every((s) => s === 'green');
  return {
    ts: now,
    event: 'RUN_RECORD',
    model_id: modelId,
    task_class: taskClass,
    level,
    shadow_level: shadowLevel,
    first_try_pass: firstTryPass,
    shadow_first_try_pass: shadowFirstTryPass,
    retries,
    human_intervened: humanIntervened,
    gates,
    tokens,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd template/tools && node --test tests/aferidor-log.test.mjs`
Expected: PASS (10 testes verdes no total).

- [ ] **Step 5: Commit**

```bash
git add template/tools/aferidor-log.js template/tools/tests/aferidor-log.test.mjs
git commit -m "feat(aferidor): buildRunRecord com schema §3.4 + derivação first_try_pass"
```

---

## Task 3: `appendRunRecord` + CLI (Art. II — CLI Mandate)

**Files:**
- Modify: `template/tools/aferidor-log.js`
- Test: `template/tools/tests/aferidor-log.test.mjs`

- [ ] **Step 1: Write the failing test** (append)

```js
import { appendRunRecord } from '../aferidor-log.js';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

test('appendRunRecord grava uma linha JSONL e retorna o record', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-aferidor-'));
  const hist = path.join(dir, 'history.jsonl');
  const rec = { event: 'RUN_RECORD', model_id: 'x', first_try_pass: true };
  const out = appendRunRecord(hist, rec);
  const lines = fs.readFileSync(hist, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), rec);
  assert.deepEqual(out, rec);
  fs.rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd template/tools && node --test tests/aferidor-log.test.mjs`
Expected: FAIL — `appendRunRecord is not a function`.

- [ ] **Step 3: Write minimal implementation** (append em `aferidor-log.js`)

```js
// Persiste o registro (append-only JSONL, crash-safe). Retorna o próprio record.
export function appendRunRecord(historyPath, record) {
  fs.appendFileSync(historyPath, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

// ---- CLI (Art. II): node aferidor-log.js emit --model <id> --class <c> --level <n> [--history <path>] ----
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { out[argv[i].slice(2)] = argv[i + 1]; i++; }
  }
  return out;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd !== 'emit') {
    console.error('uso: node aferidor-log.js emit --model <id> --class <c> --level <n> [--history <path>]');
    process.exit(2);
  }
  const a = parseArgs(rest);
  const record = buildRunRecord({
    now: new Date().toISOString(),
    modelId: a.model || 'unknown',
    taskClass: a.class || 'config',
    level: a.level != null ? Number(a.level) : 0,
    gates: a.gates ? JSON.parse(a.gates) : {},
  });
  const histPath = a.history || path.resolve(__dirnameLocal(), '../../.bsd/history.jsonl');
  appendRunRecord(histPath, record);
  console.log(JSON.stringify(record));
}

function __dirnameLocal() { return path.dirname(fileURLToPath(import.meta.url)); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

- [ ] **Step 4: Run test to verify it passes; smoke-test a CLI**

Run: `cd template/tools && node --test tests/aferidor-log.test.mjs`
Expected: PASS (11 testes).

Run (smoke): `cd template/tools && node aferidor-log.js emit --model teste --class frontend --level 0 --history /tmp/vjp-smoke.jsonl && cat /tmp/vjp-smoke.jsonl`
Expected: imprime um JSON com `"event":"RUN_RECORD"`, `"model_id":"teste"`, `"first_try_pass":false` (gates vazio → não passa).

- [ ] **Step 5: Commit**

```bash
git add template/tools/aferidor-log.js template/tools/tests/aferidor-log.test.mjs
git commit -m "feat(aferidor): appendRunRecord + CLI emit (Art. II CLI mandate)"
```

---

## Task 4: Portões individuais (puros) em `gates.js`

**Files:**
- Create: `template/tools/gates.js`
- Test: `template/tools/tests/gates.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `template/tools/tests/gates.test.mjs`:

```js
// gates.js: "definição de pronto" consolidada (Fase 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { checkSpecPresent, checkAdrPresent, checkOpenOutputs, checkDeterminism } from '../gates.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-gates-')); }

test('checkSpecPresent: green se spec.md existe, red se não', () => {
  const d = tmp();
  assert.equal(checkSpecPresent(d), 'red');
  fs.writeFileSync(path.join(d, 'spec.md'), '# spec');
  assert.equal(checkSpecPresent(d), 'green');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkAdrPresent: green só se arquivo existe e não-vazio', () => {
  const d = tmp();
  const adr = path.join(d, 'decisions.md');
  assert.equal(checkAdrPresent(adr), 'red');
  fs.writeFileSync(adr, '');
  assert.equal(checkAdrPresent(adr), 'red');
  fs.writeFileSync(adr, '## D1');
  assert.equal(checkAdrPresent(adr), 'green');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkOpenOutputs: green só quando spec.md E decisions.md existem', () => {
  const d = tmp();
  const adr = path.join(d, 'decisions.md');
  assert.equal(checkOpenOutputs(d, adr), 'red');
  fs.writeFileSync(path.join(d, 'spec.md'), '# spec');
  assert.equal(checkOpenOutputs(d, adr), 'red');
  fs.writeFileSync(adr, '## D1');
  assert.equal(checkOpenOutputs(d, adr), 'green');
  fs.rmSync(d, { recursive: true, force: true });
});

test('checkDeterminism: green quando não há required em falha', () => {
  const okReg = { harnessVersion: '9.9.9', components: [
    { id: 'a', name: 'A', tier: 'core', priority: 1, required: true,
      verify: { type: 'command', cmd: 'node --version', expect: 'v' } },
  ] };
  assert.equal(checkDeterminism(okReg), 'green');
  const badReg = { harnessVersion: '9.9.9', components: [
    { id: 'b', name: 'B', tier: 'core', priority: 1, required: true,
      verify: { type: 'file', path: 'missing/x.xyz' } },
  ] };
  assert.equal(checkDeterminism(badReg), 'red');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd template/tools && node --test tests/gates.test.mjs`
Expected: FAIL — `Cannot find module '../gates.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `template/tools/gates.js`:

```js
#!/usr/bin/env node
/**
 * V-JP Harness: Portões — "definição de pronto" consolidada (Fase 1).
 * Cada portão retorna 'green' | 'red' | 'unknown'. unknown ≠ green (spec §5):
 * infra do portão indisponível NÃO marca pronto e NÃO polui a medição. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateRegistry } from './verify.js';

// Portão spec-presente: a feature tem spec.md?
export function checkSpecPresent(featureDir) {
  return fs.existsSync(path.join(featureDir, 'spec.md')) ? 'green' : 'red';
}

// Portão adr-presente: decisão registrada (arquivo existe e não-vazio).
export function checkAdrPresent(gbrainDecisionsPath) {
  try {
    return fs.statSync(gbrainDecisionsPath).size > 0 ? 'green' : 'red';
  } catch { return 'red'; }
}

// Portão saida-aberta (cobre Risco C): artefatos em formato aberto e próprio existem.
// MVP: spec.md da feature + decisions.md (ADR) do projeto.
export function checkOpenOutputs(featureDir, gbrainDecisionsPath) {
  const specOk = fs.existsSync(path.join(featureDir, 'spec.md'));
  const adrOk = fs.existsSync(gbrainDecisionsPath);
  return specOk && adrOk ? 'green' : 'red';
}

// Portão determinismo: reusa evaluateRegistry (nenhum required em drift/missing).
export function checkDeterminism(registry, opts = {}) {
  const { fail } = evaluateRegistry(registry, opts);
  return fail.length === 0 ? 'green' : 'red';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd template/tools && node --test tests/gates.test.mjs`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add template/tools/gates.js template/tools/tests/gates.test.mjs
git commit -m "feat(gates): portões puros spec/adr/saida-aberta/determinismo"
```

---

## Task 5: `evaluateGates` (consolidação) + CLI

**Files:**
- Modify: `template/tools/gates.js`
- Test: `template/tools/tests/gates.test.mjs`

- [ ] **Step 1: Write the failing test** (append)

```js
import { evaluateGates, ENFORCED_GATES } from '../gates.js';

test('evaluateGates: passed=true só com os 4 enforced green; externos ficam unknown', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-gates-eg-'));
  const adr = path.join(d, 'decisions.md');
  fs.writeFileSync(path.join(d, 'spec.md'), '# spec');
  fs.writeFileSync(adr, '## D1');
  const okReg = { harnessVersion: '9.9.9', components: [
    { id: 'a', name: 'A', tier: 'core', priority: 1, required: true,
      verify: { type: 'command', cmd: 'node --version', expect: 'v' } },
  ] };
  const { passed, gates } = evaluateGates({ featureDir: d, gbrainDecisionsPath: adr, registry: okReg });
  assert.equal(passed, true);
  assert.equal(gates['saida-aberta'], 'green');
  assert.equal(gates['prova-viva'], 'unknown');   // sinal externo não fiado na Fase 1
  fs.rmSync(d, { recursive: true, force: true });
});

test('evaluateGates: passed=false se um enforced (adr) falta, mesmo externos ignorados', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-gates-eg2-'));
  fs.writeFileSync(path.join(d, 'spec.md'), '# spec');
  const adr = path.join(d, 'decisions.md'); // não criado → red
  const { passed } = evaluateGates({ featureDir: d, gbrainDecisionsPath: adr, registry: { harnessVersion: '9', components: [] } });
  assert.equal(passed, false);
  fs.rmSync(d, { recursive: true, force: true });
});

test('ENFORCED_GATES tem exatamente os 4 verificáveis da Fase 1', () => {
  assert.deepEqual([...ENFORCED_GATES].sort(),
    ['adr-presente', 'determinismo', 'saida-aberta', 'spec-presente']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd template/tools && node --test tests/gates.test.mjs`
Expected: FAIL — `evaluateGates is not a function` / `ENFORCED_GATES` undefined.

- [ ] **Step 3: Write minimal implementation** (append em `gates.js`, antes de qualquer bloco CLI)

```js
// Portões forçados na Fase 1 (verificáveis por arquivo/registro). Os demais são reportados
// como 'unknown' (visível, não-bloqueante) até seu sinal externo ser fiado nas fases seguintes.
export const ENFORCED_GATES = ['spec-presente', 'adr-presente', 'saida-aberta', 'determinismo'];

// Consolida a "definição de pronto". ctx: { featureDir, gbrainDecisionsPath, registry?,
// registryOpts?, provaViva?, contrato?, owasp? }. Retorna { passed, gates, enforced }.
export function evaluateGates(ctx) {
  const gates = {
    'spec-presente': checkSpecPresent(ctx.featureDir),
    'adr-presente': checkAdrPresent(ctx.gbrainDecisionsPath),
    'saida-aberta': checkOpenOutputs(ctx.featureDir, ctx.gbrainDecisionsPath),
    'determinismo': ctx.registry ? checkDeterminism(ctx.registry, ctx.registryOpts || {}) : 'unknown',
    // sinais externos (fiados em fases futuras): 'unknown' se ausentes
    'prova-viva': ctx.provaViva || 'unknown',
    'contrato-bate': ctx.contrato || 'unknown',
    'owasp': ctx.owasp || 'unknown',
  };
  const passed = ENFORCED_GATES.every((k) => gates[k] === 'green');
  return { passed, gates, enforced: ENFORCED_GATES };
}

// ---- CLI (Art. II): node gates.js --feature <slug> [--root <dir>] [--json] ----
function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const featureIdx = argv.indexOf('--feature');
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx >= 0 ? path.resolve(argv[rootIdx + 1]) : path.resolve(__dirname_gates(), '../..');
  const feature = featureIdx >= 0 ? argv[featureIdx + 1] : null;
  if (!feature) { console.error('uso: node gates.js --feature <slug> [--root <dir>] [--json]'); process.exit(2); }

  const featureDir = fs.existsSync(path.join(root, 'specs', feature))
    ? path.join(root, 'specs', feature)
    : path.join(root, '.planning', 'phases', feature);
  const gbrainDecisionsPath = path.join(root, '.gbrain', 'decisions.md');
  const registryPath = path.join(root, '.harness', 'registry.json');
  const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : null;

  const result = evaluateGates({ featureDir, gbrainDecisionsPath, registry });
  if (asJson) { console.log(JSON.stringify(result, null, 2)); }
  else {
    for (const [k, v] of Object.entries(result.gates)) {
      const enforced = ENFORCED_GATES.includes(k) ? '[req]' : '[opt]';
      console.log(`  ${v === 'green' ? '✔' : v === 'red' ? '✗' : '?'} ${enforced} ${k}: ${v}`);
    }
    console.log(result.passed ? '\n✔ Definição de pronto: PASSOU' : '\n✗ Definição de pronto: BLOQUEADO');
  }
  process.exit(result.passed ? 0 : 1);
}

function __dirname_gates() { return path.dirname(fileURLToPath(import.meta.url)); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

> Nota ao implementador: `__dirname_gates()` é declarada como função (hoisted) e chamada dentro de `main()`; a chamada só ocorre em runtime, então a ordem de declaração no arquivo não quebra. Mantenha `main()` e `__dirname_gates()` no fim do arquivo.

- [ ] **Step 4: Run test to verify it passes; smoke-test a CLI contra esta própria feature**

Run: `cd template/tools && node --test tests/gates.test.mjs`
Expected: PASS (7 testes no total no arquivo).

Run (smoke, usando a spec real desta feature): `cd ~/.local/share/vjp-harness && node template/tools/gates.js --feature metodo-duravel-portoes-dial --root . `
Expected: lista os portões; `spec-presente ✔`; `adr-presente`/`saida-aberta` dependem de `.gbrain/decisions.md` existir e ser não-vazio no root.

- [ ] **Step 5: Commit**

```bash
git add template/tools/gates.js template/tools/tests/gates.test.mjs
git commit -m "feat(gates): evaluateGates consolidado + CLI (definição de pronto)"
```

---

## Task 6: Emitir `RUN_RECORD` ao finalizar a feature em `bsd.js`

**Files:**
- Modify: `template/tools/bsd.js` (import no topo; emissão perto do `END_FEATURE`)
- Test: `template/tools/tests/aferidor-log.test.mjs` (teste de integração da montagem do record)

Contexto do código existente (`bsd.js`): `import fs from 'fs/promises'`; constantes `ROOT_DIR`, `HISTORY_FILE`; função `async function logHistory(event, feature, task, status, details)`; e no fim de `executeFeature` há chamadas `await logHistory('END_FEATURE', feature, 'All', 'success', {...})` (~linhas 255 e a do caminho de sucesso final).

- [ ] **Step 1: Write the failing test** (append em `aferidor-log.test.mjs`)

```js
// Integração: dado gates + contexto, montamos e persistimos um RUN_RECORD íntegro.
test('fluxo emit: buildRunRecord + appendRunRecord produzem JSONL parseável e coerente', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-emit-'));
  const hist = path.join(dir, 'history.jsonl');
  const rec = buildRunRecord({
    now: '2026-07-11T15:00:00.000Z',
    modelId: process.env.VJP_MODEL_ID || 'unknown',
    taskClass: classifyTaskClass(['web/App.tsx']),
    level: 0,
    gates: { 'spec-presente': 'green', 'adr-presente': 'green', 'saida-aberta': 'green', 'determinismo': 'green' },
  });
  appendRunRecord(hist, rec);
  const parsed = JSON.parse(fs.readFileSync(hist, 'utf8').trim());
  assert.equal(parsed.event, 'RUN_RECORD');
  assert.equal(parsed.task_class, 'frontend');
  assert.equal(parsed.first_try_pass, true);
  fs.rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails, then passes with existing exports**

Run: `cd template/tools && node --test tests/aferidor-log.test.mjs`
Expected: este teste específico já PASSA (usa só exports das Tasks 1–3). Serve de contrato para o wiring do Step 3. Se falhar, corrija antes de tocar `bsd.js`.

- [ ] **Step 3: Wire em `bsd.js` — import no topo**

Adicione junto aos outros imports do topo de `template/tools/bsd.js`:

```js
import { buildRunRecord, classifyTaskClass, appendRunRecord } from './aferidor-log.js';
import { evaluateGates } from './gates.js';
import { execSync } from 'child_process';
```

(Se `child_process` já estiver importado, não duplique.)

- [ ] **Step 4: Wire em `bsd.js` — emitir o record no caminho de sucesso da feature**

Localize, dentro de `executeFeature`, a chamada de sucesso final (a que roda após o merge/última task, com `logHistory('END_FEATURE', feature, 'All', 'success', ...)`). **Imediatamente após** essa linha, insira:

```js
    // --- Aferidor de Confiança (Fase 1): emite RUN_RECORD após a feature concluir ---
    try {
      let changed = [];
      try {
        changed = execSync('git diff --name-only main...HEAD', { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'ignore'] })
          .toString().split('\n').filter(Boolean);
      } catch { /* sem git ou sem base: task_class cai em 'config' */ }

      const featureDir = specInfo && specInfo.dir ? specInfo.dir : path.join(ROOT_DIR, 'specs', feature);
      const gbrainDecisionsPath = path.join(ROOT_DIR, '.gbrain', 'decisions.md');
      const registryPath = path.join(ROOT_DIR, '.harness', 'registry.json');
      const fsSync = await import('fs');
      const registry = fsSync.existsSync(registryPath) ? JSON.parse(fsSync.readFileSync(registryPath, 'utf8')) : null;

      const { gates } = evaluateGates({ featureDir, gbrainDecisionsPath, registry });
      const record = buildRunRecord({
        now: new Date().toISOString(),
        modelId: process.env.VJP_MODEL_ID || 'unknown',
        taskClass: classifyTaskClass(changed),
        level: 0,               // Fase 2 introduz o Dial; por ora, nível fixo 0 no registro
        gates,
      });
      appendRunRecord(HISTORY_FILE, record);
    } catch (e) {
      await logHistory('RUN_RECORD_ERROR', feature, 'All', 'warn', { error: String(e && e.message || e) });
    }
```

> Nota: `specInfo` é o retorno de `findFeatureSpec(ROOT_DIR, feature)` já presente em `executeFeature`. Se `findFeatureSpec` não expõe `.dir`, use o fallback `path.join(ROOT_DIR, 'specs', feature)` que já está no código acima — não é necessário alterar `findFeatureSpec`.

- [ ] **Step 5: Run the full tool suite + a real dry-run smoke**

Run: `cd template/tools && node --test tests/*.test.mjs`
Expected: PASS (toda a suíte; nenhum teste existente quebrado).

Run (smoke — não deve lançar): `cd ~/.local/share/vjp-harness && node template/tools/bsd.js --help 2>&1 | head -5`
Expected: imprime ajuda sem stack trace (garante que os imports novos não quebram o boot do `bsd.js`).

- [ ] **Step 6: Commit**

```bash
git add template/tools/bsd.js template/tools/tests/aferidor-log.test.mjs
git commit -m "feat(bsd): emite RUN_RECORD do Aferidor ao concluir feature (Fase 1)"
```

---

## Task 7: Registrar componentes, doc, VERSION + `npm run check` verde

**Files:**
- Modify: `template/registry.json`, `template/REGISTRY.md`, `VERSION`, `template/harness.yaml`
- Create: `template/tools/gates.md`

- [ ] **Step 1: Adicionar os 2 componentes ao `registry.json`**

No array `components` de `template/registry.json`, adicione (ajuste `priority` para o próximo número livre — os existentes vão até ~13):

```json
{
  "id": "gates",
  "name": "Portões — Definição de Pronto (V-JP)",
  "tier": "core",
  "priority": 14,
  "required": true,
  "source": { "type": "bundled", "author": "João Pedro (V-JP)" },
  "dest": ".harness/tools/gates.js",
  "version": "1.11.0",
  "install": "Incluído no harness (template/tools/gates.js).",
  "verify": { "type": "file", "path": "tools/gates.js" }
},
{
  "id": "aferidor",
  "name": "Aferidor de Confiança — Camada de Dados (V-JP)",
  "tier": "core",
  "priority": 15,
  "required": true,
  "source": { "type": "bundled", "author": "João Pedro (V-JP)" },
  "dest": ".harness/tools/aferidor-log.js",
  "version": "1.11.0",
  "install": "Incluído no harness (template/tools/aferidor-log.js).",
  "verify": { "type": "file", "path": "tools/aferidor-log.js" }
}
```

- [ ] **Step 2: Verificar que o registry ainda parseia e o verify enxerga os novos**

Run: `cd ~/.local/share/vjp-harness && node -e "const r=require('./template/registry.json'); console.log('components:', r.components.length); console.log('ids:', r.components.map(c=>c.id).join(','))"`
Expected: imprime `components: 15` (era 13) e a lista inclui `gates,aferidor`.

- [ ] **Step 3: Criar `template/tools/gates.md` (doc do papel)**

```markdown
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
```

- [ ] **Step 4: Bump de versão (Art. VI — SemVer, feature nova = MINOR)**

Edite `VERSION` para `1.11.0`. Edite `template/harness.yaml` linha `version:` para `"1.11.0"`.

- [ ] **Step 5: Rodar o gate local completo do harness**

Run: `cd template/tools && npm run check`
Expected: todos os testes passam **e** `verify.js` sai 0 (determinismo OK, agora contando `gates` e `aferidor`).

- [ ] **Step 6: Commit**

```bash
git add template/registry.json template/REGISTRY.md template/tools/gates.md VERSION template/harness.yaml
git commit -m "chore(registry): registra gates + aferidor; doc; bump 1.11.0"
```

> Nota Step 6: se `REGISTRY.md` for espelho manual, adicione as 2 linhas correspondentes (papel/procedência/versão) antes de commitar; se for gerado, regenere.

---

## Self-Review

**1. Spec coverage (Fase 1 da §9):**
- "Consolidar portões numa definição de pronto única" → Tasks 4–5 (`evaluateGates`). ✅
- "Gate `saida-aberta`" → Task 4 (`checkOpenOutputs`) + Task 5 (no mapa). ✅ (cobre Risco C da §1)
- "Logar os campos novos em `history.jsonl`" → Tasks 1–3 (schema §3.4) + Task 6 (emissão real). ✅
- Constituição respeitada: Art. II CLI (Tasks 3, 5), Art. III TDD (todas), Art. VI SemVer (Task 7), Art. VII YAGNI (sem deps novas; externos deferidos). ✅
- Fora de escopo declarado: Dial (Fase 2), analisador/promoção (Fase 3), sombra (Fase 4), adaptadores/mirror (Fase 5). ✅

**2. Placeholder scan:** sem "TBD/TODO" acionáveis pendentes; os `⏳` em `gates.md` são status de produto documentado (sinal externo de fase futura), não lacuna de plano. As notas ao implementador dão o passo exato. ✅

**3. Type consistency:** `buildRunRecord(input)` usa as mesmas chaves (`now, modelId, taskClass, level, gates, retries…`) em Tasks 2, 3 e 6. `evaluateGates(ctx)` retorna `{ passed, gates, enforced }` consumido igual em Task 5 e Task 6 (usa `gates`). `ENFORCED_GATES` idêntico em Task 5. `appendRunRecord(path, record)` mesma assinatura em Tasks 3 e 6. `classifyTaskClass(paths)` mesma em Tasks 1 e 6. ✅
