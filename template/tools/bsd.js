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
import { buildContext, runPlanner, runNfrPlanner, runContract, runResearcher, runExecutor, runReviewer, DRY } from './agents.js';

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
  // Blindado contra estouro: a estimativa de TOTAL é só cosmética (barra de progresso) — nunca deve
  // derrubar o pipeline por causa de um `repeat()` com contagem negativa/>20 se o número real de steps
  // divergir da estimativa (ex.: múltiplas tasks de um tasks.md, cada uma com seu próprio sub-loop de
  // tentativas, faz o total real variar por task).
  const safeTotal = totalSteps > 0 ? totalSteps : 1;
  const progressPercent = Math.max(0, Math.min(100, Math.round((stepIndex / safeTotal) * 100)));
  const filledUnits = Math.max(0, Math.min(20, Math.round(progressPercent / 5)));
  const progressBar = '▓'.repeat(filledUnits) + '░'.repeat(20 - filledUnits);

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

// Gate de merge por SINAL CONCRETO (padrão Janitor/Bernstein). Função pura, testável:
// o merge SÓ é autorizado quando os testes passam E o Reviewer aprova. A aprovação do
// LLM NUNCA sobrepõe um teste falho. (Afirmação central do BSD — coberta em tests/.)
export function mergeGate(testPassed, reviewApproved) {
  return !!testPassed && !!reviewApproved;
}

// Aplica as escritas de arquivo do EXECUTOR na worktree (com proteção contra path traversal).
export async function applyFiles(worktreePath, files) {
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

// ---- Spec-driven: leitura de spec.md/tasks.md de uma feature (Princípio #2 do AGENT_RULES.md) ----
//
// Antes desta função existir, `--execute <feature>` não lia NENHUM arquivo de especificação — o LLM
// inventava o plano sozinho a partir só do nome da feature, contradizendo o princípio #2
// ("código só a partir de spec.md/tasks.md") e o próprio mermaid gerado em STATE.md, que já dizia
// "Task lida do tasks.md" sem que o código fizesse isso de fato. Convenções de localização aceitas,
// nessa ordem: `.planning/phases/<feature>/` (convenção já usada no projeto) e `specs/<feature>/`
// (alternativa mais genérica). tasks.md é obrigatório para ativar o modo spec-driven; spec.md é
// opcional (contexto extra injetado nos agentes). Sem nenhum dos dois, cai no modo autônomo de
// sempre — retrocompatível com todo projeto que já usa o harness sem specs escritas.
export function findFeatureSpec(rootDir, feature) {
  const candidates = [
    path.join(rootDir, '.planning', 'phases', feature),
    path.join(rootDir, 'specs', feature),
  ];
  for (const dir of candidates) {
    const tasksPath = path.join(dir, 'tasks.md');
    if (fsSync.existsSync(tasksPath)) {
      const specPath = path.join(dir, 'spec.md');
      return { dir, tasksPath, specPath: fsSync.existsSync(specPath) ? specPath : null };
    }
  }
  return null;
}

// Parseia checkboxes de tasks.md: "- [ ] **T1.** texto" ou "- [x] texto solto" (sem ID explícito
// ganha um sequencial T<n> — precisa de ID no formato **Tn.** pra `markTaskDone` conseguir marcar
// de volta no arquivo depois).
export function parseTasks(md) {
  const lines = String(md || '').split('\n');
  const re = /^-\s*\[( |x|X)\]\s*(?:\*\*(T\d+)\.?\*\*\s*)?(.+)$/;
  const tasks = [];
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    tasks.push({ id: m[2] || `T${tasks.length + 1}`, done: m[1].toLowerCase() === 'x', text: m[3].trim() });
  }
  return tasks;
}

