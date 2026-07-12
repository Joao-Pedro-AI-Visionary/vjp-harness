# Método Durável — Fase 5: Adaptadores (Risco A) + Mirror de Upstreams (Risco B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Fechar os dois riscos de durabilidade que sobraram: **(A)** ferramenta muda comportamento/interface → **adaptadores (ports) por papel, com fallback próprio real**, para o método sobreviver à troca; **(B)** ferramenta some (repo apagado, pacote despublicado) → **mirror próprio** (tarball verificável por SHA-256) dos upstreams pinados, mais um comando que audita a saúde do mirror.

**Architecture (Art. VIII-compliant):** Só criamos adaptador onde há **fallback próprio real** — a regra da spec §3.5 ("adaptador sem fallback não é criado", YAGNI). Na prática:
- `ports.js` — resolve um **papel** (`memory`, `packer`) para uma implementação: a ferramenta pinada se presente, senão o **fallback nativo V-JP** (formato aberto). Duas implementações concretas por papel ⇒ não é wrapper especulativo (Art. VIII reconciliado por ADR).
- `fallbacks/memory-fallback.js` — memória persistente mínima em markdown/JSONL (substitui GBrain se sumir).
- `fallbacks/packer-fallback.js` — empacotador de repo mínimo (substitui Repomix se sumir).
- `mirror.js` — plano/manifesto de mirror + verificação de integridade (SHA-256), auditoria `--audit` (offline, determinística) e `--fetch` (rede, opt-in).

**Fidelidade (honesto):** `--fetch` toca a rede (git/npm) — não roda nos testes. O que é testado é tudo o que é determinístico: manifesto, hashing, verificação, detecção de mirror ausente/corrompido, resolução de portas e os fallbacks (que são código nosso, testado de verdade).

**Tech Stack:** Node ESM, `node:crypto` (built-in), `node --test`. Sem deps novas.

---

## File Structure
| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `template/tools/ports.js` | Cria | `resolvePort` (papel → ferramenta ou fallback), `portStatus` + CLI |
| `template/tools/fallbacks/memory-fallback.js` | Cria | Memória persistente nativa (markdown/JSONL) |
| `template/tools/fallbacks/packer-fallback.js` | Cria | Empacotador de repo nativo (texto único) |
| `template/tools/mirror.js` | Cria | `buildMirrorManifest`, `sha256File`, `verifyMirror`, `auditMirror` + CLI |
| `template/tools/tests/ports.test.mjs` | Cria | TDD portas + fallbacks |
| `template/tools/tests/mirror.test.mjs` | Cria | TDD mirror |
| `registry.json`,`REGISTRY.md`,`VERSION`,`harness.yaml`,`ports.md`,`mirror.md` | Modifica/Cria | registra; bump 1.15.0 |

---

## Task 1: Fallbacks nativos (memory + packer)

