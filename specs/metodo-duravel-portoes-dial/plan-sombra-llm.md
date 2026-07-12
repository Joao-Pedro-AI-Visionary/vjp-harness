# Sombra de Verdade — Runner LLM (mede o MODELO, não o Dial) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps: `- [ ]`.

**Goal:** Fechar o limite declarado da Fase 4. Hoje o probe sombra roda um *self-check do Dial* (`dialConsistencyRunner`) — útil, mas **não mede a qualidade do modelo**. Este plano entrega o **runner LLM**: a IA resolve tarefas douradas no nível-sombra, um **juiz determinístico** (código, não IA) confere contra o gabarito, e o resultado popula `shadow_first_try_pass` — que o Aferidor (Fase 3) já consome pra promover/afrouxar.

**Modo (escolha do usuário): AUTOMÁTICO AMOSTRADO.** Roda sozinho, mas só em 1 a cada N features (`shadowSampleEvery`, default 5) — mede sem queimar token toda vez. Amostragem **determinística** (conta os RUN_RECORDs; sem `Math.random`), portanto testável.

**Restrição da Constituição (dirige o design):** Art. LLM05 — *"NUNCA `eval()` em LLM output"*. Logo o runner **não executa código gerado pela IA**. As tarefas douradas pedem **saída estruturada** (JSON) e o juiz compara com o gabarito por código puro. Também Art. LLM10 (consumo limitado): amostragem + timeout + `maxFixtures`.

**Segurança adicional:** sem chave/LLM configurado ou sem rede → `shadow_first_try_pass = null` (**null ≠ pass**, não polui a medição; nunca "passa" por omissão).

**Tech Stack:** Node ESM, `node --test`. Reusa `llm.js` (`loadLlmConfig`, `chat`, `extractJson`, `checkConnectivity`). Sem deps novas.

---

## File Structure
| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `template/config/canary-llm.json` | Cria | Tarefas douradas (prompt + gabarito) — fixo, versionado |
| `template/tools/sombra-llm.js` | Cria | `judgeFixture` (puro), `llmRunner` (chama a IA), `shouldSample` (puro), `probeLlm` + CLI |
| `template/tools/tests/sombra-llm.test.mjs` | Cria | TDD (juiz, amostragem, agregação, fallbacks de erro) |
| `template/config/dial.json` | Modifica | + `shadowSampleEvery: 5`, `shadowMaxFixtures: 4` |
| `template/tools/bsd.js` | Modifica | usa o runner LLM quando amostrado; senão mantém o self-check |
| `template/tools/tests/spec-tasks.test.mjs` | Modifica | + `sombra-llm.js` na lista de cópia |
| `registry.json`,`REGISTRY.md`,`VERSION`,`harness.yaml`,`sombra-llm.md` | Modifica/Cria | registra; bump 1.16.0 |

---

## Task 1: canary-llm.json + juiz + amostragem (puros, sem rede)

- [ ] **Step 1:** Create `template/config/canary-llm.json` — tarefas douradas do DOMÍNIO do harness (saída estruturada, sem código executável):
```json
{
  "version": 1,
  "comment": "Tarefas douradas p/ medir o MODELO (não o Dial). Saída estruturada; juiz determinístico compara com o gabarito. Art. LLM05: nunca executar código gerado pela IA.",
  "fixtures": [
    {
      "id": "classificar-migracao",
      "taskClass": "migration",
      "system": "Você classifica tarefas de engenharia. Responda SOMENTE JSON.",
      "user": "Arquivos tocados: [\"prisma/migrations/20260101_add_users/migration.sql\"]. Classifique em uma destas classes: migration, prod, db, frontend, backend, config. Responda JSON: {\"task_class\": \"<classe>\"}",
      "expect": { "task_class": "migration" }
    },
    {
      "id": "classificar-frontend",
      "taskClass": "frontend",
      "system": "Você classifica tarefas de engenharia. Responda SOMENTE JSON.",
      "user": "Arquivos tocados: [\"web/components/Card.tsx\"]. Classifique em uma destas classes: migration, prod, db, frontend, backend, config. Responda JSON: {\"task_class\": \"<classe>\"}",
      "expect": { "task_class": "frontend" }
    },
    {
      "id": "risco-prod",
      "taskClass": "prod",
      "system": "Você avalia risco de mudanças. Responda SOMENTE JSON.",
      "user": "Tarefa: alterar a configuração de deploy em infra/prod/deploy.yaml do ambiente de produção. O risco é alto, médio ou baixo? Responda JSON: {\"risk\": \"alto|medio|baixo\"}",
      "expect": { "risk": "alto" }
    },
    {
      "id": "contrato-endpoint",
      "taskClass": "backend",
      "system": "Você extrai contratos de API. Responda SOMENTE JSON.",
      "user": "Spec: 'O endpoint GET /users/:id retorna o usuário por id.' Extraia o contrato. Responda JSON: {\"method\": \"<METODO>\", \"path\": \"<caminho>\"}",
      "expect": { "method": "GET", "path": "/users/:id" }
    }
  ]
}
```

