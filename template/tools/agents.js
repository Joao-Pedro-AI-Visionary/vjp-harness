#!/usr/bin/env node

/**
 * V-JP Harness: Os 4 agentes (PLANNER → RESEARCHER → EXECUTOR → REVIEWER).
 *
 * Cada agente monta um system prompt a partir de AGENT_RULES.md + contexto do .gbrain,
 * chama o LLM (tools/llm.js, provider-agnostic) e devolve saída ESTRUTURADA (JSON).
 * O EXECUTOR devolve um conjunto de escritas de arquivo aplicadas pelo orquestrador (bsd.js)
 * na git worktree isolada — sem dar shell ao modelo.
 */

import fs from 'fs';
import path from 'path';
import { chat, extractJson } from './llm.js';

// ---- contexto compartilhado (AGENT_RULES + .gbrain) ----
export function buildContext(harnessDir, projectDir) {
  const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
  const rules = read(path.join(harnessDir, 'AGENT_RULES.md'));
  const gbrainDir = path.join(projectDir, '.gbrain');
  const gbrain = ['project.md', 'architecture.md', 'patterns.md', 'decisions.md', 'lessons.md', 'bugs.md']
    .map((f) => { const c = read(path.join(gbrainDir, f)); return c ? `### .gbrain/${f}\n${c}` : ''; })
    .filter(Boolean).join('\n\n');
  const packed = read(path.join(harnessDir, 'context', 'repo-packed.md'));
  return { rules, gbrain, packed };
}

function systemPrompt(agentId, ctx, roleInstruction, outputContract) {
  return [
    ctx.rules ? `# Regras do Harness (AGENT_RULES.md)\n${ctx.rules}` : '',
    ctx.gbrain ? `# Memória do projeto (.gbrain)\n${ctx.gbrain}` : '',
    `# Seu papel: ${agentId.toUpperCase()}\n${roleInstruction}`,
    `# Contrato de saída\n${outputContract}\nResponda SOMENTE com JSON válido, sem texto fora do JSON.`,
  ].filter(Boolean).join('\n\n');
}

async function runJsonAgent({ agentId, ctx, roleInstruction, outputContract, userPrompt, cfg }) {
  const system = systemPrompt(agentId, ctx, roleInstruction, outputContract);
  const out = await chat({ system, user: userPrompt, cfg, agentId });
  const json = extractJson(out);
  if (!json) throw new Error(`${agentId}: resposta não-JSON: ${String(out).slice(0, 200)}`);
  return json;
}

// ---- PLANNER ----
export function runPlanner({ feature, ctx, cfg }) {
  return runJsonAgent({
    agentId: 'planner', ctx, cfg,
    roleInstruction: 'Avalie complexidade e risco da feature ANTES de qualquer execução. Considere dependências e riscos arquiteturais em conformidade com a memória do projeto.',
    outputContract: '{ "risk": "low|medium|high", "strategy": "string", "needsResearch": boolean, "acceptanceCriteria": ["string"] }',
    userPrompt: `Feature a planejar: "${feature}".`,
  });
}

// ---- RESEARCHER ----
export function runResearcher({ feature, plan, ctx, cfg }) {
  return runJsonAgent({
    agentId: 'researcher', ctx, cfg,
    roleInstruction: 'Mapeie os arquivos impactados e a estrutura técnica a criar/modificar. Use o contexto do repositório quando disponível. Especifique entidades de banco/migrations/repositories afetados.',
    outputContract: '{ "impactedFiles": ["path"], "approach": "string", "dependencies": ["string"] }',
    userPrompt: `Feature: "${feature}".\nPlano do Planner: ${JSON.stringify(plan)}`,
  });
}

// ---- EXECUTOR ----
export function runExecutor({ feature, plan, research, ctx, cfg, feedback }) {
  return runJsonAgent({
    agentId: 'executor', ctx, cfg,
    roleInstruction: 'Implemente a feature seguindo a stack homologada e os padrões da memória. Gere o CONTEÚDO COMPLETO de cada arquivo (código + testes). Não use mocks voláteis de banco; siga AGENT_RULES. Se houver feedback de revisão, corrija exatamente o apontado.',
    outputContract: '{ "files": [ { "path": "relativo/ao/projeto", "content": "conteúdo integral do arquivo" } ], "commitMessage": "string", "notes": "string" }',
    userPrompt: [
      `Feature: "${feature}".`,
      `Plano: ${JSON.stringify(plan)}`,
      `Pesquisa: ${JSON.stringify(research)}`,
      feedback ? `Feedback da revisão anterior (CORRIJA): ${feedback}` : '',
    ].filter(Boolean).join('\n'),
  });
}

// ---- REVIEWER ----
export function runReviewer({ feature, executor, testPassed, testOutput, ctx, cfg }) {
  return runJsonAgent({
    agentId: 'reviewer', ctx, cfg,
    roleInstruction: 'Valide criticamente o código gerado contra os critérios de aceite, arquitetura e qualidade. O resultado dos testes é o gate objetivo: se os testes falharam, NÃO aprove e diga exatamente o que corrigir.',
    outputContract: '{ "approved": boolean, "reason": "string", "requiredChanges": "string" }',
    userPrompt: [
      `Feature: "${feature}".`,
      `Arquivos gerados: ${JSON.stringify((executor.files || []).map((f) => f.path))}`,
      `Testes passaram: ${testPassed}.`,
      `Saída dos testes (resumo): ${String(testOutput || '').slice(0, 1500)}`,
    ].join('\n'),
  });
}

// ---- modo dry-run (sem LLM): exercita a mecânica do pipeline ----
export const DRY = {
  planner: () => ({ risk: 'low', strategy: 'dry-run', needsResearch: false, acceptanceCriteria: ['marker existe'] }),
  researcher: () => ({ impactedFiles: ['.bsd/dry-run.md'], approach: 'dry-run', dependencies: [] }),
  executor: ({ feature }) => ({
    files: [{ path: `.bsd/dry-run-${feature}.md`, content: `# Dry-run de ${feature}\nGerado pelo pipeline sem LLM.\n` }],
    commitMessage: `dry-run: ${feature}`, notes: 'dry-run',
  }),
  reviewer: ({ testPassed }) => ({ approved: testPassed, reason: 'dry-run', requiredChanges: '' }),
};
