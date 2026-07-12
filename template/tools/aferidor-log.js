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
