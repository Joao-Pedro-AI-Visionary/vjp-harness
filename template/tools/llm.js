#!/usr/bin/env node

/**
 * V-JP Harness: Camada LLM provider-agnostic.
 *
 * Adapters: openai (compatível — CLIProxyAPI/OpenAI/Together/…), anthropic, ollama.
 * Sem dependências externas: usa fetch nativo (Node ≥18). Modelo pinado = determinismo.
 *
 * API:
 *   loadLlmConfig(harnessDir) -> { llm, agents, pipeline }
 *   chat({ system, user, cfg, agentId }) -> string   (conteúdo da resposta)
 *   checkConnectivity(cfg) -> { ok, detail }
 */

import fs from 'fs';
import path from 'path';

// Resolve a config efetiva do LLM combinando, em ordem de precedência:
//   1) overrides por ENV (VJP_LLM_*)  — para "rodar em qualquer lugar" sem editar arquivo
//   2) preset selecionado (cfg.llm.preset ou VJP_LLM_PRESET) — provider+baseUrl nomeados
//   3) bloco cfg.llm do agents.json
// Nada de modelo "pinado" obrigatório: o modelo é livre (qualquer provider OpenAI-compatible,
// anthropic ou ollama). Fixar um modelo é OPCIONAL e só serve p/ reproduzir um projeto.
export function loadLlmConfig(harnessDir) {
  const p = path.join(harnessDir, 'config', 'agents.json');
  if (!fs.existsSync(p)) throw new Error(`config/agents.json não encontrado em ${p}`);
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const presets = cfg.presets || {};
  const llm = { ...(cfg.llm || {}) };

  const presetName = process.env.VJP_LLM_PRESET || llm.preset;
  if (presetName) {
    const pr = presets[presetName];
    if (!pr) throw new Error(`Preset LLM desconhecido: "${presetName}" (disponíveis: ${Object.keys(presets).join(', ') || 'nenhum'})`);
    Object.assign(llm, { provider: pr.provider, baseUrl: pr.baseUrl }, pr.model ? { model: pr.model } : {});
  }
  // ENV overrides (ganham de tudo)
  if (process.env.VJP_LLM_PROVIDER) llm.provider = process.env.VJP_LLM_PROVIDER;
  if (process.env.VJP_LLM_BASE_URL) llm.baseUrl = process.env.VJP_LLM_BASE_URL;
  if (process.env.VJP_LLM_MODEL) llm.model = process.env.VJP_LLM_MODEL;
  if (process.env.VJP_LLM_API_KEY_ENV) llm.apiKeyEnv = process.env.VJP_LLM_API_KEY_ENV;

  if (!llm.provider) throw new Error('Provider LLM não definido. Use um preset, cfg.llm.provider ou VJP_LLM_PROVIDER.');
  return { ...cfg, llm };
}

function resolveModel(cfg, agentId) {
  const per = cfg.agents && cfg.agents[agentId];
  return (per && per.model) || cfg.llm.model;
}

function apiKey(cfg) {
  const env = cfg.llm.apiKeyEnv;
  return env ? (process.env[env] || '') : '';
}

async function withTimeout(promiseFactory, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await promiseFactory(ctrl.signal); }
  finally { clearTimeout(t); }
}

// temperature só entra se for número (modelos novos como Opus 4.8 rejeitam o campo).
function sampling(cfg) {
  return typeof cfg.llm.temperature === 'number' ? { temperature: cfg.llm.temperature } : {};
}

async function callOpenAI(cfg, agentId, system, user) {
  const base = (cfg.llm.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await withTimeout((signal) => fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey(cfg)}` },
    body: JSON.stringify({
      model: resolveModel(cfg, agentId),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      ...sampling(cfg),
      max_tokens: cfg.llm.maxTokens ?? 4096,
    }),
    signal,
  }), cfg.llm.timeoutMs ?? 180000);
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(cfg, agentId, system, user) {
  const base = (cfg.llm.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
  const res = await withTimeout((signal) => fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey(cfg),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: resolveModel(cfg, agentId),
      system,
      messages: [{ role: 'user', content: user }],
      ...sampling(cfg),
      max_tokens: cfg.llm.maxTokens ?? 4096,
    }),
    signal,
  }), cfg.llm.timeoutMs ?? 180000);
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return (j.content || []).map((b) => b.text || '').join('');
}

async function callOllama(cfg, agentId, system, user) {
  const base = (cfg.llm.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
  const res = await withTimeout((signal) => fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: resolveModel(cfg, agentId),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      stream: false,
      options: sampling(cfg),
    }),
    signal,
  }), cfg.llm.timeoutMs ?? 180000);
  if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return j.message?.content ?? '';
}

const ADAPTERS = { openai: callOpenAI, anthropic: callAnthropic, ollama: callOllama };

export async function chat({ system, user, cfg, agentId }) {
  const provider = cfg.llm.provider;
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`Provider LLM desconhecido: "${provider}" (use openai|anthropic|ollama)`);
  return adapter(cfg, agentId, system, user);
}

export async function checkConnectivity(cfg) {
  if (!cfg.llm.model) {
    return { ok: false, detail: 'nenhum modelo definido — set llm.model, um preset com model, ou VJP_LLM_MODEL' };
  }
  if (cfg.llm.apiKeyEnv && !process.env[cfg.llm.apiKeyEnv] && cfg.llm.provider !== 'ollama') {
    return { ok: false, detail: `env ${cfg.llm.apiKeyEnv} não setada (API key)` };
  }
  try {
    const out = await chat({ system: 'Responda apenas: OK', user: 'ping', cfg, agentId: 'planner' });
    return { ok: true, detail: `provider=${cfg.llm.provider} model=${cfg.llm.model} resp="${(out || '').slice(0, 40)}"` };
  } catch (e) {
    return { ok: false, detail: e.message };
  }
}

// Extrai o primeiro bloco JSON de uma resposta (tolerante a cercas ```json).
export function extractJson(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}