- [ ] **Step 1:** Test `template/tools/tests/ports.test.mjs` (parte 1 — os fallbacks):
```js
// ports.js + fallbacks: durabilidade contra sumiço/troca de ferramenta (Fase 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createMemory } from '../fallbacks/memory-fallback.js';
import { packRepo } from '../fallbacks/packer-fallback.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-ports-')); }

test('memory-fallback: remember/recall persistem em formato aberto (JSONL)', () => {
  const d = tmp();
  const mem = createMemory(path.join(d, 'mem.jsonl'));
  mem.remember({ key: 'decisao-1', value: 'usar portões' });
  mem.remember({ key: 'decisao-2', value: 'dial 0-3' });
  const all = mem.recall();
  assert.equal(all.length, 2);
  assert.equal(all[1].value, 'dial 0-3');
  // formato aberto: dá pra ler sem a ferramenta
  const raw = fs.readFileSync(path.join(d, 'mem.jsonl'), 'utf8').trim().split('\n');
  assert.equal(JSON.parse(raw[0]).key, 'decisao-1');
  fs.rmSync(d, { recursive: true, force: true });
});

test('memory-fallback: recall por key + arquivo ausente -> []', () => {
  const d = tmp();
  const mem = createMemory(path.join(d, 'x.jsonl'));
  assert.deepEqual(mem.recall(), []);          // ainda não existe
  mem.remember({ key: 'a', value: '1' });
  mem.remember({ key: 'b', value: '2' });
  assert.equal(mem.recall('b').length, 1);
  assert.equal(mem.recall('b')[0].value, '2');
  fs.rmSync(d, { recursive: true, force: true });
});

test('memory-fallback: linha corrompida é ignorada (não quebra)', () => {
  const d = tmp();
  const f = path.join(d, 'm.jsonl');
  fs.writeFileSync(f, '{"key":"ok","value":"1"}\n{lixo\n');
  assert.equal(createMemory(f).recall().length, 1);
  fs.rmSync(d, { recursive: true, force: true });
});

test('packer-fallback: empacota arquivos do repo num texto único com cabeçalhos', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'a.js'), 'const a = 1;');
  fs.mkdirSync(path.join(d, 'sub'));
  fs.writeFileSync(path.join(d, 'sub', 'b.md'), '# titulo');
  const out = packRepo(d, { extensions: ['.js', '.md'] });
  assert.match(out, /=== a\.js ===/);
  assert.match(out, /const a = 1;/);
  assert.match(out, /=== sub\/b\.md ===/);
  assert.match(out, /# titulo/);
});

test('packer-fallback: ignora node_modules/.git e respeita extensões', () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, 'node_modules'));
  fs.writeFileSync(path.join(d, 'node_modules', 'lib.js'), 'ignorar');
  fs.writeFileSync(path.join(d, 'keep.js'), 'manter');
  fs.writeFileSync(path.join(d, 'skip.png'), 'binario');
  const out = packRepo(d, { extensions: ['.js'] });
  assert.doesNotMatch(out, /ignorar/);
  assert.doesNotMatch(out, /skip\.png/);
  assert.match(out, /manter/);
});
```

- [ ] **Step 2:** Run — expect FAIL (módulos ausentes): `cd template/tools && node --test tests/ports.test.mjs`

- [ ] **Step 3:** Create `template/tools/fallbacks/memory-fallback.js`:
```js
/**
 * V-JP Harness: Fallback nativo — Memória Persistente (Fase 5).
 * Implementação PRÓPRIA (formato aberto JSONL) do papel `memory`. Existe para o método
 * sobreviver ao sumiço/troca do GBrain (Risco B) — o dado continua legível sem a ferramenta.
 * — João Pedro (V-JP)
 */
import fs from 'fs';

export function createMemory(storePath) {
  return {
    // Persiste um fato (append-only, crash-safe).
    remember(entry) {
      const rec = { ts: new Date().toISOString(), ...entry };
      fs.appendFileSync(storePath, JSON.stringify(rec) + '\n', 'utf8');
      return rec;
    },
    // Lê os fatos (opcionalmente filtrando por key). Arquivo ausente -> []. Linha corrompida -> ignora.
    recall(key = null) {
      let raw;
      try { raw = fs.readFileSync(storePath, 'utf8'); } catch { return []; }
      const out = [];
      for (const line of raw.split('\n')) {
        const s = line.trim(); if (!s) continue;
        try { const o = JSON.parse(s); if (!key || o.key === key) out.push(o); } catch { /* ignora */ }
      }
      return out;
    },
  };
}
```

- [ ] **Step 4:** Create `template/tools/fallbacks/packer-fallback.js`:
```js
/**
 * V-JP Harness: Fallback nativo — Empacotador de Repositório (Fase 5).
 * Implementação PRÓPRIA do papel `packer`. Existe para o método sobreviver ao sumiço/troca
 * do Repomix (Risco B): gera um texto único com o conteúdo do repo. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';

const IGNORED = new Set(['node_modules', '.git', '.worktrees', 'dist', 'build', '.bsd']);

function walk(dir, base, exts, out) {
  for (const name of fs.readdirSync(dir)) {
    if (IGNORED.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) { walk(full, base, exts, out); continue; }
    if (exts.length && !exts.includes(path.extname(name))) continue;
    const rel = path.relative(base, full).split(path.sep).join('/');
    out.push(`=== ${rel} ===\n${fs.readFileSync(full, 'utf8')}`);
  }
  return out;
}

// Empacota o repo num texto único (cabeçalho por arquivo). extensions=[] -> todas.
export function packRepo(rootDir, { extensions = [] } = {}) {
  return walk(rootDir, rootDir, extensions, []).join('\n\n');
}
```

