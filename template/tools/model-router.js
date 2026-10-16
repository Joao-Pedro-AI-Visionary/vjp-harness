#!/usr/bin/env node

/**
 * Roteador de modelo por fase. Uma tabela só; install/bootstrap gravam o que cada CLI lê.
 *
 * Fontes (não inventar flag):
 * - Claude Code: alias `model` + `experimental.cacheTtl` — code.claude.com/docs/en/sub-agents
 *   e code.claude.com/docs/en/prompt-caching. Aliases opus/sonnet. Cache 1h só no
 *   frontmatter do subagente (não no settings global: `subagentPromptCacheTtl` vale
 *   para TODOS e ainda ganha do frontmatter).
 * - Cursor: `model` em .cursor/agents/*.md — cursor.com/docs/subagents.
 *   IDs: `claude-opus-5-5` (o doc publica o fast tier `claude-opus-5-5-fast`) e
 *   `claude-sonnet-5-5` (página cursor.com/docs/models/claude-sonnet-5-5, mesmo
 *   padrão de id). Sem campo de TTL de cache no frontmatter do Cursor.
 * - Codex: `model` + `model_reasoning_effort` em .codex/agents/*.toml —
 *   learn.chatgpt.com/docs/agent-configuration/subagents. Pares do exemplo oficial:
 *   gpt-6.1-sol/medium (fase forte) e gpt-6-luna/high (fase rápida). A config
 *   reference não tem TTL de prompt cache por agente.
 * - AGY: settings.json não tem chave de modelo (antigravity.google/docs/cli/reference).
 *   `modelProvider: gemini` troca o login para API key e a CLI não sobe sem
 *   GEMINI_API_KEY. O padrão da sessão já é Gemini (`/model`). Não gravamos chave.
 *
 * (A camada LLM própria do Maestro — llm.js/phaseModels — saiu na v2.2.0.)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const AGENTS_SRC = path.join(HERE, '..', 'agents');

/** Fase do pipeline. strong = julgamento; fast = varredura/implementação. */
export const PHASE_TIER = {
  planner: 'strong',
  reviewer: 'strong',
  researcher: 'fast',
  executor: 'fast',
};

/**
 * id do agente (arquivo ou agentId do Maestro) → fase.
 * integration-verifier julga (reviewer) e espera teste (cache à parte).
 * contract fica de fora: o pedido não atribui fase a ele.
 */
export const AGENT_PHASE = {
  planner: 'planner',
  'nfr-planner': 'planner',
  'nfr-performance-planner': 'planner',
  reviewer: 'reviewer',
  'integration-verifier': 'reviewer',
  researcher: 'researcher',
  executor: 'executor',
  'backend-specialist': 'executor',
  'frontend-specialist': 'executor',
  'db-migration-specialist': 'executor',
};

/** Quem fica parado em teste/build. Doc: experimental.cacheTtl 1h. */
export const CACHE_1H = new Set([
  'executor',
  'backend-specialist',
  'frontend-specialist',
  'db-migration-specialist',
  'integration-verifier',
]);

export const CLI_MODELS = {
  claude: { strong: 'opus', fast: 'sonnet' },
  cursor: { strong: 'claude-opus-5-5', fast: 'claude-sonnet-5-5' },
  codex: {
    strong: { model: 'gpt-6.1-sol', model_reasoning_effort: 'medium' },
    fast: { model: 'gpt-6-luna', model_reasoning_effort: 'high' },
  },
};

export const CLAUDE_CACHE_TTL = '1h';

export const AGY_MODEL = {
  applied: false,
  default: 'gemini',
  reason: 'Sem chave documentada de modelo em settings.json. modelProvider=gemini exige GEMINI_API_KEY e abandona o login da conta. A CLI já nasce em Gemini.',
};

export function phaseOfAgent(agentId) {
  if (!agentId) return null;
  if (agentId.startsWith('executor:')) return 'executor';
  return AGENT_PHASE[agentId] || null;
}

export function tierOfAgent(agentId) {
  const phase = phaseOfAgent(agentId);
  return phase ? PHASE_TIER[phase] : null;
}

export function claudeModel(agentId) {
  const tier = tierOfAgent(agentId);
  return tier ? CLI_MODELS.claude[tier] : null;
}

export function cursorModel(agentId) {
  const tier = tierOfAgent(agentId);
  return tier ? CLI_MODELS.cursor[tier] : null;
}

export function codexModel(agentId) {
  const tier = tierOfAgent(agentId);
  return tier ? { ...CLI_MODELS.codex[tier] } : null;
}

export function wantsCache1h(agentId) {
  return CACHE_1H.has(agentId);
}

export function readFrontmatter(md) {
  const m = String(md).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { raw: '', body: String(md), fields: {} };
  const raw = m[1];
  const body = String(md).slice(m[0].length).replace(/^\r?\n/, '');
  const fields = {};
  const lines = raw.split(/\r?\n/);
  let key = null;
  for (const line of lines) {
    const nested = line.match(/^  ([A-Za-z0-9_]+):\s*(.*)$/);
    if (nested && key) {
      fields[key] = fields[key] && typeof fields[key] === 'object' ? fields[key] : {};
      fields[key][nested[1]] = unquote(nested[2]);
      continue;
    }
    const top = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (top) {
      key = top[1];
      fields[key] = top[2] === '' ? {} : unquote(top[2]);
    }
  }
  return { raw, body, fields };
}

