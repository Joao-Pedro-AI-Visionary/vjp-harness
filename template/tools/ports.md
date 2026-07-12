# Portas — Adaptadores por Papel (V-JP)

Resolve um **papel** para uma implementação: a **ferramenta** pinada se presente, senão o
**fallback nativo V-JP** (formato aberto). É o que faz o método sobreviver à troca (Risco A)
e ao sumiço (Risco B) de uma ferramenta.

| Papel | Ferramenta | Fallback próprio |
|---|---|---|
| `memory` | GBrain | `fallbacks/memory-fallback.js` (JSONL aberto) |
| `packer` | Repomix | `fallbacks/packer-fallback.js` (texto único) |

**Art. VIII (anti-abstração) reconciliado:** só existe porta onde há **2+ implementações concretas**
(ferramenta + fallback real). Porta sem fallback **não é criada** (YAGNI) — ver spec §3.5.

Uso: `node .harness/tools/ports.js [--json]` → mostra qual implementação está ativa em cada papel.
