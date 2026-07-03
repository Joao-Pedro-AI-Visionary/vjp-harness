# Stack Alternativa — Hono + Drizzle + Zod (Bun)

**Tier:** stack-alternative · **Adicionado em:** `1.10.2` · **Status:** OPCIONAL, NÃO substitui NestJS+Prisma · **Origem:** decisão registrada em `.gbrain/decisions.md` (v1.10.2)

## Responsabilidade

Stack opcional e **alternativa** à NestJS+Prisma (que segue como padrão). Use em projetos novos com prioridade em cold start, custo e DX moderna — ou em libs de domínio compartilháveis (auth, payments, validation) que rodam em qualquer stack.

## Por que (rationale)

| Eixo | NestJS+Prisma (atual) | Hono+Drizzle+Bun (alternativa) |
|---|---|---|
| Cold start | ~50ms | ~0.5ms (Cloudflare Workers) |
| req/s por CPU | 1x | ~10x |
| Custo deploy | Railway $5/mês mínimo + pay-per-use | Cloudflare Workers $0.50/M req |
| Type-safety SQL | Prisma (runtime) | Drizzle (compile-time) |
| Validação | class-validator | Zod (end-to-end, mesmo schema p/ front+back) |
| DX | Maduro, mas boilerplate | Hot-reload sub-segundo, testes 10x mais rápidos |
| Ecossistema | Grande | Menor (mas Hono/Drizzle/Zod/Bun são MIT ativos) |
| Migração | Já em 6 projetos | Custo de migração alto; **NÃO migrar** projetos NestJS+Prisma existentes |

## Quando usar

✅ **USE** Hono+Drizzle+Bun em:
- Projeto NOVO onde cold start/custo importam (ex: webhook receiver, API pública, micro-serviço)
- Lib de domínio que será consumida por múltiplos stacks (ex: `auth-core`, `payments-core`)
- Edge functions / Cloudflare Workers / Bun nativo
- Quando a equipe é 1 pessoa (Hono+Drizzle+Zod tem menos boilerplate, mais velocity solo)

❌ **NÃO USE** em:
- Os 6 projetos atualmente instalados com NestJS+Prisma (custo de migração > benefício)
- Projetos que precisam de decorators/middleware estilo NestJS (DI forte)
- Times grandes que dependem da documentação abundante de NestJS

## Componentes (pinados, escolha por projeto)

| Componente | Versão | Pin | Verificação |
|---|---|---|---|
| Bun | latest stable | `bun --version` | `bun --version` exit 0 |
| Hono | latest stable v4 | `package.json` | `bun pm ls hono` |
| Drizzle ORM | latest stable | `package.json` | `bun pm ls drizzle-orm` |
| Zod | latest stable v3 | `package.json` | `bun pm ls zod` |

> **Aviso:** versões NÃO são pinadas pelo harness (é stack externa, não está em `.harness/tools/`). Pin por projeto no `package.json` com `npm ci` / `bun install --frozen-lockfile`.

## Instalação (template por projeto)

```bash
# Criar projeto novo
mkdir meu-app && cd meu-app
bun init
bun add hono drizzle-orm zod
bun add -d drizzle-kit @types/bun
bunx drizzle-kit init

# Estrutura mínima sugerida (Constitution Article I — Library-First)
src/
├── lib/           # libs reutilizáveis (auth, payments, validation)
│   ├── auth/
│   │   ├── index.ts
│   │   ├── cli.ts          # Constitution Article II — CLI Mandate
│   │   └── auth.test.ts    # Constitution Article III — Test-First
│   └── validation/
│       └── schemas.ts      # Zod schemas compartilhados front+back
├── api/           # rotas HTTP
│   ├── index.ts
│   └── routes/
└── db/
    ├── schema.ts           # Drizzle schema (compile-time type-safe)
    └── migrations/
```

## Constitution (9 artigos) aplicada

A stack alternativa **deve** respeitar os 9 artigos da `template/AGENT_RULES.md §0`. Adaptações:

| Artigo | Aplicação em Hono+Drizzle+Bun |
|---|---|
| **I. Library-First** | Idêntico — `src/lib/` para reuso |
| **II. CLI Mandate** | Bun executa `.ts` direto (`bun run cli.ts`); sem build step |
| **III. Test-First** | `bun test` (built-in, zero dep) ou Vitest |
| **IV. Integration Testing** | Drizzle: `pglite` em test OU testcontainers |
| **V. Observability** | Hono middleware logger JSON + Sentry |
| **VI. Versioning** | SemVer estrito (mesma regra) |
| **VII. Simplicity** | ≤ 3 packages; **VANTAGEM**: Hono + Drizzle + Zod são libs pequenas, YAGNI é natural |
| **VIII. Anti-Abstraction** | Drizzle = SQL direto (sem Repository pattern); Hono = rota fina |
| **IX. Security** | OWASP checklist (AGENT_RULES §0.1); Zod valida **todo** input boundary |

## Quando NÃO substituir (anti-pattern)

| Tentação | Por que é anti-pattern |
|---|---|
| Migrar projeto NestJS+Prisma existente | Custo de migração > benefício; time só |
| Adotar Hono + Drizzle + NestJS + Prisma (misturar) | Violação Article VII (YAGNI) e VIII (Anti-Abstraction) |
| Usar Drizzle para tudo (até onde Prisma é melhor) | Prisma tem melhor DX p/ CRUD simples em apps NestJS |

## Próximos passos (validação em 60 dias)

1. **Piloto 1:** webhook receiver em Hono + Cloudflare Workers (jun/2026)
2. **Piloto 2:** CLI tool de migration em Bun + Drizzle (jul/2026)
3. **Critério de promoção a Tier 1:** 2 pilotos verdes + ≥ 1 lib de domínio em produção
4. **Re-avaliação:** se 60 dias sem piloto, marcar como `deferred` e focar no stack NestJS+Prisma

## Referências

- `template/AGENT_RULES.md` — Constitution 9 artigos (§0) + OWASP Security (§0.1)
- `.gbrain/decisions.md` — ADR v1.10.2 (data 2026-07-03)
- `~/Desktop/MANIFESTO-DEV-SOLO-ARQUITETO.md` §6 — Stack Tier 0
- `~/Desktop/INTEGRACAO-VJP-HARNESS-MANIFESTO.md` §3 — Análise do conflito
