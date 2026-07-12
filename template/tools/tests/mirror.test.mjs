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