- [ ] **Step 5:** Run — expect PASS (5 tests). Commit:
```bash
git add template/tools/fallbacks template/tools/tests/ports.test.mjs
git commit -m "feat(fallbacks): memória + empacotador nativos (formato aberto) — Fase 5"
```

---

## Task 2: ports.js (papel → ferramenta OU fallback)

- [ ] **Step 1:** APPEND ao `template/tools/tests/ports.test.mjs`:
```js
import { resolvePort, portStatus, PORTS } from '../ports.js';

test('resolvePort: usa a FERRAMENTA quando o artefato pinado existe', () => {
  const d = tmp();
  const toolPath = path.join(d, 'repomix.cjs');
  fs.writeFileSync(toolPath, '// tool');
  const r = resolvePort('packer', { toolPaths: { packer: toolPath } });
  assert.equal(r.impl, 'tool');
  assert.equal(r.path, toolPath);
});

test('resolvePort: cai no FALLBACK próprio quando a ferramenta sumiu (Risco B)', () => {
  const r = resolvePort('packer', { toolPaths: { packer: '/nao/existe/repomix.cjs' } });
  assert.equal(r.impl, 'fallback');
  assert.match(r.path, /packer-fallback\.js$/);
});

test('resolvePort: papel desconhecido lança (erro explícito, não silencioso)', () => {
  assert.throws(() => resolvePort('inexistente', {}), /papel desconhecido/i);
});

test('PORTS declara os papéis com fallback real (Art. VIII: 2+ implementações)', () => {
  assert.ok(PORTS.memory && PORTS.packer);
  for (const p of Object.values(PORTS)) assert.ok(p.fallback, 'todo papel precisa de fallback real');
});

test('portStatus: reporta impl de cada papel (auditável)', () => {
  const st = portStatus({ toolPaths: { packer: '/nao/existe', memory: '/nao/existe' } });
  assert.equal(st.packer.impl, 'fallback');
  assert.equal(st.memory.impl, 'fallback');
});
```

- [ ] **Step 2:** Run — expect FAIL. 

