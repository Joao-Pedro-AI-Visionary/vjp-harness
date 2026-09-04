#!/usr/bin/env node
/**
 * V-JP Harness: Porta do Mapa de Código (codebase-memory-mcp) — v1.21.0.
 * Uma chamada, orçamento fixo. O grafo responde "o que o diff atinge" em ~300 tokens,
 * no lugar de abrir vizinho às cegas. Chamado por pr-review, test-gate e prepush (camada 5).
 *
 *   node .harness/tools/cbm.js status                                  # indexado? nós/arestas
 *   node .harness/tools/cbm.js index [--mode fast|moderate|full]       # (re)indexa o cwd
 *   node .harness/tools/cbm.js impact [--base <ref>] [--depth 2] [--limit 3] [--no-index] [--json]
 *   node .harness/tools/cbm.js callers <função> [--depth 2] [--limit 10] [--json]
 *   node .harness/tools/cbm.js find <termo> [--limit 10] [--json]
 *
 * Códigos: 0 ok · 2 erro do grafo · 3 binário ausente (o chamador segue sem o grafo).
 * Roda o binário em modo `cli` (um tool, sai) — não precisa de MCP nem de daemon.
 * Sem semantic_query aqui, de propósito: resposta longa e imprecisa, fora do orçamento. — João Pedro (V-JP)
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BIN = path.join(HERE, 'node_modules', 'codebase-memory-mcp', 'bin.js');
export const LIMITS = Object.freeze({
  impactDepth: 2, impactLimit: 3,      // ~300 tokens num repo NestJS médio
  callersDepth: 2, callersLimit: 10,
  findLimit: 10,
  indexMode: 'fast',                   // sem arestas semânticas: não usamos, e custa RAM
});
const BASES = ['homol', 'develop', 'main', 'master'];

export function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

// Projeto do grafo cujo root_path é o cwd (o nome derivado do caminho é detalhe do binário).
export function pickProject(projects, cwd) {
  const want = normalizePath(cwd);
  return (projects || []).find((p) => normalizePath(p.root_path) === want) || null;
}

// `Classe.metodo` ou `metodo` -> sugestões cujo qualified_name termina em `.Classe.metodo`.
export function pickSuggestion(suggestions, fn) {
  const suffix = `.${String(fn || '').replace(/^\.+/, '')}`;
  return (suggestions || []).filter((s) => String(s.qualified_name || '').endsWith(suffix));
}

// Fallback textual para o buraco da injeção de dependência (NestJS): `this.svc.remove(` não resolve
// no grafo, mas aparece no texto. Regex ERE para `git grep -E`: `.remove(` com espaço opcional.
export function grepPattern(fn) {
  const method = String(fn || '').split('.').pop().replace(/[^A-Za-z0-9_]/g, '');
  return method ? `\\.${method}[[:space:]]*\\(` : '';
}

// Saída do `git grep -n` -> linhas `path:line: código` -> [{file,line,snippet}], até `limit`.
export function parseGrep(out, limit = 10) {
  const rows = [];
  for (const l of String(out || '').split('\n')) {
    const m = l.match(/^(.+?):(\d+):(.*)$/);
    if (!m) continue;
    rows.push({ file: m[1], line: Number(m[2]), snippet: m[3].trim().slice(0, 90) });
  }
  return { total: rows.length, rows: rows.slice(0, limit) };
}

// `remove` é nome comum: separa o que cita a classe (ou seu campo injetado `fooService`) ou mora
// no mesmo módulo do símbolo, do resto (provavelmente outras classes com o mesmo método).
export function rankGrep(rows, qualifiedName) {
  const parts = String(qualifiedName || '').split('.');
  const cls = parts.length >= 2 ? parts[parts.length - 2] : '';
  const field = cls ? cls[0].toLowerCase() + cls.slice(1) : '';
  const moduleDir = (() => {
    const i = parts.indexOf('src');
    return i >= 0 && parts.length - i > 3 ? `src/${parts[i + 1]}/` : '';
  })();
  const hit = (r) => (cls && (r.snippet.includes(cls) || r.snippet.includes(field))) || (moduleDir && r.file.replace(/\\/g, '/').startsWith(moduleDir));
  const same = [], other = [];
  for (const r of rows || []) (hit(r) ? same : other).push(r);
  return { same, other, cls };
}

// `cmd pos1 pos2 --k v --flag` -> { cmd, pos: [...], opts: { k: 'v', flag: true } }
export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const pos = [];
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const eq = key.indexOf('=');
      if (eq >= 0) opts[key.slice(0, eq)] = key.slice(eq + 1);
      else if (key.startsWith('no-')) opts[key.slice(3)] = false;
      else if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) opts[key] = rest[++i];
      else opts[key] = true;
    } else pos.push(a);
  }
  return { cmd, pos, opts };
}

// stdout do binário pode vir com `warning:`/`hint:` antes do JSON; pega do primeiro `{`.
export function extractResult(stdout) {
  const s = String(stdout || '');
  const i = s.indexOf('{');
  if (i < 0) return { error: 'sem JSON na saída do grafo', raw: s.trim() };
  let obj;
  try { obj = JSON.parse(s.slice(i)); } catch (e) { return { error: 'JSON inválido do grafo', raw: s.trim() }; }
  const text = (obj.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  let data = obj.structuredContent;
  if (data === undefined && text.trim().startsWith('{')) { try { data = JSON.parse(text); } catch { /* texto puro */ } }
  return { isError: !!obj.isError, text, data, error: obj.isError ? (data?.error || text) : undefined };
}

