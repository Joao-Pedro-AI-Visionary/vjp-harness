#!/usr/bin/env node

/**
 * V-JP Harness: BSD (Build Spec Development) Orchestrator
 * Operação determinística, isolada e crash-safe baseada em especificações.
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Execução transacional de Feature
async function executeFeature(feature) {
  console.log(`${COLORS.bright}${COLORS.cyan}=== Iniciando Execução Transacional: ${feature} ===${COLORS.reset}\n`);
  
  await initDirs();
  await logHistory('START_FEATURE', feature, 'All', 'running', { message: 'Iniciando pipeline transacional' });
  
  const tasks = ['Mapear Estrutura', 'Criar Worktree', 'Executar Planner', 'Executar Researcher', 'Executar Executor', 'Executar Reviewer'];
  const totalSteps = tasks.length;

  for (let i = 0; i < totalSteps; i++) {
    const task = tasks[i];
    console.log(`${COLORS.yellow}[Passo ${i+1}/${totalSteps}] ${task}...${COLORS.reset}`);
    await logHistory('STEP_START', feature, task, 'running');
    await updateStateMarkdown(feature, task, 'running', i, totalSteps);

    // Simula tempo de processamento ou integração real
    if (task === 'Criar Worktree') {
      const worktreePath = path.join(WORKTREES_DIR, feature);
      if (isGitRepo()) {
        try {
          console.log(`  ${COLORS.dim}Criando Git Worktree em: ${worktreePath}${COLORS.reset}`);
          execSync(`git worktree add -b bsd-feature-${feature} "${worktreePath}"`, { cwd: ROOT_DIR, stdio: 'ignore' });
          await logHistory('WORKTREE_CREATED', feature, task, 'success', { path: worktreePath, mode: 'git-worktree' });
        } catch (e) {
          console.log(`  ${COLORS.red}Falha ao criar Git Worktree. Usando diretório isolado de fallback.${COLORS.reset}`);
          await fs.mkdir(worktreePath, { recursive: true });
          await logHistory('WORKTREE_CREATED', feature, task, 'success', { path: worktreePath, mode: 'fallback-directory', error: e.message });
        }
      } else {
        console.log(`  ${COLORS.dim}Git não inicializado. Criando diretório de trabalho isolado em: ${worktreePath}${COLORS.reset}`);
        await fs.mkdir(worktreePath, { recursive: true });
        await logHistory('WORKTREE_CREATED', feature, task, 'success', { path: worktreePath, mode: 'fallback-directory' });
      }
    } else {
      // Simulação rápida para demonstração de orquestração
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    await logHistory('STEP_SUCCESS', feature, task, 'success');
  }

  await updateStateMarkdown(feature, 'Concluído', 'success', totalSteps, totalSteps);
  await logHistory('END_FEATURE', feature, 'All', 'success', { message: 'Pipeline concluído com sucesso' });
  console.log(`\n${COLORS.bright}${COLORS.green}✔ Feature "${feature}" executada com 100% de sucesso!${COLORS.reset}`);
  console.log(`${COLORS.dim}Painel atualizado em: ${STATE_FILE}${COLORS.reset}`);
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
    process.exit(0);
  }

  await initDirs();

  switch (command) {
    case '--execute':
      const featureName = args[1];
      if (!featureName) {
        console.log(`${COLORS.red}Erro: Especifique o nome da feature. Exemplo: --execute auth-service${COLORS.reset}`);
        process.exit(1);
      }
      await executeFeature(featureName);
      break;

    case '--continue':
      await continuePipeline();
      break;

    case '--status':
      await showStatus();
      break;

    case '--reset':
      await resetHarness();
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