- [ ] **Step 2:** Test `template/tools/tests/sombra-llm.test.mjs`:
```js
// sombra-llm.js: runner LLM do probe sombra — mede o MODELO (não o Dial).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeFixture, shouldSample, summarizeProbe, loadCanaryLlm } from '../sombra-llm.js';

test('judgeFixture: acerto exato -> passed', () => {
  const fx = { id: 'x', expect: { task_class: 'migration' } };
  assert.equal(judgeFixture(fx, { task_class: 'migration' }).passed, true);
});

test('judgeFixture: normaliza caixa e espaços (não pune formatação)', () => {
  const fx = { id: 'x', expect: { task_class: 'migration' } };
  assert.equal(judgeFixture(fx, { task_class: '  MIGRATION ' }).passed, true);
  assert.equal(judgeFixture({ id: 'y', expect: { method: 'GET' } }, { method: 'get' }).passed, true);
});

test('judgeFixture: resposta errada -> não passa (com detalhe)', () => {
  const fx = { id: 'x', expect: { task_class: 'migration' } };
  const r = judgeFixture(fx, { task_class: 'frontend' });
  assert.equal(r.passed, false);
  assert.match(r.detail, /esperado.*migration.*obtido.*frontend/i);
});

test('judgeFixture: resposta nula/ilegível -> não passa (nunca passa por omissão)', () => {
  const fx = { id: 'x', expect: { task_class: 'migration' } };
  assert.equal(judgeFixture(fx, null).passed, false);
  assert.equal(judgeFixture(fx, undefined).passed, false);
  assert.equal(judgeFixture(fx, 'texto solto').passed, false);
});

test('judgeFixture: campo faltando -> não passa', () => {
  const fx = { id: 'x', expect: { method: 'GET', path: '/users/:id' } };
  assert.equal(judgeFixture(fx, { method: 'GET' }).passed, false);
});

test('judgeFixture: campo EXTRA não reprova (só o gabarito importa)', () => {
  const fx = { id: 'x', expect: { method: 'GET' } };
  assert.equal(judgeFixture(fx, { method: 'GET', extra: 'ignorado' }).passed, true);
});

test('shouldSample: amostragem DETERMINÍSTICA a cada N (sem Math.random)', () => {
  assert.equal(shouldSample(0, 5), true);    // 1ª medição
  assert.equal(shouldSample(1, 5), false);
  assert.equal(shouldSample(4, 5), false);
  assert.equal(shouldSample(5, 5), true);    // a cada 5
  assert.equal(shouldSample(10, 5), true);
});

test('shouldSample: N<=1 -> sempre; N inválido -> nunca (fail-safe: não gasta token)', () => {
  assert.equal(shouldSample(3, 1), true);
  assert.equal(shouldSample(3, 0), false);
  assert.equal(shouldSample(3, null), false);
});

test('summarizeProbe: pass só se TODAS passaram; vazio/erro -> null (≠ pass)', () => {
  assert.equal(summarizeProbe([{ passed: true }, { passed: true }]).shadow_first_try_pass, true);
  assert.equal(summarizeProbe([{ passed: true }, { passed: false }]).shadow_first_try_pass, false);
  assert.equal(summarizeProbe([]).shadow_first_try_pass, null);
  assert.equal(summarizeProbe(null).shadow_first_try_pass, null);
});

test('loadCanaryLlm: lê o canário real (>=3 fixtures, todas com expect)', () => {
  const c = loadCanaryLlm();
  assert.ok(c.fixtures.length >= 3);
  for (const f of c.fixtures) { assert.ok(f.expect); assert.ok(f.user); }
});
```

- [ ] **Step 3:** Run — expect FAIL.

