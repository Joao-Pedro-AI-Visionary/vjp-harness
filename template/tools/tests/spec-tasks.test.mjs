// Fecha o gap: bsd.js --execute não lia spec.md/tasks.md do disco (violava o princípio #2 do
// AGENT_RULES.md — "código só a partir de spec.md/tasks.md" — e contradizia o próprio mermaid do
// STATE.md gerado, que já dizia "Task lida do tasks.md"). Estes testes cobrem os 3 helpers puros/
// semi-puros novos, mais uma integração real (subprocess, dry-run, git temporário) do fluxo completo.
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

test('INTEGRAÇÃO (subprocess, dry-run, git temporário): --execute lê tasks.md e marca [x] em cada task aprovada', () => {
  // Repo git isolado e descartável — NUNCA toca no monoRepo real. autoMerge fica em true de propósito
  // (default real do harness) pra provar que o merge no dry-run não quebra nem escapa do repo temporário.
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bsd-e2e-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: projectRoot });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: projectRoot });
  fs.writeFileSync(path.join(projectRoot, 'README.md'), '# projeto de teste');
  execFileSync('git', ['add', '-A'], { cwd: projectRoot });
  execFileSync('git', ['commit', '-q', '-m', 'inicial'], { cwd: projectRoot });

  // Instala uma cópia mínima do harness dentro do repo temporário (só o necessário pro bsd.js rodar).
  const harnessTools = path.join(projectRoot, '.harness', 'tools');
  fs.mkdirSync(harnessTools, { recursive: true });
  for (const f of ['bsd.js', 'agents.js', 'llm.js', 'aferidor-log.js', 'gates.js', 'verify.js']) {
    fs.copyFileSync(path.join(TOOLS_DIR, f), path.join(harnessTools, f));
  }
  fs.writeFileSync(path.join(path.dirname(harnessTools), 'AGENT_RULES.md'), '# regras de teste');
  // package.json com "type": "module" — bsd.js usa import/export ESM.
  fs.writeFileSync(path.join(harnessTools, 'package.json'), JSON.stringify({ type: 'module' }));

  const feature = 'feature-de-teste';
  const specDir = path.join(projectRoot, '.planning', 'phases', feature);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, 'spec.md'), '# Spec de teste\nObjetivo: provar a integração.');
  fs.writeFileSync(path.join(specDir, 'tasks.md'), [
    '# Tasks',
    '- [ ] **T1.** primeira tarefa',
    '- [ ] **T2.** segunda tarefa',
  ].join('\n'));

  const out = execFileSync(
    'node', [path.join(harnessTools, 'bsd.js'), '--execute', feature, '--dry-run'],
    { cwd: projectRoot, encoding: 'utf8' },
  );

  assert.match(out, /tasks\.md/i, 'deveria mencionar que achou tasks.md');
  assert.match(out, /T1/);
  assert.match(out, /T2/);

  const tasksAfter = fs.readFileSync(path.join(specDir, 'tasks.md'), 'utf8');
  assert.match(tasksAfter, /- \[x\] \*\*T1\.\*\* primeira tarefa/, 'T1 deveria estar marcada como concluída');
  assert.match(tasksAfter, /- \[x\] \*\*T2\.\*\* segunda tarefa/, 'T2 deveria estar marcada como concluída');
});

test('INTEGRAÇÃO: sem .planning/phases/<feature>/tasks.md, cai no modo autônomo de sempre (retrocompatível)', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bsd-e2e-autonomo-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: projectRoot });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: projectRoot });
  fs.writeFileSync(path.join(projectRoot, 'README.md'), '# projeto de teste');
  execFileSync('git', ['add', '-A'], { cwd: projectRoot });
  execFileSync('git', ['commit', '-q', '-m', 'inicial'], { cwd: projectRoot });

  const harnessTools = path.join(projectRoot, '.harness', 'tools');
  fs.mkdirSync(harnessTools, { recursive: true });
  for (const f of ['bsd.js', 'agents.js', 'llm.js', 'aferidor-log.js', 'gates.js', 'verify.js']) {
    fs.copyFileSync(path.join(TOOLS_DIR, f), path.join(harnessTools, f));
  }
  fs.writeFileSync(path.join(path.dirname(harnessTools), 'AGENT_RULES.md'), '# regras de teste');
  fs.writeFileSync(path.join(harnessTools, 'package.json'), JSON.stringify({ type: 'module' }));

  const out = execFileSync(
    'node', [path.join(harnessTools, 'bsd.js'), '--execute', 'feature-sem-spec', '--dry-run'],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  assert.match(out, /modo aut[oô]nomo/i);
  assert.match(out, /concluída e aprovada/i);
});