- [ ] **Step 3:** Create `template/tools/ports.js`:
```js
#!/usr/bin/env node
/**
 * V-JP Harness: Portas (Adaptadores por papel) — Fase 5.
 * Resolve um PAPEL para uma implementação: a ferramenta pinada se presente, senão o
 * FALLBACK nativo V-JP (formato aberto). Fecha o Risco A (troca) e o B (sumiço).
 *
 * Art. VIII (anti-abstração) reconciliado: só existe porta onde há 2+ implementações
 * CONCRETAS (ferramenta + fallback próprio real). Porta sem fallback não é criada (YAGNI).
 * — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// Papéis com fallback próprio REAL (a única condição p/ existir uma porta).
export const PORTS = {
  memory: {
    role: 'Memória Persistente',
    tool: 'gbrain',
    defaultToolPath: path.join(DIR, 'gbrain', 'bin', 'gbrain.js'),
    fallback: path.join(DIR, 'fallbacks', 'memory-fallback.js'),
  },
  packer: {
    role: 'Empacotador de Repositório',
    tool: 'repomix',
    defaultToolPath: path.join(DIR, 'node_modules', 'repomix', 'bin', 'repomix.cjs'),
    fallback: path.join(DIR, 'fallbacks', 'packer-fallback.js'),
  },
};

// Resolve o papel -> { impl: 'tool'|'fallback', path, role, tool }.
export function resolvePort(role, { toolPaths = {} } = {}) {
  const port = PORTS[role];
  if (!port) throw new Error(`Porta: papel desconhecido "${role}"`);
  const toolPath = toolPaths[role] || port.defaultToolPath;
  const hasTool = (() => { try { return fs.existsSync(toolPath); } catch { return false; } })();
  return hasTool
    ? { impl: 'tool', path: toolPath, role: port.role, tool: port.tool }
    : { impl: 'fallback', path: port.fallback, role: port.role, tool: `${port.tool} (ausente → fallback V-JP)` };
}

// Status de todas as portas (auditável).
export function portStatus(opts = {}) {
  return Object.fromEntries(Object.keys(PORTS).map((r) => [r, resolvePort(r, opts)]));
}

// ---- CLI (Art. II): node ports.js [--json] ----
function main() {
  const st = portStatus();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(st, null, 2)); return; }
  console.log('\n=== V-JP Harness — Portas (papel → implementação) ===\n');
  for (const [role, r] of Object.entries(st)) {
    console.log(`  ${r.impl === 'tool' ? '✔' : '↺'} ${r.role}: ${r.impl === 'tool' ? 'ferramenta' : 'FALLBACK nativo'} (${r.tool})`);
  }
  console.log('\n↺ = a ferramenta sumiu, mas o método continua (fallback próprio).\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

- [ ] **Step 4:** Run — expect PASS (10 no arquivo). Smoke: `node ports.js` → lista os 2 papéis. Report.

- [ ] **Step 5:** Commit:
```bash
git add template/tools/ports.js template/tools/tests/ports.test.mjs
git commit -m "feat(ports): adaptadores por papel c/ fallback real (Riscos A+B) — Fase 5"
```

---

## Task 3: mirror.js (Risco B — upstream some)

- [ ] **Step 1:** Test `template/tools/tests/mirror.test.mjs`:
```js
// mirror.js: espelho próprio dos upstreams pinados (Risco B) — Fase 5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { buildMirrorManifest, sha256File, verifyMirror, auditMirror } from '../mirror.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-mirror-')); }

const reg = { components: [
  { id: 'rtk', name: 'RTK', version: '0.42.4', source: { type: 'git', repo: 'rtk-ai/rtk', url: 'https://github.com/rtk-ai/rtk', tag: 'v0.42.4', commit: '8a7dd7e5570d' } },
  { id: 'gbrain', name: 'GBrain', version: '0.35.1.0', source: { type: 'git', repo: 'garrytan/gbrain', url: 'https://x/y', tag: 't', commit: 'abc123' } },
  { id: 'bsd', name: 'Maestro', version: '1.6.0', source: { type: 'bundled' } },
] };

test('buildMirrorManifest: só entram componentes de upstream externo (bundled fica fora)', () => {
  const m = buildMirrorManifest(reg);
  assert.equal(m.entries.length, 2);
  assert.ok(m.entries.every((e) => e.id !== 'bsd'), 'bundled não precisa de mirror (já é nosso)');
  assert.equal(m.entries[0].id, 'rtk');
  assert.equal(m.entries[0].commit, '8a7dd7e5570d');
  assert.match(m.entries[0].archive, /rtk-0\.42\.4\.tar\.gz$/);
});

test('sha256File: hash determinístico do conteúdo', () => {
  const d = tmp(); const f = path.join(d, 'a.txt');
  fs.writeFileSync(f, 'conteudo');
  const h1 = sha256File(f), h2 = sha256File(f);
  assert.equal(h1, h2);
  assert.match(h1, /^[a-f0-9]{64}$/);
  fs.writeFileSync(f, 'outro');
  assert.notEqual(sha256File(f), h1);   // conteúdo mudou -> hash muda (detecta corrupção)
  fs.rmSync(d, { recursive: true, force: true });
});