- [ ] **Step 4:** Implement `template/tools/sombra-llm.js`:
```js
#!/usr/bin/env node
/**
 * V-JP Harness: Sombra de Verdade — runner LLM (mede o MODELO, não o Dial).
 * A IA resolve tarefas douradas; um JUIZ DETERMINÍSTICO (código, não IA) compara com o gabarito.
 * O resultado vira shadow_first_try_pass, que o Aferidor usa pra promover.
 *
 * Constituição: Art. LLM05 — NUNCA executar/eval código gerado pela IA (por isso as tarefas
 * pedem saída ESTRUTURADA, não código). Art. LLM10 — consumo limitado (amostragem + maxFixtures).
 * Sem LLM/rede -> null (null ≠ pass: nunca "passa" por omissão). — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadLlmConfig, chat, extractJson } from './llm.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));

export function loadCanaryLlm(canaryPath) {
  const p = canaryPath || path.resolve(DIR, '../config/canary-llm.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function norm(v) { return String(v ?? '').trim().toLowerCase(); }

// Juiz DETERMINÍSTICO: compara a resposta com o gabarito. Não é IA julgando IA.
// Só os campos do gabarito importam (campo extra não reprova). Resposta ilegível -> não passa.
export function judgeFixture(fixture, answer) {
  const exp = fixture.expect || {};
  if (!answer || typeof answer !== 'object') {
    return { id: fixture.id, passed: false, detail: 'resposta ausente ou não-JSON' };
  }
  for (const [k, want] of Object.entries(exp)) {
    const got = answer[k];
    if (norm(got) !== norm(want)) {
      return { id: fixture.id, passed: false, detail: `campo "${k}": esperado "${want}", obtido "${got ?? '(vazio)'}"` };
    }
  }
  return { id: fixture.id, passed: true, detail: 'bateu o gabarito' };
}

// Amostragem DETERMINÍSTICA (sem Math.random, p/ ser testável): mede a cada N execuções.
// N inválido/0/null -> nunca amostra (fail-safe: não gasta token por acidente).
export function shouldSample(runCount, every) {
  const n = Number(every);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (n <= 1) return true;
  return Number(runCount) % n === 0;
}

// Agrega: pass só se TODAS passaram. Lista vazia/nula -> null (≠ pass).
export function summarizeProbe(results) {
  const rs = Array.isArray(results) ? results.filter((r) => r && typeof r.passed === 'boolean') : [];
  if (!rs.length) return { shadow_first_try_pass: null, rate: null, n: 0, results: [] };
  const passed = rs.filter((r) => r.passed).length;
  return { shadow_first_try_pass: passed === rs.length, rate: passed / rs.length, n: rs.length, results: rs };
}

// Runner LLM (toca a rede). Pergunta à IA cada fixture e julga. Erro/sem-config -> null.
export async function probeLlm({ harnessDir, canary, maxFixtures = 4, agentId = 'sombra' } = {}) {
  let cfg;
  try {
    cfg = loadLlmConfig(harnessDir || path.resolve(DIR, '..'));
  } catch (e) {
    return { shadow_first_try_pass: null, rate: null, n: 0, results: [], skipped: `sem LLM configurado: ${e.message}` };
  }
  const cn = canary || loadCanaryLlm();
  const fixtures = (cn.fixtures || []).slice(0, maxFixtures);   // Art. LLM10: teto de consumo
  const results = [];
  for (const fx of fixtures) {
    try {
      const text = await chat({ system: fx.system || 'Responda SOMENTE JSON.', user: fx.user, cfg, agentId });
      const answer = extractJson(text);
      results.push(judgeFixture(fx, answer));
    } catch (e) {
      results.push({ id: fx.id, passed: false, detail: `erro na chamada: ${String(e.message).slice(0, 80)}` });
    }
  }
  return summarizeProbe(results);
}

// ---- CLI (Art. II): node sombra-llm.js --probe [--json]  (toca a rede) ----
async function main() {
  const argv = process.argv.slice(2);
  if (!argv.includes('--probe')) {
    console.error('uso: node sombra-llm.js --probe [--json]   (chama a IA — gasta token)');
    process.exit(2);
  }
  const out = await probeLlm({});
  if (argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); }
  else {
    console.log('\n=== V-JP Harness — Sombra de Verdade (mede o MODELO) ===\n');
    if (out.skipped) console.log(`  ⚠ pulado: ${out.skipped}`);
    for (const r of out.results) console.log(`  ${r.passed ? '✔' : '✗'} ${r.id}: ${r.detail}`);
    console.log(`\n  shadow_first_try_pass=${out.shadow_first_try_pass} (taxa ${out.rate ?? 'n/a'}, ${out.n} tarefas)\n`);
  }
  process.exit(out.shadow_first_try_pass ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

- [ ] **Step 5:** Run — expect PASS (10). Commit:
```bash
git add template/config/canary-llm.json template/tools/sombra-llm.js template/tools/tests/sombra-llm.test.mjs
git commit -m "feat(sombra-llm): runner LLM + juiz determinístico (mede o modelo, sem eval — Art. LLM05)"
```

---

## Task 2: dial.json + wire amostrado no bsd.js

- [ ] **Step 1:** `template/config/dial.json` — adicione após `"minShadow": 5,`:
```json
  "shadowSampleEvery": 5,
  "shadowMaxFixtures": 4,
