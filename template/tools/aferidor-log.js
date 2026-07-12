#!/usr/bin/env node
/**
 * V-JP Harness: Aferidor de Confiança — camada de dados (Fase 1).
 * Constrói e persiste o registro de run (schema §3.4 da spec metodo-duravel-portoes-dial).
 * Funções PURAS exportadas p/ teste; CLI só quando invocado direto. — João Pedro (V-JP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Classifica a task pela lista de caminhos tocados. Determinístico; precedência do mais
// crítico ao menos crítico (a primeira regra que casar vence).
export function classifyTaskClass(paths = []) {
  const p = paths.join('\n').toLowerCase();
  if (/migrations?\/|\.migration\.|migration\.sql/.test(p)) return 'migration';
  if (/(^|\/)prod(\/|\b)|production|deploy/.test(p)) return 'prod';
  if (/\.repository\.ts|\.entity\.ts|prisma\/schema|\.sql(\b|$)/.test(p)) return 'db';
  if (/\.tsx(\b|$)|\/web\/|\/frontend\/|\/mobile\//.test(p)) return 'frontend';
  if (/\.ts(\b|$)|\.cs(\b|$)|\/api\/|\/backend\//.test(p)) return 'backend';
  return 'config';
}

// Constrói o registro de run (schema §3.4). PURA — recebe o clock (`now`) e os dados; não lê nada.
// first_try_pass = passou TODOS os portões sem retry. unknown/red ≠ green.
export function buildRunRecord(input) {
  const {
    now, modelId, taskClass, level,
    shadowLevel = null, gates = {}, retries = 0,
    humanIntervened = false, shadowFirstTryPass = null, tokens = null,
  } = input;
  const values = Object.values(gates);
  const firstTryPass = retries === 0 && values.length > 0 && values.every((s) => s === 'green');
  return {
    ts: now,
    event: 'RUN_RECORD',
    model_id: modelId,
    task_class: taskClass,
    level,
    shadow_level: shadowLevel,
    first_try_pass: firstTryPass,
    shadow_first_try_pass: shadowFirstTryPass,
    retries,
    human_intervened: humanIntervened,
    gates,
    tokens,
  };
}
