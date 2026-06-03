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

export function loadLlmConfig(harnessDir) {
  const p = path.join(harnessDir, 'config', 'agents.json');
  if (!fs.existsSync(p)) throw new Error(`config/agents.json não encontrado em ${p}`);
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!cfg.llm || !cfg.llm.provider) throw new Error('config/agents.json: bloco "llm.provider" ausente');
  return cfg;
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

async function callOpenAI(cfg, agentId, system, user) {
  const base = (cfg.llm.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await withTimeout((signal) => fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey(cfg)}` },
    body: JSON.stringify({
      model: resolveModel(cfg, agentId),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: cfg.llm.temperature ?? 0,
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
      temperature: cfg.llm.temperature ?? 0,
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
      options: { temperature: cfg.llm.temperature ?? 0 },
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
  if (!cfg.llm.model || cfg.llm.model === 'REPLACE_WITH_PINNED_MODEL') {
    return { ok: false, detail: 'modelo não pinado em config/agents.json (llm.model)' };
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
