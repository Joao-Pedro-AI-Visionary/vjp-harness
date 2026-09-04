# Tasks — Mapa de Código ligado aos portões (v1.21.0)

- [x] T1 — `template/tools/package.json` + lockfile: `codebase-memory-mcp` 0.8.1 → 0.10.8 (`--package-lock-only --ignore-scripts`)
- [x] T2 — `template/tools/cbm.js`: porta `status | index | impact | callers | find`, modo `cli`, `LIMITS` fixos, código 3 sem binário
- [x] T3 — `template/tools/tests/cbm.test.mjs`: partes puras (normalizePath, pickProject, parseArgs, extractResult, resolveBase, LIMITS) — verde
- [x] T4 — `template/tools/codebase-memory-mcp.md`: reescrito (porta, orçamento, instalação sem `install` do binário, MCP só escopo local)
- [x] T5 — `machine/export/skills/pr-review/SKILL.md` §2: `cbm.js impact` antes de abrir vizinho; `callers` só em risco alto; teto de 3
- [x] T6 — `machine/export/skills/test-gate/SKILL.md` §5.1: `impact` diz símbolos e specs que já os cobrem
- [x] T7 — `machine/export/skills/prepush/SKILL.md` camada 5 + `scripts/gate.sh`: raio de impacto no relatório (informativo, nunca bloqueia)
- [x] T8 — `template/config/mcp.json` (0.10.8, nota de escopo local) + `install.sh` (ignora `.codebase-memory/`, `claude mcp add -s local` se houver CLI)
- [x] T9 — `registry.json` (harnessVersion 1.21.0, pin 0.10.8, componente `cbm`) + `REGISTRY.md` + `harness.yaml` + `VERSION` + cabeçalho `AGENT_RULES.md` §Pesquisador
- [x] T10 — `machine/export/HARNESS.md`: bullet do orçamento do grafo nos portões
- [x] T11 — Prova viva: `(cd template/tools && node --test tests/cbm.test.mjs)` verde; `cbm.js impact` real no Partner-Web-Backend (≈1 KB)
- [x] T12 — ADR local em `.gbrain/decisions.md` do Partner-Web-Backend (`.gbrain` não vai pro remoto)
- [x] T14 — `callers`: fallback textual (`git grep`) quando o grafo dá zero; testes de `grepPattern`/`parseGrep`; doc + skill + AGENT_RULES
- [x] T13 — Instalar: skills em `~/.claude/skills` (Windows + WSL); `cbm.js` + doc no `.harness/tools` do Partner-Web-Backend; MCP local registrado
