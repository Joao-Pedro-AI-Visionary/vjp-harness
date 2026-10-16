// v2.0.0 — sync-rules.js: a fonte única core/ renderizada para Codex, Claude Code, AGY e Cursor.
// Prova determinismo, idempotência (--check), preservação de conteúdo alheio e limites de tamanho.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  START, END, upsertBlock, loadCore, renderBundle, renderSkill, renderAgyRule, renderCursorRule,
  renderClaudeBlock, mergeCodexHooks, codexHookCommand, planProject, planGlobal, planRepo, applyOps,
  listRealSkills, HOOK_SCRIPT, main,
} from '../sync-rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..', '..');
// No vjp-harness: core/ na raiz. Num projeto instalado (.harness/tools/tests): .harness/core e sem machine/.
const IN_REPO = fs.existsSync(path.join(REPO, 'core/manifest.json')) && fs.existsSync(path.join(REPO, 'machine/export'));
const CORE = IN_REPO ? path.join(REPO, 'core') : path.resolve(__dirname, '..', '..', 'core');
const onlyRepo = { skip: IN_REPO ? false : 'só no repo vjp-harness (precisa de machine/)' };
const core = loadCore(CORE);
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), `vjp-sync-${p}-`));
const silence = (fn) => { const l = console.log, e = console.error; console.log = () => {}; console.error = () => {}; try { return fn(); } finally { console.log = l; console.error = e; } };

test('manifest.version acompanha o VERSION do repo (no projeto: registry.harnessVersion)', () => {
  const v = IN_REPO
    ? fs.readFileSync(path.join(REPO, 'VERSION'), 'utf8').trim()
    : JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'registry.json'), 'utf8')).harnessVersion;
  assert.equal(core.manifest.version, v);
});

test('bundle é determinístico, contém a sentinela e cabe no limite do AGY (24.000 bytes)', () => {
  const a = renderBundle(core), b = renderBundle(loadCore(CORE));
  assert.equal(a, b);
  assert.ok(a.includes(core.manifest.sentinel));
  assert.ok(Buffer.byteLength(a) <= 24000, `bundle com ${Buffer.byteLength(a)} bytes`);
  assert.ok(!/\r/.test(a));
  assert.ok(a.includes('1. **Fase 0 — Ambiente:**'), 'primeiro item do checklist de projeto novo');
});

test('bundle acima do limite falha em vez de truncar em silêncio', () => {
  const fake = { ...core, manifest: { ...core.manifest, limits: { bundleMaxBytes: 100 } } };
  assert.throws(() => renderBundle(fake), /limite 100/);
});

test('Diretrizes de colaboração técnica do João (substituem Comportamento e Tom) estão em core/11', () => {
  const t = fs.readFileSync(path.join(CORE, '11-comportamento-e-tom.md'), 'utf8');
  for (const frase of [
    'Sentinela colaboração: discordar só com fundamento, apontar a falha real e nunca inventar problema.',
    'sem inventar discordância para parecer crítico',
    '(1) a premissa/decisão problemática; (2) a evidência ou razão técnica; (3) o risco concreto para este projeto; (4) uma alternativa viável e seus trade-offs',
    'Se o João escolher conscientemente um trade-off legítimo, respeite',
    'Sem problemas relevantes, diga isso sem inventar defeitos',
  ]) assert.ok(t.includes(frase), `faltou: ${frase}`);
});

test('upsertBlock: cria, substitui (migra bloco v1) e preserva conteúdo alheio — idempotente', () => {
  assert.equal(upsertBlock(null, 'X'), `${START}\nX\n${END}\n`);
  const v1 = `# Meu projeto\n\nregra minha\n\n${START}\n## bloco antigo v1 (.harness/AGENT_RULES.md)\n${END}\n\nrodapé meu\n`;
  const once = upsertBlock(v1, 'NOVO');
  assert.ok(once.startsWith('# Meu projeto\n\nregra minha\n\n'));
  assert.ok(once.endsWith('\n\nrodapé meu\n'));
  assert.ok(!once.includes('bloco antigo v1'));
  assert.equal(upsertBlock(once, 'NOVO'), once);
  assert.equal(upsertBlock('conteúdo do usuário\n', 'B'), `conteúdo do usuário\n\n${START}\nB\n${END}\n`);
});

