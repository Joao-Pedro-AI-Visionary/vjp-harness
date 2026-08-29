# Tasks — Portões de qualidade `test-gate` + `pr-review` (v1.19.0)

- [x] T1 — `tests/gates.test.mjs`: testes de `checkProvaViva` (5 casos) — **RED antes**
- [x] T2 — `gates.js`: `checkProvaViva()` + fiar em `evaluateGates`; `ENFORCED_GATES` intocado
- [x] T3 — `config/dial.json`: `stageMinLevel` ganha `test-gate: 1`, `pr-review: 2`
- [x] T4 — `dial.js`: CLI lista stages do config (não mais array fixo) + teste
- [x] T5 — `machine/export/skills/test-gate/SKILL.md` (2 loops, camadas de teste, escreve prova-viva)
- [x] T6 — `machine/export/skills/pr-review/SKILL.md` (lê .gbrain, teto 10, OWASP por referência)
- [x] T7 — `registry.json` + `REGISTRY.md`: 2 componentes `tier: skill` + bump 1.19.0
- [x] T8 — `VERSION`, `harness.yaml`, cabeçalho do `AGENT_RULES.md` → 1.19.0
- [x] T9 — `AGENT_RULES.md`: §2 REVISOR (1 frase apontando pro Dial) + §7 passo 8
- [x] T10 — `tools/gates.md` + `tools/dial.md`: documentar portão e stages
- [x] T11 — `machine/export/HARNESS.md` + `MACHINE.md` + `bootstrap.sh`
- [x] T12 — Prova viva: `(cd template/tools && npm run check)` verde
- [x] T13 — ADR em `.gbrain/decisions.md` (local; `.gbrain` não vai pro remoto)
- [x] T14 — Instalar globalmente em `~/.claude/skills/` + `--doctor`
