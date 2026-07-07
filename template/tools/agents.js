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

export function systemPrompt(agentId, ctx, roleInstruction, outputContract) {
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
export function runPlanner({ feature, ctx, cfg, spec }) {
  return runJsonAgent({
    agentId: 'planner', ctx, cfg,
    roleInstruction: 'Avalie complexidade e risco da feature ANTES de qualquer execução. Considere dependências e riscos arquiteturais em conformidade com a memória do projeto. Se houver spec.md fornecido, ELE é a fonte da verdade do escopo — não invente requisito fora dele, e não contradiga os critérios de aceite já escritos lá.',
    outputContract: '{ "risk": "low|medium|high", "strategy": "string", "needsResearch": boolean, "acceptanceCriteria": ["string"] }',
    userPrompt: [
      `Feature a planejar: "${feature}".`,
      spec ? `spec.md (fonte da verdade, siga à risca):\n${spec}` : '',
    ].filter(Boolean).join('\n\n'),
  });
}

// ---- RESEARCHER ----
export function runResearcher({ feature, plan, ctx, cfg, spec }) {
  return runJsonAgent({
    agentId: 'researcher', ctx, cfg,
    roleInstruction: 'Mapeie os arquivos impactados e a estrutura técnica a criar/modificar. Use o contexto do repositório quando disponível. Especifique entidades de banco/migrations/repositories afetados.',
    outputContract: '{ "impactedFiles": ["path"], "approach": "string", "dependencies": ["string"] }',
    userPrompt: [
      `Feature: "${feature}".`,
      `Plano do Planner: ${JSON.stringify(plan)}`,
      spec ? `spec.md (contexto, respeite o escopo declarado):\n${spec}` : '',
    ].filter(Boolean).join('\n'),
  });
}

// ---- helpers PUROS de NFR/Contrato (testáveis sem LLM) ----

// Heurística determinística: a feature precisa de fila/assíncrono/paralelismo?
// Operação pesada (lote/import/export/relatório/e-mail/integração externa) ou risco alto não deve ser síncrona.
export function nfrSummary(plan = {}) {
  const text = `${plan.strategy || ''} ${(plan.acceptanceCriteria || []).join(' ')} ${plan.feature || ''}`.toLowerCase();
  const heavy = /(lote|bulk|import|export|relat[óo]ri|report|planilha|csv|xlsx|pdf|e-?mail|envio em massa|webhook|integra[çc]|terceiro|scrap|fila|queue|cron|agend|batch|processa|massa)/.test(text);
  const needsQueue = heavy || plan.risk === 'high';
  return {
    needsQueue,
    async: needsQueue,
    parallelism: heavy,
    idempotency: needsQueue,
    rationale: needsQueue
      ? 'Operação pesada/lote/integração externa ou risco alto → processar via fila assíncrona idempotente.'
      : 'Operação síncrona simples — fila não necessária.',
  };
}

// Lacunas de um contrato de API. Vazio = contrato completo (front e back podem confiar).
export function contractGaps(contract = {}) {
  const gaps = [];
  const eps = Array.isArray(contract.endpoints) ? contract.endpoints : [];
  if (!eps.length) gaps.push('sem endpoints declarados');
  eps.forEach((e, i) => {
    const id = e.path || `#${i}`;
    if (!e.method) gaps.push(`${id}: falta method`);
    if (!e.path) gaps.push(`${id}: falta path`);
    if (e.request === undefined) gaps.push(`${id}: falta DTO de entrada (request)`);
    if (e.response === undefined) gaps.push(`${id}: falta DTO de saída (response)`);
    if (!Array.isArray(e.statusCodes) || !e.statusCodes.length) gaps.push(`${id}: faltam status codes`);
    if (e.persists === undefined) gaps.push(`${id}: não declara o que persiste (persists)`);
  });
  return gaps;
}
export function contractIsComplete(contract) { return contractGaps(contract).length === 0; }

// ---- NFR PLANNER (Planejador de requisitos não-funcionais) ----
export function runNfrPlanner({ feature, plan, ctx, cfg, spec }) {
  return runJsonAgent({
    agentId: 'nfr-planner', ctx, cfg,
    roleInstruction: 'Planeje requisitos NÃO-funcionais ANTES do código: decida se a operação precisa de fila/assíncrono/paralelismo e idempotência, e defina um orçamento de performance (tempo de resposta e tamanho de payload). Operação pesada (lote/import/export/relatório/e-mail/integração externa) NÃO pode ser síncrona — recomende fila (ex.: BullMQ).',
    outputContract: '{ "needsQueue": boolean, "async": boolean, "parallelism": boolean, "idempotency": boolean, "perfBudget": { "maxResponseMs": number, "maxPayloadKb": number }, "queueTool": "string|null", "notes": "string" }',
    userPrompt: [
      `Feature: "${feature}".`,
      `Plano: ${JSON.stringify(plan)}`,
      spec ? `spec.md (contexto): ${spec}` : '',
    ].filter(Boolean).join('\n'),
  });
}

// ---- CONTRACT (Contrato-primeiro: fonte da verdade entre Back e Front) ----
export function runContract({ feature, plan, research, ctx, cfg, spec }) {
  return runJsonAgent({
    agentId: 'contract', ctx, cfg,
    roleInstruction: 'Defina o CONTRATO de API compartilhado entre Backend e Frontend ANTES de implementar. É a fonte da verdade: cada endpoint com método, path, DTO de entrada e de saída, status codes e O QUE PERSISTE no banco. Front e Back DEVEM seguir este contrato à risca.',
    outputContract: '{ "endpoints": [ { "method": "GET|POST|PUT|PATCH|DELETE", "path": "/...", "request": {}, "response": {}, "statusCodes": [200], "persists": "tabela/entidade ou null" } ], "entities": ["string"], "notes": "string" }',
    userPrompt: [
      `Feature: "${feature}".`,
      `Plano: ${JSON.stringify(plan)}`,
      `Pesquisa: ${JSON.stringify(research || {})}`,
      spec ? `spec.md (contexto): ${spec}` : '',
    ].filter(Boolean).join('\n'),
  });
}

// Instruções por CAMADA (executor especialista).
const LAYER_INSTR = {
  backend: 'ESPECIALISTA BACKEND (NestJS): Controller → DTO (class-validator) → UseCase → Repository → Prisma. Implemente EXATAMENTE os endpoints do CONTRATO (mesmos paths/DTOs/status). Garanta PERSISTÊNCIA real (transação commitada) + testes de integração com Testcontainers. Se o NFR pedir fila, exponha o produtor + handler idempotente.',
  frontend: 'ESPECIALISTA FRONTEND: consuma o CONTRATO (mesmos paths/DTOs/status) — não invente formato. Trate loading/erro/vazio. Gere um teste E2E (Playwright) que exercita o fluxo real e asserta o resultado visível ao usuário.',
  db: 'ESPECIALISTA DB/MIGRATIONS (Prisma): crie/atualize schema + migration. Avalie índices (inclusive parciais) para as queries do contrato; evite N+1. Proibido mock de banco.',
  default: 'Implemente a feature seguindo a stack homologada e os padrões da memória.',
};

// ---- EXECUTOR (especialista por camada quando `layer` é informado) ----
export function runExecutor({ feature, plan, research, ctx, cfg, feedback, contract, nfr, layer }) {
  const layerInstr = LAYER_INSTR[layer] || LAYER_INSTR.default;
  return runJsonAgent({
    agentId: layer ? `executor:${layer}` : 'executor', ctx, cfg,
    roleInstruction: `${layerInstr} Gere o CONTEÚDO COMPLETO de cada arquivo (código + testes). Não use mocks voláteis de banco; siga AGENT_RULES. Se houver feedback de revisão, corrija exatamente o apontado.`,
    outputContract: '{ "files": [ { "path": "relativo/ao/projeto", "content": "conteúdo integral do arquivo" } ], "commitMessage": "string", "notes": "string" }',
    userPrompt: [
      `Feature: "${feature}".`,
      `Plano: ${JSON.stringify(plan)}`,
      `Pesquisa: ${JSON.stringify(research)}`,
      contract ? `CONTRATO (siga à risca): ${JSON.stringify(contract)}` : '',
      nfr ? `NFR (respeite): ${JSON.stringify(nfr)}` : '',
      feedback ? `Feedback da revisão anterior (CORRIJA): ${feedback}` : '',
    ].filter(Boolean).join('\n'),
  });
}

// ---- REVIEWER (valida contrato, persistência, E2E e NFR/performance) ----
export function runReviewer({ feature, executor, testPassed, testOutput, ctx, cfg, contract, nfr }) {
  return runJsonAgent({
    agentId: 'reviewer', ctx, cfg,
    roleInstruction: 'Valide criticamente contra critérios de aceite, ARQUITETURA, CONTRATO e NFR. Gate objetivo: se os testes falharam, NÃO aprove. Cheque: (1) endpoints batem com o contrato (path/DTO/status); (2) há prova de PERSISTÊNCIA real; (3) há teste E2E do fluxo front→API; (4) performance dentro do budget (sem N+1, índice quando necessário); (5) se needsQueue, a operação pesada está assíncrona+idempotente. Aponte exatamente o que falta.',
    outputContract: '{ "approved": boolean, "reason": "string", "requiredChanges": "string", "checks": { "contract": boolean, "persistence": boolean, "e2e": boolean, "performance": boolean, "nfr": boolean } }',
    userPrompt: [
      `Feature: "${feature}".`,
      `Arquivos gerados: ${JSON.stringify((executor.files || []).map((f) => f.path))}`,
      `Testes passaram: ${testPassed}.`,
      contract ? `Contrato: ${JSON.stringify(contract)}` : '',
      nfr ? `NFR: ${JSON.stringify(nfr)}` : '',
      `Saída dos testes (resumo): ${String(testOutput || '').slice(0, 1500)}`,
    ].filter(Boolean).join('\n'),
  });
}

// ---- modo dry-run (sem LLM): exercita a mecânica do pipeline ----
export const DRY = {
  planner: () => ({ risk: 'low', strategy: 'dry-run', needsResearch: false, acceptanceCriteria: ['marker existe'] }),
  nfrPlanner: () => ({ needsQueue: false, async: false, parallelism: false, idempotency: false, perfBudget: { maxResponseMs: 500, maxPayloadKb: 200 }, queueTool: null, notes: 'dry-run' }),
  contract: () => ({ endpoints: [], entities: [], notes: 'dry-run' }),
  researcher: () => ({ impactedFiles: ['.bsd/dry-run.md'], approach: 'dry-run', dependencies: [] }),
  executor: ({ feature, layer }) => ({
    files: [{ path: `.bsd/dry-run-${feature}${layer ? '-' + layer : ''}.md`, content: `# Dry-run de ${feature}${layer ? ' (' + layer + ')' : ''}\nGerado pelo pipeline sem LLM.\n` }],
    commitMessage: `dry-run: ${feature}`, notes: 'dry-run',
  }),
  reviewer: ({ testPassed }) => ({ approved: testPassed, reason: 'dry-run', requiredChanges: '', checks: { contract: true, persistence: true, e2e: true, performance: true, nfr: true } }),
};
