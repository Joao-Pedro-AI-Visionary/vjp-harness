#!/usr/bin/env node
// Status line do Claude Code: mostra uso de contexto (tokens + percentual).
// Recebe um JSON no stdin com { model, workspace, transcript_path, exceeds_200k_tokens, ... }.
// Calcula o contexto a partir da ultima mensagem do assistant no transcript (.message.usage).

const fs = require('fs');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'k';
  return String(n);
}

function contextLimit(modelId, exceeds200k) {
  const id = (modelId || '').toLowerCase();
  if (id.includes('1m') || id.includes('[1m]')) return 1_000_000;
  // Sonnet/Opus padrao = 200k; se ja passou de 200k sem ser 1M, assume 1M.
  if (exceeds200k) return 1_000_000;
  return 200_000;
}

function lastContextTokens(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return 0;
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  } catch {
    return 0;
  }
  // Varre de tras pra frente procurando a ultima usage de assistant na cadeia principal.
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.isSidechain) continue;
    const u = obj.message && obj.message.usage;
    if (!u) continue;
    const input = u.input_tokens || 0;
    const cacheRead = u.cache_read_input_tokens || 0;
    const cacheCreate = u.cache_creation_input_tokens || 0;
    const total = input + cacheRead + cacheCreate;
    if (total > 0) return total;
  }
  return 0;
}

function main() {
  let data = {};
  try {
    data = JSON.parse(readStdin() || '{}');
  } catch {
    data = {};
  }

  const modelId = data.model && data.model.id;
  const modelName = (data.model && data.model.display_name) || modelId || 'Claude';
  const limit = contextLimit(modelId, data.exceeds_200k_tokens);
  const used = lastContextTokens(data.transcript_path);
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const dir = (data.workspace && data.workspace.current_dir) || data.cwd || '';
  const project = dir ? dir.split('/').filter(Boolean).pop() : '';

  // Barra de 10 blocos.
  const filled = Math.round(pct / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  // Cor ANSI conforme pressao de contexto.
  let color = '\x1b[32m'; // verde
  if (pct >= 85) color = '\x1b[31m'; // vermelho
  else if (pct >= 60) color = '\x1b[33m'; // amarelo
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  const ctx = `${color}${bar} ${fmt(used)}/${fmt(limit)} (${pct}%)${reset}`;
  const parts = [ctx, `${dim}${modelName}${reset}`];
  if (project) parts.push(`${dim} ${project}${reset}`);

  process.stdout.write(parts.join(`  ${dim}|${reset}  `));
}

main();
