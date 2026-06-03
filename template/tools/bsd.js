#!/usr/bin/env node

/**
 * V-JP Harness: BSD (Build Spec Development) Orchestrator
 * Operação determinística, isolada e crash-safe baseada em especificações.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadLlmConfig, checkConnectivity } from './llm.js';
import { buildContext, runPlanner, runResearcher, runExecutor, runReviewer, DRY } from './agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HARNESS_DIR = path.resolve(__dirname, '..');

// Definição de Cores ANSI
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Caminhos do Ecossistema
const ROOT_DIR = path.resolve(__dirname, '../..');
const BSD_DIR = path.join(ROOT_DIR, '.bsd');
const HISTORY_FILE = path.join(BSD_DIR, 'history.jsonl');
const STATE_FILE = path.join(BSD_DIR, 'STATE.md');
const WORKTREES_DIR = path.join(BSD_DIR, 'worktrees');

// Inicializa diretórios básicos
async function initDirs() {
  await fs.mkdir(BSD_DIR, { recursive: true });
  await fs.mkdir(WORKTREES_DIR, { recursive: true });
}

// Log em history.jsonl (Append-only, Crash-safe)
async function logHistory(event, feature, task, status, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    feature,
    task,
    status,
    details
  };
  await fs.appendFile(HISTORY_FILE, JSON.stringify(logEntry) + '\n', 'utf8');
}

// Atualização dinâmica do STATE.md
async function updateStateMarkdown(feature, currentTask, status, stepIndex, totalSteps) {
  const progressPercent = Math.round((stepIndex / totalSteps) * 100);
  const progressBar = '▓'.repeat(Math.round(progressPercent / 5)) + '░'.repeat(20 - Math.round(progressPercent / 5));

  const content = `# 📊 Painel de Controle BSD - V-JP Harness

> [!NOTE]
> Este painel é atualizado dinamicamente pelo orquestrador BSD no final de cada transação de agente.

## 🚀 Status da Execução Atual

| Módulo/Feature | Task Ativa | Status | Progresso |
| :--- | :--- | :--- | :--- |
| **${feature}** | \`${currentTask || 'Nenhuma'}\` | **${status.toUpperCase()}** | \`[${progressBar}] ${progressPercent}%\` |

## 🧬 Pipeline Transacional por Task

\`\`\`mermaid
flowchart TD
    Start["Task lida do tasks.md"] --> CreateWorktree["Criar Git Worktree Isolada"]
    CreateWorktree --> Planner["Agent: PLANNER (Análise de Risco)"]
    Planner --> Researcher["Agent: RESEARCHER (Mapeamento de Impacto)"]
    Researcher --> Executor["Agent: EXECUTOR (Escrita de Código & Testes)"]
    Executor --> Reviewer["Agent: REVIEWER (Validação via MCPs)"]
    
    Reviewer --> Condition{"Passou em 100% dos testes?"}
    Condition -- "Sim" --> MergeWorktree["Merge na Branch Principal & Limpeza"]
    Condition -- "Não" --> RetryCondition{"Tentativas < 2?"}
    
    RetryCondition -- "Sim" --> Executor
    RetryCondition -- "Não" --> Terminate["Abortar Task & Notificar Humano (STATE.md)"]
    
    MergeWorktree --> Next["Próxima Task"]

    style CreateWorktree fill:#1f2937,stroke:#3b82f6,stroke-width:2px
    style ${status === 'running' ? 'Executor' : status === 'failed' ? 'Terminate' : 'MergeWorktree'} fill:#1e1b4b,stroke:#a855f7,stroke-width:2px
\`\`\`

---

## 🕒 Histórico de Transações Recentes
Para auditoria detalhada de auditoria à prova de crash, consulte [history.jsonl](file://${HISTORY_FILE}).

*Última atualização: ${new Date().toLocaleString('pt-BR')}*
`;

  await fs.writeFile(STATE_FILE, content, 'utf8');
}

// Verifica se é repositório Git
function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore', cwd: ROOT_DIR });
    return true;
  } catch {
    return false;
  }
}

// Cria a git worktree isolada (ou diretório de fallback). Retorna {worktreePath, branch, gitMode}.
async function createWorktree(feature) {
  const worktreePath = path.join(WORKTREES_DIR, feature);
  const branch = `bsd-feature-${feature}`;
  // limpa worktree anterior da mesma feature (idempotência)
  if (fsSync.existsSync(worktreePath)) {
    try { execSync(`git worktree remove --force "${worktreePath}"`, { cwd: ROOT_DIR, stdio: 'ignore' }); } catch {}
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
  if (isGitRepo()) {
    try { execSync(`git branch -D ${branch}`, { cwd: ROOT_DIR, stdio: 'ignore' }); } catch {}
    execSync(`git worktree add -b ${branch} "${worktreePath}"`, { cwd: ROOT_DIR, stdio: 'ignore' });
    // worktree não herda node_modules — linka o do projeto p/ o testCommand resolver deps/binários
    const rootNM = path.join(ROOT_DIR, 'node_modules');
    const wtNM = path.join(worktreePath, 'node_modules');
    if (fsSync.existsSync(rootNM) && !fsSync.existsSync(wtNM)) {
      try { fsSync.symlinkSync(rootNM, wtNM, 'dir'); } catch {}
    }
    return { worktreePath, branch, gitMode: true };
  }
  await fs.mkdir(worktreePath, { recursive: true });
  return { worktreePath, branch, gitMode: false };
}

// Aplica as escritas de arquivo do EXECUTOR na worktree (com proteção contra path traversal).
async function applyFiles(worktreePath, files) {
  const applied = [];
  for (const f of files || []) {
    if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') continue;
    const rel = f.path.replace(/^\/+/, '');
    const abs = path.resolve(worktreePath, rel);
    if (!abs.startsWith(path.resolve(worktreePath) + path.sep)) {
      throw new Error(`Caminho fora da worktree recusado: ${f.path}`);
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, f.content, 'utf8');
    applied.push(rel);
  }
  return applied;
}

// Roda os testes na worktree. Retorna {passed, output}.
function runTests(cwd, testCommand) {
  try {
    const out = execSync(testCommand, { cwd, stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000 }).toString();
    return { passed: true, output: out };
  } catch (e) {
    return { passed: false, output: `${e.stdout || ''}\n${e.stderr || ''}\n${e.message}` };
  }
}

// Execução transacional de Feature (pipeline real: PLANNER → RESEARCHER → EXECUTOR → REVIEWER)
async function executeFeature(feature, opts = {}) {
  const dryRun = !!opts.dryRun;
  console.log(`${COLORS.bright}${COLORS.cyan}=== Execução Transacional: ${feature}${dryRun ? ' (dry-run)' : ''} ===${COLORS.reset}\n`);
  await initDirs();
  await logHistory('START_FEATURE', feature, 'All', 'running', { dryRun });

  // Config + contexto
  let cfg, ctx;
  try {
    cfg = loadLlmConfig(HARNESS_DIR);
  } catch (e) {
    if (!dryRun) { console.log(`${COLORS.red}Config inválida: ${e.message}${COLORS.reset}`); process.exit(1); }
    cfg = { pipeline: { maxRetries: 2, testCommand: 'node -e "process.exit(0)"', autoMerge: true } };
  }
  ctx = buildContext(HARNESS_DIR, ROOT_DIR);
  const maxRetries = cfg.pipeline?.maxRetries ?? 2;
  const testCommand = dryRun ? 'node -e "process.exit(0)"' : (cfg.pipeline?.testCommand || 'npm test');
  const autoMerge = cfg.pipeline?.autoMerge !== false;

  const step = async (name, idx, total, fn) => {
    console.log(`${COLORS.yellow}[${idx}/${total}] ${name}...${COLORS.reset}`);
    await logHistory('STEP_START', feature, name, 'running');
    await updateStateMarkdown(feature, name, 'running', idx - 1, total);
    const r = await fn();
    await logHistory('STEP_SUCCESS', feature, name, 'success');
    return r;
  };

  try {
    const TOTAL = 4 + maxRetries; // estimativa para a barra de progresso
    // 1. Worktree
    const { worktreePath, branch, gitMode } = await step('Criar Worktree', 1, TOTAL, () => createWorktree(feature));
    console.log(`  ${COLORS.dim}Worktree: ${worktreePath} (${gitMode ? 'git' : 'fallback'})${COLORS.reset}`);

    // 2. Planner
    const plan = await step('Planner (risco/estratégia)', 2, TOTAL,
      () => dryRun ? DRY.planner() : runPlanner({ feature, ctx, cfg }));
    console.log(`  ${COLORS.dim}Risco: ${plan.risk} · ${plan.strategy}${COLORS.reset}`);

    // 3. Researcher
    const research = await step('Researcher (impacto)', 3, TOTAL,
      () => dryRun ? DRY.researcher() : runResearcher({ feature, plan, ctx, cfg }));
    console.log(`  ${COLORS.dim}Arquivos impactados: ${(research.impactedFiles || []).join(', ') || '—'}${COLORS.reset}`);

    // 4. Loop Executor → testes → Reviewer (máx. maxRetries tentativas)
    let approved = false, feedback = '', lastReview = null, attempt = 0;
    while (attempt < maxRetries && !approved) {
      attempt++;
      const executor = await step(`Executor (tentativa ${attempt}/${maxRetries})`, 3 + attempt, TOTAL,
        () => dryRun ? DRY.executor({ feature }) : runExecutor({ feature, plan, research, ctx, cfg, feedback }));
      const applied = await applyFiles(worktreePath, executor.files);
      console.log(`  ${COLORS.dim}Escreveu ${applied.length} arquivo(s): ${applied.join(', ')}${COLORS.reset}`);
      if (gitMode && applied.length) {
        try {
          execSync('git add -A', { cwd: worktreePath, stdio: 'ignore' });
          execSync(`git commit -m ${JSON.stringify(executor.commitMessage || `bsd: ${feature} (tentativa ${attempt})`)}`, { cwd: worktreePath, stdio: 'ignore' });
        } catch (e) { console.log(`  ${COLORS.dim}(nada para commitar)${COLORS.reset}`); }
      }

      const test = runTests(worktreePath, testCommand);
      console.log(`  ${COLORS.dim}Testes: ${test.passed ? COLORS.green + 'PASSOU' : COLORS.red + 'FALHOU'}${COLORS.reset}`);
      await logHistory('TEST_RESULT', feature, `Executor#${attempt}`, test.passed ? 'success' : 'failed', { applied });

      lastReview = dryRun ? DRY.reviewer({ testPassed: test.passed })
        : await runReviewer({ feature, executor, testPassed: test.passed, testOutput: test.output, ctx, cfg });
      approved = !!lastReview.approved && test.passed;
      if (!approved) {
        feedback = `${lastReview.requiredChanges || lastReview.reason || ''}\nSaída dos testes:\n${String(test.output).slice(0, 1200)}`;
        console.log(`  ${COLORS.red}Reviewer reprovou: ${lastReview.reason || 'ver testes'}${COLORS.reset}`);
        await logHistory('REVIEW', feature, `Reviewer#${attempt}`, 'failed', { reason: lastReview.reason });
      } else {
        await logHistory('REVIEW', feature, `Reviewer#${attempt}`, 'success', {});
      }
    }

    if (!approved) {
      await updateStateMarkdown(feature, `Abortada após ${maxRetries} tentativas`, 'failed', TOTAL, TOTAL);
      await logHistory('END_FEATURE', feature, 'All', 'failed', { reason: lastReview?.reason || 'reprovado', attempts: attempt });
      console.log(`\n${COLORS.bright}${COLORS.red}✗ Feature "${feature}" abortada após ${attempt} tentativa(s). Veja .bsd/STATE.md.${COLORS.reset}`);
      process.exit(1);
    }

    // 5. Merge na branch principal (se aprovado)
    if (gitMode && autoMerge) {
      console.log(`${COLORS.yellow}[merge] Integrando ${branch} na branch principal...${COLORS.reset}`);
      try {
        execSync(`git merge --no-ff -m ${JSON.stringify(`bsd: merge ${feature}`)} ${branch}`, { cwd: ROOT_DIR, stdio: 'ignore' });
        execSync(`git worktree remove --force "${worktreePath}"`, { cwd: ROOT_DIR, stdio: 'ignore' });
        execSync(`git branch -d ${branch}`, { cwd: ROOT_DIR, stdio: 'ignore' });
        await logHistory('MERGE', feature, 'All', 'success', { branch });
      } catch (e) {
        console.log(`${COLORS.red}Merge falhou (conflito?): ${e.message}. Worktree preservada em ${worktreePath}.${COLORS.reset}`);
        await logHistory('MERGE', feature, 'All', 'failed', { error: e.message });
      }
    } else if (gitMode) {
      console.log(`${COLORS.dim}autoMerge desligado — mudanças ficam na branch ${branch}.${COLORS.reset}`);
    }

    await updateStateMarkdown(feature, 'Concluído', 'success', TOTAL, TOTAL);
    await logHistory('END_FEATURE', feature, 'All', 'success', {});
    console.log(`\n${COLORS.bright}${COLORS.green}✔ Feature "${feature}" concluída e aprovada!${COLORS.reset}`);
  } catch (e) {
    await updateStateMarkdown(feature, `Erro: ${e.message}`, 'failed', 1, 1);
    await logHistory('END_FEATURE', feature, 'All', 'failed', { error: e.message });
    console.log(`\n${COLORS.bright}${COLORS.red}✗ Pipeline falhou: ${e.message}${COLORS.reset}`);
    process.exit(1);
  }
}

// Retomar pipeline a partir de histórico
async function continuePipeline() {
  console.log(`${COLORS.bright}${COLORS.cyan}=== Retomando Pipeline Interrompido ===${COLORS.reset}\n`);
  
  try {
    const historyData = await fs.readFile(HISTORY_FILE, 'utf8');
    const lines = historyData.trim().split('\n').filter(Boolean);
    
    if (lines.length === 0) {
      console.log(`${COLORS.yellow}Nenhum histórico encontrado para retomar.${COLORS.reset}`);
      return;
    }

    // Acha a última feature iniciada
    let lastFeature = 'default-feature';
    let lastTask = 'Nenhuma';
    let lastStatus = 'unknown';

    for (let i = lines.length - 1; i >= 0; i--) {
      const entry = JSON.parse(lines[i]);
      if (entry.event === 'START_FEATURE' || entry.event === 'STEP_START') {
        lastFeature = entry.feature;
        lastTask = entry.task;
        lastStatus = entry.status;
        break;
      }
    }

    console.log(`${COLORS.green}Retomando feature: ${COLORS.bright}${lastFeature}${COLORS.reset}`);
    console.log(`${COLORS.green}Última task registrada: ${COLORS.bright}${lastTask} (${lastStatus})${COLORS.reset}\n`);

    await executeFeature(lastFeature);
  } catch (e) {
    console.log(`${COLORS.red}Erro ao ler histórico de execução: ${e.message}${COLORS.reset}`);
  }
}

// Exibir status do pipeline
async function showStatus() {
  console.log(`${COLORS.bright}${COLORS.cyan}=== Painel de Status do BSD ===${COLORS.reset}\n`);
  try {
    const stateContent = await fs.readFile(STATE_FILE, 'utf8');
    console.log(stateContent);
  } catch {
    console.log(`${COLORS.yellow}Nenhum pipeline ativo encontrado. Execute um comando primeiro para gerar o painel de status.${COLORS.reset}`);
  }
}

// Limpeza geral (Reset)
async function resetHarness() {
  console.log(`${COLORS.bright}${COLORS.red}=== Reset de Segurança do BSD ===${COLORS.reset}\n`);
  
  await initDirs();
  
  // Limpa STATE.md e history.jsonl
  await fs.writeFile(HISTORY_FILE, '', 'utf8');
  await fs.writeFile(STATE_FILE, '# 📊 Painel de Controle BSD\n\nNenhum pipeline ativo no momento. Use `--execute <feature>` para iniciar.', 'utf8');

  // Limpa diretórios de worktree
  try {
    if (isGitRepo()) {
      try {
        console.log(`${COLORS.dim}Limpando Git Worktrees ativas...${COLORS.reset}`);
        execSync('git worktree prune', { cwd: ROOT_DIR });
      } catch (e) {
        console.log(`  ${COLORS.yellow}Aviso ao limpar worktrees via Git: ${e.message}${COLORS.reset}`);
      }
    }
    
    const files = await fs.readdir(WORKTREES_DIR);
    for (const file of files) {
      await fs.rm(path.join(WORKTREES_DIR, file), { recursive: true, force: true });
    }
    console.log(`${COLORS.green}✔ Diretórios temporários e worktrees limpos com sucesso!${COLORS.reset}`);
  } catch (e) {
    console.log(`${COLORS.red}Erro na limpeza física de arquivos: ${e.message}${COLORS.reset}`);
  }
}

// Handler de Linha de Comando (CLI)
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`${COLORS.bright}V-JP Harness CLI - Opções disponíveis:${COLORS.reset}`);
    console.log(`  node .harness/tools/bsd.js --execute <feature>  : Inicia pipeline transacional`);
    console.log(`  node .harness/tools/bsd.js --continue           : Retoma último pipeline`);
    console.log(`  node .harness/tools/bsd.js --status             : Exibe painel de status atual`);
    console.log(`  node .harness/tools/bsd.js --reset              : Limpa worktrees e histórico`);
    console.log(`  node .harness/tools/bsd.js --execute <feature> --dry-run : Pipeline sem LLM (testa a mecânica)`);
    console.log(`  node .harness/tools/bsd.js --check-llm          : Testa conectividade do backend LLM`);
    console.log(`  node .harness/tools/bsd.js --doctor             : Verifica determinismo (registry.json)`);
    console.log(`  node .harness/tools/bsd.js --vendor             : Clona componentes git pinados (rtk/gbrain/superpowers)`);
    process.exit(0);
  }

  await initDirs();

  switch (command) {
    case '--execute':
      const featureName = args[1] && !args[1].startsWith('--') ? args[1] : null;
      if (!featureName) {
        console.log(`${COLORS.red}Erro: Especifique o nome da feature. Exemplo: --execute auth-service${COLORS.reset}`);
        process.exit(1);
      }
      await executeFeature(featureName, { dryRun: args.includes('--dry-run') });
      break;

    case '--check-llm': {
      const cfg = loadLlmConfig(HARNESS_DIR);
      const r = await checkConnectivity(cfg);
      console.log(r.ok
        ? `${COLORS.green}✔ LLM OK${COLORS.reset} — ${r.detail}`
        : `${COLORS.red}✗ LLM indisponível${COLORS.reset} — ${r.detail}`);
      process.exit(r.ok ? 0 : 1);
    }

    case '--continue':
      await continuePipeline();
      break;

    case '--status':
      await showStatus();
      break;

    case '--reset':
      await resetHarness();
      break;

    case '--doctor':
      // Delega ao verificador de determinismo (registry.json)
      execSync(`node "${path.join(__dirname, 'verify.js')}" ${args.slice(1).join(' ')}`, { stdio: 'inherit' });
      break;

    case '--vendor':
      // Delega à vendorização determinística (clone pinado dos componentes git)
      execSync(`node "${path.join(__dirname, 'vendor.js')}" ${args.slice(1).join(' ')}`, { stdio: 'inherit' });
      break;

    default:
      console.log(`${COLORS.red}Comando desconhecido: ${command}${COLORS.reset}`);
      process.exit(1);
  }
}

main().catch(err => {
  console.error(`${COLORS.red}Fatal: ${err.message}${COLORS.reset}`);
  process.exit(1);
});
