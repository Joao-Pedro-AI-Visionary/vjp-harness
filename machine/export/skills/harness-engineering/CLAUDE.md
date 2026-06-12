# Harness Engineering Skill

> Spec-first discipline + sensor loop. Install gsd-spec-first to enable /gsd-spec-init and the TDD guard hook.

## Quando usar

Ative esta skill sempre que for desenvolver features completas sob disciplina spec-first.

---

## 0. Estrutura Spec-First (pré-requisito — obrigatório quando `specs/` existe na raiz)

Se o projeto tem `specs/` na raiz, a disciplina **SPEC → TEST → CODE** é enforced. A estrutura mínima é:

```
projeto/
├── specs/<feature>.md          # contrato da feature (6 seções obrigatórias)
├── tests/<feature>.test.ts     # vitest — 1 teste por Critério de Aceite
├── src/<feature>.ts            # implementação MÍNIMA pra passar no teste
├── scripts/
│   ├── validate.ts             # sensores: tsc + lint + test
│   └── enforce.ts              # valida seções obrigatórias + mapping spec↔test
├── package.json                # inclui scripts: check, validate, enforce
└── tsconfig.json
```

### Ordem obrigatória: SPEC → TEST → CODE

1. **SPEC** (`specs/<feature>.md`) — 6 seções: Objetivo, Regras de Negócio, Entradas, Saídas, Casos de Erro, Critérios de Aceite
2. **TEST** (`tests/<feature>.test.ts`) — 1 teste por item dos Critérios de Aceite, falhando antes da implementação (red)
3. **CODE** (`src/<feature>.ts`) — código mínimo pra ficar verde. Sem escopo fora do spec.

### Enforcement

O hook global `gsd-tdd-guard.js` (registrado em `~/.claude/settings.json`) **bloqueia** (exit 2) qualquer `Write`/`Edit` em `src/**/*.{ts,tsx,js,jsx}` se faltar `specs/<base>.md` OU `tests/<base>.test.*` com o mesmo basename.

Exceções: `index.*` e `main.*` (entry points).

### Scaffolder

Para scaffoldar o trio (e bootstrappar o projeto se ainda não existir estrutura):

```
/gsd-spec-init <feature-name>
```

Gera `specs/<feature>.md`, `tests/<feature>.test.ts`, `src/<feature>.ts` com templates prontos. Na primeira invocação em um projeto novo também cria `scripts/`, `package.json`, `tsconfig.json`.

### Comandos de sensor

- `pnpm enforce` — `scripts/enforce.ts` valida que todo spec tem as 6 seções e um teste correspondente
- `pnpm validate` — roda tsc + lint + test
- `pnpm check` — enforce + validate (use antes de todo commit)

---

