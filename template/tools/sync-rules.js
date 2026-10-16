#!/usr/bin/env node
/**
 * sync-rules.js — V-JP Harness v2: renderiza a FONTE ÚNICA (core/) para cada ferramenta.
 * Node >= 18, zero dependência, determinístico (sem data/hora, ordem fixa, LF, JSON com 2 espaços).
 *
 * Modos (um por chamada):
 *   --repo                 (padrão dentro do vjp-harness) artefatos versionados do próprio repo:
 *                          machine/export/{AGENTS,HARNESS}.md, machine/export/skills/projeto-novo/,
 *                          bloco gerado em template/AGENT_RULES.md
 *   --target <dir>         (padrão dentro de .harness/tools) projeto: AGENTS.md e CLAUDE.md (bloco
 *                          gerenciado), .agents/rules/, .cursor/rules/, .agents/skills/ e .claude/skills/
 *                          (projeto-novo), .codex/hooks.json (merge), .harness/core/
 *   --global [--home <d>]  máquina: ~/.codex/AGENTS.md, ~/.claude/HARNESS.md, ~/.gemini/GEMINI.md
 *                          (+ ~/AGENTS.md legado se já for nosso) e fan-out das skills para
 *                          ~/.claude/skills, ~/.agents/skills, ~/.gemini/config/skills,
 *                          ~/.gemini/antigravity-cli/skills
 * Opções:
 *   --check                não escreve nada; sai 1 se houver drift (idempotência verificável)
 *   --eval                 opt-in: delega a rules-eval.js (mesmo prompt com e sem cada regra).
 *                          Não roda na instalação nem no --check. --llm compara respostas (gasta API).
 *   --list                 só lista o plano (caminhos)
 *   --core <dir>           fonte alternativa (default: auto-detecta core/ ou .harness/core/)
 *   --repo-root <dir>      raiz do vjp-harness (default: auto-detecta)
 *   --quiet                só o resumo
 * Saída: 0 ok · 1 drift (--check) · 2 erro de uso/validação.            — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

export const START = '<!-- vjp-harness:start -->';
export const END = '<!-- vjp-harness:end -->';
export const AR_START = '<!-- vjp-core:execucao:start -->';
export const AR_END = '<!-- vjp-core:execucao:end -->';
export const AGY_TRIGGERS = ['always_on', 'model_decision', 'glob', 'manual'];
export const HOOK_SCRIPT = 'codex-test-budget-pretool.sh';
export const HOOK_MATCHER = 'Bash|apply_patch|Edit|Write';

const GEN = (src) => `<!-- GERADO por sync-rules.js a partir de ${src} — não edite aqui: edite core/ e rode sync-rules. -->`;

// ---------------------------------------------------------------- utilidades puras
export function normalize(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n*$/, '\n');
}

// Insere/substitui o bloco gerenciado preservando todo o resto do arquivo (idempotente).
export function upsertBlock(existing, inner, start = START, end = END) {
  const block = `${start}\n${inner.replace(/\n*$/, '')}\n${end}`;
  const cur = existing == null ? '' : String(existing).replace(/\r\n?/g, '\n');
  const i = cur.indexOf(start);
  const j = i >= 0 ? cur.indexOf(end, i) : -1;
  if (i >= 0 && j >= 0) return cur.slice(0, i) + block + cur.slice(j + end.length);
  if (!cur.trim()) return block + '\n';
  return cur.replace(/\n*$/, '') + '\n\n' + block + '\n';
}

// Rebaixa títulos markdown (fora de blocos de código) em n níveis.
export function demoteHeadings(md, n) {
  let fence = false;
  return md.split('\n').map((l) => {
    if (/^```/.test(l)) fence = !fence;
    if (!fence && /^#{1,6} /.test(l)) return '#'.repeat(n) + l;
    return l;
  }).join('\n');
}

export function yamlQuote(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// ---------------------------------------------------------------- core
export function loadCore(coreDir) {
  const manifestPath = path.join(coreDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`core/manifest.json não encontrado em ${coreDir}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const read = (rel) => {
    const p = path.join(coreDir, rel);
    if (!fs.existsSync(p)) throw new Error(`módulo do manifest ausente: core/${rel}`);
    return normalize(fs.readFileSync(p, 'utf8'));
  };
  const modules = manifest.alwaysOn.map((rel) => ({ rel, text: read(rel) }));
  const skills = (manifest.skills || []).map((s) => {
    const refDir = path.join(coreDir, s.referencesDir);
    const refs = fs.existsSync(refDir)
      ? fs.readdirSync(refDir).filter((f) => f.endsWith('.md')).sort().map((f) => ({ name: f, text: read(path.join(s.referencesDir, f)) }))
      : [];
    return { ...s, bodyText: read(s.body), refs };
  });
  const execRules = manifest.executionRulesForAgentRules ? read(manifest.executionRulesForAgentRules) : null;
  return { coreDir, manifest, modules, skills, execRules };
}

export function renderBundle(core) {
  const { manifest, modules } = core;
  const parts = [GEN('core/ (always-on)'), `# ${manifest.title} — v${manifest.version}`, ''];
  for (const m of modules) parts.push(m.text.replace(/\n$/, ''), '');
  const out = normalize(parts.join('\n'));
  const bytes = Buffer.byteLength(out, 'utf8');
  const max = manifest.limits?.bundleMaxBytes ?? 24000;
  if (bytes > max) throw new Error(`bundle always-on com ${bytes} bytes > limite ${max} (AGY trunca acima de 24.000; Codex soma 32 KiB). Enxugue core/.`);
  if (!out.includes(manifest.sentinel)) throw new Error('frase-sentinela do manifest não aparece no bundle');
  return out;
}

export function renderSkill(core, skill) {
  const files = {};
  const desc = skill.description;
  if (desc.length > 1024) throw new Error(`descrição da skill ${skill.name} > 1024 caracteres`);
  files['SKILL.md'] = normalize([
    '---', `name: ${skill.name}`, `description: ${yamlQuote(desc)}`, '---',
    GEN(`core/${skill.body}`), '', skill.bodyText,
  ].join('\n'));
  for (const r of skill.refs) {
    files[`references/${r.name}`] = normalize([GEN(`core/${skill.referencesDir}/${r.name}`), '', r.text].join('\n'));
  }
  return files;
}

export function renderAgyRule(core, rule) {
  const trigger = rule.trigger || 'model_decision';
  if (!AGY_TRIGGERS.includes(trigger)) throw new Error(`trigger inválido para AGY (${trigger}) — regra seria descartada em silêncio`);
  if (trigger === 'model_decision' && !rule.description) throw new Error('model_decision exige description');
  const fm = ['---', `trigger: ${trigger}`, `description: ${yamlQuote(rule.description)}`];
  if (trigger === 'glob') fm.push(`globs: ${yamlQuote(rule.globs)}`);
  fm.push('---');
  const out = normalize([...fm, GEN('core/manifest.json (conditionalRules)'), '', rule.body].join('\n'));
  const max = core.manifest.limits?.agyRuleMaxBytes ?? 24000;
  if (Buffer.byteLength(out, 'utf8') > max) throw new Error(`regra AGY ${rule.id} > ${max} bytes`);
  return out;
}

export function renderCursorRule(core, rule) {
  return normalize([
    '---', `description: ${rule.description}`, `globs: ${rule.globs || ''}`.trimEnd(), `alwaysApply: ${rule.alwaysApply ? 'true' : 'false'}`, '---',
    GEN('core/manifest.json (conditionalRules)'), '', rule.body,
  ].join('\n'));
}

export function renderClaudeBlock(core) {
  const lines = [
    `## 🧬 V-JP Harness v${core.manifest.version} (lei operacional) — gerado por sync-rules.js; edite \`.harness/core/\``,
    'Regras globais carregadas por import real do Claude Code (fonte única em `.harness/core/`):',
    ...core.manifest.alwaysOn.map((rel) => `@.harness/core/${rel}`),
    '',
    'Pipeline e especialistas: `.harness/AGENT_RULES.md` (contrato-primeiro, back/db/front, verificação ponta-a-ponta front→API→DB, NFR/fila, spec-driven). Subagentes em `.claude/agents/`. Projeto novo: skill `projeto-novo`.',
    'Determinismo: `node .harness/tools/bsd.js --doctor` · motor: `(cd .harness/tools && npm run check)` · drift das regras: `node .harness/tools/sync-rules.js --check`.',
  ];
  return lines.join('\n');
}

export function codexHookCommand(scriptRel) {
  return `f="$(git rev-parse --show-toplevel 2>/dev/null)/${scriptRel}"; [ -f "$f" ] || exit 0; exec bash "$f"`;
}

// Merge idempotente do hook PreToolUse do orçamento de teste (Codex). Preserva hooks alheios.
export function mergeCodexHooks(currentText, command) {
  let obj = {};
  if (currentText && currentText.trim()) {
    try { obj = JSON.parse(currentText); } catch (e) { throw new Error(`.codex/hooks.json inválido (não sobrescrevo): ${e.message}`); }
  } else {
    obj.comment = 'V-JP: PreToolUse recusa runner de teste e patch em spec quando o orçamento mecânico esgotou. Só age com VJP_CODEX=1 ou VJP_TEST_BUDGET=1. Stop-continue NÃO zera o contador.';
  }
  obj.hooks = obj.hooks || {};
  obj.hooks.PreToolUse = obj.hooks.PreToolUse || [];
  let found = false;
  for (const m of obj.hooks.PreToolUse) {
    for (const h of m.hooks || []) {
      if (typeof h.command === 'string' && h.command.includes(HOOK_SCRIPT)) {
        if (found) continue;
        h.type = 'command'; h.command = command; found = true;
      }
    }
  }
  if (!found) obj.hooks.PreToolUse.push({ matcher: HOOK_MATCHER, hooks: [{ type: 'command', command }] });
  return JSON.stringify(obj, null, 2) + '\n';
}

// Skills "reais" do export (SKILL.md é arquivo regular). Symlinks da família gstack ficam de fora:
// apontam para ~/.claude/skills/gstack e não existem nas outras ferramentas.
export function listRealSkills(skillsDir) {
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir).sort().filter((n) => {
    const p = path.join(skillsDir, n, 'SKILL.md');
    try { return fs.lstatSync(p).isFile(); } catch { return false; }
  });
}

function walkFiles(dir, base = dir) {
  const out = [];
  for (const n of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, n);
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...walkFiles(p, base));
    else if (st.isFile()) out.push({ rel: path.relative(base, p), abs: p, mode: st.mode & 0o777 });
  }
  return out;
}

// ---------------------------------------------------------------- planos (lista de operações)
// op = { path, kind: 'file'|'block'|'hooks'|'copy', content?, inner?, start?, end?, command?, src?, mode? }
export function planRepo(core, repoRoot) {
  const ops = [];
  const bundle = renderBundle(core);
  ops.push({ path: path.join(repoRoot, 'machine/export/AGENTS.md'), kind: 'file', content: bundle });
  ops.push({ path: path.join(repoRoot, 'machine/export/HARNESS.md'), kind: 'file', content: bundle });
  for (const s of core.skills) {
    for (const [rel, content] of Object.entries(renderSkill(core, s))) {
      ops.push({ path: path.join(repoRoot, 'machine/export/skills', s.name, rel), kind: 'file', content });
    }
  }
  if (core.execRules) {
    const inner = [
      `> Gerado de \`core/${core.manifest.executionRulesForAgentRules}\` por sync-rules.js (fonte única). Não edite aqui.`,
      '',
      demoteHeadings(core.execRules.replace(/\n$/, ''), 1).replace(/^## .*$/m, '## 1.1 Execução unificada (R1–R9) — paralelismo, worktree, tentativas, portões, browser, versões'),
    ].join('\n');
    ops.push({ path: path.join(repoRoot, 'template/AGENT_RULES.md'), kind: 'block', inner, start: AR_START, end: AR_END, mustExist: true });
  }
  return ops;
}

export function planProject(core, target, { repoRoot = null } = {}) {
  const ops = [];
  const bundle = renderBundle(core);
  const harnessCore = path.join(target, '.harness/core');
  if (path.resolve(core.coreDir) !== path.resolve(harnessCore)) {
    for (const f of walkFiles(core.coreDir)) {
      if (f.rel.split(path.sep)[0] === 'decisoes') continue; // registro de decisões do próprio harness
      ops.push({ path: path.join(harnessCore, f.rel), kind: 'copy', src: f.abs, mode: 0o644 });
    }
  }
  ops.push({ path: path.join(target, 'AGENTS.md'), kind: 'block', inner: bundle.replace(/\n$/, '') });
  ops.push({ path: path.join(target, 'CLAUDE.md'), kind: 'block', inner: renderClaudeBlock(core) });
  for (const r of core.manifest.conditionalRules || []) {
    ops.push({ path: path.join(target, '.agents/rules', `${r.id}.md`), kind: 'file', content: renderAgyRule(core, r) });
    ops.push({ path: path.join(target, '.cursor/rules', `${r.id}.mdc`), kind: 'file', content: renderCursorRule(core, r) });
  }
  for (const s of core.skills) {
    const files = renderSkill(core, s);
    for (const root of ['.agents/skills', '.claude/skills']) {
      for (const [rel, content] of Object.entries(files)) ops.push({ path: path.join(target, root, s.name, rel), kind: 'file', content });
    }
  }
  const hookRel = `.harness/tools/hooks/${HOOK_SCRIPT}`;
  const hookSrc = repoRoot ? path.join(repoRoot, 'machine/hooks', HOOK_SCRIPT) : null;
  if (hookSrc && fs.existsSync(hookSrc)) ops.push({ path: path.join(target, hookRel), kind: 'copy', src: hookSrc, mode: 0o755 });
  ops.push({ path: path.join(target, '.codex/hooks.json'), kind: 'hooks', command: codexHookCommand(hookRel) });
  return ops;
}

export function planGlobal(core, repoRoot, home) {
  const ops = [];
  const bundle = renderBundle(core);
  ops.push({ path: path.join(home, '.claude/HARNESS.md'), kind: 'file', content: bundle });
  ops.push({ path: path.join(home, '.codex/AGENTS.md'), kind: 'block', inner: bundle.replace(/\n$/, '') });
  ops.push({ path: path.join(home, '.gemini/GEMINI.md'), kind: 'block', inner: bundle.replace(/\n$/, '') });
  // ~/AGENTS.md: legado da v1 (Codex NÃO lê este caminho). Só atualiza se já for nosso.
  const legacy = path.join(home, 'AGENTS.md');
  if (fs.existsSync(legacy)) {
    const cur = fs.readFileSync(legacy, 'utf8');
    if (cur.includes(START)) ops.push({ path: legacy, kind: 'block', inner: bundle.replace(/\n$/, '') });
    else if (/^# V-JP Harness — Regras Globais/.test(cur)) ops.push({ path: legacy, kind: 'file', content: upsertBlock('', bundle.replace(/\n$/, '')) });
  }
  const skillsDir = path.join(repoRoot, 'machine/export/skills');
  const targets = ['.claude/skills', '.agents/skills', '.gemini/config/skills', '.gemini/antigravity-cli/skills'];
  const generated = new Map();
  for (const s of core.skills) generated.set(s.name, renderSkill(core, s));
  for (const name of listRealSkills(skillsDir)) {
    if (generated.has(name)) continue; // vem renderizada do core logo abaixo (não do export)
    for (const f of walkFiles(path.join(skillsDir, name))) {
      for (const t of targets) ops.push({ path: path.join(home, t, name, f.rel), kind: 'copy', src: f.abs, mode: f.mode & 0o111 ? 0o755 : 0o644 });
    }
  }
  for (const [name, files] of generated) {
    for (const t of targets) for (const [rel, content] of Object.entries(files)) ops.push({ path: path.join(home, t, name, rel), kind: 'file', content });
  }
  return ops;
}

// ---------------------------------------------------------------- execução
function desiredOf(op) {
  const exists = fs.existsSync(op.path);
  const cur = exists ? fs.readFileSync(op.path) : null;
  let want;
  if (op.kind === 'file') want = Buffer.from(op.content, 'utf8');
  else if (op.kind === 'copy') want = fs.readFileSync(op.src);
  else if (op.kind === 'block') {
    if (op.mustExist && !exists) throw new Error(`arquivo esperado não existe: ${op.path}`);
    if (op.mustExist && !cur.toString('utf8').includes(op.start)) throw new Error(`marcador ${op.start} ausente em ${op.path}`);
    want = Buffer.from(upsertBlock(cur ? cur.toString('utf8') : null, op.inner, op.start || START, op.end || END), 'utf8');
  } else if (op.kind === 'hooks') want = Buffer.from(mergeCodexHooks(cur ? cur.toString('utf8') : '', op.command), 'utf8');
  else throw new Error(`op desconhecida: ${op.kind}`);
  let modeDrift = false;
  if (exists && op.mode != null) modeDrift = ((fs.statSync(op.path).mode & 0o777) & 0o111) !== (op.mode & 0o111);
  const same = cur != null && cur.equals(want) && !modeDrift;
  return { want, same, exists };
}

export function applyOps(ops, { check = false } = {}) {
  const changed = [];
  const seen = new Set();
  for (const op of ops) {
    if (seen.has(op.path)) throw new Error(`destino duplicado no plano: ${op.path}`);
    seen.add(op.path);
    const { want, same, exists } = desiredOf(op);
    if (same) continue;
    changed.push({ path: op.path, action: exists ? 'atualizar' : 'criar' });
    if (!check) {
      fs.mkdirSync(path.dirname(op.path), { recursive: true });
      fs.writeFileSync(op.path, want);
      if (op.mode != null) fs.chmodSync(op.path, op.mode);
    }
  }
  return { total: ops.length, changed };
}

// ---------------------------------------------------------------- detecção de layout
export function detectLayout(scriptDir, { core = null, repoRoot = null } = {}) {
  const isRepo = (d) => d && fs.existsSync(path.join(d, 'core/manifest.json')) && fs.existsSync(path.join(d, 'machine')) && fs.existsSync(path.join(d, 'template'));
  const up2 = path.resolve(scriptDir, '../..');
  const up1 = path.resolve(scriptDir, '..');
  const root = repoRoot ? path.resolve(repoRoot) : (isRepo(up2) ? up2 : null);
  let coreDir = core ? path.resolve(core) : null;
  let installedTarget = null;
  if (!coreDir) {
    if (root) coreDir = path.join(root, 'core');
    else if (fs.existsSync(path.join(up1, 'core/manifest.json'))) { coreDir = path.join(up1, 'core'); installedTarget = path.resolve(up1, '..'); }
  }
  if (!root && !installedTarget && fs.existsSync(path.join(up1, 'core/manifest.json'))) installedTarget = path.resolve(up1, '..');
  return { repoRoot: root, coreDir, installedTarget };
}

function parseArgs(argv) {
  const a = { mode: null, check: false, list: false, quiet: false, target: null, home: null, core: null, repoRoot: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const val = () => { const v = argv[++i]; if (!v || v.startsWith('--')) throw new Error(`${k} exige um valor`); return v; };
    if (k === '--repo') a.mode = 'repo';
    else if (k === '--global') a.mode = 'global';
    else if (k === '--target') { a.mode = 'project'; a.target = val(); }
    else if (k === '--home') a.home = val();
    else if (k === '--core') a.core = val();
    else if (k === '--repo-root') a.repoRoot = val();
    else if (k === '--check') a.check = true;
    else if (k === '--list') a.list = true;
    else if (k === '--quiet') a.quiet = true;
    else if (k === '--help' || k === '-h') a.help = true;
    else throw new Error(`opção desconhecida: ${k}`);
  }
  return a;
}

export function main(argv = process.argv.slice(2), scriptDir = path.dirname(fileURLToPath(import.meta.url))) {
  if (argv.includes('--eval')) {
    const extra = argv.filter((a) => a !== '--eval');
    const r = spawnSync(process.execPath, [path.join(scriptDir, 'rules-eval.js'), ...extra], { stdio: 'inherit' });
    return r.status == null ? 2 : r.status;
  }
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error(`✗ ${e.message} (use --help)`); return 2; }
  if (args.help) {
    const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
    console.log(src.split('*/')[0].replace(/^#!.*\n\/\*\*\n?/, '').replace(/^ \* ?/gm, ''));
    return 0;
  }
  try {
    const lay = detectLayout(scriptDir, { core: args.core, repoRoot: args.repoRoot });
    if (!lay.coreDir) throw new Error('não achei core/ (rode de dentro do vjp-harness ou de .harness/tools, ou use --core)');
    const mode = args.mode || (lay.repoRoot ? 'repo' : 'project');
    const core = loadCore(lay.coreDir);
    let ops;
    if (mode === 'repo') {
      if (!lay.repoRoot) throw new Error('--repo exige a raiz do vjp-harness');
      ops = planRepo(core, lay.repoRoot);
    } else if (mode === 'global') {
      if (!lay.repoRoot) throw new Error('--global exige a raiz do vjp-harness (skills em machine/export/skills)');
      ops = planGlobal(core, lay.repoRoot, path.resolve(args.home || os.homedir()));
    } else {
      const target = path.resolve(args.target || lay.installedTarget || '');
      if (!args.target && !lay.installedTarget) throw new Error('modo projeto exige --target <dir>');
      if (!fs.existsSync(target)) throw new Error(`alvo não existe: ${target}`);
      ops = planProject(core, target, { repoRoot: lay.repoRoot });
    }
    if (args.list) { for (const op of ops) console.log(`${op.kind.padEnd(5)} ${op.path}`); return 0; }
    const { total, changed } = applyOps(ops, { check: args.check });
    if (!args.quiet) for (const c of changed) console.log(`${args.check ? 'DRIFT' : c.action.padEnd(9)} ${c.path}`);
    if (args.check) {
      if (changed.length) { console.error(`✗ sync-rules --check (${mode}): ${changed.length}/${total} destino(s) fora do core/. Rode sem --check para regenerar.`); return 1; }
      console.log(`✔ sync-rules --check (${mode}): ${total} destino(s) em dia com core/ v${core.manifest.version}`);
      return 0;
    }
    console.log(`✔ sync-rules (${mode}): ${changed.length} alterado(s), ${total - changed.length} já em dia — core/ v${core.manifest.version}`);
    return 0;
  } catch (e) {
    console.error(`✗ sync-rules: ${e.message}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
