// Helpers puros de spec/tasks do bsd.js (parseTasks, findFeatureSpec, markTaskDone).
// O pipeline headless (--execute) e seus testes de integração saíram na v2.2.0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseTasks, findFeatureSpec, markTaskDone } from '../bsd.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.resolve(TOOLS_DIR, '..');

test('parseTasks: reconhece "- [ ] **T1.** texto" e "- [x] texto" sem ID', () => {
  const md = [
    '# Tasks',
    '- [ ] **T1.** Fazer a migration',
    '- [x] **T2.** Escrever o DTO',
    '- [ ] Item solto sem ID',
    'linha qualquer que não é task',
  ].join('\n');
  const tasks = parseTasks(md);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].id, 'T1');
  assert.equal(tasks[0].done, false);
  assert.match(tasks[0].text, /Fazer a migration/);
  assert.equal(tasks[1].id, 'T2');
  assert.equal(tasks[1].done, true);
  assert.equal(tasks[2].id, 'T3'); // sem ID explícito → gera um sequencial
  assert.equal(tasks[2].done, false);
});

test('parseTasks: markdown sem nenhuma checkbox devolve array vazio', () => {
  assert.deepEqual(parseTasks('# Só um título\n\nTexto solto.'), []);
});

test('findFeatureSpec: acha .planning/phases/<feature>/ quando tasks.md existe', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-root-'));
  const dir = path.join(root, '.planning', 'phases', 'minha-feature');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'spec.md'), '# Spec de teste');
  fs.writeFileSync(path.join(dir, 'tasks.md'), '- [ ] **T1.** algo');
  const found = findFeatureSpec(root, 'minha-feature');
  assert.ok(found);
  assert.equal(found.dir, dir);
  assert.match(fs.readFileSync(found.specPath, 'utf8'), /Spec de teste/);
});

test('findFeatureSpec: devolve null quando não há tasks.md (modo autônomo preservado)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-root-'));
  assert.equal(findFeatureSpec(root, 'feature-inexistente'), null);
});

test('findFeatureSpec: também aceita specs/<feature>/ como convenção alternativa', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-root-'));
  const dir = path.join(root, 'specs', 'outra-feature');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tasks.md'), '- [ ] **T1.** algo');
  const found = findFeatureSpec(root, 'outra-feature');
  assert.ok(found);
  assert.equal(found.dir, dir);
  assert.equal(found.specPath, null); // spec.md é opcional, tasks.md é obrigatório
});

test('markTaskDone: vira [x] só na task certa, preserva o resto do arquivo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-'));
  const tasksPath = path.join(dir, 'tasks.md');
  fs.writeFileSync(tasksPath, [
    '# Tasks',
    '- [ ] **T1.** primeira',
    '- [ ] **T2.** segunda',
  ].join('\n'));
  await markTaskDone(tasksPath, 'T2');
  const out = fs.readFileSync(tasksPath, 'utf8');
  assert.match(out, /- \[ \] \*\*T1\.\*\* primeira/);
  assert.match(out, /- \[x\] \*\*T2\.\*\* segunda/);
});