function unquote(v) {
  const s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function expectedClaudeFrontmatter(name) {
  return {
    model: claudeModel(name),
    cacheTtl: wantsCache1h(name) ? CLAUDE_CACHE_TTL : null,
  };
}

/** Confere os .md de template/agents contra a tabela. Retorna lista de erros. */
export function checkAgentSources(dir = AGENTS_SRC) {
  const errors = [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const seen = new Set();
  for (const file of files) {
    const name = file.replace(/\.md$/, '');
    seen.add(name);
    if (!AGENT_PHASE[name]) {
      errors.push(`${file}: sem fase no roteador`);
      continue;
    }
    const fm = readFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    const want = expectedClaudeFrontmatter(name);
    if (fm.fields.model !== want.model) {
      errors.push(`${file}: model=${fm.fields.model || '(vazio)'} esperado ${want.model}`);
    }
    const gotTtl = fm.fields.experimental && fm.fields.experimental.cacheTtl;
    if ((gotTtl || null) !== want.cacheTtl) {
      errors.push(`${file}: cacheTtl=${gotTtl || '(nenhum)'} esperado ${want.cacheTtl || '(nenhum)'}`);
    }
    if (String(fm.fields.model || '').toLowerCase().includes('fable')) {
      errors.push(`${file}: modelo fable é proibido`);
    }
  }
  for (const name of Object.keys(AGENT_PHASE)) {
    if (name === 'nfr-planner') continue; // id do Maestro, não é arquivo
    if (!seen.has(name)) errors.push(`falta template/agents/${name}.md`);
  }
  return errors;
}

function yamlQuote(v) {
  return JSON.stringify(String(v));
}

export function renderCursorAgent(md) {
  const { fields, body } = readFrontmatter(md);
  const name = fields.name;
  const model = cursorModel(name);
  if (!model) throw new Error(`sem modelo Cursor para ${name}`);
  return [
    '---',
    `name: ${yamlQuote(name)}`,
    `description: ${yamlQuote(fields.description || '')}`,
    `model: ${yamlQuote(model)}`,
    '---',
    '',
    body.replace(/\s*$/, '\n'),
  ].join('\n');
}

function tomlBasic(s) {
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`;
}

export function renderCodexAgent(md) {
  const { fields, body } = readFrontmatter(md);
  const spec = codexModel(fields.name);
  if (!spec) throw new Error(`sem modelo Codex para ${fields.name}`);
  if (body.includes('"""')) throw new Error(`${fields.name}: corpo contém """ e quebraria o TOML`);
  return [
    `name = ${tomlBasic(fields.name)}`,
    `description = ${tomlBasic(fields.description || '')}`,
    `model = ${tomlBasic(spec.model)}`,
    `model_reasoning_effort = ${tomlBasic(spec.model_reasoning_effort)}`,
    'developer_instructions = """',
    body.replace(/\s*$/, ''),
    '"""',
    '',
  ].join('\n');
}

function listAgentMarkdown(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
}

/**
 * Grava os artefatos que a CLI lê sozinha.
 * scope 'project': <root>/.claude|cursor|codex
 * scope 'user': <root>/.claude|cursor|codex (root = HOME)
 */
export function applyModels(root, { src = AGENTS_SRC } = {}) {
  const errors = checkAgentSources(src);
  if (errors.length) throw new Error(`fontes do roteador divergiram:\n${errors.join('\n')}`);
  const claudeDir = path.join(root, '.claude', 'agents');
  const cursorDir = path.join(root, '.cursor', 'agents');
  const codexDir = path.join(root, '.codex', 'agents');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(cursorDir, { recursive: true });
  fs.mkdirSync(codexDir, { recursive: true });
  const written = [];
  for (const file of listAgentMarkdown(src)) {
    const md = fs.readFileSync(path.join(src, file), 'utf8');
    const claudePath = path.join(claudeDir, file);
    const cursorPath = path.join(cursorDir, file);
    const codexPath = path.join(codexDir, file.replace(/\.md$/, '.toml'));
    fs.writeFileSync(claudePath, md.endsWith('\n') ? md : `${md}\n`);
    fs.writeFileSync(cursorPath, renderCursorAgent(md));
    fs.writeFileSync(codexPath, renderCodexAgent(md));
    written.push(claudePath, cursorPath, codexPath);
  }
  return written;
}

function argAfter(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const project = argAfter('--apply');
  const home = argAfter('--apply-user');
  if (!check && !project && !home) {
    console.error('uso: node model-router.js --check | --apply <projeto> | --apply-user <home>');
    process.exit(2);
  }
  if (check) {
    const errors = checkAgentSources();
    if (errors.length) {
      console.error(errors.join('\n'));
      process.exit(1);
    }
    console.log(`model-router ok (${Object.keys(AGENT_PHASE).length} ids)`);
  }
  if (project) {
    const n = applyModels(path.resolve(project)).length;
    console.log(`model-router: ${n} arquivo(s) em ${project}`);
  }
  if (home) {
    const n = applyModels(path.resolve(home)).length;
    console.log(`model-router: ${n} arquivo(s) em ${home} (user)`);
  }
}
