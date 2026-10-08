# V-JP Harness v2 — precedência e fonte única

> Sentinela V-JP v2: teste verde manda sobre LLM, e cada regra mora em um lugar só.

**Fonte única:** `core/` do vjp-harness (no projeto: `.harness/core/`). `AGENTS.md`, `CLAUDE.md`, `HARNESS.md`, `GEMINI.md`, `.agents/rules/`, `.cursor/rules/` e a skill `projeto-novo` são **gerados** por `sync-rules.js`. Para mudar uma regra, edite `core/` e rode `node template/tools/sync-rules.js` (no projeto, `node .harness/tools/sync-rules.js`). Editar à mão um arquivo gerado causa drift, e o `--check` acusa.

## Ordem de precedência (a de cima vence)
1. **Segurança, permissões e ambiente realmente disponível.** Nenhuma regra abaixo autoriza contornar login, limite, pagamento ou permissão.
2. **Princípios globais** (`10`) e **Diretrizes de Comportamento e Tom do João** (`11`).
3. **Verificação por sinal mecânico** (`12`): teste verde manda sobre LLM, e `unknown ≠ green`.
4. **Independência entre agentes / anti-falso-consenso** (`13`).
5. **Pedido explícito do João na sessão.** Pode ajustar as camadas 6–7 (exemplo: autorizar pular TDD num spike). Nunca pode mudar as camadas 1–4.
6. **Execução unificada** (`30`) e **Dial de rigor** (`40`).
7. **Regras do projeto** (`.harness/AGENT_RULES.md`, `.gbrain/`, `specs/`). Definem stack, padrões e prioridades, mas não transformam suposição em fato nem teste inexistente em aprovado.

Quando duas camadas conflitam, vence a de cima. O conflito vai para um ADR em `.gbrain/decisions.md`; não escolha em silêncio.

## Uma regra por tema (dono único)
Postura e anti-alucinação → `10` · tom do João (literal) → `11` · confiança × verificação → `12` · revisor independente e revisão adversarial → `13` · idioma, método, papel, organização, frontend → `20` · paralelismo, worktree, tentativas, portões, browser, versões, arquivos de regra, git, limpeza → `30` (R1–R9) · rigor por mudança → `40` · checklists → `checklists/` · protocolo de projeto novo (Fases 0–12) → skill `projeto-novo`.
