#!/usr/bin/env node

/**
 * V-JP Harness — gbrain-decision (por João Pedro / V-JP), v1.7.0
 *
 * Captura nativa de decisão arquitetural no GBrain. Resolve a dor do GBrain manual
 * ("esqueci de gravar a decisão") SEM dependência externa não-determinística
 * (avaliado e rejeitado: rohitg00/agentmemory — ver .gbrain/decisions.md).
 *
 * Faz append IDEMPOTENTE de uma decisão formatada em .gbrain/decisions.md, no formato
 * defensável do método V-JP: o quê + alternativa descartada + porquê.
 *
 * Uso:
 *   node .harness/tools/gbrain-decision.js "<o quê foi decidido>" --alt "<alternativa descartada>" --why "<porquê>"
 *   node .harness/tools/gbrain-decision.js "Adotar X" --alt "Y" --why "Z" --date 2026-06-28
 *
 * Caminho do arquivo:
 *   1) env GBRAIN_DECISIONS_FILE (override direto — usado em testes), ou
 *   2) <raiz-do-projeto>/.gbrain/decisions.md (raiz = dois níveis acima de tools/).
 *
 * Retorno (programático): { appended: boolean, file, reason }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveDecisionsFile(env = process.env) {
  if (env.GBRAIN_DECISIONS_FILE) return env.GBRAIN_DECISIONS_FILE;
  const projectRoot = path.resolve(__dirname, '../..');
  return path.join(projectRoot, '.gbrain', 'decisions.md');
}

function todayISO(env = process.env) {
  // Determinístico em teste via env; senão data corrente.
  if (env.GBRAIN_DECISION_DATE) return env.GBRAIN_DECISION_DATE;
  return new Date().toISOString().slice(0, 10);
}

const HEADER = `# 🧠 Decisions — Decisões Arquiteturais (GBrain · V-JP)

> O coração do método V-JP: toda escolha estrutural gravada com **alternativa descartada + porquê**.
> Entradas abaixo podem ser geradas por \`tools/gbrain-decision.js\` (append idempotente).
`;

/** Monta o bloco markdown de uma decisão. */
export function formatDecision({ what, alt, why, date }) {
  return [
    `## ${date} — ${what}`,
    `- **Decisão:** ${what}`,
    `- **Alternativa descartada:** ${alt || '—'}`,
    `- **Porquê:** ${why || '—'}`,
    '',
  ].join('\n');
}

/**
 * Append idempotente. Não duplica uma decisão com o MESMO título (## data — o quê).
 * Cria o arquivo (com header) se ausente.
 */
export function appendDecision({ what, alt, why, date }, file) {
  if (!what || !what.trim()) throw new Error('gbrain-decision: "o quê" (1º argumento) é obrigatório.');
  date = date || todayISO();
  const heading = `## ${date} — ${what}`;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  let existing = '';
  try { existing = fs.readFileSync(file, 'utf8'); } catch { existing = ''; }

  if (!existing.trim()) existing = HEADER + '\n';

  // idempotência: mesma data + mesmo título já presente => não reescreve.
  if (existing.split('\n').some((l) => l.trim() === heading)) {
    return { appended: false, file, reason: 'já registrada (idempotente)' };
  }

  const block = formatDecision({ what, alt, why, date });
  const sep = existing.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(file, existing + sep + block, 'utf8');
  return { appended: true, file, reason: 'registrada' };
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--alt') out.alt = argv[++i];
    else if (a === '--why') out.why = argv[++i];
    else if (a === '--date') out.date = argv[++i];
    else if (a === '--file') out.file = argv[++i];
    else out._.push(a);
  }
  return out;
}

// CLI (só quando executado direto, não quando importado pelo teste)
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const what = args._.join(' ').trim();
  if (!what) {
    console.error('Uso: node gbrain-decision.js "<o quê>" --alt "<descartada>" --why "<porquê>" [--date YYYY-MM-DD]');
    process.exit(1);
  }
  const file = args.file || resolveDecisionsFile();
  try {
    const r = appendDecision({ what, alt: args.alt, why: args.why, date: args.date }, file);
    console.log(`${r.appended ? '✔ Decisão registrada' : '• Decisão já existia'} em ${r.file} (${r.reason})`);
    process.exit(0);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
