// v1.10.2: valida a presença do hono-drizzle no registry + a integridade
// da Constitution 9 artigos no AGENT_RULES. Anti-regressão: se alguém
// remover um artigo ou o stack alternativo, o teste falha.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = join(__dirname, '..', '..', 'registry.json');
const AGENT_RULES_PATH = join(__dirname, '..', '..', 'AGENT_RULES.md');

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
const agentRules = readFileSync(AGENT_RULES_PATH, 'utf8');

test('hono-drizzle existe no registry como stack-alternative opcional', () => {
  const c = registry.components.find((x) => x.id === 'hono-drizzle');
  assert.ok(c, 'componente hono-drizzle deve existir no registry');
  assert.equal(c.tier, 'stack-alternative');
  assert.equal(c.required, false, 'hono-drizzle é OPCIONAL — não pode ser required');
  assert.equal(c.addedIn, '1.10.2');
  // tem que referenciar Constitution Article I e Article VII
  assert.match(c.install, /Article I\b/);
  assert.match(c.install, /\bVII\b/);
});

test('hono-drizzle NÃO substitui NestJS+Prisma (não-quebra)', () => {
  const c = registry.components.find((x) => x.id === 'hono-drizzle');
  // Texto atual usa "NÃO toque" e "NÃO substitui globalmente" (no ADR) — checa
  // que o install do registry deixa claro que é complementar, não substituto.
  assert.match(c.install, /N[ÃÕ]O toque|N[ãa]o toque/);
  assert.match(c.install, /NestJS\+Prisma/);
  // E o hono-drizzle.md também precisa deixar isso explícito
  const honoDrizzle = readFileSync(
    join(__dirname, '..', '..', 'tools', 'hono-drizzle.md'),
    'utf8',
  );
  assert.match(honoDrizzle, /N[ÃÕ]O substitui|N[ãa]o substitui/);
  assert.match(honoDrizzle, /NestJS\+Prisma/);
});

test('registry.harnessVersion reflete a versão atual (1.10.2)', () => {
  assert.equal(registry.harnessVersion, '1.10.2');
});

test('AGENT_RULES tem seção "Constitution" com 9 artigos numerados', () => {
  // Procura o título "Constitution"
  assert.match(agentRules, /## 0\. Constitution/i, 'deve existir ## 0. Constitution');
  // Os 9 artigos (I a IX) precisam estar presentes no arquivo
  for (const art of ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']) {
    const re = new RegExp(`### ${art}\\.`);
    assert.match(agentRules, re, `Artigo ${art} deve existir no AGENT_RULES.md`);
  }
});

test('AGENT_RULES tem seção 0.1 Security com OWASP LLM Top 10 + Web', () => {
  assert.match(agentRules, /## 0\.1\. Security/i);
  // OWASP LLM Top 10 — todos os 10 itens LLM01..LLM10
  for (const id of ['LLM01','LLM02','LLM03','LLM04','LLM05','LLM06','LLM07','LLM08','LLM09','LLM10']) {
    assert.match(agentRules, new RegExp(id), `checklist OWASP deve listar ${id}`);
  }
  // OWASP Web — itens característicos
  assert.match(agentRules, /Broken Access Control/);
  assert.match(agentRules, /Cryptographic Failures/);
  assert.match(agentRules, /Injection/);
});

test('Articles NON-NEGOTIABLE são III, V e IX (TDD, Observability, Security)', () => {
  // Procura "NON-NEGOTIABLE" no bloco (título + corpo) dos artigos III, V e IX.
  // III traz no título; V e IX trazem no corpo (gate = "bloqueado").
  for (const art of ['III', 'V', 'IX']) {
    const re = new RegExp(`### ${art}\\.[\\s\\S]{0,800}NON-NEGOTIABLE|### ${art}\\.[\\s\\S]{0,800}bloqueado`);
    assert.match(agentRules, re, `Article ${art} deve marcar NON-NEGOTIABLE/bloqueado no título ou no corpo`);
  }
});
