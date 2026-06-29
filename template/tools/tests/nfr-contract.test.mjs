// Helpers puros do Nível 3: decisão de NFR (fila/async) e completude do contrato de API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nfrSummary, contractGaps, contractIsComplete, DRY } from '../agents.js';

test('NFR: operação de LOTE/import exige fila assíncrona idempotente', () => {
  const n = nfrSummary({ strategy: 'importar planilha CSV em lote', acceptanceCriteria: [] });
  assert.equal(n.needsQueue, true);
  assert.equal(n.async, true);
  assert.equal(n.idempotency, true);
});

test('NFR: envio de e-mail em massa / integração externa → fila', () => {
  assert.equal(nfrSummary({ strategy: 'enviar e-mail em massa para clientes' }).needsQueue, true);
  assert.equal(nfrSummary({ strategy: 'sincronizar com webhook de terceiro' }).parallelism, true);
});

test('NFR: risco alto força fila mesmo sem palavra-chave pesada', () => {
  assert.equal(nfrSummary({ risk: 'high', strategy: 'fluxo crítico' }).needsQueue, true);
});

test('NFR: CRUD simples síncrono NÃO precisa de fila', () => {
  const n = nfrSummary({ strategy: 'criar cadastro simples de cliente', risk: 'low' });
  assert.equal(n.needsQueue, false);
  assert.equal(n.async, false);
});

test('Contrato: endpoint completo não tem lacunas', () => {
  const c = { endpoints: [{ method: 'POST', path: '/pedidos', request: {}, response: {}, statusCodes: [201], persists: 'pedidos' }] };
  assert.deepEqual(contractGaps(c), []);
  assert.equal(contractIsComplete(c), true);
});

test('Contrato: detecta lacunas (sem status, sem persists, sem DTO out)', () => {
  const c = { endpoints: [{ method: 'POST', path: '/x', request: {} }] };
  const gaps = contractGaps(c);
  assert.ok(gaps.some((g) => /status/.test(g)));
  assert.ok(gaps.some((g) => /persiste/.test(g)));
  assert.ok(gaps.some((g) => /sa[íi]da/.test(g)));
  assert.equal(contractIsComplete(c), false);
});

test('Contrato vazio é incompleto (back e front não podem confiar)', () => {
  assert.equal(contractIsComplete({ endpoints: [] }), false);
});

test('DRY tem stubs para os novos passos (NFR + contrato)', () => {
  assert.equal(typeof DRY.nfrPlanner().needsQueue, 'boolean');
  assert.ok(Array.isArray(DRY.contract().endpoints));
  assert.ok(DRY.executor({ feature: 'f', layer: 'backend' }).files[0].path.includes('backend'));
});
