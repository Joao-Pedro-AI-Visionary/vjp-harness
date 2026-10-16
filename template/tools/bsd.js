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

// Verifica se é repositório Git
function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore', cwd: ROOT_DIR });
    return true;
  } catch {
    return false;
  }
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
// (Herança do pipeline headless removido na v2.2.0.) Antes desta função existir, `--execute <feature>` não lia NENHUM arquivo de especificação — o LLM
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
  await fs.writeFile(STATE_FILE, '# 📊 Painel de Controle BSD\n\nNenhum pipeline ativo no momento. Pipeline headless (--execute) removido na v2.2.0; use as CLIs (Claude/Codex/AGY/Cursor).', 'utf8');

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
    console.log(`  node .harness/tools/bsd.js --status             : Exibe painel de status atual`);
    console.log(`  node .harness/tools/bsd.js --reset              : Limpa worktrees e histórico`);
    console.log(`  node .harness/tools/bsd.js --doctor|--check     : Determinismo (registry) + checklist OK/FALTA/AVISO`);
    console.log(`  node .harness/tools/bsd.js --vendor             : Clona componentes git pinados (gbrain/superpowers)`);
    process.exit(0);
  }

  await initDirs();

  switch (command) {
    case '--status':
      await showStatus();
      break;

    case '--reset':
      await resetHarness();
      break;

    case '--doctor':
    case '--check':
      // Determinismo (registry.json) + checklist de requisitos. --check aqui não é o drift do sync-rules.
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