```

- [ ] **Step 2:** `bsd.js` — import após a linha do `./sombra.js`:
```js
import { probeLlm, shouldSample } from './sombra-llm.js';
```

- [ ] **Step 3:** `bsd.js` — no bloco do probe sombra (`if (process.env.VJP_SHADOW && dialConfig) {`), SUBSTITUA o corpo interno do `if (shadowLevel != null) { ... }` por:
```js
        try {
          // Amostragem determinística: mede o MODELO (runner LLM) a cada N execuções; nas demais,
          // roda o self-check barato do Dial (sem token). Art. LLM10: consumo limitado.
          const runCount = readRecords(HISTORY_FILE).length;
          if (shouldSample(runCount, dialConfig.shadowSampleEvery)) {
            const out = await probeLlm({ harnessDir: HARNESS_DIR, maxFixtures: dialConfig.shadowMaxFixtures || 4 });
            shadowPass = out.shadow_first_try_pass;
            console.log(`  ${COLORS.dim}Sombra (LLM, amostrada): nível ${shadowLevel} → pass=${shadowPass}${out.skipped ? ` [${out.skipped}]` : ''}${COLORS.reset}`);
          } else {
            const agg = runCanaryProbe({ canary: loadCanary(), runner: dialConsistencyRunner(dialConfig) });
            shadowPass = agg.shadow_first_try_pass;
            console.log(`  ${COLORS.dim}Sombra (self-check): nível ${shadowLevel} → pass=${shadowPass}${COLORS.reset}`);
          }
        } catch { /* canário/LLM ausente: sombra fica null */ }
```
(`HARNESS_DIR` já é constante do módulo. O bloco do Dial é `async` — `executeFeature` é `async function`, então `await` é válido aqui.)

- [ ] **Step 4:** `tests/spec-tasks.test.mjs` — nas DUAS listas, adicione `'sombra-llm.js'` (e `'llm.js'` já está lá).

- [ ] **Step 5:** Verify: `cd template/tools && node --test tests/*.test.mjs` (0 fails) + boot `cd <root> && node template/tools/bsd.js 2>&1 | head -3` sem stack trace.

- [ ] **Step 6:** Commit:
```bash
git add template/config/dial.json template/tools/bsd.js template/tools/tests/spec-tasks.test.mjs
git commit -m "feat(bsd): sombra amostrada usa o runner LLM (1 a cada N; self-check nas demais)"
```

---

## Task 3: Registrar, doc, bump 1.16.0

- [ ] **Step 1:** `registry.json`: `harnessVersion` → `1.16.0`; append:
```json
{
  "id": "sombra-llm",
  "name": "Sombra de Verdade — Runner LLM (V-JP)",
  "tier": "core",
  "priority": 21,
  "required": true,
  "source": { "type": "bundled", "author": "João Pedro (V-JP)" },
  "dest": ".harness/tools/sombra-llm.js",
  "version": "1.16.0",
  "install": "Incluído no harness (template/tools/sombra-llm.js).",
  "verify": { "type": "file", "path": "tools/sombra-llm.js" }
}
```
- [ ] **Step 2:** `VERSION` → `1.16.0`; `harness.yaml` `version:` → `"1.16.0"`.
- [ ] **Step 3:** Create `template/tools/sombra-llm.md`:
```markdown
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
```
- [ ] **Step 4:** `REGISTRY.md`: 1 linha + changelog `**v1.16.0:** Sombra de Verdade — runner LLM (amostrado)`.
- [ ] **Step 5:** `npm run check` verde + Determinismo OK. Cole o tail.
- [ ] **Step 6:** Commit:
```bash
git add template/registry.json template/REGISTRY.md template/tools/sombra-llm.md VERSION template/harness.yaml
git commit -m "chore(registry): registra sombra-llm; doc; bump 1.16.0"
```

---

## Self-Review
- Mede o MODELO (fecha o limite declarado da Fase 4). ✅
- Juiz determinístico, **sem eval** (Art. LLM05). ✅  Consumo limitado (Art. LLM10). ✅
- Amostrado 1-em-N determinístico (escolha do usuário: opção 3). ✅
- `null ≠ pass` (sem LLM/rede não infla a medição). ✅
- Art. II (CLI), III (TDD), VI (SemVer), VII (sem deps). ✅
