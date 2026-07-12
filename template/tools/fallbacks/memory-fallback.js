/**
 * V-JP Harness: Fallback nativo — Memória Persistente (Fase 5).
 * Implementação PRÓPRIA (formato aberto JSONL) do papel `memory`. Existe para o método
 * sobreviver ao sumiço/troca do GBrain (Risco B) — o dado continua legível sem a ferramenta.
 * — João Pedro (V-JP)
 */
import fs from 'fs';

export function createMemory(storePath) {
  return {
    // Persiste um fato (append-only, crash-safe).
    remember(entry) {
      const rec = { ts: new Date().toISOString(), ...entry };
      fs.appendFileSync(storePath, JSON.stringify(rec) + '\n', 'utf8');
      return rec;
    },
    // Lê os fatos (opcionalmente filtrando por key). Arquivo ausente -> []. Linha corrompida -> ignora.
    recall(key = null) {
      let raw;
      try { raw = fs.readFileSync(storePath, 'utf8'); } catch { return []; }
      const out = [];
      for (const line of raw.split('\n')) {
        const s = line.trim(); if (!s) continue;
        try { const o = JSON.parse(s); if (!key || o.key === key) out.push(o); } catch { /* ignora */ }
      }
      return out;
    },
  };
}
