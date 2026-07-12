// harness-guard.sh: avisa (nunca bloqueia) ao editar código num projeto sem .harness/.
// Dirige o script BASH de verdade, com projetos falsos em tmp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GUARD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../machine/hooks/harness-guard.sh');

// Roda o guard como o Claude Code roda: JSON no stdin. Devolve { code, stdout }.
function runGuard({ file, session = 's1', stateDir }) {
  const input = JSON.stringify({ session_id: session, tool_input: { file_path: file } });
  try {
    const stdout = execFileSync('bash', [GUARD], {
      input,
      encoding: 'utf8',
      env: { ...process.env, VJP_GUARD_STATE_DIR: stateDir },
    });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout || '') };
  }
}

// Cria um projeto falso; withHarness/optOut controlam os marcadores.
function makeProject({ withHarness = false, optOut = false } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-proj-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  if (withHarness) fs.mkdirSync(path.join(d, '.harness'));
  if (optOut) fs.writeFileSync(path.join(d, '.harness-opt-out'), '');
  fs.mkdirSync(path.join(d, 'src'));
  return d;
}
function stateDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vjp-state-')); }
function avisou(r) { return /sem harness|SEM HARNESS/i.test(r.stdout); }

test('projeto SEM harness + código-fonte -> AVISA', () => {
  const p = makeProject(); const s = stateDir();
  const f = path.join(p, 'src', 'app.ts'); fs.writeFileSync(f, 'x');
  const r = runGuard({ file: f, stateDir: s });
  assert.equal(r.code, 0, 'nunca bloqueia');
  assert.ok(avisou(r), 'deveria avisar');
  assert.match(r.stdout, /install\.sh/, 'oferece o comando de instalar');
});

test('avisa UMA VEZ por projeto/sessão (não spamma a cada arquivo)', () => {
  const p = makeProject(); const s = stateDir();
  const f1 = path.join(p, 'src', 'a.ts'); fs.writeFileSync(f1, 'x');
  const f2 = path.join(p, 'src', 'b.ts'); fs.writeFileSync(f2, 'x');
  assert.ok(avisou(runGuard({ file: f1, session: 'sX', stateDir: s })), '1ª vez avisa');
  assert.ok(!avisou(runGuard({ file: f2, session: 'sX', stateDir: s })), '2ª vez fica quieto');
});

test('sessão NOVA volta a avisar (o lembrete é por sessão)', () => {
  const p = makeProject(); const s = stateDir();
  const f = path.join(p, 'src', 'a.ts'); fs.writeFileSync(f, 'x');
  assert.ok(avisou(runGuard({ file: f, session: 'sA', stateDir: s })));
  assert.ok(avisou(runGuard({ file: f, session: 'sB', stateDir: s })), 'outra sessão -> avisa de novo');
});

test('projeto COM .harness/ -> silencioso', () => {
  const p = makeProject({ withHarness: true }); const s = stateDir();
  const f = path.join(p, 'src', 'app.ts'); fs.writeFileSync(f, 'x');
  const r = runGuard({ file: f, stateDir: s });
  assert.equal(r.code, 0);
  assert.ok(!avisou(r), 'tem harness -> nada a dizer');
});

test('.harness-opt-out -> silencioso (repo de terceiro, ex. docmind)', () => {
  const p = makeProject({ optOut: true }); const s = stateDir();
  const f = path.join(p, 'src', 'app.ts'); fs.writeFileSync(f, 'x');
  assert.ok(!avisou(runGuard({ file: f, stateDir: s })), 'opt-out silencia');
});

test('doc/config/teste NÃO disparam aviso (só código-fonte)', () => {
  const p = makeProject(); const s = stateDir();
  for (const name of ['README.md', 'package.json', 'app.test.ts', 'x.spec.js', 'a.yaml']) {
    const f = path.join(p, name); fs.writeFileSync(f, 'x');
    const r = runGuard({ file: f, session: 'novo-' + name, stateDir: s });
    assert.ok(!avisou(r), `${name} não deveria avisar`);
    assert.equal(r.code, 0);
  }
});

test('vários tipos de código-fonte disparam (ts, py, go, rb, sql...)', () => {
  const p = makeProject();
  for (const name of ['a.ts', 'b.py', 'c.go', 'd.rb', 'e.sql', 'f.tsx']) {
    const f = path.join(p, 'src', name); fs.writeFileSync(f, 'x');
    const r = runGuard({ file: f, session: 'sess-' + name, stateDir: stateDir() });
    assert.ok(avisou(r), `${name} deveria avisar`);
  }
});

test('RUIM: stdin inválido -> silencioso e exit 0 (nunca trava o trabalho)', () => {
  const r = (() => {
    try {
      const stdout = execFileSync('bash', [GUARD], { input: 'não é json{{{', encoding: 'utf8', env: { ...process.env, VJP_GUARD_STATE_DIR: stateDir() } });
      return { code: 0, stdout };
    } catch (e) { return { code: e.status ?? 1, stdout: String(e.stdout || '') }; }
  })();
  assert.equal(r.code, 0, 'entrada podre não pode bloquear');
  assert.ok(!avisou(r));
});

test('RUIM: arquivo sem path / fora de repo git -> silencioso e exit 0', () => {
  const s = stateDir();
  assert.equal(runGuard({ file: '', stateDir: s }).code, 0);
  const solto = path.join(os.tmpdir(), 'solto-' + Date.now() + '.ts');
  fs.writeFileSync(solto, 'x');
  const r = runGuard({ file: solto, stateDir: s });
  assert.equal(r.code, 0, 'fora de repo não pode bloquear');
});

test('a mensagem ensina o que fazer (instalar) e diz que não bloqueou', () => {
  const p = makeProject(); const s = stateDir();
  const f = path.join(p, 'src', 'app.ts'); fs.writeFileSync(f, 'x');
  const out = runGuard({ file: f, stateDir: s }).stdout;
  assert.match(out, /install\.sh/, 'mostra como instalar');
  assert.match(out, /opt-out/, 'mostra como silenciar');
  const j = JSON.parse(out);                       // saída tem que ser JSON válido p/ o Claude Code
  assert.ok(j.systemMessage, 'usa systemMessage');
});