// base do diff: git config prepush.base -> primeira de origin/{homol,develop,main,master} -> HEAD~1
export function resolveBase(opts, git) {
  if (opts.base) return opts.base;
  const cfg = git(['config', '--get', 'prepush.base']);
  if (cfg) return `origin/${cfg}`.replace(/^origin\/origin\//, 'origin/');
  for (const b of BASES) if (git(['rev-parse', '--verify', '--quiet', `origin/${b}`])) return `origin/${b}`;
  for (const b of BASES) if (git(['rev-parse', '--verify', '--quiet', b])) return b;
  return 'HEAD~1';
}

function gitOut(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

function runTool(tool, flags, cwd) {
  const args = [BIN, 'cli', '--json', tool];
  for (const [k, v] of Object.entries(flags)) {
    if (v === undefined || v === null) continue;
    args.push(`--${k.replace(/_/g, '-')}`, typeof v === 'boolean' ? String(v) : String(v));
  }
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error) return { error: `falha ao executar o grafo: ${r.error.message}` };
  return extractResult(r.stdout);
}

function ensureProject(cwd, { reindex = false, mode = LIMITS.indexMode } = {}) {
  let list = runTool('list_projects', {}, cwd);
  if (list.error) return { error: list.error };
  let project = pickProject(list.data?.projects, cwd);
  if (!project || reindex) {
    const idx = runTool('index_repository', { repo_path: cwd.replace(/\\/g, '/'), mode }, cwd);
    if (idx.error) return { error: idx.error };
    if (!project) {
      list = runTool('list_projects', {}, cwd);
      project = pickProject(list.data?.projects, cwd) || (idx.data?.project ? { name: idx.data.project, root_path: cwd } : null);
    }
    if (!project) return { error: 'indexou mas não achou o projeto pelo root_path' };
  }
  return { project };
}

function emit(res, asJson, header) {
  if (asJson) { process.stdout.write(JSON.stringify(res.data ?? { text: res.text }, null, 2) + '\n'); return; }
  if (header) process.stdout.write(header + '\n');
  process.stdout.write((res.text || '').trim() + '\n');
}

function fail(msg, code) { process.stderr.write(`cbm: ${msg}\n`); process.exit(code); }

export function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const { cmd, pos, opts } = parseArgs(argv);
  if (!cmd || cmd === '--help' || cmd === '-h') {
    process.stdout.write('uso: cbm.js status | index [--mode] | impact [--base] [--depth] [--limit] [--no-index] [--json] | callers <função> | find <termo>\n');
    return process.exit(0);
  }
  if (!fs.existsSync(BIN)) fail(`binário ausente (${path.relative(cwd, BIN)}) — rode (cd .harness/tools && npm ci); seguindo sem o grafo`, 3);
  const asJson = opts.json === true;

  if (cmd === 'index') {
    const r = ensureProject(cwd, { reindex: true, mode: opts.mode || LIMITS.indexMode });
    if (r.error) fail(r.error, 2);
    const st = runTool('index_status', { project: r.project.name }, cwd);
    return emit(st, asJson, `cbm index · ${r.project.name} · modo ${opts.mode || LIMITS.indexMode}`);
  }

  if (cmd === 'status') {
    const list = runTool('list_projects', {}, cwd);
    if (list.error) fail(list.error, 2);
    const project = pickProject(list.data?.projects, cwd);
    if (!project) { process.stdout.write('cbm status · não indexado (rode: node .harness/tools/cbm.js index)\n'); return process.exit(0); }
    const st = runTool('index_status', { project: project.name }, cwd);
    if (asJson) return emit(st, true);
    const d = st.data || {};
    process.stdout.write(`cbm status · ${project.name} · ${d.status || '?'} · nós ${d.nodes ?? '?'} · arestas ${d.edges ?? '?'}\n`);
    return;
  }

  if (cmd === 'impact') {
    const r = ensureProject(cwd, { reindex: opts.index !== false });
    if (r.error) fail(r.error, 2);
    const base = resolveBase(opts, (a) => gitOut(a, cwd));
    const res = runTool('detect_changes', {
      project: r.project.name, since: base, scope: 'impact', direction: 'inbound',
      depth: Number(opts.depth || LIMITS.impactDepth), limit: Number(opts.limit || LIMITS.impactLimit),
    }, cwd);
    if (res.error) fail(res.error, 2);
    return emit(res, asJson, `cbm impact · ${r.project.name} · base ${base}`);
  }

  if (cmd === 'callers') {
    const fn = pos[0];
    if (!fn) fail('uso: cbm.js callers <função>', 2);
    const r = ensureProject(cwd, { reindex: false });
    if (r.error) fail(r.error, 2);
    const trace = (name) => runTool('trace_path', {
      project: r.project.name, function_name: name, direction: opts.direction || 'inbound',
      depth: Number(opts.depth || LIMITS.callersDepth), limit: Number(opts.limit || LIMITS.callersLimit),
      include_tests: true, risk_labels: true,
    }, cwd);
    let res = trace(fn);
    // `Classe.metodo` não é qualified_name: o grafo diz "not found". Busca pelo método e resolve pelo sufixo.
    if (res.error && /not found/i.test(res.error) && fn.includes('.')) res = trace(fn.split('.').pop());
    if (res.error && res.data?.status !== 'ambiguous') fail(res.error, 2);
    // Nome ambíguo (ex.: `remove`): aceita `Classe.metodo` e resolve pelo sufixo do qualified_name.
    if (res.data?.status === 'ambiguous') {
      const hits = pickSuggestion(res.data.suggestions, fn);
      if (hits.length === 1) res = trace(hits[0].qualified_name);
      else {
        const list = (hits.length ? hits : res.data.suggestions || []).map((s) => `  ${s.qualified_name}  (${s.file_path})`).join('\n');
        process.stdout.write(`cbm callers · "${fn}" é ambíguo — escolha um qualified_name:\n${list}\n`);
        return process.exit(0);
      }
      if (res.error) fail(res.error, 2);
    }
    emit(res, asJson, `cbm callers · ${fn}`);
    // Grafo diz zero: confere no texto antes de alguém concluir "código morto".
    const zero = res.data?.callers_total === 0 || /^callers_total:\s*0\b/m.test(res.text || '');
    if (zero && opts.grep !== false && !asJson) {
      const pat = grepPattern(fn);
      const g = pat ? spawnSync('git', ['grep', '-n', '-E', pat, '--', '*.ts', '*.tsx', '*.js', '*.mjs', '*.cs', ':!*.d.ts'], { cwd, encoding: 'utf8' }) : null;
      const limit = Number(opts.limit || LIMITS.callersLimit);
      const found = parseGrep(g?.stdout, Number.MAX_SAFE_INTEGER);
      const qn = (res.text || '').match(/^function:\s*(\S+)/m)?.[1] || fn;
      const { same, other, cls } = rankGrep(found.rows, qn);
      if (found.total === 0) process.stdout.write('textual: 0 ocorrências de `' + pat + '` no repo — aí sim é candidato a código morto\n');
      else if (same.length === 0) process.stdout.write(`textual: 0 citando ${cls || 'a classe'} ou o módulo; ${other.length} ocorrência(s) do mesmo nome em outras classes — candidato a código morto, confirme no arquivo\n`);
      else {
        process.stdout.write(`textual: ${same.length} ocorrência(s) citando ${cls || 'a classe'} ou o módulo (o grafo não segue injeção de dependência; confirme no arquivo):\n`);
        for (const r of same.slice(0, limit)) process.stdout.write(`  ${r.file}:${r.line}  ${r.snippet}\n`);
        if (same.length > limit) process.stdout.write(`  … +${same.length - limit} (aumente --limit)\n`);
        if (other.length) process.stdout.write(`  outras ${other.length} ocorrência(s) do mesmo nome de método em outras classes — ignoradas\n`);
      }
    }
    return;
  }

  if (cmd === 'find') {
    const term = pos.join(' ');
    if (!term) fail('uso: cbm.js find <termo>', 2);
    const r = ensureProject(cwd, { reindex: false });
    if (r.error) fail(r.error, 2);
    const res = runTool('search_graph', { project: r.project.name, query: term, limit: Number(opts.limit || LIMITS.findLimit) }, cwd);
    if (res.error) fail(res.error, 2);
    return emit(res, asJson, `cbm find · ${term}`);
  }

  fail(`comando desconhecido: ${cmd}`, 2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
