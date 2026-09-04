// cbm.js: porta do Mapa de Código — as partes puras (sem binário, sem git).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath, pickProject, pickSuggestion, parseArgs, extractResult, resolveBase, LIMITS } from '../cbm.js';

test('pickSuggestion: `Classe.metodo` resolve pelo sufixo do qualified_name', () => {
  const sugg = [
    { qualified_name: 'p.src.anexos.anexos.service.AnexosService.remove', file_path: 'a' },
    { qualified_name: 'p.src.form-sessions.form-sessions.service.FormSessionsService.remove', file_path: 'b' },
    { qualified_name: 'p.src.form-sessions.form-sessions.controller.FormSessionsController.remove', file_path: 'c' },
  ];
  assert.equal(pickSuggestion(sugg, 'FormSessionsService.remove').length, 1);
  assert.equal(pickSuggestion(sugg, 'remove').length, 3);
  assert.equal(pickSuggestion(sugg, 'Nada.remove').length, 0);
  assert.equal(pickSuggestion(undefined, 'x').length, 0);
});

test('normalizePath: barra invertida, barra final e caixa não importam', () => {
  assert.equal(normalizePath(String.raw`C:\Users\fulano\Projects\Api` + '\\'), 'c:/users/fulano/projects/api');
  assert.equal(normalizePath('/home/fulano/api'), '/home/fulano/api');
});

test('pickProject: acha pelo root_path, não pelo nome derivado', () => {
  const projects = [
    { name: 'C-Users-fulano-Projects-Api', root_path: 'C:/Users/fulano/Projects/Api' },
    { name: 'home-fulano-outro', root_path: '/home/fulano/outro' },
  ];
  assert.equal(pickProject(projects, String.raw`C:\Users\fulano\Projects\Api`).name, 'C-Users-fulano-Projects-Api');
  assert.equal(pickProject(projects, '/home/fulano/nada'), null);
  assert.equal(pickProject(undefined, '/x'), null);
});

test('parseArgs: posicional, --k v, --k=v, --flag e --no-flag', () => {
  const r = parseArgs(['impact', '--base', 'origin/homol', '--depth=3', '--json', '--no-index']);
  assert.equal(r.cmd, 'impact');
  assert.deepEqual(r.opts, { base: 'origin/homol', depth: '3', json: true, index: false });
  const c = parseArgs(['callers', 'ChargeInvoiceUseCase.execute', '--limit', '5']);
  assert.deepEqual(c.pos, ['ChargeInvoiceUseCase.execute']);
  assert.equal(c.opts.limit, '5');
});

test('extractResult: ignora hint/warning antes do JSON e lê texto + structuredContent', () => {
  const out = 'hint: daemon temporário\n{"content":[{"type":"text","text":"base: HEAD~2\\nimpacted_total: 3"}],"structuredContent":{"a":1},"isError":false}';
  const r = extractResult(out);
  assert.equal(r.isError, false);
  assert.match(r.text, /impacted_total: 3/);
  assert.deepEqual(r.data, { a: 1 });
});

test('extractResult: texto JSON sem structuredContent vira data; erro do tool vira error', () => {
  const ok = extractResult('{"content":[{"type":"text","text":"{\\"projects\\":[]}"}],"isError":false}');
  assert.deepEqual(ok.data, { projects: [] });
  const err = extractResult('{"content":[{"type":"text","text":"repo_path is required"}],"structuredContent":{"error":"repo_path is required"},"isError":true}');
  assert.equal(err.isError, true);
  assert.equal(err.error, 'repo_path is required');
  assert.match(extractResult('nada aqui').error, /sem JSON/);
});

test('resolveBase: --base > prepush.base > origin/{homol,develop,main,master} > HEAD~1', () => {
  const git = (answers) => (args) => answers[args.join(' ')] || '';
  assert.equal(resolveBase({ base: 'origin/x' }, git({})), 'origin/x');
  assert.equal(resolveBase({}, git({ 'config --get prepush.base': 'homol' })), 'origin/homol');
  assert.equal(resolveBase({}, git({ 'rev-parse --verify --quiet origin/develop': 'abc' })), 'origin/develop');
  assert.equal(resolveBase({}, git({ 'rev-parse --verify --quiet main': 'abc' })), 'main');
  assert.equal(resolveBase({}, git({})), 'HEAD~1');
});

test('LIMITS: orçamento de tokens é fixo e pequeno (mudar aqui é decisão, não acidente)', () => {
  assert.equal(LIMITS.impactDepth, 2);
  assert.equal(LIMITS.impactLimit, 3);
  assert.equal(LIMITS.indexMode, 'fast');
});