test('regra AGY começa com frontmatter de trigger válido; trigger inválido é recusado', () => {
  const r = core.manifest.conditionalRules[0];
  const out = renderAgyRule(core, r);
  assert.match(out, /^---\ntrigger: model_decision\ndescription: ".+"\n---\n/);
  assert.throws(() => renderAgyRule(core, { ...r, trigger: 'modelDecision' }), /descartada em silêncio/);
  const mdc = renderCursorRule(core, r);
  assert.match(mdc, /^---\ndescription: .+\nglobs:\nalwaysApply: false\n---\n/);
});

test('skill projeto-novo: frontmatter name/description e uma referência por fase (0–12)', () => {
  const files = renderSkill(core, core.skills[0]);
  assert.match(files['SKILL.md'], /^---\nname: projeto-novo\ndescription: ".+"\n---\n/);
  const refs = Object.keys(files).filter((k) => k.startsWith('references/'));
  assert.equal(refs.length, 13);
  assert.ok(files['SKILL.md'].includes('FORMATO OBRIGATÓRIO DE INICIALIZAÇÃO'));
});

test('CLAUDE.md usa @imports reais para cada módulo always-on', () => {
  const block = renderClaudeBlock(core);
  for (const rel of core.manifest.alwaysOn) assert.ok(block.includes(`\n@.harness/core/${rel}`), rel);
});

test('mergeCodexHooks: preserva hook alheio, migra o caminho relativo antigo e é idempotente', () => {
  const cmd = codexHookCommand(`.harness/tools/hooks/${HOOK_SCRIPT}`);
  assert.match(cmd, /git rev-parse --show-toplevel/);
  const old = JSON.stringify({ comment: 'x', hooks: { PreToolUse: [
    { matcher: 'Bash', hooks: [{ type: 'command', command: 'python3 ~/.codex/hooks/meu.py' }] },
    { matcher: 'Bash|apply_patch|Edit|Write', hooks: [{ type: 'command', command: `machine/hooks/${HOOK_SCRIPT}` }] },
  ] } });
  const once = mergeCodexHooks(old, cmd);
  const obj = JSON.parse(once);
  assert.equal(obj.hooks.PreToolUse.length, 2);
  assert.equal(obj.hooks.PreToolUse[0].hooks[0].command, 'python3 ~/.codex/hooks/meu.py');
  assert.equal(obj.hooks.PreToolUse[1].hooks[0].command, cmd);
  assert.equal(mergeCodexHooks(once, cmd), once);
  assert.throws(() => mergeCodexHooks('{quebrado', cmd), /não sobrescrevo/);
  assert.equal(JSON.parse(mergeCodexHooks('', cmd)).hooks.PreToolUse.length, 1);
  const withSession = JSON.parse(mergeCodexHooks('', cmd, 'exec bash cli-session-start.sh codex'));
  assert.equal(withSession.hooks.SessionStart[0].matcher, 'startup|resume|clear|compact|fork');
  assert.equal(withSession.hooks.PreToolUse.length, 1);
  assert.equal(mergeCodexHooks(JSON.stringify(withSession), cmd, 'exec bash cli-session-start.sh codex'), JSON.stringify(withSession, null, 2) + '\n');
});