// Marca uma task como concluída no tasks.md em disco (idempotente — só troca o "[ ]" daquele ID).
export async function markTaskDone(tasksPath, taskId) {
  const content = await fs.readFile(tasksPath, 'utf8');
  const re = new RegExp(`^(-\\s*)\\[ \\](\\s*\\*\\*${taskId}\\.?\\*\\*)`, 'm');
  await fs.writeFile(tasksPath, content.replace(re, '$1[x]$2'), 'utf8');
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
//
// Spec-driven (Princípio #2): se `.planning/phases/<feature>/tasks.md` (ou `specs/<feature>/tasks.md`)
// existir, cada task PENDENTE dele vira uma "unit" — passa pelo pipeline completo (Planner→NFR→
// Contrato→Researcher→Executor/testes/Reviewer) isoladamente, e é marcada `[x]` no arquivo real assim
// que aprovada. spec.md (se existir) é injetado como contexto extra nos agentes. Sem tasks.md, cai no
// modo autônomo de sempre: uma única unit sintética = a feature inteira (100% do comportamento antigo).
async function executeFeature(feature, opts = {}) {
  const dryRun = !!opts.dryRun;
  console.log(`${COLORS.bright}${COLORS.cyan}=== Execução Transacional: ${feature}${dryRun ? ' (dry-run)' : ''} ===${COLORS.reset}\n`);
  await initDirs();
  await logHistory('START_FEATURE', feature, 'All', 'running', { dryRun });

  const specInfo = findFeatureSpec(ROOT_DIR, feature);
  let specMd = null;
  let units = [{ id: null, text: feature }];
  if (specInfo) {
    specMd = specInfo.specPath ? await fs.readFile(specInfo.specPath, 'utf8') : null;
    const tasksMd = await fs.readFile(specInfo.tasksPath, 'utf8');
    const allTasks = parseTasks(tasksMd);
    const pending = allTasks.filter((t) => !t.done);
    console.log(`${COLORS.green}✔ spec.md/tasks.md encontrados em ${specInfo.dir} — ${pending.length}/${allTasks.length} task(s) pendente(s).${COLORS.reset}`);
    if (!pending.length) {
      console.log(`${COLORS.yellow}Todas as tasks já estão [x] em tasks.md. Nada a executar.${COLORS.reset}`);
      await updateStateMarkdown(feature, 'Todas as tasks já concluídas', 'success', 1, 1);
      await logHistory('END_FEATURE', feature, 'All', 'success', { reason: 'no-pending-tasks' });
      return;
    }
    units = pending;
  } else {
    console.log(`${COLORS.yellow}⚠ Nenhum spec.md/tasks.md encontrado para "${feature}" (procurado em .planning/phases/${feature}/ e specs/${feature}/). Rodando em modo autônomo — sem spec escrito, o LLM decide sozinho. Recomendado: gere spec.md+tasks.md antes (ver .harness/tools/gsd-redux.md).${COLORS.reset}`);
  }

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
    const TOTAL = 1 + units.length * (4 + maxRetries * 3); // estimativa p/ barra de progresso (4 passos fixos + até maxRetries tentativas x 3 camadas)
    let stepIdx = 0;

    // Worktree única para a feature inteira — todas as tasks compartilham a mesma branch/worktree.
    const { worktreePath, branch, gitMode } = await step('Criar Worktree', ++stepIdx, TOTAL, () => createWorktree(feature));
    console.log(`  ${COLORS.dim}Worktree: ${worktreePath} (${gitMode ? 'git' : 'fallback'})${COLORS.reset}`);

    for (const unit of units) {
      const unitTag = unit.id ? `${unit.id}` : 'feature';
      const unitLabel = unit.id ? `${feature} — ${unit.id}: ${unit.text}` : feature;
      console.log(`${COLORS.bright}${COLORS.magenta}--- ${unit.id ? `Task ${unit.id}` : 'Feature'}: ${unit.text} ---${COLORS.reset}`);

      // Planner
      const plan = await step(`Planner (${unitTag})`, ++stepIdx, TOTAL,
        () => dryRun ? DRY.planner() : runPlanner({ feature: unitLabel, ctx, cfg, spec: specMd }));
      console.log(`  ${COLORS.dim}Risco: ${plan.risk} · ${plan.strategy}${COLORS.reset}`);

      // NFR Planner (fila/assíncrono/paralelismo/perf — decidido ANTES do código)
      const nfr = await step(`NFR (${unitTag})`, ++stepIdx, TOTAL,
        () => dryRun ? DRY.nfrPlanner() : runNfrPlanner({ feature: unitLabel, plan, ctx, cfg, spec: specMd }));
      console.log(`  ${COLORS.dim}NFR: fila=${nfr.needsQueue} async=${nfr.async} paralelismo=${nfr.parallelism}${COLORS.reset}`);

      // Contrato-primeiro (fonte da verdade compartilhada Back↔Front)
      const contract = await step(`Contrato de API (${unitTag})`, ++stepIdx, TOTAL,
        () => dryRun ? DRY.contract() : runContract({ feature: unitLabel, plan, ctx, cfg, spec: specMd }));
      console.log(`  ${COLORS.dim}Endpoints no contrato: ${(contract.endpoints || []).length}${COLORS.reset}`);

      // Researcher
      const research = await step(`Researcher (${unitTag})`, ++stepIdx, TOTAL,
        () => dryRun ? DRY.researcher() : runResearcher({ feature: unitLabel, plan, ctx, cfg, spec: specMd }));
      console.log(`  ${COLORS.dim}Arquivos impactados: ${(research.impactedFiles || []).join(', ') || '—'}${COLORS.reset}`);

      // Loop Executor → testes → Reviewer (máx. maxRetries tentativas), escopado a esta unit/task
      let approved = false, feedback = '', lastReview = null, attempt = 0;
      while (attempt < maxRetries && !approved) {
        attempt++;
        // Executores ESPECIALISTAS por camada (backend → db → frontend), acumulando arquivos.
        // Cada um recebe o CONTRATO e o NFR; o frontend gera o teste E2E que prova o fluxo real.
        const layers = ['backend', 'db', 'frontend'];
        const allFiles = [];
        let commitMessage = `bsd: ${feature}${unit.id ? ' ' + unit.id : ''} (tentativa ${attempt})`;
        for (const layer of layers) {
          const out = await step(`Executor:${layer} (${unitTag}, tentativa ${attempt}/${maxRetries})`, ++stepIdx, TOTAL,
            () => dryRun ? DRY.executor({ feature: unitLabel, layer })
              : runExecutor({ feature: unitLabel, plan, research, ctx, cfg, feedback, contract, nfr, layer }));
          for (const f of out.files || []) allFiles.push(f);
          if (out.commitMessage) commitMessage = out.commitMessage;
        }
        const executor = { files: allFiles, commitMessage };
        const applied = await applyFiles(worktreePath, executor.files);
        console.log(`  ${COLORS.dim}Escreveu ${applied.length} arquivo(s) [back/db/front]: ${applied.join(', ')}${COLORS.reset}`);
        if (gitMode && applied.length) {
          try {
            execSync('git add -A', { cwd: worktreePath, stdio: 'ignore' });
            execSync(`git commit -m ${JSON.stringify(executor.commitMessage || commitMessage)}`, { cwd: worktreePath, stdio: 'ignore' });
          } catch (e) { console.log(`  ${COLORS.dim}(nada para commitar)${COLORS.reset}`); }
        }

        const test = runTests(worktreePath, testCommand);
        console.log(`  ${COLORS.dim}Testes: ${test.passed ? COLORS.green + 'PASSOU' : COLORS.red + 'FALHOU'}${COLORS.reset}`);
        await logHistory('TEST_RESULT', feature, `${unitTag}:Executor#${attempt}`, test.passed ? 'success' : 'failed', { applied });

        lastReview = dryRun ? DRY.reviewer({ testPassed: test.passed })
          : await runReviewer({ feature: unitLabel, executor, testPassed: test.passed, testOutput: test.output, ctx, cfg, contract, nfr });
        // Gate por sinal concreto (ver mergeGate): teste verde manda; LLM não sobrepõe.
        approved = mergeGate(test.passed, lastReview.approved);
        if (!approved) {
          feedback = `${lastReview.requiredChanges || lastReview.reason || ''}\nSaída dos testes:\n${String(test.output).slice(0, 1200)}`;
          console.log(`  ${COLORS.red}Reviewer reprovou: ${lastReview.reason || 'ver testes'}${COLORS.reset}`);
          await logHistory('REVIEW', feature, `${unitTag}:Reviewer#${attempt}`, 'failed', { reason: lastReview.reason });
        } else {
          await logHistory('REVIEW', feature, `${unitTag}:Reviewer#${attempt}`, 'success', {});
        }
      }

      if (!approved) {
        await updateStateMarkdown(feature, `${unit.id ? unit.id + ': ' : ''}Abortada após ${maxRetries} tentativas`, 'failed', stepIdx, TOTAL);
        await logHistory('END_FEATURE', feature, unitTag, 'failed', { reason: lastReview?.reason || 'reprovado', attempts: attempt });
        console.log(`\n${COLORS.bright}${COLORS.red}✗ ${unit.id ? `Task ${unit.id} de ` : ''}"${feature}" abortada após ${attempt} tentativa(s). Veja .bsd/STATE.md.${COLORS.reset}`);
        process.exit(1);
      }

      // Task aprovada: marca [x] em tasks.md, no disco, de verdade.
      if (specInfo && unit.id) {
        await markTaskDone(specInfo.tasksPath, unit.id);
        console.log(`  ${COLORS.green}✔ Task ${unit.id} marcada como concluída em ${path.relative(ROOT_DIR, specInfo.tasksPath)}${COLORS.reset}`);
      }
    }

    // Merge na branch principal (se aprovado) — uma vez, depois de TODAS as units aprovadas.
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

// Só executa a CLI quando rodado diretamente (não ao ser importado por tests/).
// Usa realpath (não só path.resolve) pra sobreviver a diretórios com symlink no caminho — ex.:
// /var/folders/... no macOS é symlink pra /private/var/folders/...; sem isso, invocar bsd.js por
// caminho absoluto de dentro de um tmpdir do SO faz essa comparação falhar e `main()` nunca roda
// (script morre em silêncio, exit 0, zero output — achado rodando os testes de integração deste
// arquivo em tmpdir real).
function resolveIsMain() {
  if (!process.argv[1]) return false;
  try {
    return fsSync.realpathSync(process.argv[1]) === fsSync.realpathSync(__filename);
  } catch {
    return path.resolve(process.argv[1]) === __filename;
  }
}
const isMain = resolveIsMain();
if (isMain) {
  main().catch(err => {
    console.error(`${COLORS.red}Fatal: ${err.message}${COLORS.reset}`);
    process.exit(1);
  });
}