test('verifyMirror: ok quando o arquivo existe e bate o sha; corrompido quando não bate', () => {
  const d = tmp(); const f = path.join(d, 'rtk-0.42.4.tar.gz');
  fs.writeFileSync(f, 'pacote');
  const sha = sha256File(f);
  assert.equal(verifyMirror({ archive: f, sha256: sha }).status, 'ok');
  fs.writeFileSync(f, 'pacote-adulterado');
  assert.equal(verifyMirror({ archive: f, sha256: sha }).status, 'corrupted');
});

test('verifyMirror: ausente quando o arquivo não existe (upstream sumiu e não temos cópia)', () => {
  assert.equal(verifyMirror({ archive: '/nao/existe.tar.gz', sha256: 'x' }).status, 'missing');
});

test('verifyMirror: sem sha registrado -> unverified (≠ ok; não confia cegamente)', () => {
  const d = tmp(); const f = path.join(d, 'x.tar.gz');
  fs.writeFileSync(f, 'p');
  assert.equal(verifyMirror({ archive: f, sha256: null }).status, 'unverified');
  fs.rmSync(d, { recursive: true, force: true });
});

test('auditMirror: agrega o estado do espelho (healthy só se TODOS ok)', () => {
  const d = tmp();
  const manifest = { entries: [
    { id: 'a', archive: path.join(d, 'a.tar.gz'), sha256: null },
    { id: 'b', archive: path.join(d, 'b.tar.gz'), sha256: null },
  ] };
  const a1 = auditMirror(manifest);
  assert.equal(a1.healthy, false);              // nada espelhado ainda
  assert.equal(a1.results.every((r) => r.status === 'missing'), true);

  fs.writeFileSync(manifest.entries[0].archive, 'x');
  fs.writeFileSync(manifest.entries[1].archive, 'y');
  manifest.entries[0].sha256 = sha256File(manifest.entries[0].archive);
  manifest.entries[1].sha256 = sha256File(manifest.entries[1].archive);
  const a2 = auditMirror(manifest);
  assert.equal(a2.healthy, true);
  fs.rmSync(d, { recursive: true, force: true });
});
```

- [ ] **Step 2:** Run — expect FAIL.

- [ ] **Step 3:** Create `template/tools/mirror.js`:
```js
#!/usr/bin/env node
/**
 * V-JP Harness: Mirror de Upstreams (Fase 5) — Risco B (a ferramenta some).
 * O vendoring atual clona do upstream: se o repo for apagado/o pacote despublicado, a
 * montagem morre. O mirror guarda uma CÓPIA PRÓPRIA (tarball) de cada upstream pinado,
 * verificável por SHA-256. `--audit` é offline/determinístico; `--fetch` toca a rede (opt-in).
 * — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MIRROR_DIR = path.resolve(DIR, '../../.mirror');

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

// Manifesto: um arquivo por upstream EXTERNO (bundled é nosso, não precisa de espelho).
export function buildMirrorManifest(registry, mirrorDir = DEFAULT_MIRROR_DIR) {
  const entries = (registry.components || [])
    .filter((c) => c.source && c.source.type !== 'bundled' && !c.removed)
    .map((c) => ({
      id: c.id,
      name: c.name,
      version: c.version,
      type: c.source.type,
      repo: c.source.repo || null,
      url: c.source.url || null,
      tag: c.source.tag || null,
      commit: c.source.commit || null,
      package: c.source.package || null,
      archive: path.join(mirrorDir, `${c.id}-${c.version}.tar.gz`),
      sha256: null,
    }));
  return { mirrorDir, entries };
}

// Estado de UMA entrada: ok | corrupted | missing | unverified. (unverified ≠ ok.)
export function verifyMirror(entry) {
  if (!fs.existsSync(entry.archive)) return { id: entry.id, status: 'missing', detail: 'sem cópia local' };
  if (!entry.sha256) return { id: entry.id, status: 'unverified', detail: 'sem sha256 registrado' };
  const actual = sha256File(entry.archive);
  return actual === entry.sha256
    ? { id: entry.id, status: 'ok', detail: actual.slice(0, 12) }
    : { id: entry.id, status: 'corrupted', detail: `esperado ${entry.sha256.slice(0, 12)}, obtido ${actual.slice(0, 12)}` };
}

// Saúde do espelho: healthy só se TODAS as entradas estão ok.
export function auditMirror(manifest) {
  const results = (manifest.entries || []).map(verifyMirror);
  return { healthy: results.length > 0 && results.every((r) => r.status === 'ok'), results };
}

// ---- rede (opt-in, NÃO testado): baixa os upstreams git pinados p/ o espelho ----
function fetchGitEntry(entry, mirrorDir) {
  fs.mkdirSync(mirrorDir, { recursive: true });
  const tmp = path.join(mirrorDir, `.tmp-${entry.id}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  execSync(`git clone --quiet --depth 1 ${entry.tag ? `--branch ${entry.tag}` : ''} ${entry.url} ${JSON.stringify(tmp)}`, { stdio: 'ignore' });
  execSync(`tar -czf ${JSON.stringify(entry.archive)} -C ${JSON.stringify(tmp)} .`, { stdio: 'ignore' });
  fs.rmSync(tmp, { recursive: true, force: true });
  return sha256File(entry.archive);
}

function manifestPath(mirrorDir) { return path.join(mirrorDir, 'manifest.json'); }

function main() {
  const argv = process.argv.slice(2);
  const registryPath = path.resolve(DIR, '../registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const mirrorDir = DEFAULT_MIRROR_DIR;
  const mp = manifestPath(mirrorDir);
  const manifest = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : buildMirrorManifest(registry, mirrorDir);

  if (argv.includes('--fetch')) {
    fs.mkdirSync(mirrorDir, { recursive: true });
    for (const e of manifest.entries.filter((x) => x.type === 'git' && x.url)) {
      try { e.sha256 = fetchGitEntry(e, mirrorDir); console.log(`  ✔ espelhado ${e.id} (${e.sha256.slice(0, 12)})`); }
      catch (err) { console.log(`  ✗ falhou ${e.id}: ${err.message}`); }
    }
    fs.writeFileSync(mp, JSON.stringify(manifest, null, 2));
    console.log(`\nmanifesto: ${mp}`);
    return;
  }

  const audit = auditMirror(manifest);
  if (argv.includes('--json')) { console.log(JSON.stringify({ mirrorDir, ...audit }, null, 2)); }
  else {
    const icon = { ok: '✔', corrupted: '✗', missing: '·', unverified: '?' };
    console.log(`\n=== V-JP Harness — Mirror de Upstreams (Risco B) ===\n`);
    for (const r of audit.results) console.log(`  ${icon[r.status]} ${r.id}: ${r.status} ${r.detail ? `(${r.detail})` : ''}`);
    console.log(`\n${audit.healthy ? '✔ Espelho saudável' : '⚠ Espelho incompleto — rode: node .harness/tools/mirror.js --fetch (rede)'}\n`);
  }
  process.exit(audit.healthy ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

- [ ] **Step 4:** Run — expect PASS (6). Smoke (offline, espelho ainda vazio → sai 1 e recomenda `--fetch`): `node mirror.js ; echo "exit=$?"`. **Não** rode `--fetch` (rede). Report a saída.

- [ ] **Step 5:** Commit:
```bash
git add template/tools/mirror.js template/tools/tests/mirror.test.mjs
git commit -m "feat(mirror): espelho próprio dos upstreams + auditoria SHA-256 (Risco B) — Fase 5"
```

---

## Task 4: Registrar, docs, bump 1.15.0, .gitignore do espelho

- [ ] **Step 1:** `.gitignore` (raiz): adicione ao final:
```
# espelho local dos upstreams (tarballs; reproduzível via mirror.js --fetch)
.mirror/
```

- [ ] **Step 2:** `template/registry.json`: `harnessVersion` → `1.15.0`; append DOIS componentes (priority 19 e 20):
```json
{
  "id": "ports",
  "name": "Portas — Adaptadores por Papel (V-JP)",
  "tier": "core",
  "priority": 19,
  "required": true,
  "source": { "type": "bundled", "author": "João Pedro (V-JP)" },
  "dest": ".harness/tools/ports.js",
  "version": "1.15.0",
  "install": "Incluído no harness (template/tools/ports.js).",
  "verify": { "type": "file", "path": "tools/ports.js" }
},
{
  "id": "mirror",
  "name": "Mirror de Upstreams (V-JP)",
  "tier": "core",
  "priority": 20,
  "required": true,
  "source": { "type": "bundled", "author": "João Pedro (V-JP)" },
  "dest": ".harness/tools/mirror.js",
  "version": "1.15.0",
  "install": "Incluído no harness (template/tools/mirror.js).",
  "verify": { "type": "file", "path": "tools/mirror.js" }
}
```

- [ ] **Step 3:** `VERSION` → `1.15.0`; `template/harness.yaml` `version:` → `"1.15.0"`.

- [ ] **Step 4:** Create `template/tools/ports.md`:
```markdown
# Portas — Adaptadores por Papel (V-JP)

Resolve um **papel** para uma implementação: a **ferramenta** pinada se presente, senão o
**fallback nativo V-JP** (formato aberto). É o que faz o método sobreviver à troca (Risco A)
e ao sumiço (Risco B) de uma ferramenta.

| Papel | Ferramenta | Fallback próprio |
|---|---|---|
| `memory` | GBrain | `fallbacks/memory-fallback.js` (JSONL aberto) |
| `packer` | Repomix | `fallbacks/packer-fallback.js` (texto único) |

**Art. VIII (anti-abstração) reconciliado:** só existe porta onde há **2+ implementações concretas**
(ferramenta + fallback real). Porta sem fallback **não é criada** (YAGNI) — ver spec §3.5.

Uso: `node .harness/tools/ports.js [--json]` → mostra qual implementação está ativa em cada papel.
```

- [ ] **Step 5:** Create `template/tools/mirror.md`:
```markdown
# Mirror de Upstreams (V-JP) — Risco B

O vendoring pinado clona do upstream. Se o repo for **apagado** ou o pacote **despublicado**,
a montagem morre. O mirror guarda uma **cópia própria** (tarball) de cada upstream externo,
verificável por **SHA-256**.

- `node .harness/tools/mirror.js` — **auditoria offline** (determinística): `ok | corrupted | missing | unverified`.
  `unverified ≠ ok` (sem sha registrado não se confia cegamente). Sai 0 só se TODAS ok.
- `node .harness/tools/mirror.js --fetch` — **toca a rede** (opt-in): clona os upstreams git pinados,
  gera os tarballs e grava o `manifest.json` com os SHAs.

O espelho vive em `.mirror/` (gitignored — reproduzível pelo manifesto). Ver spec §3.6.
```

- [ ] **Step 6:** `REGISTRY.md`: 2 linhas (Portas; Mirror de Upstreams — V-JP, 1.15.0) + changelog `**v1.15.0:** Portas (adaptadores c/ fallback) + Mirror de Upstreams (Fase 5)`.

- [ ] **Step 7:** `cd template/tools && npm run check` — verde + Determinismo OK (conta `ports` e `mirror`). Cole o tail.

- [ ] **Step 8:** Commit:
```bash
git add .gitignore template/registry.json template/REGISTRY.md template/tools/ports.md template/tools/mirror.md VERSION template/harness.yaml
git commit -m "chore(registry): registra ports + mirror; docs; bump 1.15.0 (Fase 5)"
```

---

## Self-Review
- **Risco A** (ferramenta muda): porta por papel isola o método da ferramenta (Task 2). ✅ spec §3.5
- **Risco B** (ferramenta some): fallback próprio real **+** mirror verificável por SHA (Tasks 1/3). ✅ spec §3.6
- Art. VIII reconciliado (2+ implementações concretas por porta; sem fallback → sem porta). ✅ ADR
- `unverified ≠ ok` no mirror (mesma disciplina do `unknown ≠ green` dos portões). ✅
- Art. II (CLIs), III (TDD), VI (SemVer 1.15.0), VII (sem deps novas; `--fetch` não testado por tocar rede — declarado). ✅
