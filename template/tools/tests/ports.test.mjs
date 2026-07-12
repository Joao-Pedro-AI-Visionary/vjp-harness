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
