// cbm.js: porta do Mapa de Código — as partes puras (sem binário, sem git).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath, pickProject, pickSuggestion, parseArgs, extractResult, resolveBase, grepPattern, parseGrep, rankGrep, LIMITS } from '../cbm.js';

test('rankGrep: prioriza quem cita a classe, o campo injetado ou mora no módulo do símbolo', () => {
  const rows = [
    { file: 'src/anexos/anexos.controller.ts', line: 22, snippet: 'return this.anexosService.remove(req.user, id);' },
    { file: 'src/form-sessions/form-sessions.controller.ts', line: 65, snippet: 'return this.formSessionsService.remove(req.user, id);' },
    { file: 'src/form-sessions/remove.spec.ts', line: 75, snippet: 'const out = await svc.remove(PARTNER, id);' },
    { file: 'test/e2e/fluxo.spec.ts', line: 9, snippet: 'new FormSessionsService(db).remove(p, id)' },
  ];
  const r = rankGrep(rows, 'proj.src.form-sessions.form-sessions.service.FormSessionsService.remove');
  assert.equal(r.cls, 'FormSessionsService');
  assert.deepEqual(r.same.map((x) => x.line), [65, 75, 9]);
  assert.deepEqual(r.other.map((x) => x.line), [22]);
  assert.deepEqual(rankGrep(rows, 'remove').same, []);
});

test('grepPattern: usa só o método, escapa e aceita espaço antes do parêntese', () => {
  assert.equal(grepPattern('FormSessionsService.remove'), '\\.remove[[:space:]]*\\(');
  assert.equal(grepPattern('remove'), '\\.remove[[:space:]]*\\(');
  assert.equal(grepPattern('a.b.c-1'), '\\.c1[[:space:]]*\\(');
  assert.equal(grepPattern(''), '');
});

test('parseGrep: `git grep -n` vira linhas com arquivo, linha e trecho, respeitando o limite', () => {
  const out = 'src/a.controller.ts:41:    return this.svc.remove(id, user);\nsrc/a.spec.ts:12:  await svc.remove("x");\nlixo sem formato\n';
  const r = parseGrep(out, 1);
  assert.equal(r.total, 2);
  assert.deepEqual(r.rows, [{ file: 'src/a.controller.ts', line: 41, snippet: 'return this.svc.remove(id, user);' }]);
  assert.deepEqual(parseGrep('', 5), { total: 0, rows: [] });
});

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