test('modo projeto: aplica, segunda rodada não muda nada e --check fica verde', onlyRepo, () => {
  const d = tmp('proj');
  fs.writeFileSync(path.join(d, 'AGENTS.md'), '# Regras do time\n\nusar pnpm\n');
  const ops = planProject(core, d, { repoRoot: REPO });
  const r1 = applyOps(ops);
  assert.ok(r1.changed.length > 0);
  assert.equal(applyOps(planProject(core, d, { repoRoot: REPO })).changed.length, 0);
  assert.equal(applyOps(planProject(core, d, { repoRoot: REPO }), { check: true }).changed.length, 0);
  const agents = fs.readFileSync(path.join(d, 'AGENTS.md'), 'utf8');
  assert.ok(agents.startsWith('# Regras do time\n\nusar pnpm\n'));
  assert.ok(agents.includes(core.manifest.sentinel));
  const claude = fs.readFileSync(path.join(d, 'CLAUDE.md'), 'utf8');
  for (const m of claude.matchAll(/^@(\S+)$/gm)) assert.ok(fs.existsSync(path.join(d, m[1])), `import quebrado: ${m[1]}`);
  for (const p of ['.agents/rules/vjp-projeto-novo.md', '.agents/rules/vjp-cli.md', '.cursor/rules/vjp-projeto-novo.mdc', '.cursor/rules/vjp-cli.mdc', '.agents/skills/projeto-novo/SKILL.md',
    '.claude/skills/projeto-novo/SKILL.md', `.harness/tools/hooks/${HOOK_SCRIPT}`, '.harness/tools/hooks/cli-session-start.sh', '.codex/hooks.json', '.codex/vjp-cli.json', '.claude/settings.json']) {
    assert.ok(fs.existsSync(path.join(d, p)), p);
  }
  assert.equal(fs.existsSync(path.join(d, '.codex/config.toml')), false, 'config.toml não é criado sem chave oficial para gravar');
  if (process.platform !== 'win32') assert.ok(fs.statSync(path.join(d, `.harness/tools/hooks/${HOOK_SCRIPT}`)).mode & 0o100, 'hook executável');
  const codexHooks = JSON.parse(fs.readFileSync(path.join(d, '.codex/hooks.json'), 'utf8'));
  assert.equal(codexHooks.hooks.SessionStart[0].matcher, 'startup|resume|clear|compact|fork');
  assert.match(codexHooks.hooks.SessionStart[0].hooks[0].command, /cli-session-start\.sh/);
  assert.match(codexHooks.hooks.SessionStart[0].hooks[0].command, / codex$/);
  assert.match(codexHooks.hooks.SessionStart[0].hooks[0].commandWindows, /cli-session-start\.mjs/);
  assert.match(codexHooks.hooks.SessionStart[0].hooks[0].commandWindows, /^node /);
  const legacyToml = '# vjp-harness:codex:start\n[features]\nworktrees = true\n# vjp-harness:codex:end\n';
  fs.writeFileSync(path.join(d, '.codex/config.toml'), legacyToml);
  applyOps(planProject(core, d, { repoRoot: REPO }));
  assert.doesNotMatch(fs.readFileSync(path.join(d, '.codex/config.toml'), 'utf8'), /worktrees\s*=/);
  const map = JSON.parse(fs.readFileSync(path.join(d, '.codex/vjp-cli.json'), 'utf8'));
  assert.equal(map.managedRoot, '$CODEX_HOME/worktrees');
  assert.equal(map.maestroRoot, '.bsd/worktrees/<feature>');
  assert.match(fs.readFileSync(path.join(d, '.agents/rules/vjp-cli.md'), 'utf8'), /^---\ntrigger: always_on\n/);
  assert.match(fs.readFileSync(path.join(d, '.cursor/rules/vjp-cli.mdc'), 'utf8'), /alwaysApply: true\n/);
  const claudeSettings = JSON.parse(fs.readFileSync(path.join(d, '.claude/settings.json'), 'utf8'));
  assert.match(claudeSettings.hooks.SessionStart[0].hooks[0].command, / claude$/);
  assert.ok(!fs.existsSync(path.join(d, '.harness/core/decisoes')), 'decisoes/ do harness não vai para o projeto');
  // drift: editar arquivo gerado à mão é acusado pelo --check
  fs.appendFileSync(path.join(d, '.agents/rules/vjp-projeto-novo.md'), 'edição manual\n');
  assert.equal(applyOps(planProject(core, d, { repoRoot: REPO }), { check: true }).changed.length, 1);
});

test('modo global (HOME temporário): ~/.codex/AGENTS.md, GEMINI.md, HARNESS.md e fan-out das skills', onlyRepo, () => {
  const home = tmp('home');
  fs.writeFileSync(path.join(home, 'AGENTS.md'), '# V-JP Harness — Regras Globais (núcleo de todos os projetos)\nv1 velho\n');
  fs.mkdirSync(path.join(home, '.gemini'), { recursive: true });
  fs.writeFileSync(path.join(home, '.gemini/GEMINI.md'), 'minhas regras gemini\n');
  const r1 = applyOps(planGlobal(core, REPO, home));
  assert.ok(r1.changed.length > 0);
  assert.equal(applyOps(planGlobal(core, REPO, home), { check: true }).changed.length, 0);
  assert.ok(fs.readFileSync(path.join(home, '.codex/AGENTS.md'), 'utf8').includes(core.manifest.sentinel));
  const userHooks = JSON.parse(fs.readFileSync(path.join(home, '.codex/hooks.json'), 'utf8'));
  assert.equal(userHooks.hooks.PreToolUse, undefined);
  assert.match(userHooks.hooks.SessionStart[0].hooks[0].command, /cli-session-start\.sh/);
  assert.match(userHooks.hooks.SessionStart[0].hooks[0].commandWindows, /cli-session-start\.mjs/);
  assert.match(userHooks.hooks.SessionStart[0].hooks[0].command, / codex$/);
  const userClaude = JSON.parse(fs.readFileSync(path.join(home, '.claude/settings.json'), 'utf8'));
  assert.match(userClaude.hooks.SessionStart[0].hooks[0].command, / claude$/);
  const gem = fs.readFileSync(path.join(home, '.gemini/GEMINI.md'), 'utf8');
  assert.ok(gem.startsWith('minhas regras gemini\n') && gem.includes(START));
  const legacy = fs.readFileSync(path.join(home, 'AGENTS.md'), 'utf8');
  assert.ok(!legacy.includes('v1 velho') && legacy.includes(core.manifest.sentinel));
  const real = listRealSkills(path.join(REPO, 'machine/export/skills'));
  assert.ok(real.includes('projeto-novo') && real.includes('test-gate') && !real.includes('autoplan'));
  for (const t of ['.claude/skills', '.agents/skills', '.gemini/config/skills', '.gemini/antigravity-cli/skills']) {
    for (const s of real) assert.ok(fs.existsSync(path.join(home, t, s, 'SKILL.md')), `${t}/${s}`);
  }
  if (process.platform !== 'win32') assert.ok(fs.statSync(path.join(home, '.agents/skills/prepush/scripts/gate.sh')).mode & 0o100, 'script de skill segue executável');
});

test('modo global não toca ~/AGENTS.md que não é do harness', onlyRepo, () => {
  const home = tmp('home2');
  fs.writeFileSync(path.join(home, 'AGENTS.md'), 'arquivo do usuário\n');
  applyOps(planGlobal(core, REPO, home));
  assert.equal(fs.readFileSync(path.join(home, 'AGENTS.md'), 'utf8'), 'arquivo do usuário\n');
});

test('repo: artefatos versionados estão em dia com core/ (sync-rules --check)', onlyRepo, () => {
  assert.equal(applyOps(planRepo(core, REPO), { check: true }).changed.length, 0, 'rode: node template/tools/sync-rules.js');
  assert.equal(silence(() => main(['--check', '--quiet'], path.join(REPO, 'template/tools'))), 0);
});

test('saídas geradas sem e-mail nem rastro pessoal/empresa', onlyRepo, () => {
  const d = tmp('trace');
  applyOps(planProject(core, d, { repoRoot: REPO }));
  const all = [renderBundle(core), ...Object.values(renderSkill(core, core.skills[0])), fs.readFileSync(path.join(d, 'CLAUDE.md'), 'utf8')].join('\n');
  assert.doesNotMatch(all, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
  // Nomes de pessoa/empresa proibidos vêm do ambiente (não ficam escritos no repo): VJP_TRACE_DENYLIST="nome1,nome2"
  const deny = (process.env.VJP_TRACE_DENYLIST || '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
  for (const w of deny) assert.ok(!all.toLowerCase().includes(w), 'rastro proibido presente nas saídas geradas');
});

test('CLI: opção desconhecida sai 2; modo projeto sem alvo sai 2', onlyRepo, () => {
  assert.equal(silence(() => main(['--nao-existe'])), 2);
  assert.equal(silence(() => main(['--target', path.join(os.tmpdir(), 'nao-existe-vjp-xyz')], path.join(REPO, 'template/tools'))), 2);
});
